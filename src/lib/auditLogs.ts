import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  limit
} from "firebase/firestore";
import { db } from "./firebase";

export type AuditLogSeverity = "info" | "warning" | "critical";

export type AuditLogCategory =
  | "user_management"
  | "access"
  | "product"
  | "decision"
  | "document"
  | "mindflow"
  | "integration"
  | "llm"
  | "security"
  | "system";

export type AuditLog = {
  id: string;
  type: string;
  category?: AuditLogCategory;
  severity?: AuditLogSeverity;
  actor_id?: string | null;
  actor_email?: string | null;
  actor_name?: string | null;
  target_user_id?: string | null;
  target_email?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  summary: string;
  metadata?: Record<string, any>;
  created_at?: any;
};

export function cleanFirestoreData<T = any>(value: T): T {
  if (value === undefined) return null as T;
  if (value === null) return value;
  if (value instanceof Date) return value;

  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as T;
  }

  if (typeof value === "object") {
    const cleaned: Record<string, any> = {};

    Object.entries(value as Record<string, any>).forEach(([key, entryValue]) => {
      cleaned[key] = entryValue === undefined ? null : cleanFirestoreData(entryValue);
    });

    return cleaned as T;
  }

  return value;
}

export async function createAuditLog(payload: Omit<AuditLog, "id" | "created_at">) {
  return addDoc(collection(db, "audit_logs"), cleanFirestoreData({
    ...payload,
    category: payload.category || "system",
    severity: payload.severity || "info",
    created_at: serverTimestamp()
  }));
}

export function watchAuditLogs({
  onData,
  onError,
  maxResults = 100
}: {
  onData: (logs: AuditLog[]) => void;
  onError?: (error: Error) => void;
  maxResults?: number;
}) {
  const q = query(
    collection(db, "audit_logs"),
    orderBy("created_at", "desc"),
    limit(maxResults)
  );

  return onSnapshot(
    q,
    (snap) => {
      const logs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as AuditLog[];

      onData(logs);
    },
    (error) => {
      console.error("[AuditLogs] watch error:", error);
      onError?.(error);
    }
  );
}
