import axios from 'axios';
import { adminDb } from './firebaseAdmin';

export interface WebhookRequestParams {
  prompt: string;
  productId?: string;
  stageId?: string;
  agentId?: string;
  userId?: string;
  userEmail?: string;
  instructions?: string;
  rawPayload?: any;
}

export async function callAIWebhook(url: string, params: WebhookRequestParams) {
  const { productId, stageId, agentId, userId, userEmail, prompt, instructions } = params;

  // 1. Fetch Product Data
  let productData = { id: productId || 'unknown', name: 'Geral', status: 'active' };
  if (productId) {
    try {
      const pSnap = await adminDb.collection('products').doc(productId).get();
      if (pSnap.exists) {
        const data = pSnap.data();
        productData = {
          id: productId,
          name: data?.name || 'Geral',
          status: data?.status || 'active'
        };
      }
    } catch (e) {
      console.warn("[WebhookClient] Failed to fetch product:", e);
    }
  }

  // 2. Fetch User Data
  let userData = { id: userId || 'unknown', email: userEmail || '', name: 'Usuário' };
  if (userId) {
    try {
      const uSnap = await adminDb.collection('users').doc(userId).get();
      if (uSnap.exists) {
        const data = uSnap.data();
        userData = {
          id: userId,
          email: data?.email || userEmail || '',
          name: data?.display_name || data?.name || 'Usuário'
        };
      }
    } catch (e) {
      console.warn("[WebhookClient] Failed to fetch user:", e);
    }
  }

  // 3. Prepare Chat History for standard AI formats
  function sanitizeMessages(msgs: Array<{ role: string; content?: string | null }>) {
    return msgs
      .map((m) => ({
        ...m,
        content: typeof m.content === "string" ? m.content.trim() : ""
      }))
      .filter((m) => m.content.length > 0);
  }

  const raw = params.rawPayload || {};
  
  // Normalization logic based on requested priority
  let normalized_user_message = "";
  
  if (raw.input?.message && typeof raw.input.message === 'string' && raw.input.message.trim()) {
    normalized_user_message = raw.input.message.trim();
  } 
  else if (raw.input?.continuityContext?.currentUserMessage && typeof raw.input.continuityContext.currentUserMessage === 'string' && raw.input.continuityContext.currentUserMessage.trim()) {
    normalized_user_message = raw.input.continuityContext.currentUserMessage.trim();
  }
  else if (raw.input?.situationalContext?.userMessage && typeof raw.input.situationalContext.userMessage === 'string' && raw.input.situationalContext.userMessage.trim()) {
    normalized_user_message = raw.input.situationalContext.userMessage.trim();
  }
  else if (raw.message && typeof raw.message === 'string' && raw.message.trim()) {
    normalized_user_message = raw.message.trim();
  }
  else if (prompt && typeof prompt === 'string' && prompt.trim()) {
    normalized_user_message = prompt.trim();
  }

  if (!normalized_user_message) {
    throw new Error("Mensagem do usuário não encontrada no payload do webhook.");
  }

  const currentUserMessage = normalized_user_message;

  let messages: any[] = [];
  
  // Add instructions as system message if provided
  if (instructions && instructions.trim()) {
    messages.push({ role: 'system', content: instructions.trim() });
  }

  // Add conversation history
  if (Array.isArray(raw.conversationHistory?.recent_messages)) {
    raw.conversationHistory.recent_messages.forEach((msg: any) => {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      });
    });
  }
  
  // Add current message
  messages.push({ role: 'user', content: currentUserMessage });

  // Final sanitization
  messages = sanitizeMessages(messages);

  if (messages.length === 0) {
    throw new Error("Nenhuma mensagem válida foi montada para execução.");
  }

  // Validate no invalid contents left
  const invalidMessages = messages.filter(m => !m.content || !m.content.trim());
  if (invalidMessages.length > 0) {
    console.error("[Webhook] Invalid messages detected:", invalidMessages);
    throw new Error("Existem mensagens vazias no payload do agente.");
  }

  const payload = {
    normalized_user_message, // Explicitly exposed for Astroflow blocks
    result: {
      message: currentUserMessage,
      normalized_user_message,
      messages: messages, // Sanitized messages list
      agent: agentId || "concept_builder",
      action: "send_message",
      instructions: instructions || "[PHASE: JOURNEY PRINCIPLES] Foco no problema antes da solução.",
      input: {
        product: productData,
        module: {
          key: agentId || "concept_builder",
          name: agentId || "concept_builder",
          phaseKey: stageId || "strategy_foundation",
          phaseName: stageId === 'sense' ? "Fundação Estratégica" : 
                     stageId === 'shape' ? "Definição de Valor" :
                     stageId === 'sketch' ? "Desenho da Solução" :
                     stageId === 'scope' ? "Planejamento de MVP" :
                     stageId === 'ship' ? "Preparação de Entrega" : "Processo de Produto"
        },
        actionType: "send_message",
        message: currentUserMessage,
        selectedOptionIntent: "",
        mindflowContext: {
           productContext: {
             productName: productData.name,
             status: productData.status,
             maturity: null,
             currentPhase: stageId || "strategy_foundation",
             currentModule: agentId || "concept_builder",
             strategicSummary: "",
             valueProposition: null,
             experienceContext: null,
             deliveryContext: null
           },
           memory: {
             baseMemories: [],
             acquiredLearnings: [],
             relevantReasonings: [],
             conversationSummaries: []
           },
           governance: { guardrails: [], gaps: [], risks: [], conflicts: [] },
           artifacts: { existingArtifacts: [], suggestedArtifacts: [], artifactReadiness: [] },
           decisions: { recentDecisions: [], openDecisions: [] },
           traceability: { sources: [], confidence: "weak", missingInputs: [] }
        }
      },
      conversationHistory: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        text: m.content
      })), 
      continuityContext: {
        lastUserMessage: currentUserMessage,
        lastAssistantMessage: "",
        latestTurns: [],
        currentUserMessage: currentUserMessage,
        actionType: "send_message",
        selectedOptionIntent: "",
        continuityInstruction: "Continue a conversa a partir do histórico recente. Não reinicie o fluxo."
      },
      situationalContext: {
        currentModule: agentId || "concept_builder",
        currentPhase: stageId || "strategy_foundation",
        actionType: "send_message",
        selectedOptionIntent: "",
        userMessage: currentUserMessage,
        expectedBehavior: "continue_existing_conversation"
      },
      extraInput: {},
      context: {
        workspace: "product_framework",
        module: agentId || "concept_builder",
        phase: stageId || "strategy_foundation",
        webhookResolution: "global_fallback",
        databaseId: "product-framework-workspace"
      },
      origin: {
        type: "workspace_action",
        triggeredBy: "user",
        sourceModule: agentId || "concept_builder",
        actionSource: "send_message"
      },
      user: userData,
      runtime: {
        source: "product_framework_workspace",
        channel: "backend_module_gateway",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development"
      },
      responseFormat: "markdown"
    }
  };

  try {
    console.log(`[Webhook] Calling ${url}...`);
    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    // The response could be the raw text or a structured JSON
    // Hotmart Astroflow usually returns { text: "..." } or simple string
    if (typeof response.data === 'string') {
      return { text: response.data };
    }
    
    if (response.data?.text) {
      return { text: response.data.text };
    }

    if (response.data?.result?.user_response) {
       return { text: response.data.result.user_response, structured: response.data.result };
    }

    return { text: JSON.stringify(response.data) };
  } catch (error: any) {
    console.error("[Webhook] External Call Failed:", error.message);
    throw new Error(`Webhook Error: ${error.message}`);
  }
}
