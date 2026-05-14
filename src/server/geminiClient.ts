import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * GEMINI CLIENT HELPER
 * Centralizes authentication and validation for Google Generative AI.
 */

export function getGeminiClient() {
  const keysWithNames = [
    { name: 'GEMINI_API_KEY', value: process.env.GEMINI_API_KEY },
    { name: 'VITE_GEMINI_API_KEY', value: process.env.VITE_GEMINI_API_KEY },
    { name: 'GOOGLE_API_KEY', value: process.env.GOOGLE_API_KEY },
    { name: 'API_KEY', value: process.env.API_KEY },
    { name: 'NEXT_PUBLIC_GEMINI_API_KEY', value: process.env.NEXT_PUBLIC_GEMINI_API_KEY }
  ];

  // Find the first key that is not empty and not a placeholder string
  let found = keysWithNames.find(k => typeof k.value === 'string' && k.value.trim().length >= 5 && k.value !== 'undefined' && k.value !== 'null');
  let apiKey = found?.value;
  let keySource = found?.name || 'NONE';

  if (!apiKey) {
    const availableNames = keysWithNames.filter(k => k.value).map(k => k.name);
    console.error(`CRITICAL: No valid Gemini API Key found. Found variables but they were invalid: ${availableNames.join(', ')}`);
    throw new Error("Gemini API Key is missing or invalid. Please configure GEMINI_API_KEY in the Secrets panel.");
  }

  // Remove potential quotes
  let trimmed = apiKey.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1);
  }

  // Check if it's a placeholder from .env.example
  if (trimmed === 'MY_GEMINI_API_KEY') {
    console.error(`CRITICAL: Gemini API Key is still set to placeholder 'MY_GEMINI_API_KEY' from ${keySource}`);
    throw new Error("Gemini API Key is using a placeholder value. Please set a real key in the Secrets panel.");
  }

  const status = trimmed.startsWith('AIza') ? 'OK' : 'INVALID_PREFIX';
  console.log(`[GeminiClient] Using key from ${keySource} (Length: ${trimmed.length}, Prefix: ${status}, Preview: ${trimmed.slice(0, 4)}...${trimmed.slice(-4)})`);

  return new GoogleGenerativeAI(trimmed);
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

  return {
    configured: Boolean(finalKey && finalKey.length >= 5 && finalKey !== 'MY_GEMINI_API_KEY'),
    keySource,
    keyPreview: finalKey
      ? `${finalKey.slice(0, 4)}...${finalKey.slice(-4)}`
      : null,
    length: finalKey ? finalKey.length : 0,
    prefixOk: finalKey ? finalKey.startsWith('AIza') : false,
    isPlaceholder: finalKey === 'MY_GEMINI_API_KEY'
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
