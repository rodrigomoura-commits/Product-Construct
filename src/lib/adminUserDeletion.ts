import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "./firebase";

function normalizeEmail(email: any) {
  return String(email || "").trim().toLowerCase();
}

export async function deleteSuspendedUser({
  targetUser,
  currentUser
}: {
  targetUser: any;
  currentUser: any;
}) {
  if (!targetUser?.id) {
    throw new Error("Usuário alvo sem ID.");
  }

  if ((targetUser.status || "active") !== "suspended") {
    throw new Error("Somente usuários suspensos podem ser deletados.");
  }

  if (currentUser?.uid && targetUser.uid === currentUser.uid) {
    throw new Error("Você não pode deletar o próprio usuário.");
  }

  const targetUserDocId = targetUser.id;
  const targetUid = targetUser.uid || null;
  const targetEmail = normalizeEmail(targetUser.email);

  const affectedProducts = new Map<string, any>();

  // 1. Buscar acessos por índice user_product_access/{uid}/products
  if (targetUid) {
    try {
      const accessSnap = await getDocs(
        collection(db, "user_product_access", targetUid, "products")
      );

      accessSnap.docs.forEach((docSnap) => {
        affectedProducts.set(docSnap.id, {
          productId: docSnap.id,
          accessDocPath: docSnap.ref.path,
          accessData: docSnap.data()
        });
      });
    } catch (error) {
      console.warn("[DeleteUser] Could not load user_product_access", error);
    }
  }

  // 2. Buscar collaborators por uid/user_id/source_user_doc_id/email usando collectionGroup
  const collaboratorQueries: Array<{ field: string; value: any }> = [];

  if (targetUid) {
    collaboratorQueries.push({ field: "uid", value: targetUid });
    collaboratorQueries.push({ field: "user_id", value: targetUid });
  }

  if (targetUserDocId) {
    collaboratorQueries.push({ field: "source_user_doc_id", value: targetUserDocId });
    collaboratorQueries.push({ field: "user_id", value: targetUserDocId });
  }

  if (targetEmail) {
    collaboratorQueries.push({ field: "email", value: targetEmail });
  }

  const collaboratorDocs: any[] = [];

  for (const item of collaboratorQueries) {
    try {
      const snap = await getDocs(
        query(
          collectionGroup(db, "collaborators"),
          where(item.field, "==", item.value)
        )
      );

      snap.docs.forEach((docSnap) => {
        const path = docSnap.ref.path;
        const segments = path.split("/");
        const productIndex = segments.indexOf("products");
        const productId = productIndex >= 0 ? segments[productIndex + 1] : null;

        if (!productId) return;

        collaboratorDocs.push({
          ref: docSnap.ref,
          id: docSnap.id,
          productId,
          data: docSnap.data()
        });

        affectedProducts.set(productId, {
          productId
        });
      });
    } catch (error) {
      console.warn(`[DeleteUser] collaborator query failed: ${item.field}`, error);
    }
  }

  // 3. Buscar convites pendentes pelo email
  const inviteDocs: any[] = [];

  if (targetEmail) {
    try {
      const invitesSnap = await getDocs(
        query(
          collectionGroup(db, "invites"),
          where("email", "==", targetEmail)
        )
      );

      invitesSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const status = data.status || "pending";

        if (status !== "pending") return;

        const path = docSnap.ref.path;
        const segments = path.split("/");
        const productIndex = segments.indexOf("products");
        const productId = productIndex >= 0 ? segments[productIndex + 1] : null;

        inviteDocs.push({
          ref: docSnap.ref,
          id: docSnap.id,
          productId,
          data
        });

        if (productId) {
          affectedProducts.set(productId, { productId });
        }
      });
    } catch (error) {
      console.warn("[DeleteUser] invite query failed", error);
    }
  }

  // 4. Validar se não é último owner em algum produto
  const ownerCollaborators = ownerCollaboratorsFilter(collaboratorDocs);

  if (ownerCollaborators.length > 0) {
    throw new Error(
      "Este usuário ainda é owner de um ou mais produtos. Transfira a propriedade antes de deletar."
    );
  }

  // 5. Remover dados em batch
  const batch = writeBatch(db);

  // 5.1 Remover collaborators encontrados
  collaboratorDocs.forEach((item) => {
    batch.delete(item.ref);
  });

  // 5.2 Revogar convites pendentes do email
  inviteDocs.forEach((item) => {
    batch.update(item.ref, {
      status: "revoked",
      revoked_at: serverTimestamp(),
      revoked_by: currentUser?.uid || null,
      revoked_by_email: currentUser?.email || null,
      revoked_reason: "deleted_suspended_user",
      updated_at: serverTimestamp()
    });
  });

  // 5.3 Remover user_product_access
  if (targetUid) {
    try {
      const accessSnap = await getDocs(
        collection(db, "user_product_access", targetUid, "products")
      );

      accessSnap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      batch.delete(doc(db, "user_product_access", targetUid));
    } catch (error) {
      console.warn("[DeleteUser] Could not batch delete user_product_access", error);
    }
  }

  // 5.4 Remover documento users/{id}
  batch.delete(doc(db, "users", targetUserDocId));

  // 5.5 Registrar na lista de usuários deletados para impedir retorno automático
  if (targetEmail) {
    const sanitizedEmail = targetEmail.replace(/[.@]/g, '_');
    batch.set(doc(db, "deleted_users", sanitizedEmail), {
      email: targetEmail,
      deleted_at: serverTimestamp(),
      deleted_by: currentUser?.uid || null,
      reason: "suspended_user_deletion"
    });
  }

  await batch.commit();

  // 6. Limpar arrays agregados dos produtos afetados
  for (const productId of Array.from(affectedProducts.keys())) {
    try {
      await updateDoc(doc(db, "products", productId), {
        needs_access_normalization: true,
        updated_at: serverTimestamp()
      });
    } catch (error) {
      console.warn("[DeleteUser] Could not mark product normalization", productId, error);
    }
  }

  // 7. Registrar audit log
  await addDoc(collection(db, "audit_logs"), {
    type: "user_deleted",
    category: "admin",
    severity: "critical",
    actor_id: currentUser?.uid || null,
    actor_email: currentUser?.email || null,
    target_user_id: targetUid || targetUserDocId,
    target_user_doc_id: targetUserDocId,
    target_email: targetEmail || null,
    summary: `Usuário suspenso ${targetEmail || targetUserDocId} foi deletado e teve acessos removidos.`,
    metadata: {
      removed_collaborators_count: collaboratorDocs.length,
      revoked_invites_count: inviteDocs.length,
      affected_products: Array.from(affectedProducts.keys())
    },
    created_at: serverTimestamp()
  });

  return {
    removedCollaborators: collaboratorDocs.length,
    revokedInvites: inviteDocs.length,
    affectedProducts: Array.from(affectedProducts.keys())
  };
}

function ownerCollaboratorsFilter(collaboratorDocs: any[]) {
  return collaboratorDocs.filter((item) => {
    return String(item.data?.role || "").toLowerCase() === "owner"
      && String(item.data?.status || "active").toLowerCase() === "active";
  });
}
