
const TECHNICAL_PATTERNS = [
  /retome a conversa a partir do último estado salvo/gi,
  /usuário respondeu:/gi,
  /tona orientou:/gi,
  /maturidade em\s*\d{1,3}%/gi,
  /já possui\s*\d+\s*itens salvos/gi,
  /payloadtoolargeerror/gi,
  /missing or insufficient permissions/gi,
  /unexpected token/gi,
  /<!doctype html[\s\S]*/gi
];

export function normalizeText(value: any) {
  let text = String(value || "");

  text = text
    .replace(/<!DOCTYPE[\s\S]*/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();

  for (const pattern of TECHNICAL_PATTERNS) {
    text = text.replace(pattern, " ");
  }

  return text.replace(/\s+/g, " ").trim();
}

export function limitText(value: any, max = 700) {
  const text = normalizeText(value);
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + "...";
}

function classifyItem(item: any) {
  const raw = [
    item.type,
    item.classification,
    item.memory_type,
    item.category,
    item.label,
    item.title,
    item.name
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (raw.includes("decision") || raw.includes("decisão")) return "decision";
  if (raw.includes("hypothesis") || raw.includes("hipótese")) return "hypothesis";
  if (raw.includes("fact") || raw.includes("evidência") || raw.includes("evidence")) return "fact";
  if (raw.includes("risk") || raw.includes("risco")) return "risk";
  if (raw.includes("pending") || raw.includes("lacuna") || raw.includes("pendência")) return "pending";
  if (raw.includes("customer") || raw.includes("persona") || raw.includes("cliente")) return "customer";

  return "general";
}

function scoreItem(item: any) {
  const text = normalizeText(
    item.value ||
    item.content ||
    item.description ||
    item.summary ||
    item.title ||
    item.label ||
    ""
  );

  let score = 0;

  if (item.is_confirmed === true) score += 5;
  if (item.status === "confirmed") score += 5;
  if (item.confidence && Number(item.confidence) >= 0.7) score += 3;
  if (item.updated_at || item.updated_at_ms) score += 2;
  if (text.length > 80) score += 2;
  if (text.length > 300) score += 1;

  const type = classifyItem(item);

  if (type === "decision") score += 6;
  if (type === "fact") score += 5;
  if (type === "hypothesis") score += 4;
  if (type === "risk") score += 3;
  if (type === "pending") score += 3;
  if (type === "customer") score += 3;

  return score;
}

function dedupeByNormalizedText(items: any[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const text = normalizeText(
      item.value ||
      item.content ||
      item.description ||
      item.summary ||
      item.title ||
      item.label ||
      ""
    ).toLowerCase();

    const key = text.slice(0, 220);

    if (!key || key.length < 8) return false;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function compactField(item: any) {
  const type = classifyItem(item);

  return {
    type,
    title: limitText(item.title || item.label || item.name || type, 120),
    value: limitText(
      item.value || item.content || item.description || item.summary || "",
      700
    ),
    status: item.status || null,
    confidence: item.confidence || null
  };
}

function compactMessage(message: any) {
  const content = limitText(message.content || message.text || "", 500);

  if (!content) return null;

  return {
    role: message.role || "unknown",
    content
  };
}

function compactMemory(memory: any) {
  const summary = limitText(
    memory.stage_summary ||
    memory.conversation_summary ||
    memory.summary ||
    memory.content ||
    "",
    800
  );

  if (!summary) return null;

  return {
    summary,
    pending_question: limitText(memory.pending_question || "", 220),
    next_best_action: limitText(memory.next_best_action || "", 220)
  };
}

function splitByType(fields: any[]) {
  const buckets: Record<string, any[]> = {
    decision: [],
    hypothesis: [],
    fact: [],
    risk: [],
    pending: [],
    customer: [],
    general: []
  };

  for (const field of fields) {
    const type = classifyItem(field);
    buckets[type].push(field);
  }

  for (const key of Object.keys(buckets)) {
    buckets[key] = dedupeByNormalizedText(buckets[key])
      .sort((a, b) => scoreItem(b) - scoreItem(a));
  }

  return buckets;
}

export function estimateSize(value: any) {
  return JSON.stringify(value).length;
}

export function buildStageClosureCompactPayload({
  product,
  stage,
  fields = [],
  messages = [],
  memories = [],
  artifacts = [],
  documents = []
}: any) {
  const buckets = splitByType(fields);

  const selectedFields = [
    ...buckets.decision.slice(0, 8),
    ...buckets.fact.slice(0, 8),
    ...buckets.hypothesis.slice(0, 8),
    ...buckets.customer.slice(0, 4),
    ...buckets.risk.slice(0, 4),
    ...buckets.pending.slice(0, 4),
    ...buckets.general.slice(0, 6)
  ]
    .sort((a, b) => scoreItem(b) - scoreItem(a))
    .slice(0, 35)
    .map(compactField)
    .filter((item) => item.value || item.title);

  const selectedMessages = dedupeByNormalizedText(messages)
    .slice(-12)
    .map(compactMessage)
    .filter(Boolean);

  const selectedMemories = dedupeByNormalizedText(memories)
    .slice(0, 6)
    .map(compactMemory)
    .filter(Boolean);

  const selectedArtifacts = (artifacts || [])
    .slice(0, 8)
    .map((artifact: any) => ({
      title: limitText(artifact.title || artifact.name || "", 100),
      type: artifact.type || null,
      summary: limitText(artifact.summary || artifact.description || "", 400)
    }))
    .filter((item: any) => item.title || item.summary);

  const selectedDocuments = (documents || [])
    .slice(0, 8)
    .map((document: any) => ({
      title: limitText(document.title || document.name || document.filename || "", 100),
      type: document.type || document.mime_type || null,
      summary: limitText(document.summary || document.description || "", 400)
    }))
    .filter((item: any) => item.title || item.summary);

  return {
    product: {
      id: product.id,
      name: limitText(product.name || product.title || "Produto sem nome", 120),
      description: limitText(product.description || "", 500)
    },
    stage: {
      key: stage.stage_key || stage.id,
      name: limitText(stage.name || stage.label || stage.stage_key || stage.id, 120),
      status: stage.status || null,
      progress: stage.progress || stage.maturity || null
    },
    structured_knowledge: selectedFields,
    stage_memories: selectedMemories,
    recent_conversation: selectedMessages,
    artifacts: selectedArtifacts,
    documents: selectedDocuments,
    counts: {
      raw_fields: fields.length,
      selected_fields: selectedFields.length,
      raw_messages: messages.length,
      selected_messages: selectedMessages.length,
      raw_memories: memories.length,
      selected_memories: selectedMemories.length
    }
  };
}

export function hardTrimPayload(payload: any, maxChars = 18000) {
  const clone = JSON.parse(JSON.stringify(payload));

  while (estimateSize(clone) > maxChars) {
    if (clone.recent_conversation?.length > 4) {
      clone.recent_conversation = clone.recent_conversation.slice(-4);
      continue;
    }

    if (clone.stage_memories?.length > 2) {
      clone.stage_memories = clone.stage_memories.slice(0, 2);
      continue;
    }

    if (clone.documents?.length > 3) {
      clone.documents = clone.documents.slice(0, 3);
      continue;
    }

    if (clone.artifacts?.length > 3) {
      clone.artifacts = clone.artifacts.slice(0, 3);
      continue;
    }

    if (clone.structured_knowledge?.length > 16) {
      clone.structured_knowledge = clone.structured_knowledge.slice(0, 16);
      continue;
    }

    break;
  }

  return clone;
}
