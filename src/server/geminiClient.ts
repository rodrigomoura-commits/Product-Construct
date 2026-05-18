import { GoogleGenAI } from "@google/genai";
import { resolveGeminiModel, getGeminiModelConfig } from "./geminiModelResolver";

const FALLBACK_MODEL = "gemini-1.5-flash";

/**
 * SECURE API KEY RETRIEVAL
 * Only reads from backend process.env.
 * Returns null if missing, throws if placeholder found.
 */
const PLACEHOLDERS = [
  "MY_GEMINI_API_KEY",
  "YOUR_API_KEY",
  "PLACEHOLDER",
  "COLE_SUA_CHAVE_AQUI",
  "INSIRA_SUA_CHAVE_AQUI",
  "Gemini API Key is using a placeholder value"
];

function normalizeSecret(value?: string | null) {
  if (!value) return null;
  let trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1);
  }
  return trimmed;
}

function isPlaceholder(value?: string | null) {
  const normalized = normalizeSecret(value);
  if (!normalized) return false;
  return PLACEHOLDERS.some(p => normalized.toUpperCase().includes(p.toUpperCase()));
}

function isLikelyGeminiKey(value?: string | null) {
  const normalized = normalizeSecret(value);
  return Boolean(normalized && normalized.startsWith("AIza") && normalized.length > 20);
}

export function resolveGeminiApiKey() {
  const candidates = [
    { name: "GEMINI_API_KEY_MANUAL", value: process.env.GEMINI_API_KEY_MANUAL },
    { name: "GOOGLE_GENERATIVE_AI_API_KEY", value: process.env.GOOGLE_GENERATIVE_AI_API_KEY },
    { name: "GOOGLE_API_KEY", value: process.env.GOOGLE_API_KEY },
    { name: "API_KEY", value: process.env.API_KEY },
    { name: "GEMINI_API_KEY", value: process.env.GEMINI_API_KEY }
  ];

  const diagnostics = candidates.map(c => ({
    name: c.name,
    exists: Boolean(c.value && c.value.trim()),
    isPlaceholder: isPlaceholder(c.value),
    prefixOk: Boolean(normalizeSecret(c.value)?.startsWith("AIza")),
    length: normalizeSecret(c.value)?.length || 0
  }));

  const found = candidates.find(c => {
    const normalized = normalizeSecret(c.value);
    return normalized &&
      normalized.length > 20 &&
      !isPlaceholder(normalized) &&
      normalized.startsWith("AIza");
  });

  if (!found) {
    const hasPlaceholder = candidates.some(c => isPlaceholder(c.value));
    const error = new Error(
      hasPlaceholder
        ? "No valid Gemini API key found. GEMINI_API_KEY appears to be a placeholder. Add GEMINI_API_KEY_MANUAL with a real AIza key."
        : "No valid Gemini API key found."
    );
    (error as any).code = hasPlaceholder ? "PLACEHOLDER_KEY" : "MISSING_KEY";
    (error as any).diagnostics = diagnostics;
    throw error;
  }

  return {
    apiKey: normalizeSecret(found.value)!,
    keySource: found.name,
    diagnostics
  };
}

/**
 * SECURE SECRET MASKING
 */
