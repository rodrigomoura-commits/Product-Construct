import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, MoreVertical, Edit2, 
  Trash2, Archive, Copy, ExternalLink, TestTube,
  Download, Upload, Check, AlertCircle, FileText,
  ChevronRight, Brain, Target, Zap, Clock, Users,
  BarChart3, Layout, ChevronDown, LucideIcon,
  MessageSquare, Lightbulb, Sparkles, RefreshCw
} from 'lucide-react';
import { 
  collection, query, where, getDocs, addDoc, 
  serverTimestamp, updateDoc, doc, deleteDoc, orderBy, limit 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { MindflowContextMap } from '../../types';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { classifyInteractionContext } from '../../lib/mindflowContext';
import { ensureMindflowContextMapsSeed } from '../../lib/mindflowContextMapsSeed';

export default function MindflowContextsSection() {
  const [contexts, setContexts] = useState<MindflowContextMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'create' | 'import' | 'test' | 'usage'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Test State
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchContexts();
  }, []);

  const fetchContexts = async () => {
    setLoading(true);
    const path = 'mindflow_context_maps';
    try {
      const q = query(collection(db, path), orderBy('order', 'asc'), limit(50));
      const snap = await getDocs(q);
      setContexts(snap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowContextMap)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async () => {
    setSeeding(true);
    try {
      await ensureMindflowContextMapsSeed();
      toast.success("Mapas de contexto da jornada inicializados!");
      fetchContexts();
    } catch (e) {
      toast.error("Erro ao inicializar mapas.");
    } finally {
      setSeeding(false);
    }
  };

  const handleTestClassification = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    try {
      const result = await classifyInteractionContext({ userMessage: testMessage });
      setTestResult(result);
    } catch (e) {
      toast.error("Erro no teste.");
    } finally {
      setTesting(false);
    }
  };

  const filteredContexts = contexts.filter(ctx => {
    const name = ctx.name || '';
    const intention = ctx.intention || '';
    const frameworkKey = ctx.framework_key || '';
    const term = searchTerm.toLowerCase();
    
    return name.toLowerCase().includes(term) ||
           intention.toLowerCase().includes(term) ||
           frameworkKey.toLowerCase().includes(term);
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Contextos do Mindflow</h2>
          <p className="text-zinc-500 text-sm">Gerencie como a Tona entende e classifica as interações na jornada.</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={handleInitialize}
             disabled={seeding}
             className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-2 border border-indigo-100"
           >
             {seeding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
             Inicializar Jornada
           </button>
           <button 
             onClick={() => setActiveTab('create')}
             className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-lg flex items-center gap-2"
           >
             <Plus className="w-4 h-4" />
             Novo Contexto
           </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-100 rounded-2xl w-fit">
        {[
          { id: 'all', label: 'Tabela de Contextos', icon: Layout },
          { id: 'create', label: 'Manual', icon: Plus },
          { id: 'test', label: 'Testar Classificação', icon: TestTube },
          { id: 'usage', label: 'Logs de Uso', icon: BarChart3 }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
              activeTab === tab.id ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white border border-zinc-100 rounded-3xl overflow-hidden shadow-sm">
        {activeTab === 'all' && (
          <div className="flex flex-col">
            <div className="p-6 border-b border-zinc-50 flex items-center gap-4">
               <div className="relative flex-1">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                 <input 
                   type="text"
                   placeholder="Buscar por nome, intenção ou chave..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full pl-12 pr-4 py-3 bg-zinc-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
                 />
               </div>
               <button className="p-3 bg-zinc-50 text-zinc-600 rounded-2xl hover:bg-zinc-100 transition-all">
                 <Filter className="w-5 h-5" />
               </button>
            </div>

            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-zinc-50/50">
                     <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Produto / Contexto</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Foco & Intenção</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Pesos (H/M/L)</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Ações</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-zinc-50">
                   {loading ? (
                     <tr>
                       <td colSpan={5} className="px-6 py-12 text-center">
                         <div className="flex flex-col items-center gap-2">
                           <Brain className="w-8 h-8 text-indigo-200 animate-pulse" />
                           <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Carregando contextos...</span>
                         </div>
                       </td>
                     </tr>
                   ) : filteredContexts.length === 0 ? (
                     <tr>
                       <td colSpan={5} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center max-w-sm mx-auto">
                            <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mb-4">
                              <Sparkles className="w-8 h-8 text-zinc-200" />
                            </div>
                            <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-2">Nenhum contexto encontrado</h3>
                            <p className="text-xs text-zinc-500 font-medium mb-6 leading-relaxed">
                              Inicialize os contextos oficiais da jornada do produto para habilitar a inteligência cognitiva da Tona.
                            </p>
                            <button 
                              onClick={handleInitialize}
                              className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2"
                            >
                              <Sparkles className="w-3.5 h-3.5" /> Inicializar Jornada
                            </button>
                          </div>
                       </td>
                     </tr>
                   ) : filteredContexts.map(ctx => (
                     <tr key={ctx.id} className="hover:bg-zinc-50/50 transition-all group">
                       <td className="px-6 py-4">
                         <div className="flex flex-col">
                           <div className="flex items-center gap-2 mb-0.5">
                             <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">{ctx.framework_key}</span>
                             {ctx.is_system_context && <span className="text-[8px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-sm font-black uppercase">System</span>}
                           </div>
                           <span className="text-sm font-bold text-zinc-900">{ctx.name}</span>
                           <span className="text-[11px] text-zinc-500 font-medium">{ctx.focus}</span>
                         </div>
                       </td>
                       <td className="px-6 py-4">
                         <div className="max-w-xs">
                           <p className="text-xs font-bold text-zinc-700 truncate">{ctx.intention}</p>
                           <p className="text-[10px] text-zinc-500 line-clamp-1">{ctx.description}</p>
                         </div>
                       </td>
                       <td className="px-6 py-4">
                         <div className="flex flex-col gap-1.5">
                           <div className="flex items-center gap-1">
                             <span className="text-[8px] font-black text-zinc-400 w-6">HYP</span>
                             <span className={cn(
                               "px-1.5 py-0.5 rounded text-[9px] font-black",
                               ctx.weights.hypothesis === 'H' ? "bg-rose-50 text-rose-600" : ctx.weights.hypothesis === 'M' ? "bg-amber-50 text-amber-600" : "bg-zinc-50 text-zinc-400"
                             )}>{ctx.weights.hypothesis}</span>
                             <span className="text-[8px] font-black text-zinc-400 w-6 ml-2">MEM</span>
                             <span className={cn(
                               "px-1.5 py-0.5 rounded text-[9px] font-black",
                               ctx.weights.memory === 'H' ? "bg-rose-50 text-rose-600" : ctx.weights.memory === 'M' ? "bg-amber-50 text-amber-600" : "bg-zinc-50 text-zinc-400"
                             )}>{ctx.weights.memory}</span>
                           </div>
                           <div className="flex items-center gap-1">
                             <span className="text-[8px] font-black text-zinc-400 w-6">LRN</span>
                             <span className={cn(
                               "px-1.5 py-0.5 rounded text-[9px] font-black",
                               ctx.weights.learning === 'H' ? "bg-rose-50 text-rose-600" : ctx.weights.learning === 'M' ? "bg-amber-50 text-amber-600" : "bg-zinc-50 text-zinc-400"
                             )}>{ctx.weights.learning}</span>
                             <span className="text-[8px] font-black text-zinc-400 w-6 ml-2">RSK</span>
                             <span className={cn(
                               "px-1.5 py-0.5 rounded text-[9px] font-black",
                               ctx.weights.risk === 'H' ? "bg-rose-50 text-rose-600" : ctx.weights.risk === 'M' ? "bg-amber-50 text-amber-600" : "bg-zinc-50 text-zinc-400"
                             )}>{ctx.weights.risk}</span>
                           </div>
                         </div>
                       </td>
                       <td className="px-6 py-4">
                         <span className={cn(
                           "px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                           ctx.status === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-zinc-100 text-zinc-500 border-zinc-200"
                         )}>
                           {ctx.status === 'active' ? 'Ativo' : 'Inativo'}
                         </span>
                       </td>
                       <td className="px-6 py-4">
                         <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                           <button className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-zinc-400 hover:text-indigo-600 transition-all" title="Ver detalhes">
                             <ExternalLink className="w-4 h-4" />
                           </button>
                           <button className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-zinc-400 hover:text-indigo-600 transition-all" title="Editar">
                             <Edit2 className="w-4 h-4" />
                           </button>
                         </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'test' && (
          <div className="p-8">
            <div className="flex gap-8 mb-8">
               <div className="flex-1 space-y-4">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Mensagem do Usuário</label>
                   <textarea 
                     value={testMessage}
                     onChange={(e) => setTestMessage(e.target.value)}
                     placeholder="Digite uma mensagem para testar a classificação cognitiva..."
                     className="w-full px-6 py-4 bg-zinc-50 border-none rounded-3xl text-sm h-32 resize-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
                   />
                 </div>
                 <button 
                   onClick={handleTestClassification}
                   disabled={testing || !testMessage}
                   className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                 >
                   {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                   {testing ? "Classificando..." : "Testar Classificação"}
                 </button>
               </div>
               <div className="w-96 bg-zinc-50 rounded-3xl p-8 border border-zinc-100">
                 <div className="flex items-center gap-2 mb-8">
                   <Brain className="w-5 h-5 text-indigo-400" />
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Resultado Cognitivo</h4>
                 </div>
                 
                 {testResult ? (
                   <div className="space-y-8">
                     <div className="p-6 bg-white rounded-2xl shadow-sm border border-zinc-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                           <Target className="w-16 h-16 text-indigo-600" />
                        </div>
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter block mb-1">Top Match</span>
                        <p className="text-xl font-black text-zinc-900 mb-1">{testResult.name}</p>
                        <p className="text-[11px] text-zinc-500 mb-6 font-medium italic">"{testResult.intention}"</p>
                        
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Confiança</span>
                          <span className={cn(
                            "text-xs font-black",
                            testResult.confidence_score === 'Alta' ? "text-emerald-500" : testResult.confidence_score === 'Média' ? "text-amber-500" : "text-rose-500"
                          )}>
                             {testResult.confidence_score}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                           <motion.div 
                             className={cn(
                               "h-full",
                               testResult.confidence_score === 'Alta' ? "bg-emerald-500" : testResult.confidence_score === 'Média' ? "bg-amber-500" : "bg-rose-500"
                             )}
                             initial={{ width: 0 }}
                             animate={{ width: testResult.confidence_score === 'Alta' ? '90%' : testResult.confidence_score === 'Média' ? '60%' : '30%' }}
                           />
                        </div>
                     </div>

                     <div className="space-y-3">
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Motivo da Decisão</span>
                        <p className="text-[11px] text-zinc-600 font-medium leading-relaxed bg-white/50 p-4 rounded-xl border border-zinc-100 shadow-inner italic">
                           {testResult.reason}
                        </p>
                     </div>
                   </div>
                 ) : (
                   <div className="h-64 flex flex-col items-center justify-center text-center p-4">
                     <Target className="w-8 h-8 text-zinc-200 mb-4" />
                     <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-relaxed">
                       Aguardando entrada para simular inteligência cognitiva.
                     </p>
                   </div>
                 )}
               </div>
            </div>
          </div>
        )}

        {/* Placeholder components for other tabs */}
        {activeTab === 'create' && (
          <div className="p-12 text-center text-zinc-400">
            Interface de criação manual em desenvolvimento. Use "Inicializar Jornada".
          </div>
        )}
        
        {activeTab === 'usage' && (
          <div className="p-12 text-center text-zinc-400 italic">
            Nenhum log de uso registrado recentemente.
          </div>
        )}
      </div>
    </div>
  );
}
