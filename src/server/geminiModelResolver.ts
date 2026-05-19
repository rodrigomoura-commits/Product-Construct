import { adminDb, hasServiceAccount } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const FALLBACK_MODEL = "gemini-1.5-flash";

export async function resolveGeminiModel(context?: {
  useCase?: "chat" | "artifact_generation" | "summarization" | "document_analysis";
  agentId?: string;
  productId?: string;
  stageId?: string;
}) {
  try {
    if (hasServiceAccount) {
      // 1. Check for agent-specific override
      if (context?.agentId) {
        const agentRef = adminDb.collection("agents").doc(context.agentId);
        const agentDoc = await agentRef.get();
        if (agentDoc.exists) {
          const agentData = agentDoc.data();
          if (agentData?.default_model) return agentData.default_model;
          if (context.useCase && agentData?.useCaseModels?.[context.useCase]) {
            return agentData.useCaseModels[context.useCase];
          }
        }
      }

      const configRef = adminDb.collection("system_settings").doc("llm");
      const configDoc = await configRef.get();
      
      if (configDoc.exists) {
        const data = configDoc.data();
        
        // 2. modelo por useCase salvo em system_settings/llm.useCaseModels[useCase]
        if (context?.useCase && data?.useCaseModels?.[context.useCase]) {
          return data.useCaseModels[context.useCase];
        }

        // 3. modelo padrão salvo em system_settings/llm.defaultModel
        if (data?.defaultModel) {
          return data.defaultModel;
        }
      }
    }

    // 4. process.env.GEMINI_MODEL
    if (process.env.GEMINI_MODEL) {
      return process.env.GEMINI_MODEL;
    }

    // 5. "gemini-2.5-flash"
    return FALLBACK_MODEL;
  } catch (error) {
    if ((error as any)?.code !== 7) {
      console.error("Error resolving Gemini model:", error);
    }
    // Mandatory fallback: return fallback model ID string
    return process.env.GEMINI_MODEL || FALLBACK_MODEL;
  }
}

export async function getGeminiModelConfig() {
  try {
    const envModel = process.env.GEMINI_MODEL || null;
    
    if (hasServiceAccount) {
      const configRef = adminDb.collection("system_settings").doc("llm");
      const configDoc = await configRef.get();
      
      if (configDoc.exists) {
        const data = configDoc.data();
        return {
          provider: data?.provider || "google_gemini",
          engineMode: data?.engineMode || "direct", // 'direct' or 'webhook'
          webhookUrl: data?.webhookUrl || null,
          defaultModel: data?.defaultModel || envModel || FALLBACK_MODEL,
          displayName: data?.displayName || data?.defaultModel || "Google Gemini",
          useCaseModels: data?.useCaseModels || {},
          source: data?.defaultModel ? "database" : (envModel ? "env" : "fallback"),
          envModel,
          fallbackModel: FALLBACK_MODEL
        };
      }
    }

    return {
      provider: "google_gemini",
      engineMode: "direct",
      webhookUrl: null,
      defaultModel: envModel || FALLBACK_MODEL,
      displayName: envModel || "Google Gemini",
      useCaseModels: {},
      source: envModel ? "env" : "fallback",
      envModel,
      fallbackModel: FALLBACK_MODEL
    };
  } catch (error) {
    if ((error as any)?.code !== 7) {
      console.error("Error getting Gemini model config:", error);
    }
    return {
      provider: "google_gemini",
      defaultModel: process.env.GEMINI_MODEL || FALLBACK_MODEL,
      displayName: "Google Gemini",
      useCaseModels: {},
      source: "fallback",
      envModel: process.env.GEMINI_MODEL || null,
      fallbackModel: FALLBACK_MODEL,
      warning: "MODEL_CONFIG_PERMISSION_DENIED"
    };
  }
}

export async function saveGeminiModelConfig(params: { 
  defaultModel: string, 
  displayName?: string, 
  useCaseModels?: Record<string, string>, 
  engineMode?: 'direct' | 'webhook',
  webhookUrl?: string,
  userId: string, 
  userEmail: string 
}) {
  const { defaultModel, displayName, useCaseModels, engineMode, webhookUrl, userId, userEmail } = params;
  const configRef = adminDb.collection("system_settings").doc("llm");
  
  const previousConfig = await getGeminiModelConfig();
  
  const newConfig = {
    provider: "google_gemini",
    engineMode: engineMode || previousConfig.engineMode || "direct",
    webhookUrl: webhookUrl !== undefined ? webhookUrl : (previousConfig.webhookUrl || ""),
    defaultModel,
    displayName: displayName || defaultModel,
    useCaseModels: useCaseModels || previousConfig.useCaseModels || {},
    source: "admin",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: userId,
    updatedByEmail: userEmail
  };

  await configRef.set(newConfig, { merge: true });

  // Audit Log
  await adminDb.collection("audit_logs").doc(`llm_config_${Date.now()}`).set({
    action: "gemini_model_updated",
    userId,
    email: userEmail,
    previousModel: previousConfig.defaultModel,
    newModel: defaultModel,
    createdAt: FieldValue.serverTimestamp()
  });

  return newConfig;
}
