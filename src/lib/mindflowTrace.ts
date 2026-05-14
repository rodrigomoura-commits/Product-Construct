import { collection, doc, addDoc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanFirestoreData } from './firebase';
import { MindflowCognitiveTrace, MindflowCognitiveTraceEvent } from '../types';

/**
 * Initializes a new cognitive trace for an interaction.
 */
export async function createCognitiveTrace(data: Partial<MindflowCognitiveTrace>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'mindflow_cognitive_traces'), cleanFirestoreData({
      ...data,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      used_memory_ids: data.used_memory_ids || [],
      used_learning_ids: data.used_learning_ids || [],
      used_reasoning_ids: data.used_reasoning_ids || [],
      used_behavioral_signal_ids: data.used_behavioral_signal_ids || [],
      detected_conflict_ids: data.detected_conflict_ids || [],
      adaptation_applied: data.adaptation_applied || {},
      warnings: data.warnings || [],
      save_actions: data.save_actions || []
    }));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'mindflow_cognitive_traces');
    throw error;
  }
}

/**
 * Adds an event to a cognitive trace.
 */
export async function addTraceEvent(traceId: string, order: number, event: Omit<MindflowCognitiveTraceEvent, 'id' | 'trace_id' | 'event_order' | 'created_at'>) {
  try {
    await addDoc(collection(db, 'mindflow_cognitive_trace_events'), cleanFirestoreData({
      trace_id: traceId,
      event_order: order,
      ...event,
      created_at: serverTimestamp()
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'mindflow_cognitive_trace_events');
  }
}

/**
 * Finalizes a cognitive trace with results and snapshots.
 */
export async function finalizeCognitiveTrace(traceId: string, finalData: Partial<MindflowCognitiveTrace>) {
  try {
    const docRef = doc(db, 'mindflow_cognitive_traces', traceId);
    await updateDoc(docRef, {
      ...finalData,
      updated_at: serverTimestamp(),
      status: 'completed'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'mindflow_cognitive_traces');
  }
}
