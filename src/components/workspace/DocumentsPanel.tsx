import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Document } from '../../types';
import { Plus, Loader2, FileUp, FileCheck, AlertCircle, Clock, MoreVertical, Trash2 } from 'lucide-react';
import { formatDate, cn } from '../../lib/utils';

export default function DocumentsPanel({ productId }: { productId: string }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, `products/${productId}/documents`), orderBy('created_at', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Document)));
      setLoading(false);
    });
    return unsub;
  }, [productId]);

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Leitura Inteligente</h2>
          <button className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95">
             <Plus className="w-5 h-5" /> Adicionar Doc
          </button>
       </div>

       <div className="bg-white border border-slate-200 rounded-[32px] p-8 mb-8 flex flex-col md:flex-row items-center gap-8 shadow-sm hover:border-indigo-100 transition-all">
          <div className="w-24 h-24 bg-slate-50 rounded-[28px] flex items-center justify-center border-4 border-dashed border-slate-100 shrink-0">
             <FileUp className="w-10 h-10 text-slate-200" />
          </div>
          <div className="flex-1">
             <h3 className="text-xl font-black text-slate-900 mb-2 leading-tight tracking-tight uppercase">Extraia inteligência dos seus documentos</h3>
             <p className="text-slate-500 text-sm leading-relaxed mb-5 font-medium italic">
                Suba notas de discovery, métricas ou pesquisas. Nossa IA extrai fatos, hipóteses e decisões automaticamente para alimentar sua jornada.
             </p>
             <div className="flex flex-wrap gap-2">
                {['PDF', 'TXT', 'Markdown', 'CSV'].map(ext => (
                  <span key={ext} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[9px] font-black text-slate-400 uppercase tracking-widest">{ext}</span>
                ))}
             </div>
          </div>
       </div>

       {loading ? (
          <div className="py-12 text-center">
             <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
          </div>
       ) : documents.length === 0 ? (
          <div className="py-12 text-center text-slate-400 italic font-medium">
             Nenhum documento processado ainda.
          </div>
       ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {documents.map(doc => (
                <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-400 transition-all flex items-center justify-between group shadow-sm">
                   <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm border border-slate-100">
                        <FileCheck className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                         <h4 className="font-black text-slate-900 truncate text-sm tracking-tight">{doc.title}</h4>
                         <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">Status: {doc.processing_status}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                      <button className="p-2 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
                         <MoreVertical className="w-4 h-4" />
                      </button>
                   </div>
                </div>
             ))}
          </div>
       )}
    </div>
  );
}
