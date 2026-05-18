import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, orderBy, limit, writeBatch, Timestamp, deleteDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanFirestoreData } from './firebase';
import { safeText } from './safeText';
import { 
  MindflowLearning, 
  MindflowReasoning, 
  MindflowConflict,
  MindflowConflictGroup,
  MindflowConflictType,
  MindflowSeverity,
  MindflowPriority,
  MindflowSuggestedAction,
  MindflowConflictStatus
} from '../types';
import { callGeminiProxy } from './geminiProxy';

/**
 * MINDFLOW CONFLICT DETECTION ENGINE (V2)
 * Detects friction between consolidated learnings and reasonings.
 */
export async function detectMindflowConflicts(onProgress?: (progress: number) => void) {
  console.log("Starting Mindflow Cognitive Conflict Detection...");

  try {
    if (onProgress) onProgress(5);
    const baseSnap = await getDocs(query(
      collection(db, 'mindflow_learnings'), 
      where('learning_type', '==', 'Base'), 
      where('is_active', '==', true),
      limit(200)
    ));
    const baseLearnings = baseSnap.docs.map(d => {
      const raw = d.data();
      return { 
        id: d.id, 
        ...raw,
        learning: safeText(raw.learning),
        theme: safeText(raw.theme)
      } as MindflowLearning;
    });
    
    if (onProgress) onProgress(10);
    const acquiredSnap = await getDocs(query(collection(db, 'mindflow_learnings'), where('learning_type', '==', 'Adquirida'), where('is_active', '==', true), limit(500)));
    const acquiredLearnings = acquiredSnap.docs.map(d => {
      const raw = d.data();
      return { 
        id: d.id, 
        ...raw,
        learning: safeText(raw.learning),
        theme: safeText(raw.theme)
      } as MindflowLearning;
    });

    if (onProgress) onProgress(15);
    const reasoningSnap = await getDocs(query(collection(db, 'mindflow_reasonings'), where('is_active', '==', true), limit(200)));
    const reasonings = reasoningSnap.docs.map(d => {
      const raw = d.data();
      return { 
        id: d.id, 
        ...raw,
        reasoning: safeText(raw.reasoning),
        theme: safeText(raw.theme)
      } as MindflowReasoning;
    });

    if (onProgress) onProgress(20);
    const detectionPayload = { conflicts_detected: 0, groups_created: 0, critical_conflicts: 0 };

    // 1. Detect Learing vs Base (The Standard of Truth)
    const totalToAnalyze = acquiredLearnings.length;
    let analyzedCount = 0;

    // Process in batches of 5 to avoid sequential bottleneck but stay within limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < acquiredLearnings.length; i += BATCH_SIZE) {
      const batch = acquiredLearnings.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (acquired) => {
        const relevantBase = baseLearnings.filter(b => b.theme === acquired.theme || b.theme === 'Regras Globais');
        if (relevantBase.length > 0) {
          const conflict = await analyzeConflict(acquired, relevantBase, 'base_vs_acquired');
          if (conflict) {
            await saveConflict(conflict);
            detectionPayload.conflicts_detected++;
            if (conflict.severity === 'critical') detectionPayload.critical_conflicts++;
          }
        }
        analyzedCount++;
      }));
      
      if (onProgress) onProgress(20 + Math.floor((analyzedCount / totalToAnalyze) * 30));
    }

    // 2. Internal Consistency (Acquired vs Acquired)
    const themes = Array.from(new Set(acquiredLearnings.map(l => l.theme)));
    let themeCount = 0;
    
    for (let i = 0; i < themes.length; i += BATCH_SIZE) {
      const batchThemes = themes.slice(i, i + BATCH_SIZE);
      await Promise.all(batchThemes.map(async (theme) => {
        const themeLearnings = acquiredLearnings.filter(l => l.theme === theme);
        if (themeLearnings.length >= 2) {
          const themeConflicts = await analyzeInternalConsistency(themeLearnings);
          for (const c of themeConflicts) {
            await saveConflict(c);
            detectionPayload.conflicts_detected++;
          }
        }
        themeCount++;
      }));
      
      if (onProgress) onProgress(50 + Math.floor((themeCount / themes.length) * 30));
    }

    // 3. Auto Grouping
    if (onProgress) onProgress(85);
    const groupingResult = await groupMindflowConflicts();
    detectionPayload.groups_created = groupingResult.groups.length;

    if (onProgress) onProgress(100);
    return detectionPayload;
  } catch (error) {
    console.error("[MindflowConflicts] Isolation/Detection error:", error);
    throw error;
  }
}

