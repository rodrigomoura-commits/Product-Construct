import React from "react";
import { 
  Sparkles, 
  Lightbulb, 
  FileText, 
  AlertTriangle, 
  HelpCircle,
  MessageCircle,
  ChevronRight
} from "lucide-react";
import { cn } from "../../lib/utils";
import { StageClosureSynthesis } from "../../types";

type PointCategory = "decision" | "hypothesis" | "fact" | "risk" | "pending";

interface StageReopenDiscussionCardProps {
  closure: StageClosureSynthesis;
  onSelectPoint: (category: PointCategory, item: any) => void;
}

export default function StageReopenDiscussionCard({ closure, onSelectPoint }: StageReopenDiscussionCardProps) {
  const sections = [
    {
      id: "decision" as PointCategory,
      title: "Decisões",
      items: closure.decisions || [],
      icon: Sparkles,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-100"
    },
    {
      id: "hypothesis" as PointCategory,
      title: "Hipóteses",
      items: closure.hypotheses || [],
      icon: Lightbulb,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100"
    },
    {
      id: "fact" as PointCategory,
      title: "Evidências",
      items: closure.facts || [],
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100"
    },
    {
      id: "risk" as PointCategory,
      title: "Riscos",
      items: closure.risks || [],
      icon: AlertTriangle,
      color: "text-rose-600",
      bg: "bg-rose-50",
      border: "border-rose-100"
    },
    {
      id: "pending" as PointCategory,
      title: "Pendências",
      items: closure.pending_points || [],
      icon: HelpCircle,
      color: "text-slate-600",
      bg: "bg-slate-50",
      border: "border-slate-100"
    }
  ].filter(s => s.items.length > 0);

  return (
    <div className="mx-4 my-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="rounded-[2.5rem] border border-indigo-100 bg-white p-8 shadow-2xl shadow-indigo-100/20">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <MessageCircle size={28} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter">
              Qual ponto você quer rediscutir?
            </h3>
            <p className="text-sm font-semibold text-slate-500">
              Escolha um item consolidado para a Tona abrir uma nova rodada de perguntas.
            </p>
          </div>
        </div>

        <div className="space-y-8 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
          {sections.map((section) => (
            <div key={section.id} className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <section.icon size={16} className={section.color} />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {section.title}
                </h4>
              </div>

              <div className="grid gap-3">
                {section.items.map((item: any, idx: number) => (
                  <button
                    key={`${section.id}-${idx}`}
                    type="button"
                    onClick={() => onSelectPoint(section.id, item)}
                    className={cn(
                      "group flex items-start justify-between gap-4 p-5 rounded-[1.75rem] border bg-white transition-all text-left",
                      "hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5",
                      section.border
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
                        {item.title}
                      </p>
                      <p className="text-xs font-semibold text-slate-500 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    <div className="mt-1 h-8 w-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                      <ChevronRight size={18} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
