import React, { useState, useEffect } from 'react';
import { Agent, AgentInstructionVersion, InstructionBlocks, StageKey } from '../../../types';
import { 
  Bot, X, Save, RefreshCw, Star, Settings, ExternalLink,
  ChevronRight, Brain, Zap, Activity, Layout, Eye,
  History, TestTube, FileText, Code, Shield, Check,
  AlertCircle, Sparkles, MessageSquare, Target, User,
  Database, Hammer, Info, Trash2, ArrowUpRight
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { db, auth } from '../../../lib/firebase';
import { 
  doc, updateDoc, collection, addDoc, 
  serverTimestamp, query, where, getDocs, 
  limit, orderBy, onSnapshot 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

import { callGeminiProxy } from '../../../lib/geminiProxy';

interface Props {
  agent: Agent;
  onClose: () => void;
}

type Tab = 'overview' | 'behavior' | 'instructions' | 'inputs' | 'outputs' | 'mindflow' | 'tools' | 'versions' | 'tests' | 'logs';

const DEFAULT_INSTRUCTIONS: InstructionBlocks = {
  identity: "Você é um especialista da Tona focado em Product Management.",
  objective: "Sua missão é ajudar o usuário a reduzir o gap de informação em cada etapa da jornada.",
  when_to_use: "Use quando houver incerteza sobre o problema, solução ou execução.",
  when_not_to_use: "Não use para tarefas administrativas gerais fora do escopo de produto.",
  expected_inputs: "Contexto do produto, estágio atual e mensagem do usuário.",
  mandatory_tasks: "1. Analise o gap. 2. Provoque reflexão. 3. Sugira próximo passo.",
  reasoning_method: "Pense passo a passo, do problema para a solução.",
  questions_to_ask: "Qual evidência você tem disso? Qual o impacto para o usuário?",
  quality_criteria: "Clareza, objetividade e profundidade analítica.",
  guardrails: "Nunca invente dados que não existem no contexto.",
  output_format: "Texto direto, fatiado e pragmático.",
  save_behavior: "Crie memórias do tipo 'fato' ou 'decisão' conforme relevante.",
  gap_handling: "Se faltar info, aponte o gap e sugira como resolver.",
  classification_rules: "Fato: algo comprovado. Hipótese: algo a validar.",
  good_examples: "P: 'Quero crescer' -> R: 'Entendi, mas qual o exato problema de retenção?'",
  bad_examples: "P: 'Implemente isso' -> R: 'Sim, vou fazer agora'."
};

export default function AgentEditorDrawer({ agent, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedAgent, setEditedAgent] = useState<Agent>(agent);
  const [instructions, setInstructions] = useState<InstructionBlocks | null>(null);
  const [versions, setVersions] = useState<AgentInstructionVersion[]>([]);
  const [activeBlock, setActiveBlock] = useState<keyof InstructionBlocks>('identity');

  useEffect(() => {
    loadAgentData();
  }, [agent.id]);

  async function loadAgentData() {
    setLoading(true);
    try {
      // Load current instructions
      const q = query(
        collection(db, 'agent_instruction_versions'),
        where('agent_id', '==', agent.id),
        where('is_active', '==', true),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data() as AgentInstructionVersion;
        setInstructions(data.instruction_blocks);
      } else {
        const empty: InstructionBlocks = {
          identity: "", objective: "", when_to_use: "", when_not_to_use: "",
          expected_inputs: "", mandatory_tasks: "", reasoning_method: "",
          questions_to_ask: "", quality_criteria: "", guardrails: "",
          output_format: "", save_behavior: "", gap_handling: "",
          classification_rules: "", good_examples: "", bad_examples: ""
        };
        setInstructions(empty);
      }

      // Load versions
      const vq = query(
        collection(db, 'agent_instruction_versions'),
        where('agent_id', '==', agent.id),
        orderBy('created_at', 'desc'),
        limit(10)
      );
      const vsnap = await getDocs(vq);
      setVersions(vsnap.docs.map(d => ({ id: d.id, ...d.data() } as AgentInstructionVersion)));

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRestoreDefault() {
    if (!instructions || !activeBlock) return;
    if (confirm(`Restaurar "${activeBlock}"?`)) {
      setInstructions({ ...instructions, [activeBlock]: DEFAULT_INSTRUCTIONS[activeBlock] });
    }
  }

  async function handleImproveWithTona() {
    if (!instructions || !activeBlock) return;
    
    setLoading(true);
    try {
      const currentText = instructions[activeBlock];
      
      const prompt = `Você é um Engenheiro de Prompt Sênior. Melhore a seguinte seção da instrução do agente ${editedAgent.name}.
      Seção: ${activeBlock}
      Conteúdo Atual: "${currentText}"
      Responda apenas com o texto melhorado.`;

      const improvedText = await callGeminiProxy({
        model: "gemini-3-flash-preview",
        prompt: prompt
      });
      if (improvedText) {
        setInstructions({ ...instructions, [activeBlock]: improvedText });
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao falar com a Tona.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { id, ...agentData } = editedAgent;
      await updateDoc(doc(db, 'agents', agent.id), {
        ...agentData,
        updated_at: serverTimestamp()
      });

      if (instructions) {
        // Just save a draft for now when editing in drawer
        const q = query(
          collection(db, 'agent_instruction_versions'),
          where('agent_id', '==', agent.id),
          where('status', '==', 'draft'),
          limit(1)
        );
        const snap = await getDocs(q);
        
        const versionData = {
          agent_id: agent.id,
          instruction_blocks: instructions,
          compiled_prompt: Object.values(instructions).join('\n\n'),
          status: 'draft',
          updated_at: serverTimestamp()
        };

        if (!snap.empty) {
          await updateDoc(doc(db, 'agent_instruction_versions', snap.docs[0].id), versionData);
        } else {
          await addDoc(collection(db, 'agent_instruction_versions'), {
            ...versionData,
            version_number: `draft_${new Date().getTime()}`,
            is_active: false,
            created_at: serverTimestamp(),
            created_by: auth.currentUser?.uid || 'system',
            change_summary: 'Edição via Drawer'
          });
        }
      }

      alert("Agente e rascunho atualizados!");
      onClose();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Visão Geral', icon: Layout },
    { id: 'behavior', label: 'Comportamento', icon: User },
    { id: 'instructions', label: 'Instruções', icon: FileText },
    { id: 'inputs', label: 'Inputs & Contexto', icon: ArrowUpRight },
    { id: 'outputs', label: 'Outputs & Salvamento', icon: Target },
    { id: 'mindflow', label: 'Mindflow', icon: Brain },
    { id: 'tools', label: 'Ferramentas', icon: Hammer },
    { id: 'versions', label: 'Versões', icon: History },
    { id: 'tests', label: 'Testes', icon: TestTube },
    { id: 'logs', label: 'Logs', icon: Activity },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="relative w-full max-w-6xl bg-white h-full shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/30">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                 <h3 className="text-2xl font-black text-zinc-900 tracking-tighter">{agent.name}</h3>
                 <span className="px-3 py-1 bg-zinc-100 rounded-full text-[10px] font-black uppercase text-zinc-500 tracking-widest border border-zinc-200">{agent.type}</span>
              </div>
              <p className="text-zinc-400 font-medium italic text-sm">{agent.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button 
               onClick={handleSave}
               disabled={saving}
               className="px-6 py-3 bg-zinc-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200"
             >
                {saving ? <Activity className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Agente
             </button>
             <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-zinc-100 rounded-2xl text-zinc-400 hover:text-zinc-900 transition-all">
                <X className="w-6 h-6" />
             </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Navigation Sidebar */}
          <div className="w-64 border-r border-zinc-100 bg-zinc-50/50 p-6 space-y-1 overflow-y-auto no-scrollbar">
             {tabs.map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 className={cn(
                   "w-full px-5 py-4 rounded-2xl flex items-center gap-3 transition-all text-left group",
                   activeTab === tab.id 
                     ? "bg-white text-zinc-900 shadow-xl shadow-zinc-200/50 font-black border border-zinc-100" 
                     : "text-zinc-400 hover:bg-white hover:text-zinc-600 font-bold"
                 )}
               >
                 <tab.icon className={cn("w-5 h-5 transition-all", activeTab === tab.id ? "text-zinc-900 scale-110" : "text-zinc-300 group-hover:text-zinc-400")} />
                 <span className="text-[10px] uppercase tracking-[0.1em]">{tab.label}</span>
               </button>
             ))}
          </div>

          {/* Main Workspace */}
          <div className="flex-1 overflow-y-auto p-12 bg-white relative no-scrollbar">
             {loading ? (
               <div className="h-full flex flex-col items-center justify-center space-y-4">
                  <Activity className="w-10 h-10 text-zinc-200 animate-spin" />
                  <p className="text-zinc-400 font-medium italic">Sincronizando cérebro do agente...</p>
               </div>
             ) : (
               <div className="max-w-4xl">
                  {activeTab === 'overview' && (
                    <div className="space-y-10">
                       <section>
                          <h4 className="text-sm font-black text-zinc-900 mb-6 flex items-center gap-2">
                             <Layout className="w-4 h-4" /> Identidade & Metadados
                          </h4>
                          <div className="grid grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Nome do Agente</label>
                                <input 
                                  value={editedAgent.name}
                                  onChange={e => setEditedAgent({...editedAgent, name: e.target.value})}
                                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-4 focus:ring-zinc-900/5 transition-all font-bold"
                                />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Slug (Identificador Único)</label>
                                <input 
                                  value={editedAgent.slug}
                                  onChange={e => setEditedAgent({...editedAgent, slug: e.target.value})}
                                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-4 focus:ring-zinc-900/5 transition-all font-mono font-bold text-zinc-500"
                                />
                             </div>
                             <div className="space-y-2 col-span-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Descrição Curta</label>
                                <input 
                                  value={editedAgent.description}
                                  onChange={e => setEditedAgent({...editedAgent, description: e.target.value})}
                                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-4 focus:ring-zinc-900/5 transition-all font-bold"
                                />
                             </div>
                          </div>
                       </section>

                       <section>
                          <h4 className="text-sm font-black text-zinc-900 mb-6 flex items-center gap-2">
                             <Settings className="w-4 h-4" /> Configurações de IA
                          </h4>
                          <div className="grid grid-cols-3 gap-6">
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Modelo GenAi</label>
                                <select 
                                  value={editedAgent.default_model}
                                  onChange={e => setEditedAgent({...editedAgent, default_model: e.target.value})}
                                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl font-bold font-mono"
                                >
                                   <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                                   <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                                   <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                                   <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                                </select>
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Temperatura ({editedAgent.temperature})</label>
                                <input 
                                  type="range" min="0" max="1" step="0.1"
                                  value={editedAgent.temperature}
                                  onChange={e => setEditedAgent({...editedAgent, temperature: parseFloat(e.target.value)})}
                                  className="w-full h-12 bg-zinc-50 px-4 accent-zinc-900"
                                />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Status</label>
                                <select 
                                  value={editedAgent.status}
                                  onChange={e => setEditedAgent({...editedAgent, status: e.target.value as any})}
                                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                                >
                                   <option value="draft">Rascunho</option>
                                   <option value="active">Ativo</option>
                                   <option value="testing">Teste</option>
                                   <option value="paused">Pausado</option>
                                   <option value="deprecated">Obsoleto</option>
                                </select>
                             </div>
                          </div>
                       </section>
                    </div>
                  )}

                   {activeTab === 'behavior' && (
                    <div className="space-y-10">
                       <div className="p-8 bg-zinc-900 rounded-[3rem] text-white shadow-2xl relative overflow-hidden mb-10">
                          <div className="absolute top-0 right-0 p-20 bg-white/5 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl" />
                          <div className="relative z-10 flex items-center gap-4">
                             <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                <Brain className="w-7 h-7 text-amber-400" />
                             </div>
                             <div>
                                <h4 className="text-xl font-black tracking-tight">Personalidade & Comportamento</h4>
                                <p className="text-white/40 font-medium italic text-sm">Este agente usa a Tona Core Personality como base neural.</p>
                             </div>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Papel Principal</label>
                             <textarea 
                               placeholder="Ex: Auditor crítico focado em segurança de dados..."
                               value={editedAgent.behavior_config?.role || ''}
                               onChange={e => setEditedAgent({
                                 ...editedAgent, 
                                 behavior_config: { ...editedAgent.behavior_config, role: e.target.value }
                               })}
                               className="w-full p-6 bg-zinc-50 border border-zinc-100 rounded-[2rem] font-medium leading-relaxed resize-none h-32"
                             />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Tom de Voz</label>
                             <textarea 
                               placeholder="Ex: Analítico, direto, levemente irônico quando encontra falhas..."
                               value={editedAgent.behavior_config?.tone || ''}
                               onChange={e => setEditedAgent({
                                 ...editedAgent, 
                                 behavior_config: { ...editedAgent.behavior_config, tone: e.target.value }
                               })}
                               className="w-full p-6 bg-zinc-50 border border-zinc-100 rounded-[2rem] font-medium leading-relaxed resize-none h-32"
                             />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nível de Provocação</label>
                             <select 
                               value={editedAgent.behavior_config?.provocation || 'none'}
                               onChange={e => setEditedAgent({
                                 ...editedAgent, 
                                 behavior_config: { ...editedAgent.behavior_config, provocation: e.target.value as any }
                               })}
                               className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl font-bold"
                             >
                                <option value="none">Nenhuma</option>
                                <option value="low">Baixa - Apenas aponta lacunas</option>
                                <option value="medium">Média - Desafia suposições</option>
                                <option value="high">Alta - Age como red team</option>
                             </select>
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nível de Profundidade</label>
                             <select 
                               value={editedAgent.behavior_config?.depth || 'balanced'}
                               onChange={e => setEditedAgent({
                                 ...editedAgent, 
                                 behavior_config: { ...editedAgent.behavior_config, depth: e.target.value as any }
                               })}
                               className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl font-bold"
                             >
                                <option value="surface">Surface - Visão geral rápida</option>
                                <option value="balanced">Balanced - Padrão da Tona</option>
                                <option value="deep">Deep - Mergulho técnico exaustivo</option>
                             </select>
                          </div>
                       </div>
                    </div>
                  )}

                  {activeTab === 'instructions' && (
                    <div className="flex gap-8 h-[calc(100vh-280px)]">
                       <div className="w-64 space-y-1 overflow-y-auto no-scrollbar pr-2">
                          {instructions && (Object.keys(instructions) as Array<keyof InstructionBlocks>).map(key => (
                             <button
                               key={key}
                               onClick={() => setActiveBlock(key)}
                               className={cn(
                                 "w-full text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                 activeBlock === key ? "bg-zinc-900 text-white shadow-lg" : "text-zinc-400 hover:bg-zinc-100"
                               )}
                             >
                                {key.replace(/_/g, ' ')}
                             </button>
                          ))}
                       </div>
                       <div className="flex-1 flex flex-col gap-6">
                          <div className="flex items-center justify-between">
                             <h4 className="text-sm font-black text-zinc-900 flex items-center gap-2 uppercase tracking-widest">
                                <FileText className="w-4 h-4" /> {activeBlock.replace(/_/g, ' ')}
                             </h4>
                             <div className="flex gap-2">
                                <button 
                                  onClick={handleImproveWithTona}
                                  className="px-3 py-1.5 bg-zinc-100 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-200"
                                >
                                   Melhorar com Tona
                                </button>
                                <button 
                                  onClick={handleRestoreDefault}
                                  className="px-3 py-1.5 bg-zinc-100 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-200"
                                >
                                   Restaurar
                                </button>
                                <button className="px-3 py-1.5 bg-zinc-100 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-200">Copiar</button>
                             </div>
                          </div>
                          <textarea 
                             className="flex-1 w-full p-8 bg-zinc-50 border border-zinc-100 rounded-[3rem] shadow-inner font-medium text-zinc-700 leading-relaxed outline-none focus:ring-4 focus:ring-zinc-900/5 transition-all resize-none"
                             value={instructions?.[activeBlock] || ''}
                             onChange={e => instructions && setInstructions({...instructions, [activeBlock]: e.target.value})}
                          />
                          <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                             <div className="flex items-center gap-3">
                                <Check className="w-5 h-5 text-emerald-500" />
                                <span className="text-xs font-bold text-emerald-800">Esta alteração não afeta a versão publicada até que você publique.</span>
                             </div>
                             <button className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md">Criar Versão</button>
                          </div>
                       </div>
                    </div>
                  )}

                  {activeTab === 'inputs' && (
                    <div className="space-y-10">
                       <section>
                          <h4 className="text-sm font-black text-zinc-900 mb-6 flex items-center gap-2 uppercase tracking-widest">
                             <Database className="w-4 h-4" /> Contexto & Memória
                          </h4>
                          <div className="grid grid-cols-2 gap-8">
                             <div className="p-8 border border-zinc-100 rounded-[3rem] bg-zinc-50/50 space-y-6">
                                <div className="flex items-center justify-between">
                                   <div>
                                      <p className="font-bold text-zinc-900">Acesso a Memória Base</p>
                                      <p className="text-[10px] text-zinc-400 font-medium">Instruções fixas da Tona</p>
                                   </div>
                                   <button 
                                     onClick={() => setEditedAgent({...editedAgent, base_memory_enabled: !editedAgent.base_memory_enabled})}
                                     className={cn("w-10 h-5 rounded-full relative", editedAgent.base_memory_enabled ? "bg-zinc-900" : "bg-zinc-200")}
                                   >
                                      <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", editedAgent.base_memory_enabled ? "right-1" : "left-1")} />
                                   </button>
                                </div>
                                <div className="flex items-center justify-between">
                                   <div>
                                      <p className="font-bold text-zinc-900">Memória de Aprendizado</p>
                                      <p className="text-[10px] text-zinc-400 font-medium">Memórias dinâmicas do produto</p>
                                   </div>
                                   <button 
                                     onClick={() => setEditedAgent({...editedAgent, learned_memory_enabled: !editedAgent.learned_memory_enabled})}
                                     className={cn("w-10 h-5 rounded-full relative", editedAgent.learned_memory_enabled ? "bg-zinc-900" : "bg-zinc-200")}
                                   >
                                      <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", editedAgent.learned_memory_enabled ? "right-1" : "left-1")} />
                                   </button>
                                </div>
                             </div>

                             <div className="space-y-4">
                                <div className="space-y-2">
                                   <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Tipos de Memória Permitidos</label>
                                   <div className="flex flex-wrap gap-2 pt-2">
                                      {['fato', 'hipótese', 'evidência', 'decisão', 'risco'].map(type => (
                                        <button 
                                          key={type}
                                          className="px-3 py-1.5 bg-zinc-100 rounded-lg text-[9px] font-black uppercase text-zinc-500 hover:bg-zinc-900 hover:text-white transition-all shadow-sm"
                                        >
                                           {type}
                                        </button>
                                      ))}
                                   </div>
                                </div>
                                <div className="space-y-2">
                                   <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Estratégia de Recuperação</label>
                                   <select className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl font-bold">
                                      <option>Hybrid (Semantic + Keywords)</option>
                                      <option>Stage Context First</option>
                                      <option>Recent First</option>
                                   </select>
                                </div>
                             </div>
                          </div>
                       </section>
                    </div>
                  )}

                  {activeTab === 'outputs' && (
                    <div className="space-y-10">
                       <section>
                          <h4 className="text-sm font-black text-zinc-900 mb-6 flex items-center gap-2 uppercase tracking-widest">
                             <Target className="w-4 h-4" /> Destino de Gravação
                          </h4>
                          <div className="grid grid-cols-2 gap-8">
                             <div className="space-y-4">
                                <div className="space-y-2">
                                   <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Tipo de Output</label>
                                   <select 
                                     value={editedAgent.output_type}
                                     onChange={e => setEditedAgent({...editedAgent, output_type: e.target.value})}
                                     className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl font-bold"
                                   >
                                      <option value="chat">Apenas Chat (Conversacional)</option>
                                      <option value="field_update">Atualização de Campo (Invisível)</option>
                                      <option value="artifact">Geração de Artefato</option>
                                      <option value="memory">Criação de Memória</option>
                                   </select>
                                </div>
                                
                                {editedAgent.output_type === 'artifact' && (
                                  <div className="space-y-2">
                                     <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Tipo de Artefato Sugerido</label>
                                     <input 
                                       value={editedAgent.artifact_type}
                                       onChange={e => setEditedAgent({...editedAgent, artifact_type: e.target.value})}
                                       className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl font-bold"
                                       placeholder="ex: user_persona, value_proposition..."
                                     />
                                  </div>
                                )}
                             </div>

                             <div className="p-8 border border-zinc-100 rounded-[3rem] bg-zinc-50/50 space-y-6">
                                <div className="flex items-center gap-3 mb-4">
                                   <Shield className="w-5 h-5 text-indigo-500" />
                                   <h5 className="font-black text-xs uppercase tracking-widest">Output Schema & Guardrails</h5>
                                </div>
                                <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                                   Defina o JSON Schema esperado caso este agente realize salvamentos estruturados em campos do produto.
                                </p>
                                <button className="w-full py-4 bg-white border border-zinc-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 hover:text-white transition-all shadow-sm">
                                   Configurar Schema JSON
                                </button>
                             </div>
                          </div>
                       </section>
                    </div>
                  )}

                  {activeTab === 'tools' && (
                    <div className="space-y-10">
                       <section>
                          <h4 className="text-sm font-black text-zinc-900 mb-6 flex items-center gap-2 uppercase tracking-widest">
                             <Hammer className="w-4 h-4" /> Ferramentas & Capacidades
                          </h4>
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                             {[
                               { id: 'web_search', label: 'Pesquisa Web', desc: 'Acesso a dados em tempo real' },
                               { id: 'artifact_gen', label: 'Gerador de Artefatos', desc: 'Criação de docs estruturados' },
                               { id: 'memory_write', label: 'Escrita em Memória', desc: 'Salva novos aprendizados' },
                               { id: 'vision', label: 'Visão Computacional', desc: 'Análise de screenshots e diagramas' },
                               { id: 'code_interpreter', label: 'Interpretador de Código', desc: 'Cálculos e lógica complexa' },
                               { id: 'browser', label: 'Browsing', desc: 'Navegação em URLs específicas' },
                             ].map(tool => (
                               <button 
                                 key={tool.id}
                                 onClick={() => {
                                   const tools = (editedAgent.tools || []).includes(tool.id) 
                                     ? editedAgent.tools.filter(t => t !== tool.id)
                                     : [...(editedAgent.tools || []), tool.id];
                                   setEditedAgent({...editedAgent, tools});
                                 }}
                                 className={cn(
                                   "p-6 rounded-[2.5rem] border-2 text-left transition-all relative overflow-hidden",
                                   (editedAgent.tools || []).includes(tool.id) 
                                     ? "border-zinc-900 bg-zinc-900 text-white shadow-xl shadow-zinc-200" 
                                     : "border-zinc-100 bg-zinc-50/50 hover:border-zinc-200"
                                 )}
                               >
                                  <div className="flex items-center justify-between mb-4">
                                     <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", (editedAgent.tools || []).includes(tool.id) ? "bg-white/10" : "bg-white shadow-sm")}>
                                        <Code className="w-5 h-5" />
                                     </div>
                                     {(editedAgent.tools || []).includes(tool.id) && <Check className="w-4 h-4 text-emerald-400" />}
                                  </div>
                                  <p className="font-black text-sm tracking-tight mb-1">{tool.label}</p>
                                  <p className={cn("text-[10px] font-medium leading-tight", (editedAgent.tools || []).includes(tool.id) ? "text-white/50" : "text-zinc-400")}>{tool.desc}</p>
                               </button>
                             ))}
                          </div>
                       </section>
                    </div>
                  )}

                  {activeTab === 'mindflow' && (
                    <div className="space-y-10">
                       <section>
                          <h4 className="text-sm font-black text-zinc-900 mb-6 flex items-center gap-2 uppercase tracking-widest">
                             <Brain className="w-4 h-4" /> Mindflow & Intelecto Core
                          </h4>
                          <div className="grid grid-cols-2 gap-8">
                             <div className="p-10 border-2 border-zinc-900 rounded-[3rem] bg-zinc-900 text-white space-y-8 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-3xl rounded-full -mr-20 -mt-20" />
                                
                                <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                         <Zap className="w-6 h-6 text-amber-300" />
                                      </div>
                                      <h5 className="font-black text-lg tracking-tight">Shared Soul Mode</h5>
                                   </div>
                                   <div className="px-3 py-1 bg-amber-400 text-zinc-900 rounded-full text-[8px] font-black uppercase tracking-widest">Recomendado</div>
                                </div>

                                <p className="text-xs text-white/70 font-medium leading-relaxed italic">
                                   "A Tona é uma só. Seus agentes são apenas facetas de sua personalidade. O Mindflow compartilhado garante que o aprendizado de um se torne a sabedoria de todos."
                                </p>

                                <div className="space-y-4">
                                   <div className="flex items-center gap-3 p-4 bg-white/10 rounded-2xl border border-white/10">
                                      <Check className="w-4 h-4 text-emerald-400" />
                                      <p className="text-[10px] font-bold uppercase tracking-widest">Memória Vetorial Conjunta</p>
                                   </div>
                                   <div className="flex items-center gap-3 p-4 bg-white/10 rounded-2xl border border-white/10">
                                      <Check className="w-4 h-4 text-emerald-400" />
                                      <p className="text-[10px] font-bold uppercase tracking-widest">Traço de Personalidade v1.2</p>
                                   </div>
                                </div>

                                <button 
                                  onClick={() => setEditedAgent({...editedAgent, mindflow_enabled: true})}
                                  className={cn(
                                    "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    editedAgent.mindflow_enabled ? "bg-white text-zinc-900" : "bg-white/10 text-white hover:bg-white/20"
                                  )}
                                >
                                   {editedAgent.mindflow_enabled ? 'ATIVADO NO CÉREBRO CENTRAL' : 'ATIVAR MODO SHARED SOUL'}
                                </button>
                             </div>

                             <div className="p-10 border border-zinc-100 rounded-[3rem] bg-zinc-50/30 space-y-8 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all group">
                                <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 bg-zinc-200 rounded-xl flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white transition-all">
                                      <User className="w-6 h-6" />
                                   </div>
                                   <h5 className="font-black text-lg tracking-tight text-zinc-400 group-hover:text-zinc-900">Independent Ego</h5>
                                </div>

                                <p className="text-xs text-zinc-400 font-medium leading-relaxed group-hover:text-zinc-500">
                                   Use este modo apenas para agentes que não devem herdar a personalidade da Tona ou que operam em domínios totalmente isolados.
                                </p>

                                <div className="space-y-4">
                                   <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-zinc-100">
                                      <AlertCircle className="w-4 h-4 text-zinc-300" />
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">Memória Isolada</p>
                                   </div>
                                   <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-zinc-100">
                                      <AlertCircle className="w-4 h-4 text-zinc-300" />
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">Sem Vínculo com a Tona</p>
                                   </div>
                                </div>

                                <button 
                                  onClick={() => setEditedAgent({...editedAgent, mindflow_enabled: false})}
                                  className={cn(
                                    "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    !editedAgent.mindflow_enabled ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                                  )}
                                >
                                   {!editedAgent.mindflow_enabled ? 'MODO INDEPENDENTE' : 'MIGRAR PARA INDEPENDENTE'}
                                </button>
                             </div>
                          </div>
                       </section>
                    </div>
                  )}

                  {activeTab === 'versions' && (
                    <div className="space-y-8">
                       <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-black text-zinc-900 flex items-center gap-2 uppercase tracking-widest">
                             <History className="w-4 h-4" /> Histórico de Instruções
                          </h4>
                          <button className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Nova Versão</button>
                       </div>
                       
                       <div className="space-y-3">
                          {versions.map((v, idx) => (
                             <div key={v.id} className={cn(
                               "p-6 rounded-[2rem] border transition-all flex items-center justify-between",
                               v.is_active ? "border-emerald-200 bg-emerald-50/30" : "border-zinc-100 bg-white"
                             )}>
                                <div className="flex items-center gap-4">
                                   <div className={cn(
                                     "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs",
                                     v.is_active ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-400"
                                   )}>
                                      v{versions.length - idx}
                                   </div>
                                   <div>
                                      <p className="font-bold text-zinc-900 text-sm">{v.change_summary || 'Ajustes de instruções'}</p>
                                      <p className="text-[10px] text-zinc-400 font-medium">Por: {v.created_by.slice(0, 8)} • {v.created_at?.toDate().toLocaleString()}</p>
                                   </div>
                                </div>
                                <div className="flex items-center gap-2">
                                   {!v.is_active && (
                                     <button className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-[9px] font-black uppercase text-zinc-500 hover:bg-zinc-900 hover:text-white transition-all shadow-sm">Publicar</button>
                                   )}
                                   <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-zinc-100 text-zinc-400 hover:text-zinc-900 shadow-sm transition-all">
                                      <Eye className="w-4 h-4" />
                                   </button>
                                </div>
                             </div>
                          ))}
                          {versions.length === 0 && (
                            <div className="py-20 bg-zinc-50 border border-dashed border-zinc-200 rounded-[3rem] text-center">
                               <History className="w-8 h-8 text-zinc-300 mx-auto mb-4" />
                               <p className="text-zinc-400 font-bold italic text-sm">Nenhuma versão registrada ainda.</p>
                            </div>
                          )}
                       </div>
                    </div>
                  )}

                  {activeTab === 'tests' && (
                    <div className="space-y-8">
                       <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black text-zinc-900 flex items-center gap-2 uppercase tracking-widest">
                             <TestTube className="w-4 h-4" /> Playground de Batismo
                          </h4>
                          <button className="px-6 py-3 bg-zinc-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                             <Sparkles className="w-4 h-4" /> Iniciar Novo Teste
                          </button>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="p-8 border border-zinc-100 rounded-[3rem] bg-zinc-50/50 space-y-6">
                             <h5 className="font-black text-xs uppercase tracking-widest pl-1">Configuração do Teste</h5>
                             <div className="space-y-4">
                                <div className="space-y-2">
                                   <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Input do Usuário (Mock)</label>
                                   <textarea className="w-full h-32 p-4 bg-white border border-zinc-100 rounded-2xl text-xs font-medium resize-none shadow-inner" placeholder="O que o usuário diria para este agente?" />
                                </div>
                                <div className="space-y-2">
                                   <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Contexto Adicional (JSON)</label>
                                   <textarea className="w-full h-20 p-4 bg-white border border-zinc-100 rounded-2xl text-[10px] font-mono shadow-inner italic" placeholder='{"stage": "discovery", "product_id": "..."}' />
                                </div>
                             </div>
                          </div>

                          <div className="p-8 border border-zinc-100 rounded-[3rem] bg-white shadow-2xl shadow-zinc-100 flex flex-col items-center justify-center text-center space-y-4">
                             <div className="w-16 h-16 bg-zinc-50 rounded-[2rem] flex items-center justify-center text-zinc-200">
                                <MessageSquare className="w-8 h-8" />
                             </div>
                             <div>
                                <p className="font-black text-zinc-900 uppercase tracking-widest text-[10px]">Aguardando Prompt</p>
                                <p className="text-zinc-400 text-xs font-medium italic mt-2 px-8 leading-relaxed">
                                   "Teste cada agente no Playground antes de publicar a versão. O batismo garante que a alma do agente está alinhada à Tona."
                                </p>
                             </div>
                          </div>
                       </div>
                    </div>
                  )}

                  {activeTab === 'logs' && (
                    <div className="space-y-8">
                       <h4 className="text-sm font-black text-zinc-900 flex items-center gap-2 uppercase tracking-widest">
                          <Activity className="w-4 h-4" /> Runtime Discovery Logs
                       </h4>
                       <div className="space-y-2 font-mono text-[10px] p-6 bg-zinc-900 text-zinc-400 rounded-[2rem] h-[500px] overflow-y-auto no-scrollbar">
                          <p className="text-zinc-600">[2026-05-10 23:55:01] INITIALIZING AGENT: {editedAgent.name}</p>
                          <p className="text-zinc-600">[2026-05-10 23:55:02] LOADING INSTRUCTIONS: v{versions.find(v => v.is_active)?.id || '1'}</p>
                          <p className="text-emerald-500">[2026-05-10 23:55:03] MINDFLOW CONNECTION: ESTABLISHED</p>
                          <p className="text-zinc-500">[2026-05-10 23:55:04] READY FOR INPUTS...</p>
                       </div>
                    </div>
                  )}

                  {activeTab === 'mindflow' && (
                    <div className="space-y-10">
                       <div className="p-8 bg-emerald-900 rounded-[3rem] text-white shadow-2xl relative overflow-hidden mb-10">
                          <div className="absolute top-0 right-0 p-20 bg-white/5 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl" />
                          <div className="relative z-10 flex items-center gap-4">
                             <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                <Brain className="w-7 h-7 text-emerald-300" />
                             </div>
                             <div>
                                <h4 className="text-xl font-black tracking-tight">Mindflow Configuration</h4>
                                <p className="text-white/40 font-medium italic text-sm">Controle como este agente interage com o cérebro central.</p>
                             </div>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-8">
                          <div className="p-8 border border-zinc-100 rounded-[3rem] bg-zinc-50/50 space-y-6">
                             <div className="flex items-center justify-between">
                                <div>
                                   <p className="font-bold text-zinc-900">Ativar Mindflow</p>
                                   <p className="text-[10px] text-zinc-400 font-medium tracking-tight">Permite que o agente acesse memórias</p>
                                </div>
                                <button className="w-12 h-6 bg-zinc-900 rounded-full relative">
                                   <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                                </button>
                             </div>
                             <div className="flex items-center justify-between">
                                <div>
                                   <p className="font-bold text-zinc-900">Uso do Core Neural</p>
                                   <p className="text-[10px] text-zinc-400 font-medium tracking-tight">Sincroniza com as instruções base da Tona</p>
                                </div>
                                <button className="w-12 h-6 bg-zinc-900 rounded-full relative">
                                   <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                                </button>
                             </div>
                          </div>

                          <div className="space-y-6">
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Estratégia de Recuperação</label>
                                <select className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl font-bold">
                                   <option>Hybrid Search (Recomendado)</option>
                                   <option>Semantic Only</option>
                                   <option>Graph Only</option>
                                   <option>Decision Priority</option>
                                </select>
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Limite de Memórias</label>
                                <input type="number" className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl font-bold" defaultValue={8} />
                             </div>
                          </div>
                       </div>
                    </div>
                  )}

                  {activeTab === 'tests' && (
                    <div className="space-y-10">
                       <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                             <TestTube className="w-5 h-5 text-indigo-500" /> Playground de Testes
                          </h4>
                          <button className="px-6 py-3 bg-zinc-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">Novo Cenário de Teste</button>
                       </div>

                       <div className="bg-zinc-50 border border-zinc-100 rounded-[3rem] overflow-hidden min-h-[400px] flex flex-col">
                          <div className="p-8 border-b border-zinc-100 bg-white">
                             <p className="text-xs font-bold text-zinc-500 mb-4 uppercase tracking-[0.15em]">Mensagem de Teste</p>
                             <textarea 
                               placeholder="Digite uma mensagem para testar como este agente responderia..."
                               className="w-full p-6 bg-zinc-50 border border-zinc-100 rounded-[2rem] font-medium text-sm min-h-[120px] outline-none"
                             />
                             <div className="mt-6 flex justify-end">
                                <button className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                                   <Sparkles className="w-4 h-4" /> Executar Simulação
                                </button>
                             </div>
                          </div>
                          <div className="flex-1 p-12 flex flex-col items-center justify-center grayscale opacity-30 text-center">
                             <Bot className="w-16 h-16 text-zinc-300 mb-6" />
                             <p className="text-zinc-400 font-bold italic tracking-tight">Nenhum teste executado recentemente.</p>
                          </div>
                       </div>
                    </div>
                  )}
               </div>
             )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
