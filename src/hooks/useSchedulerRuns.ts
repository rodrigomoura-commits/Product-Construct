import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  limit,
  onSnapshot
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { getTimestampMs } from "../lib/scheduler/schedulerFormatters";

export type SchedulerRunFilters = {
  status?: string;
  jobId?: string;
  onlyErrors?: boolean;
  period?: "1h" | "24h" | "7d" | "30d" | "all";
  search?: string;
};

function getPeriodMs(period?: string) {
  const now = Date.now();

  if (period === "1h") return now - 60 * 60 * 1000;
  if (period === "24h") return now - 24 * 60 * 60 * 1000;
  if (period === "7d") return now - 7 * 24 * 60 * 60 * 1000;
  if (period === "30d") return now - 30 * 24 * 60 * 60 * 1000;

  return 0;
}

export function useSchedulerRuns(filters: SchedulerRunFilters, pageSize = 10) {
  const [allRuns, setAllRuns] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Query resiliente:
    // Não usar where por período/status aqui.
    // Evita sumir histórico por falta de started_at ou índice.
    const q = query(
      collection(db, "scheduler_runs"),
      limit(300)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        setAllRuns(data);
        setLastUpdatedAt(new Date());
        setLoading(false);
      },
      (err) => {
        console.error("[SchedulerRuns] realtime listener failed", err);
        setError(err?.message || "Erro ao carregar histórico.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let data = [...allRuns];

    data = data.sort((a, b) => {
      const bMs =
        getTimestampMs(b.started_at, b.started_at_ms) ||
        getTimestampMs(b.created_at, b.created_at_ms);

      const aMs =
        getTimestampMs(a.started_at, a.started_at_ms) ||
        getTimestampMs(a.created_at, a.created_at_ms);

      return bMs - aMs;
    });

    const periodStartMs = getPeriodMs(filters.period || "24h");

    if (periodStartMs) {
      data = data.filter((run) => {
        const runMs =
          getTimestampMs(run.started_at, run.started_at_ms) ||
          getTimestampMs(run.created_at, run.created_at_ms);

        return runMs >= periodStartMs;
      });
    }

    if (filters.jobId && filters.jobId !== "all") {
      data = data.filter((run) => run.job_id === filters.jobId);
    }

    if (filters.status && filters.status !== "all") {
      data = data.filter((run) => {
        return String(run.status || "").toLowerCase() === String(filters.status).toLowerCase();
      });
    }

    if (filters.onlyErrors) {
      data = data.filter((run) => {
        return (
          Number(run.errors_count || 0) > 0 ||
          String(run.status || "").toLowerCase() === "error" ||
          String(run.status || "").toLowerCase() === "partial"
        );
      });
    }

    if (filters.search?.trim()) {
      const term = filters.search.trim().toLowerCase();

      data = data.filter((run) => {
        const haystack = [
          run.id,
          run.job_id,
          run.job_name,
          run.status,
          run.error,
          JSON.stringify(run.errors || []),
          JSON.stringify(run.logs || [])
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(term);
      });
    }

    setRuns(data);
  }, [
    allRuns,
    filters.jobId,
    filters.status,
    filters.onlyErrors,
    filters.period,
    filters.search
  ]);

  const pages = useMemo(() => {
    const result = [];

    for (let i = 0; i < runs.length; i += pageSize) {
      result.push(runs.slice(i, i + pageSize));
    }

    return result;
  }, [runs, pageSize]);

  return {
    runs: Array.isArray(runs) ? runs : [],
    pages: Array.isArray(pages) ? pages : [],
    allRuns: Array.isArray(allRuns) ? allRuns : [],
    loading: Boolean(loading),
    error: error || null,
    lastUpdatedAt
  };
}
