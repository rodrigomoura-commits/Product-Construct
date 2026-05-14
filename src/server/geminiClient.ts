import { GoogleGenAI } from "@google/genai";

const FALLBACK_MODEL = "gemini-2.5-flash";
const GEMINI_MODEL = process.env.GEMINI_MODEL || FALLBACK_MODEL;

/**
 * GEMINI CLIENT HELPER
 * Centralizes authentication and validation for Google Generative AI.
 */

export function getGeminiClient(providedKey?: string) {
  let apiKey = providedKey;

  if (!apiKey) {
    const keysWithNames = [
      { name: 'GEMINI_API_KEY', value: process.env.GEMINI_API_KEY },
      { name: 'VITE_GEMINI_API_KEY', value: process.env.VITE_GEMINI_API_KEY },
      { name: 'GOOGLE_API_KEY', value: process.env.GOOGLE_API_KEY },
      { name: 'API_KEY', value: process.env.API_KEY },
      { name: 'NEXT_PUBLIC_GEMINI_API_KEY', value: process.env.NEXT_PUBLIC_GEMINI_API_KEY }
    ];

    // Find the first key that is not empty and not a placeholder string
    let found = keysWithNames.find(k => typeof k.value === 'string' && k.value.trim().length >= 5 && k.value !== 'undefined' && k.value !== 'null');
    apiKey = found?.value;

    if (!apiKey) {
      throw new Error("Gemini API Key is missing or invalid. Please configure GEMINI_API_KEY in the Secrets panel.");
    }
  }

  // Remove potential quotes
  let trimmed = apiKey.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1);
  }

  return new GoogleGenAI({ apiKey: trimmed });
}

/**
 * Asserts if Gemini is properly configured without exposing the full key.
 */
export function assertGeminiConfigured() {
  const keysWithNames = [
    { name: 'GEMINI_API_KEY', value: process.env.GEMINI_API_KEY },
    { name: 'VITE_GEMINI_API_KEY', value: process.env.VITE_GEMINI_API_KEY },
    { name: 'GOOGLE_API_KEY', value: process.env.GOOGLE_API_KEY },
    { name: 'API_KEY', value: process.env.API_KEY }
  ];

  const found = keysWithNames.find(k => typeof k.value === 'string' && k.value.trim().length >= 5 && k.value !== 'undefined' && k.value !== 'null');
  const apiKey = found?.value;
  const keySource = found?.name || 'NONE';
  
  const trimmed = apiKey ? apiKey.trim() : null;
  const finalKey = (trimmed && (trimmed.startsWith('"') || trimmed.startsWith("'"))) ? trimmed.slice(1, -1) : trimmed;

  const placeholders = [
    'MY_GEMINI_API_KEY',
    'YOUR_API_KEY',
    'Gemini API Key is using a placeholder value'
  ];
  const isPlaceholder = finalKey ? placeholders.some(p => finalKey.includes(p)) : false;

  return {
    configured: Boolean(finalKey && finalKey.length >= 5 && !isPlaceholder),
    keySource,
    keyPreview: finalKey
      ? `${finalKey.slice(0, 4)}...${finalKey.slice(-4)}`
      : null,
    length: finalKey ? finalKey.length : 0,
    prefixOk: finalKey ? finalKey.startsWith('AIza') : false,
    isPlaceholder
  };
}

/**
 * Health check for the LLM Provider
 */
