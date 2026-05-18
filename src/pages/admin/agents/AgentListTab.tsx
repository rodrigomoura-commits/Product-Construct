import React, { useState } from 'react';
import { Agent } from '../../../types';
import { 
  Bot, Search, Plus, Filter, 
  MoreHorizontal, Edit3, Copy, Trash2, 
  Tag, ChevronRight, Activity, Zap, Loader2, AlertCircle,
  Sparkles, Brain, X, MoreVertical, Settings, ChevronDown, History, RefreshCw
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { 
  updateAgent, duplicateAgent, deleteAgentIfAllowed, canDeleteAgent, 
  seedDefaultAgents 
} from '../../../lib/agents';
import { seedTonaArchitecture } from '../../../lib/tona-architecture';
import { auth, db } from '../../../lib/firebase';
import CreateAgentModal from './CreateAgentModal';

interface Props {
  agents: Agent[];
  loading: boolean;
  onEdit: (id: string) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  showArchived: boolean;
  setShowArchived: (show: boolean) => void;
}

export default function AgentListTab({ 
  agents, 
  loading, 
  onEdit, 
  selectedId, 
  setSelectedId,
  showArchived,
  setShowArchived
}: Props) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string | 'all'>('all');
  const [seeding, setSeeding] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const [isConfirmingDelete, setIsConfirmingDelete] = useState<string | null>(null);

  async function handleDelete(agentId: string) {
    setMenuOpen(null);
    try {
      await deleteAgentIfAllowed(agentId);
      toast.success("Agente arquivado com sucesso.");
      setIsConfirmingDelete(null);
    } catch (e) {
      toast.error("Erro ao excluir: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleDuplicateAction(agent: Agent) {
    setMenuOpen(null);
    if (!auth.currentUser) return;
    try {
      await duplicateAgent(agent.id, `${agent.name} (Cópia)`, auth.currentUser.uid);
      toast.success("Agente duplicado com sucesso.");
    } catch (e) {
      toast.error("Erro ao duplicar.");
    }
  }

  async function handleToggleStatus(agent: Agent) {
    setMenuOpen(null);
    try {
      const newStatus = agent.status === 'active' ? 'paused' : 'active';
      if (newStatus === 'active' && !agent.active_version_id) {
        toast.error("Não é possível ativar um agente sem uma versão publicada.");
        return;
      }
      await updateAgent(agent.id, { status: newStatus });
      toast.success(`Agente ${newStatus === 'active' ? 'ativado' : 'pausado'} com sucesso.`);
    } catch (e) {
      toast.error("Erro ao alterar status.");
    }
  }

  async function handleRestore(agentId: string) {
    setMenuOpen(null);
    try {
      await updateAgent(agentId, { status: 'paused' });
      toast.success("Agente restaurado com sucesso (status: pausado).");
    } catch (e) {
      toast.error("Erro ao restaurar: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleSeed() {
    if (!auth.currentUser) return;
    setSeeding(true);
    try {
      await seedDefaultAgents(auth.currentUser.uid);
      await seedTonaArchitecture(auth.currentUser.uid);
      toast.success("Carga inicial de agentes concluída!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao semear agentes.");
    } finally {
      setSeeding(false);
    }
  }

  const filtered = agents.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || 
                         a.slug.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || a.type === filterType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white border border-dashed border-zinc-200 rounded-[2.5rem]">
        <Loader2 className="w-10 h-10 animate-spin text-zinc-300" />
        <p className="text-zinc-500 font-bold mt-4 uppercase tracking-widest text-[10px]">Carregando agentes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
         <div className="flex flex-1 gap-2 w-full max-w-xl">
            <div className="relative flex-1">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
               <input 
                 type="text" 
                 placeholder="Buscar por nome ou slug..."
                 className="w-full pl-11 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all font-medium text-sm"
                 value={search}
                 onChange={e => setSearch(e.target.value)}
               />
            </div>
            <select 
              className="px-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-bold outline-none"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
               <option value="all">Tipos: Todos</option>
               <option value="orchestrator">Orquestrador</option>
               <option value="discovery">Discovery</option>
               <option value="strategy">Estratégia</option>
               <option value="product">Produto</option>
            </select>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={cn(
                "px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border shrink-0 flex items-center gap-2",
                showArchived 
                  ? "bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-200" 
                  : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300"
              )}
            >
              <History className="w-3.5 h-3.5" />
              {showArchived ? "Ocultar Arquivados" : "Mostrar Arquivados"}
            </button>
         </div>
         <div className="flex gap-2">
            <button 
              onClick={handleSeed}
              disabled={seeding}
              className="px-4 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-100 transition-all border border-zinc-200 text-zinc-500 text-xs disabled:opacity-50"
            >
               {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
               Carga Inicial
            </button>
            <button 
              onClick={() => setIsCreating(true)}
              className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg active:scale-95"
            >
               <Plus className="w-5 h-5" /> Novo Agente
            </button>
         </div>
      </div>

      {/* Create Agent Modal */}
      <CreateAgentModal 
        isOpen={isCreating} 
        onClose={() => setIsCreating(false)} 
        onSuccess={() => {
          // Success message handled in component
        }} 
      />

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((agent, i) => (
          <motion.div 
            key={agent.id || i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white border border-zinc-200 rounded-[2.5rem] p-7 hover:border-zinc-900 transition-all group relative overflow-hidden flex flex-col h-full shadow-sm hover:shadow-xl hover:shadow-zinc-100"
          >
             {/* Confirmation Overlay */}
             <AnimatePresence>
               {isConfirmingDelete === agent.id && (
                 <motion.div 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="absolute inset-0 z-50 bg-zinc-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
                 >
                    <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
                    <h4 className="text-white font-black text-lg mb-2">Arquivar Agente?</h4>
                    <p className="text-zinc-400 text-xs font-medium mb-8">Esta ação removerá o agente da visibilidade ativa, mas ele poderá ser restaurado depois.</p>
                    <div className="flex gap-3 w-full">
                       <button 
                         onClick={() => handleDelete(agent.id)}
                         className="flex-1 py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all"
                       >
                         Confirmar
                       </button>
                       <button 
                         onClick={() => setIsConfirmingDelete(null)}
                         className="flex-1 py-4 bg-zinc-800 text-zinc-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all"
                       >
                         Cancelar
                       </button>
                    </div>
                 </motion.div>
               )}
             </AnimatePresence>

             <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white transition-all shadow-sm">
                   <Bot className="w-7 h-7" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                    agent.status === 'active' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : 
                    agent.status === 'paused' ? "bg-amber-50 text-amber-700 border-amber-100" :
                    agent.status === 'archived' ? "bg-rose-50 text-rose-700 border-rose-100" :
                    "bg-zinc-100 text-zinc-500 border-zinc-200"
                  )}>
                    {agent.status === 'archived' ? 'arquivado' : agent.status}
                  </div>
                  {agent.mindflow_enabled && agent.status !== 'archived' && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                      <Brain className="w-3 h-3" />
                      <span className="text-[8px] font-black uppercase tracking-tighter">Mindflow On</span>
                    </div>
                  )}
                </div>
             </div>

             <div className="flex-1">
                <h3 className="text-xl font-black text-zinc-900 tracking-tight mb-1 group-hover:text-indigo-600 transition-colors">{agent.name}</h3>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">{agent.slug}</p>
                <p className="text-zinc-500 text-sm font-medium leading-relaxed mb-6 line-clamp-2 italic">"{agent.description || 'Sem descrição.'}"</p>
                
                <div className="grid grid-cols-2 gap-2 mb-6">
                   <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                      <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Disciplina</p>
                      <p className="text-[10px] font-bold text-zinc-700">{agent.primary_discipline || 'N/A'}</p>
                   </div>
                   <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                      <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Etapa Base</p>
                      <p className="text-[10px] font-bold text-zinc-700 uppercase">{agent.primary_stage_id || 'N/A'}</p>
                   </div>
                </div>

                <div className="flex items-center justify-between mb-8 text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <Activity className="w-3 h-3" />
                    <span>{agent.default_model?.split('-')[1] || 'Flash'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3" />
                    <span>{agent.active_version_id ? 'v0.1' : 'Draft'}</span>
                  </div>
                </div>
             </div>

             <div className="pt-6 border-t border-zinc-100 flex items-center gap-3 mt-auto">
                <button 
                  onClick={() => onEdit(agent.id)}
                  className="flex-1 py-3 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
                >
                  <Edit3 className="w-4 h-4" /> Configurar
                </button>
                <div className="relative">
                  <button 
                    onClick={() => setMenuOpen(menuOpen === agent.id ? null : agent.id)}
                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-zinc-50 text-zinc-400 hover:text-zinc-900 transition-all border border-zinc-100 active:scale-95"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>

                  <AnimatePresence>
                    {menuOpen === agent.id && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-2xl shadow-2xl border border-zinc-100 p-2 z-50"
                      >
                         {agent.status !== 'archived' ? (
                           <>
                             <button 
                               onClick={() => { onEdit(agent.id); setMenuOpen(null); }}
                               className="w-full px-4 py-3 rounded-xl text-left text-xs font-bold text-zinc-600 hover:bg-zinc-50 flex items-center gap-3 transition-all"
                             >
                               <Settings className="w-4 h-4 text-zinc-400" /> Editar Meta
                             </button>
                             <button 
                               onClick={() => handleToggleStatus(agent)}
                               className="w-full px-4 py-3 rounded-xl text-left text-xs font-bold text-zinc-600 hover:bg-zinc-50 flex items-center gap-3 transition-all"
                             >
                               <Activity className="w-4 h-4 text-zinc-400" /> {agent.status === 'active' ? 'Pausar' : 'Ativar'}
                             </button>
                             <button 
                               onClick={() => handleDuplicateAction(agent)}
                               className="w-full px-4 py-3 rounded-xl text-left text-xs font-bold text-zinc-600 hover:bg-zinc-50 flex items-center gap-3 transition-all"
                             >
                               <Copy className="w-4 h-4 text-zinc-400" /> Duplicar
                             </button>
                             <div className="h-px bg-zinc-50 my-1" />
                             <button 
                               onClick={() => setIsConfirmingDelete(agent.id)}
                               className="w-full px-4 py-3 rounded-xl text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-all"
                             >
                               <Trash2 className="w-4 h-4 text-rose-400" /> Excluir Agente
                             </button>
                           </>
                         ) : (
                           <button 
                             onClick={() => handleRestore(agent.id)}
                             className="w-full px-4 py-3 rounded-xl text-left text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 transition-all"
                           >
                             <RefreshCw className="w-4 h-4 text-emerald-400" /> Restaurar Agente
                           </button>
                         )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
             </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-32 text-center bg-white border border-dashed border-zinc-200 rounded-[2.5rem]">
           <p className="text-zinc-400 font-bold italic tracking-tight">Nenhum agente encontrado para esta busca.</p>
        </div>
      )}
    </div>
  );
}