async function analyzeConflict(item: MindflowLearning, references: MindflowLearning[], type: MindflowConflictType): Promise<Partial<MindflowConflict> | null> {
  const prompt = `
    ANALISE CONFLITO DE CONHECIMENTO (Mindflow V2).
    
    ITEM SENDO ANALISADO:
    Learning: "${item.learning}"
    Classification: ${item.classification}
    
    REFERÊNCIAS:
    ${references.map(r => `- [${r.id}] ${r.learning}`).join('\n')}
    
    Identifique se o ITEM CONTRADIZ a essência das REFERÊNCIAS. 
    Ignore atualizações progressivas; foque em contradições lógicas, de regra ou intenção.
    
    JSON: { "has_conflict": bool, "reason": "...", "title": "...", "summary": "...", "severity": "low|medium|high|critical", "conflicting_id": "id" }
  `;

  try {
    const text = await callGeminiProxy({
      prompt: prompt,
      useCase: "analysis",
      agentId: "tona_orchestrator",
      config: {
        responseMimeType: "application/json"
      }
    });

    const data = JSON.parse(text || '{}');
    if (!data.has_conflict) return null;

    return {
      conflict_type: type,
      title: safeText(data.title),
      summary: safeText(data.summary),
      conflict_reason: safeText(data.reason),
      impact_description: "Divergência entre diretriz base e aprendizado empírico.",
      severity: data.severity as any,
      status: 'open',
      priority: data.severity as any,
      involved_memory_ids: [item.id, data.conflicting_id].filter(Boolean),
      detected_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      metadata: { engine_version: '2.0' }
    };
  } catch (e) { return null; }
}

async function analyzeInternalConsistency(items: MindflowLearning[]): Promise<Partial<MindflowConflict>[]> {
  const prompt = `
    Identifique contradições entre estes APRENDIZADOS do mesmo tema.
    LEARNINGS:
    ${items.map(l => `- [${l.id}] ${l.learning}`).join('\n')}
    
    JSON: { "conflicts": [ { "ids": ["id1", "id2"], "reason": "...", "title": "...", "summary": "...", "severity": "..." } ] }
  `;

  try {
    const text = await callGeminiProxy({
      prompt: prompt,
      useCase: "analysis",
      agentId: "tona_orchestrator",
      config: {
        responseMimeType: "application/json"
      }
    });

    const data = JSON.parse(text || '{}');
    if (!data.conflicts || !Array.isArray(data.conflicts)) return [];

    return data.conflicts.map((c: any) => ({
      conflict_type: 'acquired_vs_acquired',
      title: safeText(c.title),
      summary: safeText(c.summary),
      conflict_reason: safeText(c.reason),
      severity: c.severity || 'medium',
      status: 'open',
      priority: c.severity || 'medium',
      involved_memory_ids: c.ids,
      detected_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      metadata: {}
    }));
  } catch (e) { return []; }
}

async function saveConflict(conflict: Partial<MindflowConflict>) {
  const q = query(
    collection(db, 'mindflow_conflicts'), 
    where('involved_memory_ids', 'array-contains', conflict.involved_memory_ids?.[0]),
    where('status', '==', 'open')
  );
  const snap = await getDocs(q);
  // Check if exactly these two are already in conflict
  if (snap.docs.some(doc => {
    const existingIds = doc.data().involved_memory_ids || [];
    return conflict.involved_memory_ids?.every(id => existingIds.includes(id));
  })) return;

  await addDoc(collection(db, 'mindflow_conflicts'), cleanFirestoreData(conflict));
}

export async function groupMindflowConflicts() {
  const conflictsSnap = await getDocs(query(collection(db, 'mindflow_conflicts'), where('status', '==', 'open')));
  const openConflicts = conflictsSnap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowConflict));

  if (openConflicts.length === 0) return { groups: [] };

  const prompt = `Agrupe estes conflitos por causa raiz: ${openConflicts.map(c => `- [${c.id}] ${c.title}`).join('\n')}
  JSON: { "groups": [ { "conflict_ids": [], "title": "", "summary": "", "reason": "", "severity": "" } ] }`;

  try {
    const text = await callGeminiProxy({
      prompt: prompt,
      useCase: "analysis",
      agentId: "tona_orchestrator",
      config: {
        responseMimeType: "application/json"
      }
    });

    const data = JSON.parse(text || '{}');
    const createdGroups = [];

    for (const g of (data.groups || [])) {
      const groupPayload: Omit<MindflowConflictGroup, 'id'> = {
        title: safeText(g.title),
        summary: safeText(g.summary),
        group_reason: safeText(g.reason),
        main_conflict_type: 'cognitive_friction',
        scope_type: 'global',
        severity: g.severity || 'medium',
        priority: g.severity || 'medium',
        status: 'open',
        conflict_count: g.conflict_ids.length,
        suggested_actions: [],
        created_at: serverTimestamp() as any,
        updated_at: serverTimestamp() as any,
        metadata: { conflict_ids: g.conflict_ids }
      };

      const groupRef = await addDoc(collection(db, 'mindflow_conflict_groups'), cleanFirestoreData(groupPayload));
      const batch = writeBatch(db);
      for (const cid of g.conflict_ids) {
        batch.update(doc(db, 'mindflow_conflicts', cid), { 
          conflict_group_id: groupRef.id,
          status: 'grouped',
          updated_at: serverTimestamp()
        });
      }
      await batch.commit();
      await summarizeConflictGroup(groupRef.id);
      createdGroups.push({ group_id: groupRef.id, ...g });
    }
    return { groups: createdGroups };
  } catch (e) { return { groups: [] }; }
}

