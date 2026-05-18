import React, { useState, useEffect } from 'react';
import { 
  X, Save, Bot, Zap, Target, FileText, 
  Settings, Brain, Info, Plus, Trash2, 
  ChevronRight, Sparkles, Activity, Workflow
} from 'lucide-react';
import { db } from '../../../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../../lib/utils';
import { Agent, ProductJourneyStage } from '../../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stage: ProductJourneyStage;
  agents: Agent[];
  onSuccess: () => void;
}

export default function StageCustomizerModal({ isOpen, onClose, stage, agents, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'behavior' | 'fields' | 'maturity' | 'mindflow'>('behavior');
  const [formData, setFormData] = useState<Partial<ProductJourneyStage>>({});

  useEffect(() => {
    if (stage) {
      setFormData(stage);
    }
  }, [stage]);

  async function handleSubmit() {
    if (!stage.id) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'product_journey_stages', stage.id), {
        ...formData,
        updated_at: serverTimestamp()
      });
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar configuração da etapa.");
    } finally {
      setLoading(false);
    }
  }

  const stageAgents = agents.filter(a => a.type === 'stage_agent' || a.type === 'orchestrator');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 sm:p-24 bg-zinc-900/60 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 30 }}
            className="bg-zinc-50 w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20"
          >
            {/* Header */}
            <div className="p-8 bg-white border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl",
                  stage.color === 'emerald' ? "bg-emerald-600" :
                  stage.color === 'blue' ? "bg-blue-600" :
                  stage.color === 'indigo' ? "bg-indigo-600" :
                  stage.color === 'amber' ? "bg-amber-600" :
                  stage.color === 'rose' ? "bg-rose-600" :
                  "bg-violet-600"
                )}>
                  <Settings className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-zinc-900 tracking-tighter">Personalizar Etapa</h3>
                  <p className="text-zinc-500 font-medium italic">Configurando: <span className="font-bold text-zinc-900">{stage.name}</span></p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center bg-zinc-50 rounded-2xl text-zinc-400 hover:text-zinc-900 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Warning Banner */}
            <div className="bg-amber-50 border-b border-amber-100 p-4 flex items-center gap-3">
               <Info className="w-5 h-5 text-amber-600 shrink-0" />
               <p className="text-[11px] font-bold text-amber-800 leading-tight">
                 Esta etapa usa a personalidade-base compartilhada da Tona e o Mindflow único. 
                 As configurações abaixo ajustam apenas o comportamento situacional.
               </p>
            </div>

            {/* Sidebar Tabs */}
            <div className="flex flex-1 overflow-hidden">
               <div className="w-64 bg-zinc-100/50 p-6 space-y-2 border-r border-zinc-100 flex flex-col justify-between">
                  <div className="space-y-2">
                    {[
                      { id: 'behavior', label: 'Comportamento', icon: Bot },
                      { id: 'fields', label: 'Campos & Perguntas', icon: FileText },
                      { id: 'maturity', label: 'Maturidade', icon: Target },
                      { id: 'mindflow', label: 'Uso do Mindflow', icon: Brain },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                          "w-full px-5 py-4 rounded-2xl flex items-center gap-3 transition-all text-left",
                          activeTab === tab.id 
                            ? "bg-white text-zinc-900 shadow-lg shadow-zinc-200/50 font-black" 
                            : "text-zinc-500 hover:bg-white/50 font-bold"
                        )}
                      >
                        <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-zinc-900" : "text-zinc-400")} />
                        <span className="text-xs uppercase tracking-widest">{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full py-4 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-xl hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading ? <Activity className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar Mudanças
                  </button>
               </div>

               {/* Content Area */}
               <div className="flex-1 overflow-y-auto p-10 bg-white shadow-inner">
                  {activeTab === 'behavior' && (
                    <div className="max-w-2xl space-y-8">
                       <section className="space-y-4">
                          <h4 className="text-sm font-black text-zinc-900 flex items-center gap-2">
                             <Activity className="w-4 h-4" /> Stage Agent Responsável
                          </h4>
                          <div className="grid grid-cols-1 gap-4">
                             {stageAgents.map(agent => (
                               <button 
                                 key={agent.id}
                                 type="button"
                                 onClick={() => setFormData({ ...formData, stage_agent_id: agent.id })}
                                 className={cn(
                                   "p-5 rounded-2xl border-2 text-left flex items-center gap-4 transition-all transition-all group",
                                   formData.stage_agent_id === agent.id 
                                     ? "border-zinc-900 bg-zinc-900 text-white" 
                                     : "border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-200"
                                 )}
                               >
                                  <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                                    formData.stage_agent_id === agent.id ? "bg-white/10" : "bg-white shadow-sm"
                                  )}>
                                     <Bot className={cn("w-6 h-6", formData.stage_agent_id === agent.id ? "text-white" : "text-zinc-400")} />
                                  </div>
                                  <div>
                                     <p className="font-bold text-sm leading-none mb-1">{agent.name}</p>
                                     <p className={cn(
                                       "text-[11px] italic",
                                       formData.stage_agent_id === agent.id ? "text-white/60" : "text-zinc-400"
                                     )}>{agent.description}</p>
                                  </div>
                                  {formData.stage_agent_id === agent.id && (
                                    <Sparkles className="w-5 h-5 ml-auto text-amber-400 fill-amber-400" />
                                  )}
                               </button>
                             ))}
                          </div>
                       </section>

                       <section className="space-y-4">
                          <h4 className="text-sm font-black text-zinc-900">Configuração Comportamental Situacional</h4>
                          <div className="space-y-4">
                             <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-2">Modo de Condução</label>
                                <textarea 
                                  rows={4}
                                  placeholder="Ex: Curioso, investigativo, desafiador..."
                                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all font-medium text-sm"
                                  value={formData.maturity_config?.behavior_rules || ''}
                                  onChange={e => setFormData({ 
                                    ...formData, 
                                    maturity_config: { ...formData.maturity_config, behavior_rules: e.target.value } 
                                  })}
                                />
                             </div>
                          </div>
                       </section>
                    </div>
                  )}

                  {activeTab === 'mindflow' && (
                    <div className="max-w-2xl space-y-8">
                       <section className="space-y-4">
                          <h4 className="text-sm font-black text-zinc-900 flex items-center gap-2">
                             <Brain className="w-4 h-4" /> Priorização de Memória
                          </h4>
                          <p className="text-xs text-zinc-500">Selecione quais tipos de memória do Mindflow compartilhado devem ser priorizados nesta etapa.</p>
                          
                          <div className="grid grid-cols-2 gap-3">
                             {[
                               'base', 'product', 'user', 'conversation', 'evidence', 
                               'hypothesis', 'decision', 'artifact', 'risk', 'metric'
                             ].map(type => (
                               <label key={type} className="flex items-center gap-3 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl cursor-pointer hover:bg-white transition-all group">
                                  <input 
                                    type="checkbox"
                                    className="w-5 h-5 rounded-lg accent-zinc-900"
                                    checked={formData.mindflow_usage_config?.priority_memory_types?.includes(type)}
                                    onChange={e => {
                                      const current = formData.mindflow_usage_config?.priority_memory_types || [];
                                      const next = e.target.checked ? [...current, type] : current.filter((t: string) => t !== type);
                                      setFormData({
                                        ...formData,
                                        mindflow_usage_config: { ...formData.mindflow_usage_config, priority_memory_types: next }
                                      });
                                    }}
                                  />
                                  <span className="text-[11px] font-black uppercase tracking-widest text-zinc-600 group-hover:text-zinc-900">{type}</span>
                               </label>
                             ))}
                          </div>
                       </section>
                    </div>
                  )}

                  {activeTab === 'fields' && (
                     <div className="max-w-3xl space-y-8">
                        <section className="space-y-4">
                          <h4 className="text-sm font-black text-zinc-900 flex items-center justify-between">
                             <span>Campos & Regras de Coleta</span>
                             <button className="px-3 py-1 bg-zinc-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 active:scale-95 transition-all">
                               <Plus className="w-3 h-3" /> Adicionar Campo
                             </button>
                          </h4>
                          
                          <div className="space-y-4">
                             {(formData.field_config || []).map((field: any, idx: number) => (
                               <div key={idx} className="p-6 bg-zinc-50 border border-zinc-100 rounded-[2rem] space-y-4">
                                  <div className="flex items-start justify-between">
                                     <div className="flex-1 grid grid-cols-2 gap-4">
                                        <input 
                                          placeholder="Label do Campo"
                                          className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold"
                                          value={field.label}
                                        />
                                        <input 
                                          placeholder="field_key"
                                          className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-mono"
                                          value={field.key}
                                        />
                                     </div>
                                     <button className="p-2 ml-4 text-zinc-300 hover:text-rose-500">
                                        <Trash2 className="w-4 h-4" />
                                     </button>
                                  </div>
                                  <textarea 
                                    rows={2}
                                    placeholder="Instrução para coleta ou pergunta vinculada..."
                                    className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-xs"
                                    value={field.instruction}
                                  />
                               </div>
                             ))}
                          </div>
                        </section>
                     </div>
                  )}
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
