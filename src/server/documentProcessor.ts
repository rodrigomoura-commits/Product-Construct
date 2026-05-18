import { adminDb } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import admin from "firebase-admin";
import { getGeminiClient } from "./geminiClient";
import { resolveGeminiModel } from "./geminiModelResolver";
import { extractTextFromDocument, sanitizeExtractedText, chunkText } from "./documentTextExtractor";

export async function processProductDocument(params: {
  productId: string;
  documentId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  stageKey?: string;
  autoAddToMemory: boolean;
  userId: string;
  userEmail: string;
  userName?: string;
}) {
  const { productId, documentId, storagePath, fileName, mimeType, stageKey, autoAddToMemory, userId, userEmail, userName } = params;
  const docRef = adminDb.collection("products").doc(productId).collection("documents").doc(documentId);

  try {
    // 1. Update status: extracting_text
    await docRef.update({ 
      status: "extracting_text",
      updated_at: FieldValue.serverTimestamp()
    });

    // 2. Download from Storage
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [buffer] = await file.download();

    // 3. Extract text
    let text = await extractTextFromDocument(buffer, mimeType, fileName);
    text = sanitizeExtractedText(text);

    if (!text.trim()) {
      throw new Error("Não conseguimos extrair texto deste documento. Verifique se o arquivo não é imagem escaneada.");
    }

    const charCount = text.length;
    const textPreview = text.substring(0, 500);

    // 4. Save chunks
    const chunks = chunkText(text);
    const chunksColl = docRef.collection("chunks");
    for (let i = 0; i < chunks.length; i++) {
       await chunksColl.doc(`chunk_${i}`).set({
         chunk_index: i,
         text: chunks[i],
         char_count: chunks[i].length,
         created_at: FieldValue.serverTimestamp()
       });
    }

    await docRef.update({
      extracted_text_preview: textPreview,
      extracted_text_char_count: charCount,
      status: "processing_ai",
      updated_at: FieldValue.serverTimestamp()
    });

    // 5. AI Analysis
    const model = await resolveGeminiModel({
      useCase: "document_analysis",
      productId,
      stageId: stageKey,
      agentId: "tona_document_reader"
    });

    const ai = getGeminiClient() as any;
    
    // For MVP, we'll analyze the first chunk or combine first few if they fit
    // In a more robust version, we'd analyze all chunks and merge.
    const analysisPrompt = `Você é a Tona, copilota sênior de construção de produto.

Analise este documento para o produto:
Documento: ${fileName}
Etapa ativa: ${stageKey || "discovery"}

Sua tarefa é extrair inteligência do documento para alimentar a jornada do produto.

Classifique cada item como:
- fact: algo afirmado como fato no documento;
- hypothesis: hipótese, suposição ou ideia ainda não validada;
- evidence: dado, quote, métrica ou sinal que sustenta algum ponto;
- decision: decisão tomada ou recomendada explicitamente;
- risk: risco, problema, dependência ou alerta;
- gap: lacuna de informação ou pergunta pendente;
- learning: aprendizado útil para o produto;
- recommendation: próximo passo sugerido.

Regras:
- Não invente nada.
- Use APENAS o conteúdo fornecido.
- Separe fato de opinião.
- Seja concisa porém profunda.
- Retorne JSON válido seguindo exatamente este esquema:
{
  "summary": "Resumo executivo do documento (3-6 linhas).",
  "items": [
    {
      "type": "fact | hypothesis | evidence | decision | risk | gap | learning | recommendation",
      "title": "Título curto e direto",
      "content": "Explicação detalhada",
      "confidence": "low | medium | high",
      "stage_key": "sense | shape | sketch | scope | ship | sense_plus",
      "source_quote": "Trecho literal do documento que originou este item"
    }
  ],
  "recommended_next_step": "Ação concreta após ler este documento."
}

CONTEÚDO DO DOCUMENTO:
${chunks[0].substring(0, 30000)}
`;

    const result = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const analysis = JSON.parse(result.text || "{}");
    
    // 6. Save extractions
    const extractionsColl = docRef.collection("extractions");
    const items = analysis.items || [];
    
    const count = {
      facts: 0,
      hypotheses: 0,
      evidence: 0,
      decisions: 0,
      risks: 0,
      gaps: 0,
      learnings: 0
    };

    const batch = adminDb.batch();

    for (const item of items) {
      const extId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const extRef = extractionsColl.doc(extId);
      
      const extraction = {
        id: extId,
        document_id: documentId,
        product_id: productId,
        type: item.type,
        title: item.title,
        content: item.content,
        confidence: item.confidence || "medium",
        stage_key: item.stage_key || stageKey,
        source_quote: item.source_quote,
        should_add_to_memory: autoAddToMemory && (item.confidence === "high" || item.confidence === "medium"),
        memory_status: "pending",
        created_at: FieldValue.serverTimestamp()
      };

      batch.set(extRef, extraction);

      // Map counts
      if (item.type === "fact") count.facts++;
      else if (item.type === "hypothesis") count.hypotheses++;
      else if (item.type === "evidence") count.evidence++;
      else if (item.type === "decision") count.decisions++;
      else if (item.type === "risk") count.risks++;
      else if (item.type === "gap") count.gaps++;
      else if (item.type === "learning") count.learnings++;

      // 7. Auto add to memory if requested
      if (extraction.should_add_to_memory) {
         const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
         const memoryRef = adminDb.collection("products").doc(productId).collection("memory_items").doc(memoryId);
         
         batch.set(memoryRef, {
           id: memoryId,
           product_id: productId,
           classification: item.type,
           title: item.title,
           content: item.content,
           source: "document",
           source_document_id: documentId,
           source_document_name: fileName,
           source_quote: item.source_quote,
           stage_key: item.stage_key || stageKey,
           confidence: item.confidence || "medium",
           created_by: "tona_document_reader",
           created_by_user_id: userId,
           created_by_email: userEmail,
           created_at: FieldValue.serverTimestamp(),
           updated_at: FieldValue.serverTimestamp()
         });

         batch.update(extRef, { memory_status: "added" });
      }
    }

    // 8. Update document Final
    batch.update(docRef, {
      status: "processed",
      ai_summary: analysis.summary,
      ai_status: "completed",
      extracted_items_count: count,
      processed_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    });

    // 9. History event
    const historyId = `hist_${Date.now()}`;
    const historyRef = adminDb.collection("products").doc(productId).collection("history_events").doc(historyId);
    batch.set(historyRef, {
      id: historyId,
      type: "document_processed",
      title: "Documento processado",
      summary: `A Tona extraiu ${items.length} insights do documento ${fileName}.`,
      actor_id: "tona_document_reader",
      document_id: documentId,
      document_name: fileName,
      created_at: FieldValue.serverTimestamp()
    });

    await batch.commit();

  } catch (error: any) {
    console.error(`[DocumentProcessor] Error processing ${documentId}:`, error);
    await docRef.update({
      status: "failed",
      error_message: error.message || "Erro desconhecido no processamento.",
      updated_at: FieldValue.serverTimestamp()
    });
    throw error;
  }
}
