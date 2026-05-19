import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateText(text: string, maxLength: number) {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

export function cleanFirestoreData(data: any): any {
  if (data === undefined) return null;
  if (data instanceof Date) return data;
  if (Array.isArray(data)) return data.map(cleanFirestoreData);
  if (typeof data === 'object' && data !== null) {
    const cleaned: any = {};
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined) {
        cleaned[key] = cleanFirestoreData(data[key]);
      }
    });
    return cleaned;
  }
  return data;
}

export function normalizeError(error: any, fallbackType = "UNKNOWN_ERROR") {
  return {
    type: error?.name || error?.code || fallbackType,
    message: error?.message || String(error),
    stack: error?.stack || null,
    timestamp: new Date().toISOString(),
    recoverable: true
  };
}

export function formatSafeDate(value?: string | number | Date | null | { seconds?: number }): string {
  if (!value) return "Nunca executado";

  let date: Date;

  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    date = new Date((value as any).seconds * 1000);
  } else {
    date = new Date(value as any);
  }

  if (Number.isNaN(date.getTime())) {
    return "Nunca executado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

/**
 * @deprecated Use formatSafeDate instead for better Firebase Timestamp support
 */
export function formatDate(date: any): string {
  return formatSafeDate(date);
}
