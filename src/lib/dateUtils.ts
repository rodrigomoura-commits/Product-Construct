export function safeToDate(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value?.toDate === "function") {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  if (typeof value?._seconds === "number") {
    return new Date(value._seconds * 1000);
  }

  return null;
}

export function formatSafeDate(value: any, fallback = "Data indisponível") {
  const date = safeToDate(value);

  if (!date) return fallback;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatShortDate(value: any, fallback = "Data indisponível") {
  const date = safeToDate(value);

  if (!date) return fallback;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  }).format(date);
}

export function formatUserDate(value: any, fallback = "Data indisponível") {
  return formatSafeDate(value, fallback);
}

export function formatAuditDate(value: any, fallback = "Data indisponível") {
  return formatSafeDate(value, fallback);
}

export function formatRelativeDate(value: any, fallback = "Data indisponível") {
  // Can just be short date for now as a fallback
  return formatShortDate(value, fallback);
}
