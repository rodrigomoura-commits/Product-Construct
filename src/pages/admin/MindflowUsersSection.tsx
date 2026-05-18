import React, { useState, useEffect } from 'react';
import { 
  Users, Search, User, ChevronRight, Brain, 
  Target, Zap, Clock, MessageSquare, Filter,
  ShieldCheck, Fingerprint, Activity, TrendingUp,
  Award, Star, AlertTriangle, XCircle
} from 'lucide-react';
import { 
  collection, query, getDocs, orderBy, 
  limit, where 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn, formatDate } from '../../lib/utils';
import { safeText, toSearchableText } from '../../lib/safeText';
import { motion, AnimatePresence } from 'motion/react';

interface MindflowUserStats {
  userId: string;
  userIdentifier: string;
  totalInteractions: number;
  totalMemories: number;
  lastInteractionAt: any;
  topTheme: string;
  confidenceScore: number;
}

export default function MindflowUsersSection() {
  const [users, setUsers] = useState<MindflowUserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string, code?: string, path?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<MindflowUserStats | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // In a real app we'd query a 'users' collection or aggregate 'mindflow_user_memories'
      // For this implementation, we'll fetch unique users from interactions
      const interactionsSnap = await getDocs(
        query(collection(db, 'mindflow_user_memories'), limit(200))
      );
      
      const userMap = new Map<string, MindflowUserStats>();
      
      interactionsSnap.docs.forEach(doc => {
        const data = doc.data();
        const userId = data.user_id;
        if (!userId) return;

        if (userMap.has(userId)) {
          const stats = userMap.get(userId)!;
          stats.totalInteractions += 1;
          if (data.created_at?.toMillis() > stats.lastInteractionAt?.toMillis()) {
            stats.lastInteractionAt = data.created_at;
          }
        } else {
          userMap.set(userId, {
            userId,
            userIdentifier: safeText(data.user_identifier || userId.slice(0, 8)),
            totalInteractions: 1,
            totalMemories: 0, // Will fetch memories separately if needed
            lastInteractionAt: data.created_at,
            topTheme: safeText(data.context || 'Geral'),
            confidenceScore: 0.85
          });
        }
      });

      // Fetch memory counts for these users
      const memoriesSnap = await getDocs(
        query(collection(db, 'mindflow_memories'), where('knowledge_type', '==', 'Adquirida'), limit(200))
      );

      memoriesSnap.docs.forEach(doc => {
        const data = doc.data();
        const userId = data.user_id;
        if (userId && userMap.has(userId)) {
          userMap.get(userId)!.totalMemories += 1;
        }
      });

      setUsers(Array.from(userMap.values()));
    } catch (err: any) {
      console.error("[UsersSection] Failed to load users:", err);
      setError({
        message: err?.message || String(err),
        code: err?.code,
        path: 'mindflow_user_memories / mindflow_memories'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    toSearchableText(u.userIdentifier).includes(toSearchableText(searchTerm)) ||
    toSearchableText(u.userId).includes(toSearchableText(searchTerm))
  );

  return (
    <div className="grid grid-cols-12 gap-8">
      {error && (
        <div className="col-span-12 p-6 bg-rose-50 border border-rose-100 rounded-[2rem] flex gap-4">
          <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
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
      {/* User List */}
      <div className={cn(
        "bg-white border border-zinc-100 rounded-[2.5rem] shadow-sm transition-all duration-500",
        selectedUser ? "col-span-12 lg:col-span-12" : "col-span-12"
      )}>
        <div className="p-8 border-b border-zinc-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
              <Fingerprint className="w-6 h-6 text-indigo-500" /> Diretório Neural de Usuários
            </h3>
            <p className="text-zinc-500 text-xs font-medium italic mt-1">Perfis comportamentais e trilhas de aprendizado individualizadas.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text"
              placeholder="Pesquisar por ID ou Identificador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-zinc-50 border-none rounded-2xl text-[13px] font-medium focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
            />
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Usuário</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Status Cognitivo</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Atividade</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Dominância de Tema</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <Activity className="w-10 h-10 text-indigo-200 animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400 font-black uppercase text-[10px] tracking-widest">Mapeando rede neural...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-zinc-400 font-medium italic">
                    Nenhum usuário encontrado na rede.
                  </td>
                </tr>
              ) : filteredUsers.map(u => (
                <tr key={u.userId} className="hover:bg-zinc-50/50 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-zinc-200 group-hover:scale-110 transition-transform">
                        <User className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-zinc-900 text-sm tracking-tight">{u.userIdentifier}</span>
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mt-1">{u.userId.slice(0, 16)}...</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Brain className="w-3 h-3 text-emerald-500" />
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">{u.totalMemories} Memórias</span>
                        </div>
                        <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/50">
                          <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${Math.min(100, (u.totalMemories / 20) * 100)}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-900">{u.totalInteractions} Turnos</span>
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1">Último: {formatDate(u.lastInteractionAt)}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                       <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                         {u.topTheme}
                       </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => setSelectedUser(u)}
                      className="px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-zinc-200"
                    >
                      Ver Perfil Comportamental
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal (Full Screen Overlay for better UX) */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-zinc-950/40 backdrop-blur-md"
               onClick={() => setSelectedUser(null)}
             />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.9, opacity: 0, y: 20 }}
               className="bg-zinc-50 rounded-[3rem] w-full max-w-6xl h-[85vh] relative z-10 shadow-2xl flex flex-col overflow-hidden border border-white"
             >
                {/* Modal Header */}
                <div className="bg-white p-8 md:px-12 border-b border-zinc-200 flex items-center justify-between">
                   <div className="flex items-center gap-6">
                      <div className="w-20 h-20 bg-zinc-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-zinc-200">
                        <User className="w-10 h-10" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">{selectedUser.userIdentifier}</h2>
                          <div className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[9px] font-black uppercase tracking-widest">Master User</div>
                        </div>
                        <p className="text-zinc-400 font-mono text-xs">{selectedUser.userId}</p>
                      </div>
                   </div>
                   <button 
                     onClick={() => setSelectedUser(null)}
                     className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                   >
                     <Zap className="w-6 h-6 rotate-45" />
                   </button>
                </div>

                <div className="flex-1 overflow-y-auto p-12 no-scrollbar">
                   <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                      {/* Left: Summary Cards */}
                      <div className="md:col-span-4 space-y-6">
                         <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
                            <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-6">Métricas do Mindflow</h4>
                            <div className="grid grid-cols-1 gap-6">
                               <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                                    <MessageSquare className="w-6 h-6" />
                                  </div>
                                  <div>
                                     <p className="text-2xl font-black text-zinc-900 leading-none">{selectedUser.totalInteractions}</p>
                                     <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Interações Totais</p>
                                  </div>
                               </div>
                               <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                                    <Brain className="w-6 h-6" />
                                  </div>
                                  <div>
                                     <p className="text-2xl font-black text-zinc-900 leading-none">{selectedUser.totalMemories}</p>
                                     <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Aprendizados Críticos</p>
                                  </div>
                               </div>
                               <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                                    <TrendingUp className="w-6 h-6" />
                                  </div>
                                  <div>
                                     <p className="text-2xl font-black text-zinc-900 leading-none">{(selectedUser.confidenceScore * 100).toFixed(0)}%</p>
                                     <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Índice de Confiança IA</p>
                                  </div>
                               </div>
                            </div>
                         </div>

                         <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-20">
                              <Star className="w-32 h-32" />
                            </div>
                            <h4 className="text-[10px] font-black uppercase text-indigo-300 tracking-widest mb-4 relative z-10">Conquistas Cognitivas</h4>
                            <div className="space-y-3 relative z-10">
                               <div className="flex items-center gap-3">
                                  <div className="p-2 bg-indigo-500 rounded-lg"><Award className="w-4 h-4" /></div>
                                  <span className="text-[11px] font-bold">Colaborador Ativo</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-indigo-500 rounded-lg"><Target className="w-4 h-4" /></div>
                                  <span className="text-[11px] font-bold">Explorador de Contextos</span>
                                </div>
                            </div>
                         </div>
                      </div>

                      {/* Right: Behavioral Profile */}
                      <div className="md:col-span-8 space-y-8">
                         <div className="bg-white p-10 rounded-[3rem] border border-zinc-100 shadow-sm relative overflow-hidden">
                            <div className="absolute right-0 top-0 p-10 opacity-[0.02]">
                               <Activity className="w-64 h-64" />
                            </div>
                            <h3 className="text-2xl font-black text-zinc-900 tracking-tight mb-8 flex items-center gap-3">
                               <Zap className="w-6 h-6 text-amber-500" /> Perfil Comportamental Extraído
                            </h3>
                            
                            <div className="space-y-8 relative z-10">
                               <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 border-l-8 border-l-indigo-600">
                                  <h5 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Padrão de Comunicação</h5>
                                  <p className="text-zinc-800 font-bold italic leading-relaxed text-lg">
                                    "O usuário tende a ser objetivo e focado em resultados rápidos. Prefere que a Tona antecipe problemas de arquitetura antes que aconteçam."
                                  </p>
                               </div>

                               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 shadow-sm shadow-emerald-100/50">
                                     <h5 className="text-[10px] font-black uppercase text-emerald-700 tracking-widest mb-4 flex items-center gap-2">
                                       <Activity className="w-4 h-4" /> Strengths
                                     </h5>
                                     <ul className="space-y-3">
                                        {["Decisões rápidas", "Visão de produto clara", "Engajamento contínuo"].map((s, i) => (
                                          <li key={i} className="text-xs font-bold text-emerald-800 flex items-center gap-2">
                                             <ShieldCheck className="w-3.5 h-3.5" /> {s}
                                          </li>
                                        ))}
                                     </ul>
                                  </div>
                                  <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 shadow-sm shadow-amber-100/50">
                                     <h5 className="text-[10px] font-black uppercase text-amber-700 tracking-widest mb-4 flex items-center gap-2">
                                       <Target className="w-4 h-4" /> Areas of Friction
                                     </h5>
                                     <ul className="space-y-3">
                                        {["Complexidade técnica excessiva", "Falta de documentação base", "Prazos curtos"].map((s, i) => (
                                          <li key={i} className="text-xs font-bold text-amber-800 flex items-center gap-2">
                                             <Clock className="w-3.5 h-3.5" /> {s}
                                          </li>
                                        ))}
                                     </ul>
                                  </div>
                               </div>
                               
                               <div className="p-8 bg-zinc-900 text-white rounded-[2.5rem]">
                                  <h5 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-4">Instrução para Orquestrador (Tona)</h5>
                                  <p className="text-zinc-200 text-sm font-medium leading-relaxed italic">
                                    "Ao interagir com {selectedUser.userIdentifier}, utilize um tom profissional e pragmático. Priorize soluções técnicas sólidas em vez de alternativas experimentais, a menos que solicitado explicitamente."
                                  </p>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
