import React, { useState, useEffect } from 'react';
import { 
  ScanEye, Search, Filter, History, 
  ChevronRight, ArrowRight, Zap, Target, 
  Brain, User, Clock, AlertTriangle, 
  CheckCircle2, Info, MessageSquare, 
  FileSearch, Eye, Database, Code, ShieldCheck
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { MindflowCognitiveTrace, MindflowCognitiveTraceEvent, AdminCtx } from '../../types';
import { cn, formatDate } from '../../lib/utils';

interface MindflowTraceSectionProps {
  ctx: AdminCtx;
}

export default function MindflowTraceSection({ ctx }: MindflowTraceSectionProps) {
  const [traces, setTraces] = useState<MindflowCognitiveTrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [events, setEvents] = useState<MindflowCognitiveTraceEvent[]>([]);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'mindflow_cognitive_traces'), orderBy('created_at', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      setTraces(snap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowCognitiveTrace)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'mindflow_cognitive_traces');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-zinc-900 rounded-[3rem] p-12 flex flex-col md:flex-row items-center gap-10 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full -mr-48 -mt-48" />
        <div className="w-24 h-24 bg-zinc-800 rounded-[2rem] flex items-center justify-center border border-zinc-700 shrink-0 relative z-10">
          <ScanEye className="w-12 h-12 text-indigo-400" />
        </div>
        <div className="flex-1 relative z-10">
          <h3 className="text-3xl font-black tracking-tight mb-2 uppercase">Trilha Censorial</h3>
          <p className="text-zinc-400 font-medium text-lg italic max-w-2xl leading-relaxed">
            Observabilidade cognitiva de ponta a ponta. Saiba exatamente quais sinais a Tona percebeu e como ela construiu cada resposta.
          </p>
        </div>
        <div className="bg-zinc-800/50 backdrop-blur-md p-6 rounded-[2rem] border border-zinc-700/50 shrink-0 relative z-10">
           <div className="flex items-center gap-4">
              <div className="text-center">
                 <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-1">Média de Passos</p>
                 <p className="text-2xl font-black">12.4</p>
              </div>
              <div className="w-px h-10 bg-zinc-700" />
              <div className="text-center">
                 <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-1">Confiança Média</p>
                 <p className="text-2xl font-black text-emerald-400">92%</p>
              </div>
           </div>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white border border-zinc-100 rounded-[3rem] overflow-hidden shadow-sm">
         <table className="w-full text-left">
            <thead>
               <tr className="bg-zinc-50/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Data / Hora</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Usuário</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Estratégia</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Impacto</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest text-right">Auditar</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
               {traces.map(trace => (
                 <tr key={trace.id} className="hover:bg-zinc-50/30 transition-all group">
                    <td className="px-8 py-8">
                       <span className="text-[11px] font-black text-zinc-900 border-b-2 border-indigo-100">{formatDate(trace.created_at)}</span>
                    </td>
                    <td className="px-8 py-8">
                       <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-zinc-300" />
                          <span className="text-xs font-bold text-zinc-600 truncate max-w-[120px]">{trace.user_id}</span>
                       </div>
                    </td>
                    <td className="px-8 py-8">
                       <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate max-w-[200px]">
                          {trace.response_strategy || "Padrão Tona Core"}
                       </span>
                    </td>
                    <td className="px-8 py-8">
                       <div className="flex items-center gap-6">
                          <div className="flex items-center gap-1.5" title="Aprendizagens">
                             <Zap className="w-3.5 h-3.5 text-amber-500" />
                             <span className="text-xs font-black">{trace.used_learning_ids.length}</span>
                          </div>
                          <div className="flex items-center gap-1.5" title="Raciocínios">
                             <Brain className="w-3.5 h-3.5 text-indigo-500" />
                             <span className="text-xs font-black">{trace.used_reasoning_ids.length}</span>
                          </div>
                       </div>
                    </td>
                    <td className="px-8 py-8 text-right">
                       <button 
                         className="px-5 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-all shadow-sm"
                       >Auditar Trilha</button>
                    </td>
                 </tr>
               ))}
               {traces.length === 0 && (
                 <tr>
                    <td colSpan={5} className="py-20 text-center text-zinc-300 font-medium italic">Nenhuma trilha cognitiva registrada.</td>
                 </tr>
               )}
            </tbody>
         </table>
      </div>
    </div>
  );
}
