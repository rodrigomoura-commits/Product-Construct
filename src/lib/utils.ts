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

export function formatDate(date: any) {
  if (!date) return "";
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
