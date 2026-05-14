import { 
  collection, addDoc, updateDoc, doc, getDocs, 
  query, where, orderBy, limit, serverTimestamp, 
  getDoc, setDoc 
} from 'firebase/firestore';
import { db, cleanFirestoreData } from './firebase';
import { 
  MindflowUserMemory, 
  MindflowLearning, 
  MindflowReasoning, 
  TonaContextPack, 
  TonaStructuredOutput,
  MindflowContextMap
} from '../types';
import { classifyInteractionContext, storeUserMemory, getMindflowContextForStage } from './mindflowContext';
import { retrieveMindflowLearnings, retrieveMindflowReasonings } from './mindflow';
import { callGeminiProxy } from './geminiProxy';
import { 
  getTonaBasePersonality, 
  getUserPersonality, 
  buildTonaRuntimePersonalityContext,
  analyzeUserMessageForStyle,
  ensureTonaPersonalitySeed
} from './tonaPersonalityEngine';
import { normalizeError } from './utils';
import { getUserMemoriesCollection, getUserMemoryDoc } from './mindflowCollections';

/**
 * TONA RUNTIME ORCHESTRATOR
 * Mediates all user conversations through the Mindflow layer.
 * Implements the 21 steps for conversation turn.
 */

export interface MindflowTurnResult {
  ok: boolean;
  reply: string;
  memoryUpdates?: any[];
  stageUpdates?: any;
  artifactsSuggested?: any[];
  decisionsSuggested?: any[];
  risks?: any[];
  gaps?: any[];
  error?: {
    type: string;
    message: string;
    step: string;
    recoverable: boolean;
  };
  debug: {
    pipeline: string;
    step?: string;
    failedAt?: string;
    originalError?: string;
    timestamp?: string;
  };
}

