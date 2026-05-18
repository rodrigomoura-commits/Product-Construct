import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { db } from "./firebase";

function normalizeEmail(email: any) {
  return String(email || "").trim().toLowerCase();
}

function normalizeStatus(status: any) {
  return String(status || "active").trim().toLowerCase();
}

function normalizeRole(role: any) {
  return String(role || "viewer").trim().toLowerCase();
}

function getCurrentUserKeys(currentUser: any, profile: any) {
  const uid =
    currentUser?.uid ||
    profile?.uid ||
    null;

  const email = normalizeEmail(
    currentUser?.email ||
    profile?.email
  );

  const profileId =
    profile?.id ||
    profile?.doc_id ||
    profile?.user_id ||
    null;

  return {
    uid,
    email,
    profileId
  };
}

export function getProductPermission(role: string) {
  const normalizedRole = normalizeRole(role);

  const permissions: Record<string, any> = {
    owner: {
      canView: true,
      canEdit: true,
      canComment: true,
      canManageAccess: true,
      canDelete: true,
      canExport: true,
      label: "Owner"
    },
    editor: {
      canView: true,
      canEdit: true,
      canComment: true,
      canManageAccess: false,
      canDelete: false,
      canExport: true,
      label: "Editor"
    },
    commenter: {
      canView: true,
      canEdit: false,
      canComment: true,
      canManageAccess: false,
      canDelete: false,
      canExport: false,
      label: "Comentador"
    },
    viewer: {
      canView: true,
      canEdit: false,
      canComment: false,
      canManageAccess: false,
      canDelete: false,
      canExport: false,
      label: "Visualizador"
    }
  };

  return permissions[normalizedRole] || permissions.viewer;
}

function isCollaboratorActive(collab: any) {
  return normalizeStatus(collab?.status) === "active";
}

function isCollaboratorMatch(collab: any, currentUser: any, profile: any) {
  const { uid, email, profileId } = getCurrentUserKeys(currentUser, profile);

  if (!isCollaboratorActive(collab)) return false;

  const collabEmail = normalizeEmail(collab?.email);

  if (email && collabEmail === email) return true;

  if (uid && collab?.uid === uid) return true;
  if (uid && collab?.user_id === uid) return true;
  if (uid && collab?.id === uid) return true;

  if (profileId && collab?.source_user_doc_id === profileId) return true;
  if (profileId && collab?.user_id === profileId) return true;
  if (profileId && collab?.id === profileId) return true;

  return false;
}

function normalizeProduct(productId: string, productData: any, myAccess: any) {
  const role = normalizeRole(myAccess?.role);

  return {
    id: productId,
    ...productData,
    name:
      productData?.name ||
      productData?.title ||
      "Produto sem nome",
    description:
      productData?.description ||
      productData?.summary ||
      "",
    status:
      productData?.status ||
      "active",
    current_stage:
      productData?.current_stage ||
      productData?.stage ||
      "sense",
    progress:
      typeof productData?.progress === "number"
        ? productData.progress
        : typeof productData?.overall_progress === "number"
          ? productData.overall_progress
          : 0,
    my_access: {
      role,
      label: getProductPermission(role).label,
      permissions: getProductPermission(role),
      collaborator_id: myAccess?.id || null,
      collaborator_email: myAccess?.email || null,
      added_at: myAccess?.added_at || null
    }
  };
}

export async function loadMyProductAccess(productId: string, currentUser: any, profile: any) {
  const { uid, email, profileId } = getCurrentUserKeys(currentUser, profile);

  if (!uid && !email && !profileId) {
    return null;
  }

  // First try the subcollection for this specific product
  const collabQuery = query(collection(db, `products/${productId}/collaborators`));
  const snap = await getDocs(collabQuery);
  
  let access = null;
  
  for (const docSnap of snap.docs) {
    const collab = {
      id: docSnap.id,
      path: docSnap.ref.path,
      ...docSnap.data()
    };
    if (isCollaboratorMatch(collab, currentUser, profile)) {
      access = collab;
      break;
    }
  }

  let roleStr = "viewer";

  if (access) {
    roleStr = normalizeRole(access.role);
  } else {
    // Legacy fallback for this specific product
    try {
      const productSnap = await getDoc(doc(db, "products", productId));
      if (productSnap.exists()) {
        const pData = productSnap.data();
        if (
          (uid && pData.created_by === uid) ||
          (uid && pData.owner_id === uid) ||
          (email && pData.created_by_email === email) ||
          (uid && pData.owner_ids?.includes?.(uid)) ||
          (uid && pData.collaborator_ids?.includes?.(uid)) ||
          (email && pData.collaborator_emails?.includes?.(email))
        ) {
          roleStr = "owner";
          access = { legacy: true };
        }
      }
    } catch (err) {
      console.warn("[MyProducts] legacy singular access fallback error:", err);
    }
  }

  if (!access) return null;

  return {
    role: roleStr,
    label: getProductPermission(roleStr).label,
    permissions: getProductPermission(roleStr),
    collaborator_id: access.id || null,
    collaborator_path: access.path || null,
    added_at: access.added_at || null
  };
}

export async function loadMyProducts(currentUser: any, profile: any) {
  const keys = getCurrentUserKeys(currentUser, profile);

  console.log("[MyProducts] load:start", keys);

  if (!keys.uid && !keys.email && !keys.profileId) {
    console.warn("[MyProducts] load:missing-user-keys");
    return [];
  }

  const productsSnap = await getDocs(collection(db, "products"));

  console.log("[MyProducts] products count", productsSnap.size);

  const matchedProducts: any[] = [];

  for (const productDoc of productsSnap.docs) {
    const productId = productDoc.id;
    const productData = productDoc.data();

    // Check legacy fallback first so it shows up for creators
    let legacyAccess = null;
    if (
      (keys.uid && productData.created_by === keys.uid) ||
      (keys.uid && productData.owner_id === keys.uid) ||
      (keys.email && productData.created_by_email === keys.email) ||
      (keys.uid && productData.owner_ids?.includes?.(keys.uid)) ||
      (keys.uid && productData.collaborator_ids?.includes?.(keys.uid)) ||
      (keys.email && productData.collaborator_emails?.includes?.(keys.email))
    ) {
      legacyAccess = { role: "owner", status: "active", legacy: true };
    }

    try {
      const collaboratorsSnap = await getDocs(
        collection(db, "products", productId, "collaborators")
      );

      const collaborators = collaboratorsSnap.docs.map((collabDoc) => ({
        id: collabDoc.id,
        ...collabDoc.data()
      }));

      const myCollaborator = collaborators.find((collab) =>
        isCollaboratorMatch(collab, currentUser, profile)
      ) || legacyAccess;

      if (!myCollaborator) continue;

      const normalizedProduct = normalizeProduct(
        productId,
        productData,
        myCollaborator
      );

      if ((normalizedProduct.status || "active") === "archived") continue;

      matchedProducts.push(normalizedProduct);
    } catch (error) {
      console.warn("[MyProducts] could not load collaborators", {
        productId,
        error
      });
      // Try to load with legacy access if the collaborators read failed entirely (permissions)
      if (legacyAccess) {
        const normalizedProduct = normalizeProduct(
          productId,
          productData,
          legacyAccess
        );
        if ((normalizedProduct.status || "active") !== "archived") {
          matchedProducts.push(normalizedProduct);
        }
      }
    }
  }

  console.log("[MyProducts] load:result", matchedProducts);

  return matchedProducts;
}
