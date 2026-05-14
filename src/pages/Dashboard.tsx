import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Product, ProductStage } from '../types';
import { Boxes, Plus, Search, Filter, Loader2, ArrowRight, User, Calendar, MoreVertical, RefreshCw, Settings2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { calculateProductMaturity } from '../lib/maturity';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { user, adminCtx, setQuotaExceeded } = useAuth();
  const [products, setProducts] = useState<(Product & { calculatedProgress?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    loadProducts();
  }, [user, adminCtx]);

  async function loadProducts() {
    setLoading(true);
    try {
      let snap;
      const path = 'products';
      
      // Try admin query first if applicable
      if (adminCtx?.isAdmin) {
        try {
          const q = query(collection(db, path), limit(50));
          snap = await getDocs(q);
          console.log(`Admin loaded ${snap.docs.length} products`);
        } catch (err: any) {
          console.warn('Admin list query failed (possibly rules), falling back to owner query:', err);
          // Fall back to owner query
          const q = query(collection(db, path), where('owner_id', '==', user?.uid), limit(50));
          snap = await getDocs(q);
        }
      } else {
        const q = query(collection(db, path), where('owner_id', '==', user?.uid), limit(50));
        snap = await getDocs(q);
      }
      
      const productsData = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Product));
      
      if (productsData.length === 0) {
        console.warn('No products found in DB for user/query');
      }

      setProducts(productsData);
    } catch (e: any) {
      console.error('Failed to load products:', e);
      if (e.message?.includes('Quota exceeded') || e.code === 'resource-exhausted') {
        setQuotaExceeded(true);
        toast.error("Capacidade diária do banco de dados (Quota) atingida. Dados podem não carregar até o reset.", { id: 'quota-error' });
      } else {
        toast.error("Erro ao carregar produtos: " + (e.code || e.message));
      }
      // handleFirestoreError(e, OperationType.LIST, 'products');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newProductName.trim() || !user) return;
    setCreating(true);
    const path = 'products';
    try {
      const docRef = await addDoc(collection(db, path), {
        name: newProductName,
        description: newProductDesc,
        owner_id: user.uid,
        status: 'active',
        current_stage: 'sense',
        progress: 0,
        quality_score: 0,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      navigate(`/products/${docRef.id}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    } finally {
      setCreating(false);
      setIsModalOpen(false);
    }
  }

  const filteredProducts = products.filter(p => 
    (p.name?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
    (p.description?.toLowerCase() ?? '').includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="px-8 py-4 border-b border-slate-200 bg-white flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100">
              <Boxes className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">PC<span className="text-indigo-600">.</span></span>
          </div>
          <nav className="flex items-center gap-1">
            <button className="px-3 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-md">Meus Produtos</button>
            {adminCtx?.isAdmin && (
              <button 
                onClick={() => navigate('/admin?from=/products')}
                className="px-3 py-2 text-sm font-semibold text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              >
                Admin
              </button>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar produtos..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm w-64 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all border border-transparent focus:border-slate-200"
            />
          </div>
          <button 
            onClick={() => navigate('/settings')}
            className="p-2 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-400 rounded-xl transition-all cursor-pointer shadow-sm group"
            title="Ajustes da Tona"
          >
            <Settings2 className="w-5 h-5 transition-transform group-hover:rotate-45" />
          </button>
          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-200 shadow-inner">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="User" referrerPolicy="no-referrer" />
            ) : (
              <User className="w-full h-full p-1.5 text-slate-400" />
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Meus Produtos</h1>
            <p className="text-slate-500 mt-1 font-medium italic">Gerencie seu portfólio de construção de produtos.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
            Novo Produto
          </button>
        </div>

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-24 flex flex-col items-center justify-center shadow-sm">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-4" />
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Carregando seus produtos...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-24 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 border border-slate-100">
              <Boxes className="w-10 h-10 text-slate-200" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Nenhum produto encontrado</h2>
            <p className="text-slate-500 max-w-sm mb-4 leading-relaxed text-sm font-medium italic">
              Seus produtos sumiram? A capacidade gratuita de leitura do banco de dados pode ter sido atingida (Quota). Tente recarregar ou aguarde o reset diário.
            </p>
            <div className="flex gap-4">
              <button 
                 onClick={() => loadProducts()}
                 className="bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Tentar Recarregar
              </button>
              {adminCtx?.isAdmin ? (
                <button 
                  onClick={() => navigate('/admin?section=dashboard')}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Rodar Seeds (Admin)
                </button>
              ) : (
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Criar Novo Produto
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <motion.div 
                key={product.id}
                whileHover={{ y: -4 }}
                className="group bg-white border border-slate-200 rounded-3xl p-6 hover:border-indigo-400 transition-all cursor-pointer shadow-sm hover:shadow-xl"
                onClick={() => navigate(`/products/${product.id}`)}
              >
                <div className="flex items-start justify-between mb-6">
                   <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm border border-slate-100">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-300 transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
                
                <h3 className="text-xl font-black text-slate-900 mb-1 truncate tracking-tight">{product.name}</h3>
                <p className="text-slate-400 text-sm mb-6 line-clamp-2 leading-relaxed h-10 italic">
                  {product.description || "Sem descrição disponível."}
                </p>

                <div className="flex flex-col gap-3">
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${product.calculatedProgress ?? product.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-slate-400">Progresso</span>
                    <span className="text-indigo-600">{product.calculatedProgress ?? product.progress}%</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">Stage: {product.current_stage}</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-900 font-bold text-xs uppercase tracking-tighter group-hover:text-indigo-600 transition-colors">
                    Workspace <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Criar Produto */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] shadow-2xl relative w-full max-w-lg p-10 overflow-hidden border border-slate-200"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <Plus className="text-white w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Novo Produto</h2>
                  <p className="text-slate-400 text-sm font-medium">Inicie uma nova jornada de construção.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Nome do Produto</label>
                  <input 
                    type="text" 
                    placeholder="Ex: AI Study Companion"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-900"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Descrição Curta</label>
                  <textarea 
                    placeholder="Descreva o que seu produto faz..."
                    value={newProductDesc}
                    onChange={(e) => setNewProductDesc(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all min-h-[120px] resize-none font-medium text-slate-600"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 border border-slate-200 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition-all hover:text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleCreate}
                    disabled={creating || !newProductName.trim()}
                    className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                  >
                    {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Criar Produto"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
