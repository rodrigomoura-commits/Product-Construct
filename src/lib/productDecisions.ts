import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  Product, 
  AdminCtx, 
  ProductDecision, 
  ProductDecisionType, 
  ProductDecisionDirection, 
  ProductDecisionStatus,
  StageKey
} from '../types';
import { canEditProduct } from './productAccess';
import { cleanFirestoreData } from './firestoreSanitizer';
import { touchStage } from './progressEngine';

export async function createProductDecision({
  product,
  data,
  currentUser,
  adminContext
}: {
  product: Product;
  data: Partial<ProductDecision>;
  currentUser: any;
  adminContext?: AdminCtx;
}) {
  if (!canEditProduct(product, currentUser, adminContext)) {
    throw new Error("Você não tem permissão para criar decisões neste produto.");
  }

  const decisionRef = doc(collection(db, "products", product.id, "decisions"));
  const decisionId = decisionRef.id;

  const decisionData: ProductDecision = cleanFirestoreData({
    id: decisionId,
    product_id: product.id,
    organization_id: product.organization_id ?? null,
    title: data.title || "",
    summary: data.summary || "",
    decision_type: (data.decision_type as ProductDecisionType) || "product",
    direction: (data.direction as ProductDecisionDirection) || "chosen",
    status: data.status || "active",
    stage_key: (data.stage_key as StageKey) || (product.current_stage as StageKey) || null,
    decision_statement: data.decision_statement || "",
    rationale: data.rationale || "",
    impact_areas: data.impact_areas || [],
    alternatives_considered: data.alternatives_considered || [],
    risks: data.risks || [],
    assumptions: data.assumptions || [],
    implications: data.implications || [],
    evidence: data.evidence || [],
    participants: data.participants || [],
    related_links: data.related_links || [],
    related_document_ids: data.related_document_ids || [],
    related_artifact_ids: data.related_artifact_ids || [],
    decided_by: currentUser.uid,
    decided_by_email: currentUser.email || null,
    decided_by_name: currentUser.displayName || currentUser.email || null,
    decided_at: data.decided_at || serverTimestamp(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    ...data
  });

  await setDoc(decisionRef, decisionData);

  // Sync with product memory
  await createDecisionMemoryItem(product, decisionData, currentUser);

  // History event
  await addDoc(collection(db, `products/${product.id}/history_events`), cleanFirestoreData({
    type: "decision_created",
    title: "Decisão registrada",
    summary: `A decisão "${decisionData.title}" foi registrada por ${currentUser.email || 'um usuário'}.`,
    actor_id: currentUser.uid,
    actor_email: currentUser.email || null,
    decision_id: decisionId,
    stage_key: decisionData.stage_key || null,
    created_at: serverTimestamp()
  }));

  if (decisionData.stage_key) {
    await touchStage(product.id, decisionData.stage_key, 'decision');
  }

  return decisionId;
}

export async function updateProductDecision({
  product,
  decisionId,
  data,
  changeReason,
  currentUser,
  adminContext
}: {
  product: Product;
  decisionId: string;
  data: Partial<ProductDecision>;
  changeReason?: string;
  currentUser: any;
  adminContext?: AdminCtx;
}) {
  if (!canEditProduct(product, currentUser, adminContext)) {
    throw new Error("Você não tem permissão para editar decisões neste produto.");
  }

  const decisionRef = doc(db, "products", product.id, "decisions", decisionId);
  const oldDoc = await getDoc(decisionRef);
  
  if (!oldDoc.exists()) {
    throw new Error("Decisão não encontrada.");
  }

  const oldData = oldDoc.data() as ProductDecision;

  // 1. Save version snapshot
  const versionsRef = collection(db, "products", product.id, "decisions", decisionId, "versions");
  const versionSnapshots = await getDocs(query(versionsRef, orderBy("version_number", "desc")));
  const nextVersionNumber = versionSnapshots.empty ? 1 : (versionSnapshots.docs[0].data()?.version_number || 0) + 1;

  await addDoc(versionsRef, cleanFirestoreData({
    version_number: nextVersionNumber,
    snapshot: oldData,
    changed_by: currentUser.uid,
    changed_by_email: currentUser.email || null,
    change_reason: changeReason || null,
    created_at: serverTimestamp()
  }));

  // 2. Update main document
  const updateData = cleanFirestoreData({
    ...data,
    updated_at: serverTimestamp()
  });

  await updateDoc(decisionRef, updateData);

  // 3. Update memory item
  await syncDecisionMemoryItem(product, decisionId, { ...oldData, ...data }, currentUser);

  // 4. History event
  await addDoc(collection(db, `products/${product.id}/history_events`), cleanFirestoreData({
    type: "decision_updated",
    title: "Decisão atualizada",
    summary: `A decisão "${oldData.title}" foi atualizada por ${currentUser.email || 'um usuário'}.`,
    actor_id: currentUser.uid,
    actor_email: currentUser.email || null,
    decision_id: decisionId,
    created_at: serverTimestamp()
  }));

  if (oldData.stage_key) {
    await touchStage(product.id, oldData.stage_key, 'decision');
  }
}

export async function supersedeProductDecision({
  product,
  oldDecisionId,
  newData,
  currentUser,
  adminContext
}: {
  product: Product;
  oldDecisionId: string;
  newData: Partial<ProductDecision>;
  currentUser: any;
  adminContext?: AdminCtx;
}) {
  // 1. Create new decision
  const newDecisionId = await createProductDecision({
    product,
    data: {
      ...newData,
      status: "active",
      supersedes_decision_id: oldDecisionId
    },
    currentUser,
    adminContext
  });

  // 2. Update old decision status
  const oldDecisionRef = doc(db, "products", product.id, "decisions", oldDecisionId);
  await updateDoc(oldDecisionRef, {
    status: "superseded",
    superseded_by_decision_id: newDecisionId,
    updated_at: serverTimestamp()
  });

  // 3. History event for superseding
  const oldDoc = await getDoc(oldDecisionRef);
  const oldTitle = oldDoc.data()?.title || "Decisão anterior";

  await addDoc(collection(db, `products/${product.id}/history_events`), cleanFirestoreData({
    type: "decision_superseded",
    title: "Decisão substituída",
    summary: `A decisão "${oldTitle}" foi substituída por "${newData.title}".`,
    actor_id: currentUser.uid,
    actor_email: currentUser.email || null,
    old_decision_id: oldDecisionId,
    new_decision_id: newDecisionId,
    created_at: serverTimestamp()
  }));

  return newDecisionId;
}

export async function archiveProductDecision(product: Product, decisionId: string, currentUser: any, adminContext?: AdminCtx) {
  if (!canEditProduct(product, currentUser, adminContext)) {
    throw new Error("Você não tem permissão para arquivar decisões.");
  }

  await updateDoc(doc(db, "products", product.id, "decisions", decisionId), {
    status: "archived",
    updated_at: serverTimestamp()
  });
}

async function createDecisionMemoryItem(product: Product, decision: ProductDecision, currentUser: any) {
  // Check if a memory item for this decision already exists
  const memoryRef = collection(db, "products", product.id, "memory_items");
  const q = query(memoryRef, where("source_decision_id", "==", decision.id));
  const snap = await getDocs(q);

  if (snap.empty) {
    await addDoc(memoryRef, cleanFirestoreData({
      product_id: product.id,
      organization_id: product.organization_id ?? null,
      classification: "decision",
      title: decision.title,
      content: decision.decision_statement,
      source: "official_decision",
      source_decision_id: decision.id,
      stage_key: decision.stage_key || product.current_stage || null,
      confidence: "high",
      created_by: "human",
      created_by_user_id: currentUser.uid,
      created_by_email: currentUser.email || null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    }));
  }
}

async function syncDecisionMemoryItem(product: Product, decisionId: string, decision: ProductDecision, currentUser: any) {
  const memoryRef = collection(db, "products", product.id, "memory_items");
  const q = query(memoryRef, where("source_decision_id", "==", decisionId));
  const snap = await getDocs(q);

  if (!snap.empty) {
    const memoryDoc = snap.docs[0];
    await updateDoc(doc(db, "products", product.id, "memory_items", memoryDoc.id), cleanFirestoreData({
      title: decision.title,
      content: decision.decision_statement,
      stage_key: decision.stage_key || product.current_stage || null,
      updated_at: serverTimestamp()
    }));
  } else {
    // If somehow missing, create it
    await createDecisionMemoryItem(product, decision, currentUser);
  }
}

export function watchProductDecisions(productId: string, callback: (decisions: ProductDecision[]) => void) {
  const q = query(
    collection(db, "products", productId, "decisions"),
    orderBy("created_at", "desc")
  );

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductDecision)));
  });
}