export function maskSecret(secret: string | null | undefined) {
  if (!secret) return null;
  if (secret.length <= 8) return "********";
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

/**
 * GEMINI CLIENT HELPER
 */
export function getGeminiClient(providedKey?: string) {
  const apiKey = providedKey
    ? normalizeSecret(providedKey)
    : resolveGeminiApiKey().apiKey;

  if (!apiKey || isPlaceholder(apiKey) || !isLikelyGeminiKey(apiKey)) {
    throw new Error("Gemini API Key is missing, placeholder, or invalid.");
  }

  return new GoogleGenAI({ apiKey });
}

/**
 * Asserts if Gemini is properly configured without exposing the full key.
 */
export function assertGeminiConfigured() {
  try {
    const resolved = resolveGeminiApiKey();
    return {
      configured: true,
      keyExists: true,
      keyValid: true,
      keySource: resolved.keySource,
      keyPreview: `${resolved.apiKey.slice(0, 4)}...${resolved.apiKey.slice(-4)}`,
      length: resolved.apiKey.length,
      prefixOk: resolved.apiKey.startsWith("AIza"),
      isPlaceholder: false,
      diagnostics: resolved.diagnostics
    };
  } catch (e: any) {
    const diagnostics = e.diagnostics || [];
    const placeholderCandidate = diagnostics.find((d: any) => d.isPlaceholder);
    const anyCandidate = diagnostics.find((d: any) => d.exists);

    return {
      configured: false,
      keyExists: Boolean(anyCandidate),
      keyValid: false,
      keySource: anyCandidate?.name || "NONE",
      keyPreview: null,
      length: anyCandidate?.length || 0,
      prefixOk: false,
      isPlaceholder: Boolean(placeholderCandidate),
      errorType: e.code === "PLACEHOLDER_KEY" ? "placeholder_key" : "missing_key",
      diagnostics
    };
  }
}

/**
 * Health check for the LLM Provider
 */
export async function checkGeminiHealth(providedKey?: string) {
  const config = assertGeminiConfigured();
  const timestamp = new Date().toISOString();
  // Resolve current model
  const configuredModel = await resolveGeminiModel({ useCase: "chat" });

  if (!providedKey) {
    if (config.errorType === "placeholder_key") {
      return {
        provider: "google_gemini",
        status: "placeholder_key",
        envKey: "GEMINI_API_KEY",
        keyExists: true,
        keyValid: false,
        keyFound: true,
        keySource: config.keySource,
        keyPreview: null,
        configuredModel,
        canReadEnv: true,
        canListModels: false,
        canCallGenerateContent: false,
        message: "A GEMINI_API_KEY encontrada no ambiente é um placeholder.",
        recommendedAction: "Substitua a GEMINI_API_KEY no painel de Secrets por uma chave real do Google AI Studio.",
        technicalDetails: { timestamp, errorCode: "PLACEHOLDER_KEY" }
      };
    }

    if (config.errorType === "invalid_key_format") {
       return {
        provider: "google_gemini",
        status: "invalid_key_format",
        envKey: "GEMINI_API_KEY",
        keyExists: true,
        keyValid: false,
        keyFound: true,
        keySource: config.keySource,
        keyPreview: null,
        configuredModel,
        canReadEnv: true,
        canListModels: false,
        canCallGenerateContent: false,
        message: "A GEMINI_API_KEY encontrada tem formato inválido.",
        recommendedAction: "Use uma chave real do Google AI Studio, normalmente começando com AIza.",
        technicalDetails: { timestamp, errorCode: "INVALID_KEY_FORMAT" }
      };
    }

    if (config.errorType === "missing_key") {
      return {
        provider: "google_gemini",
        status: "missing_key",
        envKey: "GEMINI_API_KEY",
        keyExists: false,
        keyValid: false,
        keyFound: false,
        keySource: "NONE",
        keyPreview: null,
        configuredModel,
        canReadEnv: false,
        canListModels: false,
        canCallGenerateContent: false,
        message: "GEMINI_API_KEY não foi encontrada no ambiente.",
        recommendedAction: "Adicione uma GEMINI_API_KEY válida nas variáveis de ambiente do deploy.",
        technicalDetails: { timestamp, errorCode: "MISSING_KEY" }
      };
    }
  }

  let status: any = "unknown_error";
  let message = "Erro ao validar integração.";
  let recommendedAction = "Verifique os detalhes técnicos e a configuração do ambiente.";
  let availableModels: any[] = [];
  let canListModels = false;
  let canCallGenerateContent = false;

  try {
    const ai = getGeminiClient(providedKey);
    
    // 2. List Models
    try {
      const response = await (ai as any).models.list();
      availableModels = (response.models || []).map((m: any) => ({
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
          keyFound: true,
          keySource: "environment",
          keyPreview: config.keyPreview,
          canReadEnv: true,
          canListModels: false,
          canCallGenerateContent: false,
          message: "API Key inválida ou recusada pelo Google.",
          recommendedAction: "Verifique se a chave foi copiada corretamente do Google AI Studio.",
          technicalDetails: { timestamp, errorCode: "INVALID_KEY", errorMessage: errMsg }
        };
      }
      throw err;
    }

    // 3. Ping Test
    try {
      await (ai as any).models.generateContent({
        model: configuredModel,
        contents: [{ role: "user", parts: [{ text: "ping" }] }]
      });
      canCallGenerateContent = true;
      status = "connected";
      message = "Google Gemini configurado e respondendo.";
      recommendedAction = "Nenhuma ação necessária.";
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      return {
        provider: "google_gemini",
        status: "error",
        keyFound: true,
        keyPreview: config.keyPreview,
        canReadEnv: true,
        canListModels: true,
        canCallGenerateContent: false,
        message: "Erro ao realizar chamada de teste (ping).",
        recommendedAction: "Verifique se o seu projeto possui quota disponível.",
        technicalDetails: { timestamp, errorCode: "PING_FAILED", errorMessage: errMsg }
      };
    }

    const modelConfig = await getGeminiModelConfig();

    return {
      provider: "google_gemini",
      status,
      keyFound: true,
      keyExists: config.keyExists,
      keyValid: config.keyValid,
      keySource: "environment",
      keyPreview: config.keyPreview,
      keyLength: config.length,
      modelEnvKey: "GEMINI_MODEL",
      configuredModel,
      modelSource: modelConfig.source,
      envModel: modelConfig.envModel,
      fallbackModel: modelConfig.fallbackModel,
      canReadEnv: true,
      canListModels,
      canCallGenerateContent,
      message,
      recommendedAction,
      availableModels: availableModels.filter(m => m.supportedGenerationMethods?.includes('generateContent')),
      technicalDetails: { timestamp }
    };

  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    return {
      provider: "google_gemini",
      status: "error",
      keyFound: config.keyExists,
      keyValid: config.keyValid,
      keyPreview: config.keyPreview,
      message: "Erro inesperado na integração.",
      technicalDetails: { errorMessage: errorMsg, timestamp }
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
