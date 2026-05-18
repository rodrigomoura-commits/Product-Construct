import { getGeminiClient } from "../server/geminiClient";
import { resolveGeminiModel } from "../server/geminiModelResolver";

function stripCodeFence(text: string) {
  return String(text || "")
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

export async function runTonaJsonGeneration(prompt: string) {
  const ai = getGeminiClient() as any;
  const model = await resolveGeminiModel({ useCase: "chat" });

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 4096
    }
  });

  const text =
    typeof response.text === "function"
      ? response.text()
      : response.text || "";

  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(stripCodeFence(text));
  }
}
