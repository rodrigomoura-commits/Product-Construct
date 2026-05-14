import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, onSnapshot, orderBy, limit, getDoc, writeBatch } from 'firebase/firestore';
import { db, cleanFirestoreData } from './firebase';
import { 
  MindflowLearning, 
  MindflowLearningCandidate, 
  MindflowRetrievalLog, 
  MindflowLearningRelationship, 
  MindflowKnowledgeType, 
  MindflowClassification, 
  MindflowScope,
  Product,
  MindflowReasoning,
  MindflowUserMemory,
  MindflowMemoryLearningLink,
  MindflowLearningReasoningLink
} from '../types';

import { getUserMemoriesCollection } from './mindflowCollections';
import { callGeminiProxy } from './geminiProxy';

/**
 * MINDFLOW COGNITIVE ARCHITECTURE (V2)
 * Separated layers: Memories (User) -> Learnings (Consolidated) -> Reasonings (Insights)
 */

export interface ContextPack {
  base_learnings: MindflowLearning[];
  acquired_learnings: MindflowLearning[];
  user_preferences: MindflowLearning[];
  product_learnings: MindflowLearning[];
  stage_learnings: MindflowLearning[];
  decisions: MindflowLearning[];
  artifacts: MindflowLearning[];
  risks: MindflowLearning[];
  hypotheses: MindflowLearning[];
  evidence: MindflowLearning[];
  reasonings: MindflowReasoning[];
  priority_reasonings: MindflowReasoning[];
  hybrid_reasonings: MindflowReasoning[];
  acquired_reasonings: MindflowReasoning[];
  metacognitive_reasonings: MindflowReasoning[];
  relevant_themes: string[];
  open_gaps: string[];
  warnings: string[];
  reasoning_warnings: string[];
}

/**
 * RETRIEVE MINDFLOW CONTEXT
 * Orchestrates retrieval across current architecture layers.
 */
