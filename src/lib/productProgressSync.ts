import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { db } from "./firebase";
import { calculateProductMaturity } from "./maturity";

export async function calculateAndSyncProductProgress(productId: string) {
  if (!productId) return 0;

  const stagesSnap = await getDocs(
    query(collection(db, "products", productId, "stages"))
  );

  const stages = stagesSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  const progress = calculateProductMaturity(stages);

  await updateDoc(doc(db, "products", productId), {
    progress,
    overall_progress: progress,
    evolution_score: progress,
    last_progress_sync_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });

  return progress;
}