export async function runTonaConversationTurn(params: {
  userId: string;
  userIdentifier?: string;
  userMessage: string;
  userEmail?: string;
  conversationId?: string;
  productId?: string;
  stageId?: string;
  agentId?: string;
  rawPayload?: any;
}): Promise<MindflowTurnResult> {
  const { userId, userMessage, productId, stageId, agentId, userEmail } = params;
  let interactionId: string | null = null;
  let currentStep = 'initialization';

  try {
    currentStep = 'seeding_personality';
    // Ensure personality is seeded
    await ensureTonaPersonalitySeed({ uid: userId, email: userEmail || '' });

    currentStep = 'creating_interaction';
    // 1. Criar registro inicial da interação
    interactionId = await createPendingUserInteraction(params);

    currentStep = 'classifying_context';
    // 2. Classificar contexto
    const classification = await classifyInteractionContext({
      userMessage,
      productId,
      stageId
    });

    currentStep = 'fetching_context_map';
    // 2.1 Fetch Mindflow Journey Context Map
    const contextMap = await getMindflowContextForStage(stageId || classification.id || '');

    currentStep = 'loading_personality';
    // 3. Carregar Personalidades (Base e Usuário)
    const basePersonality = await getTonaBasePersonality();
    const userPersonality = await getUserPersonality(userId, userEmail);

    const personalityContext = buildTonaRuntimePersonalityContext({
      basePersonality,
      userPersonality,
      productContext: productId,
      stageContext: stageId
    });

    currentStep = 'fetching_product_state';
    // 5. Buscar estado atual do produto
    let productState: any = {};
    if (productId) {
      const pSnap = await getDoc(doc(db, 'products', productId));
      productState = pSnap.exists() ? pSnap.data() : {};
    }

    currentStep = 'fetching_stage_state';
    // 6. Buscar estado atual da etapa
    let stageState = {};
    if (productId && stageId) {
      const sSnap = await getDoc(doc(db, `products/${productId}/stages`, stageId));
      stageState = sSnap.exists() ? sSnap.data() : {};
    }

    currentStep = 'fetching_artifacts';
    // 7. Buscar Artifacts atuais da etapa
    const artifactsSnap = await getDocs(query(collection(db, `products/${productId}/artifacts`), where('stage_id', '==', stageId), limit(10)));
    const artifacts = artifactsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    currentStep = 'fetching_stage_agent';
    // 8. Buscar Stage Agent da etapa
    const stageAgentSnap = await getDocs(query(collection(db, 'stage_agent_configs'), where('stage_key', '==', stageId), limit(1)));
    const stageAgent = stageAgentSnap.docs[0]?.data() || { name: 'Agente de Etapa' };

    // 9. Selecionar Specialist Agent
    const specialistAgent = null;

    currentStep = 'retrieving_learnings';
    // 10-13. Recuperar Memórias e Raciocínios
    const learningsData = await retrieveMindflowLearnings({
      userId,
      productId,
      stageId,
      agentId,
      contextId: classification.id,
      product: classification.name,
      context: classification.name,
      subContext: classification.intention,
      userMessage
    });

    currentStep = 'retrieving_reasonings';
    const reasoningsData = await retrieveMindflowReasonings({
      userId,
      productId,
      stageId,
      agentId,
      contextId: classification.id,
      userMessage
    });

    currentStep = 'retrieving_memories';
    // 13. Recuperar memórias de interação recentes similares
    const recentMemories = await retrieveSimilarUserMemories(userId, classification.id || '');

    // 14. Montar Context Pack
    const contextPack: TonaContextPack = {
      interaction_id: interactionId,
      detected_context: classification,
      tona_core_personality: basePersonality,
      user_behavior_profile: userPersonality,
      product_state: productState,
      stage_state: stageState,
      stage_agent: stageAgent,
      specialist_agent: specialistAgent,
      base_learnings: learningsData.base_learnings,
      acquired_learnings: learningsData.acquired_learnings,
      base_reasonings: reasoningsData.base_reasonings,
      active_reasonings: reasoningsData.hybrid_reasonings, 
      user_memories: recentMemories,
      save_rules: {},
      warnings: [...learningsData.learning_warnings, ...reasoningsData.reasoning_warnings],
      personality_context: personalityContext,
    };

    currentStep = 'composing_prompt';
    // 15. Montar instrução final para a IA
    const prompt = composeTonaPrompt(contextPack, userMessage);
    
    currentStep = 'calling_llm';
    // 16. Executar modelo via Proxy de Backend
    let tonaOutput: TonaStructuredOutput;
    try {
      const responseText = await callGeminiProxy({
        prompt: prompt,
        model: "gemini-1.5-flash",
        config: {
          responseMimeType: "application/json"
        }
      });
      
      currentStep = 'parsing_json';
    try {
      tonaOutput = JSON.parse(responseText);
    } catch (parseError) {
      console.warn("Invalid JSON from LLM, attempting recovery:", responseText);
      // fallback to plain text if JSON fails
      tonaOutput = {
        user_response: responseText.replace(/```json|```/g, '').trim(),
        structured_output: {},
        save_recommendations: []
      };
    }
  } catch (llmError: any) {
    console.error("LLM Provider Error:", llmError);
    
    let errorData: any = {};
    try {
      errorData = JSON.parse(llmError.message);
    } catch (e) {
      errorData = { error: llmError.message };
    }

    // Fallback friendly message for users
    const fallbackReply = `Tive um problema ao conectar com o provedor de IA agora. O contexto da conversa foi preservado. Você pode tentar novamente em instantes ou continuar explorando o Discovery manualmente.`;
    
    throw {
      type: errorData.type === "API_KEY_INVALID" ? "API_KEY_INVALID" : "LLM_PROVIDER_ERROR",
      message: errorData.error || "Failed to call LLM provider",
      currentStep: 'calling_llm'
    };
  }

    currentStep = 'updating_interaction_memory';
    // 17. Salvar resposta da Tona na memória de interação (Protegido por try-catch para não quebrar o chat)
    let memoryUpdateStatus = 'skipped';
    try {
      if (interactionId) {
        await updateUserMemoryWithResponse({
          interactionId,
          assistantMessage: tonaOutput.user_response,
          structuredOutput: tonaOutput,
          learningsUsed: learningsData.base_learnings.map(m => m.id),
          reasoningsUsed: reasoningsData.base_reasonings.map(r => r.id),
          agentId: 'tona_orchestrator',
          stageAgentId: stageId
        });
        memoryUpdateStatus = 'success';
      }
    } catch (memoryError: any) {
      memoryUpdateStatus = 'failed';
      console.error("[MindFlow] Interaction memory update failed:", memoryError);
      
      // Log failure but don't stop the pipeline
      await addDoc(collection(db, 'mindflow_logs'), cleanFirestoreData({
        productId: productId || 'system',
        userId: userId,
        userEmail: userEmail || null,
        action: 'updateUserMemoryWithResponse',
        pipelineStep: currentStep,
        status: 'error',
        errorMessage: memoryError?.message || String(memoryError),
        createdAt: serverTimestamp()
      }));
    }

    currentStep = 'persisting_updates';
    // 18-20. Extrair aprendizados e Salvar Memórias/Events (Protegido por try-catch)
    try {
      await extractAndApplyPersistables({
        tonaOutput,
        interactionId,
        userId,
        classification,
        productId,
        stageId,
        agentId
      });
    } catch (persistError: any) {
      console.error("[MindFlow] Persistence of updates failed:", persistError);
      await addDoc(collection(db, 'mindflow_logs'), cleanFirestoreData({
        productId: productId || 'system',
        userId: userId,
        userEmail: userEmail || null,
        action: 'extractAndApplyPersistables',
        pipelineStep: currentStep,
        status: 'error',
        errorMessage: persistError?.message || String(persistError),
        createdAt: serverTimestamp()
      }));
    }

    currentStep = 'analyzing_style';
    // 21. Analisar Mensagem para Aprendizado de Estilo
    await analyzeUserMessageForStyle(userId, userEmail || '', userMessage);

    currentStep = 'completed';
    // 22. Retornar resposta ao usuário
    return {
      ok: true,
      reply: tonaOutput.user_response,
      memoryUpdates: tonaOutput.save_recommendations.filter(r => r.target === 'mindflow_learning' || r.target === 'mindflow_memory'),
      stageUpdates: tonaOutput.structured_output,
      artifactsSuggested: tonaOutput.save_recommendations.filter(r => r.target === 'artifact'),
      decisionsSuggested: tonaOutput.save_recommendations.filter(r => r.target === 'decision'),
      risks: (tonaOutput.structured_output as any).risks || [],
      gaps: (tonaOutput.structured_output as any).pending_items || [],
      debug: {
        pipeline: "mindflow",
        step: "completed"
      }
    };

  } catch (error: any) {
    console.error("Tona Conversation Turn Failed at step:", currentStep, error);
    
    const normalized = normalizeError(error, "MINDFLOW_PIPELINE_ERROR");
    
    // Log to mindflow_logs
    try {
      await addDoc(collection(db, 'mindflow_logs'), cleanFirestoreData({
        productId: productId || 'system',
        userId: userId,
        userEmail: userEmail || null,
        role: (params as any).role || 'unknown',
        action: 'runTonaConversationTurn',
        pipelineStep: currentStep,
        status: 'error',
        errorType: normalized.type,
        errorMessage: normalized.message,
        stack: normalized.stack,
        createdAt: serverTimestamp(),
        environment: 'production',
        activeStage: stageId || 'unknown',
        requestPayloadPreview: { userMessageLength: userMessage?.length }
      }));
    } catch (logError) {
      console.error("Critical: Failed to save mindflow_log:", logError);
    }

    if (interactionId && interactionId.trim() !== '') {
      try {
        await setDoc(getUserMemoryDoc(db, interactionId), {
          'metadata.status': 'failed',
          'metadata.error': normalized.message,
          'metadata.failedAt': currentStep
        }, { merge: true });
      } catch (err) {
        console.error("Failed to update memory status during error handling:", err);
      }
    }

    // Contextual Fallback
    const stageLabel = (stageId === 'sense' ? 'Entender o Problema' : 
                        stageId === 'shape' ? 'Definir a Proposta' : 
                        stageId === 'sketch' ? 'Visualizar a Solução' : 
                        stageId === 'scope' ? 'Planejar o MVP' : 
                        stageId === 'ship' ? 'Preparar a Entrega' : 'Discovery');

    const fallbackReply =`Tive um problema ao consultar o MindFlow agora, mas não perdi o contexto desta conversa. Pelo que já temos em **${stageLabel}**, podemos continuar explorando as lacunas principais ou você pode tentar novamente.`;

    return {
      ok: false,
      reply: fallbackReply,
      error: {
        type: "MINDFLOW_PIPELINE_ERROR",
        message: normalized.message,
        step: currentStep,
        recoverable: true
      },
      debug: {
        pipeline: "mindflow",
        failedAt: currentStep,
        originalError: normalized.message,
        timestamp: new Date().toISOString()
      }
    };
  }
}

