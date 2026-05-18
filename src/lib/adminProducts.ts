import {
  collection,
  getDocs,
  orderBy,
  query
} from "firebase/firestore";
import { db } from "./firebase";
import {
  calculateAccessHealth,
  calculateProductProgress,
  getProductName,
  isActiveCollaborator,
  isOwnerCollaborator,
  isPendingInvite,
  normalizeEmail,
  shouldProductNeedNormalization
} from "./productAdminUtils";

export async function loadAdminProducts() {
  const [productsSnap, usersSnap] = await Promise.all([
    getDocs(query(collection(db, "products"), orderBy("updated_at", "desc"))),
    getDocs(query(collection(db, "users"), orderBy("email", "asc")))
  ]);

  const users = usersSnap.docs.map((docSnap) => {
    const data = docSnap.data();

    return {
      id: docSnap.id,
      doc_id: docSnap.id,
      uid: data.uid || null,
      email: normalizeEmail(data.email),
      display_name: data.display_name || data.name || data.email || "Sem nome",
      photo_url: data.photo_url || data.avatar_url || null,
      system_role: data.system_role || "user",
      status: data.status || "active",
      ...data
    };
  });

  const userById = new Map<string, any>();
  const userByEmail = new Map<string, any>();

  users.forEach((user) => {
    if (user.id) userById.set(user.id, user);
    if (user.uid) userById.set(user.uid, user);
    if (user.email) userByEmail.set(user.email, user);
  });

  const products = await Promise.all(
    productsSnap.docs.map(async (productDoc) => {
      const productData = productDoc.data();
      const productId = productDoc.id;

      let collaborators: any[] = [];
      let invites: any[] = [];

      try {
        const collaboratorsSnap = await getDocs(
          collection(db, "products", productId, "collaborators")
        );

        collaborators = collaboratorsSnap.docs.map((collabDoc) => {
          const collab = collabDoc.data();
          const email = normalizeEmail(collab.email);
          const userId =
            collab.user_id ||
            collab.uid ||
            collab.source_user_doc_id ||
            collabDoc.id;

          const matchedUser =
            userById.get(userId) ||
            userByEmail.get(email) ||
            null;

          return {
            id: collabDoc.id,
            ...collab,
            user_id: collab.user_id || matchedUser?.uid || matchedUser?.id || null,
            email: collab.email || matchedUser?.email || "",
            display_name:
              collab.display_name ||
              matchedUser?.display_name ||
              matchedUser?.email ||
              collab.email ||
              "Sem nome",
            photo_url: collab.photo_url || matchedUser?.photo_url || null,
            role: collab.role || "viewer",
            status: collab.status || "active"
          };
        });
      } catch (error) {
        console.warn("[AdminProducts] Could not load collaborators for product", productId, error);
      }

      try {
        const invitesSnap = await getDocs(
          collection(db, "products", productId, "invites")
        );

        invites = invitesSnap.docs.map((inviteDoc) => ({
          id: inviteDoc.id,
          ...inviteDoc.data()
        }));
      } catch (error) {
        console.warn("[AdminProducts] Could not load invites for product", productId, error);
      }

      const activeCollaborators = collaborators.filter(isActiveCollaborator);
      const owners = activeCollaborators.filter(isOwnerCollaborator);
      const pendingInvites = invites.filter(isPendingInvite);

      const needsNormalization = shouldProductNeedNormalization(productData, collaborators);
      const accessHealth = calculateAccessHealth(
        { ...productData, needs_access_normalization: needsNormalization },
        collaborators,
        pendingInvites
      );

      return {
        id: productId,
        ...productData,
        name: getProductName(productData),
        status: productData.status || "active",
        current_stage: productData.current_stage || productData.stage || "sense",
        progress: calculateProductProgress(productData),
        quality: typeof productData.quality === "number" ? productData.quality : 0,

        collaborators,
        owners,
        pending_invites: pendingInvites,

        collaborators_count: activeCollaborators.length,
        owners_count: owners.length,
        pending_invites_count: pendingInvites.length,

        needs_normalization: needsNormalization,
        access_health: accessHealth.health,
        access_health_reason: accessHealth.reason
      };
    })
  );

  return {
    products,
    users
  };
}
