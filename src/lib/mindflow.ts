import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, onSnapshot, orderBy, limit, getDoc, writeBatch } from 'firebase/firestore';
import { db, cleanFirestoreData, safeWrite } from './firebase';
import { safeText } from './safeText';
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

import { getUserMemoriesCollection, getProductMemoriesCollection, getProductSynthesisCollection, getProductInteractionsCollection } from './mindflowCollections';
import { callGeminiProxy } from './geminiProxy';
import { touchStage } from './progressEngine';

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
  product_memories: any[];
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
 * ASYNC SAFE GET DOCS
 * Wraps getDocs with try/catch to prevent partial failures from crashing the context retrieval.
 */
async function safeGetDocs(label: string, q: any, warnings: string[]) {
  try {
    return await getDocs(q);
  } catch (error: any) {
    const code = error?.code || 'unknown';
    const message = error?.message || String(error);
    console.warn(`[MindFlow] ${label} retrieval failed:`, { code, message });
    warnings.push(`${label}: ${code}`);
    
    // Return a mock result compatible with Firestore DocumentSnapshot
    return {
      docs: [],
      empty: true,
      size: 0,
      forEach: () => {},
      map: () => []
    } as any;
  }
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
  let productMemories: any[] = [];

  try {
    // 1. SAFE RETRIEVAL FROM ALL LAYERS
    
    // Layer 2: Learnings (Consolidated Knowledge)
    const baseLearningsSnap = await safeGetDocs(
      "base_learnings",
      query(
        collection(db, 'mindflow_learnings'), 
        where('knowledge_type', '==', 'Base'),
        where('is_active', '==', true),
        limit(20)
      ),
      warnings
    );
    learnings.push(...baseLearningsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as MindflowLearning)));

    if (productId) {
      const productLearningsSnap = await safeGetDocs(
        "product_learnings",
        query(
          collection(db, 'mindflow_learnings'),
          where('product_id', '==', productId),
          where('is_active', '==', true),
          limit(20)
        ),
        warnings
      );
      learnings.push(...productLearningsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as MindflowLearning)));
    }

    const userLearningsSnap = await safeGetDocs(
      "user_learnings",
      query(
        collection(db, 'mindflow_learnings'),
        where('user_id', '==', userId),
        where('is_active', '==', true),
        limit(15)
      ),
      warnings
    );
    learnings.push(...userLearningsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as MindflowLearning)));

    // Layer 3: Reasonings (Deep Conclusions)
    const reasoningsSnap = await safeGetDocs(
      "reasonings",
      query(
        collection(db, 'mindflow_reasonings'),
        where('status', '==', 'active'),
        where('is_active', '==', true),
        limit(15)
      ),
      reasoning_warnings
    );
    reasonings = reasoningsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as MindflowReasoning));

    // Layer 1: Recent User Memories & Product Memories
    const userMemoriesSnap = await safeGetDocs(
      "user_memories",
      query(
        getUserMemoriesCollection(db, userId),
        orderBy('created_at', 'desc'),
        limit(5)
      ),
      warnings
    );
    userMemories = userMemoriesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as MindflowUserMemory));

    if (productId) {
      const productMemoriesSnap = await safeGetDocs(
        "product_memories",
        query(
          getProductMemoriesCollection(db, productId),
          orderBy('created_at', 'desc'),
          limit(5)
        ),
        warnings
      );
      productMemories = productMemoriesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    }

    // Post-process learnings for safety
    learnings = learnings.map(l => ({
      ...l,
      learning: safeText(l.learning),
      theme: safeText(l.theme),
      sub_theme: safeText(l.sub_theme),
      classification: safeText(l.classification) as any
    }));

    // Deduplicate learnings
    const seenL = new Set<string>();
    learnings = learnings.filter(l => {
      if (seenL.has(l.id)) return false;
      seenL.add(l.id);
      return true;
    });

    // 2. CONFLICT CHECK
    const conflictsSnap = await safeGetDocs(
      "mindflow_conflicts",
      query(
        collection(db, 'mindflow_conflicts'),
        where('status', 'in', ['open', 'grouped']),
        limit(50)
      ),
      warnings
    );
    
    const activeConflicts = conflictsSnap.docs.map((d: any) => d.data());
    const criticalInvolvedIds = new Set<string>();
    
    activeConflicts.forEach((c: any) => {
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
    await safeWrite(async () => {
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
          conflict_shield_active: criticalInvolvedIds.size > 0,
          partial_failure: warnings.length > 0
        }
      } as any));
    }, 'mindflow_retrieval_log');

  } catch (e) {
    console.error("Mindflow Context Retrieval failed (unexpected):", e);
    warnings.push(`Erro inesperado na recuperação: ${e instanceof Error ? e.message : 'Desconhecido'}`);
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
    product_memories: productMemories,
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
      prompt: prompt,
      useCase: "summarization",
      agentId: "tona_orchestrator",
      productId,
      stageId,
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
          raw_input: safeText(userMessage),
          tona_response: safeText(assistantResponse),
          extracted_learning: safeText(cand.learning),
          suggested_theme: safeText(cand.theme),
          suggested_sub_theme: safeText(cand.sub_theme),
          suggested_classification: safeText(cand.classification) as any,
          confidence_score: cand.confidence,
          should_save: cand.confidence > 0.8,
          review_status: cand.confidence > 0.95 ? 'auto_saved' : 'pending',
          created_at: serverTimestamp(),
          metadata: { reason: safeText(cand.reason) }
        };
        
        await safeWrite(async () => {
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
        }, 'mindflow_learning_candidate');
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
    theme: safeText(theme),
    sub_theme: safeText(subTheme || 'Geral'),
    learning: safeText(learning),
    classification: safeText(classification) as any,
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

  if (productId && stageId) {
    await touchStage(productId, stageId, 'memory');
  }

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
        theme: safeText(Tema || 'Importado'),
        sub_theme: safeText(sub || 'Geral'),
        learning: safeText(Conhecimento),
        classification: (type === 'Base' ? 'instrução' : 'contexto') as any,
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
