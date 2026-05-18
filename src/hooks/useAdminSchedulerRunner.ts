import { useEffect, useRef } from "react";
import { getTimestampMs } from "../lib/dateFormat";

async function parseJsonSafe(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: "non-json-response",
      message: text.slice(0, 300)
    };
  }
}

export function useAdminSchedulerRunner(enabled: boolean, user: any, jobs: any[]) {
  const runningRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !user || !Array.isArray(jobs) || !jobs.length) return;

    async function tick() {
      if (runningRef.current) return;

      const job = jobs.find((j) => j.id === "stage_closure_auto_summary");

      if (!job) return;
      if (job.status !== "active") return;

      const nextRunMs = getTimestampMs(job.next_run_at, job.next_run_at_ms);

      if (nextRunMs && Date.now() < nextRunMs) return;

      runningRef.current = true;

      try {
        console.log("[SchedulerRunner] Auto-triggering stage closure summary job...");

        const token = await user.getIdToken(true);

        const response = await fetch("/api/admin/scheduler/run-stage-closure", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            job_id: job.id,
            trigger: "auto_runner"
          })
        });

        const result = await parseJsonSafe(response);

        if (!response.ok || result?.ok === false) {
          const message = result?.message || result?.error || `HTTP ${response.status}`;

          if (lastErrorRef.current !== message) {
            console.warn("[SchedulerRunner] Auto-run failed:", result);
            lastErrorRef.current = message;
          }

          return;
        }

        lastErrorRef.current = null;
        console.log("[SchedulerRunner] Auto-run finished:", result);
      } catch (error) {
        console.warn("[SchedulerRunner] Auto-run failed", error);
      } finally {
        runningRef.current = false;
      }
    }

    tick();

    const interval = setInterval(tick, 30 * 1000);

    return () => clearInterval(interval);
  }, [enabled, user, jobs]);
}