async function extractAndApplyPersistables(params: any) {
  const { tonaOutput, interactionId, userId, classification, productId } = params;
  
  if (tonaOutput.save_recommendations) {
    for (const rec of tonaOutput.save_recommendations) {
      if (rec.confidence_score >= 0.8) {
        if (rec.target === 'mindflow_learning') {
          await addDoc(collection(db, 'mindflow_learnings'), cleanFirestoreData({
            learning_type: 'Adquirida',
            theme: classification.name || 'Geral',
            learning: rec.content,
            classification: rec.classification || 'aprendizado',
            source_type: 'memory',
            source_id: interactionId,
            scope_type: 'user',
            user_id: userId,
            product_id: productId || null,
            product: productId || 'Geral',
            is_active: true,
            confidence_score: rec.confidence_score,
            learning_date: new Date().toISOString().split('T')[0],
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            metadata: { confidence_llm: rec.confidence_score }
          } as any));
        }
      } 
    }
  }
}

async function updateUserMemoryWithResponse(params: {
  interactionId: string;
  assistantMessage: string;
  structuredOutput: TonaStructuredOutput;
  learningsUsed: string[];
  reasoningsUsed: string[];
  agentId: string;
  stageAgentId?: string;
  specialistAgentId?: string;
}) {
  const { interactionId, assistantMessage, structuredOutput, learningsUsed, reasoningsUsed, agentId, stageAgentId, specialistAgentId } = params;
  
  if (!interactionId || interactionId.trim() === '') return;

  await updateDoc(getUserMemoryDoc(db, interactionId), {
    tona_response: assistantMessage,
    'metadata.status': 'completed',
    agent_id: agentId,
    stage_agent_id: stageAgentId || null,
    specialist_agent_id: specialistAgentId || null,
    used_learning_ids: learningsUsed,
    used_reasoning_ids: reasoningsUsed,
    generated_learning_ids: structuredOutput.save_recommendations?.filter(r => r.target === 'mindflow_learning' || r.target === 'mindflow_memory').map(r => r.content.substring(0, 50)) || [],
    updated_at: serverTimestamp()
  });

  // Log Runtime Activity
  try {
    const memorySnap = await getDoc(getUserMemoryDoc(db, interactionId));
    if (memorySnap.exists()) {
      await addDoc(collection(db, 'mindflow_runtime_logs'), cleanFirestoreData({
        interaction_id: interactionId,
        user_id: memorySnap.data()?.user_id,
        base_learning_ids: learningsUsed,
        reasoning_ids: reasoningsUsed,
        created_at: serverTimestamp()
      }));
    }
  } catch (logError) {
    console.error("Failed to log runtime activity:", logError);
  }
}

