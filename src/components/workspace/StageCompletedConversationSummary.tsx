import React from "react";
import { 
  CheckCircle, 
  ArrowRight, 
  RotateCcw, 
  MessageCircle,
  Brain,
  Search,
  Target,
  FileText,
  AlertTriangle,
  Lightbulb,
  Sparkles
} from "lucide-react";
import { cn } from "../../lib/utils";
import { StageClosureSynthesis } from "../../types";

type StageCompletedConversationSummaryProps = {
  stageName: string;
  closure: StageClosureSynthesis;
  onDiscussPoint: (point: any) => void;
  onGoToNextStage: () => void;
  onReopenStage: () => void;
  onRegenerate: () => void;
  loadingRegenerate?: boolean;
};

export default function StageCompletedConversationSummary({
  stageName,
  closure,
  onDiscussPoint,
  onGoToNextStage,
  onReopenStage,
  onRegenerate,
  loadingRegenerate
}: StageCompletedConversationSummaryProps) {
  
  const sections = [
    {
      title: "Entendimento do problema",
      content: closure.problem_understanding,
      icon: Search,
      color: "text-indigo-600",
      bg: "bg-indigo-50"
    },
    {
      title: "Cliente / Persona",
      content: closure.target_customer,
      icon: Target,
      color: "text-emerald-600",
      bg: "bg-emerald-50"
    },
    {
      title: "Evidências",
      content: closure.evidence_summary,
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      title: "Decisões",
      content: closure.decision_summary,
      icon: Sparkles,
      color: "text-purple-600",
      bg: "bg-purple-50"
    }
  ];

  return (
    <div className="mx-8 space-y-10 py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Card */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[3rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
        <div className="relative rounded-[32px] border border-emerald-100 bg-white/80 backdrop-blur-xl p-8 shadow-xl shadow-emerald-100/20">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-emerald-500 text-white shadow-lg shadow-emerald-200 ring-4 ring-emerald-50">
                <CheckCircle size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
                    Etapa Finalizada
                  </p>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-full uppercase tracking-widest">
                    Consolidado por IA
                  </span>
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                  {stageName} consolidada
                </h2>
                {closure.needs_update && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black rounded-full uppercase tracking-widest animate-pulse border border-amber-200">
                      Resumo desatualizado
                    </span>
                    <p className="text-[9px] font-bold text-slate-400 italic">
                      Reaberto para rediscussão
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="h-10 w-10 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 font-black text-xs">
                100%
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 italic relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Sparkles size={120} className="text-indigo-600" />
                </div>
              <p className="text-base font-semibold leading-relaxed text-slate-700 relative z-10">
                {closure.executive_summary}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sections.map((section, idx) => (
                <div key={idx} className="p-5 rounded-3xl border border-slate-50 bg-white shadow-sm flex items-start gap-4 hover:border-indigo-100 transition-all group/card">
                  <div className={cn("p-3 rounded-2xl shrink-0 transition-transform group-hover/card:scale-110", section.bg, section.color)}>
                    <section.icon size={20} />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      {section.title}
                    </h4>
                    <p className="text-xs font-semibold leading-relaxed text-slate-600">
                      {section.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Structured Details Sections */}
      <div className="space-y-8">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-2">
          Pontos Consolidados
        </h3>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Decisions */}
          {closure.decisions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <Sparkles size={14} className="text-purple-600" />
                <h4 className="text-sm font-black text-slate-900">Decisões</h4>
              </div>
              <div className="space-y-3">
                {closure.decisions.map((item, i) => (
                  <PointCard key={i} item={item} type="decision" onDiscuss={() => onDiscussPoint({ ...item, classification: 'decision' })} />
                ))}
              </div>
            </div>
          )}

          {/* Hypotheses */}
          {closure.hypotheses.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <Lightbulb size={14} className="text-amber-600" />
                <h4 className="text-sm font-black text-slate-900">Hipóteses</h4>
              </div>
              <div className="space-y-3">
                {closure.hypotheses.map((item, i) => (
                  <PointCard key={i} item={item} type="hypothesis" onDiscuss={() => onDiscussPoint({ ...item, classification: 'hypothesis' })} />
                ))}
              </div>
            </div>
          )}

          {/* Facts */}
          {closure.facts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <FileText size={14} className="text-blue-600" />
                <h4 className="text-sm font-black text-slate-900">Evidências e Fatos</h4>
              </div>
              <div className="space-y-3">
                {closure.facts.map((item, i) => (
                  <PointCard key={i} item={item} type="fact" onDiscuss={() => onDiscussPoint({ ...item, classification: 'fact' })} />
                ))}
              </div>
            </div>
          )}

          {/* Risks & Pending */}
          {(closure.risks.length > 0 || closure.pending_points.length > 0) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <AlertTriangle size={14} className="text-rose-600" />
                <h4 className="text-sm font-black text-slate-900">Riscos e Pendências</h4>
              </div>
              <div className="space-y-3">
                {[...closure.risks, ...closure.pending_points].map((item, i) => (
                  <PointCard key={i} item={item} type="risk" onDiscuss={() => onDiscussPoint({ ...item, classification: 'risk' })} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-10 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={onGoToNextStage}
            className="inline-flex items-center gap-3 rounded-[1.5rem] bg-slate-950 px-8 py-5 text-sm font-black uppercase tracking-widest text-white hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-[0.98]"
          >
            Avançar para {closure.recommended_next_step.next_stage.toUpperCase()}
            <ArrowRight size={18} />
          </button>

          <button
            type="button"
            onClick={onReopenStage}
            className="inline-flex items-center gap-3 rounded-[1.5rem] border border-slate-200 bg-white px-8 py-5 text-sm font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98]"
          >
            <RotateCcw size={18} />
            Reabrir discussão
          </button>
        </div>

        <button
          type="button"
          onClick={onRegenerate}
          disabled={loadingRegenerate}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
        >
          {loadingRegenerate ? 'Consolidando...' : 'Regenerar resumo inteligente'}
          <Sparkles size={14} className={cn(loadingRegenerate && "animate-spin")} />
        </button>
      </div>
    </div>
  );
}

function PointCard({ item, type, onDiscuss }: { item: any, type: string, onDiscuss: () => void }) {
  const colors = {
    decision: "bg-purple-50 text-purple-700 border-purple-100",
    hypothesis: "bg-amber-50 text-amber-700 border-amber-100",
    fact: "bg-blue-50 text-blue-700 border-blue-100",
    risk: "bg-rose-50 text-rose-700 border-rose-100"
  };

  return (
    <div className="group/item flex flex-col gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 hover:border-indigo-200 hover:bg-slate-50/30 transition-all shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-900 leading-tight">
            {item.title}
          </p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
            {item.description}
          </p>
          {item.validation_needed && (
             <p className="mt-2 text-[10px] font-bold text-amber-600 italic">
               Validar: {item.validation_needed}
             </p>
          )}
          {item.mitigation_hint && (
             <p className="mt-2 text-[10px] font-bold text-rose-600 italic">
               Mitigação: {item.mitigation_hint}
             </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDiscuss}
          className="opacity-0 group-hover/item:opacity-100 shrink-0 h-10 w-10 flex items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
          title="Rediscutir ponto"
        >
          <MessageCircle size={16} />
        </button>
      </div>
    </div>
  );
}
