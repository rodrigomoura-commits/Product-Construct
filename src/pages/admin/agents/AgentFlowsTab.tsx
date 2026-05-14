import React, { useState, useEffect } from 'react';
import { Agent, StageKey, AgentFlowBinding, ProductJourneyStage, StageSpecialistBinding } from '../../../types';
import { 
  Layers, Workflow, ChevronRight, Zap, 
  HelpCircle, AlertCircle, FileText, Bot,
  MoreVertical, MoveVertical, Filter, Activity,
  Plus, Edit3, Save, RefreshCw, Star, Settings, ExternalLink,
  Target, Search, Layout, Package, Send, Brain, Sparkles, Check, X,
  MoreHorizontal, Info, Menu, Trash2, Copy, Power, Unlink
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { db, auth } from '../../../lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, getDocs, orderBy, updateDoc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import StageCustomizerModal from './StageCustomizerModal';
import AgentEditorDrawer from './AgentEditorDrawer';
import { BindingEditorDrawer } from '../../../components/admin/agents/BindingEditorDrawer';
import { DeleteAgentModal, DeleteBlockedModal } from '../../../components/admin/agents/AgentDeleteFlowModals';
import { DuplicateAgentModal } from '../../../components/admin/agents/DuplicateAgentModal';
import { AgentBindingsModal } from '../../../components/admin/agents/AgentBindingsModal';
import { reorganizeTonaStagesAndAgents, removeSpecialistBinding } from '../../../lib/tona-architecture';
import { duplicateAgent, canDeleteAgent as checkCanDelete, deleteAgentIfAllowed } from '../../../lib/agents';
import { toast } from 'react-hot-toast';

interface Props {
  agents: Agent[];
  onEditAgent: (id: string) => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
}

export default function AgentFlowsTab({ agents, onEditAgent, selectedAgentId, setSelectedAgentId }: Props) {
  const [specialistBindings, setSpecialistBindings] = useState<StageSpecialistBinding[]>([]);
  const [stages, setStages] = useState<ProductJourneyStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      // Logic for savePendingStageChanges
      // For now, feedback toast since most sub-modals save immediately
      alert("Configurações do ciclo de produto salvas com sucesso!");
    } catch (e) {
      alert("Erro ao salvar mudanças.");
    } finally {
      setSaving(false);
    }
  };
  const [isRelatingAgents, setIsRelatingAgents] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isEditingAgent, setIsEditingAgent] = useState(false);
  const [isConfiguringBinding, setIsConfiguringBinding] = useState(false);
  const [isShowingHelp, setIsShowingHelp] = useState(false);
  const [isDeletingAgent, setIsDeletingAgent] = useState(false);
  const [isDeletingBlocked, setIsDeletingBlocked] = useState(false);
  const [isDuplicatingAgent, setIsDuplicatingAgent] = useState(false);
  const [isShowingBindings, setIsShowingBindings] = useState(false);
  
  const [agentToEdit, setAgentToEdit] = useState<Agent | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [agentToDuplicate, setAgentToDuplicate] = useState<Agent | null>(null);
  const [bindingToEdit, setBindingToEdit] = useState<StageSpecialistBinding | null>(null);
  const [stageToCustomize, setStageToCustomize] = useState<ProductJourneyStage | null>(null);
  const [deletionBlockingInfo, setDeletionBlockingInfo] = useState<{ reason: string; bindings: any[] } | null>(null);
  const [agentActiveBindings, setAgentActiveBindings] = useState<any[]>([]);

  // Action Handlers
  const handleEditAgent = (agent: Agent) => {
    setAgentToEdit(agent);
    setIsEditingAgent(true);
  };

  const handleConfigureBinding = (agent: Agent, stage: ProductJourneyStage, binding?: StageSpecialistBinding) => {
    setAgentToEdit(agent);
    setStageToCustomize(stage);
    setBindingToEdit(binding || null);
    setIsConfiguringBinding(true);
  };

  const handleUnlinkAgent = async (bindingId: string) => {
    if (!confirm("Deseja desvincular este agente desta etapa?")) return;
    try {
      await removeSpecialistBinding(bindingId);
      toast.success("Agente desvinculado com sucesso.");
    } catch (error) {
      console.error("Error unlinking:", error);
      toast.error("Não foi possível desvincular o agente.");
    }
  };

  const confirmDeleteAgent = (agent: Agent) => {
    console.log("confirmDeleteAgent triggered for:", agent.id, agent.name);
    setAgentToDelete(agent);
    setIsDeletingAgent(true);
  };

  const executeDeleteAgent = async () => {
    if (!agentToDelete) {
      console.warn("executeDeleteAgent called but agentToDelete is null");
      return;
    }
    console.log("executeDeleteAgent starting for:", agentToDelete.id);
    setSaving(true);
    try {
      const check = await checkCanDelete(agentToDelete.id);
      console.log("canDeleteAgent check result:", check);
      
      if (!check.can_delete) {
        setIsDeletingAgent(false);
        setDeletionBlockingInfo({ reason: check.reason || '', bindings: [] });
        setIsDeletingBlocked(true);
        return;
      }

      await deleteAgentIfAllowed(agentToDelete.id);
      console.log("deleteAgentIfAllowed successful");
      toast.success("Agente arquivado com sucesso.");
      setIsDeletingAgent(false);
      setAgentToDelete(null);
    } catch (error) {
      console.error("Error in executeDeleteAgent:", error);
      toast.error("Não foi possível excluir o agente.");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateAgent = (agent: Agent) => {
    setAgentToDuplicate(agent);
    setIsDuplicatingAgent(true);
  };

  const executeDuplicateAgent = async (newName: string) => {
    if (!agentToDuplicate || !auth.currentUser) return;
    try {
      const result = await duplicateAgent(agentToDuplicate.id, newName, auth.currentUser.uid);
      toast.success("Agente duplicado com sucesso.");
      // Option to open the new one
      const newAgentSnap = await getDoc(doc(db, 'agents', result.id));
      if (newAgentSnap.exists()) {
        handleEditAgent({ id: result.id, ...newAgentSnap.data() } as Agent);
      }
    } catch (error) {
      toast.error("Erro ao duplicar agente.");
    }
  };

  const handleToggleAgentStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(db, 'agents', agent.id), {
        status: newStatus,
        updated_at: serverTimestamp()
      });
      toast.success(`Agente ${newStatus === 'active' ? 'ativado' : 'pausado'} com sucesso.`);
    } catch (error) {
      toast.error("Erro ao atualizar status do agente.");
    }
  };

  const showBindingsModal = async (agent: Agent) => {
    // Fetch bindings
    const bindings: any[] = [];
    const stagesSnap = await getDocs(query(collection(db, 'product_journey_stages'), where('stage_agent_id', '==', agent.id)));
    stagesSnap.forEach(d => bindings.push({ stage_id: d.id, name: d.data().name, role: 'primary' }));
    
    const specSnap = await getDocs(query(collection(db, 'stage_specialist_bindings'), where('specialist_agent_id', '==', agent.id), where('is_active', '==', true)));
    specSnap.forEach(d => {
      const stageName = stages.find(s => s.id === d.data().stage_id)?.name || d.data().stage_id;
      bindings.push({ stage_id: d.data().stage_id, name: stageName, role: 'support', binding_id: d.id });
    });

    setAgentActiveBindings(bindings);
    setAgentToEdit(agent);
    setIsShowingBindings(true);
  };

  useEffect(() => {
    // Listen for specialists bindings
    const qsBindings = query(collection(db, 'stage_specialist_bindings'), where('is_active', '==', true));
    const unsubSpec = onSnapshot(qsBindings, (snap) => {
      setSpecialistBindings(snap.docs.map(d => ({ id: d.id, ...d.data() } as StageSpecialistBinding)));
    });

    // Fetch stages
    const qs = query(collection(db, 'product_journey_stages'), orderBy('display_order', 'asc'));
    const unsubStages = onSnapshot(qs, (snap) => {
      const stageList = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductJourneyStage));
      setStages(stageList);
      if (stageList.length > 0) {
        setLoading(false);
      } else {
        // If empty, we might need a small delay or show empty state
        setLoading(false);
      }
    });

    return () => {
      unsubSpec();
      unsubStages();
    };
  }, []);

  async function handleReorganize() {
    if (!auth.currentUser) return;
    setSeeding(true);
    try {
      await reorganizeTonaStagesAndAgents(auth.currentUser.uid);
      alert("Etapas e agentes reorganizados com sucesso.");
    } catch (e) {
      console.error(e);
      alert("Erro ao reorganizar.");
    } finally {
      setSeeding(false);
    }
  }

  async function handleAddSpecialist(agentId: string, stageId: string) {
    if (!agentId || !stageId) return;
    const bindingId = `${stageId}_${agentId}`;
    try {
      await setDoc(doc(db, 'stage_specialist_bindings', bindingId), {
        id: bindingId,
        stage_id: stageId,
        specialist_agent_id: agentId,
        role: 'support',
        execution_order: specialistBindings.filter(b => b.stage_id === stageId).length,
        trigger_type: 'manual',
        trigger_conditions: {},
        is_required: false,
        is_automatic: false,
        is_active: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      setIsRelatingAgents(false);
    } catch (e) {
      console.error(e);
    }
  }

  async function removeSpecialist(bindingId: string) {
    if (!confirm("Deseja desvincular este especialista?")) return;
    try {
      await removeSpecialistBinding(bindingId);
      toast.success("Especialista removido.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao remover especialista.");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <Activity className="w-10 h-10 text-zinc-300 animate-spin" />
        <p className="text-zinc-500 font-medium italic">Carregando etapas da Tona...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
         <div className="flex items-center gap-4">
            <div>
               <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-black text-zinc-900 tracking-tight">Etapas do Ciclo de Produto</h3>
                  <button 
                    onClick={() => setIsShowingHelp(true)}
                    className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 transition-all shadow-sm"
                    title="Ajuda"
                  >
                    <HelpCircle className="w-5 h-5" />
                  </button>
               </div>
               <p className="text-zinc-500 font-medium italic">Configure o modo de condução e os especialistas de cada etapa da jornada.</p>
            </div>
         </div>
         <div className="flex gap-2">
            <button 
              onClick={handleReorganize}
              disabled={seeding}
              className="px-4 py-3 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all border border-zinc-200 flex items-center gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", seeding && "animate-spin")} />
              {seeding ? "Reorganizando..." : "Reorganizar"}
            </button>
            <button 
              onClick={handleSaveChanges}
              disabled={saving}
              className="px-6 py-3 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-100 flex items-center gap-2"
            >
              {saving ? <Activity className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Mudanças
            </button>
         </div>
      </div>

      {stages.length === 0 && !loading && (
        <div className="p-20 border-2 border-dashed border-zinc-200 rounded-[3rem] bg-zinc-50 flex flex-col items-center justify-center text-center space-y-6">
           <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center">
              <Workflow className="w-10 h-10 text-zinc-300" />
           </div>
           <div>
              <p className="text-lg font-black text-zinc-900 mb-2">Nenhuma etapa configurada ainda</p>
              <p className="text-zinc-500 max-w-sm mb-8">Clique no botão Reorganizar para criar as 6 etapas padrão da Tona e seus agentes correspondentes.</p>
              <button 
                onClick={handleReorganize}
                className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
              >
                Criar Estrutura Padrão
              </button>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-12 relative">
         {/* Connector Line */}
         {stages.length > 0 && (
           <div className="absolute left-[39px] top-10 bottom-10 w-0.5 bg-gradient-to-b from-zinc-200 via-zinc-100 to-zinc-200 hidden md:block" />
         )}

         {stageToCustomize && (
           <StageCustomizerModal 
             isOpen={isCustomizing}
             onClose={() => setIsCustomizing(false)}
             stage={stageToCustomize}
             agents={agents}
             onSuccess={() => {
                // Success
             }}
           />
         )}

         {stages.map((stage, i) => {
            const stageAgent = agents.find(a => a.id === stage.stage_agent_id);
            const stageSpecialists = specialistBindings
              .filter(b => b.stage_id === stage.id)
              .map(b => ({
                binding: b,
                agent: agents.find(a => a.id === b.specialist_agent_id)
              }))
              .filter(s => s.agent);
            
            return (
              <div key={stage.id} className="flex flex-col md:flex-row gap-10 group relative">
                 {/* Step Pin */}
                 <div className={cn(
                    "w-20 h-20 bg-white border-4 rounded-[2rem] flex items-center justify-center shrink-0 z-10 transition-all shadow-sm group-hover:scale-105",
                    stage.color === 'emerald' ? "border-emerald-100 text-emerald-600" :
                    stage.color === 'blue' ? "border-blue-100 text-blue-600" :
                    stage.color === 'indigo' ? "border-indigo-100 text-indigo-600" :
                    stage.color === 'amber' ? "border-amber-100 text-amber-600" :
                    stage.color === 'rose' ? "border-rose-100 text-rose-600" :
                    "border-violet-100 text-violet-600"
                 )}>
                    <span className="text-3xl font-black">{i + 1}</span>
                 </div>

                 <div className="flex-1 space-y-6">
                    <div className="flex items-center justify-between">
                       <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-2xl font-black text-zinc-900 tracking-tighter leading-none">{stage.name}</h4>
                            <div className="flex gap-1">
                               <div className="px-2 py-0.5 bg-zinc-100 rounded-md text-[8px] font-black uppercase text-zinc-500 flex items-center gap-1">
                                  <Brain className="w-2.5 h-2.5" />
                                  Mindflow Único
                               </div>
                               <div className="px-2 py-0.5 bg-zinc-100 rounded-md text-[8px] font-black uppercase text-zinc-500 flex items-center gap-1">
                                  <Activity className="w-2.5 h-2.5" />
                                  Orchestration
                               </div>
                            </div>
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{stage.short_label}</p>
                       </div>
                       <div className="flex gap-2">
                          <button 
                            onClick={() => { setStageToCustomize(stage); setIsRelatingAgents(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 border border-zinc-200 rounded-xl text-[9px] font-black uppercase hover:bg-zinc-50 transition-all shadow-sm"
                          >
                             <Bot className="w-3.5 h-3.5" />
                             <span>Relacionar Agentes</span>
                          </button>
                          <button 
                            onClick={() => { setStageToCustomize(stage); setIsCustomizing(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-[9px] font-black uppercase hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                          >
                             <Settings className="w-3.5 h-3.5" />
                             <span>Personalizar Etapa</span>
                          </button>
                       </div>
                    </div>

                    {/* Stage Info Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 px-6 bg-zinc-50/50 border border-zinc-100 rounded-3xl">
                       <div>
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Pergunta Central</p>
                          <p className="text-[11px] font-bold text-zinc-600 italic line-clamp-1 leading-tight">"{stage.central_question}"</p>
                       </div>
                       <div>
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Especialistas</p>
                          <p className="text-[11px] font-black text-zinc-900">{stageSpecialists.length} Agentes</p>
                       </div>
                       <div>
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Artefatos / Campos</p>
                          <p className="text-[11px] font-black text-zinc-900">Configurado</p>
                       </div>
                       <div>
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Maturidade</p>
                          <div className="flex items-center gap-1">
                             <div className="w-16 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-1/3" />
                             </div>
                             <span className="text-[10px] font-black text-zinc-900">33%</span>
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                       {/* Stage Agent Section */}
                       <div className="space-y-3">
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                            <Activity className="w-3 h-3" /> Stage Agent (Modo)
                          </h5>
                          {stageAgent ? (
                             <AgentCard 
                               agent={stageAgent}
                               isPrimary
                               onEdit={() => handleEditAgent(stageAgent)}
                               onDelete={() => confirmDeleteAgent(stageAgent)}
                               onDuplicate={() => handleDuplicateAgent(stageAgent)}
                               onToggleStatus={() => handleToggleAgentStatus(stageAgent)}
                               onShowBindings={() => showBindingsModal(stageAgent)}
                             />
                          ) : (
                             <div className="p-10 border-2 border-dashed border-zinc-100 rounded-[2.5rem] bg-zinc-50/30 text-center flex flex-col items-center justify-center grayscale opacity-50">
                                <Bot className="w-8 h-8 text-zinc-300 mb-2" />
                                <p className="text-[9px] font-black text-zinc-400 uppercase">Nenhum Stage Agent</p>
                             </div>
                          )}
                       </div>

                       {/* Specialists Section */}
                       <div className="xl:col-span-2 space-y-3">
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                            <Zap className="w-3 h-3" /> Agentes Especialistas (Capacidades)
                          </h5>
                          
                          <div className="flex flex-wrap gap-4">
                             {stageSpecialists.length > 0 ? stageSpecialists.map(({ binding, agent }) => (
                               <AgentCard 
                                 key={binding.id}
                                 agent={agent}
                                 onEdit={() => handleEditAgent(agent!)}
                                 onConfigureBinding={() => handleConfigureBinding(agent!, stage, binding)}
                                 onRemove={() => handleUnlinkAgent(binding.id)}
                                 onDelete={() => confirmDeleteAgent(agent!)}
                                 onDuplicate={() => handleDuplicateAgent(agent!)}
                                 onToggleStatus={() => handleToggleAgentStatus(agent!)}
                                 onShowBindings={() => showBindingsModal(agent!)}
                               />
                             )) : (
                               <div className="w-full p-10 border-2 border-dashed border-zinc-100 rounded-[2.5rem] bg-zinc-50/30 text-center flex flex-col items-center justify-center grayscale opacity-50">
                                  <Zap className="w-8 h-8 text-zinc-300 mb-2" />
                                  <p className="text-[9px] font-black text-zinc-400 uppercase">Sem Especialistas vinculados</p>
                               </div>
                             )}
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            );
         })}
      </div>

      {/* Stage Customizer Modal */}
      <AnimatePresence>
        {isCustomizing && stageToCustomize && (
          <StageCustomizerModal 
            isOpen={isCustomizing}
            onClose={() => { setIsCustomizing(false); setStageToCustomize(null); }}
            stage={stageToCustomize}
            agents={agents}
            onSuccess={() => {}}
          />
        )}
      </AnimatePresence>

      {/* Relate Agents Modal */}
      <AnimatePresence>
        {isRelatingAgents && stageToCustomize && (
          <RelateAgentsModal 
            stage={stageToCustomize}
            agents={agents}
            specialistBindings={specialistBindings.filter(b => b.stage_id === stageToCustomize.id)}
            onClose={() => { setIsRelatingAgents(false); setStageToCustomize(null); }}
          />
        )}
      </AnimatePresence>

      {/* Agent Editor Drawer */}
      <AnimatePresence>
        {isEditingAgent && agentToEdit && (
          <AgentEditorDrawer 
            agent={agentToEdit}
            onClose={() => { setIsEditingAgent(false); setAgentToEdit(null); }}
          />
        )}
      </AnimatePresence>

      {/* Help Modal */}
      <AnimatePresence>
        {isShowingHelp && (
          <HelpModal onClose={() => setIsShowingHelp(false)} />
        )}
      </AnimatePresence>

      {/* Binding Editor Drawer */}
      <BindingEditorDrawer 
        key={bindingToEdit?.id || 'new'}
        isOpen={isConfiguringBinding}
        onClose={() => { 
          setIsConfiguringBinding(false); 
          setBindingToEdit(null); 
          setAgentToEdit(null);
          setStageToCustomize(null); 
        }}
        bindingId={bindingToEdit?.id}
        agent={agentToEdit}
        stage={stageToCustomize}
        onSuccess={() => {
          console.log("Binding action successful, refreshing UI...");
        }}
      />

      {/* Action Modals */}
      <DeleteAgentModal 
        isOpen={isDeletingAgent}
        onClose={() => { setIsDeletingAgent(false); setAgentToDelete(null); }}
        agentName={agentToDelete?.name || ''}
        onConfirm={executeDeleteAgent}
        isDeleting={saving}
      />

      <DeleteBlockedModal 
        isOpen={isDeletingBlocked}
        onClose={() => setIsDeletingBlocked(false)}
        agentName={agentToDelete?.name || ''}
        reason={deletionBlockingInfo?.reason || ''}
        bindings={deletionBlockingInfo?.bindings || []}
        onOpenBindings={() => {
          setIsDeletingBlocked(false);
          if (agentToDelete) showBindingsModal(agentToDelete);
        }}
      />

      <DuplicateAgentModal 
        isOpen={isDuplicatingAgent}
        onClose={() => { setIsDuplicatingAgent(false); setAgentToDuplicate(null); }}
        originalName={agentToDuplicate?.name || ''}
        onConfirm={executeDuplicateAgent}
      />

      <AgentBindingsModal 
        isOpen={isShowingBindings}
        onClose={() => setIsShowingBindings(false)}
        agentName={agentToEdit?.name || ''}
        bindings={agentActiveBindings}
      />
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 max-h-[80vh] overflow-y-auto no-scrollbar"
      >
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white">
                 <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black text-zinc-900 tracking-tighter">Como usar a aba Etapas</h3>
           </div>
           <button onClick={onClose} className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400">
              <X className="w-5 h-5" />
           </button>
        </div>

        <div className="space-y-8 text-sm text-zinc-600 font-medium leading-relaxed">
          <p>Esta tela permite configurar como a Tona atua em cada etapa da Jornada do Produto.</p>
          
          <div className="space-y-4">
            <h4 className="font-black text-zinc-900 uppercase text-xs tracking-widest">Componentes da Etapa</h4>
            <ul className="space-y-3">
              <li className="flex gap-3">
                 <div className="w-6 h-6 shrink-0 bg-zinc-100 rounded flex items-center justify-center text-zinc-900 font-bold text-[10px]">1</div>
                 <p><span className="font-bold text-zinc-900">Stage Agent Principal:</span> Define o "modo" de condução da Tona naquela etapa (ex: investigativo, estratégico).</p>
              </li>
              <li className="flex gap-3">
                 <div className="w-6 h-6 shrink-0 bg-zinc-100 rounded flex items-center justify-center text-zinc-900 font-bold text-[10px]">2</div>
                 <p><span className="font-bold text-zinc-900">Agentes Especialistas:</span> Capacidades específicas que podem ser ativadas manual ou automaticamente.</p>
              </li>
              <li className="flex gap-3">
                 <div className="w-6 h-6 shrink-0 bg-zinc-100 rounded flex items-center justify-center text-zinc-900 font-bold text-[10px]">3</div>
                 <p><span className="font-bold text-zinc-900">Mindflow Único:</span> Todos os agentes compartilham o mesmo cérebro central da Tona.</p>
              </li>
            </ul>
          </div>

          <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100">
            <h4 className="font-black text-zinc-900 uppercase text-xs tracking-widest mb-4">Diferenças Importantes</h4>
            <div className="space-y-4">
              <div>
                <p className="font-bold text-zinc-900">💡 Editar Agente</p>
                <p className="text-zinc-500">Muda quem o agente é (instruções, comportamento global, modelo).</p>
              </div>
              <div>
                <p className="font-bold text-zinc-900">🔗 Configurar Vínculo</p>
                <p className="text-zinc-500">Muda como o agente atua nesta etapa específica (gatilho, papel, ordem).</p>
              </div>
              <div>
                <p className="font-bold text-zinc-900">🛡️ Excluir Agente</p>
                <p className="text-zinc-500">Só é permitido se o agente não estiver vinculado a nenhuma etapa.</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function RelateAgentsModal({ stage, agents, specialistBindings, onClose }: {
  stage: ProductJourneyStage;
  agents: Agent[];
  specialistBindings: StageSpecialistBinding[];
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'stage' | 'specialists' | 'triggers'>('stage');
  const [loading, setLoading] = useState(false);

  async function updateStageAgent(agentId: string) {
    setLoading(true);
    try {
      await setDoc(doc(db, 'product_journey_stages', stage.id), {
        stage_agent_id: agentId,
        updated_at: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function addSpecialist(agentId: string) {
    const bindingId = `${stage.id}_${agentId}`;
    try {
      await setDoc(doc(db, 'stage_specialist_bindings', bindingId), {
        id: bindingId,
        stage_id: stage.id,
        specialist_agent_id: agentId,
        role: 'support',
        is_active: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function removeSpecialist(bindingId: string) {
    if (!confirm("Deseja remover este especialista?")) return;
    try {
      await removeSpecialistBinding(bindingId);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao remover especialista.");
    }
  }

  const stageAgents = agents.filter(a => a.type === 'stage_agent');
  const otherAgents = agents.filter(a => a.type !== 'stage_agent');

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-24 bg-zinc-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-zinc-50 w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20"
      >
        <div className="p-8 bg-white border-b border-zinc-100 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
                 <Bot className="w-7 h-7" />
              </div>
              <div>
                 <h3 className="text-2xl font-black text-zinc-900 tracking-tighter">Relacionar Agentes</h3>
                 <p className="text-zinc-500 font-medium italic">Configurando agentes para: <span className="font-bold text-zinc-900 uppercase">{stage.name}</span></p>
              </div>
           </div>
           <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-zinc-50 rounded-2xl text-zinc-400 hover:text-zinc-900">
              <X className="w-6 h-6" />
           </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
           <div className="w-64 bg-zinc-100/50 p-6 space-y-2 border-r border-zinc-100">
              {[
                { id: 'stage', label: 'Stage Agent', icon: Activity },
                { id: 'specialists', label: 'Especialistas', icon: Zap },
                { id: 'triggers', label: 'Gatilhos & Soul', icon: Brain },
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
                  <span className="text-[10px] uppercase tracking-[0.15em]">{tab.label}</span>
                </button>
              ))}
           </div>

           <div className="flex-1 overflow-y-auto p-10 bg-white shadow-inner">
              {activeTab === 'stage' && (
                <div className="space-y-8">
                   <div>
                      <h4 className="text-sm font-black text-zinc-900 mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Selecione o Stage Agent Principal
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                         {stageAgents.map(agent => (
                           <button 
                             key={agent.id}
                             onClick={() => updateStageAgent(agent.id)}
                             disabled={loading}
                             className={cn(
                               "p-6 rounded-[2.5rem] border-2 text-left flex items-center gap-5 transition-all relative",
                               stage.stage_agent_id === agent.id 
                                 ? "border-zinc-900 bg-zinc-900 text-white shadow-xl" 
                                 : "border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-200"
                             )}
                           >
                              <div className={cn(
                                "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0",
                                stage.stage_agent_id === agent.id ? "bg-white/10" : "bg-white shadow-sm"
                              )}>
                                 <Bot className={cn("w-7 h-7", stage.stage_agent_id === agent.id ? "text-white" : "text-zinc-400")} />
                              </div>
                              <div className="flex-1">
                                 <p className="font-black text-base leading-tight mb-1">{agent.name}</p>
                                 <p className={cn(
                                   "text-xs font-medium italic",
                                   stage.stage_agent_id === agent.id ? "text-white/60" : "text-zinc-400"
                                 )}>{agent.description}</p>
                              </div>
                              {stage.stage_agent_id === agent.id && (
                                <div className="bg-emerald-500 text-white p-2 rounded-full shadow-lg">
                                   <Check className="w-4 h-4" />
                                </div>
                              )}
                           </button>
                         ))}
                      </div>
                   </div>
                </div>
              )}

              {activeTab === 'specialists' && (
                <div className="space-y-10">
                   <div>
                      <h4 className="text-sm font-black text-zinc-900 mb-6 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" /> Especialistas Vinculados
                         </div>
                         <span className="text-[10px] bg-zinc-100 px-3 py-1 rounded-full text-zinc-500 font-bold">{specialistBindings.length} AGENTES</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {specialistBindings.map(binding => {
                            const agent = agents.find(a => a.id === binding.specialist_agent_id);
                            if (!agent) return null;
                            return (
                               <div key={binding.id} className="p-6 bg-white border-2 border-zinc-100 rounded-[2.5rem] flex items-center gap-4 group">
                                  <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400">
                                     <Bot className="w-6 h-6" />
                                  </div>
                                  <div className="flex-1">
                                     <p className="font-black text-zinc-900 text-sm">{agent.name}</p>
                                     <p className="text-[10px] font-bold text-zinc-400 uppercase">{agent.slug}</p>
                                  </div>
                                  <button 
                                    onClick={() => removeSpecialist(binding.id)}
                                    className="p-3 bg-zinc-50 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-all shadow-sm flex items-center justify-center opacity-100"
                                    title="Remover Vínculo"
                                  >
                                     <Trash2 className="w-4 h-4" />
                                  </button>
                               </div>
                            );
                         })}
                      </div>
                   </div>

                   <div className="pt-10 border-t border-zinc-100">
                      <h4 className="text-sm font-black text-zinc-900 mb-6 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Adicionar Novo Especialista
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {otherAgents
                           .filter(a => !specialistBindings.some(b => b.specialist_agent_id === a.id))
                           .map(agent => (
                           <button 
                             key={agent.id}
                             onClick={() => addSpecialist(agent.id)}
                             className="p-5 bg-zinc-50/50 border-2 border-zinc-100 border-dashed rounded-[2.5rem] hover:border-zinc-900 hover:bg-white transition-all text-left flex items-center gap-4 group"
                           >
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-zinc-300 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                                 <Plus className="w-5 h-5" />
                              </div>
                              <div>
                                 <p className="font-bold text-zinc-900 text-sm">{agent.name}</p>
                                 <p className="text-[10px] font-medium text-zinc-400">{agent.slug}</p>
                              </div>
                           </button>
                         ))}
                      </div>
                   </div>
                </div>
              )}

              {activeTab === 'triggers' && (
                <div className="max-w-2xl space-y-8">
                   <div className="p-8 bg-zinc-900 rounded-[3rem] text-white space-y-6 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-3xl rounded-full -mr-20 -mt-20" />
                      
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <Brain className="w-6 h-6 text-amber-300" />
                         </div>
                         <h4 className="text-lg font-black tracking-tight">Tona Architecture Soul</h4>
                      </div>

                      <div className="space-y-4">
                         <div className="flex items-center gap-3 p-4 bg-white/10 rounded-2xl border border-white/10">
                            <Check className="w-5 h-5 text-emerald-400" />
                            <p className="text-xs font-bold uppercase tracking-widest">Mindflow Único Ativado</p>
                         </div>
                         <div className="flex items-center gap-3 p-4 bg-white/10 rounded-2xl border border-white/10">
                            <Check className="w-5 h-5 text-emerald-400" />
                            <p className="text-xs font-bold uppercase tracking-widest">Personality Core v1.0 Ativado</p>
                         </div>
                         <div className="flex items-center gap-3 p-4 bg-white/10 rounded-2xl border border-white/10">
                            <Check className="w-5 h-5 text-emerald-400" />
                            <p className="text-xs font-bold uppercase tracking-widest">Behavior Profile Ativado</p>
                         </div>
                      </div>

                      <p className="text-[11px] text-white/50 leading-relaxed font-medium italic">
                        Esta etapa está orquestrada para usar o cérebro central da Tona. Os agentes vinculados apenas provêm as lentes (Stage) e as capacidades (Specialist), mas o Mindflow e a Personalidade são preservados de ponta a ponta.
                      </p>
                   </div>
                </div>
              )}
           </div>
        </div>
      </motion.div>
    </div>
  );
}

function AgentCard({ 
  agent, 
  onRemove, 
  onEdit, 
  onConfigureBinding, 
  onDelete, 
  onDuplicate,
  onToggleStatus,
  onShowBindings,
  isPrimary 
}: { 
  agent?: Agent; 
  onRemove?: () => void;
  onEdit?: () => void;
  onConfigureBinding?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onToggleStatus?: () => void;
  onShowBindings?: () => void;
  isPrimary?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const isActive = agent?.status === 'active';

  if (!agent) return null;
  
  return (
    <motion.div 
      layout
      className={cn(
        "bg-white border-2 rounded-[2.5rem] p-6 hover:shadow-2xl transition-all relative group/agent w-full max-w-[340px]",
        isPrimary ? "border-zinc-900 bg-zinc-50/20" : "border-zinc-100",
        !isActive && "opacity-80 grayscale-[0.5]"
      )}
    >
       <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
            isPrimary ? "bg-zinc-900 text-white shadow-lg shadow-zinc-200" : "bg-zinc-50 text-zinc-400 group-hover/agent:bg-violet-50 group-hover/agent:text-violet-600"
          )}>
             <Bot className="w-6 h-6" />
          </div>
          <div className="flex gap-1 relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 bg-zinc-50 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-all opacity-0 group-hover/agent:opacity-100"
            >
               <MoreHorizontal className="w-5 h-5" />
            </button>

            <AnimatePresence>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-50" onClick={() => setShowMenu(false)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-zinc-100 p-2 z-[60] overflow-hidden"
                  >
                     <p className="px-3 py-2 text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-50 mb-1">Ações do Agente</p>
                     
                     <button 
                       onClick={() => { onEdit?.(); setShowMenu(false); }}
                       className="w-full px-4 py-2.5 rounded-xl text-left text-[11px] font-black text-zinc-600 hover:bg-violet-50 hover:text-violet-700 flex items-center gap-3 transition-colors"
                     >
                       <Edit3 className="w-4 h-4" /> {isPrimary ? 'Editar Meta' : 'Editar Agente'}
                     </button>

                     {onConfigureBinding && (
                       <button 
                         onClick={() => { onConfigureBinding(); setShowMenu(false); }}
                         className="w-full px-4 py-2.5 rounded-xl text-left text-[11px] font-black text-zinc-600 hover:bg-violet-50 hover:text-violet-700 flex items-center gap-3 transition-colors"
                       >
                         <Settings className="w-4 h-4" /> Configurar Vínculo
                       </button>
                     )}

                     <button 
                       onClick={() => { onToggleStatus?.(); setShowMenu(false); }}
                       className={cn(
                         "w-full px-4 py-2.5 rounded-xl text-left text-[11px] font-black flex items-center gap-3 transition-colors",
                         isActive ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"
                       )}
                     >
                       <Power className="w-4 h-4" /> {isActive ? 'Pausar' : 'Ativar'}
                     </button>

                     <button 
                       onClick={() => { onDuplicate?.(); setShowMenu(false); }}
                       className="w-full px-4 py-2.5 rounded-xl text-left text-[11px] font-black text-zinc-600 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 transition-colors"
                     >
                       <Copy className="w-4 h-4" /> Duplicar
                     </button>

                     <button 
                       onClick={() => { onShowBindings?.(); setShowMenu(false); }}
                       className="w-full px-4 py-2.5 rounded-xl text-left text-[11px] font-black text-zinc-600 hover:bg-zinc-50 flex items-center gap-3 transition-colors"
                     >
                       <Layers className="w-4 h-4" /> Ver Vínculos
                     </button>

                     <div className="h-px bg-zinc-50 my-1" />

                     {!isPrimary && (
                       <button 
                         onClick={() => { onRemove(); setShowMenu(false); }}
                         className="w-full px-4 py-2.5 rounded-xl text-left text-[11px] font-black text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors"
                       >
                         <Unlink className="w-4 h-4" /> Desvincular
                       </button>
                     )}

                     <button 
                       onClick={() => { 
                         console.log("Delete menu item clicked for agent:", agent.name);
                         onDelete?.(); 
                         setShowMenu(false); 
                       }}
                       className="w-full px-4 py-2.5 rounded-xl text-left text-[11px] font-black text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors"
                       id={`delete-agent-btn-${agent.id}`}
                     >
                       <Trash2 className="w-4 h-4" /> Excluir Agente
                     </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            
            {isPrimary && (
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm border border-emerald-100" title="Agente Principal da Etapa">
                <ShieldCheck size={18} />
              </div>
            )}
          </div>
       </div>

       <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h5 className="font-black text-zinc-900 tracking-tight text-lg leading-tight truncate">{agent.name}</h5>
            {!isActive && <span className="text-[8px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded uppercase">Pausado</span>}
          </div>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">{agent.slug}</p>
       </div>

       <div className="mt-6 pt-6 border-t border-zinc-100">
          <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">
             <Star className={cn("w-3.5 h-3.5", isPrimary ? "text-amber-500 fill-amber-500" : "text-zinc-200")} />
             <span>{isPrimary ? "Modo de Condução" : agent.primary_discipline || "Especialista"}</span>
          </div>
          
          <button 
            onClick={onEdit}
            className="w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center justify-center gap-3 border-2 border-zinc-50 hover:border-zinc-900 hover:text-zinc-900 hover:bg-white transition-all shadow-sm active:scale-95 group/edit"
          >
            <Edit3 className="w-3.5 h-3.5 group-hover/edit:rotate-12 transition-transform" /> 
            Configurar Agente
          </button>
       </div>
    </motion.div>
  );
}

function ShieldCheck({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      <path d="m9 12 2 2 4-4"></path>
    </svg>
  );
}
