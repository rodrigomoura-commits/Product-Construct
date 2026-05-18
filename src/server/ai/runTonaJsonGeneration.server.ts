
import { generateJsonWithGemini } from "./geminiClient.server";

export async function runTonaJsonGeneration(prompt: string) {
  if (prompt.length > 50000) {
    throw new Error(`PROMPT_TOO_LARGE:${prompt.length}`);
  }

  const result = await generateJsonWithGemini({
    prompt,
    maxOutputTokens: 8192
  });

  return result.json;
}
