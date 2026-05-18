import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { db } from "./firebase";
import { getProductPermission } from "./productPermissions";

function cleanFirestoreData<T = any>(value: T): T {
  if (value === undefined) return null as T;
  if (value === null) return value;
  if (value instanceof Date) return value;

  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as T;
  }

  if (typeof value === "object") {
    const cleaned: Record<string, any> = {};

    Object.entries(value as Record<string, any>).forEach(([key, entryValue]) => {
      cleaned[key] = entryValue === undefined ? null : cleanFirestoreData(entryValue);
    });

    return cleaned as T;
  }

  return value;
}

export async function upsertUserProductAccess({
  uid,
  product,
  role,
  status = "active"
}: {
  uid: string;
  product: any;
  role: "owner" | "editor" | "commenter" | "viewer";
  status?: "active" | "removed" | "suspended";
}) {
  if (!uid) {
    throw new Error("uid é obrigatório para criar índice de acesso.");
  }

  if (!product?.id) {
    throw new Error("product.id é obrigatório para criar índice de acesso.");
  }

  await setDoc(
    doc(db, "user_product_access", uid, "products", product.id),
    cleanFirestoreData({
      product_id: product.id,
      product_name: product.name || product.title || "Produto sem nome",
      product_description: product.description || product.summary || "",
      product_status: product.status || "active",
      current_stage: product.current_stage || product.stage || "sense",
      progress:
        typeof product.progress === "number"
          ? product.progress
          : typeof product.overall_progress === "number"
            ? product.overall_progress
            : 0,
      role,
      status,
      updated_at: serverTimestamp()
    }),
    { merge: true }
  );
}

export async function removeUserProductAccess(uid: string, productId: string) {
  if (!uid || !productId) return;

  await deleteDoc(
    doc(db, "user_product_access", uid, "products", productId)
  );
}

export async function loadMyProductAccess(uid: string) {
  if (!uid) return [];

  const snap = await getDocs(
    query(
      collection(db, "user_product_access", uid, "products"),
      orderBy("updated_at", "desc")
    )
  );

  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data();
      const role = data.role || "viewer";

      return {
        id: data.product_id || docSnap.id,
        name: data.product_name || "Produto sem nome",
        description: data.product_description || "",
        status: data.product_status || "active",
        current_stage: data.current_stage || "sense",
        progress: typeof data.progress === "number" ? data.progress : 0,
        my_access: {
          role,
          label: getProductPermission(role).label,
          permissions: getProductPermission(role)
        },
        ...data
      };
    })
    .filter((item: any) => (item.status || "active") === "active")
    .filter((item: any) => (item.status || "active") !== "archived");
}
