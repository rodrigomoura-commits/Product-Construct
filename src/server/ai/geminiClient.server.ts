import { GoogleGenAI } from "@google/genai";

const apiKey =
  process.env.GEMINI_API_KEY_MANUAL ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.warn("[Gemini] Missing GEMINI_API_KEY.");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export function getCandidateGeminiModels() {
  return [
    process.env.GEMINI_MODEL,
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite"
  ].filter(Boolean) as string[];
}

export async function generateJsonWithGemini({
  prompt,
  schemaHint,
  maxOutputTokens = 8192
}: {
  prompt: string;
  schemaHint?: string;
  maxOutputTokens?: number;
}) {
  if (!ai) {
    throw new Error("GEMINI_API_KEY_MISSING");
  }

  const models = getCandidateGeminiModels();

  let lastError: any = null;

  for (const model of models) {
    try {
      // @google/genai v2 pattern: ai.models.generateContent
      const response = await (ai as any).models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${prompt}\n\n${schemaHint || ""}`
              }
            ]
          }
        ],
        config: {
          temperature: 0.2,
          maxOutputTokens,
          responseMimeType: "application/json"
        }
      });

      // The response structure in @google/genai v2
      // Usually it's response.text() or response.candidates[0].content.parts[0].text
      // The user's snippet uses response.text
      const text = typeof (response as any).text === 'function' 
        ? (response as any).text() 
        : (response as any).text || "";

      try {
        return {
          model,
          json: JSON.parse(cleanJsonText(text)),
          raw: text
        };
      } catch (parseError: any) {
        throw new Error(
          `AI_JSON_PARSE_FAILED: ${parseError?.message || String(parseError)}`
        );
      }
    } catch (error: any) {
      lastError = error;

      const message = String(error?.message || error);

      const isModelUnavailable =
        message.includes("NOT_FOUND") ||
        message.includes("no longer available") ||
        message.includes("404") ||
        message.includes("not found");

      if (isModelUnavailable) {
        console.warn(`[Gemini] Model unavailable, trying next: ${model}`, message);
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error("NO_GEMINI_MODEL_AVAILABLE");
}

function cleanJsonText(text: string) {
  return text
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
}
