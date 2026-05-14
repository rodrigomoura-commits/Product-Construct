import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product, ProductStage } from '../../types';
import { Boxes, Loader2, ArrowUpRight, BarChart, Tag, Calendar } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { calculateProductMaturity } from '../../lib/maturity';

export default function ProductsAdminSection() {
  const [products, setProducts] = useState<(Product & { calculatedProgress?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      try {
        const q = query(collection(db, 'products'), orderBy('created_at', 'desc'), limit(20));
        const snap = await getDocs(q);
        const productsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
        
        const productsWithProgress = await Promise.all(productsData.map(async (p) => {
          try {
            const stagesSnap = await getDocs(collection(db, `products/${p.id}/stages`));
            const stages = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductStage));
            const calculatedProgress = calculateProductMaturity(stages);
            return { ...p, calculatedProgress };
          } catch (e) {
            console.error(`Error loading stages for product ${p.id}:`, e);
            return { ...p, calculatedProgress: p.progress || 0 };
          }
        }));

        setProducts(productsWithProgress);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Catálogo de Produtos</h2>
          <p className="text-zinc-500 mt-1 font-medium italic">Visão administrativa de todos os workspaces criados na plataforma.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="p-12 text-center text-zinc-300">
             <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
             <span className="font-bold uppercase text-[10px] tracking-widest">Listando workspaces...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-zinc-200 rounded-3xl text-zinc-400 italic">
            Nenhum produto cadastrado ainda.
          </div>
        ) : products.map((p) => (
          <div key={p.id} className="bg-white border border-zinc-200 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-zinc-900 transition-all shadow-sm">
             <div className="flex items-center gap-5 flex-1 min-w-0">
                <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center shrink-0">
                  <Boxes className="w-7 h-7 text-zinc-900" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-xl text-zinc-900 truncate">{p.name}</h3>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase border",
                      p.status === 'active' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-zinc-100 text-zinc-500 border-zinc-200"
                    )}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold text-zinc-400 uppercase tracking-tight">
                    <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {p.product_type || 'Não definido'}</span>
                    <span className="flex items-center gap-1"><BarChart className="w-3 h-3" /> Stage: {p.current_stage}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(p.created_at)}</span>
                  </div>
                </div>
             </div>

             <div className="flex items-center gap-8 px-6 border-x border-zinc-100 shrink-0">
                <div className="text-center">
                   <p className="text-[10px] font-black uppercase text-zinc-400 mb-1 tracking-widest">Progresso</p>
                   <p className="text-2xl font-black text-zinc-900 tracking-tighter">{p.calculatedProgress ?? p.progress}%</p>
                </div>
                <div className="text-center">
                   <p className="text-[10px] font-black uppercase text-zinc-400 mb-1 tracking-widest">Quality</p>
                   <p className="text-2xl font-black text-zinc-900 tracking-tighter">{p.quality_score}%</p>
                </div>
             </div>

             <div className="shrink-0 flex items-center gap-3">
                <button 
                  onClick={() => navigate(`/products/${p.id}`)}
                  className="p-3 bg-zinc-50 text-zinc-900 rounded-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm"
                  title="Abrir Workspace"
                >
                  <ArrowUpRight className="w-5 h-5" />
                </button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
