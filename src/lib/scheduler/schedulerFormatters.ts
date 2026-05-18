export function getTimestampMs(value: any, fallbackMs?: any) {
  if (typeof fallbackMs === "number" && Number.isFinite(fallbackMs)) {
    return fallbackMs;
  }

  if (!value) return 0;

  if (typeof value.toMillis === "function") return value.toMillis();

  if (typeof value.seconds === "number") return value.seconds * 1000;

  if (value instanceof Date) return value.getTime();

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

export function formatTimeOnly(value: any, fallbackMs?: any) {
  const ms = getTimestampMs(value, fallbackMs);

  if (!ms) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
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

  return `${minutes}min ${remainingSeconds}s`;
}

export function isRunStuck(run: any) {
  if (String(run.status || "").toLowerCase() !== "running") return false;

  const heartbeat = getTimestampMs(run.heartbeat_at, run.heartbeat_at_ms);
  const started = getTimestampMs(run.started_at, run.started_at_ms);

  const base = heartbeat || started;

  if (!base) return false;

  return Date.now() - base > 3 * 60 * 1000;
}

export function getRunStatusView(run: any) {
  if (isRunStuck(run)) {
    return {
      label: "STUCK",
      description: "Possivelmente travado",
      className: "bg-red-50 text-red-700 border-red-100"
    };
  }

  const status = String(run.status || "unknown").toLowerCase();

  const map: any = {
    running: {
      label: "RODANDO",
      description: "Em execução",
      className: "bg-amber-50 text-amber-700 border-amber-100"
    },
    success: {
      label: "SUCESSO",
      description: "Finalizado com sucesso",
      className: "bg-emerald-50 text-emerald-700 border-emerald-100"
    },
    partial: {
      label: "PARCIAL",
      description: "Finalizado com alertas",
      className: "bg-orange-50 text-orange-700 border-orange-100"
    },
    error: {
      label: "ERRO",
      description: "Falhou na execução",
      className: "bg-red-50 text-red-700 border-red-100"
    },
    cancelled: {
      label: "CANCELADO",
      description: "Execução cancelada",
      className: "bg-slate-50 text-slate-600 border-slate-100"
    }
  };

  return map[status] || {
    label: "DESCONHECIDO",
    description: "Status não identificado",
    className: "bg-slate-50 text-slate-600 border-slate-100"
  };
}
