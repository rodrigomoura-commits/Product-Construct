import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Decision } from '../../types';
import { ListTodo, Loader2, Plus, CheckCircle2, MessageSquare, Clock } from 'lucide-react';
import { formatDate, cn } from '../../lib/utils';

export default function DecisionsList({ productId }: { productId: string }) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, `products/${productId}/decisions`), orderBy('created_at', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      setDecisions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Decision)));
      setLoading(false);
    });
    return unsub;
  }, [productId]);

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Registro de Decisões</h2>
          <button className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
             <Plus className="w-5 h-5" />
          </button>
       </div>

       {loading ? (
          <div className="py-24 text-center">
             <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
          </div>
       ) : decisions.length === 0 ? (
          <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-[32px] bg-white shadow-sm">
             <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <ListTodo className="w-8 h-8 text-slate-200" />
             </div>
             <h3 className="text-xl font-black text-slate-900 mb-1 tracking-tight">Nenhuma decisão registrada</h3>
             <p className="text-slate-400 max-w-xs mx-auto text-sm leading-relaxed italic">
                Documente decisões arquiteturais, de negócio ou de design para manter o histórico e o porquê das escolhas.
             </p>
          </div>
       ) : (
          <div className="space-y-4">
             {decisions.map(dec => (
                <div key={dec.id} className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm hover:border-indigo-400 transition-all flex gap-8 group">
                   <div className="w-16 h-16 bg-slate-50 rounded-[20px] flex items-center justify-center shrink-0 border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                      <ListTodo className="w-7 h-7" />
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                         <h3 className="font-black text-xl text-slate-900 tracking-tight">{dec.title}</h3>
                         <span className={cn(
                           "px-2 py-0.5 rounded-full text-[9px] font-black uppercase border tracking-widest",
                           dec.status === 'approved' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-500 border-slate-200"
                         )}>
                            {dec.status}
                         </span>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed mb-5 font-medium italic">"{dec.description}"</p>
                      
                      <div className="flex flex-wrap gap-6 items-center">
                         <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                            <Clock className="w-3.5 h-3.5 text-slate-300" /> {formatDate(dec.created_at)}
                         </div>
                         <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-300" /> ID: {dec.author_id.slice(0, 5)}...
                         </div>
                      </div>
                   </div>
                </div>
             ))}
          </div>
       )}
    </div>
  );
}
