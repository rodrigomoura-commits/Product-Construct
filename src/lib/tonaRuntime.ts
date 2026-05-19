import { 
  collection, addDoc, updateDoc, doc, getDocs, 
  query, where, orderBy, limit, serverTimestamp, 
  getDoc, setDoc 
} from 'firebase/firestore';
import { db, cleanFirestoreData, safeWrite } from './firebase';
import { buildProductHistoryPack } from './productHistory';
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
import { buildConversationHistoryPack } from './conversationHistory';
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
  questionStrategy?: any;
  suggestedQuickActions?: string[];
  nextAction?: string;
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

function getFallbackStageAgent(stageId?: string) {
  const agentsByStage: Record<string, any> = {
    sense: {
      name: "Problem Sharpener",
      stage_key: "sense",
      role: "stage_agent",
      description: "Ajuda a entender o problema, evidências, cliente, impacto e urgência antes de propor solução."
    },
    shape: {
      name: "Value Sculptor",
      stage_key: "shape",
      role: "stage_agent",
      description: "Ajuda a transformar entendimento do problema em proposta de valor clara."
    },
    sketch: {
      name: "Solution Visualizer",
      stage_key: "sketch",
      role: "stage_agent",
      description: "Ajuda a tangibilizar fluxos, experiência e solução proposta."
    },
    scope: {
      name: "MVP Strategist",
      stage_key: "scope",
      role: "stage_agent",
      description: "Ajuda a planejar MVP, fatiamento, trade-offs e escopo."
    },
    ship: {
      name: "Delivery Translator",
      stage_key: "ship",
      role: "stage_agent",
      description: "Ajuda a preparar entrega, épicos, histórias, critérios e alinhamento operacional."
    },
    learn: {
      name: "Learning Loop Keeper",
      stage_key: "learn",
      role: "stage_agent",
      description: "Ajuda a acompanhar aprendizados, métricas, impacto e próximos ciclos."
    },
    sense_plus: {
      name: "Learning Loop Keeper",
      stage_key: "sense_plus",
      role: "stage_agent",
      description: "Ajuda a acompanhar aprendizados, métricas, impacto e próximos ciclos."
    }
  };

  return agentsByStage[stageId || "sense"] || agentsByStage.sense;
}

function extractQuestionFromText(text: string) {
  const matches = String(text || "").match(/[^.!?]*\?/g);
  return matches?.length ? matches[matches.length - 1].trim() : "";
}

/**
 * CALCULATE NEXT STAGE PROGRESS
 * Defensive calculation of maturity based on signal quality.
 */
