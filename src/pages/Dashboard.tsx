import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, getDoc, doc, addDoc, setDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanFirestoreData } from '../lib/firebase';
import { Product, ProductStage } from '../types';
import { Boxes, Plus, Search, Filter, Loader2, ArrowRight, User, Calendar, MoreVertical, RefreshCw, Settings2, Sparkles, LogOut, Shield, ChevronDown, Download, Users as UsersIcon, Edit2, Archive, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getStageMaturity, 
  getCachedProductEvolution, 
  syncProductEvolutionCache, 
  normalizeProgress,
  loadStagesAndCalculateProductEvolution,
  getDisplayProgress
} from '../lib/progressEngine';
import { 
  cleanConversationSummaryForDisplay, 
  removeStaleMaturityMentions 
} from '../lib/summarySanitizer';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { user, profile, adminCtx, setQuotaExceeded, logout } = useAuth();
  const [products, setProducts] = useState<(Product & { calculatedProgress?: number; access_role?: string; my_access?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [openMenuProductId, setOpenMenuProductId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    function handleClickOutside() {
      setIsUserMenuOpen(false);
      setOpenMenuProductId(null);
    }

    if (isUserMenuOpen) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const displayName =
    profile?.display_name ||
    user?.displayName ||
    user?.email ||
    "Usuário";

  const email =
    profile?.email ||
    user?.email ||
    "";

  const photoUrl =
    profile?.photo_url ||
    user?.photoURL ||
    null;

  const role =
    profile?.system_role ||
    (adminCtx?.isOwner ? "owner" : adminCtx?.isAdmin ? "admin" : "user");

  function getRoleLabel(role: string) {
    const labels: Record<string, string> = {
      owner: "Owner",
      admin: "Admin",
      user: "Usuário"
    };

    return labels[role] || "Usuário";
  }

  async function handleLogout() {
    console.log("[Logout] Clicked");
    try {
      setIsLoggingOut(true);
      console.log("[Logout] Calling signOut");
      await logout();
      console.log("[Logout] Success, navigating");
      navigate("/", { replace: true });
    } catch (error) {
      console.error("[Header] Error logging out:", error);
      alert("Não consegui sair da conta. Tente novamente.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.uid && !user?.email && !profile?.id && !profile?.email) return;

    loadProducts();
  }, [
    user?.uid,
    user?.email,
    profile?.id,
    profile?.email
  ]);

  const [productsError, setProductsError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceededLocal] = useState(false);

  function getDisplayProgress(p: any) {
    const val = p.calculatedProgress ?? p.progress ?? 0;
    const numeric = Number(val);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  async function loadMyProductAccess() {
    if (!user?.uid) return [];

    try {
      const accessSnap = await getDocs(
        collection(db, "user_product_access", user.uid, "products")
      );

      const accessItems = accessSnap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          product_id: docSnap.id,
          ...(docSnap.data() as any)
        }))
        .filter((item) => String(item.status || "active").toLowerCase() === "active");

      const products = await Promise.all(
        accessItems.map(async (access) => {
          const productId = access.product_id || access.id;

          const productSnap = await getDoc(doc(db, "products", productId));

          if (!productSnap.exists()) {
            return null;
          }

          const productData = {
            id: productSnap.id,
            ...(productSnap.data() as any)
          };

          let calculatedProgress = getDisplayProgress(productData);

          try {
            calculatedProgress = await syncProductEvolutionCache(productSnap.id);
          } catch (progressError) {
            console.warn("[Dashboard] Could not sync progress", productSnap.id, progressError);
          }

          return {
            ...productData,
            my_access: access,
            role: access.role || "viewer",
            access_role: access.role || "viewer",
            progress: calculatedProgress,
            overall_progress: calculatedProgress,
            evolution_score: calculatedProgress,
            calculatedProgress
          };
        })
      );

      return products.filter(Boolean);
    } catch (e) {
      console.error("[Dashboard] Error loading product access:", e);
      throw e;
    }
  }

  async function loadProducts() {
    setLoading(true);
    setProductsError(null);
    try {
      if (!user?.uid) {
        setProducts([]);
        return;
      }
      
      let productsData: any[] = [];

      try {
        productsData = await loadMyProductAccess();
      } catch (accessError: any) {
        console.warn("[Dashboard] user_product_access query failed, falling back to owner/admin query", accessError);

        const path = "products";
        let snap;

        if (adminCtx?.isAdmin) {
          const q = query(collection(db, path), limit(50));
          snap = await getDocs(q);
        } else {
          const q = query(
            collection(db, path),
            where("owner_id", "==", user.uid),
            limit(50)
          );
          snap = await getDocs(q);
        }

        productsData = await Promise.all(
          snap.docs.map(async (docSnap) => {
            const product = {
              id: docSnap.id,
              ...(docSnap.data() as any)
            };

            let calculatedProgress = getDisplayProgress(product);

            try {
              calculatedProgress = await syncProductEvolutionCache(product.id);
            } catch (progressError) {
              console.warn("[Dashboard] Could not sync fallback product progress", product.id, progressError);
            }

            return {
              ...product,
              role: product.owner_id === user.uid ? "owner" : "viewer",
              access_role: product.owner_id === user.uid ? "owner" : "viewer",
              progress: calculatedProgress,
              overall_progress: calculatedProgress,
              evolution_score: calculatedProgress,
              calculatedProgress
            };
          })
        );
      }

      setProducts(productsData as any);
    } catch (error: any) {
      console.error('[Dashboard] Error loading products:', error);
      if (error?.code === 'resource-exhausted' || error?.message?.includes("Quota exceeded")) {
        setQuotaExceededLocal(true);
        setQuotaExceeded(true);
        toast.error("Capacidade diária atingida (Quota).", { id: "quota-error" });
      } else if (error?.code === 'permission-denied') {
        setProductsError(
          "Você não tem permissão para ler seus produtos. Verifique as Firestore Rules."
        );
      } else {
        setProductsError(error?.message || "Não consegui carregar seus produtos.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newProductName.trim() || !user) return;
    setCreating(true);
    const path = 'products';
    try {
      const ownerName = profile?.display_name || user.displayName || user.email || 'Usuário';
      
      const newProductData: Omit<Product, 'id'> = {
        name: newProductName,
        description: newProductDesc,
        status: 'active',
        current_stage: 'sense',
        progress: 0,
        overall_progress: 0,
        evolution_score: 0,
        quality_score: 0,
        
        // Ownership details
        owner_id: user.uid,
        owner_email: user.email || '',
        owner_name: ownerName,
        created_by: user.uid,
        created_by_email: user.email || '',
        created_by_name: ownerName,
        
        // Collaboration
        collaborator_ids: [user.uid],
        collaborator_emails: [user.email || ''],
        editor_ids: [user.uid],
        commenter_ids: [],
        viewer_ids: [],
        
        collaborators: [
          {
            user_id: user.uid,
            email: user.email || '',
            name: ownerName,
            role: "owner",
            status: "active",
            added_by: user.uid,
            added_at: serverTimestamp()
          }
        ],
        
        pending_invite_emails: [],
        visibility: "private",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, path), cleanFirestoreData(newProductData));

      // Create index in user_product_access
      await setDoc(
        doc(db, "user_product_access", user.uid, "products", docRef.id),
        cleanFirestoreData({
          product_id: docRef.id,
          product_name: newProductName,
          product_description: newProductDesc || "",
          role: "owner",
          status: "active",
          product_status: "active",
          progress: 0,
          overall_progress: 0,
          evolution_score: 0,
          current_stage: "sense",
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        }),
        { merge: true }
      );

      // Create collaborator record
      await setDoc(
        doc(db, "products", docRef.id, "collaborators", user.uid),
        cleanFirestoreData({
          uid: user.uid,
          user_id: user.uid,
          email: user.email || null,
          name: ownerName,
          role: "owner",
          status: "active",
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        }),
        { merge: true }
      );

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
          <div
            className="relative"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((current) => !current)}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition-all hover:border-violet-200 hover:bg-violet-50"
              aria-label="Abrir menu do usuário"
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                  <User className="h-4 w-4" />
                </div>
              )}

              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 top-12 z-[9999] w-72 rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl">
                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                      <User className="h-5 w-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-950">
                      {displayName}
                    </p>
                    <p className="truncate text-xs font-semibold text-slate-500">
                      {email}
                    </p>

                    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-violet-700">
                      <Shield className="h-3 w-3" />
                      {getRoleLabel(role)}
                    </div>
                  </div>
                </div>

                <div className="my-2 h-px bg-slate-100" />

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-black text-rose-600 transition-all hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? "Saindo..." : "Sair da conta"}
                </button>
              </div>
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
        ) : productsError ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
            <h3 className="text-xl font-black text-rose-900">
              Erro ao carregar produtos
            </h3>
            <p className="mt-2 text-sm font-semibold text-rose-700">
              {productsError}
            </p>
            <button
              type="button"
              onClick={loadProducts}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-rose-600 shadow-sm transition-all hover:bg-rose-50"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>
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
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuProductId(openMenuProductId === product.id ? null : product.id);
                      }}
                      className="p-2 hover:bg-slate-50 rounded-xl text-slate-300 transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {openMenuProductId === product.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-10 z-[9999] w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                      >
                        {/* Botão Editar */}
                        {(product as any).my_access?.permissions?.canEditProduct && (
                          <button
                            type="button"
                            onClick={() => {
                              navigate(`/products/${product.id}?tab=advanced`);
                              setOpenMenuProductId(null);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4 text-slate-400" />
                            Editar Produto
                          </button>
                        )}
                        
                        {/* Botão Exportar */}
                        {(product as any).my_access?.permissions?.canExport && (
                          <button
                            type="button"
                            onClick={() => {
                              // Adicionar lógica de exportação depois
                              toast("Funcionalidade de exportação em breve!");
                              setOpenMenuProductId(null);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Download className="w-4 h-4 text-slate-400" />
                            Exportar Produto
                          </button>
                        )}
                        
                        {/* Botão Acessos */}
                        {(product as any).my_access?.permissions?.canManageAccess && (
                          <button
                            type="button"
                            onClick={() => {
                              navigate(`/products/${product.id}?tab=access`);
                              setOpenMenuProductId(null);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <UsersIcon className="w-4 h-4 text-slate-400" />
                            Gerenciar Acessos
                          </button>
                        )}

                        {/* Botão Arquivar/Deletar */}
                        {(product as any).my_access?.permissions?.canDeleteProduct && (
                          <>
                            <div className="h-px bg-slate-100 my-1 mx-2" />
                            <button
                              type="button"
                              onClick={() => {
                                // Adicionar lógica para arquivar ou deletar depois
                                toast("Funcionalidade de arquivamento em breve!");
                                setOpenMenuProductId(null);
                              }}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Archive className="w-4 h-4 text-rose-400" />
                              Arquivar Produto
                            </button>
                          </>
                        )}
                        {/* Placeholder fallback se nenhum botão for mostrado para viewer puro */}
                        {!(product as any).my_access?.permissions?.canEditProduct && !(product as any).my_access?.permissions?.canExport && !(product as any).my_access?.permissions?.canManageAccess && !(product as any).my_access?.permissions?.canDeleteProduct && (
                          <p className="text-xs px-3 py-2 text-slate-400 italic">Sem ações extras disponíveis</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <h3 className="text-xl font-black text-slate-900 truncate tracking-tight">
                    {product.name}
                    {product.access_role && (
                      <span className="ml-2 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600">
                        {product.access_role}
                      </span>
                    )}
                  </h3>
                </div>
                <p className="text-slate-400 text-sm mb-6 line-clamp-2 leading-relaxed h-10 italic">
                  {cleanConversationSummaryForDisplay(product.description || (product as any).conversation_summary || "Sem descrição disponível.")}
                </p>

                  <div className="flex flex-col gap-3">
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${getDisplayProgress(product)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400">Evolução do Produto</span>
                      <span className="text-indigo-600">{getDisplayProgress(product)}%</span>
                    </div>
                  </div>

                <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">Stage: {product.current_stage}</span>
                  </div>
                  
                  {((product as any).my_access?.permissions?.canView ?? true) && (
                    <div className="flex items-center gap-1 text-slate-900 font-bold text-xs uppercase tracking-tighter group-hover:text-indigo-600 transition-colors">
                      Workspace <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
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
