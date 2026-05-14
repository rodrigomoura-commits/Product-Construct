import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Artifact } from '../../types';
import { FileText, Loader2, Plus, ArrowUpRight, Clock, Search, Download } from 'lucide-react';
import { formatDate, cn } from '../../lib/utils';
import { exportArtifactToDocx } from '../../lib/exportArtifactToDocx';
import { useAuth } from '../../contexts/AuthContext';

interface ArtifactsListProps {
  productId: string;
  onOpenArtifact: (artifact: Artifact) => void;
  onNewArtifact: () => void;
}

export default function ArtifactsList({ productId, onOpenArtifact, onNewArtifact }: ArtifactsListProps) {
  const { user } = useAuth();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [exportingId, setExportingId] = useState<string | null>(null);

  const FILTERS = [
    { id: 'all', label: 'Todos' },
    { id: 'understand_problem', label: 'Entender o Problema' },
    { id: 'define_proposal', label: 'Definir a Proposta' },
    { id: 'visualize_solution', label: 'Visualizar a Solução' },
    { id: 'plan_mvp', label: 'Planejar o MVP' },
    { id: 'prepare_delivery', label: 'Preparar a Entrega' },
    { id: 'monitor_learn', label: 'Acompanhar e Aprender' }
  ];

  useEffect(() => {
    // Top-level collection as per user request
    const q = query(
      collection(db, `products/${productId}/artifacts`), 
      orderBy('updated_at', 'desc'), 
      limit(50)
    );
    
    const unsub = onSnapshot(q, (snap) => {
      setArtifacts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Artifact)));
      setLoading(false);
    }, (error) => {
      console.error("[ArtifactsList] Error fetching artifacts:", error);
      setLoading(false);
    });
    return unsub;
  }, [productId]);

  const filteredArtifacts = artifacts.filter(art => {
    const term = searchTerm.toLowerCase();
    const title = (art.title || '').toLowerCase();
    const type = (art.type || '').toLowerCase();
    const stageName = (art.stage_name || art.stage_id || '').toLowerCase();

    const matchesSearch = title.includes(term) ||
      type.includes(term) ||
      stageName.includes(term);
    
    const matchesFilter = activeFilter === 'all' || art.stage_id === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  const handleExportDocx = async (e: React.MouseEvent, artifact: Artifact) => {
    e.stopPropagation();
    if (!user) return;
    setExportingId(artifact.id);
    try {
      await exportArtifactToDocx(artifact, {}, { uid: user.uid, email: user.email || '' });
    } catch (error) {
       console.error(error);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Biblioteca de Artefatos</h2>
            <p className="text-slate-400 text-sm font-medium italic mt-1">Todos os documentos estratégicos e entregas do produto.</p>
          </div>
          <button 
            onClick={onNewArtifact}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 text-xs font-black uppercase tracking-widest"
          >
             <Plus className="w-4 h-4" /> Novo Artefato
          </button>
       </div>

       {/* Search and Filters */}
       {!loading && artifacts.length > 0 && (
          <div className="space-y-4">
            <div className="relative group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
               <input 
                 type="text"
                 placeholder="Pesquisar por título, tipo ou etapa..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none shadow-sm"
               />
            </div>

            <div className="flex flex-wrap gap-2">
               {FILTERS.map(f => (
                 <button
                   key={f.id}
                   onClick={() => setActiveFilter(f.id)}
                   className={cn(
                     "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                     activeFilter === f.id
                       ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100"
                       : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                   )}
                 >
                   {f.label}
                 </button>
               ))}
            </div>
          </div>
       )}

       {loading ? (
          <div className="py-24 text-center">
             <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
          </div>
       ) : artifacts.length === 0 ? (
          <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-[40px] bg-white shadow-sm">
             <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <FileText className="w-8 h-8 text-slate-200" />
             </div>
             <h3 className="text-xl font-black text-slate-900 mb-1 tracking-tight">Nenhum artefato gerado</h3>
             <p className="text-slate-400 max-w-xs mx-auto text-sm leading-relaxed italic px-6">
                Briefings, Concept Docs e Épicos aparecerão aqui após serem gerados pela IA ou criados manualmente.
             </p>
             <button 
               onClick={onNewArtifact}
               className="mt-6 px-6 py-3 bg-slate-100 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200"
             >
                Criar Primeiro Artefato
             </button>
          </div>
       ) : filteredArtifacts.length === 0 ? (
          <div className="py-20 text-center">
             <p className="text-slate-400 italic text-sm">Nenhum artefato corresponde à sua pesquisa.</p>
          </div>
       ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {filteredArtifacts.map(art => (
               <div 
                 key={art.id} 
                 onClick={() => onOpenArtifact(art)}
                 className="bg-white border border-slate-200 rounded-[32px] p-6 flex items-center justify-between hover:border-indigo-400 transition-all group shadow-sm hover:shadow-xl cursor-pointer"
               >
                  <div className="flex items-center gap-5 min-w-0">
                     <div className={cn(
                       "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-sm border",
                       art.status === 'final' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-300 border-slate-100 group-hover:bg-indigo-600 group-hover:text-white"
                     )}>
                        <FileText className="w-6 h-6" />
                     </div>
                     <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                           <h3 className="font-black text-slate-900 truncate tracking-tight text-sm md:text-base group-hover:text-indigo-600 transition-colors uppercase">{art.title}</h3>
                           <span className="shrink-0 px-1.5 py-0.5 bg-slate-100 text-[8px] font-black uppercase rounded border border-slate-200 text-slate-400">{art.version}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                           <span className="flex items-center gap-1.5 text-indigo-500 shrink-0 uppercase tracking-tight">{art.stage_name || art.stage_id}</span>
                           <span className="w-1 h-1 bg-slate-200 rounded-full" />
                           {art.priority === 'critical' && (
                             <>
                               <span className="text-rose-500 shrink-0">Crítico</span>
                               <span className="w-1 h-1 bg-slate-200 rounded-full" />
                             </>
                           )}
                           <span className="flex items-center gap-1.5 shrink-0"><Clock className="w-3 h-3 text-slate-300" /> {formatDate(art.updated_at || art.created_at)}</span>
                           <span className={cn(
                             "flex items-center gap-1.5 px-1.5 py-0.5 rounded uppercase text-[8px]",
                             art.status === 'final' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                           )}>
                             {art.status}
                           </span>
                        </div>
                     </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                      <button 
                        onClick={(e) => handleExportDocx(e, art)}
                        disabled={exportingId === art.id}
                        className="p-3 bg-slate-50 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100 hidden sm:flex items-center gap-2"
                        title="Exportar para DOCX"
                      >
                         {exportingId === art.id ? <Loader2 className="w-4 h-4 animate-spin font-black uppercase tracking-widest text-[8px]" /> : <Download className="w-5 h-5 font-black uppercase tracking-widest text-[8px]" />}
                         <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">DOCX</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onOpenArtifact(art); }}
                        className="p-3 bg-slate-50 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100"
                      >
                         <ArrowUpRight className="w-5 h-5" />
                      </button>
                   </div>
               </div>
             ))}
          </div>
       )}
    </div>
  );
}
