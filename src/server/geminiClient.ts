import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * GEMINI CLIENT HELPER
 * Centralizes authentication and validation for Google Generative AI.
 */

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim().length < 20) {
    throw new Error("GEMINI_API_KEY is missing or invalid in server environment. Please check your configuration.");
  }

  return new GoogleGenerativeAI(apiKey.trim());
}

/**
 * Asserts if Gemini is properly configured without exposing the full key.
 */
export function assertGeminiConfigured() {
  const apiKey = process.env.GEMINI_API_KEY;

  return {
    configured: Boolean(apiKey && apiKey.trim().length >= 20),
    keyPreview: apiKey
      ? `${apiKey.trim().slice(0, 6)}...${apiKey.trim().slice(-4)}`
      : null,
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
