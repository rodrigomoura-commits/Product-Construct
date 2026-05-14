import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ScheduledAction, AdminCtx } from '../../types';
import { 
  Clock, Calendar, Plus, Trash2, 
  CheckCircle2, XCircle, Loader2, AlertCircle, 
  Timer, CalendarDays, Archive, RefreshCcw
} from 'lucide-react';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function ScheduleAdminSection({ ctx }: { ctx: AdminCtx }) {
  const [actions, setActions] = useState<ScheduledAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newType, setNewType] = useState<ScheduledAction['type']>('artifact_generation');
  const [newTime, setNewTime] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'scheduled_actions'), orderBy('schedule_time', 'asc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduledAction));
      setActions(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function handleCreate() {
    if (!newTime) return;
    try {
      await addDoc(collection(db, 'scheduled_actions'), {
        type: newType,
        status: 'scheduled',
        schedule_time: new Date(newTime),
        product_id: 'global',
        created_by: ctx.userId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        payload: { reason: "Manual admin schedule" }
      });
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCancel(id: string) {
    try {
      await updateDoc(doc(db, 'scheduled_actions', id), { status: 'cancelled', updated_at: serverTimestamp() });
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">AI Scheduler</h2>
          <p className="text-zinc-500 mt-1 font-medium italic">Agende ações autônomas, lembretes e sincronizações de memória.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-zinc-900 text-white px-5 py-2.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" /> Novo Agendamento
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center">
               <Timer className="w-6 h-6 text-zinc-900" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest leading-none mb-1">Próxima Ação</p>
               <p className="font-black text-xl text-zinc-900">{actions.filter(a => a.status === 'scheduled').length > 0 ? 'Em 2h' : 'Nenhuma'}</p>
            </div>
         </div>
         <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
               <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest leading-none mb-1">Concluídas (24h)</p>
               <p className="font-black text-xl text-zinc-900">{actions.filter(a => a.status === 'completed').length}</p>
            </div>
         </div>
         <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
               <RefreshCcw className="w-6 h-6 text-amber-600" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest leading-none mb-1">Recorrência Ativa</p>
               <p className="font-black text-xl text-zinc-900">4 Patterns</p>
            </div>
         </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm">
         <table className="w-full text-left border-collapse">
            <thead>
               <tr className="border-b border-zinc-100 bg-zinc-50/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Ação / Tipo</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Scheduled Time</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Ações</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
               {loading ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center">
                       <Loader2 className="w-8 h-8 animate-spin mx-auto text-zinc-200" />
                    </td>
                  </tr>
               ) : actions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center">
                       <p className="text-zinc-500 font-medium italic">Nenhuma ação agendada encontrada.</p>
                    </td>
                  </tr>
               ) : actions.map(action => (
                  <tr key={action.id} className="hover:bg-zinc-50/50 transition-colors group">
                     <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                           <div className={cn(
                             "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                             action.status === 'scheduled' ? "bg-zinc-100 text-zinc-900" : "bg-slate-50 text-slate-400"
                           )}>
                              <CalendarDays className="w-5 h-5" />
                           </div>
                           <div>
                              <p className="font-bold text-zinc-900">{action.type.replace('_', ' ')}</p>
                              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{action.product_id}</p>
                           </div>
                        </div>
                     </td>
                     <td className="px-8 py-6">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[9px] font-black uppercase border",
                          action.status === 'scheduled' ? "bg-amber-50 text-amber-700 border-amber-100" :
                          action.status === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          "bg-zinc-100 text-zinc-500 border-zinc-200"
                        )}>
                           {action.status}
                        </span>
                     </td>
                     <td className="px-8 py-6">
                        <p className="font-bold text-zinc-900 text-sm">{formatDate(action.schedule_time)}</p>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Execução estimada</p>
                     </td>
                     <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                           {action.status === 'scheduled' && (
                             <button 
                               onClick={() => handleCancel(action.id)}
                               className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                             >
                                <XCircle className="w-5 h-5" />
                             </button>
                           )}
                           <button className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors">
                              <Archive className="w-5 h-5" />
                           </button>
                        </div>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>

      {/* Modal Novo Agendamento */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl relative w-full max-w-lg p-8 overflow-hidden"
            >
              <h2 className="text-2xl font-bold tracking-tight mb-6">Nova Ação Agendada</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black uppercase text-zinc-400 tracking-widest mb-2 text-left">Tipo de Ação</label>
                  <select 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none"
                    value={newType}
                    onChange={e => setNewType(e.target.value as any)}
                  >
                    <option value="artifact_generation">Gerar Artefato</option>
                    <option value="memory_sync">Sincronizar Memória</option>
                    <option value="maturity_check">Verificar Maturidade</option>
                    <option value="user_nudge">Enviar Notificação/Nudge</option>
                    <option value="market_research">Pesquisa de Mercado IA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-zinc-400 tracking-widest mb-2 text-left">Data/Hora Estimada</label>
                  <input 
                    type="datetime-local"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                  />
                </div>
                <div className="flex gap-4">
                   <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-zinc-100 rounded-xl font-bold transition-all hover:bg-zinc-200">Cancelar</button>
                   <button onClick={handleCreate} className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-bold transition-all hover:bg-zinc-800">Agendar Ação</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
