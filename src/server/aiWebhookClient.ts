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

  // 3. Fetch Context (Simplified for MVP, matching the user's JSON structure)
  // In a real scenario, we'd gather all the sub-collections.
  // For the requested JSON, we'll try to provide what's available.
  
  const payload = {
    result: {
      message: prompt, // This is the user message now
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
        message: prompt,
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
      conversationHistory: [], 
      continuityContext: {
        lastUserMessage: prompt,
        lastAssistantMessage: "",
        latestTurns: [],
        currentUserMessage: prompt,
        actionType: "send_message",
        selectedOptionIntent: "",
        continuityInstruction: "Continue a conversa a partir do histórico recente. Não reinicie o fluxo."
      },
      situationalContext: {
        currentModule: agentId || "concept_builder",
        currentPhase: stageId || "strategy_foundation",
        actionType: "send_message",
        selectedOptionIntent: "",
        userMessage: prompt,
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