function calculateNextStageProgress({
  currentProgress,
  memoryUpdates,
  decisionUpdates,
  evidenceUpdates,
  userMessage
}: any) {
  let delta = 0;
  const text = String(userMessage || "").toLowerCase();

  // Basic signal weight
  if (memoryUpdates?.length) delta += Math.min(4, memoryUpdates.length);
  if (decisionUpdates?.length) delta += 3;
  if (evidenceUpdates?.length) delta += 5;

  // Keyword-based evidence weight
  if (
    text.includes("exemplo") ||
    text.includes("caso real") ||
    text.includes("evidência") ||
    text.includes("dados") ||
    text.includes("métrica")
  ) {
    delta += 4;
  }

  if (
    text.includes("decidimos") ||
    text.includes("decisão") ||
    text.includes("vamos seguir")
  ) {
    delta += 3;
  }

  // Minimum progress for simple responses (A/B/C/D)
  if (/^(a|b|c|d|e)$/i.test(text.trim())) {
    delta = Math.max(delta, 1);
  }

  const next = Math.max(
    currentProgress,
    Math.min(100, currentProgress + delta)
  );

  return {
    next,
    delta: next - currentProgress
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
      try {
        const pSnap = await getDoc(doc(db, 'products', productId));
        productState = pSnap.exists() ? pSnap.data() : {};
      } catch (pError: any) {
        console.warn("[TonaRuntime] Could not fetch product state:", pError);
      }
    }

    currentStep = 'fetching_stage_state';
    // 6. Buscar estado atual da etapa
    let stageState = {};
    if (productId && stageId) {
      try {
        const sSnap = await getDoc(doc(db, `products/${productId}/stages`, stageId));
        stageState = sSnap.exists() ? sSnap.data() : {};
      } catch (sError: any) {
        console.warn("[TonaRuntime] Could not fetch stage state:", sError);
      }
    }

    currentStep = 'fetching_artifacts';
    // 7. Buscar Artifacts atuais da etapa
    let artifacts: any[] = [];
    if (productId) {
      try {
        const artifactsSnap = await getDocs(
          query(
            collection(db, `products/${productId}/artifacts`),
            where('stage_id', '==', stageId || 'sense'),
            limit(10)
          )
        );
        artifacts = artifactsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (artifactsError: any) {
        console.warn("[TonaRuntime] Could not fetch artifacts. Continuing without artifacts.", {
          productId,
          stageId,
          code: artifactsError?.code,
          message: artifactsError?.message
        });
      }
    }

    currentStep = 'fetching_product_history';
    // 7.1 Buscar Histórico do Produto
    const productHistoryPack = productId
      ? await buildProductHistoryPack(productId, stageId || 'sense')
      : null;

    currentStep = 'fetching_stage_agent';
    // 8. Buscar Stage Agent da etapa
    let stageAgent: any = getFallbackStageAgent(stageId);
    try {
      const stageAgentSnap = await getDocs(
        query(
          collection(db, 'stage_agent_configs'),
          where('stage_key', '==', stageId || 'sense'),
          limit(1)
        )
      );

      if (!stageAgentSnap.empty) {
        stageAgent = {
          id: stageAgentSnap.docs[0].id,
          ...stageAgentSnap.docs[0].data()
        };
      }
    } catch (stageAgentError: any) {
      console.warn("[TonaRuntime] Could not fetch stage_agent_configs. Using fallback stage agent.", {
        step: currentStep,
        stageId,
        code: stageAgentError?.code,
        message: stageAgentError?.message
      });

      await safeWrite(() => addDoc(collection(db, "mindflow_runtime_logs"), cleanFirestoreData({
        type: "stage_agent_fallback_used",
        severity: "warning",
        user_id: userId,
        user_email: userEmail || null,
        product_id: productId || null,
        stage_id: stageId || null,
        failed_collection: "stage_agent_configs",
        failed_step: currentStep,
        error_code: stageAgentError?.code || null,
        error_message: stageAgentError?.message || String(stageAgentError),
        created_at: serverTimestamp()
      })), 'stage_agent_fallback_log');
    }

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
    currentStep = 'fetching_conversation_history';
    const conversationHistory = productId && userId
      ? await buildConversationHistoryPack({ productId, userId, stageKey: stageId, limit: 10 })
      : null;

    const contextPack: TonaContextPack & { mindflow_context_map?: MindflowContextMap, conversation_history?: any } = {
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
      product_history: productHistoryPack,
      save_rules: {},
      warnings: [...learningsData.learning_warnings, ...reasoningsData.reasoning_warnings],
      personality_context: personalityContext,
      mindflow_context_map: contextMap,
      conversation_history: conversationHistory
    };

    currentStep = 'composing_prompt';
    // 15. Montar instrução final para a IA
    const prompt = composeTonaPrompt({ ...contextPack, rawPayload: params.rawPayload }, userMessage);
    
    currentStep = 'calling_llm';
    // 16. Executar modelo via Proxy de Backend
    let tonaOutput: TonaStructuredOutput;
    try {
      const responseText = await callGeminiProxy({
        prompt: prompt,
        userMessage: userMessage,
        useCase: "chat",
        agentId: "tona_orchestrator",
        productId,
        stageId,
        userId,
        userEmail,
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
      throw {
        type: errorData.type === "API_KEY_INVALID" ? "API_KEY_INVALID" : "LLM_PROVIDER_ERROR",
        message: errorData.error || "Failed to call LLM provider",
        currentStep: 'calling_llm'
      };
    }

    currentStep = 'calculating_maturity';
    // 16.1 Calcular evolução da maturidade
    let currentStageProgress = 0;
    if (productId && stageId) {
      try {
        const stageSnap = await getDoc(doc(db, "products", productId, "stages", stageId));
        if (stageSnap.exists()) {
          currentStageProgress = Number(stageSnap.data()?.progress || 0);
        }
      } catch (e) {
        console.warn("[TonaRuntime] Could not fetch current stage progress for maturity calculation", e);
      }
    }

    const maturityCalc = calculateNextStageProgress({
      currentProgress: currentStageProgress,
      memoryUpdates: tonaOutput.save_recommendations?.filter(r => r.target === 'mindflow_learning' || r.target === 'mindflow_memory'),
      decisionUpdates: tonaOutput.save_recommendations?.filter(r => r.target === 'decision'),
      evidenceUpdates: tonaOutput.save_recommendations?.filter(r => r.classification === 'evidence'),
      userMessage: userMessage
    });

    // Inject maturity update into structured output if not present or to ensure our logic
    if (tonaOutput.structured_output) {
      (tonaOutput.structured_output as any).maturity_update = {
        stage_key: stageId || 'sense',
        previous_score: currentStageProgress,
        new_score: maturityCalc.next,
        score_delta: maturityCalc.delta,
        reason: maturityCalc.delta > 0 
          ? "A conversa trouxe novo sinal útil para amadurecer a etapa." 
          : "A conversa ajudou a manter o contexto, mas não trouxe sinal suficiente para elevar a maturidade."
      };
    }

    // Ensure conversation_memory_update has the latest snapshot and reasonable defaults
    if (!tonaOutput.conversation_memory_update) {
      tonaOutput.conversation_memory_update = {
        active_stage_key: stageId || null,
        conversation_summary: `Usuário disse: ${userMessage.slice(0, 100)}\nTona respondeu: ${tonaOutput.user_response.slice(0, 100)}`,
        pending_question: extractQuestionFromText(tonaOutput.user_response),
        current_reasoning_thread: `Continuação da etapa ${stageId || "atual"}`,
        next_best_action: extractQuestionFromText(tonaOutput.user_response)
          ? `Responder: ${extractQuestionFromText(tonaOutput.user_response)}`
          : "Continuar explorando o próximo ponto da etapa.",
        unresolved_gaps: []
      };
    }

    if (tonaOutput.conversation_memory_update) {
      tonaOutput.conversation_memory_update.last_maturity_snapshot = {
        ...(tonaOutput.conversation_memory_update.last_maturity_snapshot || {}),
        [stageId || 'sense']: maturityCalc.next
      };
    }

    if (!tonaOutput.structured_output) {
      tonaOutput.structured_output = {};
    }
    (tonaOutput.structured_output as any).conversation_memory_update = tonaOutput.conversation_memory_update;

    currentStep = 'updating_interaction_memory';
    // 17. Salvar resposta da Tona na memória de interação (Protegido por try-catch para não quebrar o chat)
    let memoryUpdateStatus = 'skipped';
    try {
      if (interactionId) {
        await updateUserMemoryWithResponse({
          userId,
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
      
      await safeWrite(() => addDoc(collection(db, 'mindflow_logs'), cleanFirestoreData({
        productId: productId || 'system',
        userId: userId,
        userEmail: userEmail || null,
        action: 'updateUserMemoryWithResponse',
        pipelineStep: currentStep,
        status: 'error',
        errorMessage: memoryError?.message || String(memoryError),
        createdAt: serverTimestamp()
      })), 'mindflow_memory_error_log');
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
      await safeWrite(() => addDoc(collection(db, 'mindflow_logs'), cleanFirestoreData({
        productId: productId || 'system',
        userId: userId,
        userEmail: userEmail || null,
        action: 'extractAndApplyPersistables',
        pipelineStep: currentStep,
        status: 'error',
        errorMessage: persistError?.message || String(persistError),
        createdAt: serverTimestamp()
      })), 'mindflow_persist_error_log');
    }

    currentStep = 'analyzing_style';
    // 21. Analisar Mensagem para Aprendizado de Estilo
    await analyzeUserMessageForStyle(userId, userEmail || '', userMessage);

    currentStep = 'completed';
    // 22. Retornar resposta ao usuário
function sanitizeTonaText(text: string) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

    return {
      ok: true,
      reply: sanitizeTonaText(tonaOutput.user_response),
      memoryUpdates: tonaOutput.save_recommendations.filter(r => r.target === 'mindflow_learning' || r.target === 'mindflow_memory'),
      stageUpdates: tonaOutput.structured_output,
      questionStrategy: (tonaOutput as any).question_strategy,
      suggestedQuickActions: (tonaOutput as any).suggested_quick_actions || [],
      nextAction: (tonaOutput as any).next_action,
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
    await safeWrite(() => addDoc(collection(db, 'mindflow_logs'), cleanFirestoreData({
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
    })), 'mindflow_pipeline_error_log');

    if (interactionId && interactionId.trim() !== '' && userId) {
      try {
        await setDoc(getUserMemoryDoc(db, userId, interactionId), {
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
  userId: string;
  interactionId: string;
  assistantMessage: string;
  structuredOutput: TonaStructuredOutput;
  learningsUsed: string[];
  reasoningsUsed: string[];
  agentId: string;
  stageAgentId?: string;
  specialistAgentId?: string;
}) {
  const { userId, interactionId, assistantMessage, structuredOutput, learningsUsed, reasoningsUsed, agentId, stageAgentId, specialistAgentId } = params;
  
  if (!interactionId || interactionId.trim() === '' || !userId) return;

  await updateDoc(getUserMemoryDoc(db, userId, interactionId), {
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
    const memorySnap = await getDoc(getUserMemoryDoc(db, userId, interactionId));
    if (memorySnap.exists()) {
      const memoryData = memorySnap.data() as any;
      await safeWrite(() => addDoc(collection(db, 'mindflow_runtime_logs'), cleanFirestoreData({
        interaction_id: interactionId,
        user_id: memoryData?.user_id || userId,
        base_learning_ids: learningsUsed,
        reasoning_ids: reasoningsUsed,
        created_at: serverTimestamp()
      })), 'mindflow_runtime_activity_log');
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
  if (!userId) return [];
  const q = query(
    getUserMemoriesCollection(db, userId),
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

  const isStageCompleted = (contextPack.stage_state as any)?.progress >= 100;
  const stageName = (contextPack.stage_state as any)?.name || (contextPack.stage_state as any)?.stage_key || "atual";

  const completionInstructions = isStageCompleted ? `
    ## MODO: ETAPA FINALIZADA (REVISÃO E CONSOLIDAÇÃO)
    Esta etapa (${stageName}) está com 100% de maturidade. 
    Seu comportamento deve mudar:
    1. NÃO faça perguntas exploratórias profundas ou abra novas frentes de descoberta.
    2. Atue como um revisor/validador.
    3. Se o usuário quiser rediscutir um ponto, ajude-o a refinar, mas mantenha o foco na consolidação.
    4. Sugira ativamente avançar para a próxima etapa se não houver mais nada crítico.
    5. No campo 'user_response', seja mais conciso e conclusivo.
    6. Suas opções de 'question_strategy' devem focar em:
       - Confirmar entendimento final.
       - Tirar uma dúvida pontual de refinamento.
       - Avançar para a próxima etapa.
       - Reabrir a discussão (se houver mudança drástica).
  ` : `
    ## MODO: EXPLORAÇÃO ATIVA
    Esta etapa está em andamento. Continue provocando o usuário, fazendo perguntas inteligentes, explorando lacunas e ajudando a amadurecer as ideias.
  `;

  const rawPayload = (contextPack as any).rawPayload;
  const intentContext = rawPayload?.intent === 'reopen_stage_point_discussion' ? `
    ## INTENÇÃO: REDISCUTIR PONTO ESPECÍFICO
    O usuário quer rediscutir o seguinte ponto consolidado da etapa concluída:
    Categoria: ${rawPayload?.reopen_context?.category}
    Título: ${rawPayload?.reopen_context?.title}
    Descrição Original: ${rawPayload?.reopen_context?.description}
    
    INSTRUÇÕES PARA ESTE MODO:
    1. Foque EXCLUSIVAMENTE em revisar este ponto.
    2. Não reabra a etapa inteira nem peça para refazer o que já está bom.
    3. Seja direto e pergunte o que mudou ou o que o usuário quer ajustar especificamente.
    4. Use o contexto da 'Descrição Original' para basear suas perguntas, evitando repetir o que já foi dito.
    5. Se houver mudanças, toda nova informação deve ser mapeada em 'structured_output' para atualizar o resumo depois.
    6. Informe ao usuário que o resumo inteligente agora está marcado como 'desatualizado' e será preciso regenerá-lo ao terminar esta revisão.
  ` : '';

  return `
    ${(contextPack as any).personality_context}

    ${mindflowContextSection}

    ${completionInstructions}

    ${intentContext}

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
    - Nunca use HTML.
    - Nunca use <br>, <p>, <div> ou qualquer tag HTML.
    - Use apenas texto simples e Markdown.
    - Ao pedir decisão, sempre retorne question_strategy.
    - Não faça pergunta aberta pura.
    - Toda resposta de continuidade deve trazer uma microdecisão com opções A/B/C/D na section question_strategy.
    - Se estiver em etapa Sense/Entender o Problema, ofereça opções para problema, público, evidência, impacto ou métrica.
    - Se você retornar question_strategy.options:
      - NÃO liste as opções no campo user_response.
      - NÃO escreva "A)", "B)", "C)", "D)" no user_response.
      - NÃO duplique labels ou descrições das opções no texto.
      - O user_response deve ter apenas:
        1. breve retomada de contexto;
        2. explicação da microdecisão;
        3. pergunta final curta.
    - Nunca contradiga um Aprendizado Base.
    - Use Aprendizados para personalização e continuidade.
    - Atue como Wisdom Layer: sintetize fatos em conselhos úteis.
    - Priorize respostas situacionais e selecionáveis.
    - Sempre que fizer uma pergunta, ofereça de 3 a 5 opções plausíveis.
    - Evite perguntas abertas genéricas quando puder reduzir o esforço do usuário.
    - O usuário deve poder responder com número, escolher opção, combinar ou dizer "outra".
    - Use chips quando a interface suportar.
    - Cada resposta deve conduzir uma microdecisão clara.
    - Não faça várias perguntas profundas de uma vez.
    - Se houver histórico, use-o para sugerir opções.
    - Separe: fato, hipótese, decisão, risco, pendência.

    ESTADO E CONTEXTO:
    - Contexto: ${JSON.stringify(contextPack.detected_context)}
    - Produto: ${JSON.stringify(contextPack.product_state)}
    - Artefatos Já Gerados nesta Etapa: ${JSON.stringify((contextPack as any).existing_artifacts)}
    - Histórico do Produto: ${JSON.stringify(contextPack.product_history)}
    
    APRENDIZADOS BASE:
    ${contextPack.base_learnings.map(m => `- [${m.classification}] ${m.learning}`).join('\n')}

    MEMÓRIAS DO PRODUTO (MINDFLOW):
    Use estas memórias para não repetir perguntas já feitas ou fatos já confirmados.
    ${(contextPack as any).product_memories?.map((m: any) => `- [${m.memory_type || m.classification || 'fato'}] ${m.title || m.label || 'Item'}: ${m.content || m.value}`).join('\n') || 'Nenhuma memória de produto registrada.'}

    RACIOCÍNIOS BASE:
    ${contextPack.base_reasonings.map(r => `- ${r.reasoning}`).join('\n')}

    APRENDIZADOS ADQUIRIDOS:
    ${contextPack.acquired_learnings.map(m => `- [${m.classification}] ${m.learning}`).join('\n')}

    RACIOCÍNIOS ATIVOS:
    ${contextPack.active_reasonings.map(r => `- ${r.reasoning}`).join('\n')}

    MEMÓRIAS DE INTERAÇÃO SIMILARES:
    ${contextPack.user_memories.map(i => `- User: ${i.user_message}\n  Tona: ${i.tona_response}`).join('\n')}

    ## Histórico recente da conversa deste produto
    Use esse histórico para não repetir perguntas e dar continuidade real.
    ${contextPack.conversation_history?.recent_messages?.map((m: any) => `- ${m.role === 'user' ? 'User' : 'Tona'}: ${m.content}`).join('\n') || 'Nenhuma conversa recente.'}

    MENSAGEM DO USUÁRIO: ${userMessage}

    RETORNE O SEGUINTE JSON:
    {
      "user_response": "mensagem amigável para o usuário em Markdown, NUNCA use HTML",
      "conversation_memory_update": {
        "conversation_summary": "resumo curto da conversa atual para o usuário se situar ao reabrir o chat",
        "current_reasoning_thread": "tema principal sendo explorado agora",
        "next_best_action": "o que o usuário deve fazer em seguida",
        "pending_question": "a pergunta final que ficou em aberto"
      },
      "structured_output": {
        "facts": [], "hypotheses": [], "evidence": [], "decisions": [], "risks": [], "pending_items": [], "preferences": [], "learnings": []
      },
      "question_strategy": {
        "type": "multiple_choice",
        "question": "Qual caminho parece mais próximo?",
        "options": [
          {
            "id": "opt_a",
            "letter": "A",
            "label": "Opção A",
            "short_label": "A. Opção A",
            "description": "Detalhes da A",
            "value": "Escolho a opção A."
          }
        ],
        "allows_free_text": true
      },
      "suggested_quick_actions": ["Rápido 1", "Rápido 2"],
      "save_recommendations": [
        {
          "target": "mindflow_learning | product_field | artifact | decision | reasoning_candidate",
          "content": "conteúdo a ser salvo",
          "classification": "tipo",
          "confidence_score": 0.5
        }
      ],
      "next_action": "descrição",
      "warnings": []
    }
  `;
}