export async function checkGeminiHealth(providedKey?: string) {
  const config = assertGeminiConfigured();
  const timestamp = new Date().toISOString();
  let status: any = "unknown_error";
  let message = "Erro ao validar integração.";
  let recommendedAction = "Verifique os detalhes técnicos e a configuração do ambiente.";
  let availableModels: any[] = [];
  let canListModels = false;
  let canCallGenerateContent = false;

  try {
    // 1. Check if key exists
    if (!config.configured && !providedKey) {
      return {
        provider: "google_gemini",
        status: config.isPlaceholder ? "placeholder_key" : "missing_key",
        envKey: "GEMINI_API_KEY",
        modelEnvKey: "GEMINI_MODEL",
        configuredModel: GEMINI_MODEL,
        canReadEnv: config.length > 0,
        canListModels: false,
        canCallGenerateContent: false,
        message: config.isPlaceholder 
          ? "A chave configurada é um placeholder (texto de exemplo)." 
          : "GEMINI_API_KEY não foi encontrada no ambiente.",
        recommendedAction: "Adicione uma GEMINI_API_KEY válida nas variáveis de ambiente.",
        technicalDetails: { timestamp, errorCode: config.isPlaceholder ? "PLACEHOLDER" : "MISSING" }
      };
    }

    // 2. Validate prefix and placeholder (Step 2 of the logic requested)
    // We already moved placeholder check to checkGeminiHealth logic if not in assertGeminiConfigured
    if (config.isPlaceholder && !providedKey) {
       // already handled above
    }

    const ai = getGeminiClient(providedKey);
    
    // 3. List Models (Step 3 & 4)
    try {
      const response = await ai.models.list();
      availableModels = (response.models || []).map(m => ({
        name: m.name,
        displayName: m.displayName,
        supportedGenerationMethods: m.supportedGenerationMethods
      }));
      canListModels = true;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes("API key not valid") || errMsg.includes("invalid-api-key")) {
        return {
          provider: "google_gemini",
          status: "invalid_key",
          envKey: "GEMINI_API_KEY",
          canReadEnv: true,
          canListModels: false,
          canCallGenerateContent: false,
          message: "API Key inválida ou recusada pelo Google.",
          recommendedAction: "Verifique se a chave foi copiada corretamente do Google AI Studio.",
          technicalDetails: { timestamp, errorCode: "INVALID_KEY", errorMessage: errMsg }
        };
      }
      throw err; // bubble up for other network/disabled errors
    }

    // 4. Validate configured model (Step 4 & 5)
    const targetModel = GEMINI_MODEL.startsWith('models/') ? GEMINI_MODEL : `models/${GEMINI_MODEL}`;
    const foundModel = availableModels.find(m => m.name === targetModel);

    if (!foundModel) {
      return {
        provider: "google_gemini",
        status: "model_not_found",
        envKey: "GEMINI_API_KEY",
        modelEnvKey: "GEMINI_MODEL",
        configuredModel: GEMINI_MODEL,
        canReadEnv: true,
        canListModels: true,
        canCallGenerateContent: false,
        message: "Modelo Gemini não encontrado.",
        recommendedAction: `Atualize a variável GEMINI_MODEL para um modelo disponível, como gemini-2.5-flash.`,
        availableModels,
        technicalDetails: { 
          timestamp, 
          errorCode: "MODEL_NOT_FOUND", 
          errorMessage: `O modelo ${GEMINI_MODEL} não está disponível para esta chave de API.`
        }
      };
    }

    if (!foundModel.supportedGenerationMethods?.includes('generateContent')) {
      return {
        provider: "google_gemini",
        status: "model_method_not_supported",
        envKey: "GEMINI_API_KEY",
        modelEnvKey: "GEMINI_MODEL",
        configuredModel: GEMINI_MODEL,
        canReadEnv: true,
        canListModels: true,
        canCallGenerateContent: false,
        message: "Modelo não suporta geração de conteúdo.",
        recommendedAction: "Escolha um modelo que possua generateContent em supportedGenerationMethods.",
        availableModels,
        technicalDetails: { timestamp, errorCode: "METHOD_NOT_SUPPORTED" }
      };
    }

    // 5. Ping Test (Step 6)
    try {
      await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: "ping"
      });
      canCallGenerateContent = true;
      status = "connected";
      message = "Google Gemini configurado e respondendo.";
      recommendedAction = "Nenhuma ação necessária.";
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      return {
        provider: "google_gemini",
        status: "unknown_error",
        envKey: "GEMINI_API_KEY",
        canReadEnv: true,
        canListModels: true,
        canCallGenerateContent: false,
        message: "Erro ao realizar chamada de teste (ping).",
        recommendedAction: "Verifique se o seu projeto possui quota disponível.",
        technicalDetails: { timestamp, errorCode: "PING_FAILED", errorMessage: errMsg }
      };
    }

    return {
      provider: "google_gemini",
      status,
      envKey: "GEMINI_API_KEY",
      modelEnvKey: "GEMINI_MODEL",
      configuredModel: GEMINI_MODEL,
      canReadEnv: true,
      canListModels,
      canCallGenerateContent,
      message,
      recommendedAction,
      availableModels,
      technicalDetails: { timestamp }
    };

  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    let errorCode = "UNKNOWN";

    if (errorMsg.includes("API_KEY_SERVICE_BLOCKED") || errorMsg.includes("not enabled")) {
      status = "api_disabled";
      message = "API Generative Language não habilitada no Google Cloud.";
      errorCode = "API_DISABLED";
      recommendedAction = "Habilite a Generative Language API no console do Google Cloud.";
    } else if (errorMsg.includes("fetch failed") || errorMsg.includes("ENOTFOUND")) {
      status = "network_error";
      message = "Falha de rede ao conectar com o Google.";
      errorCode = "NETWORK_ERROR";
      recommendedAction = "Verifique as configurações de rede e DNS do seu servidor.";
    }

    return {
      provider: "google_gemini",
      status,
      envKey: config.keySource || "GEMINI_API_KEY",
      canReadEnv: config.length > 0,
      canListModels,
      canCallGenerateContent,
      message,
      recommendedAction,
      technicalDetails: { errorCode, errorMessage: errorMsg, timestamp }
    };
  }
}

/**
 * Functional test for an API key before saving
 */
export async function testGeminiConnection(providedKey?: string) {
  const result = await checkGeminiHealth(providedKey);
  return {
    success: result.status === "connected",
    message: result.message,
    timestamp: new Date().toISOString(),
    details: result
  };
}
