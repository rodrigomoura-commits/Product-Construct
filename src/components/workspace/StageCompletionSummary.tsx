import React from "react";
import {
  CheckCircle,
  ArrowRight,
  RotateCcw,
  MessageCircle
} from "lucide-react";
import { cn } from "../../lib/utils";

type StageCompletionSummaryProps = {
  stageKey: string;
  stageName: string;
  summary: string;
  decisions: any[];
  hypotheses: any[];
  facts: any[];
  risks: any[];
  gaps: any[];
  onDiscussPoint: (point: any) => void;
  onReopenStage?: () => void;
  onGoToNextStage?: () => void;
};

export default function StageCompletionSummary({
  stageKey,
  stageName,
  summary,
  decisions,
  hypotheses,
  facts,
  risks,
  gaps,
  onDiscussPoint,
  onReopenStage,
  onGoToNextStage
}: StageCompletionSummaryProps) {
  const discussionPoints = [
    ...decisions.map((item) => ({ ...item, type: "decision", label: "Decisão" })),
    ...hypotheses.map((item) => ({ ...item, type: "hypothesis", label: "Hipótese" })),
    ...facts.map((item) => ({ ...item, type: "fact", label: "Fato" })),
    ...risks.map((item) => ({ ...item, type: "risk", label: "Risco" })),
    ...gaps.map((item) => ({ ...item, type: "gap", label: "Lacuna" }))
  ];

  return (
    <section className="rounded-[32px] border border-emerald-200 bg-emerald-50/60 p-8 shadow-sm">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
              <CheckCircle size={22} />
            </div>

            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600">
                Etapa finalizada
              </p>
              <h2 className="text-2xl font-black text-slate-950">
                {stageName} consolidada
              </h2>
            </div>
          </div>

          <p className="mt-5 max-w-3xl text-sm font-semibold leading-7 text-slate-700">
            {summary || "A etapa foi concluída com os principais pontos estruturados. Você pode revisar os aprendizados, rediscutir pontos específicos ou avançar para a próxima etapa."}
          </p>
        </div>

        <span className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-700 shadow-sm border border-emerald-100">
          100%
        </span>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-white bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Decisões
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {decisions.length}
          </p>
        </div>

        <div className="rounded-3xl border border-white bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Hipóteses
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {hypotheses.length}
          </p>
        </div>

        <div className="rounded-3xl border border-white bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Pendências
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {gaps.length + risks.length}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400 mb-4">
          Pontos discutidos nesta etapa
        </p>

        <div className="space-y-3">
          {discussionPoints.length === 0 ? (
            <div className="p-8 rounded-3xl border border-dashed border-slate-200 text-center">
              <p className="text-sm text-slate-400 font-medium italic">Nenhum ponto registrado para revisão direta.</p>
            </div>
          ) : (
            discussionPoints.slice(0, 8).map((point, index) => (
              <div
                key={point.id || `${point.type}-${index}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 hover:border-indigo-100 hover:bg-slate-50/50 transition-all shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest",
                      point.type === 'decision' ? "bg-indigo-100 text-indigo-700" :
                      point.type === 'hypothesis' ? "bg-amber-100 text-amber-700" :
                      point.type === 'evidence' ? "bg-blue-100 text-blue-700" :
                      point.type === 'risk' ? "bg-red-100 text-red-700" :
                      "bg-slate-100 text-slate-600"
                    )}>
                      {point.label}
                    </span>
                    {point.status === "needs_review" && (
                      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-rose-700 animate-pulse">
                        Revisar
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-black text-slate-950 truncate">
                    {point.title || point.label || "Ponto sem título"}
                  </p>

                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
                    {point.content || point.value || point.description || ""}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onDiscussPoint(point)}
                  className="shrink-0 flex items-center justify-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                >
                  <MessageCircle size={14} />
                  Rediscutir
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-3 pt-6 border-t border-emerald-100/50">
        <button
          type="button"
          onClick={onGoToNextStage}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
        >
          Avançar para Definir Proposta
          <ArrowRight size={16} />
        </button>

        <button
          type="button"
          onClick={onReopenStage}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all"
        >
          Reabrir discussão da etapa
          <RotateCcw size={16} />
        </button>
      </div>
    </section>
  );
}
