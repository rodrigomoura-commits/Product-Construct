import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * GEMINI CLIENT HELPER
 * Centralizes authentication and validation for Google Generative AI.
 */

export function getGeminiClient() {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.VITE_GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.API_KEY,
    process.env.NEXT_PUBLIC_GEMINI_API_KEY
  ];

  // Find the first key that is not empty and not a placeholder string
  let apiKey = keys.find(k => k && k.trim().length >= 5 && k !== 'undefined' && k !== 'null');

  if (!apiKey) {
    console.error("CRITICAL: No valid Gemini API Key found in environment variables.");
    throw new Error("Gemini API Key is missing or invalid. Please configure GEMINI_API_KEY in the Secrets panel.");
  }

  // Remove potential quotes if user accidentally wrapped the secret
  let trimmed = apiKey.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1);
  }

  console.log(`[GeminiClient] Initializing with key: ${trimmed.slice(0, 4)}...${trimmed.slice(-4)} (Length: ${trimmed.length}, Prefix: ${trimmed.startsWith('AIza') ? 'OK' : 'INVALID'})`);

  return new GoogleGenerativeAI(trimmed);
}

/**
 * Asserts if Gemini is properly configured without exposing the full key.
 */
export function assertGeminiConfigured() {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.VITE_GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.API_KEY
  ];

  const apiKey = keys.find(k => k && k.trim().length >= 5 && k !== 'undefined' && k !== 'null');
  const trimmed = apiKey ? apiKey.trim() : null;

  return {
    configured: Boolean(trimmed && trimmed.length >= 5),
    keyPreview: trimmed
      ? `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`
      : null,
    length: trimmed ? trimmed.length : 0,
    prefixOk: trimmed ? trimmed.startsWith('AIza') : false
  };
}

/**
 * Health check for the LLM Provider
 */
export async function checkGeminiHealth() {
  try {
    const config = assertGeminiConfigured();
    if (!config.configured) {
      return {
        provider: "gemini",
        status: "error",
        errorType: "CONFIG_MISSING",
        message: "GEMINI_API_KEY is not configured.",
        ...config
      };
    }

    const ai = getGeminiClient();
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Minimal call
    const result = await model.generateContent("echo ok");
    const text = result.response.text();

    return {
      provider: "gemini",
      status: text.toLowerCase().includes("ok") ? "success" : "degraded",
      message: text.toLowerCase().includes("ok") ? "Provider is healthy" : "Provider returned unexpected response",
      ...config
    };
  } catch (error: any) {
    let errorType = "UNKNOWN_ERROR";
    if (error?.message?.includes("API key not valid")) {
      errorType = "API_KEY_INVALID";
    }

    return {
      provider: "gemini",
      status: "error",
      errorType,
      message: error?.message || String(error),
      ...assertGeminiConfigured()
    };
  }
}
