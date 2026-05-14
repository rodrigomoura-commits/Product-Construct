import React, { useState, useEffect } from 'react';
import { 
  Users, User, Target, Brain, ArrowDownCircle, 
  ArrowUpCircle, Info, Settings2, ShieldCheck, 
  Search, Filter, ChevronRight, Activity, 
  MessageSquare, LayoutGrid, Clock, AlertTriangle,
  FileSearch, UserCheck, Zap, MoreVertical
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { MindflowBehavioralProfile, MindflowBehavioralSignal, AdminCtx } from '../../types';
import { cn, formatDate } from '../../lib/utils';

interface MindflowBehavioralSectionProps {
  ctx: AdminCtx;
}

export default function MindflowBehavioralSection({ ctx }: MindflowBehavioralSectionProps) {
  const [profiles, setProfiles] = useState<MindflowBehavioralProfile[]>([]);
  const [signals, setSignals] = useState<MindflowBehavioralSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'profiles' | 'signals' | 'contexts'>('profiles');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLoading(true);
    let unsubs: (() => void)[] = [];

    if (activeSubTab === 'profiles') {
      const q = query(collection(db, 'mindflow_behavioral_profiles'), orderBy('updated_at', 'desc'), limit(50));
      const unsub = onSnapshot(q, (snap) => {
        setProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowBehavioralProfile)));
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'mindflow_behavioral_profiles');
        setLoading(false);
      });
      unsubs.push(unsub);
    } else if (activeSubTab === 'signals') {
      const q = query(collection(db, 'mindflow_behavioral_signals'), orderBy('created_at', 'desc'), limit(100));
      const unsub = onSnapshot(q, (snap) => {
        setSignals(snap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowBehavioralSignal)));
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'mindflow_behavioral_signals');
        setLoading(false);
      });
      unsubs.push(unsub);
    } else {
      setLoading(false);
    }

    return () => unsubs.forEach(u => u());
  }, [activeSubTab]);

  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div className="bg-white border border-zinc-200 rounded-[3rem] p-12 flex flex-col md:flex-row items-center gap-10">
        <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center border border-indigo-100 shrink-0">
          <Activity className="w-12 h-12 text-indigo-500" />
        </div>
        <div className="flex-1">
          <h3 className="text-3xl font-black text-zinc-900 tracking-tight mb-2">Biometria Comportamental</h3>
          <p className="text-zinc-500 font-medium text-lg italic max-w-2xl leading-relaxed">
            Entenda padrões de interação, preferências e estilo de trabalho de cada usuário para adaptar a Tona sem perder consistência operativa.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-zinc-50 p-2 rounded-[2rem] border border-zinc-100">
           <button 
             onClick={() => setActiveSubTab('profiles')}
             className={cn(
               "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
               activeSubTab === 'profiles' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
             )}
           >Perfis</button>
           <button 
             onClick={() => setActiveSubTab('signals')}
             className={cn(
               "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
               activeSubTab === 'signals' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
             )}
           >Sinais</button>
           <button 
             onClick={() => setActiveSubTab('contexts')}
             className={cn(
               "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
               activeSubTab === 'contexts' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
             )}
           >Contextos</button>
        </div>
      </div>

      {/* PROFILES */}
      {activeSubTab === 'profiles' && (
        <div className="bg-white border border-zinc-100 rounded-[3rem] overflow-hidden shadow-sm">
           <table className="w-full text-left">
              <thead>
                 <tr className="bg-zinc-50/50">
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Usuário</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Profundidade</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Formato</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Confiança</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest text-right">Ações</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                 {profiles.map(profile => (
                   <tr key={profile.id} className="hover:bg-zinc-50/30 transition-all group">
                      <td className="px-8 py-8">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-500 font-bold uppercase">
                               {profile.user_id.substring(0, 2)}
                            </div>
                            <div>
                               <p className="text-sm font-bold text-zinc-800">{profile.user_identifier || profile.user_id}</p>
                               <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Atualizado: {formatDate(profile.updated_at)}</span>
                            </div>
                         </div>
                      </td>
                      <td className="px-8 py-8">
                         <span className={cn(
                           "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                           profile.preferred_depth === 'exhaustive' ? "bg-amber-50 text-amber-600 border-amber-100" :
                           profile.preferred_depth === 'detailed' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                           "bg-zinc-100 text-zinc-500 border-zinc-200"
                         )}>
                            {profile.preferred_depth}
                         </span>
                      </td>
                      <td className="px-8 py-8">
                         <div className="flex items-center gap-2">
                            <LayoutGrid className="w-3.5 h-3.5 text-zinc-300" />
                            <span className="text-xs font-bold text-zinc-700">{profile.preferred_format || 'Auto'}</span>
                         </div>
                      </td>
                      <td className="px-8 py-8">
                         <div className="flex items-center gap-3">
                            <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                               <div 
                                 className="h-full bg-emerald-500" 
                                 style={{ width: `${profile.confidence_score * 100}%` }} 
                               />
                            </div>
                            <span className="text-[10px] font-black text-zinc-400">{(profile.confidence_score * 100).toFixed(0)}%</span>
                         </div>
                      </td>
                      <td className="px-8 py-8 text-right">
                         <button className="w-9 h-9 border border-zinc-100 rounded-lg flex items-center justify-center text-zinc-400 hover:text-indigo-600 hover:border-indigo-100 transition-all">
                            <ChevronRight className="w-5 h-5" />
                         </button>
                      </td>
                   </tr>
                 ))}
                 {profiles.length === 0 && (
                   <tr>
                      <td colSpan={5} className="py-20 text-center text-zinc-300 font-medium italic">Nenhum perfil comportamental encontrado.</td>
                   </tr>
                 )}
              </tbody>
           </table>
        </div>
      )}

      {/* SIGNALS */}
      {activeSubTab === 'signals' && (
        <div className="bg-white border border-zinc-100 rounded-[3rem] overflow-hidden shadow-sm">
           <table className="w-full text-left">
              <thead>
                 <tr className="bg-zinc-50/50">
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Sinal</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Valor</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Usuário</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest text-right">Data</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                 {signals.map(signal => (
                   <tr key={signal.id} className="hover:bg-zinc-50/30 transition-all group">
                      <td className="px-8 py-8">
                         <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">{signal.signal_type.replace(/_/g, ' ')}</span>
                            <span className="text-[9px] font-medium text-zinc-400 line-clamp-1 italic">{signal.evidence || "Evidência implícita"}</span>
                         </div>
                      </td>
                      <td className="px-8 py-8">
                         <span className="px-3 py-1 bg-zinc-100 rounded-lg text-[9px] font-black uppercase tracking-tight text-zinc-600">
                            {signal.signal_value}
                         </span>
                      </td>
                      <td className="px-8 py-8">
                         <span className="text-xs font-bold text-zinc-500 underline decoration-zinc-100 underline-offset-4">{signal.user_id.substring(0, 8)}</span>
                      </td>
                      <td className="px-8 py-8 text-right">
                         <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{formatDate(signal.created_at)}</span>
                      </td>
                   </tr>
                 ))}
                 {signals.length === 0 && (
                   <tr>
                      <td colSpan={4} className="py-20 text-center text-zinc-300 font-medium italic">Nenhum sinal detectado.</td>
                   </tr>
                 )}
              </tbody>
           </table>
        </div>
      )}
    </div>
  );
}
