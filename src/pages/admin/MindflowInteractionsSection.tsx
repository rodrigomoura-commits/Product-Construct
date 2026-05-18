import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, MoreVertical, Edit2, 
  Trash2, Archive, ExternalLink, TestTube,
  Download, Upload, Check, AlertCircle, FileText,
  ChevronRight, Brain, Target, Zap, Clock, Users,
  BarChart3, Layout, ChevronDown, MessageSquare,
  User, Eye, Sparkles, RefreshCw, Layers, XCircle
} from 'lucide-react';
import { 
  collection, query, where, getDocs, addDoc, 
  serverTimestamp, updateDoc, doc, deleteDoc, orderBy, limit 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { MindflowUserMemory, MindflowLearning } from '../../types';
import { cn } from '../../lib/utils';
import { safeText, toSearchableText } from '../../lib/safeText';
import { toast } from 'sonner';

export default function MindflowInteractionsSection() {
  const [memories, setMemories] = useState<MindflowUserMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [contextFilter, setContextFilter] = useState('');
  const [intentionFilter, setIntentionFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userLearnings, setUserLearnings] = useState<MindflowLearning[]>([]);
  const [viewingUser, setViewingUser] = useState(false);
  const [error, setError] = useState<{ message: string, code?: string, path?: string } | null>(null);

  // Filtragem local
  const filteredMemories = memories.filter(memory => {
    const matchesSearch = searchTerm === '' || 
      toSearchableText(memory.user_identifier).includes(toSearchableText(searchTerm)) ||
      toSearchableText(memory.user_message).includes(toSearchableText(searchTerm)) ||
      toSearchableText(memory.tona_response).includes(toSearchableText(searchTerm)) ||
      toSearchableText(memory.product).includes(toSearchableText(searchTerm)) ||
      toSearchableText(memory.context).includes(toSearchableText(searchTerm)) ||
      toSearchableText(memory.detected_intention).includes(toSearchableText(searchTerm));
    
    const matchesDate = dateFilter === '' || memory.memory_date === dateFilter;
    const matchesProduct = productFilter === '' || memory.product === productFilter;
    const matchesContext = contextFilter === '' || memory.context === contextFilter;
    const matchesIntention = intentionFilter === '' || memory.detected_intention === intentionFilter;
    
    return matchesSearch && matchesDate && matchesProduct && matchesContext && matchesIntention;
  });

  // Obter listas únicas para os filtros
  const uniqueProducts = Array.from(new Set(memories.map(m => m.product).filter(Boolean))) as string[];
  const uniqueContexts = Array.from(new Set(memories.map(m => m.context).filter(Boolean))) as string[];
  const uniqueIntentions = Array.from(new Set(memories.map(m => m.detected_intention).filter(Boolean))) as string[];

  useEffect(() => {
    fetchMemories();
  }, [selectedUser]);

  const fetchMemories = async () => {
    setLoading(true);
    const path = 'mindflow_user_memories';
    try {
      let q = query(
        collection(db, path), 
        orderBy('created_at', 'desc'),
        limit(50)
      );

      if (selectedUser) {
        q = query(
          collection(db, path),
          where('user_id', '==', selectedUser),
          orderBy('created_at', 'desc'),
          limit(50)
        );
      }

      const snap = await getDocs(q);
      setMemories(snap.docs.map(d => {
        const raw = d.data();
        return { 
          id: d.id, 
          ...raw,
          user_identifier: safeText(raw.user_identifier),
          user_message: safeText(raw.user_message),
          tona_response: safeText(raw.tona_response),
          product: safeText(raw.product),
          context: safeText(raw.context),
          detected_intention: safeText(raw.detected_intention)
        } as MindflowUserMemory;
      }));
    } catch (err: any) {
      console.error("[InteractionsSection] Failed to load memories:", err);
      setError({
        message: err?.message || String(err),
        code: err?.code,
        path: path
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserLearnings = async (userId: string) => {
    const path = 'mindflow_learnings';
    try {
      const q = query(
         collection(db, path),
         where('user_id', '==', userId),
         where('is_active', '==', true)
      );
      const snap = await getDocs(q);
      setUserLearnings(snap.docs.map(d => {
        const raw = d.data();
        return { 
          id: d.id, 
          ...raw,
          learning: safeText(raw.learning),
          theme: safeText(raw.theme),
          classification: safeText(raw.classification) as any
        } as MindflowLearning;
      }));
    } catch (err: any) {
      console.error("[InteractionsSection] Failed to load learnings:", err);
      setError({
        message: err?.message || String(err),
        code: err?.code,
        path: path
      });
    }
  };

  const handleViewUser = (userId: string) => {
    setSelectedUser(userId);
    fetchUserLearnings(userId);
    setViewingUser(true);
  };

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="p-6 bg-rose-50 border border-rose-100 rounded-[2rem] flex gap-4">
          <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <p className="text-xs font-black text-rose-900 uppercase tracking-widest">Falha de Dados: {error.path}</p>
            <p className="text-sm text-rose-700 mt-1 font-medium italic">{error.message}</p>
            {error.code === 'permission-denied' && (
              <p className="text-[11px] text-rose-600 font-bold mt-2">Acesso Negado. Verifique privilégios administrativos no Firestore.</p>
            )}
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-rose-300 hover:text-rose-500">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Interações & Memória por Usuário</h2>
          <p className="text-zinc-500 text-sm">Acompanhe todas as interações e a evolução da memória de cada usuário.</p>
        </div>
        {viewingUser && (
          <button 
            onClick={() => { setViewingUser(false); setSelectedUser(null); }}
            className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-200 transition-all"
          >
            Voltar para Geral
          </button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main List */}
        <div className={cn(
          "bg-white border border-zinc-100 rounded-3xl overflow-hidden shadow-sm transition-all duration-500",
          viewingUser ? "col-span-12 lg:col-span-8" : "col-span-12"
        )}>
          <div className="p-6 border-b border-zinc-50 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900">
              {viewingUser ? 'Interações do Usuário' : 'Últimas Interações'}
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input 
                  type="text"
                  placeholder="Nome, mensagem ou contexto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-[11px] font-medium focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none"
                />
              </div>

              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input 
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-[11px] font-medium focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none"
                />
              </div>

              <div className="relative min-w-[150px]">
                <Layout className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <select
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-[11px] font-medium focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none appearance-none"
                >
                  <option value="">Todos os Produtos</option>
                  {uniqueProducts.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
              </div>

              <div className="relative min-w-[150px]">
                <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <select
                  value={contextFilter}
                  onChange={(e) => setContextFilter(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-[11px] font-medium focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none appearance-none"
                >
                  <option value="">Todos os Contextos</option>
                  {uniqueContexts.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
              </div>

              <div className="relative min-w-[150px]">
                <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <select
                  value={intentionFilter}
                  onChange={(e) => setIntentionFilter(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-[11px] font-medium focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none appearance-none"
                >
                  <option value="">Todas as Intenções</option>
                  {uniqueIntentions.map(i => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
              </div>

              {(searchTerm || dateFilter || productFilter || contextFilter || intentionFilter) && (
                <button 
                  onClick={() => { setSearchTerm(''); setDateFilter(''); setProductFilter(''); setContextFilter(''); setIntentionFilter(''); }}
                  className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                >
                  Limpar
                </button>
              )}

              <button 
                onClick={fetchMemories}
                className="p-2 bg-zinc-50 text-zinc-600 border border-zinc-100 rounded-xl hover:bg-white hover:shadow-sm transition-all"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50">
                  {!viewingUser && <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Usuário</th>}
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Contexto / Produto</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Mensagem</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Data/Hora</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {loading ? (
                   <tr>
                     <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                           <Clock className="w-6 h-6 text-indigo-200 animate-spin" />
                           <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Recuperando trilhas...</span>
                        </div>
                     </td>
                   </tr>
                ) : filteredMemories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                      Nenhuma memória encontrada com os filtros atuais.
                    </td>
                  </tr>
                ) : filteredMemories.map(memory => (
                  <tr key={memory.id} className="hover:bg-zinc-50/50 transition-all group">
                    {!viewingUser && (
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => handleViewUser(memory.user_id)}
                          className="flex items-center gap-3 hover:text-indigo-600 transition-all text-left"
                        >
                          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                            <User className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-zinc-900 truncate max-w-[120px]">{memory.user_identifier || memory.user_id.slice(0, 8)}</span>
                            <span className="text-[9px] text-zinc-400 uppercase font-black">Ver Memória</span>
                          </div>
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter mb-0.5">{memory.product}</span>
                        <span className="text-xs font-bold text-zinc-700">{memory.context || 'Geral'}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-full h-1 bg-zinc-100 rounded-full overflow-hidden">
                             <div 
                               className={cn(
                                 "h-full",
                                 (memory.context_confidence_score || 0) > 0.7 ? "bg-emerald-400" : "bg-amber-400"
                               )}
                               style={{ width: `${(memory.context_confidence_score || 0) * 100}%` }}
                             />
                          </div>
                          <span className="text-[8px] font-black text-zinc-400">{( (memory.context_confidence_score || 0) * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs">
                        <p className="text-[11px] text-zinc-600 line-clamp-2 italic">"{memory.user_message}"</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-zinc-700">{memory.memory_date}</span>
                        <span className="text-[9px] text-zinc-400 uppercase font-black tracking-widest">{memory.memory_time}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-zinc-300 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100">
                         <Eye className="w-4 h-4" />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Memory Sidebar */}
        {viewingUser && (
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 animate-in slide-in-from-right duration-500">
             {/* User Profile Summary */}
             <div className="bg-white border border-zinc-100 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                   <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center border-4 border-white shadow-sm">
                      <User className="w-6 h-6 text-indigo-400" />
                   </div>
                   <div>
                      <h4 className="text-lg font-black text-zinc-900 tracking-tight">{selectedUser?.slice(0, 12)}...</h4>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Membro desde Mar/2024</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                   <div className="p-3 bg-zinc-50 rounded-2xl">
                      <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Interações</p>
                      <p className="text-xl font-black text-zinc-900">{memories.length}</p>
                   </div>
                   <div className="p-3 bg-zinc-50 rounded-2xl">
                      <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Aprendizados</p>
                      <p className="text-xl font-black text-zinc-900">{userLearnings.length}</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                     <Brain className="w-3.5 h-3.5 text-indigo-400" />
                     Aprendizado Consolidado
                   </h5>
                   <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {userLearnings.filter(l => l.learning_type === 'Adquirida').length === 0 ? (
                        <div className="py-8 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                           <Sparkles className="w-6 h-6 text-zinc-200 mx-auto mb-2" />
                           <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Nenhum aprendizado adquirido</p>
                        </div>
                      ) : userLearnings.filter(l => l.learning_type === 'Adquirida').map(learn => (
                        <div key={learn.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex flex-col gap-2 group">
                           <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 bg-white text-indigo-600 text-[8px] font-black rounded-md shadow-sm border border-zinc-50">{learn.classification}</span>
                              <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">{learn.learning_date}</span>
                           </div>
                           <p className="text-[11px] text-zinc-700 font-medium leading-relaxed">{learn.learning}</p>
                           <div className="flex items-center justify-between mt-1 pt-2 border-t border-zinc-100 opacity-0 group-hover:opacity-100 transition-all">
                              <div className="flex items-center gap-1">
                                 <Layers className="w-3 h-3 text-zinc-400" />
                                 <span className="text-[9px] font-bold text-zinc-500">{learn.theme}</span>
                              </div>
                              <button className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Ver Origem</button>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>

             {/* User Reasoning */}
             <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-100">
                <div className="flex items-center gap-3 mb-6">
                   <div className="p-2 bg-indigo-500/50 rounded-xl">
                      <Zap className="w-5 h-5 text-white" />
                   </div>
                   <h5 className="text-[10px] font-black uppercase tracking-widest">Raciocínios Ativos</h5>
                </div>
                
                <div className="space-y-4">
                   <div className="p-4 bg-indigo-500/30 rounded-2xl border border-indigo-400/30 backdrop-blur-sm">
                      <p className="text-[11px] font-medium leading-relaxed italic">
                        "O usuário prefere abordagens diretas e técnicas, evitando explicações teóricas longas sobre produto."
                      </p>
                      <div className="flex items-center justify-between mt-3">
                         <span className="text-[8px] font-black uppercase tracking-widest text-indigo-200">Behavioral</span>
                         <span className="px-2 py-0.5 bg-indigo-400/50 rounded-md text-[8px] font-black uppercase">92% Conf.</span>
                      </div>
                   </div>
                   <button className="w-full py-3 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all">
                      Gerar Novo Raciocínio
                   </button>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
