export function removeStaleMaturityMentions(text: string) {
  return String(text || "")
    .replace(/Maturidade em\s*\d{1,3}%\.?/gi, "")
    .replace(/maturidade em\s*\d{1,3}%\.?/gi, "")
    .replace(/com\s*\d{1,3}%\s*de maturidade\.?/gi, "")
    .replace(/já possui\s*\d+\s*itens salvos\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanConversationSummaryForDisplay(text: string) {
  if (!text) return "";
  
  return removeStaleMaturityMentions(text)
    .replace(/Usuário respondeu:/gi, "")
    .replace(/Tona orientou:/gi, "")
    .replace(/\*\*/g, "")
    .trim();
}
