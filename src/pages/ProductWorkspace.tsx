import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { WorkspaceProvider } from '../contexts/WorkspaceContext';
import { useWorkspaceAccess } from '../hooks/useWorkspaceAccess';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc, serverTimestamp, setDoc, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanFirestoreData } from '../lib/firebase';
import { Product, ProductStage, StageKey, StageField } from '../types';
import { 
  Boxes, ChevronRight, Activity, Layout, 
  FileText, History, Brain, MessageSquare, 
  CheckCircle2, AlertCircle, Loader2, ListTodo, Plus, Info, ChevronLeft, ChevronDown,
  Trash2, LogOut, Calendar, User, Settings2, UserPlus, Users, Share2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { normalizeProgress, calculateProductEvolutionFromStages, syncProductEvolutionCache } from '../lib/progressEngine';

// Components
import AIAssistantPanel, { AIAssistantPanelRef } from '../components/workspace/AIAssistantPanel';
import ProductIntelligencePanel from '../components/workspace/ProductIntelligencePanel';
import ProductPanelErrorBoundary from '../components/workspace/ProductPanelErrorBoundary';
import ArtifactsList from '../components/workspace/ArtifactsList';
import ProductDecisionsPanel from '../components/products/decisions/ProductDecisionsPanel';
import HistoryPanel from '../components/workspace/HistoryPanel';
import ProductDocumentsPanel from '../components/products/ProductDocumentsPanel';
import StageEditor from '../components/workspace/StageEditor';
import ArtifactDetailDrawer from '../components/workspace/ArtifactDetailDrawer';
import ArtifactRichEditor from '../components/workspace/artifacts/ArtifactRichEditor';
import CreateArtifactModal from '../components/workspace/CreateArtifactModal';
import ExportModal from '../components/workspace/ExportModal';
import ProductInviteModal from '../components/products/ProductInviteModal';
import ProductAccessPanel from '../components/products/ProductAccessPanel';
import ProductSectionErrorBoundary from '../components/products/ProductSectionErrorBoundary';
import { Artifact, DiscussWithTonaPayload } from '../types';
import { createProductHistoryEvent } from '../lib/productHistory';
import { recordProductInteraction } from '../lib/productUserInteractions';

const JOURNEY_STAGES = [
  { key: 'sense', label: '1. Entender o Problema', icon: Info },
  { key: 'shape', label: '2. Definir a Proposta', icon: Brain },
  { key: 'sketch', label: '3. Visualizar a Solução', icon: Layout },
  { key: 'scope', label: '4. Planejar o MVP', icon: Activity },
  { key: 'ship', label: '5. Preparar a Entrega', icon: Boxes },
  { key: 'sense_plus', label: '6. Acompanhar e Aprender', icon: History },
] as const;

export default function ProductWorkspace() {
  const { productId } = useParams();
  const { user, profile, adminCtx } = useAuth();
  const navigate = useNavigate();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'artifacts' | 'decisions' | 'documents' | 'history' | 'advanced' | 'access'>('chat');
  
  const {
    loadingAccess,
    accessError,
    workspaceAccess,
    permissions,
    role
  } = useWorkspaceAccess(productId);

  const [product, setProduct] = useState<Product | null>(null);
  const [stages, setStages] = useState<ProductStage[]>([]);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [activeStageKey, setActiveStageKey] = useState<StageKey>('sense');

  // Helper permissions
  const safePermissions = permissions || {};

  const isSystemOwnerOrAdmin = Boolean(
    adminCtx?.isOwner ||
    adminCtx?.isAdmin ||
    adminCtx?.roles?.includes("owner") ||
    adminCtx?.roles?.includes("admin")
  );

  const isProductOwner = Boolean(
    role === "owner" ||
    workspaceAccess?.role === "owner" ||
    product?.owner_id === user?.uid ||
    product?.created_by === user?.uid
  );

  const canViewProduct = Boolean(
    product &&
    (
      isSystemOwnerOrAdmin ||
      isProductOwner ||
      safePermissions.canView ||
      safePermissions.can_view ||
      workspaceAccess?.status === "active"
    )
  );

  const canManageProductAccess = Boolean(
    product &&
    (
      isSystemOwnerOrAdmin ||
      isProductOwner ||
      safePermissions.canManageAccess ||
      safePermissions.can_manage_access
    )
  );

  const canInviteToProduct = canManageProductAccess;

  // Artifact States
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [isArtifactDrawerOpen, setIsArtifactDrawerOpen] = useState(false);
  const [isArtifactEditorOpen, setIsArtifactEditorOpen] = useState(false);
  const [artifactEditorMode, setArtifactEditorMode] = useState<'view' | 'edit'>('view');
  const [isNewArtifactModalOpen, setIsNewArtifactModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [pendingTonaPrompt, setPendingTonaPrompt] = useState<string | null>(null);
  const aiRef = React.useRef<AIAssistantPanelRef>(null);

  const productTabs = [
    { id: "chat", label: "Conversa", icon: MessageSquare, visible: true },
    { id: "artifacts", label: "Artefatos", icon: Layout, visible: true },
    { id: "decisions", label: "Decisões", icon: ListTodo, visible: true },
    { id: "documents", label: "Documentos", icon: FileText, visible: true },
    { id: "history", label: "Histórico", icon: History, visible: true },
    { id: "access", label: "Acessos", icon: Users, visible: canManageProductAccess }
  ].filter((tab) => tab.visible);

  const visibleTabIds = React.useMemo(
    () => productTabs.map((tab) => tab.id).join("|"),
    [canManageProductAccess]
  );

  useEffect(() => {
    const tabExists = productTabs.some((tab) => tab.id === activeTab);

    if (!tabExists) {
      setActiveTab("chat");
    }
  }, [activeTab, visibleTabIds]);

  const handleDiscussWithTona = (payload: DiscussWithTonaPayload) => {
    if (!product) return;
    
    console.log("[Workspace] Discussing point with Tona:", payload.title);
    
    const prompt = payload.suggestedPrompt || [
        `Quero retomar um ponto da inteligência estratégica deste produto.`,
        ``,
        `Produto: ${product.name}`,
        `Etapa ativa: ${activeStageKey}`,
        `Origem: ${payload.source}`,
        payload.classification ? `Classificação: ${payload.classification}` : null,
        ``,
        `Ponto para discutir: ${payload.title}`,
        payload.content ? `Conteúdo: ${payload.content}` : null,
        ``,
        `Me ajude a aprofundar este ponto, validar se ele está bem formulado, separar fato de hipótese e sugerir o próximo passo mais útil.`
    ].filter(Boolean).join("\n");

    setPendingTonaPrompt(prompt);
    setActiveTab('chat');

    // Add to history
    createProductHistoryEvent({
        product_id: product.id,
        type: 'synthesis_point_discussed',
        stage_key: payload.stageKey || activeStageKey,
        title: 'Ponto da síntese retomado',
        summary: `O usuário retomou o ponto "${payload.title}" com a Tona para aprofundar o entendimento.`,
        source: 'synthesis_interaction',
        related_interaction_id: payload.sourceId || undefined,
        metadata: {
            classification: payload.classification,
            original_source: payload.source
        },
        created_by: user?.uid || '',
        created_by_email: user?.email || '',
    });
  };

  const handleOpenArtifact = (artifact: Artifact) => {
    console.log("[Artifacts] Opening artifact", artifact.id);
    setSelectedArtifact(artifact);
    setArtifactEditorMode('view');
    setIsArtifactDrawerOpen(true);
  };

  const handleEditArtifact = (artifact?: Artifact) => {
    const artifactToEdit = artifact || selectedArtifact;
    if (!artifactToEdit) return;

    console.log("[Artifacts] Editing artifact", artifactToEdit.id);
    setSelectedArtifact(artifactToEdit);
    setIsArtifactDrawerOpen(false);
    setArtifactEditorMode('edit');
    setIsArtifactEditorOpen(true);
  };

  const [accessLoading, setAccessLoading] = useState(true);

  useEffect(() => {
    if (!productId || !user?.uid || loadingAccess) return;

    if (accessError || !permissions?.canView) {
      setLoadingProduct(false);
      return;
    }

    // Load product meta
    const unsubProduct = onSnapshot(doc(db, 'products', productId), (snap) => {
        if (snap.exists()) {
           setProduct({ id: snap.id, ...snap.data() } as Product);
        } else {
           navigate('/products');
        }
    });
    
    const stagesPath = `products/${productId}/stages`;
    const unsubStages = onSnapshot(query(collection(db, stagesPath), limit(20)), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductStage));
      if (data.length === 0) {
        initializeStages(productId);
      } else {
        setStages(data.sort((a, b) => {
          const order = JOURNEY_STAGES.map(s => s.key);
          return order.indexOf(a.stage_key) - order.indexOf(b.stage_key);
        }));
      }
      setLoadingProduct(false);
    });
    
    return () => {
      unsubProduct();
      unsubStages();
    };
  }, [productId, navigate, user?.uid, loadingAccess, accessError, permissions?.canView]);

  // Record workspace interaction when it loads
  useEffect(() => {
    if (product?.id && user?.uid && !loadingAccess && permissions?.canView) {
      recordProductInteraction({
        productId: product.id,
        user,
        profile,
        role: role,
        section: activeTab,
        event: "workspace_opened"
      });
    }
  }, [product?.id, user?.uid, activeTab, loadingAccess, permissions?.canView]);

  useEffect(() => {
    if (activeTab === "access" && !canManageProductAccess) {
      setActiveTab("chat");
    }
  }, [activeTab, canManageProductAccess]);

  async function initializeStages(pId: string) {
    const path = `products/${pId}/stages`;
    try {
      for (const s of JOURNEY_STAGES) {
        await setDoc(doc(db, path, s.key), cleanFirestoreData({
          product_id: pId,
          stage_key: s.key,
          name: s.label,
          status: 'not_started',
          progress: 0,
          quality_score: 0,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        }));
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  }

  const currentStageObject = stages.find(s => s.stage_key === activeStageKey);
  const overallProgress = calculateProductEvolutionFromStages(stages);

  // Sync overall progress to product document (Calculated and Normalized)
  useEffect(() => {
    if (loadingProduct || !productId || stages.length === 0 || !product) return;
    
    // Use the central sync helper from progressEngine
    syncProductEvolutionCache(productId)
      .catch(err => console.error("Error syncing product evolution:", err));
    
  }, [loadingProduct, productId, stages, product]);

  // Use new access guards
  if (loadingProduct || loadingAccess) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 text-zinc-300 animate-spin" />
      </div>
    );
  }

  if (accessError && !isSystemOwnerOrAdmin) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-rose-100">
          <AlertCircle className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Acesso ao produto não liberado</h2>
        <p className="text-slate-500 max-w-md italic mb-8">
          {accessError}
        </p>
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/products')}
            className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
          >
            Voltar para Meus Produtos
          </button>
        </div>
      </div>
    );
  }

  if (!canViewProduct && !loadingProduct && !loadingAccess) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-rose-100">
          <AlertCircle className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Acesso negado</h2>
        <p className="text-slate-500 max-w-md italic mb-8">
          Você não tem permissão para visualizar este produto.
        </p>
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/products')}
            className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
          >
            Voltar para Meus Produtos
          </button>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceProvider 
      productId={productId!}
      product={product}
      loading={loadingProduct}
      role={role}
      permissions={permissions}
      currentStage={activeStageKey}
    >
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-50 font-sans text-slate-900">
      {/* Product Header */}
      <header className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <button onClick={() => navigate('/products')} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 group transition-all">
             <ChevronLeft className="w-5 h-5 group-hover:text-slate-900 transition-colors" />
          </button>
          <div className="flex flex-col min-w-0">
            <h1 className="font-black text-lg text-slate-900 truncate tracking-tight">{product?.name}</h1>
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{product?.status}</span>
               <span className="w-1 h-1 bg-slate-300 rounded-full" />
               <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Etapa Ativa: {activeStageKey.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="hidden md:flex items-center gap-3 px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-full shadow-inner">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Evolução do Produto</span>
                <div className="w-24 bg-slate-200 h-1 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full transition-all duration-1000" style={{ width: `${overallProgress}%` }} />
                </div>
              </div>
              <span className="text-xs font-black text-indigo-600">{overallProgress}%</span>
           </div>
           
           <div className="flex items-center gap-2">
              {adminCtx?.isAdmin && (
                <button 
                  onClick={() => navigate(`/admin?from=/products/${productId}`)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Admin
                </button>
              )}
              <button 
                onClick={() => setActiveTab('advanced')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === 'advanced' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500 hover:text-slate-900"
                )}
              >
                Modo Avançado
              </button>
              <button 
                onClick={() => navigate('/settings')}
                className="p-2 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-400 rounded-xl transition-all cursor-pointer shadow-sm group"
                title="Ajustes da Tona"
              >
                <Settings2 className="w-5 h-5 transition-transform group-hover:rotate-45" />
              </button>
              {canInviteToProduct && (
                <button 
                  onClick={() => setIsInviteModalOpen(true)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:border-slate-900 transition-all active:scale-95 shadow-sm flex items-center gap-2"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Compartilhar
                </button>
              )}
              <button 
                onClick={() => setIsExportModalOpen(true)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
              >
                Exportar
              </button>
           </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Journey Sidebar */}
        <nav className="w-64 border-r border-slate-200 bg-white flex flex-col py-6 overflow-y-auto shrink-0 no-scrollbar">
           <div className="px-6 mb-6">
              <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Jornada do Produto</h2>
              <div className="space-y-1">
                 {JOURNEY_STAGES.map((s) => {
                   const stageData = stages.find(st => st.stage_key === s.key);
                   const isActive = activeStageKey === s.key;
                   const progress = stageData?.progress || 0;
                   return (
                     <button
                       key={s.key}
                       onClick={() => { setActiveStageKey(s.key as StageKey); setActiveTab('chat'); }}
                       className={cn(
                         "w-full flex flex-col gap-2 px-3 py-3 rounded-xl transition-all group border",
                         isActive 
                           ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                           : "text-slate-500 hover:bg-slate-50 border-transparent hover:text-slate-900"
                       )}
                     >
                       <div className="flex items-center gap-3 w-full">
                          <div className={cn(
                            "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-colors",
                            isActive ? "bg-white/20 border-white/40" : "bg-slate-50 border-slate-100 group-hover:bg-white group-hover:border-slate-200"
                          )}>
                           <s.icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-slate-400")} />
                          </div>
                          <span className="font-bold text-[11px] tracking-tight text-left leading-tight">{s.label.split('.')[1].trim()}</span>
                          {progress >= 80 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
                       </div>
                       
                       <div className="w-full space-y-1">
                          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest">
                             <span className={isActive ? "text-indigo-200" : "text-slate-400"}>Maturidade da Etapa</span>
                             <span className={isActive ? "text-white" : "text-indigo-600"}>{normalizeProgress(progress)}%</span>
                          </div>
                          <div className={cn("h-1 w-full rounded-full overflow-hidden", isActive ? "bg-white/20" : "bg-slate-100")}>
                             <div 
                               className={cn("h-full rounded-full transition-all duration-700", isActive ? "bg-white" : "bg-indigo-500")} 
                               style={{ width: `${normalizeProgress(progress)}%` }} 
                             />
                          </div>
                       </div>
                     </button>
                   );
                 })}
              </div>
           </div>

           <div className="mt-auto px-6 space-y-1">
              {[
                { id: 'chat', label: 'Conversa', icon: MessageSquare },
                { id: 'artifacts', label: 'Artefatos', icon: Layout },
                { id: 'decisions', label: 'Decisões', icon: ListTodo },
                { id: 'documents', label: 'Documentos', icon: FileText },
                { id: 'history', label: 'Histórico', icon: History },
                { id: 'access', label: 'Acessos', icon: Users, visible: canManageProductAccess },
              ].filter(item => item.visible !== false).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group border",
                    activeTab === item.id 
                      ? "bg-slate-100 border-slate-200 text-slate-900" 
                      : "text-slate-400 hover:bg-slate-50 border-transparent hover:text-slate-600"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="font-bold text-[11px] tracking-tight">{item.label}</span>
                </button>
              ))}
           </div>
        </nav>

        {/* Main Editor Area */}
        <div className="flex-1 overflow-y-auto bg-white relative flex flex-col no-scrollbar">
           <AnimatePresence mode="wait">
              <motion.div
                key={activeTab + (activeTab === 'chat' ? activeStageKey : '')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col h-full"
              >
                 {activeTab === 'chat' && product && (
                    <AIAssistantPanel 
                      ref={aiRef}
                      product={product} 
                      activeStage={activeStageKey} 
                      stages={stages}
                      permissions={permissions}
                      workspaceAccess={workspaceAccess}
                      pendingPrompt={pendingTonaPrompt}
                      onPendingPromptConsumed={() => setPendingTonaPrompt(null)}
                      onTabChange={(tab) => setActiveTab(tab)}
                    />
                 )}
                 {activeTab === 'artifacts' && (
                    <div className="p-8 max-w-4xl mx-auto w-full">
                       <ArtifactsList 
                         productId={productId!} 
                         onOpenArtifact={handleOpenArtifact}
                         onNewArtifact={() => setIsNewArtifactModalOpen(true)}
                       />
                    </div>
                 )}
                 {activeTab === 'decisions' && product && (
                    <div className="p-12 max-w-6xl mx-auto w-full">
                       <ProductDecisionsPanel 
                         product={product} 
                         user={user} 
                         onDiscussWithTona={handleDiscussWithTona}
                       />
                    </div>
                 )}
                 {activeTab === 'documents' && product && (
                    <div className="p-8 max-w-5xl mx-auto w-full">
                       <ProductDocumentsPanel 
                         product={product} 
                         activeStage={activeStageKey}
                         user={user}
                         onProductUpdated={() => {}}
                         onMemoryUpdated={() => {}}
                       />
                    </div>
                 )}
                 {activeTab === 'advanced' && currentStageObject && (
                    <div className="p-8 max-w-4xl mx-auto w-full">
                       <div className="mb-8 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 text-xs font-medium">
                          <strong>Modo Avançado:</strong> Use este modo apenas se quiser ajustar manualmente o que a IA capturou da conversa.
                       </div>
                       <StageEditor stage={currentStageObject} product={product!} />
                    </div>
                 )}
                 {activeTab === 'history' && (
                    <HistoryPanel productId={productId!} />
                 )}
                     {activeTab === 'access' && product && canManageProductAccess && (
                        <ProductSectionErrorBoundary sectionName="Pessoas e acessos">
                          <ProductAccessPanel 
                            product={product} 
                            user={user} 
                            adminCtx={adminCtx}
                            onProductUpdated={() => {}}
                          />
                        </ProductSectionErrorBoundary>
                     )}
                     {activeTab === 'access' && product && !canManageProductAccess && (
                        <div className="flex-1 flex items-center justify-center p-10">
                          <div className="max-w-xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
                            <h2 className="text-xl font-black text-slate-900 mb-2">
                              Acesso restrito
                            </h2>
                            <p className="text-sm text-slate-600">
                              Você pode visualizar este produto, mas não tem permissão para gerenciar colaboradores.
                            </p>
                          </div>
                        </div>
                     )}
              </motion.div>
           </AnimatePresence>
        </div>

      {/* Intelligence Panel Sidebar */}
      {product && isArtifactDrawerOpen && (
        <ArtifactDetailDrawer 
          artifact={selectedArtifact}
          product={product}
          open={isArtifactDrawerOpen}
          onClose={() => setIsArtifactDrawerOpen(false)}
          onEdit={handleEditArtifact}
        />
      )}

      {product && selectedArtifact && (
        <ArtifactRichEditor 
          artifact={selectedArtifact}
          product={product}
          open={isArtifactEditorOpen}
          mode={artifactEditorMode}
          onClose={() => setIsArtifactEditorOpen(false)}
          onSaved={(updated) => {
            setSelectedArtifact(updated);
          }}
        />
      )}

      {product && (
         <CreateArtifactModal 
            productId={product.id}
            currentStage={activeStageKey}
            open={isNewArtifactModalOpen}
            onClose={() => setIsNewArtifactModalOpen(false)}
         />
      )}

      {product && (
         <ExportModal 
            productId={product.id}
            activeStageName={currentStageObject?.name || ''}
            open={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
         />
      )}

      {product && isInviteModalOpen && canInviteToProduct && (
         <ProductInviteModal
            product={product}
            user={user}
            adminCtx={adminCtx}
            onClose={() => setIsInviteModalOpen(false)}
            onInviteSent={() => {
              setIsInviteModalOpen(false);
            }}
         />
      )}

      {product && (
         <ProductPanelErrorBoundary panelName="Inteligência Estratégica">
           <ProductIntelligencePanel 
             product={product}
             activeStage={activeStageKey}
             stages={stages}
             onDiscussWithTona={handleDiscussWithTona}
             onContinue={() => {
               setActiveTab('chat');
               setTimeout(() => aiRef.current?.resume(), 100);
             }}
           />
         </ProductPanelErrorBoundary>
      )}
      </div>
    </div>
    </WorkspaceProvider>
  );
}
