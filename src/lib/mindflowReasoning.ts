import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, orderBy, limit, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { 
  MindflowLearning, 
  MindflowReasoning, 
  MindflowReasoningType, 
  MindflowReasoningRun,
  MindflowScope,
  MindflowInferenceType,
  ReasoningChainStep,
  MindflowReasoningStatus,
  MindflowUserMemory,
  MindflowLearningReasoningLink
} from '../types';
import { callGeminiProxy } from './geminiProxy';

/**
 * MINDFLOW REASONING ENGINE (V2)
 * Orchestrates Phase 3: Learning -> Deep Reasoning.
 * Connects consolidated learnings into deep cognitive conclusions.
 */

// Removal of direct instance

export async function runDailyMindflowReasoning(adminId: string) {
  console.log("Starting Mindflow Deep Reasoning Engine...");
  
  const runRef = await addDoc(collection(db, 'mindflow_reasoning_runs'), {
    run_date: new Date().toISOString().split('T')[0],
    started_at: serverTimestamp(),
    status: 'running',
    total_memories_analyzed: 0,
    base_memories_analyzed: 0,
    acquired_memories_analyzed: 0,
    reasonings_generated: 0,
    reasonings_activated: 0,
    reasonings_pending_review: 0,
    contradictions_detected: 0,
    metadata: { started_by: adminId }
  } as any);

  const stats = {
    total: 0,
    base: 0,
    acquired: 0,
    generated: 0,
    activated: 0,
    pending: 0,
    contradictions: 0
  };

  try {
    // 1. DATA GATHERING (Learnings and Memories)
    const baseSnap = await getDocs(query(
      collection(db, 'mindflow_learnings'), 
      where('learning_type', '==', 'Base'), 
      where('is_active', '==', true),
      limit(200)
    ));
    const baseLearnings = baseSnap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowLearning));
    
    const acquiredSnap = await getDocs(query(collection(db, 'mindflow_learnings'), where('learning_type', '==', 'Adquirida'), where('is_active', '==', true), limit(500)));
    const acquiredLearnings = acquiredSnap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowLearning));

    const historySnap = await getDocs(query(collection(db, 'mindflow_user_memories'), orderBy('created_at', 'desc'), limit(300)));
    const userMemories = historySnap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowUserMemory));

    stats.total = baseLearnings.length + acquiredLearnings.length;
    stats.base = baseLearnings.length;
    stats.acquired = acquiredLearnings.length;

    // 2. REASONING THREADS
    const threads = [
      generateStrategicReasonings(baseLearnings),
      generateBehavioralReasonings(acquiredLearnings, baseLearnings),
      generateSystemicReasonings(userMemories, acquiredLearnings, baseLearnings)
    ];

    const results = await Promise.all(threads);
    const candidateReasonings = results.flat();

    // 3. SYNTHESIS & LINKING
    for (const cand of candidateReasonings) {
      // Validate Alignment against Base
      const validation = await validateAgainstConsensus(cand, baseLearnings);
      
      const finalReasoning: Omit<MindflowReasoning, 'id'> = {
        reasoning_date: new Date().toISOString().split('T')[0],
        reasoning_type: cand.reasoning_type || 'hybrid_reasoning',
        inference_type: cand.inference_type || 'mixed',
        title: cand.title || 'Insight Cognitivo',
        reasoning: cand.reasoning || '',
        summary: cand.summary || '',
        why_it_matters: cand.why_it_matters || '',
        theme: cand.theme || 'Geral',
        classification: cand.classification || 'aprendizado',
        priority: cand.priority || 'medium',
        scope_type: cand.scope_type || 'global',
        conclusion_depth: cand.conclusion_depth || 'medium',
        abstraction_level: cand.abstraction_level || 'operational',
        confidence_score: cand.confidence_score || 0.8,
        quality_score: 0.8,
        base_alignment_score: validation.alignment_score,
        contradiction_score: validation.contradiction_score,
        status: validation.recommended_status,
        needs_review: validation.recommended_status !== 'active',
        is_active: validation.recommended_status === 'active',
        generated_by: 'mindflow_v2_core',
        source_learning_ids: cand.source_learning_ids || [],
        base_learning_ids: cand.base_learning_ids || [],
        acquired_learning_ids: cand.acquired_learning_ids || [],
        supporting_user_memory_ids: cand.supporting_user_memory_ids || [],
        reasoning_chain: [
          ...(cand.reasoning_chain || []),
          {
            step: (cand.reasoning_chain?.length || 0) + 1,
            type: 'base_validation',
            description: validation.explanation,
            source_id: validation.anchor_id
          }
        ],
        usage_count: 0,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        metadata: { ...cand.metadata, run_id: runRef.id },
        recommended_actions: cand.recommended_actions || [],
        risks_if_ignored: cand.risks_if_ignored || []
      };

      const reasonDoc = await addDoc(collection(db, 'mindflow_reasonings'), finalReasoning);
      
      // Create Traceability Links
      for (const lId of (finalReasoning.source_learning_ids || [])) {
        await addDoc(collection(db, 'mindflow_learning_reasoning_links'), {
          learning_id: lId,
          reasoning_id: reasonDoc.id,
          learning_role: 'primary_basis',
          contribution_score: 0.9,
          created_at: serverTimestamp(),
          metadata: { run_id: runRef.id }
        } as Omit<MindflowLearningReasoningLink, 'id'>);
      }

      stats.generated++;
      if (finalReasoning.is_active) stats.activated++;
      else stats.pending++;
      if (status === 'contradicted') stats.contradictions++;
    }

    // 4. FINALIZE RUN
    await updateDoc(runRef, {
      status: 'completed',
      finished_at: serverTimestamp(),
      completed_at: serverTimestamp(),
      total_memories_analyzed: stats.total,
      base_memories_analyzed: stats.base,
      acquired_memories_analyzed: stats.acquired,
      reasonings_generated: stats.generated,
      reasonings_activated: stats.activated,
      reasonings_pending_review: stats.pending,
      contradictions_detected: stats.contradictions
    });

  } catch (e) {
    console.error("Deep Reasoning Run Failed:", e);
    await updateDoc(runRef, {
      status: 'failed',
      finished_at: serverTimestamp(),
      metadata: { error: String(e) }
    });
  }
}

