import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import { getProductPermission, normalizeProductRole } from "./productPermissions";

export async function resolveWorkspaceAccess({
  uid,
  productId,
  email
}: {
  uid: string;
  productId: string;
  email?: string | null;
}) {
  if (!uid) {
    return {
      hasAccess: false,
      reason: "Usuário não autenticado.",
      access: null,
      permissions: getProductPermission("viewer")
    };
  }

  if (!productId) {
    return {
      hasAccess: false,
      reason: "Produto não informado.",
      access: null,
      permissions: getProductPermission("viewer")
    };
  }

  const accessRef = doc(db, "user_product_access", uid, "products", productId);
  const accessSnap = await getDoc(accessRef);

  if (accessSnap.exists()) {
    const access = {
      id: accessSnap.id,
      ...accessSnap.data()
    } as any;

    const status = String(access.status || "active").toLowerCase();
    const productStatus = String(access.product_status || "active").toLowerCase();
    const role = normalizeProductRole(access.role);

    if (status === "active" && productStatus !== "archived") {
      return {
        hasAccess: true,
        access: { ...access, role },
        permissions: getProductPermission(role)
      };
    }
  }

  const collaboratorByUidSnap = await getDoc(
    doc(db, "products", productId, "collaborators", uid)
  );

  if (collaboratorByUidSnap.exists()) {
    const collab = {
      id: collaboratorByUidSnap.id,
      ...collaboratorByUidSnap.data()
    } as any;

    const status = String(collab.status || "active").toLowerCase();
    const role = normalizeProductRole(collab.role);

    if (status === "active") {
      await setDoc(
        accessRef,
        {
          product_id: productId,
          role,
          status: "active",
          updated_at: serverTimestamp()
        },
        { merge: true }
      );

      return {
        hasAccess: true,
        access: { ...collab, role },
        permissions: getProductPermission(role)
      };
    }
  }

  if (email) {
    const byEmailSnap = await getDocs(
      query(
        collection(db, "products", productId, "collaborators"),
        where("email", "==", String(email).trim().toLowerCase())
      )
    );

    const activeEmailCollab = byEmailSnap.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as any))
      .find((collab) => String(collab.status || "active").toLowerCase() === "active");

    if (activeEmailCollab) {
      const role = normalizeProductRole(activeEmailCollab.role);

      await setDoc(
        accessRef,
        {
          product_id: productId,
          role,
          status: "active",
          updated_at: serverTimestamp()
        },
        { merge: true }
      );

      return {
        hasAccess: true,
        access: { ...activeEmailCollab, role },
        permissions: getProductPermission(role)
      };
    }
  }

  return {
    hasAccess: false,
    reason: "Você não tem acesso ativo a este produto.",
    access: null,
    permissions: getProductPermission("viewer")
  };
}

export async function touchWorkspaceAccess({
  uid,
  productId
}: {
  uid: string;
  productId: string;
}) {
  if (!uid || !productId) return;

  await setDoc(
    doc(db, "user_product_access", uid, "products", productId),
    {
      last_opened_at: serverTimestamp(),
      updated_at: serverTimestamp()
    },
    { merge: true }
  );
}
