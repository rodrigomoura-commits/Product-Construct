import { collection, doc, Firestore } from 'firebase/firestore';

/**
 * HELPER PARA COLECÕES E DOCUMENTOS DO MINDFLOW
 * Garante que caminhos do Firestore tenham sempre o número correto de segmentos.
 */

export function getUserMemoriesCollection(db: Firestore, userId: string) {
  if (!userId) throw new Error("userId is required for getUserMemoriesCollection");
  return collection(db, "mindflow_user_memories", userId, "memories");
}

export function getUserMemoryDoc(db: Firestore, userId: string, memoryId: string) {
  return doc(getUserMemoriesCollection(db, userId), memoryId);
}

export function getProductMemoriesCollection(db: Firestore, productId: string) {
  if (!productId) throw new Error("productId is required for getProductMemoriesCollection");
  return collection(db, "mindflow_product_memories", productId, "memories");
}

export function getProductMemoryDoc(db: Firestore, productId: string, memoryId: string) {
  return doc(getProductMemoriesCollection(db, productId), memoryId);
}

export function getProductSynthesisCollection(db: Firestore, productId: string) {
  if (!productId) throw new Error("productId is required for getProductSynthesisCollection");
  return collection(db, "mindflow_product_synthesis", productId, "items");
}

export function getProductInteractionsCollection(db: Firestore, productId: string) {
  if (!productId) throw new Error("productId is required for getProductInteractionsCollection");
  return collection(db, "mindflow_interactions", productId, "events");
}