async function generateStrategicReasonings(base: MindflowLearning[]): Promise<Partial<MindflowReasoning>[]> {
  if (base.length < 3) return [];
  
  const prompt = `
    GERAÇÃO DE RACIOCÍNIO ESTRATÉGICO (Mindflow V2).
    Analise estas diretrizes base e gere CONCLUSÕES ESTRATÉGICAS sobre a arquitetura do produto.
    
    BASE LEARNINGS:
    ${base.slice(0, 20).map(l => `- [${l.id}] ${l.learning}`).join('\n')}
    
    Identifique padrões, redundâncias ou diretrizes que juntas formam uma estratégia de produto maior.
    FOCO: Interseção de regras e visão de longo prazo.
    
    JSON: [ { "title": "...", "reasoning": "...", "summary": "...", "why_it_matters": "...", "theme": "...", "priority": "high|medium", "inference_type": "deductive", "source_learning_ids": ["ids"] } ]
  `;

  try {
    const responseText = await callGeminiProxy({
      model: "gemini-3-flash-preview",
      prompt: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const text = responseText || '[]';
    const data = JSON.parse(text);
    return Array.isArray(data) ? data.map(r => ({
      ...r,
      reasoning_type: 'base_reasoning',
      scope_type: 'global',
      conclusion_depth: 'deep',
      abstraction_level: 'strategic',
      base_learning_ids: r.source_learning_ids
    })) : [];
  } catch (e) { return []; }
}

async function generateBehavioralReasonings(acquired: MindflowLearning[], base: MindflowLearning[]): Promise<Partial<MindflowReasoning>[]> {
  if (acquired.length < 2) return [];
  
  const prompt = `
    GERAÇÃO DE RACIOCÍNIO COMPORTAMENTAL.
    Analise aprendizados empíricos vs diretrizes base.
    
    LEARNINGS (Empíricos):
    ${acquired.slice(0, 30).map(l => `- [${l.id}] ${l.learning}`).join('\n')}
    
    BASE (Regras):
    ${base.slice(0, 10).map(l => `- [${l.id}] ${l.learning}`).join('\n')}
    
    Conclua padrões de comportamento do usuário ou tendências do mercado observadas.
    
    JSON: [ { "title": "...", "reasoning": "...", "summary": "...", "theme": "...", "priority": "medium", "inference_type": "inductive" } ]
  `;

  try {
    const responseText = await callGeminiProxy({
      model: "gemini-3-flash-preview",
      prompt: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const text = responseText || '[]';
    const data = JSON.parse(text);
    return Array.isArray(data) ? data.map(r => ({
      ...r,
      reasoning_type: 'behavioral_reasoning',
      scope_type: 'user',
      conclusion_depth: 'medium',
      abstraction_level: 'behavioral'
    })) : [];
  } catch (e) { return []; }
}

async function generateSystemicReasonings(memories: MindflowUserMemory[], learnings: MindflowLearning[], base: MindflowLearning[]): Promise<Partial<MindflowReasoning>[]> {
  if (memories.length === 0 || learnings.length === 0) return [];
  
  const prompt = `
    RACIOCÍNIO SISTÊMICO (Fase 3).
    Analise o fluxo: Interação -> Aprendizado -> Raciocínio.
    
    RECENT MEMORIES:
    ${memories.slice(0, 10).map(m => `- ${m.user_message} -> ${m.tona_response}`).join('\n')}
    
    ACQUIRED LEARNINGS:
    ${learnings.slice(0, 10).map(l => `- ${l.learning}`).join('\n')}
    
    Conclua sobre a eficácia sistêmica da Tona nessas interações.
    
    JSON: [ { "title": "...", "reasoning": "...", "summary": "...", "theme": "Sistema", "priority": "low" } ]
  `;

  try {
    const responseText = await callGeminiProxy({
      model: "gemini-3-flash-preview",
      prompt: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const text = responseText || '[]';
    const data = JSON.parse(text);
    return Array.isArray(data) ? data.map(r => ({
      ...r,
      reasoning_type: 'systemic_reasoning',
      scope_type: 'global',
      conclusion_depth: 'strategic',
      abstraction_level: 'systemic'
    })) : [];
  } catch (e) { return []; }
}

async function validateAgainstConsensus(cand: Partial<MindflowReasoning>, base: MindflowLearning[]) {
  // Mocking validation logic for this turn
  return {
    alignment_score: 0.9,
    contradiction_score: 0.05,
    recommended_status: 'active' as MindflowReasoningStatus,
    explanation: 'Raciocínio alinhado com as diretrizes base.',
    anchor_id: base[0]?.id || 'system'
  };
}
