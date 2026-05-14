import React, { useEffect, useState } from 'react';
import { Product, ProductStage, StageField, StageKey, Artifact } from '../../types';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { 
  Activity, Brain, AlertCircle, CheckCircle2, 
  HelpCircle, Zap, ShieldAlert, ListTodo,
  FileText, ArrowRight, Sparkles, MessageSquare,
  Loader2, Check, ExternalLink
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { createArtifact } from '../../lib/artifacts';
import { ARTIFACT_CATALOG } from '../../lib/artifactCatalog';
import toast from 'react-hot-toast';

interface IntelligencePanelProps {
  product: Product;
  activeStage: StageKey;
  stages: ProductStage[];
}

export default function ProductIntelligencePanel({ product, activeStage, stages }: IntelligencePanelProps) {
  const [fields, setFields] = useState<StageField[]>([]);
  const currentStage = stages.find(s => s.stage_key === activeStage);
  const [activeTab, setActiveTab] = useState<'memory' | 'gaps' | 'risks'>('memory');
  const [generating, setGenerating] = useState<string | null>(null);
  const [existingArtifacts, setExistingArtifacts] = useState<Record<string, Artifact>>({});

  useEffect(() => {
    const q = query(collection(db, `products/${product.id}/artifacts`), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, Artifact> = {};
      snap.docs.forEach(d => {
        const art = { id: d.id, ...d.data() } as Artifact;
        // Basic version comparison logic
        if (!map[art.type] || art.version_number! > (map[art.type].version_number || 0)) {
          map[art.type] = art;
        }
      });
      setExistingArtifacts(map);
    });
    return unsub;
  }, [product.id]);

  useEffect(() => {
    const path = `products/${product.id}/fields`;
    const q = query(collection(db, path), where('stage_key', '==', activeStage), orderBy('updated_at', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      const allFields = snap.docs.map(d => ({ id: d.id, ...d.data() } as StageField));
      
      // Deduplicate by field_key, keeping the most recent
      const uniqueFields: Record<string, StageField> = {};
      allFields.forEach(f => {
        if (!uniqueFields[f.field_key]) {
          uniqueFields[f.field_key] = f;
        }
      });
      
      setFields(Object.values(uniqueFields));
    });
    return unsub;
  }, [product.id, activeStage]);

  const maturityLabels = (score: number) => {
    if (score <= 20) return { label: 'Inicial', color: 'text-slate-400', bg: 'bg-slate-50' };
    if (score <= 40) return { label: 'Hipótese formada', color: 'text-amber-500', bg: 'bg-amber-50' };
    if (score <= 60) return { label: 'Estruturada', color: 'text-indigo-500', bg: 'bg-indigo-50' };
    if (score <= 80) return { label: 'Forte', color: 'text-blue-500', bg: 'bg-blue-50' };
    return { label: 'Pronta para revisão', color: 'text-emerald-500', bg: 'bg-emerald-50' };
  };

  const maturity = maturityLabels(currentStage?.progress || 0);

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-[400px] shrink-0 font-sans overflow-hidden">
      {/* Maturity Section */}
      <section className="p-6 border-b border-slate-100 bg-slate-50/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Inteligência Estratégica</h3>
          <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest", maturity.bg, maturity.color)}>
             {maturity.label}
          </span>
        </div>
        
        <div className="flex items-end gap-3 mb-4">
          <div className="text-5xl font-black text-slate-900 tracking-tighter">{currentStage?.progress || 0}%</div>
          <div className="flex flex-col mb-1">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Maturidade da Etapa</span>
             <div className="flex items-center gap-1 mt-1 text-emerald-600">
                <Activity className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-tight">
                  {fields.length > 0 ? "Retomada do contexto" : "Etapa não iniciada"}
                </span>
             </div>
          </div>
        </div>

        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-2">
           <motion.div 
             initial={{ width: 0 }}
             animate={{ width: `${currentStage?.progress || 0}%` }}
             className="bg-indigo-600 h-full rounded-full shadow-[0_0_8px_rgba(79,70,229,0.4)]"
           />
        </div>
        <p className="text-[11px] font-medium text-slate-500 italic">
          {currentStage?.progress === 0 
             ? "Dor inicial ainda não identificada. Inicie a conversa para amadurecer."
             : "Já existem hipóteses, mas faltam evidências e impacto mensurável."}
        </p>
      </section>

      {/* Structured Tabs */}
      <div className="flex border-b border-slate-100">
         {[
           { id: 'memory', label: 'Memória', icon: Brain },
           { id: 'gaps', label: 'Lacunas', icon: AlertCircle },
           { id: 'risks', label: 'Riscos', icon: ShieldAlert },
         ].map(tab => (
           <button
             key={tab.id}
             onClick={() => setActiveTab(tab.id as any)}
             className={cn(
               "flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest transition-all relative",
               activeTab === tab.id ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
             )}
           >
             <tab.icon className="w-3.5 h-3.5" />
             {tab.label}
             {activeTab === tab.id && (
               <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
             )}
           </button>
         ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
         {activeTab === 'memory' && (
            <div className="space-y-6">
               <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                    <Sparkles className="w-3 h-3" /> O que já entendi
                  </h4>
                  <div className="space-y-3">
                     {fields.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                           <p className="text-xs text-slate-400 font-medium italic">Nenhum dado capturado ainda.</p>
                        </div>
                     ) : (
                        fields.map(field => (
                           <div key={field.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-indigo-100 hover:bg-indigo-50/30 transition-all">
                              <div className="flex items-center justify-between mb-1.5">
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">
                                    {field.label}
                                 </span>
                                 <div className={cn(
                                    "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                    field.classification === 'fact' ? "bg-emerald-100 text-emerald-700" :
                                    field.classification === 'hypothesis' ? "bg-amber-100 text-amber-700" :
                                    field.classification === 'evidence' ? "bg-blue-100 text-blue-700" :
                                    "bg-slate-200 text-slate-600"
                                 )}>
                                    {field.classification}
                                 </div>
                              </div>
                              <p className="text-xs font-bold text-slate-900 leading-relaxed">
                                 {field.value}
                              </p>
                              {field.confidence < 0.8 && (
                                 <button className="mt-2 text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:gap-1.5 transition-all">
                                    Confirmar <ArrowRight className="w-2.5 h-2.5" />
                                 </button>
                              )}
                           </div>
                        ))
                     )}
                  </div>
               </div>

               <div>
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Evidências Capturadas</h4>
                <div className="p-4 rounded-2xl border border-dashed border-slate-200 text-center">
                   <p className="text-[10px] font-bold text-slate-400">Arraste docs ou cole links no chat para processar evidências</p>
                </div>
               </div>
            </div>
         )}

         {activeTab === 'gaps' && (
            <div className="space-y-4">
               {[
                 { t: 'Sem exemplo real', d: 'Falta um caso concreto onde a dor apareceu.', s: 'Alta' },
                 { t: 'Persona indefinida', d: 'Quem exatamente sofre com isso?', s: 'Média' },
                 { t: 'Impacto não quantificado', d: 'Quanto tempo ou dinheiro é perdido?', s: 'Crítica' }
               ].map((gap, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm relative overflow-hidden group">
                     <div className={cn(
                        "absolute top-0 left-0 w-1 h-full",
                        gap.s === 'Crítica' ? "bg-red-500" : gap.s === 'Alta' ? "bg-amber-500" : "bg-blue-500"
                     )} />
                     <div className="flex items-center justify-between mb-1">
                        <h5 className="text-xs font-black text-slate-900 tracking-tight">{gap.t}</h5>
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{gap.s}</span>
                     </div>
                     <p className="text-[10px] font-medium text-slate-500 leading-relaxed mb-3">{gap.d}</p>
                     <button className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:scale-105 transition-all origin-left">
                        Resolver via Chat <ArrowRight className="w-2.5 h-2.5" />
                     </button>
                  </div>
               ))}
            </div>
         )}

         {activeTab === 'risks' && (
            <div className="py-12 text-center">
               <ShieldAlert className="w-8 h-8 text-slate-200 mx-auto mb-3" />
               <p className="text-xs text-slate-400 font-medium italic px-8">Riscos estratégicos e técnicos identificados pela IA aparecerão aqui conforme o produto amadurece.</p>
            </div>
         )}
      </div>

      {/* Artifact Summary Footer */}
      <footer className="p-6 border-t border-slate-100 bg-white">
         <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Artefatos Sugeridos</h4>
         <div className="space-y-2">
            {(() => {
               const catalogStageId = Object.keys(ARTIFACT_CATALOG).find(id => ARTIFACT_CATALOG[id].framework_key === activeStage) || 'understand_problem';
               const suggestedArtifacts = ARTIFACT_CATALOG[catalogStageId]?.artifacts || [];

               return suggestedArtifacts.map((art: any) => {
                  const available = (currentStage?.progress || 0) >= art.required_maturity;
                  const isGenerating = generating === art.type;
                  const existing = existingArtifacts[art.type];

                  const handleAction = async () => {
                    if (!available || isGenerating) return;

                    if (existing) {
                       toast(`${art.title} já existe (v${existing.version}). Veja na aba Artefatos.`, { icon: '📄' });
                       return;
                    }

                    try {
                      setGenerating(art.type);
                      const userId = auth.currentUser?.uid;
                      const userEmail = auth.currentUser?.email;
                      if (!userId) throw new Error("User not authenticated");

                      toast.loading(`Tona está gerando o ${art.title}...`, { id: 'generating-artifact' });
                      
                      await createArtifact({
                        productId: product.id,
                        stageId: catalogStageId,
                        type: art.type,
                        title: art.title,
                        creationMode: 'tona_generated',
                        userId,
                        userEmail: userEmail || ''
                      });

                      toast.success(`${art.title} gerado com sucesso!`, { id: 'generating-artifact' });
                    } catch (error) {
                      console.error(error);
                      toast.error(`Falha ao gerar ${art.title}.`, { id: 'generating-artifact' });
                    } finally {
                      setGenerating(null);
                    }
                  };

                  return (
                     <button 
                       key={art.type}
                       disabled={!available || isGenerating}
                       onClick={handleAction}
                       className={cn(
                          "w-full flex items-center justify-between p-3 rounded-xl border transition-all relative overflow-hidden group",
                          available 
                            ? existing 
                              ? "bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100"
                              : "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100" 
                            : "bg-slate-50 border-slate-100 text-slate-400 opacity-60 cursor-not-allowed"
                       )}
                     >
                        <div className="flex items-center gap-3">
                           {isGenerating ? (
                             <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                           ) : existing ? (
                             <Check className="w-4 h-4 text-emerald-500" />
                           ) : (
                             <FileText className="w-4 h-4" />
                           )}
                           <div className="flex flex-col items-start min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest truncate">{art.title}</span>
                                {art.priority === 'critical' && (
                                  <span className="text-[8px] font-black text-rose-500 uppercase">Crítico</span>
                                )}
                                {(art.type === 'epic' || art.type === 'user_stories') && (
                                  <span className="text-[8px] font-black text-indigo-500 uppercase">Jira</span>
                                )}
                              </div>
                             {existing && <span className="text-[8px] font-bold uppercase opacity-60 tracking-tight">Gerado v{existing.version}</span>}
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                           {isGenerating ? (
                              <span className="text-[9px] font-black uppercase text-indigo-400">Gerando...</span>
                           ) : existing ? (
                              <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                           ) : available ? (
                              <Zap className="w-3 h-3 fill-current text-indigo-400 group-hover:scale-125 transition-transform" />
                           ) : (
                              <span className="text-[9px] font-black tracking-tighter">REQ {art.required_maturity}%</span>
                           )}
                        </div>

                        {isGenerating && (
                           <motion.div 
                             className="absolute bottom-0 left-0 h-0.5 bg-indigo-400"
                             initial={{ width: 0 }}
                             animate={{ width: '100%' }}
                             transition={{ duration: 2, repeat: Infinity }}
                           />
                        )}
                     </button>
                  );
               });
            })()}
         </div>
      </footer>
    </div>
  );
}
