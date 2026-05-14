import React, { useState, useEffect } from 'react';
import { Agent, AgentInstructionVersion } from '../../../types';
import { 
  History, Search, Bot, ChevronRight, 
  CheckCircle2, XCircle, Clock, RotateCcw,
  ExternalLink, Loader2, Calendar, User, 
  ArrowRight, ShieldCheck, AlertCircle, Info,
  Zap
} from 'lucide-react';
import { db } from '../../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, getDocs, addDoc } from 'firebase/firestore';
import { cn, formatDate } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { publishAgentVersion } from '../../../lib/agents';

interface Props {
  agents: Agent[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

export default function AgentVersionsTab({ agents, selectedId, setSelectedId }: Props) {
  const [versions, setVersions] = useState<AgentInstructionVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<AgentInstructionVersion | null>(null);

  useEffect(() => {
    if (selectedId) {
       loadVersions(selectedId);
    }
  }, [selectedId]);

  function loadVersions(id: string) {
    setLoading(true);
    const q = query(
      collection(db, 'agent_instruction_versions'), 
      where('agent_id', '==', id),
      orderBy('created_at', 'desc')
    );
    
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as AgentInstructionVersion));
      setVersions(data);
      if (data.length > 0 && (!selectedVersion || selectedVersion.agent_id !== id)) {
        setSelectedVersion(data[0]);
      }
      setLoading(false);
    });
  }

  async function handlePublishAction(vId: string) {
    if (!selectedId) return;
    setPublishing(true);
    try {
      await publishAgentVersion(selectedId, vId);
      alert("Versão publicada com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao publicar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPublishing(false);
    }
  }

  async function handleRestoreAsDraft(v: AgentInstructionVersion) {
    if (!selectedId) return;
    if (!confirm("Isso criará um novo rascunho baseado nesta versão. Deseja continuar?")) return;
    
    try {
      // Logic to restore: Create a new version with status 'draft'
      const { id, created_at, published_at, ...data } = v;
      await addDoc(collection(db, 'agent_instruction_versions'), {
        ...data,
        version_number: `draft_${new Date().getTime()}`,
        status: 'draft',
        is_active: false,
        created_at: serverTimestamp(),
        change_summary: `Restaurado de ${v.version_number}`
      });
      alert("Versão restaurada como rascunho com sucesso!");
    } catch (e) {
      alert("Erro ao restaurar.");
    }
  }

  const selectedAgent = agents.find(a => a.id === selectedId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-280px)] min-h-[600px]">
       {/* Sidebar: Agents List */}
       <div className="lg:col-span-3 flex flex-col bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
             <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Selecione o Agente</h4>
             <History className="w-4 h-4 text-zinc-300" />
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
             {agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedId(agent.id)}
                  className={cn(
                    "w-full text-left px-4 py-4 rounded-2xl transition-all flex items-center justify-between group",
                    selectedId === agent.id ? "bg-zinc-900 text-white shadow-lg" : "hover:bg-zinc-50"
                  )}
                >
                   <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        selectedId === agent.id ? "bg-zinc-800" : "bg-zinc-50"
                      )}>
                         <Bot className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-sm tracking-tight">{agent.name}</p>
                   </div>
                   <ChevronRight className={cn("w-4 h-4 transition-transform", selectedId === agent.id ? "translate-x-0" : "-translate-x-2 opacity-0")} />
                </button>
             ))}
          </div>
       </div>

       {/* Middle: Versions History List */}
       <div className="lg:col-span-4 flex flex-col bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="p-8 border-b border-zinc-100 bg-zinc-50/50">
             <h4 className="text-xl font-black text-zinc-900 tracking-tight">Histórico de Versões</h4>
             <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{selectedAgent?.name || 'Agente'}</span>
                {versions.length > 0 && <span className="text-[9px] font-bold px-2 py-0.5 bg-zinc-200 rounded-full">{versions.length} registradas</span>}
             </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
             {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                   <Loader2 className="w-8 h-8 animate-spin text-zinc-200" />
                </div>
             ) : versions.length === 0 ? (
                <div className="py-20 text-center opacity-40">
                   <AlertCircle className="w-10 h-10 mx-auto mb-4" />
                   <p className="text-xs font-bold uppercase tracking-widest italic leading-tight">Nenhuma versão encontrada para este agente.</p>
                </div>
             ) : versions.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersion(v)}
                  className={cn(
                    "w-full text-left p-5 rounded-3xl border transition-all relative overflow-hidden group/v",
                    selectedVersion?.id === v.id 
                      ? "bg-white border-zinc-900 shadow-xl shadow-zinc-100" 
                      : "bg-white border-zinc-100 hover:border-zinc-300"
                  )}
                >
                   <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                         <span className="text-sm font-black text-zinc-900 tracking-tight">{v.version_number}</span>
                         {v.is_active && (
                           <div className="px-2 py-0.5 bg-zinc-900 text-white rounded-md text-[7px] font-black uppercase tracking-[0.2em] flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5" /> Ativa
                           </div>
                         )}
                      </div>
                      <span className="text-[9px] font-bold text-zinc-400">{formatDate(v.created_at)}</span>
                   </div>
                   <p className="text-sm font-medium text-zinc-500 italic mb-4 line-clamp-2 leading-relaxed">"{v.change_summary || 'Sem resumo disponível.'}"</p>
                   <div className="flex items-center justify-between pt-4 border-t border-zinc-50">
                      <div className="flex items-center gap-2">
                         <div className="w-6 h-6 bg-zinc-100 rounded-full flex items-center justify-center">
                            <User className="w-3 h-3 text-zinc-400" />
                         </div>
                         <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Admin</span>
                      </div>
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest",
                        v.status === 'published' ? "text-emerald-500" : "text-zinc-400"
                      )}>{v.status}</span>
                   </div>
                </button>
             ))}
          </div>
       </div>

       {/* Right: Version Detail & Actions */}
       <div className="lg:col-span-5 flex flex-col bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm">
          {selectedVersion ? (
             <div className="h-full flex flex-col overflow-hidden">
                <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                    <div>
                       <h4 className="font-black text-xl text-zinc-900 tracking-tight leading-none mb-1">Datalhes da Versão</h4>
                       <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Configuração e Instrução</p>
                    </div>
                    {!selectedVersion.is_active && (
                      <button 
                        onClick={() => handlePublishAction(selectedVersion.id)}
                        disabled={publishing}
                        className="bg-zinc-900 text-white px-5 py-2.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                      >
                         {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                         Publicar
                      </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-8">
                   <div className="p-6 bg-zinc-50 rounded-[2rem] border border-zinc-100 italic font-medium text-zinc-600 leading-relaxed relative">
                      <div className="absolute -top-3 left-6 px-3 py-1 bg-white border border-zinc-200 rounded-full text-[8px] font-black uppercase tracking-widest text-zinc-400">Resumo da Alteração</div>
                      "{selectedVersion.change_summary || 'Nenhuma descrição técnica informada para esta versão.'}"
                   </div>

                   <div className="space-y-4">
                      <h5 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest border-b border-zinc-50 pb-2">Instrução Compilada</h5>
                      <div className="bg-white border border-zinc-100 rounded-3xl p-6 relative group">
                         <div className="max-h-[300px] overflow-y-auto no-scrollbar text-xs font-mono text-zinc-600 leading-relaxed whitespace-pre-wrap">
                            {selectedVersion.compiled_prompt || 'Nenhum prompt gerado.'}
                         </div>
                         <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white opacity-40 pointer-events-none" />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-50">
                      <button 
                        onClick={() => handleRestoreAsDraft(selectedVersion)}
                        className="flex items-center justify-center gap-2 py-4 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                         <RotateCcw className="w-4 h-4" /> Restaurar como Rascunho
                      </button>
                      <button className="flex items-center justify-center gap-2 py-4 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                         <ExternalLink className="w-4 h-4" /> Ver XML/JSON
                      </button>
                   </div>
                </div>
             </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center opacity-40 grayscale">
               <div className="w-20 h-20 bg-zinc-50 rounded-[2rem] flex items-center justify-center mb-8">
                  <History className="w-10 h-10 text-zinc-200" />
               </div>
               <h4 className="text-xl font-bold text-zinc-900 tracking-tight">Nenhuma Versão Selecionada</h4>
               <p className="text-zinc-500 font-medium italic mt-2">Selecione uma versão histórica ao lado para ver detalhes técnicos.</p>
            </div>
          )}
       </div>
    </div>
  );
}
