import React, { useState } from 'react';
import { Agent, AgentTestRun, Product, AgentInstructionVersion } from '../../../types';
import { 
  PlayCircle, FlaskConical, Search, Bot, 
  Terminal, ArrowRight, Loader2, MessageSquare,
  Activity, CheckCircle2, XCircle, HelpCircle,
  Eye, Brain, Target, Sparkles
} from 'lucide-react';
import { db } from '../../../lib/firebase';
import { collection, query, getDocs, limit, orderBy, where } from 'firebase/firestore';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { callGeminiProxy } from '../../../lib/geminiProxy';

interface Props {
  agents: Agent[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

export default function AgentTestsTab({ agents, selectedId, setSelectedId }: Props) {
  const [testInput, setTestInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  async function loadExampleProducts() {
    setLoadingProducts(true);
    try {
      const snap = await getDocs(query(collection(db, 'products'), limit(5)));
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProducts(false);
    }
  }

  function compilePrompt(agent: Agent, version: AgentInstructionVersion) {
    if (version.compiled_prompt) return version.compiled_prompt;
    if (!version.instruction_blocks) return '';
    
    const blocks = version.instruction_blocks as any;
    let prompt = Object.entries(blocks)
      .filter(([_, val]) => typeof val === 'string' && val.length > 0)
      .map(([key, val]) => `## ${key.split('_').join(' ').toUpperCase()}\n${val}`)
      .join('\n\n');

    // Simple variable replacement for preview
    if (selectedProduct) {
      prompt = prompt.replace(/\{\{product\.name\}\}/g, selectedProduct.name);
      prompt = prompt.replace(/\{\{product\.description\}\}/g, selectedProduct.description || '');
    }
    
    return prompt;
  }

  async function runTest() {
    if (!selectedId || !testInput || !selectedAgent) return;
    setIsRunning(true);
    try {
      // 1. Get active version instructions
      const q = query(
        collection(db, 'agent_instruction_versions'), 
        where('agent_id', '==', selectedId),
        where('is_active', '==', true),
        limit(1)
      );
      const versionSnap = await getDocs(q);
      let systemInstruction = "";
      
      if (!versionSnap.empty) {
        systemInstruction = versionSnap.docs[0].data().compiled_prompt || "";
      } else {
        systemInstruction = `Você é o agente ${selectedAgent.name}. Sua descrição: ${selectedAgent.description}`;
      }

      // 2. Call Gemini
      const responseText = await callGeminiProxy({
        model: "gemini-3-flash-preview",
        prompt: `System: ${systemInstruction}\n\nContexto do Produto: ${selectedProduct ? JSON.stringify(selectedProduct) : "Nenhum produto selecionado"}\n\nMensagem do Usuário: ${testInput}`,
        config: {
          temperature: 0.7
        }
      });
      
      setTestResponse(responseText || "Sem resposta do modelo.");
    } catch (e) {
      console.error(e);
      setTestResponse("Erro na execução: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsRunning(false);
    }
  }

  const selectedAgent = agents.find(a => a.id === selectedId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-280px)] min-h-[600px]">
       {/* Left: Configuration */}
       <div className="lg:col-span-4 flex flex-col bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="p-8 border-b border-zinc-100 bg-zinc-50/50">
             <h4 className="text-xl font-black text-zinc-900 tracking-tight">Test Playground</h4>
             <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mt-1">Simule inputs e veja comportamentos</p>
          </div>
          
          <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-8">
             {/* Agent Selector */}
             <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block px-2">1. Agente em Teste</label>
                <div className="flex flex-wrap gap-2">
                   {agents.map(a => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedId(a.id)}
                        className={cn(
                          "px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border shrink-0",
                          selectedId === a.id ? "bg-zinc-900 text-white border-zinc-900 shadow-lg" : "bg-white text-zinc-500 border-zinc-100 hover:border-zinc-300"
                        )}
                      >
                         {a.name}
                      </button>
                   ))}
                </div>
             </div>

             {/* Context Selector */}
             <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                   <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">2. Contexto de Produto (MOCK)</label>
                   <button 
                     onClick={loadExampleProducts}
                     className="text-[9px] font-black uppercase text-indigo-600 tracking-[0.1em]"
                   >
                      Carregar Reais
                   </button>
                </div>
                <div className="space-y-2">
                   {products.length === 0 ? (
                     <div className="p-5 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 text-center">
                        <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest">Nenhum produto carregado</span>
                     </div>
                   ) : products.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProduct(p)}
                        className={cn(
                          "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between",
                          selectedProduct?.id === p.id 
                            ? "bg-zinc-900 text-white border-zinc-900 shadow-md" 
                            : "bg-white border-zinc-50 hover:border-zinc-200"
                        )}
                      >
                         <span className="text-xs font-bold leading-none">{p.name}</span>
                         <CheckCircle2 className={cn("w-4 h-4", selectedProduct?.id === p.id ? "text-emerald-400" : "text-zinc-100")} />
                      </button>
                   ))}
                </div>
             </div>

             {/* Input Area */}
             <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block px-2">3. Mensagem do Usuário</label>
                <textarea 
                  className="w-full h-32 p-6 bg-zinc-50 border border-zinc-100 rounded-[2rem] outline-none focus:ring-4 focus:ring-zinc-900/5 transition-all text-sm font-medium leading-relaxed italic placeholder:text-zinc-300 resize-none"
                  placeholder="Ex: 'Quero fatiar minha iniciativa de busca global em partes que entreguem valor incremental...'"
                  value={testInput}
                  onChange={e => setTestInput(e.target.value)}
                />
             </div>

             <button 
                onClick={runTest}
                disabled={isRunning || !selectedId || !testInput}
                className="w-full py-5 bg-zinc-900 text-white rounded-[2rem] font-bold text-sm tracking-tight flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-100 disabled:opacity-50"
             >
                {isRunning ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-6 h-6" />}
                Rodar Teste da Tona
             </button>
          </div>
       </div>

       {/* Right: Output Console */}
       <div className="lg:col-span-8 flex flex-col bg-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
          <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                   <Terminal className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                   <h4 className="font-black text-xl text-white tracking-tight leading-none mb-1">IA Execution Output</h4>
                   <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Rastreabilidade e Resposta</p>
                </div>
             </div>
             
             <div className="flex gap-4">
                {[
                  { label: 'Tokenize', icon: Activity },
                  { label: 'JSON Check', icon: Target },
                  { label: 'Memory Ping', icon: Brain }
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center">
                     <item.icon className="w-4 h-4 text-white/20 mb-1" />
                     <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">{item.label}</span>
                  </div>
                ))}
             </div>
          </div>

          <div className="flex-1 p-10 overflow-y-auto no-scrollbar font-mono text-sm leading-relaxed text-indigo-100 space-y-10">
             {isRunning ? (
                <div className="h-full flex flex-col items-center justify-center gap-6 opacity-60">
                   <div className="relative">
                      <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
                      <div className="absolute inset-0 flex items-center justify-center">
                         <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                      </div>
                   </div>
                   <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] animate-pulse">Consultando oráculo de silício...</p>
                </div>
             ) : testResponse ? (
                <div className="space-y-8">
                   <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/20">
                         <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="bg-white/5 p-8 rounded-3xl border border-white/10 w-full whitespace-pre-wrap leading-loose shadow-2xl">
                         {testResponse}
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                         <h6 className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-4 px-2 flex items-center gap-2">
                           <Sparkles className="w-3 h-3" /> Extração de Estrutura
                         </h6>
                         <div className="space-y-3">
                            {['Fatos: 1', 'Desições: 0', 'Hipóteses: 1', 'Riscos: 0'].map(tag => (
                               <div key={tag} className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-bold text-white/60 flex justify-between items-center group cursor-default">
                                  <span>{tag.split(': ')[0]}</span>
                                  <span className="text-white group-hover:text-indigo-400 transition-colors">{tag.split(': ')[1]}</span>
                               </div>
                            ))}
                         </div>
                      </div>
                      <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                         <h6 className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-4 px-2 flex items-center gap-2">
                           <Eye className="w-3 h-3" /> Audit Score
                         </h6>
                         <div className="flex items-center gap-4 px-2">
                            <div className="w-14 h-14 rounded-full border-4 border-indigo-500/30 flex items-center justify-center">
                               <span className="text-lg font-black text-white">92</span>
                            </div>
                            <div>
                               <p className="text-[10px] font-bold text-white leading-tight">Excellent Alignment</p>
                               <p className="text-[9px] text-white/30 font-medium italic mt-1 leading-tight">Prompt followed accurately.</p>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
             ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-10 grayscale">
                   <Bot className="w-20 h-20 text-white mb-6" />
                   <p className="text-lg font-black uppercase tracking-[0.2em] text-white">Aguardando Execução</p>
                </div>
             )}
          </div>

          <div className="p-8 bg-zinc-950 border-t border-white/5 flex items-center justify-between">
             <div className="flex gap-6">
                <div className="flex gap-2 items-center">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-white/60 leading-none">Status: Ready</span>
                </div>
                <div className="flex gap-2 items-center">
                   <div className="w-2 h-2 rounded-full bg-indigo-500" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-white/60 leading-none">Model: gemini-1.5-flash</span>
                </div>
             </div>
             <div className="flex gap-4">
                <button className="px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/80 transition-all border border-white/10 flex items-center gap-2">
                   <Eye className="w-4 h-4" /> Mostrar Prompt
                </button>
                <button 
                  onClick={() => setTestResponse(null)}
                  className="px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/80 transition-all border border-white/10"
                >
                   Limpar Console
                </button>
             </div>
          </div>
       </div>
    </div>
  );
}