export async function retrieveMindflowContext(params: {
  userId: string;
  productId?: string;
  stageId?: string;
  agentId?: string;
  userMessage: string;
  intent?: string;
  maxResults?: number;
}): Promise<ContextPack> {
  const { 
    userId, 
    productId, 
    stageId, 
    agentId, 
    userMessage, 
    maxResults = 40 
  } = params;

  let learnings: MindflowLearning[] = [];
  let reasonings: MindflowReasoning[] = [];
  let userMemories: MindflowUserMemory[] = [];
  const warnings: string[] = [];
  const reasoning_warnings: string[] = [];

  try {
    // 1. ASYNC RETRIEVAL FROM ALL LAYERS
    const queries = [];

    // Layer 2: Learnings (Consolidated Knowledge)
    queries.push(getDocs(query(
      collection(db, 'mindflow_learnings'), 
      where('knowledge_type', '==', 'Base'),
      where('is_active', '==', true),
      limit(20)
    )));

    if (productId) {
      queries.push(getDocs(query(
        collection(db, 'mindflow_learnings'),
        where('product_id', '==', productId),
        where('is_active', '==', true),
        limit(20)
      )));
    }

    queries.push(getDocs(query(
      collection(db, 'mindflow_learnings'),
      where('user_id', '==', userId),
      where('is_active', '==', true),
      limit(15)
    )));

    // Layer 3: Reasonings (Deep Conclusions)
    queries.push(getDocs(query(
      collection(db, 'mindflow_reasonings'),
      where('status', '==', 'active'),
      where('is_active', '==', true),
      limit(15)
    )));

    // Layer 1: Recent User Memories (Historical interactions)
    queries.push(getDocs(query(
      getUserMemoriesCollection(db),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc'),
      limit(5)
    )));

    const snaps = await Promise.all(queries);
    
    // Process results
    const learningSnaps = snaps.slice(0, productId ? 3 : 2);
    learningSnaps.forEach(snap => {
      learnings.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowLearning)));
    });

    const reasoningSnap = snaps[snaps.length - 2];
    reasonings = reasoningSnap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowReasoning));

    const historySnap = snaps[snaps.length - 1];
    userMemories = historySnap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowUserMemory));

    // Deduplicate learnings
    const seenL = new Set<string>();
    learnings = learnings.filter(l => {
      if (seenL.has(l.id)) return false;
      seenL.add(l.id);
      return true;
    });

    // 2. CONFLICT CHECK
    const conflictsSnap = await getDocs(query(
      collection(db, 'mindflow_conflicts'),
      where('status', 'in', ['open', 'grouped']),
      limit(50)
    ));
    
    const activeConflicts = conflictsSnap.docs.map(d => d.data());
    const criticalInvolvedIds = new Set<string>();
    
    activeConflicts.forEach(c => {
      if (c.severity === 'critical') {
        (c.involved_memory_ids || []).forEach((id: string) => criticalInvolvedIds.add(id));
      }
    });

    // Filter out critical conflict items from context to avoid AI confusion/hallucination
    learnings = learnings.filter(l => !criticalInvolvedIds.has(l.id));
    reasonings = reasonings.filter(r => !criticalInvolvedIds.has(r.id));

    if (criticalInvolvedIds.size > 0) {
      warnings.push(`Supressão cognitiva ativada para ${criticalInvolvedIds.size} itens sob conflito crítico.`);
    }

    // 3. LOG RETRIEVAL
    await addDoc(collection(db, 'mindflow_retrieval_logs'), cleanFirestoreData({
      user_id: userId,
      product_id: productId || null,
      stage_id: stageId || null,
      agent_id: agentId || null,
      query_text: userMessage,
      retrieval_strategy: 'cognitive_triality_v2',
      learnings_retrieved: learnings.map(l => l.id),
      learnings_used: learnings.slice(0, 10).map(l => l.id),
      reasonings_retrieved: reasonings.map(r => r.id),
      reasonings_used: reasonings.slice(0, 5).map(r => r.id),
      created_at: serverTimestamp(),
      metadata: { 
        history_depth: userMemories.length,
        conflict_shield_active: criticalInvolvedIds.size > 0
      }
    } as any));

  } catch (e) {
    console.error("Mindflow Context Retrieval failed:", e);
    warnings.push(`Erro na recuperação: ${e instanceof Error ? e.message : 'Desconhecido'}`);
  }

  return {
    base_learnings: learnings.filter(l => l.learning_type === 'Base'),
    acquired_learnings: learnings.filter(l => l.learning_type === 'Adquirida'),
    user_preferences: learnings.filter(l => l.classification === 'preferência' || l.scope_type === 'user'),
    product_learnings: learnings.filter(l => l.product_id === productId),
    stage_learnings: learnings.filter(l => l.stage_id === stageId),
    decisions: learnings.filter(l => l.classification === 'decisão'),
    artifacts: learnings.filter(l => l.classification === 'artefato'),
    risks: learnings.filter(l => l.classification === 'risco'),
    hypotheses: learnings.filter(l => l.classification === 'hipótese'),
    evidence: learnings.filter(l => l.classification === 'evidência'),
    reasonings,
    priority_reasonings: reasonings.filter(r => r.priority === 'critical' || r.priority === 'high'),
    hybrid_reasonings: reasonings.filter(r => r.reasoning_type === 'strategic' || r.reasoning_type === 'hybrid_reasoning'),
    acquired_reasonings: reasonings.filter(r => r.reasoning_type === 'behavioral' || r.reasoning_type === 'acquired_reasoning'),
    metacognitive_reasonings: reasonings.filter(r => r.reasoning_type === 'systemic' || r.reasoning_type === 'metacognitive_reasoning'),
    relevant_themes: Array.from(new Set(learnings.map(l => l.theme))),
    open_gaps: [],
    warnings,
    reasoning_warnings
  };
}

export async function retrieveMindflowLearnings(params: any) {
  const res = await retrieveMindflowContext(params);
  return {
    base_learnings: res.base_learnings,
    acquired_learnings: res.acquired_learnings,
    learning_warnings: res.warnings
  };
}

