
/**
 * Normaliza qualquer valor para uma string segura.
 * Útil para blindar a UI contra dados malformados vindo do banco.
 */
export function safeText(value: unknown): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") return value;

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map(item => safeText(item))
      .filter(Boolean)
      .join(" ");
  }

  if (typeof value === "object") {
    const obj = value as Record<string, any>;

    // Tenta encontrar campos comuns que poderiam conter o texto desejado
    return (
      safeText(obj.learning) ||
      safeText(obj.content) ||
      safeText(obj.text) ||
      safeText(obj.summary) ||
      safeText(obj.description) ||
      safeText(obj.value) ||
      JSON.stringify(obj)
    );
  }

  return String(value);
}

/**
 * Normaliza e converte para minúsculas para buscas seguras.
 */
export function toSearchableText(value: unknown): string {
  return safeText(value).toLowerCase();
}
