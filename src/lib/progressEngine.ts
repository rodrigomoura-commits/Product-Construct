import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { db } from "./firebase";
import { calculateProductMaturity } from "./maturity";

export type ProgressKind = "stage_maturity" | "product_evolution";

export function normalizeProgress(value: any) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) return 0;

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function getStageMaturity(stage: any) {
  return normalizeProgress(
    stage?.progress ??
    stage?.maturity ??
    stage?.quality_score ??
    0
  );
}

export function isStageCompleted(stage: any) {
  return (
    getStageMaturity(stage) >= 100 ||
    stage?.status === "completed" ||
    stage?.is_completed === true
  );
}

export function calculateProductEvolutionFromStages(stages: any[]) {
  return normalizeProgress(calculateProductMaturity(stages || []));
}

export function getCachedProductEvolution(product: any) {
  return getDisplayProgress(product);
}

export function getDisplayProgress(product: any) {
  return normalizeProgress(
    product?.calculatedProgress ??
    product?.overall_progress ??
    product?.evolution_score ??
    product?.progress ??
    0
  );
}

export async function calculateProductEvolutionFromFirestore(productId: string) {
  if (!productId) return 0;

  const stagesSnap = await getDocs(
    collection(db, "products", productId, "stages")
  );

  const stages = stagesSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  return calculateProductEvolutionFromStages(stages);
}

export async function loadStagesAndCalculateProductEvolution(productId: string) {
  return calculateProductEvolutionFromFirestore(productId);
}

export async function syncProductEvolutionCache(productId: string) {
  if (!productId) return 0;
  const evolution = await loadStagesAndCalculateProductEvolution(productId);

  await updateDoc(doc(db, "products", productId), {
    progress: evolution,
    overall_progress: evolution,
    evolution_score: evolution,
    last_progress_sync_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });

  return evolution;
}

export async function touchStage(productId: string, stageKey: string, type: 'memory' | 'field' | 'document' | 'decision' | 'conversation') {
  if (!productId || !stageKey) return;
  
  const fieldMap = {
    memory: 'last_memory_update_at',
    field: 'last_field_update_at',
    document: 'last_document_update_at',
    decision: 'last_decision_update_at',
    conversation: 'last_conversation_update_at'
  };

  const updateField = fieldMap[type] || 'updated_at';

  await updateDoc(doc(db, "products", productId, "stages", stageKey), {
    [updateField]: serverTimestamp(),
    updated_at: serverTimestamp()
  });
}