async function createPendingUserInteraction(params: any): Promise<string> {
  const result = await storeUserMemory({
    userId: params.userId,
    userIdentifier: params.userIdentifier,
    userMessage: params.userMessage,
    conversationId: params.conversationId,
    productId: params.productId,
    stageId: params.stageId,
    agentId: params.agentId,
    rawPayload: params.rawPayload
  });
  return result?.id || '';
}

async function retrieveSimilarUserMemories(userId: string, contextId: string): Promise<MindflowUserMemory[]> {
  const q = query(
    getUserMemoriesCollection(db),
    where('user_id', '==', userId),
    where('context_id', '==', contextId),
    orderBy('created_at', 'desc'),
    limit(3)
  );
  try {
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowUserMemory));
  } catch (e) {
    console.warn("Could not retrieve similar user memories:", e);
    return [];
  }
}

function composeTonaPrompt(contextPack: TonaContextPack & { mindflow_context_map?: MindflowContextMap }, userMessage: string): string {
  const context = contextPack.mindflow_context_map;
  
  const mindflowContextSection = context ? `
    ## Contexto Mindflow ativo (Jornada)
    Nome: ${context.name}
    Foco: ${context.focus}
    Intenção: ${context.intention}
    Modo cognitivo: ${context.cognitive_mode}
    Pergunta central: ${context.central_question}
    Critérios de qualidade: ${context.quality_criteria.join(', ')}
    Lacunas comuns: ${context.common_gaps.join(', ')}
    Artefatos recomendados: ${context.recommended_artifacts.join(', ')}
    Atalhos proibidos: ${context.forbidden_shortcuts.join(', ')}
    Pesos de interpretação: ${JSON.stringify(context.weights)}
  ` : '';

  return `
    ${(contextPack as any).personality_context}

    ${mindflowContextSection}

    # Instruções de Orquestração do Mindflow
    Você deve responder usando o Mindflow V2, respeitando a seguinte ordem de autoridade:

    1. Regras de segurança e verdade (Aprendizados Base)
    2. Raciocínios prioritários da Base
    3. Tona Core Personality
    4. Perfil comportamental do usuário
    5. Aprendizados Adquiridos relevantes
    6. Raciocínios ativos relevantes
    7. Memórias de interação recentes (Contexto)
    8. Instruções do Stage Agent

    REGRAS CRÍTICAS:
    - Nunca contradiga um Aprendizado Base.
    - Use Aprendizados para personalização e continuidade.
    - Atue como Wisdom Layer: sintetize fatos em conselhos úteis.

    ESTADO E CONTEXTO:
    - Contexto: ${JSON.stringify(contextPack.detected_context)}
    - Produto: ${JSON.stringify(contextPack.product_state)}
    - Artefatos Já Gerados nesta Etapa: ${JSON.stringify((contextPack as any).existing_artifacts)}
    
    APRENDIZADOS BASE:
    ${contextPack.base_learnings.map(m => `- [${m.classification}] ${m.learning}`).join('\n')}

    RACIOCÍNIOS BASE:
    ${contextPack.base_reasonings.map(r => `- ${r.reasoning}`).join('\n')}

    APRENDIZADOS ADQUIRIDOS:
    ${contextPack.acquired_learnings.map(m => `- [${m.classification}] ${m.learning}`).join('\n')}

    RACIOCÍNIOS ATIVOS:
    ${contextPack.active_reasonings.map(r => `- ${r.reasoning}`).join('\n')}

    MEMÓRIAS DE INTERAÇÃO (Recent):
    ${contextPack.user_memories.map(i => `- User: ${i.user_message}\n  Tona: ${i.tona_response}`).join('\n')}

    MENSAGEM DO USUÁRIO: ${userMessage}

    RETORNE O SEGUINTE JSON:
    {
      "user_response": "mensagem amigável para o usuário",
      "structured_output": {
        "facts": [], "hypotheses": [], "evidence": [], "decisions": [], "risks": [], "pending_items": [], "preferences": [], "learnings": []
      },
      "save_recommendations": [
        {
          "target": "mindflow_learning | product_field | artifact | decision | reasoning_candidate",
          "content": "conteúdo a ser salvo",
          "classification": "tipo",
          "confidence_score": 0.0 a 1.0
        }
      ],
      "next_action": "descrição",
      "warnings": []
    }
  `;
}
