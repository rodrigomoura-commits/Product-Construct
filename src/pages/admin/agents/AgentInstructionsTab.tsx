import React, { useState, useEffect } from 'react';
import { Agent, InstructionBlocks, AgentInstructionVersion } from '../../../types';
import { 
  Bot, Search, Edit3, Save, Zap, 
  ChevronRight, ArrowRight, BookOpen,
  Info, AlertCircle, CheckCircle2, Loader2,
  Settings, History, Code, Eye, Brain, Sparkles
} from 'lucide-react';
import { db, auth } from '../../../lib/firebase';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { GEMINI_MODELS } from '../../../config/ai';

import { callGeminiProxy } from '../../../lib/geminiProxy';

const BLOCK_LABELS: Record<keyof InstructionBlocks, string> = {
  identity: "1. Identidade do Agente",
  objective: "2. Objetivo do Agente",
  when_to_use: "3. Quando Usar",
  when_not_to_use: "4. Quando Não Usar",
  expected_inputs: "5. Inputs Esperados",
  mandatory_tasks: "6. Tarefas Obrigatórias",
  reasoning_method: "7. Método de Raciocínio",
  questions_to_ask: "8. Perguntas que Deve Fazer",
  quality_criteria: "9. Critérios de Qualidade",
  guardrails: "10. Guardrails",
  output_format: "11. Formato de Saída",
  save_behavior: "12. Onde Salvar o Resultado",
  gap_handling: "13. Como Lidar com Lacunas",
  classification_rules: "14. Regras de Classificação",
  good_examples: "15. Exemplos Bons",
  bad_examples: "16. Exemplos Ruins"
};

