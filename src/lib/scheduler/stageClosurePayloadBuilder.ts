function normalizeText(value: any) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/Usuário respondeu:/gi, "")
    .replace(/Tona orientou:/gi, "")
    .replace(/maturidade em\s*\d{1,3}%\.?/gi, "")
    .replace(/com\s*\d{1,3}%\s*de maturidade\.?/gi, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function limitText(value: any, max = 800) {
  const text = normalizeText(value);

  if (text.length <= max) return text;

  return `${text.slice(0, max).trim()}...`;
}

function compactField(item: any) {
  return {
    id: item.id || null,
    label: limitText(item.label || item.title || item.name || "", 120),
    value: limitText(item.value || item.content || item.description || item.summary || "", 600),
    type: item.classification || item.type || item.memory_type || null
  };
}

function compactMessage(message: any) {
  return {
    role: message.role || "unknown",
    content: limitText(message.content || message.text || "", 500)
  };
}

function compactMemory(memory: any) {
  return {
    id: memory.id || null,
    summary: limitText(memory.conversation_summary || memory.summary || "", 700),
    pending_question: limitText(memory.pending_question || "", 250),
    next_best_action: limitText(memory.next_best_action || "", 250)
  };
}

function dedupeByText(items: any[], selector: (item: any) => string) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = normalizeText(selector(item)).toLowerCase();

    if (!key) return false;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

export function estimatePayloadSize(payload: any) {
  return JSON.stringify(payload).length;
}

export function buildCompactStageClosurePayload({
  product,
  stage,
  fields,
  messages,
  conversationMemories
}: any) {
  const compactFields = dedupeByText(fields || [], (item) =>
    item.value || item.content || item.description || item.summary || item.title || item.label
  )
    .slice(0, 30)
    .map(compactField);

  const compactMemories = dedupeByText(conversationMemories || [], (item) =>
    item.conversation_summary || item.summary || item.pending_question
  )
    .slice(0, 5)
    .map(compactMemory);

  const compactMessages = dedupeByText(messages || [], (item) =>
    item.content || item.text
  )
    .slice(-12)
    .map(compactMessage)
    .filter((item) => item.content);

  return {
    product: {
      id: product.id,
      name: limitText(product.name || product.title || "Produto sem nome", 120),
      description: limitText(product.description || "", 400)
    },
    stage: {
      key: stage.stage_key || stage.id,
      name: limitText(stage.name || stage.label || stage.stage_key || stage.id, 120),
      status: stage.status || null,
      progress: stage.progress || 0
    },
    fields: compactFields,
    conversation_summaries: compactMemories,
    recent_messages: compactMessages
  };
}

export function trimPayloadToSafeSize(payload: any, maxChars = 25000) {
  const safePayload = structuredClone(payload);

  while (estimatePayloadSize(safePayload) > maxChars) {
    if (safePayload.recent_messages?.length > 4) {
      safePayload.recent_messages = safePayload.recent_messages.slice(-4);
      continue;
    }

    if (safePayload.conversation_summaries?.length > 2) {
      safePayload.conversation_summaries = safePayload.conversation_summaries.slice(0, 2);
      continue;
    }

    if (safePayload.fields?.length > 15) {
      safePayload.fields = safePayload.fields.slice(0, 15);
      continue;
    }

    break;
  }

  return safePayload;
}
