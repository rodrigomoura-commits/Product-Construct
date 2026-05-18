export function getTimestampMs(value: any, fallbackMs?: any) {
  if (typeof fallbackMs === "number" && Number.isFinite(fallbackMs)) {
    return fallbackMs;
  }

  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.seconds === "number") {
    return value.seconds * 1000;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDateTime(value: any, fallbackMs?: any) {
  const ms = getTimestampMs(value, fallbackMs);

  if (!ms) return "Data indisponível";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(ms));
}

export function formatDuration(ms: any) {
  const value = Number(ms);

  if (!Number.isFinite(value) || value <= 0) return "-";

  if (value < 1000) return `${value}ms`;

  const seconds = Math.round(value / 1000);

  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return `${minutes}min ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}min`;
}
