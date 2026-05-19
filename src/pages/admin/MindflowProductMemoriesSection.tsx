import React, { useState, useEffect } from 'react';
import { 
  Briefcase, Search, Layout, ChevronRight, Brain, 
  Target, Zap, Clock, MessageSquare, Filter,
  ShieldCheck, Database, Activity, TrendingUp,
  Box, Star, AlertTriangle, XCircle, Eye
} from 'lucide-react';
import { 
  collection, query, getDocs, orderBy, 
  limit, where, doc, getDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn, formatDate } from '../../lib/utils';
import { safeText, toSearchableText } from '../../lib/safeText';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Memory } from '../../types';

interface ProductStats {
  id: string;
  name: string;
  totalMemories: number;
  lastUpdateAt: any;
  status: string;
  evolutionScore: number;
}

export default function MindflowProductMemoriesSection() {
  const [products, setProducts] = useState<ProductStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string, code?: string, path?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductStats | null>(null);
  const [productMemories, setProductMemories] = useState<Memory[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const productsSnap = await getDocs(
        query(collection(db, 'products'), limit(100))
      );
      
      const productList: ProductStats[] = [];
      
      for (const productDoc of productsSnap.docs) {
        const productData = productDoc.data() as Product;
        
        // Check for memories in mindflow_product_memories sub-collection
        const memoriesSnap = await getDocs(
          collection(db, 'mindflow_product_memories', productDoc.id, 'memories')
        );

        if (memoriesSnap.size > 0) {
          productList.push({
            id: productDoc.id,
            name: safeText(productData.name || 'Produto Sem Nome'),
            totalMemories: memoriesSnap.size,
            lastUpdateAt: productData.updated_at,
            status: productData.status,
            evolutionScore: productData.evolution_score || 0
          });
        }
      }

      setProducts(productList.sort((a, b) => b.totalMemories - a.totalMemories));
    } catch (err: any) {
      console.error("[ProductMemoriesSection] Failed to load products:", err);
      setError({
        message: err?.message || String(err),
        code: err?.code,
        path: 'products / mindflow_product_memories'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProductMemories = async (productId: string) => {
    setLoadingMemories(true);
    try {
      const memoriesSnap = await getDocs(
        query(
          collection(db, 'mindflow_product_memories', productId, 'memories'),
          orderBy('created_at', 'desc')
        )
      );
      setProductMemories(memoriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Memory)));
    } catch (err: any) {
      console.error("[ProductMemoriesSection] Failed to load memories:", err);
    } finally {
      setLoadingMemories(false);
    }
  };

  const handleSelectProduct = (product: ProductStats) => {
    setSelectedProduct(product);
    fetchProductMemories(product.id);
  };

  const filteredProducts = products.filter(p => 
    toSearchableText(p.name).includes(toSearchableText(searchTerm)) ||
    toSearchableText(p.id).includes(toSearchableText(searchTerm))
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
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-rose-300 hover:text-rose-500">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Product List */}
      <div className={cn(
        "bg-white border border-zinc-100 rounded-[2.5rem] shadow-sm transition-all duration-500",
        selectedProduct ? "col-span-12 lg:col-span-12" : "col-span-12"
      )}>
        <div className="p-8 border-b border-zinc-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
              <Box className="w-6 h-6 text-indigo-500" /> Memória Estrutural de Produtos
            </h3>
            <p className="text-zinc-500 text-xs font-medium italic mt-1">Conhecimento acumulado e decisões críticas consolidadas em nível de produto.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text"
              placeholder="Pesquisar por nome de produto..."
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
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Produto</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Densidade Cognitiva</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Evolução</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <Activity className="w-10 h-10 text-indigo-200 animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400 font-black uppercase text-[10px] tracking-widest">Acessando memórias de produto...</p>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-zinc-400 font-medium italic">
                    Nenhum produto com memória registrada.
                  </td>
                </tr>
              ) : filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-zinc-50/50 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-zinc-200 group-hover:scale-110 transition-transform">
                        <Briefcase className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-zinc-900 text-sm tracking-tight">{p.name}</span>
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mt-1">{p.id.slice(0, 16)}...</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      p.status === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-zinc-50 text-zinc-400 border-zinc-100"
                    )}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Brain className="w-3 h-3 text-indigo-500" />
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">{p.totalMemories} Memórias</span>
                      </div>
                      <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/50">
                        <div 
                          className="h-full bg-indigo-500 rounded-full" 
                          style={{ width: `${Math.min(100, (p.totalMemories / 20) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        <span className="text-xs font-bold text-zinc-900">{p.evolutionScore}%</span>
                      </div>
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none">Maturidade IA</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => handleSelectProduct(p)}
                      className="px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-zinc-200"
                    >
                      Explorar Memória
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Memory Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-zinc-950/40 backdrop-blur-md"
               onClick={() => setSelectedProduct(null)}
             />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.9, opacity: 0, y: 20 }}
               className="bg-zinc-50 rounded-[3rem] w-full max-w-6xl h-[85vh] relative z-10 shadow-2xl flex flex-col overflow-hidden border border-white"
             >
                {/* Modal Header */}
                <div className="bg-white p-8 md:px-12 border-b border-zinc-200 flex items-center justify-between shadow-sm">
                   <div className="flex items-center gap-6">
                      <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-200">
                        <Briefcase className="w-10 h-10" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">{selectedProduct.name}</h2>
                          <div className="px-3 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full text-[9px] font-black uppercase tracking-widest">Product Core Memory</div>
                        </div>
                        <p className="text-zinc-400 font-mono text-xs">{selectedProduct.id}</p>
                      </div>
                   </div>
                   <button 
                     onClick={() => setSelectedProduct(null)}
                     className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                   >
                     <Zap className="w-6 h-6 rotate-45" />
                   </button>
                </div>

                <div className="flex-1 overflow-y-auto p-12 no-scrollbar">
                   {loadingMemories ? (
                     <div className="h-full flex flex-col items-center justify-center">
                        <Activity className="w-12 h-12 text-indigo-200 animate-spin mb-4" />
                        <p className="text-zinc-400 font-black uppercase text-xs tracking-widest">Reconstituindo fragmentos...</p>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                        {/* Summary Stats */}
                        <div className="md:col-span-3 space-y-6">
                           <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
                              <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-6">Cognição do Produto</h4>
                              <div className="space-y-6">
                                 <div>
                                    <p className="text-3xl font-black text-zinc-900 leading-none">{productMemories.length}</p>
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Total de Memórias</p>
                                 </div>
                                 <div>
                                    <p className="text-3xl font-black text-zinc-900 leading-none">{productMemories.filter(m => m.type === 'decision').length}</p>
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Decisões Críticas</p>
                                 </div>
                                 <div>
                                    <p className="text-3xl font-black text-zinc-900 leading-none">{productMemories.filter(m => m.type === 'learned').length}</p>
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Aprendizados IA</p>
                                 </div>
                              </div>
                           </div>

                           <div className="bg-zinc-900 rounded-[2.5rem] p-8 text-white">
                              <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mb-4">
                                 <Activity className="w-6 h-6 text-indigo-400" />
                              </div>
                              <h4 className="font-black text-lg mb-2">Health Index</h4>
                              <p className="text-xs text-zinc-500 italic mb-6">Grau de confiabilidade das memórias estruturais.</p>
                              <div className="flex items-center gap-4">
                                 <span className="text-4xl font-black">94%</span>
                                 <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 w-[94%]" />
                                 </div>
                              </div>
                           </div>
                        </div>

                        {/* Memory Timeline */}
                        <div className="md:col-span-9 space-y-8">
                           <div className="bg-white p-10 rounded-[3rem] border border-zinc-100 shadow-sm flex flex-col h-full">
                              <div className="flex items-center justify-between mb-8">
                                 <h3 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                                    <Database className="w-6 h-6 text-indigo-500" /> Linha do Tempo de Conhecimento
                                 </h3>
                                 <div className="flex gap-2">
                                    {['all', 'decision', 'learned', 'risk'].map(t => (
                                       <button key={t} className="px-3 py-1.5 bg-zinc-50 text-[9px] font-black uppercase text-zinc-400 rounded-lg hover:bg-zinc-100 transition-all">
                                          {t}
                                       </button>
                                    ))}
                                 </div>
                              </div>

                              <div className="space-y-6">
                                 {productMemories.length === 0 ? (
                                   <div className="py-20 text-center text-zinc-300 italic font-medium">Nenhuma memória estrutural para exibir.</div>
                                 ) : productMemories.map((memory, i) => (
                                   <div key={memory.id} className="relative pl-10 pb-10 last:pb-0">
                                      {/* Timeline connector */}
                                      {i !== productMemories.length - 1 && (
                                        <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-zinc-100" />
                                      )}
                                      
                                      {/* Timeline icon */}
                                      <div className="absolute left-0 top-0 w-10 h-10 bg-white border-2 border-zinc-100 rounded-xl flex items-center justify-center z-10 shadow-sm">
                                         {memory.type === 'decision' ? <Zap className="w-4 h-4 text-amber-500" /> : 
                                          memory.type === 'learned' ? <Brain className="w-4 h-4 text-indigo-500" /> :
                                          memory.type === 'risk' ? <AlertTriangle className="w-4 h-4 text-rose-500" /> :
                                          <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                                      </div>

                                      <div className="bg-zinc-50 rounded-[2rem] p-8 border border-zinc-100 hover:border-indigo-200 transition-all group">
                                         <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                               <span className="px-3 py-1 bg-white text-zinc-900 text-[9px] font-black uppercase rounded-full border border-zinc-200 shadow-sm">
                                                  {memory.type}
                                               </span>
                                               <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{formatDate(memory.created_at)}</span>
                                            </div>
                                            <div className="flex gap-1.5">
                                               {Array(5).fill(0).map((_, idx) => (
                                                 <div key={idx} className={cn("w-1.5 h-1.5 rounded-full", idx < Math.floor(memory.confidence * 5) ? "bg-emerald-400" : "bg-zinc-200")} />
                                               ))}
                                            </div>
                                         </div>
                                         
                                         <h4 className="text-xl font-black text-zinc-900 tracking-tight mb-2 uppercase">{memory.title}</h4>
                                         <p className="text-zinc-600 font-medium leading-relaxed italic pr-12">
                                            {memory.content}
                                         </p>

                                         <div className="mt-6 pt-6 border-t border-dotted border-zinc-200 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all">
                                            <div className="flex items-center gap-2">
                                               <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Fonte: {memory.source || 'IA Cognitive'}</span>
                                            </div>
                                            <button className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">
                                               <Eye className="w-3.5 h-3.5" /> Detalhes Técnicos
                                            </button>
                                         </div>
                                      </div>
                                   </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                     </div>
                   )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
