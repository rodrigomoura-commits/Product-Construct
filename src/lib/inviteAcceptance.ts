import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { db } from "./firebase";
import { cleanFirestoreData } from "./firestoreSanitizer";

function normalizeEmail(email: any) {
  return String(email || "").trim().toLowerCase();
}

function sanitizeFirestoreId(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[.#$/[\]]/g, "_");
}

function getProductIdFromInvitePath(path: string) {
  const segments = path.split("/");
  const productsIndex = segments.indexOf("products");

  if (productsIndex < 0) return null;

  return segments[productsIndex + 1] || null;
}

export async function acceptPendingInvitesForUser(firebaseUser: any, profile: any) {
  const email = normalizeEmail(firebaseUser?.email || profile?.email);

  if (!email) return;

  const uid = firebaseUser?.uid || profile?.uid || null;
  const profileId = profile?.id || profile?.doc_id || uid;

  const invitesSnap = await getDocs(
    query(
      collectionGroup(db, "invites"),
      where("email", "==", email),
      where("status", "==", "pending")
    )
  );

  if (invitesSnap.empty) return;

  for (const inviteDoc of invitesSnap.docs) {
    const invite: any = {
      id: inviteDoc.id,
      path: inviteDoc.ref.path,
      ...inviteDoc.data()
    };

    const productId = getProductIdFromInvitePath(inviteDoc.ref.path);

    if (!productId) continue;

    const productSnap = await getDoc(doc(db, "products", productId));
    const product = productSnap.exists() ? productSnap.data() : null;

    const collaboratorDocId = sanitizeFirestoreId(uid || profileId || email);

    const collaboratorPayload = cleanFirestoreData({
      id: collaboratorDocId,
      user_id: uid || profileId,
      uid: uid || null,
      source_user_doc_id: profileId || null,
      email,
      display_name:
        profile?.display_name ||
        firebaseUser?.displayName ||
        email,
      photo_url:
        profile?.photo_url ||
        firebaseUser?.photoURL ||
        null,
      role: invite.role || "viewer",
      status: "active",
      added_at: serverTimestamp(),
      added_by: invite.created_by || null,
      added_by_email: invite.created_by_email || null,
      source: "invite_acceptance"
    });

    await setDoc(
      doc(db, "products", productId, "collaborators", collaboratorDocId),
      collaboratorPayload,
      { merge: true }
    );
    
    if (firebaseUser?.uid) {
      const { upsertUserProductAccess } = await import("./userProductAccess");
      await upsertUserProductAccess({
        uid: firebaseUser.uid,
        product: {
          id: productId,
          name: product?.name || product?.title || "Produto sem nome",
          description: product?.description || product?.summary || "",
          status: product?.status || "active",
          current_stage: product?.current_stage || product?.stage || "sense",
          progress:
            typeof product?.progress === "number"
              ? product.progress
              : typeof product?.overall_progress === "number"
                ? product.overall_progress
                : 0,
        },
        role: invite.role as any || "viewer",
      });
    }

    await updateDoc(inviteDoc.ref, cleanFirestoreData({
      status: "accepted",
      accepted_at: serverTimestamp(),
      accepted_by: uid || profileId || null,
      accepted_by_email: email,
      updated_at: serverTimestamp()
    }));

    await addDoc(collection(db, "audit_logs"), cleanFirestoreData({
      type: "product_invite_accepted",
      category: "product",
      severity: "info",
      actor_id: uid || profileId || null,
      actor_email: email,
      product_id: productId,
      product_name: product?.name || product?.title || null,
      target_email: email,
      summary: `${email} aceitou convite e virou colaborador do produto ${product?.name || productId}.`,
      metadata: {
        invite_id: invite.id,
        role: invite.role || "viewer",
        collaborator_id: collaboratorDocId
      },
      created_at: serverTimestamp()
    }));
  }
}
