import { useMemo, useState } from "react";
import {
  formatDateTime,
  formatDuration,
  getRunStatusView,
  getTimestampMs,
  isRunStuck
} from "../../../lib/scheduler/schedulerFormatters";

function MetricChip({ label, value, tone = "default" }: any) {
  const toneClass: any = {
    default: "bg-slate-50 text-slate-700 border-slate-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    info: "bg-indigo-50 text-indigo-700 border-indigo-100",
    danger: "bg-red-50 text-red-700 border-red-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100"
  };

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${toneClass[tone] || toneClass.default}`}>
      {label}: {value || 0}
    </span>
  );
}

export function SchedulerRunsTable({
  runs = [],
  loading,
  onViewLogs,
  onMarkAsFailed,
  pageSize = 6
}: any) {
  const [page, setPage] = useState(1);
  const safeRuns = Array.isArray(runs) ? runs : [];

  const totalPages = Math.max(1, Math.ceil(safeRuns.length / pageSize));

  const pageRuns = useMemo(() => {
    const start = (page - 1) * pageSize;
    return safeRuns.slice(start, start + pageSize);
  }, [safeRuns, page, pageSize]);

  if (loading) {
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
        <p className="mt-4 text-sm font-bold text-slate-500">Carregando histórico em tempo real...</p>
      </div>
    );
  }

  if (!safeRuns.length) {
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white p-12 text-center shadow-sm">
        <p className="text-lg font-black text-slate-950">Nenhuma execução encontrada</p>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Ajuste os filtros ou execute um job para gerar histórico.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[32px] border border-slate-200 bg-white shadow-sm overflow-visible">
      <div className="grid grid-cols-[1.5fr_0.7fr_1.6fr_0.5fr_0.4fr] gap-4 border-b border-slate-100 px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <div>Job / Início</div>
        <div>Status</div>
        <div>Métricas traduzidas</div>
        <div>Duração</div>
        <div className="text-right">Ações</div>
      </div>

      <div>
        {pageRuns.map((run: any) => {
          const status = getRunStatusView(run);
          const stuck = isRunStuck(run);

          const startedMs = getTimestampMs(run.started_at, run.started_at_ms);
          const runningDuration = startedMs ? Date.now() - startedMs : 0;

          return (
            <div
              key={run.id}
              className="grid grid-cols-[1.5fr_0.7fr_1.6fr_0.5fr_0.4fr] gap-4 border-b border-slate-100 px-8 py-6 last:border-b-0"
            >
              <div>
                <p className="text-sm font-black text-slate-950">
                  {run.job_name || "Job sem nome"}
                </p>
                <p className="mt-1 text-[11px] font-bold italic text-slate-500">
                  {formatDateTime(run.started_at, run.started_at_ms)} · Job: {run.job_id}
                </p>
              </div>

              <div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${status.className}`}>
                  {status.label}
                </span>
                <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {run.status === "running" && !stuck
                    ? `Rodando há ${formatDuration(runningDuration)}`
                    : status.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <MetricChip label="Produtos" value={run.products_checked} />
                <MetricChip label="Etapas" value={run.stages_checked} />
                <MetricChip label="Criados" value={run.summaries_created} tone="success" />
                <MetricChip label="Atualizados" value={run.summaries_updated} tone="info" />
                <MetricChip label="Ignorados" value={run.summaries_skipped} />
                {Number(run.errors_count || 0) > 0 && (
                  <MetricChip label="Erros" value={run.errors_count} tone="danger" />
                )}
              </div>

              <div>
                <p className="text-sm font-black text-slate-700">
                  {run.status === "running"
                    ? "Em execução"
                    : formatDuration(run.duration_ms)}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                {stuck && (
                  <button
                    type="button"
                    onClick={() => onMarkAsFailed(run)}
                    className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-600"
                  >
                    Encerrar
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onViewLogs(run)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                >
                  Logs
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 px-8 py-5">
        <p className="text-xs font-bold text-slate-500">
          Mostrando {pageRuns.length} de {safeRuns.length} execuções
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-40"
          >
            Anterior
          </button>

          <span className="text-xs font-black text-slate-600">
            Página {page} de {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