interface Props {
  agents: Agent[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

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

export default function AgentInstructionsTab({ agents, selectedId, setSelectedId }: Props) {
  const [activeBlocks, setActiveBlocks] = useState<InstructionBlocks | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeBlockKey, setActiveBlockKey] = useState<keyof InstructionBlocks>('identity');
  const [search, setSearch] = useState('');

  const selectedAgent = agents.find(a => a.id === selectedId);

  useEffect(() => {
    if (selectedId) {
       loadInstructions(selectedId);
    }
  }, [selectedId]);

  async function loadInstructions(id: string) {
    setLoading(true);
    try {
      // Find active version
      const q = query(
        collection(db, 'agent_instruction_versions'), 
        where('agent_id', '==', id),
        where('is_active', '==', true),
        limit(1)
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const data = snap.docs[0].data() as AgentInstructionVersion;
        setActiveBlocks(data.instruction_blocks);
      } else {
        // Fallback to empty blocks
        const empty: InstructionBlocks = {
          identity: "", objective: "", when_to_use: "", when_not_to_use: "",
          expected_inputs: "", mandatory_tasks: "", reasoning_method: "",
          questions_to_ask: "", quality_criteria: "", guardrails: "",
          output_format: "", save_behavior: "", gap_handling: "",
          classification_rules: "", good_examples: "", bad_examples: ""
        };
        setActiveBlocks(empty);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft() {
    if (!selectedId || !activeBlocks) return;
    setSaving(true);
    try {
      // Find current draft or create one
      const q = query(
        collection(db, 'agent_instruction_versions'), 
        where('agent_id', '==', selectedId),
        where('status', '==', 'draft'),
        limit(1)
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        await updateDoc(doc(db, 'agent_instruction_versions', snap.docs[0].id), {
          instruction_blocks: activeBlocks,
          updated_at: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'agent_instruction_versions'), {
          agent_id: selectedId,
          version_number: `draft_${new Date().getTime()}`,
          status: 'draft',
          instruction_blocks: activeBlocks,
          compiled_prompt: Object.values(activeBlocks).join('\n\n'),
          is_active: false,
          created_at: serverTimestamp(),
          created_by: auth.currentUser?.uid,
          change_summary: "Rascunho salvo"
        });
      }
      alert("Rascunho salvo com sucesso!");
    } catch (e) {
      alert("Erro ao salvar rascunho.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!selectedId || !activeBlocks) return;
    const summary = prompt("Resumo das alterações para esta versão:");
    if (summary === null) return;

    setSaving(true);
    try {
      // 1. Create new published version
      const versionRef = await addDoc(collection(db, 'agent_instruction_versions'), {
        agent_id: selectedId,
        version_number: `v${new Date().toLocaleDateString().replace(/\//g, '')}.${new Date().getHours()}${new Date().getMinutes()}`, 
        status: 'published',
        instruction_blocks: activeBlocks,
        compiled_prompt: Object.values(activeBlocks).join('\n\n'),
        is_active: true,
        created_at: serverTimestamp(),
        created_by: auth.currentUser?.uid,
        change_summary: summary || "Publicação via Agent Studio"
      });

      // 2. Deactivate other versions of THIS agent
      const q = query(
        collection(db, 'agent_instruction_versions'), 
        where('agent_id', '==', selectedId),
        where('is_active', '==', true)
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        if (d.id !== versionRef.id) {
          await updateDoc(doc(db, 'agent_instruction_versions', d.id), { is_active: false });
        }
      }

      // 3. Update agent reference
      await updateDoc(doc(db, 'agents', selectedId), {
        active_version_id: versionRef.id,
        updated_at: serverTimestamp()
      });

      alert("Instrução publicada com sucesso! Versão agora está ativa.");
    } catch (e) {
      console.error(e);
      alert("Erro ao publicar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreDefault() {
    if (!activeBlocks || !activeBlockKey) return;
    if (confirm(`Restaurar a seção "${BLOCK_LABELS[activeBlockKey]}" para o padrão da Tona?`)) {
      setActiveBlocks({ ...activeBlocks, [activeBlockKey]: DEFAULT_INSTRUCTIONS[activeBlockKey] });
    }
  }

  async function handleImproveWithTona() {
    if (!selectedAgent || !activeBlocks || !activeBlockKey) return;
    
    setLoading(true);
    try {
      const currentText = activeBlocks[activeBlockKey];
      const blockLabel = BLOCK_LABELS[activeBlockKey];
      
      const prompt = `Você é um Engenheiro de Prompt Sênior. Sua tarefa é melhorar a seguinte seção da instrução de um agente de IA especialista em produto.
      
      Agente: ${selectedAgent.name}
      Contexto do Agente: ${selectedAgent.description}
      Seção Atual: ${blockLabel}
      Conteúdo Atual: "${currentText}"
      
      Melhore o conteúdo atual para ser mais preciso, estruturado e eficaz, seguindo as melhores práticas de prompting. 
      Mantenha o tom profissional e direto. 
      Responda APENAS com o texto melhorado para esta seção específica.`;

      const improvedText = await callGeminiProxy({
        prompt: prompt,
        useCase: "agent_instruction_improvement",
        agentId: selectedId
      });
      if (improvedText) {
        setActiveBlocks({ ...activeBlocks, [activeBlockKey]: improvedText });
        alert("Seção melhorada pela Tona!");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao falar com a Tona.");
    } finally {
      setLoading(false);
    }
  }

  const filteredAgents = agents.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-280px)] min-h-[600px]">
       {/* Sidebar: Agents List */}
       <div className="lg:col-span-3 flex flex-col bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="p-6 border-b border-zinc-100">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="text" 
                  placeholder="Pesquisar agente..."
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-bold outline-none"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
             {filteredAgents.map(agent => (
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
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                        selectedId === agent.id ? "bg-zinc-800" : "bg-zinc-50 group-hover:bg-zinc-100"
                      )}>
                         <Bot className="w-5 h-5" />
                      </div>
                      <div>
                         <p className="font-bold text-sm tracking-tight">{agent.name}</p>
                         <p className={cn(
                           "text-[8px] font-black uppercase tracking-widest",
                           selectedId === agent.id ? "text-zinc-500" : "text-zinc-400"
                         )}>{agent.primary_stage_id}</p>
                      </div>
                   </div>
                   <ChevronRight className={cn("w-4 h-4 transition-transform", selectedId === agent.id ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0")} />
                </button>
             ))}
          </div>
       </div>

       {/* Editor: Instruction Blocks */}
       <div className="lg:col-span-6 flex flex-col bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm relative">
          {selectedAgent ? (
            <>
               <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-white border border-zinc-200 rounded-2xl flex items-center justify-center shadow-sm">
                        <Edit3 className="w-6 h-6 text-zinc-900" />
                     </div>
                     <div>
                        <h4 className="font-black text-xl text-zinc-900 tracking-tighter leading-none mb-1">{selectedAgent.name}</h4>
                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Editor de Instruções</p>
                     </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSaveDraft}
                      disabled={saving}
                      className="px-6 py-3 bg-white border border-zinc-200 text-zinc-600 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-50 transition-all disabled:opacity-50"
                    >
                       {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <History className="w-5 h-5" />}
                       Salvar Rascunho
                    </button>
                    <button 
                      onClick={handlePublish}
                      disabled={saving}
                      className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-100 disabled:opacity-50"
                    >
                       {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                       Publicar Versão
                    </button>
                  </div>
               </div>

               <div className="flex-1 flex overflow-hidden">
                  {/* Block Selection */}
                  <div className="w-60 border-r border-zinc-100 overflow-y-auto no-scrollbar p-6 bg-zinc-50/30 space-y-1">
                     {(Object.keys(BLOCK_LABELS) as Array<keyof InstructionBlocks>).map(key => (
                        <button
                          key={key}
                          onClick={() => setActiveBlockKey(key)}
                          className={cn(
                            "w-full text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            activeBlockKey === key ? "bg-white text-zinc-900 shadow-sm border border-zinc-200" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                          )}
                        >
                           {BLOCK_LABELS[key].split('. ')[1] || BLOCK_LABELS[key]}
                        </button>
                     ))}
                  </div>

                  {/* Main Input Area */}
                  <div className="flex-1 p-8 overflow-y-auto no-scrollbar bg-slate-50/50 relative">
                     <div className="mb-6 flex items-center justify-between">
                        <h5 className="text-sm font-black text-zinc-900 flex items-center gap-2">
                           <BookOpen className="w-4 h-4" />
                           {BLOCK_LABELS[activeBlockKey]}
                        </h5>
                        <div className="flex gap-2">
                           <span className="px-2 py-1 bg-zinc-200 rounded text-[8px] font-black uppercase text-zinc-500 tracking-widest">Rascunho</span>
                        </div>
                     </div>
                     {loading ? (
                       <div className="h-64 flex items-center justify-center">
                          <Loader2 className="w-10 h-10 animate-spin text-zinc-200" />
                       </div>
                     ) : (
                       <textarea 
                         className="w-full h-[calc(100%-100px)] p-8 bg-white border border-zinc-200 rounded-[2rem] shadow-sm outline-none focus:ring-4 focus:ring-zinc-900/5 transition-all text-zinc-700 font-medium leading-relaxed resize-none"
                         placeholder={`Descreva a seção: ${BLOCK_LABELS[activeBlockKey]}...`}
                         value={activeBlocks?.[activeBlockKey] || ''}
                         onChange={e => {
                            if (activeBlocks) {
                               setActiveBlocks({ ...activeBlocks, [activeBlockKey]: e.target.value });
                            }
                         }}
                       />
                     )}
                     
                     <div className="mt-6 flex items-center gap-3">
                        <button 
                          onClick={handleImproveWithTona}
                          className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                        >
                           <Sparkles className="w-4 h-4" />
                           Melhorar com Tona
                        </button>
                        <button 
                          onClick={handleRestoreDefault}
                          className="flex-1 py-4 bg-white border border-zinc-200 rounded-2xl text-[10px] font-black uppercase text-zinc-500 hover:bg-zinc-50 transition-all text-center"
                        >
                          Restaurar Padrão
                        </button>
                     </div>
                  </div>
               </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
               <div className="w-20 h-20 bg-zinc-50 rounded-[2rem] flex items-center justify-center mb-8">
                  <BookOpen className="w-10 h-10 text-zinc-200" />
               </div>
               <h4 className="text-2xl font-black text-zinc-900 tracking-tighter mb-2">Selecione um Agente</h4>
               <p className="text-zinc-500 font-medium italic">Escolha um agente ao lado para começar a editar suas instruções estruturadas.</p>
            </div>
          )}
       </div>

       {/* Right Sidebar: Context & Preview */}
       <div className="lg:col-span-3 space-y-6 overflow-y-auto no-scrollbar">
          <div className="bg-zinc-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 right-0 p-16 bg-white/5 rounded-full translate-x-1/2 -translate-y-1/2 blur-2xl" />
             <div className="relative z-10">
                <Code className="w-8 h-8 mb-6 text-indigo-400" />
                <h5 className="font-black text-lg mb-4 leading-tight tracking-tight">Variáveis Disponíveis</h5>
                <div className="space-y-3">
                   {[
                     '{{product.name}}', '{{product.description}}', '{{stage.goal}}', 
                     '{{conversation.history}}', '{{memory.base}}'
                   ].map(v => (
                      <button key={v} className="w-full text-left p-3 bg-white/10 rounded-xl font-mono text-[10px] hover:bg-white/20 transition-all border border-white/5">
                         {v}
                      </button>
                   ))}
                </div>
                <button className="w-full mt-6 py-3 bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/50 border border-white/5 hover:bg-white/20">Ver Todas as Variáveis</button>
             </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-[2.5rem] p-8">
             <div className="flex items-center justify-between mb-8">
                <h5 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Metadata do Agente</h5>
                <Settings className="w-4 h-4 text-zinc-300" />
             </div>
             <div className="space-y-6">
                <div>
                   <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest block mb-2">Modelo Preferencial</label>
                   <select 
                     value={selectedAgent?.default_model}
                     onChange={(e) => selectedId && updateDoc(doc(db, 'agents', selectedId), { default_model: e.target.value })}
                     className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-bold font-mono"
                   >
                      {GEMINI_MODELS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                   </select>
                </div>

                <div className="pt-4 border-t border-zinc-50 space-y-4">
                   <div className="flex items-center justify-between">
                      <h6 className="text-[10px] font-black uppercase text-zinc-900 tracking-widest flex items-center gap-2">
                        <Brain className="w-3.5 h-3.5 text-indigo-500" />
                        Mindflow Neural Mode
                      </h6>
                      <button 
                        onClick={() => selectedId && updateDoc(doc(db, 'agents', selectedId), { mindflow_enabled: !selectedAgent?.mindflow_enabled })}
                        className={cn(
                          "w-10 h-5 rounded-full relative transition-all",
                          selectedAgent?.mindflow_enabled ? "bg-zinc-900" : "bg-zinc-200"
                        )}
                      >
                         <div className={cn(
                           "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                           selectedAgent?.mindflow_enabled ? "right-1" : "left-1"
                         )} />
                      </button>
                   </div>

                   {selectedAgent?.mindflow_enabled && (
                     <div className="space-y-4 pt-2">
                        <div>
                           <label className="text-[8px] font-black uppercase text-zinc-400 tracking-widest block mb-2">Estratégia de Recuperação</label>
                           <select 
                             value={selectedAgent?.retrieval_strategy || 'hybrid_search'}
                             onChange={(e) => selectedId && updateDoc(doc(db, 'agents', selectedId), { retrieval_strategy: e.target.value })}
                             className="w-full p-2.5 bg-zinc-50 border border-zinc-100 rounded-lg text-[10px] font-bold"
                           >
                              <option value="hybrid_search">Hybrid (Semantic + Graph)</option>
                              <option value="semantic_search">Busca Semântica</option>
                              <option value="recency_search">Recência</option>
                              <option value="decision_first">Decisões Primeiro</option>
                           </select>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                           <div className="flex flex-col">
                              <span className="text-[9px] font-black text-indigo-900 uppercase tracking-widest">Self-Learning</span>
                              <span className="text-[8px] text-indigo-600 font-medium">Salvar aprendizados no Mindflow</span>
                           </div>
                           <button 
                             onClick={() => selectedId && updateDoc(doc(db, 'agents', selectedId), { learned_memory_enabled: !selectedAgent?.learned_memory_enabled })}
                             className={cn(
                               "w-8 h-4 rounded-full relative transition-all",
                               selectedAgent?.learned_memory_enabled ? "bg-indigo-600" : "bg-zinc-300"
                             )}
                           >
                              <div className={cn(
                                "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                                selectedAgent?.learned_memory_enabled ? "right-0.5" : "left-0.5"
                              )} />
                           </button>
                        </div>
                     </div>
                   )}
                </div>
                
                <div className="pt-4 border-t border-zinc-50 space-y-3">
                   <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Memória Base</span>
                      <div className="w-8 h-4 bg-zinc-900 rounded-full relative">
                         <div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full" />
                      </div>
                   </div>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
}