export async function retrieveMindflowReasonings(params: any) {
  const res = await retrieveMindflowContext(params);
  return {
    base_reasonings: res.priority_reasonings,
    hybrid_reasonings: res.hybrid_reasonings,
    reasoning_warnings: res.reasoning_warnings
  };
}

/**
 * EXTRACT MINDFLOW LEARNING CANDIDATE
 * Phase 1: Conversation -> Potential Learnings
 */
export async function extractMindflowLearning(params: {
  userId: string;
  productId?: string;
  stageId?: string;
  agentId?: string;
  conversationId?: string;
  userMessage: string;
  assistantResponse: string;
}) {
  const { userId, productId, stageId, agentId, conversationId, userMessage, assistantResponse } = params;

  const prompt = `
    Analise a interação entre o usuário e a Tona (IA).
    Extraia CONCLUSÕES e APRENDIZADOS que devem ser consolidados.
    
    Mensagem do Usuário: "${userMessage}"
    Resposta da Tona: "${assistantResponse}"
    
    Retorne JSON:
    {
      "candidates": [
        {
          "learning": "resumo claro do que foi aprendido",
          "theme": "Tema geral",
          "sub_theme": "Subtema",
          "classification": "fato|hipótese|evidência|decisão|risco|preferência|regra",
          "confidence": 0.0-1.0,
          "reason": "por que isso é importante"
        }
      ]
    }
  `;

  try {
    const responseText = await callGeminiProxy({
      model: "gemini-1.5-flash",
      prompt: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const data = JSON.parse(responseText || '{"candidates": []}');

    if (data.candidates && Array.isArray(data.candidates)) {
      for (const cand of data.candidates) {
        const candidateData: Omit<MindflowLearningCandidate, 'id'> = {
          user_id: userId,
          product_id: productId || null,
          stage_id: stageId || null,
          agent_id: agentId || null,
          conversation_id: conversationId || null,
          source_type: 'conversation',
          raw_input: userMessage,
          tona_response: assistantResponse,
          extracted_learning: cand.learning,
          suggested_theme: cand.theme,
          suggested_sub_theme: cand.sub_theme,
          suggested_classification: cand.classification,
          confidence_score: cand.confidence,
          should_save: cand.confidence > 0.8,
          review_status: cand.confidence > 0.95 ? 'auto_saved' : 'pending',
          created_at: serverTimestamp(),
          metadata: { reason: cand.reason }
        };

        const docRef = await addDoc(collection(db, 'mindflow_learning_candidates'), cleanFirestoreData(candidateData));

        // Auto-promotion if extremely high confidence
        if (cand.confidence > 0.95) {
          await saveMindflowLearning({
            learningType: 'Adquirida',
            theme: cand.theme,
            subTheme: cand.sub_theme,
            learning: cand.learning,
            classification: cand.classification,
            sourceType: 'conversation',
            scopeType: productId ? 'product' : 'user',
            userId,
            productId,
            stageId,
            agentId,
            confidenceScore: cand.confidence,
            needsReview: false,
            metadata: { candidate_id: docRef.id }
          });
        }
      }
    }
  } catch (e) {
    console.error("Learning extraction failed:", e);
  }
}

/**
 * SAVE MINDFLOW LEARNING
 * Phase 2: Candidate -> Consolidated Learning
 */
export async function saveMindflowLearning(params: {
  learningType: MindflowKnowledgeType;
  theme: string;
  subTheme?: string;
  learning: string;
  classification: MindflowClassification;
  sourceType: string;
  sourceId?: string;
  scopeType: MindflowScope;
  userId: string;
  productId?: string;
  stageId?: string;
  agentId?: string;
  confidenceScore?: number;
  qualityScore?: number;
  needsReview?: boolean;
  metadata?: any;
}) {
  const { 
    learningType, theme, subTheme, learning, classification, 
    sourceType, scopeType, userId, productId, stageId, agentId, 
    confidenceScore = 0.7, qualityScore = 0.7, needsReview = true 
  } = params;

  // Duplicate check
  const existingQ = query(
    collection(db, 'mindflow_learnings'), 
    where('learning', '==', learning),
    where('product_id', '==', productId || null),
    limit(1)
  );
  const existingSnap = await getDocs(existingQ);
  if (!existingSnap.empty) {
    const existingDoc = existingSnap.docs[0];
    await updateDoc(doc(db, 'mindflow_learnings', existingDoc.id), {
      usage_count: (existingDoc.data().usage_count || 0) + 1,
      last_used_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    return existingDoc.id;
  }

  const learningData: Omit<MindflowLearning, 'id'> = {
    learning_date: new Date().toISOString().split('T')[0],
    learning_type: learningType,
    theme,
    sub_theme: subTheme || 'Geral',
    learning,
    classification,
    source_type: sourceType,
    scope_type: scopeType,
    user_id: userId,
    product_id: productId || null,
    stage_id: stageId || null,
    agent_id: agentId || null,
    confidence_score: confidenceScore,
    relevance_score: 0.8,
    quality_score: qualityScore,
    usage_count: 0,
    is_verified: learningType === 'Base',
    needs_review: needsReview,
    is_active: true,
    created_by: userId,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    metadata: params.metadata || {}
  };

  const docRef = await addDoc(collection(db, 'mindflow_learnings'), cleanFirestoreData(learningData));
  return docRef.id;
}

/**
 * IMPORT MINDFLOW CSV (Legacy support mapped to new Learning layer)
 */
export async function importMindflowCSV(userId: string, rows: any[]) {
  const batch = writeBatch(db);
  const results = { total: rows.length, imported: 0, errors: 0, base: 0, acquired: 0 };

  for (const row of rows) {
    try {
      const { Data, 'Tipo de Conhecimento': type, Tema, 'Sub_Tema': sub, Conhecimento } = row;
      if (!Conhecimento) { results.errors++; continue; }

      const learningData: Omit<MindflowLearning, 'id'> = {
        learning_date: Data || new Date().toISOString().split('T')[0],
        learning_type: (type === 'Base' || type === 'Adquirida') ? type : 'Adquirida',
        theme: Tema || 'Importado',
        sub_theme: sub || 'Geral',
        learning: Conhecimento,
        classification: type === 'Base' ? 'instrução' : 'contexto',
        scope_type: 'global',
        confidence_score: type === 'Base' ? 1.0 : 0.8,
        relevance_score: 0.8,
        quality_score: 0.8,
        usage_count: 0,
        is_verified: type === 'Base',
        needs_review: type !== 'Base',
        is_active: true,
        created_by: userId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        metadata: { source: 'csv_import' }
      };

      const newDocRef = doc(collection(db, 'mindflow_learnings'));
      batch.set(newDocRef, learningData);
      results.imported++;
      if (learningData.learning_type === 'Base') results.base++;
      else results.acquired++;
    } catch (e) {
      console.error("Error importing row:", e);
      results.errors++;
    }
  }

  await batch.commit();
  return results;
}

/**
 * PROMOTE TO BASE LEARNING
 */
export async function promoteToBaseLearning(adminId: string, learningId: string, updates?: Partial<MindflowLearning>) {
  const learningRef = doc(db, 'mindflow_learnings', learningId);
  const snap = await getDoc(learningRef);
  if (!snap.exists()) throw new Error("Aprendizado não encontrado.");
  
  const original = snap.data() as MindflowLearning;
  
  const baseData: Omit<MindflowLearning, 'id'> = {
    ...original,
    ...updates,
    learning_type: 'Base',
    is_verified: true,
    needs_review: false,
    promoted_from_learning_id: learningId,
    updated_at: serverTimestamp()
  };

  const newRef = await addDoc(collection(db, 'mindflow_learnings'), cleanFirestoreData(baseData));
  
  await updateDoc(learningRef, {
    is_promoted_to_base: true,
    updated_at: serverTimestamp()
  });

  await addDoc(collection(db, 'mindflow_learning_relationships'), cleanFirestoreData({
    source_learning_id: newRef.id,
    target_learning_id: learningId,
    relationship_type: 'promoted_from',
    strength: 1.0,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    metadata: { promoted_by: adminId }
  } as Omit<MindflowLearningRelationship, 'id'>));

  return newRef.id;
}
