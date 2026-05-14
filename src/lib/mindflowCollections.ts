import { collection, doc, Firestore } from 'firebase/firestore';

/**
 * HELPER PARA COLECÕES E DOCUMENTOS DO MINDFLOW
 * Garante que caminhos do Firestore tenham sempre o número correto de segmentos.
 */

export function getUserMemoriesCollection(db: Firestore) {
  return collection(db, "mindflow_user_memories");
}

export function getUserMemoryDoc(db: Firestore, memoryId: string) {
  if (!memoryId) {
    throw new Error("memoryId is required to create a document reference for mindflow_user_memories");
  }
  return doc(db, "mindflow_user_memories", memoryId);
}

export function getUserMemoryDocByUserId(db: Firestore, userId: string) {
  if (!userId) {
    throw new Error("userId is required to create a document reference for mindflow_user_memories");
  }
  return doc(db, "mindflow_user_memories", userId);
}
