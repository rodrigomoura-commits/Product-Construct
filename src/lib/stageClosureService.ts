import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  serverTimestamp, 
  setDoc, 
  where,
  updateDoc
} from "firebase/firestore";
import { db, cleanFirestoreData } from "./firebase";
import { StageClosureSynthesis } from "../types";

export async function saveStageClosure({
  productId,
  stageKey,
  closure
}: {
  productId: string;
  stageKey: string;
  closure: any;
}) {
  const ref = doc(
    db,
    "mindflow_product_synthesis",
    productId,
    "items",
    `${stageKey}_stage_closure`
  );

  const cleanData = cleanFirestoreData({
    ...closure,
    generated_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });

  await setDoc(ref, cleanData, { merge: true });

  // Update the stage document with the completion summary
  await updateDoc(
    doc(db, "products", productId, "stages", stageKey),
    cleanFirestoreData({
      status: "completed",
      is_completed: true,
      completion_summary: closure.executive_summary,
      completion_title: closure.title,
      completion_generated_at: serverTimestamp(),
      updated_at: serverTimestamp()
    })
  );

  return closure;
}

export async function getStageClosure(productId: string, stageKey: string): Promise<StageClosureSynthesis | null> {
  const ref = doc(
    db,
    "mindflow_product_synthesis",
    productId,
    "items",
    `${stageKey}_stage_closure`
  );

  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  return { id: snap.id, ...snap.data() } as any;
}
