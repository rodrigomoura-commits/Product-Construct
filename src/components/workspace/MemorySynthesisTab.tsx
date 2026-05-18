import React, { useState } from 'react';
import { Product, StageKey, StageField, ConversationMemory, DiscussWithTonaPayload, StageClosureSynthesis } from '../../types';
import { 
  CheckCircle2, Lightbulb, FileText, Brain, 
  ArrowRight, Sparkles, Zap, AlertCircle, Bot,
  MessageCircle, Info
} from 'lucide-react';
import { cn, truncateText } from '../../lib/utils';
import { motion } from 'motion/react';

import { removeStaleMaturityMentions, cleanConversationSummaryForDisplay } from '../../lib/summarySanitizer';

interface MemorySynthesisTabProps {
  memoryItems: StageField[];
  activeStage: StageKey;
  product: Product;
  conversationMemory: ConversationMemory | null;
  stageClosure?: StageClosureSynthesis | null;
  onContinue?: () => void;
  onViewFullMemory?: () => void;
  onDiscussWithTona?: (payload: DiscussWithTonaPayload) => void;
  onRegisterDecision?: (item: StageField) => void;
  gaps?: any[];
  risks?: any[];
}

export function MemorySynthesisTab({ 
  memoryItems, 
  activeStage, 
  product, 
  conversationMemory,
  stageClosure,
  onContinue,
  onViewFullMemory,
  onDiscussWithTona,
  onRegisterDecision,
  gaps = [],
  risks = []
}: MemorySynthesisTabProps) {
  const getItemsByClassification = (items: StageField[], classification: string, limit: number = 4) => {
    return items
      .filter(item => item.classification === classification)
      .sort((a, b) => {
        const aTime = a.updated_at?.seconds || 0;
        const bTime = b.updated_at?.seconds || 0;
        return bTime - aTime;
      })
      .slice(0, limit);
  };

  const decisions = getItemsByClassification(memoryItems, 'decision', 4);
  const hypotheses = getItemsByClassification(memoryItems, 'hypothesis', 3);
  const evidences = getItemsByClassification(memoryItems, 'evidence', 3);
  const facts = getItemsByClassification(memoryItems, 'fact', 3);

  const currentUnderstanding = (() => {
    // 1. High priority: Intelligent stage closure strategic synthesis
    if (stageClosure?.right_panel?.strategic_synthesis_body) {
      return stageClosure.right_panel.strategic_synthesis_body;
    }

    // 2. Medium priority: Stage document projection (if loaded)
    const stageData = (product as any).stages?.find((s: any) => s.stage_key === activeStage);
    if (stageData?.understanding_summary) {
      return stageData.understanding_summary;
    }

    // 3. Low priority: Roots product understanding (general)
    if ((product as any).current_understanding) {
      return (product as any).current_understanding;
    }

    // 4. Default: Conversation history summary
    if (conversationMemory?.conversation_summary) {
      return cleanConversationSummaryForDisplay(removeStaleMaturityMentions(conversationMemory.conversation_summary));
    }

    if (memoryItems.length < 3) {
      return `Ainda estamos formando o entendimento sobre ${product.name}. Os primeiros sinais indicam o início da etapa ${activeStage.toUpperCase()}, onde estamos mapeando as dores e oportunidades fundamentais.`;
    }

    const mainDecisions = decisions.map(d => d.value.toLowerCase()).slice(0, 2);
    const mainHypotheses = hypotheses.map(h => h.value.toLowerCase()).slice(0, 1);
    
    let text = `${product.name} está se consolidando como uma iniciativa para resolver problemas na etapa ${activeStage.toUpperCase()}. `;
    
    if (mainDecisions.length > 0) {
      text += `Até aqui, o foco parece estar em ${mainDecisions.join(' e ')}. `;
    }
    
    if (mainHypotheses.length > 0) {
      text += `A principal aposta no momento é ${mainHypotheses[0]}. `;
    }

    return text;
  })();

  const rawTonaReading = (() => {
    if (stageClosure?.right_panel?.next_step_hint) {
      return stageClosure.right_panel.next_step_hint;
    }

    let reading = "";
    if (memoryItems.length < 5) {
      reading = "Minha leitura: estamos em fase de exploração inicial. O entendimento está sendo construído e o próximo salto de maturidade virá ao transformar as primeiras conversas em decisões concretas sobre o escopo.";
    } else {
      const hasDecisions = decisions.length > 0;
      const hasHypotheses = hypotheses.length > 0;
      const hasEvidence = evidences.length > 0;

      reading = "Minha leitura: ";
      
      if (hasDecisions && !hasEvidence) {
        reading += "o produto já tem uma direção forte, mas ainda precisa de evidências mais sólidas para sustentar a urgência. ";
      } else if (hasHypotheses && !hasDecisions) {
        reading += "estamos com muitas apostas abertas. O momento pede o fechamento de alguma definição para dar tração. ";
      } else {
        reading += "o entendimento está fluindo bem. ";
      }

      reading += `O próximo movimento parece estar em provar que o impacto identificado justifica o investimento planejado.`;
    }
    
    return removeStaleMaturityMentions(reading);
  })();

  const nextActionLabel = cleanConversationSummaryForDisplay(
    removeStaleMaturityMentions(
      stageClosure?.recommended_next_step?.description ||
      conversationMemory?.next_best_action || 
      conversationMemory?.pending_question || 
      hypotheses[0]?.value || 
      "Escolher o próximo ponto da memória que precisa ser confirmado."
    )
  );

  const Block = ({ title, icon: Icon, items, emptyLabel, colorClass, onRegisterDecision }: any) => (
    <div className="space-y-4">
      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
        <Icon className={cn("w-3.5 h-3.5", colorClass)} /> {title}
      </h4>
      <div className="space-y-2.5">
        {items.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-slate-100">
            <p className="text-[10px] text-slate-400 font-medium italic">{emptyLabel}</p>
          </div>
        ) : (
          items.map((item: StageField) => (
            <div key={item.id} className="p-4 rounded-[2rem] bg-white border border-slate-100 group transition-all hover:border-indigo-100 hover:shadow-sm">
               <div className="flex items-center gap-2 mb-2">
                  <div className={cn("w-2 h-2 rounded-full", 
                    item.classification === 'decision' ? "bg-indigo-500" :
                    item.classification === 'hypothesis' ? "bg-amber-500" :
                    item.classification === 'evidence' ? "bg-blue-500" : "bg-emerald-500"
                  )} />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{item.label}</span>
               </div>
               <p className="text-sm font-bold text-slate-800 leading-relaxed mb-4">
                 {item.value}
               </p>
               <div className="flex items-center gap-3">
                 <button 
                   onClick={() => onDiscussWithTona?.({
                     source: "memory",
                     sourceId: item.id,
                     title: item.label || item.classification,
                     content: item.value,
                     classification: item.classification as any,
                     stageKey: item.stage_key || activeStage,
                     suggestedPrompt: `Quero retomar este ponto da memória do produto: "${item.label}". Conteúdo: ${item.value}. Me ajude a aprofundar, validar e decidir o próximo passo.`
                   })}
                   className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                 >
                   Retomar <ArrowRight className="w-2.5 h-2.5" />
                 </button>
                 
                 {item.classification === 'decision' && onRegisterDecision && (
                   <button 
                     onClick={() => onRegisterDecision?.(item)}
                     className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1 border-l border-slate-100 pl-3"
                   >
                     Oficializar <CheckCircle2 className="w-2.5 h-2.5" />
                   </button>
                 )}
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (memoryItems.length === 0) {
    return (
      <div className="py-12 text-center space-y-6">
        <div className="w-16 h-16 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto border border-slate-100 shadow-sm animate-pulse">
           <Brain className="w-8 h-8 text-slate-200" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Ainda estamos formando a síntese</h3>
          <p className="text-xs text-slate-400 font-medium leading-relaxed px-12">
            Continue conversando com a Tona ou registre decisões, hipóteses e evidências. 
            Conforme a memória do produto cresce, esta aba vai consolidar automaticamente o entendimento.
          </p>
        </div>
        <button 
          onClick={onContinue}
          className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          Continuar conversa
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-12">
      {/* Narrative Synthesis Section */}
      <section className="space-y-4">
        <div className="p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-xl shadow-slate-100/50 relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
           
           <div className="relative z-10 space-y-6">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                      <Sparkles className="w-5 h-5 text-white" />
                   </div>
                   <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Síntese Estratégica</h4>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">Entendimento Atual</h2>
                   </div>
                </div>
                <div className="px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                   <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{activeStage}</span>
                </div>
             </div>
             
             <div className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100/50 shadow-inner">
               <p className="text-base font-bold leading-relaxed whitespace-pre-line text-slate-800">
                  {truncateText(currentUnderstanding, 240)}
               </p>
             </div>

             <div className="flex items-center justify-between pt-2">
                <button 
                  onClick={() => onDiscussWithTona?.({
                    source: "synthesis",
                    title: "Entendimento atual",
                    content: currentUnderstanding,
                    stageKey: activeStage,
                    suggestedPrompt: `Quero discutir o entendimento atual do produto: ${currentUnderstanding}. Me ajude a validar se essa síntese está correta, o que falta e qual próximo passo devemos seguir.`
                  })}
                  className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                >
                  <MessageCircle className="w-4 h-4" />
                  Discutir com a Tona
                </button>

                <div className="flex items-center gap-2 text-slate-300">
                   <Info className="w-4 h-4" />
                   <span className="text-[9px] font-bold uppercase tracking-wider">Baseado em {memoryItems.length} pontos da memória</span>
                </div>
             </div>
           </div>
        </div>
      </section>

      {/* Tona Reading Block */}
      <section>
        <div className="p-6 rounded-[2rem] bg-amber-50 border border-amber-100 relative group">
           <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
                 <Bot className="w-4 h-4 text-white" />
              </div>
              <h4 className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Leitura da Tona</h4>
           </div>
           
           <p className="text-[13px] font-bold text-amber-900 leading-relaxed italic mb-4">
              {truncateText(rawTonaReading, 240)}
           </p>

           <button 
             onClick={() => onDiscussWithTona?.({
               source: "synthesis",
               title: "Leitura da Tona",
               content: rawTonaReading,
               stageKey: activeStage,
               suggestedPrompt: `Quero aprofundar esta leitura da Tona: ${rawTonaReading}. Me ajude a entender o que ela implica para a evolução do produto e quais decisões precisamos tomar.`
             })}
             className="text-[10px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-800 transition-colors flex items-center gap-2"
           >
             <MessageCircle className="w-3.5 h-3.5" />
             Explorar leitura
           </button>
        </div>
      </section>

      {/* Featured Next Move */}
      <section>
        <div className="p-6 rounded-[2rem] bg-slate-900 text-white shadow-xl shadow-slate-200 space-y-5">
           <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
                 <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Próximo melhor passo</span>
           </div>
           <p className="text-sm font-bold leading-relaxed text-indigo-50">
              {nextActionLabel}
           </p>
           <button 
             onClick={onContinue}
             className="w-full py-4 bg-indigo-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-indigo-500/20"
           >
              Continuar daqui
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
           </button>
        </div>
      </section>

      {/* What Supports This - O que sustenta isso */}
      <section className="space-y-4">
        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-indigo-400" /> O que sustenta isso
        </h4>
        <div className="space-y-2">
          {[...decisions, ...hypotheses, ...facts].slice(0, 4).map((item, idx) => (
            <div key={idx} className="flex gap-3 text-xs text-slate-600 font-bold leading-tight items-start bg-white p-3 border border-slate-100 rounded-xl">
               <span className={cn(
                 "mt-1 w-1.5 h-1.5 rounded-full shrink-0",
                 item.classification === 'decision' ? "bg-indigo-500" : "bg-slate-300"
               )} />
               {item.label}
            </div>
          ))}
          {memoryItems.length === 0 && (
            <p className="text-[10px] text-slate-400 italic">Conversas iniciais em andamento...</p>
          )}
        </div>
      </section>

      {/* Core Memory Grid */}
      <div className="grid grid-cols-1 gap-10">
        <Block 
          title="O que parece decidido" 
          icon={CheckCircle2} 
          items={decisions} 
          emptyLabel="Sem decisões consolidadas ainda." 
          colorClass="text-indigo-500"
          onRegisterDecision={onRegisterDecision}
        />
        
        <Block 
          title="O que ainda é hipótese" 
          icon={Lightbulb} 
          items={hypotheses} 
          emptyLabel="Sem hipóteses abertas nesta etapa." 
          colorClass="text-amber-500"
        />

        <Block 
          title="Evidências registradas" 
          icon={FileText} 
          items={evidences} 
          emptyLabel="Ainda não registramos evidências fortes. Este é um bom próximo foco." 
          colorClass="text-blue-500"
        />

        <Block 
          title="Fatos consolidados" 
          icon={Brain} 
          items={facts} 
          emptyLabel="Sem fatos consolidados ainda." 
          colorClass="text-emerald-500"
        />
      </div>

      {/* External Actions */}
      <div className="pt-6 border-t border-slate-100 flex flex-col items-center gap-4">
          <button 
            onClick={onViewFullMemory}
            className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-500 transition-colors flex items-center gap-2"
          >
            Ver memória completa <ArrowRight className="w-3 h-3" />
          </button>
          
          <div className="flex items-center gap-2 px-6 text-center text-slate-300">
             <AlertCircle className="w-3 h-3 shrink-0" />
             <p className="text-[9px] font-medium leading-tight">
                A síntese é atualizada após cada interação relevante com a Tona.
             </p>
          </div>
      </div>
    </div>
  );
}

