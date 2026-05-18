import { 
  collection, addDoc, query, where, orderBy, limit, getDocs, 
  serverTimestamp, doc, setDoc, getDoc, updateDoc 
} from 'firebase/firestore';
import { db } from './firebase';
import { cleanFirestoreData } from './firestoreSanitizer';

export interface ProductHistoryEvent {
  id?: string;
  product_id: string;
  type: "conversation_turn" | "field_update" | "decision_created" | "artifact_created" | "artifact_updated" | "stage_progress_changed" | "risk_identified" | "gap_identified" | "learning_created" | "manual_note" | "synthesis_point_discussed";
  stage_key: string;
  title: string;
  summary: string;
  before?: any;
  after?: any;
  source: "tona_chat" | "manual_edit" | "artifact_editor" | "mindflow" | "system" | "synthesis_interaction";
  created_by: string;
  created_by_email?: string;
  created_at?: any;
  related_interaction_id?: string;
  related_artifact_id?: string;
  related_decision_id?: string;
  confidence?: number;
  classification?: "fact" | "hypothesis" | "evidence" | "decision" | "risk" | "pending" | "learning";
  metadata?: any;
}

export async function createProductHistoryEvent(event: Omit<ProductHistoryEvent, 'created_at'>) {
  const historyRef = collection(db, `products/${event.product_id}/history_events`);
  return await addDoc(historyRef, cleanFirestoreData({
    ...event,
    created_at: serverTimestamp()
  }));
}

export async function getRecentProductHistory(productId: string, limitCount = 10) {
  const q = query(
    collection(db, `/products/${productId}/history_events`),
    orderBy('created_at', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductHistoryEvent));
}

export async function buildProductHistoryPack(productId: string, stageKey: string) {
  // 80/20: basic implementation
  const recentProductEvents = await getRecentProductHistory(productId, 10);
  
  // Placeholder for advanced summaries
  return {
    recent_product_events: recentProductEvents,
    recent_stage_events: [], 
    open_gaps: [],
    decisions_summary: [],
    artifacts_summary: [],
    last_meaningful_update: null,
    product_timeline_summary: "Produto em desenvolvimento ativo."
  };
}
