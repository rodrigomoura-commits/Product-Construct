import { callGeminiProxy } from "./geminiProxy";

export async function generateStageClosureWithAI({
  product,
  stage,
  fields,
  productMemories,
  conversationMemories,
  stageMessages
}: {
  product: any;
  stage: any;
  fields: any[];
  productMemories: any[];
  conversationMemories: any[];
  stageMessages: any[];
}) {
  const stageKey = stage.stage_key || stage.id;

  const inputPack = {
    product: {
      id: product.id,
      name: product.name || product.title || "Produto sem nome",
      description: product.description || ""
    },
    stage: {
      key: stageKey,
      name: stage.name || stage.label || stageKey,
      progress: stage.progress || 100
    },
    fields: fields.map((item) => ({
      id: item.id,
      label: item.label,
      value: item.value,
      classification: item.classification,
      confidence: item.confidence
    })),
    product_memories: productMemories.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      memory_type: item.memory_type,
      confidence: item.confidence
    })),
    conversation_memories: conversationMemories.map((item) => ({
      id: item.id,
      summary: item.conversation_summary,
      pending_question: item.pending_question,
      next_best_action: item.next_best_action
    })),
    recent_messages: stageMessages.slice(-30).map((item) => ({
      role: item.role,
      content: item.content
    }))
  };

  const prompt = `
Você é a Tona, copiloto sênior de construção de produto.

Sua tarefa é gerar uma síntese executiva de fechamento da etapa "${stage.name || stageKey}" do produto "${product.name || product.title}".

Leia todas as memórias, decisões, hipóteses, fatos, evidências, mensagens e resumos fornecidos.

Regras:
- Não copie o histórico bruto.
- Não concatene listas.
- Não mencione "usuário respondeu" ou "Tona orientou".
- Transforme a conversa em síntese clara, limpa e executiva.
- Separe decisões, hipóteses, fatos/evidências, riscos e pendências.
- Se algo estiver pouco comprovado, classifique como hipótese ou pendência, não como fato.
- Não invente evidências.
- Use linguagem profissional, objetiva e fácil de ler.
- O resumo executivo deve ter no máximo 900 caracteres.
- Cada item deve ter título curto e descrição útil.
- Retorne apenas JSON válido conforme o formato obrigatório.

Formato obrigatório:
{
  "title": "...",
  "executive_summary": "...",
  "problem_understanding": "...",
  "target_customer": "...",
  "evidence_summary": "...",
  "decision_summary": "...",
  "open_questions_summary": "...",
  "decisions": [{"title": "...", "description": "...", "confidence": 0.9}],
  "hypotheses": [{"title": "...", "description": "...", "validation_needed": "...", "confidence": 0.7}],
  "facts": [{"title": "...", "description": "...", "strength": "high"}],
  "risks": [{"title": "...", "description": "...", "mitigation_hint": "...", "severity": "medium"}],
  "pending_points": [{"title": "...", "description": "...", "suggested_action": "..."}],
  "recommended_next_step": {
    "title": "...",
    "description": "...",
    "next_stage": "shape"
  }
}

DADOS:
${JSON.stringify(inputPack, null, 2)}
`;

  const aiResultString = await callGeminiProxy({
    prompt,
    useCase: "stage_closure_generation",
    productId: product.id,
    stageId: stageKey,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2
    }
  });

  let aiResult: any;
  try {
    aiResult = JSON.parse(aiResultString);
  } catch (error) {
    const cleaned = aiResultString
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    aiResult = JSON.parse(cleaned);
  }

  return sanitizeStageClosure(aiResult, {
    product,
    stage
  });
}

function asArray(value: any) {
  return Array.isArray(value) ? value : [];
}

function limitText(value: any, max: number) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

function sanitizeStageClosure(aiResult: any, { product, stage }: any) {
  const stageKey = stage.stage_key || stage.id;
  
  return {
    product_id: product.id,
    stage_id: stageKey,
    synthesis_type: "stage_closure",
    status: "active",

    title: limitText(aiResult.title || `Etapa ${stage.name || stageKey} consolidada`, 120),
    executive_summary: limitText(aiResult.executive_summary, 900),

    problem_understanding: limitText(aiResult.problem_understanding, 700),
    target_customer: limitText(aiResult.target_customer, 500),
    evidence_summary: limitText(aiResult.evidence_summary, 700),
    decision_summary: limitText(aiResult.decision_summary, 700),
    open_questions_summary: limitText(aiResult.open_questions_summary, 700),

    decisions: asArray(aiResult.decisions).slice(0, 8),
    hypotheses: asArray(aiResult.hypotheses).slice(0, 8),
    facts: asArray(aiResult.facts).slice(0, 8),
    risks: asArray(aiResult.risks).slice(0, 6),
    pending_points: asArray(aiResult.pending_points).slice(0, 6),

    recommended_next_step: aiResult.recommended_next_step || {
      title: "Avançar para próxima etapa",
      description: "A etapa foi consolidada e está pronta para seguir.",
      next_stage: "shape"
    },

    generated_by: "tona"
  };
}
