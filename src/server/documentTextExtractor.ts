import { createRequire } from "module";
const require = createRequire(import.meta.url);

import mammoth from "mammoth";
import Papa from "papaparse";
// pdf-parse is a CJS module that can be tricky to import in ESM.
const pdfParse = require("pdf-parse");

export async function extractTextFromDocument(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const ext = fileName.split('.').pop()?.toLowerCase();

  switch (ext) {
    case "docx":
      return extractDocxText(buffer);
    case "pdf":
      return extractPdfText(buffer);
    case "txt":
    case "md":
    case "markdown":
      return buffer.toString("utf-8");
    case "csv":
      return extractCsvText(buffer);
    default:
      // Fallback to buffer string if mime type looks like text
      if (mimeType.startsWith('text/') || mimeType === 'application/json') {
        return buffer.toString("utf-8");
      }
      throw new Error(`Formato de documento não suportado: ${ext || mimeType}`);
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdf-parse can be tricky with some buffers, ensure it's a standard Buffer
  const data = await pdfParse(buffer);
  return data.text || "";
}

function extractCsvText(buffer: Buffer): string {
  const csv = buffer.toString("utf-8");
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

  if (parsed.errors?.length) {
    console.warn("[DocumentExtractor] CSV parse warnings:", parsed.errors);
  }

  return (parsed.data as any[])
    .map((row, index) => {
      return `Linha ${index + 1}: ` + Object.entries(row)
        .map(([key, value]) => `${key}: ${value}`)
        .join(" | ");
    })
    .join("\n");
}

export function sanitizeExtractedText(text: string): string {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function chunkText(text: string, maxChars = 12000): string[] {
  const chunks: string[] = [];
  let current = "";

  const paragraphs = text.split(/\n{2,}/);
  
  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length > maxChars) {
      if (current.trim()) chunks.push(current.trim());
      current = paragraph;
    } else {
      current += (current ? "\n\n" : "") + paragraph;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  // If even a single paragraph is too large, split it by lines or sentences
  // Simplified: if chunks are still too big, further split them
  return chunks.map(c => {
    if (c.length <= maxChars) return [c];
    const subChunks: string[] = [];
    let sub = "";
    const lines = c.split('\n');
    for (const line of lines) {
      if ((sub + '\n' + line).length > maxChars) {
        if (sub.trim()) subChunks.push(sub.trim());
        sub = line;
      } else {
        sub += (sub ? '\n' : '') + line;
      }
    }
    if (sub.trim()) subChunks.push(sub.trim());
    return subChunks;
  }).flat();
}
