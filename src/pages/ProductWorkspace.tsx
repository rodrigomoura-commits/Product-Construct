import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc, serverTimestamp, setDoc, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanFirestoreData } from '../lib/firebase';
import { Product, ProductStage, StageKey, StageField } from '../types';
import { 
  Boxes, ChevronRight, Activity, Layout, 
  FileText, History, Brain, MessageSquare, 
  CheckCircle2, AlertCircle, Loader2, ListTodo, Plus, Info, ChevronLeft, ChevronDown,
  Trash2, LogOut, Calendar, User, Settings2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { calculateProductMaturity } from '../lib/maturity';

// Components
import AIAssistantPanel from '../components/workspace/AIAssistantPanel';
import ProductIntelligencePanel from '../components/workspace/ProductIntelligencePanel';
import ArtifactsList from '../components/workspace/ArtifactsList';
import DecisionsList from '../components/workspace/DecisionsList';
import DocumentsPanel from '../components/workspace/DocumentsPanel';
import StageEditor from '../components/workspace/StageEditor';
import ArtifactDetailDrawer from '../components/workspace/ArtifactDetailDrawer';
import ArtifactRichEditor from '../components/workspace/artifacts/ArtifactRichEditor';
import CreateArtifactModal from '../components/workspace/CreateArtifactModal';
import ExportModal from '../components/workspace/ExportModal';
import { Artifact } from '../types';

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
  const { user, adminCtx } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [stages, setStages] = useState<ProductStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStageKey, setActiveStageKey] = useState<StageKey>('sense');
  const [activeTab, setActiveTab] = useState<'chat' | 'artifacts' | 'decisions' | 'documents' | 'history' | 'advanced'>('chat');
  
  // Artifact States
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [isArtifactDrawerOpen, setIsArtifactDrawerOpen] = useState(false);
  const [isArtifactEditorOpen, setIsArtifactEditorOpen] = useState(false);
  const [artifactEditorMode, setArtifactEditorMode] = useState<'view' | 'edit'>('view');
  const [isNewArtifactModalOpen, setIsNewArtifactModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

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

  useEffect(() => {
    if (!productId) return;

    const unsubProduct = onSnapshot(doc(db, 'products', productId), (snap) => {
      if (snap.exists()) {
        setProduct({ id: snap.id, ...snap.data() } as Product);
      } else {
        navigate('/products');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `products/${productId}`);
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
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, stagesPath);
    });

    return () => {
      unsubProduct();
      unsubStages();
    };
  }, [productId, navigate]);

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

  const currentStageData = stages.find(s => s.stage_key === activeStageKey);
  const overallProgress = calculateProductMaturity(stages);

  // Auto-repair if DB progress is inconsistent (e.g. 0% vs calculated 7%)
  useEffect(() => {
    if (loading || !product || overallProgress === product.progress) return;

    const sync = async () => {
      try {
        await updateDoc(doc(db, 'products', product.id), {
          progress: overallProgress,
          updated_at: serverTimestamp()
        });
      } catch (e) {
        console.error("Error auto-syncing product progress:", e);
      }
    };
    sync();
  }, [loading, product?.id, overallProgress, product?.progress]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 text-zinc-300 animate-spin" />
      </div>
    );
  }

  return (
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
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Maturidade Geral</span>
                <div className="w-24 bg-slate-200 h-1 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full transition-all duration-1000" style={{ width: `${overallProgress}%` }} />
                </div>
              </div>
              <span className="text-xs font-black text-slate-900">{overallProgress}%</span>
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
                             <span className={isActive ? "text-indigo-200" : "text-slate-400"}>Maturidade</span>
                             <span className={isActive ? "text-white" : "text-indigo-600"}>{progress}%</span>
                          </div>
                          <div className={cn("h-1 w-full rounded-full overflow-hidden", isActive ? "bg-white/20" : "bg-slate-100")}>
                             <div 
                               className={cn("h-full rounded-full transition-all duration-700", isActive ? "bg-white" : "bg-indigo-500")} 
                               style={{ width: `${progress}%` }} 
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
                { id: 'artifacts', label: 'Artefatos', icon: FileText },
                { id: 'decisions', label: 'Decisões', icon: ListTodo },
                { id: 'documents', label: 'Documentos', icon: Plus },
                { id: 'history', label: 'Histórico', icon: History },
              ].map((item) => (
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
                      product={product} 
                      activeStage={activeStageKey} 
                      stages={stages}
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
                 {activeTab === 'decisions' && <div className="p-8 max-w-4xl mx-auto w-full"><DecisionsList productId={productId!} /></div>}
                 {activeTab === 'documents' && <div className="p-8 max-w-4xl mx-auto w-full"><DocumentsPanel productId={productId!} /></div>}
                 {activeTab === 'advanced' && currentStageData && (
                    <div className="p-8 max-w-4xl mx-auto w-full">
                       <div className="mb-8 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 text-xs font-medium">
                          <strong>Modo Avançado:</strong> Use este modo apenas se quiser ajustar manualmente o que a IA capturou da conversa.
                       </div>
                       <StageEditor stage={currentStageData} product={product!} />
                    </div>
                 )}
                 {activeTab === 'history' && (
                    <div className="py-24 text-center text-zinc-400 italic">Timeline de eventos em breve.</div>
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
            activeStageName={currentStageData?.name || ''}
            open={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
         />
      )}

      {product && (
        <ProductIntelligencePanel 
            product={product}
            activeStage={activeStageKey}
            stages={stages}
          />
        )}
      </div>
    </div>
  );
}
