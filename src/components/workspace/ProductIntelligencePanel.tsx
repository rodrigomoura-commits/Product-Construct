import React, { useEffect, useState } from 'react';
import { Product, ProductStage, StageField, StageKey, Artifact, DiscussWithTonaPayload, StageClosureSynthesis } from '../../types';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { 
  Activity, Brain, AlertCircle, CheckCircle2, 
  HelpCircle, Zap, ShieldAlert, ListTodo,
  FileText, ArrowRight, Sparkles, MessageSquare,
  Loader2, Check, ExternalLink, Info, RefreshCw
} from 'lucide-react';
import { cn, truncateText } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { createArtifact } from '../../lib/artifacts';
import { ARTIFACT_CATALOG } from '../../lib/artifactCatalog';
import { MemorySynthesisTab } from './MemorySynthesisTab';
import ProductDecisionModal from '../products/decisions/ProductDecisionModal';
import { ConversationMemory } from '../../types';
import { doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

import { normalizeProgress, calculateProductEvolutionFromStages } from '../../lib/progressEngine';
import { cleanConversationSummaryForDisplay } from '../../lib/summarySanitizer';
import { getProductMemoriesCollection, getProductSynthesisCollection } from '../../lib/mindflowCollections';

interface IntelligencePanelProps {
  product: Product;
  activeStage: StageKey;
  stages: ProductStage[];
  onContinue?: () => void;
  onDiscussWithTona?: (payload: DiscussWithTonaPayload) => void;
}

function getProductProgressStatus(overallProgress: number) {
  if (overallProgress >= 90) return "Produto quase completo";
  if (overallProgress >= 70) return "Produto bem avançado";
  if (overallProgress >= 40) return "Produto em evolução";
  if (overallProgress >= 15) return "Produto em fase inicial";
  return "Produto começando";
}

function buildStrategicProgressInsight({
  overallProgress,
  activeStageName,
  activeStageMaturity,
}: {
  overallProgress: number;
  activeStageName: string;
  activeStageMaturity: number;
}) {
  if (activeStageMaturity >= 100) {
    return `A etapa ${activeStageName} foi concluída. Revise o resumo consolidado ou avance para a próxima etapa.`;
  }

  if (overallProgress < 30 && activeStageMaturity >= 80) {
    return `O produto ainda está no início da jornada, mas a etapa ${activeStageName} já está madura para revisão.`;
  }

  if (overallProgress < 30 && activeStageMaturity < 50) {
    return `O produto ainda está começando e a etapa ${activeStageName} precisa de mais clareza antes de avançar.`;
  }

  if (overallProgress >= 50 && activeStageMaturity >= 80) {
    return `O produto já tem boa evolução geral e a etapa ${activeStageName} está pronta para revisão.`;
  }

  return `Acompanhe a evolução do produto e a maturidade da etapa atual para decidir o próximo avanço.`;
}

export default function ProductIntelligencePanel({ product, activeStage, stages, onContinue, onDiscussWithTona }: IntelligencePanelProps) {
  const [fields, setFields] = useState<StageField[]>([]);
  const [productMemories, setProductMemories] = useState<any[]>([]);
  const [synthesisItems, setSynthesisItems] = useState<any[]>([]);
  const currentStage = stages.find(s => s.stage_key === activeStage);
  const [activeTab, setActiveTab] = useState<'summary' | 'memory' | 'gaps' | 'risks'>('summary');
  const [generating, setGenerating] = useState<string | null>(null);
  const [existingArtifacts, setExistingArtifacts] = useState<Record<string, Artifact>>({});
  const [conversationMemory, setConversationMemory] = useState<ConversationMemory | null>(null);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [selectedFieldForDecision, setSelectedFieldForDecision] = useState<StageField | null>(null);

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

  useEffect(() => {
    if (!product.id) return;

    const q = query(
      getProductMemoriesCollection(db, product.id),
      where("stage_id", "==", activeStage),
      where("status", "in", ["active", "needs_review"]),
      orderBy("updated_at", "desc"),
      limit(30)
    );

    const unsub = onSnapshot(q, (snap) => {
      setProductMemories(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      );
    }, (err) => {
      console.warn("[ProductIntelligencePanel] Failed to fetch mindflow memories", err);
    });

    return unsub;
  }, [product.id, activeStage]);

  useEffect(() => {
    if (!product.id) return;

    const q = query(
      getProductSynthesisCollection(db, product.id),
      where("status", "==", "active"),
      orderBy("updated_at", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setSynthesisItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn("[ProductIntelligencePanel] Failed to fetch synthesis", err);
    });

    return unsub;
  }, [product.id]);

  function normalizeClassification(value: any) {
    const raw = String(value || "").trim().toLowerCase();
    const map: Record<string, string> = {
      "decisão": "decision", "decision": "decision",
      "hipótese": "hypothesis", "hypothesis": "hypothesis",
      "evidência": "evidence", "evidence": "evidence",
      "fato": "fact", "fact": "fact",
      "risco": "risk", "risk": "risk",
      "pendência": "pending", "pending": "pending",
      "aprendizado": "learning", "learning": "learning"
    };
    return map[raw] || "fact";
  }

  function dedupeMemoryItems(items: any[]) {
    const seen = new Set();
    return items.filter((item) => {
      const val = String(item.value || "").toLowerCase().trim();
      const classif = item.classification || 'fact';
      const key = `${classif}:${val}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const memoryFieldsFromMindflow = productMemories.map((m) => ({
    id: m.id,
    product_id: product.id,
    stage_key: m.stage_id || activeStage,
    field_key: m.title || m.memory_type,
    label: m.title || m.memory_type,
    value: m.content,
    classification: normalizeClassification(m.memory_type),
    confidence: m.confidence || 0.75,
    source: "mindflow_product_memory",
    updated_at: m.updated_at || m.created_at
  }));

  const mergedMemoryItems = dedupeMemoryItems([
    ...fields,
    ...memoryFieldsFromMindflow
  ]);

  useEffect(() => {
    const fetchMemory = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const memRef = doc(db, `products/${product.id}/conversation_memory`, userId);
      const memSnap = await getDoc(memRef);
      if (memSnap.exists()) {
        setConversationMemory({ id: memSnap.id, ...memSnap.data() } as ConversationMemory);
      }
    };
    fetchMemory();
  }, [product.id, activeStage]);

  const maturityLabels = (score: number) => {
    if (score >= 100) return { label: 'Concluída', color: 'text-white', bg: 'bg-emerald-500' };
    if (score >= 80) return { label: 'Em Revisão', color: 'text-indigo-600', bg: 'bg-indigo-50' };
    if (score >= 50) return { label: 'Estruturada', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (score >= 25) return { label: 'Hipótese', color: 'text-amber-600', bg: 'bg-amber-50' };
    return { label: 'Iniciar', color: 'text-slate-400', bg: 'bg-slate-50' };
  };

  const evolutionValue = calculateProductEvolutionFromStages(stages);
  const activeStageMaturity = normalizeProgress(currentStage?.progress || 0);
  const activeStageName = currentStage?.name || activeStage.toUpperCase();
  const maturityInfo = maturityLabels(activeStageMaturity);

  const insight = buildStrategicProgressInsight({
    overallProgress: evolutionValue,
    activeStageName,
    activeStageMaturity
  });

  const activeStageClosure = synthesisItems.find((s: any) => s.synthesis_type === "stage_closure" && s.stage_id === activeStage);

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-[400px] shrink-0 font-sans overflow-hidden">
      {/* Maturity Section */}
      <section className="p-6 border-b border-slate-100 bg-slate-50/30">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Inteligência Estratégica</h3>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Tempo Real</span>
          </div>
        </div>
        
        {/* Overall Product Progress */}
        <div className="flex items-end gap-4 mb-4">
          <div className="text-6xl font-black text-indigo-600 tracking-tighter leading-none">{evolutionValue}%</div>
          <div className="flex flex-col mb-1 min-w-0">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Evolução do Produto</span>
             <span className="text-[10px] font-bold text-slate-600 truncate uppercase tracking-tight">{getProductProgressStatus(evolutionValue)}</span>
          </div>
        </div>

        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-8 relative shadow-inner">
           <motion.div 
             initial={{ width: 0 }}
             animate={{ width: `${evolutionValue}%` }}
             className="bg-indigo-600 h-full rounded-full shadow-[0_0_12px_rgba(79,70,229,0.5)] transition-all duration-1000"
           />
        </div>

        {/* Current Stage Info */}
        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4 mb-6">
           <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Etapa Atual</span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-900">{activeStageName}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest transition-all",
                  maturityInfo.bg, 
                  maturityInfo.color,
                  activeStageMaturity >= 100 && "animate-pulse"
                )}>
                  {maturityInfo.label}
                </span>
              </div>
           </div>

           {activeStageMaturity >= 100 && (
             <div className="p-4 bg-indigo-600 border border-indigo-500 rounded-3xl space-y-4 shadow-lg shadow-indigo-200">
               <div className="flex items-center gap-2">
                 <CheckCircle2 className="w-4 h-4 text-white" />
                 <span className="text-[10px] font-black text-white/80 uppercase tracking-widest leading-none">Resumo Consolidado</span>
                 <div className="flex-1" />
                 <span className="px-2 py-0.5 bg-white/20 rounded-full text-[8px] font-black text-white uppercase tracking-widest">
                   Etapa OK
                 </span>
               </div>
               
               <div className="space-y-1">
                 <p className="text-xs font-black text-white leading-tight">
                   {activeStageClosure?.title || `A etapa ${activeStageName} foi consolidada com sucesso.`}
                 </p>
                 <p className="text-[10px] text-indigo-100 font-semibold leading-relaxed line-clamp-3 italic">
                   {activeStageClosure?.executive_summary ? `"${activeStageClosure.executive_summary}"` : "O resumo completo com decisões, hipóteses e próximos passos está disponível na área de conversa."}
                 </p>
               </div>

               <button 
                 type="button"
                 onClick={() => {
                    const event = new CustomEvent("tona:focus-stage-summary", {
                      detail: {
                        productId: product.id,
                        stageKey: activeStage
                      }
                    });
                    window.dispatchEvent(event);
                 }}
                 className="w-full flex items-center justify-center gap-2 py-2.5 bg-white rounded-2xl text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-[0.98]"
               >
                 Ver resumo da etapa
                 <ArrowRight className="w-3 h-3" />
               </button>
             </div>
           )}

           <div className="space-y-2">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-1.5 text-indigo-600">
                    <Activity className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      {fields.length > 0 ? "Maturidade da Etapa" : "Etapa não iniciada"}
                    </span>
                 </div>
                 <span className="text-xs font-black text-slate-900">{activeStageMaturity}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${activeStageMaturity}%` }}
                  className="bg-emerald-500 h-full rounded-full transition-all duration-700"
                />
              </div>
           </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
           <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
           <p className="text-[11px] font-bold text-slate-600 leading-normal italic">
             {truncateText(buildStrategicProgressInsight({
               overallProgress: evolutionValue,
               activeStageName,
               activeStageMaturity
             }), 240)}
           </p>
        </div>
      </section>

      {/* Structured Tabs */}
      <div className="flex border-b border-slate-100">
         {[
           { id: 'summary', label: 'Síntese', icon: Sparkles },
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
          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Painel de Controle</h4>
                <button 
                  onClick={async () => {
                    setGenerating("closure");
                    try {
                      const idToken = await auth.currentUser?.getIdToken();
                      const response = await fetch("/api/admin/scheduler/run-stage-closure", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${idToken}`
                        },
                        body: JSON.stringify({ 
                          product_id: product.id,
                          stage_key: activeStage,
                          force: true,
                          trigger: "user_refresh"
                        })
                      });
                      
                      const result = await response.json();
                      if (result.ok) {
                        toast.success("Resumo inteligente atualizado!");
                      } else {
                        toast.error(result.message || "Erro ao atualizar resumo.");
                      }
                    } catch (e) {
                      toast.error("Erro na conexão ao atualizar resumo.");
                    } finally {
                      setGenerating(null);
                    }
                  }}
                  disabled={generating === "closure"}
                  className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 disabled:opacity-50 transition-all"
                >
                  {generating === "closure" ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-2.5 h-2.5" />
                  )}
                  {generating === "closure" ? "Atualizando..." : "Atualizar agora"}
                </button>
              </div>
           <MemorySynthesisTab 
             memoryItems={mergedMemoryItems}
             activeStage={activeStage}
             product={product}
             conversationMemory={conversationMemory}
             stageClosure={activeStageClosure}
             onContinue={onContinue}
             onDiscussWithTona={onDiscussWithTona}
             onViewFullMemory={() => setActiveTab('memory')}
             onRegisterDecision={(field) => {
               setSelectedFieldForDecision(field);
               setIsDecisionModalOpen(true);
             }}
           />
          </div>
        )}

         {activeTab === 'memory' && (
            <div className="space-y-6">
               <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                    <Sparkles className="w-3 h-3" /> O que já entendi
                  </h4>
                  <div className="space-y-3">
                     {mergedMemoryItems.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                           <p className="text-xs text-slate-400 font-medium italic">Nenhum dado capturado ainda.</p>
                        </div>
                     ) : (
                        mergedMemoryItems.map(field => (
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
                                    field.classification === 'decision' ? "bg-indigo-100 text-indigo-700" :
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

      {isDecisionModalOpen && (
        <ProductDecisionModal
          isOpen={isDecisionModalOpen}
          onClose={() => {
            setIsDecisionModalOpen(false);
            setSelectedFieldForDecision(null);
          }}
          product={product}
          user={auth.currentUser}
          stageFields={mergedMemoryItems}
          initialData={selectedFieldForDecision ? {
            title: selectedFieldForDecision.label,
            decision_statement: selectedFieldForDecision.value,
            type: 'strategy', // Default or inferred
            status: 'decided',
            stage: activeStage
          } : undefined}
        />
      )}
    </div>
  );
}
