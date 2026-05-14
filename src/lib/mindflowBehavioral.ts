import { collection, doc, getDoc, setDoc, addDoc, query, where, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanFirestoreData } from './firebase';
import { MindflowBehavioralProfile, MindflowBehavioralSignal } from '../types';

/**
 * Gets or creates a behavioral profile for a user.
 */
export async function getBehavioralProfile(userId: string): Promise<MindflowBehavioralProfile> {
  const docRef = doc(db, 'mindflow_behavioral_profiles', userId);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as MindflowBehavioralProfile;
  }

  const newProfile: Omit<MindflowBehavioralProfile, 'id'> = {
    user_id: userId,
    preferred_depth: 'balanced',
    communication_style: {},
    format_preferences: {},
    depth_preferences_by_context: {},
    tone_preferences_by_context: {},
    correction_patterns: [],
    approval_patterns: [],
    rejection_patterns: [],
    recurring_contexts: [],
    recurring_outputs: [],
    interaction_cadence: {},
    confidence_score: 0.7,
    is_active: true,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    metadata: {}
  };

  await setDoc(docRef, cleanFirestoreData(newProfile));
  return { id: userId, ...newProfile } as MindflowBehavioralProfile;
}

/**
 * Records a new behavioral signal.
 */
export async function recordBehavioralSignal(signal: Omit<MindflowBehavioralSignal, 'id' | 'created_at'>) {
  try {
    const docRef = await addDoc(collection(db, 'mindflow_behavioral_signals'), cleanFirestoreData({
      ...signal,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    }));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'mindflow_behavioral_signals');
  }
}

/**
 * Updates a behavioral profile based on new signals.
 */
export async function updateProfileFromSignals(userId: string, signals: Partial<MindflowBehavioralSignal>[]) {
  const profile = await getBehavioralProfile(userId);
  const updates: any = {
    updated_at: serverTimestamp()
  };

  for (const signal of signals) {
    if (!signal.signal_type || !signal.signal_value) continue;

    const strength = signal.signal_strength || 0.7;

    switch (signal.signal_type) {
      case 'depth_preference':
        if (['short', 'balanced', 'detailed', 'exhaustive'].includes(signal.signal_value)) {
          updates.preferred_depth = signal.signal_value;
        }
        break;
      case 'format_preference':
        updates.preferred_format = signal.signal_value;
        break;
      case 'correction_pattern':
        if (!profile.correction_patterns.includes(signal.signal_value)) {
          updates.correction_patterns = [...profile.correction_patterns, signal.signal_value];
        }
        break;
      case 'approval_pattern':
        if (!profile.approval_patterns.includes(signal.signal_value)) {
          updates.approval_patterns = [...profile.approval_patterns, signal.signal_value];
        }
        break;
      // Add more cases as needed
    }
  }

  if (Object.keys(updates).length > 1) {
    await updateDoc(doc(db, 'mindflow_behavioral_profiles', userId), updates);
  }
}