export async function summarizeConflictGroup(groupId: string) {
  const groupDoc = await getDoc(doc(db, 'mindflow_conflict_groups', groupId));
  if (!groupDoc.exists()) return;
  
  const group = { id: groupDoc.id, ...groupDoc.data() } as MindflowConflictGroup;
  const conflictsSnap = await getDocs(query(collection(db, 'mindflow_conflicts'), where('conflict_group_id', '==', groupId)));
  const conflicts = conflictsSnap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowConflict));
  
  const learningIds = Array.from(new Set(conflicts.flatMap(c => c.involved_memory_ids || [])));
  const learnings: MindflowLearning[] = [];
  for (const lid of learningIds) {
    const lSnap = await getDoc(doc(db, 'mindflow_learnings', lid));
    if (lSnap.exists()) learnings.push({ id: lSnap.id, ...lSnap.data() } as MindflowLearning);
  }

  const prompt = `Resuma este grupo de conflitos e sugira ações.
  LEARNINGS: ${learnings.map(l => `- [${l.id}] ${l.learning}`).join('\n')}
  JSON: { "executive_summary": "", "detailed_reason": "", "impact": "", "recommended_resolution": "", "actions": [ { "action_id": "", "label": "", "description": "", "recommended": bool, "risk_level": "" } ] }`;

  try {
    const text = await callGeminiProxy({
      prompt: prompt,
      useCase: "analysis",
      agentId: "tona_orchestrator",
      config: {
        responseMimeType: "application/json"
      }
    });

    const data = JSON.parse(text || '{}');
    await updateDoc(doc(db, 'mindflow_conflict_groups', groupId), {
      summary: safeText(data.executive_summary),
      group_reason: safeText(data.detailed_reason),
      recommended_resolution: safeText(data.recommended_resolution),
      suggested_actions: (data.actions || []).map((a: any) => ({
        ...a,
        label: safeText(a.label),
        description: safeText(a.description)
      })),
      updated_at: serverTimestamp()
    });
  } catch (e) { console.error(e); }
}

export async function resolveMindflowConflictGroup(params: {
  conflictGroupId: string;
  actionId: string;
  resolutionNotes: string;
  userId: string;
}) {
  const { conflictGroupId, actionId, resolutionNotes, userId } = params;
  const groupDoc = await getDoc(doc(db, 'mindflow_conflict_groups', conflictGroupId));
  if (!groupDoc.exists()) throw new Error("Grupo não encontrado");
  
  const conflictsSnap = await getDocs(query(collection(db, 'mindflow_conflicts'), where('conflict_group_id', '==', conflictGroupId)));
  const conflicts = conflictsSnap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowConflict));
  const involvedLearningIds = Array.from(new Set(conflicts.flatMap(c => c.involved_memory_ids || [])));
  
  const batch = writeBatch(db);
  const beforeState = { group: groupDoc.data(), conflicts };
  
  // Execution Logic (Simplified for turn)
  if (actionId === 'prioritize_base') {
    for (const lid of involvedLearningIds) {
      const lSnap = await getDoc(doc(db, 'mindflow_learnings', lid));
      if (lSnap.exists() && lSnap.data().learning_type === 'Adquirida') {
        batch.update(doc(db, 'mindflow_learnings', lid), { is_active: false, status: 'archived', updated_at: serverTimestamp() });
      }
    }
  }

  batch.update(doc(db, 'mindflow_conflict_groups', conflictGroupId), {
    status: 'resolved',
    resolved_at: serverTimestamp(),
    resolved_by: userId,
    updated_at: serverTimestamp()
  });

  for (const c of conflicts) {
    batch.update(doc(db, 'mindflow_conflicts', c.id), {
      status: 'resolved',
      resolved_at: serverTimestamp(),
      resolved_by: userId,
      resolution_action: actionId,
      resolution_decision: resolutionNotes
    });
  }

  const logRef = doc(collection(db, 'mindflow_conflict_resolution_logs'));
  batch.set(logRef, {
    conflict_group_id: conflictGroupId,
    action_id: actionId,
    resolution_notes: resolutionNotes,
    before_state: beforeState,
    resolved_by: userId,
    created_at: serverTimestamp()
  });

  await batch.commit();
  return { success: true };
}
