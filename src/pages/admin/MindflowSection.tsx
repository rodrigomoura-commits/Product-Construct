import React, { useEffect, useState, useRef } from 'react';
import { collection, query, getDocs, orderBy, limit, onSnapshot, doc, setDoc, serverTimestamp, addDoc, where, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  MindflowLearning, 
  AdminCtx, 
  MindflowLearningCandidate, 
  MindflowRetrievalLog, 
  MindflowKnowledgeType,
  MindflowClassification,
  MindflowReasoning,
  MindflowReasoningRun,
  MindflowConflictGroup
} from '../../types';
import { 
  Activity, Zap, Brain, Target, 
  ChevronRight, Loader2, PlayCircle, PauseCircle, 
  History, AlertCircle, Info, Sparkles, MessageSquare,
  Network, Database, GraduationCap, BarChart3, Settings2,
  Filter, Search, CheckCircle2, XCircle, MoreVertical,
  ArrowRight, Layers, Fingerprint, Eye, Trash2, ShieldCheck,
  Tag, Clock, Briefcase, FileText, Download, Upload, RefreshCw,
  Plus, Check, X, AlertTriangle, BookOpen, Quote, Edit3,
  Lightbulb, Workflow, ScanEye, ScrollText, Binary, Users
} from 'lucide-react';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { promoteToBaseLearning } from '../../lib/mindflow';
import { runDailyMindflowReasoning } from '../../lib/mindflowReasoning';
import { toast } from 'react-hot-toast';
import { GEMINI_MODEL } from '../../config/ai';
import MindflowContextsSection from './MindflowContextsSection';
import MindflowInteractionsSection from './MindflowInteractionsSection';
import MindflowUsersSection from './MindflowUsersSection';
import MindflowConflictsSection from './MindflowConflictsSection';
import MindflowBehavioralSection from './MindflowBehavioralSection';
import MindflowTraceSection from './MindflowTraceSection';
import ImportLearningsButton from '../../components/admin/mindflow/ImportLearningsButton';
import { MindflowImportJob } from '../../types';

type MindflowTab = 'overview' | 'learnings' | 'reasonings' | 'base' | 'acquired' | 'user_memories' | 'contexts' | 'candidates' | 'conflicts' | 'import' | 'users' | 'logs' | 'config';

export default function MindflowAdminSection({ ctx }: { ctx: AdminCtx }) {
  const [activeTab, setActiveTab] = useState<MindflowTab>('overview');
  const [learnings, setLearnings] = useState<MindflowLearning[]>([]);
  const [reasonings, setReasonings] = useState<MindflowReasoning[]>([]);
  const [reasoningRuns, setReasoningRuns] = useState<MindflowReasoningRun[]>([]);
  const [candidates, setCandidates] = useState<MindflowLearningCandidate[]>([]);
  const [logs, setLogs] = useState<MindflowRetrievalLog[]>([]);
  const [conflictGroups, setConflictGroups] = useState<MindflowConflictGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isProcessingReasoning, setIsProcessingReasoning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassification, setFilterClassification] = useState<string>('all');
  const [isImporting, setIsImporting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [importJobs, setImportJobs] = useState<MindflowImportJob[]>([]);
  const [llmHealth, setLlmHealth] = useState<any>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  
  const [newLearning, setNewLearning] = useState<Partial<MindflowLearning>>({
    learning_type: 'Base',
    classification: 'fato',
    scope_type: 'global',
    theme: '',
    sub_theme: '',
    title: '',
    learning: '',
    confidence_score: 1,
    relevance_score: 1,
    quality_score: 1,
    is_active: true,
    is_verified: true,
    needs_review: false
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    let unsubs: (() => void)[] = [];

    // Data Load based on Tab
    if (['overview', 'learnings', 'base', 'acquired'].includes(activeTab)) {
      let q = query(collection(db, 'mindflow_learnings'), orderBy('created_at', 'desc'), limit(50));
      
      if (activeTab === 'base') {
        q = query(collection(db, 'mindflow_learnings'), where('learning_type', '==', 'Base'), orderBy('created_at', 'desc'), limit(50));
      } else if (activeTab === 'acquired') {
        q = query(collection(db, 'mindflow_learnings'), where('learning_type', '==', 'Adquirida'), orderBy('created_at', 'desc'), limit(50));
      }

      const unsub = onSnapshot(q, (snap) => {
        setLearnings(snap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowLearning)));
        setLoading(false);
      }, (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'mindflow_learnings');
      });
      unsubs.push(unsub);
    }

    if (activeTab === 'overview' || activeTab === 'candidates') {
      const q = query(collection(db, 'mindflow_learning_candidates'), where('review_status', '==', 'pending'), orderBy('created_at', 'desc'), limit(50));
      const unsub = onSnapshot(q, (snap) => {
        setCandidates(snap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowLearningCandidate)));
        if (activeTab === 'candidates') setLoading(false);
      }, (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'mindflow_learning_candidates');
      });
      unsubs.push(unsub);
    }

    if (activeTab === 'reasonings') {
      const q = query(collection(db, 'mindflow_reasonings'), orderBy('created_at', 'desc'), limit(20));
      const unsubReason = onSnapshot(q, (snap) => {
        setReasonings(snap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowReasoning)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'mindflow_reasonings'));
      unsubs.push(unsubReason);

      const qRuns = query(collection(db, 'mindflow_reasoning_runs'), orderBy('started_at', 'desc'), limit(10));
      const unsubRuns = onSnapshot(qRuns, (snap) => {
        setReasoningRuns(snap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowReasoningRun)));
        setLoading(false);
      }, (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'mindflow_reasoning_runs');
      });
      unsubs.push(unsubRuns);
    }

    if (activeTab === 'overview' || activeTab === 'conflicts') {
      const q = query(collection(db, 'mindflow_conflict_groups'), where('status', 'in', ['open', 'in_review']), limit(50));
      const unsubConflicts = onSnapshot(q, (snap) => {
        setConflictGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowConflictGroup)));
        if (activeTab === 'conflicts') setLoading(false);
      }, (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'mindflow_conflict_groups');
      });
      unsubs.push(unsubConflicts);
    }

    if (activeTab === 'logs') {
      const q = query(collection(db, 'mindflow_retrieval_logs'), orderBy('created_at', 'desc'), limit(20));
      const unsubLogs = onSnapshot(q, (snap) => {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowRetrievalLog)));
        setLoading(false);
      }, (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'mindflow_retrieval_logs');
      });
      unsubs.push(unsubLogs);
    }

    if (activeTab === 'import') {
      const q = query(collection(db, 'mindflow_import_jobs'), orderBy('created_at', 'desc'), limit(20));
      const unsub = onSnapshot(q, (snap) => {
        setImportJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowImportJob)));
        setLoading(false);
      }, (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'mindflow_import_jobs');
      });
      unsubs.push(unsub);
    }

    if (activeTab === 'config') {
      const checkStatus = async () => {
        setIsCheckingHealth(true);
        try {
          const { getLLMHealth } = await import('../../lib/geminiProxy');
          const health = await getLLMHealth();
          setLlmHealth(health);
        } catch (e) {
          setLlmHealth({ status: 'error', message: 'Falha ao conectar com o serviço de diagnóstico.' });
        } finally {
          setIsCheckingHealth(false);
        }
      };
      checkStatus();
    }

    if (['users', 'contexts', 'user_memories'].includes(activeTab)) {
      setLoading(false);
    }

    return () => unsubs.forEach(unsub => unsub());
  }, [activeTab]);

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setSyncProgress(prev => (prev < 90 ? prev + Math.random() * 8 : prev));
      }, 400);
      return () => clearInterval(interval);
    } else {
      setSyncProgress(100);
    }
  }, [loading]);

  const tabs: { id: MindflowTab; label: string; icon: any; color: string; badge?: number }[] = [
    { id: 'overview', label: 'Visão Geral', icon: BarChart3, color: 'text-indigo-600' },
    { id: 'base', label: 'Aprendizados Base', icon: ShieldCheck, color: 'text-indigo-600' },
    { id: 'acquired', label: 'Aprendizados Adquiridos', icon: Brain, color: 'text-emerald-600' },
    { id: 'candidates', label: 'Câmara de Triagem', icon: Sparkles, color: 'text-amber-500', badge: candidates.length },
    { id: 'reasonings', label: 'Raciocínios Profundos', icon: Workflow, color: 'text-amber-500' },
    { id: 'user_memories', label: 'Memórias do Usuário', icon: History, color: 'text-rose-500' },
    { id: 'conflicts', label: 'Central de Conflitos', icon: AlertTriangle, color: 'text-red-500', badge: conflictGroups.length },
    { id: 'contexts', label: 'Mapas de Contexto', icon: Target, color: 'text-blue-500' },
    { id: 'users', label: 'Biometria Comportamental', icon: Users, color: 'text-zinc-500' },
    { id: 'logs', label: 'Trilha Censorial', icon: ScanEye, color: 'text-zinc-400' },
    { id: 'import', label: 'Histórico de Importação', icon: History, color: 'text-zinc-500' },
    { id: 'config', label: 'Arquitetura', icon: Settings2, color: 'text-zinc-500' },
  ];

  const handleCreateManualLearning = async () => {
    if (!newLearning.learning || !newLearning.theme) {
      toast.error("Aprendizado e Tema são obrigatórios.");
      return;
    }

    try {
      await addDoc(collection(db, 'mindflow_learnings'), {
        ...newLearning,
        learning_date: new Date().toISOString().split('T')[0],
        usage_count: 0,
        is_active: true,
        created_by: ctx.userId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        metadata: { source: 'manual_admin_v2' }
      });
      toast.success("Novo aprendizado consolidado!");
      setIsAddModalOpen(false);
      setNewLearning({
        learning_type: 'Base',
        classification: 'fato',
        scope_type: 'global',
        theme: '',
        sub_theme: '',
        title: '',
        learning: '',
        confidence_score: 1,
        relevance_score: 1,
        quality_score: 1,
        is_active: true,
        is_verified: true,
        needs_review: false
      });
    } catch (e) {
      toast.error("Erro ao injetar conhecimento.");
    }
  };

  const handleApproveCandidate = async (candidate: MindflowLearningCandidate) => {
    try {
      await updateDoc(doc(db, 'mindflow_learning_candidates', candidate.id), {
        review_status: 'approved',
        reviewed_by: ctx.userId,
        reviewed_at: serverTimestamp()
      });
      
      await addDoc(collection(db, 'mindflow_learnings'), {
        learning_date: new Date().toISOString().split('T')[0],
        learning_type: 'Adquirida',
        theme: candidate.suggested_theme || 'Geral',
        sub_theme: candidate.suggested_sub_theme || 'Geral',
        learning: candidate.extracted_learning,
        classification: candidate.suggested_classification || 'aprendizado',
        scope_type: candidate.product_id ? 'product' : 'user',
        confidence_score: candidate.confidence_score,
        relevance_score: 0.8,
        quality_score: 0.8,
        usage_count: 0,
        is_verified: false,
        needs_review: false,
        is_active: true,
        created_by: ctx.userId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        metadata: { ...candidate.metadata, source: 'ai_extraction_v2' }
      } as Omit<MindflowLearning, 'id'>);

      toast.success("Candidato aprovado e consolidado!");
    } catch (e) {
      toast.error("Falha na consolidação do candidato.");
    }
  };

  const handleRunReasoning = async () => {
    setIsProcessingReasoning(true);
    const tid = toast.loading("Gerando Raciocínios Profundos (Fase 3)...");
    try {
      await runDailyMindflowReasoning(ctx.userId);
      toast.success("Raciocínios processados com sucesso!", { id: tid });
    } catch (e) {
      toast.error("Erro no processamento cognitivo.", { id: tid });
    } finally {
      setIsProcessingReasoning(false);
    }
  };

  const filteredLearnings = learnings.filter(l => {
    const learning = l.learning || '';
    const theme = l.theme || '';
    const title = l.title || '';
    const term = searchTerm.toLowerCase();

    const matchesSearch = learning.toLowerCase().includes(term) || 
                          theme.toLowerCase().includes(term) ||
                          title.toLowerCase().includes(term);
    const matchesClassification = filterClassification === 'all' || l.classification === filterClassification;
    return matchesSearch && matchesClassification;
  });

  return (
    <div className="space-y-8 pb-32">
      {/* Dynamic Sync Indicator */}
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1.5 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <motion.div 
            className="h-full bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.8)]"
            initial={{ width: 0 }}
            animate={{ width: `${syncProgress}%` }}
            transition={{ ease: "linear" }}
          />
        </div>
      )}

      {/* Modern Header Architecture */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 bg-zinc-900 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-zinc-300">
               <Brain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-zinc-900 tracking-tighter">Mindflow Orchestrator</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-md text-[8px] font-black uppercase tracking-widest">Active Core</span>
                <span className="text-zinc-400 font-bold uppercase text-[9px] tracking-[0.2em]">Cognitive Layer V2.0</span>
              </div>
            </div>
          </div>
          <p className="text-zinc-500 font-medium text-base italic max-w-2xl leading-relaxed">
            Painel soberano para curadoria de aprendizados, supervisão de raciocínios profundos e resolução de conflitos cognitivos da Tona.
          </p>
        </div>

        <div className="flex flex-wrap bg-zinc-100 p-1.5 rounded-[1.75rem] border border-zinc-200 shadow-sm max-w-full overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 shrink-0",
                activeTab === tab.id 
                  ? "bg-white text-zinc-900 shadow-lg ring-1 ring-zinc-200/50 scale-[1.02]" 
                  : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
              )}
            >
              <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? tab.color : "text-zinc-300")} />
              {tab.label}
              {tab.badge && tab.badge > 0 ? (
                <span className="flex items-center justify-center w-5 h-5 bg-rose-500 text-white rounded-full text-[9px] font-black shadow-lg shadow-rose-200">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[500px]"
          >
             <div className="relative mb-8">
               <div className="absolute inset-0 bg-indigo-500/20 blur-3xl animate-pulse rounded-full" />
               <Brain className="w-16 h-16 text-zinc-200 animate-bounce relative z-10" />
             </div>
             <p className="text-zinc-400 font-black uppercase text-[11px] tracking-[0.3em] font-mono">Sincronizando Heurísticas...</p>
             <div className="mt-4 flex items-center gap-2">
                <div className="w-32 h-1 bg-zinc-100 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-zinc-300"
                    initial={{ width: 0 }}
                    animate={{ width: `${syncProgress}%` }}
                  />
                </div>
                <span className="text-[10px] font-black text-zinc-300">{Math.floor(syncProgress)}%</span>
             </div>
          </motion.div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
            className="min-h-[600px] outline-none"
          >
            {activeTab === 'overview' && (
              <div className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white border border-zinc-100 rounded-[2.5rem] p-10 flex flex-col items-center text-center shadow-sm hover:shadow-2xl transition-all group border-b-4 border-b-rose-500">
                     <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-6 border border-rose-100">
                        <History className="w-8 h-8 text-rose-600" />
                     </div>
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Camada 1: Memórias</span>
                     <span className="text-5xl font-black text-zinc-900 tracking-tighter">RAW</span>
                     <span className="text-[11px] text-zinc-500 font-bold mt-2 uppercase tracking-wide">Interações Brutas</span>
                  </div>
                  <div className="bg-white border border-zinc-100 rounded-[2.5rem] p-10 flex flex-col items-center text-center shadow-sm hover:shadow-2xl transition-all group border-b-4 border-b-indigo-500">
                     <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 border border-indigo-100">
                        <Database className="w-8 h-8 text-indigo-600" />
                     </div>
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Camada 2: Aprendizados</span>
                     <span className="text-5xl font-black text-zinc-900 tracking-tighter">{learnings.length}</span>
                     <span className="text-[11px] text-zinc-500 font-bold mt-2 uppercase tracking-wide">Fatos Consolidados</span>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-10 flex flex-col items-center text-center shadow-2xl transition-all group border-b-4 border-b-amber-500">
                     <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mb-6 border border-zinc-700">
                        <Workflow className="w-8 h-8 text-amber-500" />
                     </div>
                     <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Camada 3: Raciocínios</span>
                     <span className="text-5xl font-black text-white tracking-tighter">{reasonings.length}</span>
                     <span className="text-[11px] text-zinc-400 font-bold mt-2 uppercase tracking-wide">Conclusões Profundas</span>
                  </div>
                  <div className="bg-white border border-zinc-100 rounded-[2.5rem] p-10 flex flex-col items-center text-center shadow-sm hover:shadow-2xl transition-all group border-b-4 border-b-emerald-500">
                     <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 border border-emerald-100">
                        <ShieldCheck className="w-8 h-8 text-emerald-600" />
                     </div>
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Integridade</span>
                     <span className="text-5xl font-black text-zinc-900 tracking-tighter">98%</span>
                     <span className="text-[11px] text-zinc-500 font-bold mt-2 uppercase tracking-wide">Consistência</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                   <ImportLearningsButton ctx={ctx} />
                   <button 
                     onClick={handleRunReasoning} 
                     disabled={isProcessingReasoning}
                     className="px-6 py-4 bg-zinc-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center gap-2 shadow-xl"
                   >
                     {isProcessingReasoning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                     Executar Fase 3
                   </button>
                </div>

                {/* Cognitive Flow Visualization */}
                <div className="relative py-12 px-6 bg-zinc-50 rounded-[4rem] border border-zinc-200 overflow-hidden">
                   <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                      <Binary className="w-full h-full rotate-12 scale-150" />
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center relative z-10">
                      <div className="flex flex-col items-center text-center group">
                         <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl border border-zinc-100 mb-4 group-hover:scale-110 transition-transform">
                            <MessageSquare className="w-10 h-10 text-rose-500" />
                         </div>
                         <h4 className="text-lg font-black text-zinc-900 uppercase">Input</h4>
                         <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Memórias Brutas</p>
                         <p className="text-xs text-zinc-500 mt-2 italic px-4">Raw sensory data from user interactions and external logs.</p>
                      </div>

                      <div className="hidden md:flex justify-center">
                         <ArrowRight className="w-8 h-8 text-zinc-300 animate-pulse" />
                      </div>

                      <div className="flex flex-col items-center text-center group">
                         <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl border border-zinc-100 mb-4 group-hover:scale-110 transition-transform">
                            <Brain className="w-10 h-10 text-indigo-500" />
                         </div>
                         <h4 className="text-lg font-black text-zinc-900 uppercase">Knowledge</h4>
                         <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Aprendizados Consolidados</p>
                         <p className="text-xs text-zinc-500 mt-2 italic px-4">Curated facts, rules, and empirical observations (V2).</p>
                      </div>

                      <div className="hidden md:flex justify-center">
                         <ArrowRight className="w-8 h-8 text-zinc-300 animate-pulse" />
                      </div>

                      <div className="flex flex-col items-center text-center group">
                         <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center shadow-xl mb-4 group-hover:scale-110 transition-transform">
                            <Zap className="w-10 h-10 text-amber-500" />
                         </div>
                         <h4 className="text-lg font-black text-zinc-900 uppercase">Wisdom</h4>
                         <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Raciocínios Profundos</p>
                         <p className="text-xs text-zinc-500 mt-2 italic px-4">Strategic cross-learning conclusions and behavioral insights.</p>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 rounded-[3.5rem] p-12 text-white relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:scale-110 transition-transform duration-1000">
                        <Workflow className="w-64 h-64" />
                      </div>
                      <h3 className="text-3xl font-black tracking-tight mb-4 relative z-10">Neural Reasoning Engine</h3>
                      <p className="text-indigo-200/70 font-medium mb-10 relative z-10 max-w-md leading-relaxed text-lg">
                        Transforme aprendizados isolados em raciocínios estratégicos profundos. A Tona opera com base em conclusões interpretativas, não apenas dados brutos.
                      </p>
                      <div className="flex gap-4 relative z-10">
                        <button 
                          onClick={() => setActiveTab('reasonings')}
                          className="bg-white text-indigo-950 px-8 py-4 rounded-[1.25rem] font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
                        >
                          Explorar Raciocínios
                        </button>
                        <button 
                          onClick={handleRunReasoning}
                          disabled={isProcessingReasoning}
                          className="bg-indigo-700/50 text-indigo-100 border border-indigo-500/30 px-8 py-4 rounded-[1.25rem] font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 transition-all flex items-center gap-2"
                        >
                          {isProcessingReasoning ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                          Executar Fase 3
                        </button>
                      </div>
                   </div>

                   <div className="bg-zinc-100 border border-zinc-200 rounded-[3.5rem] p-12 flex flex-col justify-center gap-8 relative overflow-hidden">
                      <div className="absolute -bottom-10 -right-10 opacity-[0.03]">
                        <Settings2 className="w-80 h-80" />
                      </div>
                      <div>
                        <h3 className="text-3xl font-black text-zinc-900 tracking-tight mb-3">Health Cognitive Score</h3>
                        <p className="text-zinc-500 font-medium text-base mb-8 max-w-sm italic">Status vital do cérebro central baseado em alinhamento, contradição e densidade de conhecimento.</p>
                        <div className="grid grid-cols-2 gap-10">
                           <div>
                              <div className="flex justify-between items-end mb-2">
                                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Alinhamento Base</span>
                                <span className="text-xl font-black text-emerald-500">96%</span>
                              </div>
                              <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-[96%]" />
                              </div>
                           </div>
                           <div>
                              <div className="flex justify-between items-end mb-2">
                                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Contradição Interna</span>
                                <span className="text-xl font-black text-rose-500">4%</span>
                              </div>
                              <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-500 w-[4%]" />
                              </div>
                           </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveTab('config')}
                        className="w-full bg-white border border-zinc-200 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-all shadow-sm"
                      >
                        Ajustar Parâmetros da Arquitetura
                      </button>
                   </div>
                </div>

                <div className="bg-white border border-zinc-100 rounded-[3rem] p-10 shadow-sm">
                   <div className="flex items-center justify-between mb-8">
                     <h3 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                        <History className="w-6 h-6 text-zinc-300" /> Atividade Sensorial Recente
                     </h3>
                     <button onClick={() => setActiveTab('logs')} className="text-[10px] font-black uppercase text-indigo-600 hover:underline">Ver Trilha Completa</button>
                   </div>
                   <div className="space-y-4">
                      {logs.slice(0, 5).map(log => (
                        <div key={log.id} className="flex items-center justify-between p-5 bg-zinc-50 border border-zinc-100 rounded-[1.75rem] hover:border-zinc-300 transition-all">
                           <div className="flex items-center gap-4">
                              <div className="w-11 h-11 bg-white rounded-xl border border-zinc-200 flex items-center justify-center">
                                 <ScanEye className="w-5 h-5 text-zinc-400" />
                              </div>
                              <div>
                                 <p className="text-sm font-bold text-zinc-800 line-clamp-1 italic">"{log.query_text}"</p>
                                 <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">{formatDate(log.created_at)}</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-3">
                              <span className="px-3 py-1 bg-white border border-zinc-200 rounded-full text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                {log.learnings_retrieved?.length || 0} hits
                              </span>
                              <div className="w-8 h-8 rounded-lg bg-zinc-200 flex items-center justify-center hover:bg-zinc-900 hover:text-white transition-all cursor-pointer">
                                 <ArrowRight className="w-4 h-4" />
                              </div>
                           </div>
                        </div>
                      ))}
                      {logs.length === 0 && (
                        <div className="py-20 text-center text-zinc-300 font-medium italic">Nenhum evento sensorial registrado.</div>
                      )}
                   </div>
                </div>
              </div>
            )}

            {/* TAB IMPLEMENTATIONS REDIRECT */}
            {activeTab === 'candidates' && (
              <div className="space-y-8">
                 <div className="bg-amber-50 border border-amber-100 rounded-[3rem] p-12 flex flex-col md:flex-row items-center gap-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-5">
                       <GraduationCap className="w-64 h-64 text-amber-900" />
                    </div>
                    <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-amber-200 border-2 border-amber-100 shrink-0 relative z-10">
                       <Sparkles className="w-12 h-12 text-amber-500" />
                    </div>
                    <div className="relative z-10">
                       <h3 className="text-3xl font-black text-amber-900 tracking-tight mb-2">Câmara de Triagem Cognitiva</h3>
                       <p className="text-amber-800/70 font-medium text-lg italic max-w-2xl leading-relaxed">
                          Consolide novos fragmentos de conhecimento extraídos. 
                          Estes candidatos aguardam revisão humana para serem integrados permanentemente ao cérebro da Tona.
                       </p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {candidates.length === 0 ? (
                      <div className="col-span-full py-40 text-center border-2 border-dashed border-zinc-100 rounded-[4rem]">
                         <CheckCircle2 className="w-20 h-20 text-emerald-100 mx-auto mb-6" />
                         <h4 className="text-zinc-300 font-black uppercase text-sm tracking-[0.3em]">Rede Neural Sincronizada</h4>
                         <p className="text-zinc-400 mt-2 font-medium italic">Todos os candidatos foram devidamente processados.</p>
                      </div>
                    ) : (
                      candidates.map(item => (
                        <div key={item.id} className="bg-white border border-zinc-100 rounded-[3rem] p-10 flex flex-col hover:shadow-2xl hover:border-zinc-300 transition-all group overflow-hidden relative">
                           <div className="flex justify-between items-start mb-8">
                              <div className="flex flex-wrap gap-2">
                                <span className="px-4 py-1.5 bg-zinc-900 text-white rounded-full text-[9px] font-black uppercase tracking-widest">
                                  {item.suggested_classification || 'aprendizado'}
                                </span>
                                <span className="px-4 py-1.5 bg-zinc-100 text-zinc-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-zinc-200">
                                  {item.source_type}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest block mb-1">Confiança</span>
                                <span className={cn(
                                  "text-2xl font-black",
                                  item.confidence_score > 0.85 ? "text-emerald-500" : "text-amber-500"
                                )}>{(item.confidence_score * 100).toFixed(0)}%</span>
                              </div>
                           </div>

                           <div className="flex-1 space-y-6">
                              <div className="relative p-6 bg-zinc-50 rounded-[2rem] border border-zinc-100 italic">
                                 <Quote className="absolute -left-3 -top-3 w-6 h-6 text-zinc-200" />
                                 <p className="text-lg font-bold text-zinc-700 leading-relaxed leading-[1.6]">"{item.extracted_learning}"</p>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                 <div>
                                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block ml-1">Tema Proposto</label>
                                    <div className="px-4 py-3 bg-zinc-50 rounded-2xl text-xs font-bold text-zinc-800 border border-zinc-100">{item.suggested_theme}</div>
                                 </div>
                                 <div>
                                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block ml-1">Subtema</label>
                                    <div className="px-4 py-3 bg-zinc-50 rounded-2xl text-xs font-bold text-zinc-800 border border-zinc-100">{item.suggested_sub_theme}</div>
                                 </div>
                              </div>
                           </div>

                           <div className="mt-10 pt-8 border-t border-zinc-50 flex gap-3">
                              <button 
                                onClick={() => handleApproveCandidate(item)}
                                className="flex-[2] bg-emerald-500 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                              >
                                <Check className="w-4 h-4" /> Consolidar
                              </button>
                              <button className="flex-1 bg-zinc-50 text-zinc-400 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all border border-zinc-100 flex items-center justify-center gap-2">
                                <X className="w-4 h-4" /> Rejeitar
                              </button>
                           </div>
                        </div>
                      ))
                    )}
                 </div>
              </div>
            )}

            {/* LEARNINGS LIST TABS */}
            {(activeTab === 'learnings' || activeTab === 'base' || activeTab === 'acquired') && (
              <div className="space-y-8">
                 <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-6 rounded-[2.5rem] border border-zinc-100 shadow-sm">
                    <div className="flex-1 relative w-full">
                       <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                       <input 
                         type="text" 
                         placeholder="Pesquisar consciência consolidada..."
                         value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                         className="w-full pl-14 pr-6 py-4 bg-zinc-50 border-none rounded-[1.5rem] text-sm font-medium focus:ring-2 focus:ring-zinc-900 transition-all shadow-inner"
                       />
                    </div>
                    <div className="flex items-center gap-3">
                       <ImportLearningsButton ctx={ctx} variant="secondary" />
                       <select 
                         value={filterClassification}
                         onChange={(e) => setFilterClassification(e.target.value)}
                         className="bg-white border border-zinc-200 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest py-4 px-6 focus:ring-2 focus:ring-zinc-900 outline-none"
                       >
                         <option value="all">Todas Classificações</option>
                         {['fato', 'hipótese', 'evidência', 'decisão', 'risco', 'pendência', 'preferência', 'aprendizado', 'instrução', 'contexto'].map(c => (
                           <option key={c} value={c}>{c}</option>
                         ))}
                       </select>
                       <button 
                         onClick={() => setIsAddModalOpen(true)}
                         className="w-14 h-14 bg-zinc-900 text-white rounded-[1.25rem] flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
                       >
                         <Plus className="w-6 h-6" />
                       </button>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 gap-6">
                    {filteredLearnings.length === 0 ? (
                      <div className="py-40 text-center border-2 border-dashed border-zinc-100 rounded-[4rem]">
                        <Database className="w-20 h-20 mx-auto text-zinc-100 mb-6" />
                        <h4 className="text-zinc-300 font-black uppercase text-sm tracking-[0.3em]">Cérebro Limpo</h4>
                        <p className="text-zinc-400 mt-2 font-medium italic">Nenhum aprendizado ativo encontrado com estes filtros.</p>
                      </div>
                    ) : (
                      filteredLearnings.map(item => (
                        <div key={item.id} className="bg-white border border-zinc-100 rounded-[3rem] p-10 hover:shadow-2xl hover:border-zinc-300 transition-all group overflow-hidden relative">
                           {/* BG Pattern */}
                           <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:opacity-[0.06] transition-opacity">
                              {item.learning_type === 'Base' ? <ShieldCheck className="w-40 h-40" /> : <Brain className="w-40 h-40" />}
                           </div>

                           <div className="flex flex-col lg:flex-row gap-10 relative z-10">
                              <div className={cn(
                                "w-20 h-20 rounded-[1.75rem] flex items-center justify-center shrink-0 border-2 shadow-2xl",
                                item.learning_type === 'Base' ? "bg-indigo-50 border-indigo-100 text-indigo-600 shadow-indigo-100" : "bg-emerald-50 border-emerald-100 text-emerald-600 shadow-emerald-100"
                              )}>
                                 {item.learning_type === 'Base' ? <ShieldCheck className="w-10 h-10" /> : <Brain className="w-10 h-10" />}
                              </div>

                              <div className="flex-1 min-w-0">
                                 <div className="flex flex-wrap items-center gap-2 mb-4">
                                    <span className={cn(
                                      "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                                      item.learning_type === 'Base' ? "bg-indigo-600 text-white" : "bg-emerald-600 text-white"
                                    )}>{item.learning_type}</span>
                                    <span className="px-4 py-1.5 bg-zinc-100 text-zinc-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-zinc-200">{item.classification}</span>
                                    <span className="px-4 py-1.5 bg-zinc-50 text-zinc-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-zinc-100">{item.theme}</span>
                                    {item.source_type === 'csv_import' && (
                                       <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100 flex items-center gap-1">
                                          <Upload className="w-3 h-3" /> Importada via CSV
                                       </span>
                                    )}
                                    {item.is_verified && <div className="flex items-center gap-1.5 text-[9px] font-black text-indigo-500 uppercase tracking-widest ml-2"><CheckCircle2 className="w-3.5 h-3.5" /> Verificado pela Curadoria</div>}
                                 </div>

                                 <h4 className="text-2xl font-black text-zinc-900 mb-6 tracking-tight group-hover:translate-x-2 transition-transform duration-500 uppercase">{item.title || "Sem Título"}</h4>
                                 
                                 <div className="relative p-8 bg-zinc-50 rounded-[2.5rem] border border-zinc-100/50 mb-8 overflow-hidden group-hover:bg-white transition-colors duration-500 shadow-inner">
                                    <Quote className="absolute -left-2 -top-2 w-8 h-8 text-zinc-200/50" />
                                    <p className="text-[15px] text-zinc-700 font-bold leading-[1.7] italic pl-6 border-l-4 border-zinc-100 group-hover:border-indigo-500 transition-all duration-500">{item.learning}</p>
                                 </div>

                                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 pt-8 border-t border-zinc-50">
                                    <div className="flex items-center gap-3">
                                       <Activity className="w-4 h-4 text-zinc-300" />
                                       <div className="flex flex-col">
                                          <span className="text-[8px] font-black uppercase text-zinc-400 tracking-tighter">Confiança IA</span>
                                          <span className="text-sm font-black text-zinc-800">{(item.confidence_score * 100).toFixed(0)}%</span>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                       <Database className="w-4 h-4 text-zinc-300" />
                                       <div className="flex flex-col">
                                          <span className="text-[8px] font-black uppercase text-zinc-400 tracking-tighter">Usos Sistêmicos</span>
                                          <span className="text-sm font-black text-zinc-800">{item.usage_count}</span>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                       <Clock className="w-4 h-4 text-zinc-300" />
                                       <div className="flex flex-col">
                                          <span className="text-[8px] font-black uppercase text-zinc-400 tracking-tighter">Data de Registro</span>
                                          <span className="text-sm font-black text-zinc-800">{item.learning_date}</span>
                                       </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                       <button className="w-11 h-11 bg-zinc-50 text-zinc-400 rounded-xl hover:bg-zinc-900 hover:text-white transition-all flex items-center justify-center border border-zinc-100"><Edit3 className="w-5 h-5" /></button>
                                       <button className="w-11 h-11 bg-zinc-50 text-zinc-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center border border-zinc-100"><Trash2 className="w-5 h-5" /></button>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>
                      ))
                    )}
                 </div>
              </div>
            )}

            {/* CONFLICTS REDIRECT */}
            {activeTab === 'conflicts' && (
              <MindflowConflictsSection />
            )}

            {/* USER MEMORIES REDIRECT */}
            {activeTab === 'user_memories' && (
              <MindflowInteractionsSection />
            )}

            {/* USERS REDIRECT */}
            {activeTab === 'users' && (
              <MindflowBehavioralSection ctx={ctx} />
            )}

            {/* REASONINGS TABLE */}
            {activeTab === 'reasonings' && (
              <div className="space-y-8">
                <div className="bg-indigo-900 border border-indigo-800 rounded-[3rem] p-12 flex flex-col md:flex-row items-center gap-10 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-10 opacity-5">
                      <Workflow className="w-64 h-64 text-white" />
                   </div>
                   <div className="w-24 h-24 bg-white/10 rounded-[2rem] flex items-center justify-center shadow-2xl backdrop-blur-xl border border-white/20 shrink-0 relative z-10">
                      <Workflow className="w-12 h-12 text-indigo-300" />
                   </div>
                   <div className="relative z-10 text-white">
                      <h3 className="text-3xl font-black tracking-tight mb-2 uppercase">Raciocínios Profundos (Fase 3)</h3>
                      <p className="text-indigo-200/70 font-medium text-lg italic max-w-2xl leading-relaxed">
                         Conclusões de alto nível geradas pela síntese de múltiplos aprendizados. 
                         A Tona utiliza estes raciocínios para tomadas de decisão estratégica e comportamento adaptativo.
                      </p>
                   </div>
                   <button 
                     onClick={handleRunReasoning}
                     disabled={isProcessingReasoning}
                     className="ml-auto bg-white text-indigo-900 px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:scale-105 active:scale-95 transition-all relative z-10 flex items-center gap-2"
                   >
                     {isProcessingReasoning ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                     Gerar Insights Agora
                   </button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {reasonings.length === 0 ? (
                    <div className="py-40 text-center border-2 border-dashed border-zinc-100 rounded-[4rem]">
                       <Zap className="w-20 h-20 text-indigo-100 mx-auto mb-6" />
                       <h4 className="text-zinc-300 font-black uppercase text-sm tracking-[0.3em]">Nenhum Raciocínio Gerado</h4>
                       <p className="text-zinc-400 mt-2 font-medium italic">Execute a Fase 3 para processar a base de aprendizados.</p>
                    </div>
                  ) : (
                    reasonings.map(reason => (
                      <div key={reason.id} className="bg-white border border-zinc-100 rounded-[3rem] p-10 hover:shadow-2xl hover:border-indigo-200 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-[0.03]">
                           <Workflow className="w-40 h-40" />
                        </div>

                        <div className="flex flex-col lg:flex-row gap-10 relative z-10">
                           <div className="w-20 h-20 bg-zinc-900 rounded-[1.75rem] flex items-center justify-center shrink-0 border-2 border-zinc-800 shadow-2xl text-amber-500">
                             <Workflow className="w-10 h-10" />
                           </div>

                           <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-4">
                                <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest">{reason.reasoning_type}</span>
                                <span className="px-4 py-1.5 bg-zinc-100 text-zinc-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-zinc-200">{reason.abstraction_level}</span>
                                <span className="px-4 py-1.5 bg-zinc-800 text-zinc-300 rounded-full text-[9px] font-black uppercase tracking-widest border border-zinc-700">{reason.theme}</span>
                                <span className={cn(
                                  "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                                  reason.priority === 'critical' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                                )}>{reason.priority} priority</span>
                              </div>

                              <h4 className="text-2xl font-black text-zinc-900 mb-6 tracking-tight uppercase">{reason.title}</h4>
                              
                              <p className="text-lg text-zinc-600 font-medium italic mb-8 leading-relaxed">"{reason.reasoning}"</p>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-zinc-50 rounded-[2.5rem] border border-zinc-100">
                                 <div>
                                    <h5 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Target className="w-4 h-4" /> Por que isso importa?</h5>
                                    <p className="text-sm font-bold text-zinc-800">{reason.why_it_matters}</p>
                                 </div>
                                 <div>
                                    <h5 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Database className="w-4 h-4" /> Base de Aprendizado ({reason.source_learning_ids?.length || 0})</h5>
                                    <div className="flex flex-wrap gap-2">
                                       {reason.source_learning_ids?.slice(0, 3).map(id => (
                                          <span key={id} className="px-2 py-1 bg-white border border-zinc-200 rounded-lg text-[8px] font-bold text-zinc-400 truncate max-w-[120px]">REF: {id.slice(0, 8)}</span>
                                       ))}
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* CONTEXTS REDIRECT */}
            {activeTab === 'contexts' && (
              <MindflowContextsSection />
            )}

            {/* IMPORT JOBS */}
            {activeTab === 'import' && (
              <div className="space-y-8">
                 <div className="bg-zinc-100 border border-zinc-200 rounded-[3rem] p-12 flex flex-col md:flex-row items-center gap-10">
                    <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center shadow-xl border border-zinc-200 shrink-0">
                       <History className="w-12 h-12 text-zinc-400" />
                    </div>
                    <div className="flex-1">
                       <h3 className="text-3xl font-black text-zinc-900 tracking-tight mb-2">Histórico de Importação</h3>
                       <p className="text-zinc-500 font-medium text-lg italic max-w-2xl leading-relaxed">
                          Audite todas as sincronizações de conhecimento realizadas via CSV. 
                          Acompanhe sucessos, avisos e falhas de cada lote processado.
                       </p>
                    </div>
                    <ImportLearningsButton ctx={ctx} />
                 </div>

                 <div className="bg-white border border-zinc-100 rounded-[3rem] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="bg-zinc-50/50">
                             <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Data / Status</th>
                             <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Arquivo</th>
                             <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Volume</th>
                             <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-400 tracking-widest text-right">Resultado</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-zinc-50">
                          {importJobs.map(job => (
                            <tr key={job.id} className="hover:bg-zinc-50/30 transition-all group">
                               <td className="px-8 py-8">
                                  <div className="flex flex-col gap-1">
                                     <span className="text-[11px] font-black text-zinc-900">{formatDate(job.created_at)}</span>
                                     <div className="flex items-center gap-2">
                                        <div className={cn(
                                          "w-2 h-2 rounded-full",
                                          job.status === 'completed' ? "bg-emerald-500" : 
                                          job.status === 'completed_with_warnings' ? "bg-amber-500" :
                                          job.status === 'failed' ? "bg-rose-500" : "bg-indigo-500 animate-pulse"
                                        )} />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{job.status}</span>
                                     </div>
                                  </div>
                               </td>
                               <td className="px-8 py-8">
                                  <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-400 border border-zinc-100 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                                        <FileText className="w-5 h-5" />
                                     </div>
                                     <div>
                                        <p className="text-sm font-bold text-zinc-800 line-clamp-1">{job.file_name}</p>
                                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{(job.file_size_bytes / 1024).toFixed(1)} KB</p>
                                     </div>
                                  </div>
                               </td>
                               <td className="px-8 py-8">
                                  <div className="flex items-center gap-6">
                                     <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Total</span>
                                        <span className="text-lg font-black text-zinc-900">{job.total_rows}</span>
                                     </div>
                                     <div className="flex flex-col border-l border-zinc-100 pl-6">
                                        <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Base</span>
                                        <span className="text-lg font-black text-indigo-600">{job.base_rows}</span>
                                     </div>
                                     <div className="flex flex-col border-l border-zinc-100 pl-6">
                                        <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Adquirida</span>
                                        <span className="text-lg font-black text-emerald-600">{job.acquired_rows}</span>
                                     </div>
                                  </div>
                               </td>
                               <td className="px-8 py-8 text-right">
                                  <div className="flex flex-col items-end gap-1">
                                     <span className="text-lg font-black text-emerald-500">+{job.imported_rows}</span>
                                     {job.error_rows > 0 && <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">{job.error_rows} falhas</span>}
                                     {job.duplicate_rows > 0 && <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">{job.duplicate_rows} duplicadas</span>}
                                  </div>
                               </td>
                            </tr>
                          ))}
                          {importJobs.length === 0 && (
                            <tr>
                               <td colSpan={4} className="py-20 text-center text-zinc-300 font-medium italic">Nenhum histórico de importação encontrado.</td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
            )}

            {activeTab === 'config' && (
              <div className="space-y-10">
                <div className="bg-white border border-zinc-100 rounded-[3rem] p-12 shadow-sm relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-12 opacity-[0.03]">
                      <Settings2 className="w-64 h-64" />
                   </div>
                   
                   <div className="relative z-10">
                      <div className="flex items-center justify-between mb-10">
                         <div>
                            <h3 className="text-3xl font-black text-zinc-900 tracking-tight mb-2 uppercase">Configuração da Arquitetura</h3>
                            <p className="text-zinc-500 font-medium text-lg italic">Parâmetros vitais da rede neural e provedores de inteligência.</p>
                         </div>
                         <button 
                           onClick={async () => {
                              setIsCheckingHealth(true);
                              const { getLLMHealth } = await import('../../lib/geminiProxy');
                              const health = await getLLMHealth();
                              setLlmHealth(health);
                              setIsCheckingHealth(false);
                              toast.success("Diagnóstico atualizado.");
                           }}
                           className="flex items-center gap-2 px-6 py-3 bg-zinc-100 hover:bg-zinc-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-600 transition-all"
                         >
                           {isCheckingHealth ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                           Revalidar Health Check
                         </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                         {/* LLM Health Section */}
                         <div className="space-y-6">
                            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">LLM Provider Health</h4>
                            <div className={cn(
                               "p-8 rounded-[2.5rem] border transition-all",
                               llmHealth?.status === 'success' ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
                            )}>
                               <div className="flex items-center justify-between mb-6">
                                  <div className="flex items-center gap-4">
                                     <div className={cn(
                                        "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg",
                                        llmHealth?.status === 'success' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                                     )}>
                                        <Sparkles className="w-7 h-7" />
                                     </div>
                                     <div>
                                        <p className="text-xl font-black text-zinc-900">Google Gemini</p>
                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest uppercase">Model: {GEMINI_MODEL}</p>
                                     </div>
                                  </div>
                                  <div className={cn(
                                     "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm",
                                     llmHealth?.status === 'success' ? "bg-white text-emerald-600 border border-emerald-200" : "bg-white text-rose-600 border border-rose-200"
                                  )}>
                                     {llmHealth?.status || 'Unknown'}
                                  </div>
                               </div>

                               <div className="space-y-4">
                                  <div className="bg-white/50 backdrop-blur-sm p-5 rounded-2xl border border-white/50">
                                     <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Status Report</p>
                                     <p className="text-sm font-bold text-zinc-800">{llmHealth?.message || 'Iniciando diagnóstico...'}</p>
                                  </div>
                                  
                                  {llmHealth?.errorType && (
                                     <div className="bg-rose-500/10 p-5 rounded-2xl border border-rose-500/20">
                                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1 tracking-widest uppercase">Diagnostic Details</p>
                                        <p className="text-sm font-black text-rose-600">{llmHealth.errorType}</p>
                                        
                                        {(llmHealth.errorType === 'API_KEY_INVALID' || llmHealth.errorType === 'CONFIG_MISSING') && (
                                          <div className="mt-4 p-4 bg-white/50 rounded-xl space-y-3">
                                            <p className="text-[10px] font-black uppercase text-rose-700 tracking-widest">Ação Necessária (Bloqueio Crítico):</p>
                                            <p className="text-xs text-rose-600 font-bold leading-relaxed">
                                              A chave <code className="bg-rose-100 px-1 rounded text-rose-800">GEMINI_API_KEY</code> não foi detectada ou é inválida no ambiente do servidor.
                                            </p>
                                            <ol className="text-[11px] text-rose-600/80 list-decimal pl-4 space-y-2 font-medium">
                                              <li>Acesse o painel do <strong>Google AI Studio</strong>.</li>
                                              <li>Vá em <strong>Settings</strong> ou <strong>Secrets</strong>.</li>
                                              <li>Adicione/Atualize o segredo: <br/>
                                                <span className="font-mono bg-rose-100 px-1 rounded text-rose-800">Key: GEMINI_API_KEY</span><br/>
                                                <span className="font-mono bg-rose-100 px-1 rounded text-rose-800">Value: [Sua Chave API]</span>
                                              </li>
                                              <li>Reinicie ou faça o redeploy da aplicação.</li>
                                            </ol>
                                          </div>
                                        )}
                                     </div>
                                  )}

                                  <div className="flex items-center justify-between px-4">
                                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">API Configuration</span>
                                     <span className="text-xs font-mono font-black text-zinc-600">{llmHealth?.keyPreview || '********'}</span>
                                  </div>
                               </div>
                            </div>
                         </div>

                         {/* Cognitive Thresholds */}
                         <div className="space-y-6">
                            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Cognitive Thresholds</h4>
                            <div className="bg-zinc-50 p-8 rounded-[2.5rem] border border-zinc-100 space-y-8">
                               <div className="space-y-4">
                                  <div className="flex justify-between items-end">
                                     <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Auto-Saving Confidence</span>
                                     </div>
                                     <span className="text-sm font-black text-zinc-900">0.95</span>
                                  </div>
                                  <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                                     <div className="h-full bg-indigo-500 w-[95%]" />
                                  </div>
                                  <p className="text-[10px] text-zinc-400 italic">Mínimo para consolidar aprendizado sem revisão humana.</p>
                               </div>

                               <div className="space-y-4">
                                  <div className="flex justify-between items-end">
                                     <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-amber-500 rounded-full" />
                                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Retrieval Depth</span>
                                     </div>
                                     <span className="text-sm font-black text-zinc-900">40 docs</span>
                                  </div>
                                  <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                                     <div className="h-full bg-amber-500 w-[60%]" />
                                  </div>
                                  <p className="text-[10px] text-zinc-400 italic">Volume máximo de conhecimento injetado por turn.</p>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <MindflowTraceSection ctx={ctx} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Ingestion Modal V2 */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-zinc-950/70 backdrop-blur-md" onClick={() => setIsAddModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white rounded-[4rem] shadow-2xl relative w-full max-w-2xl p-12 overflow-hidden border border-zinc-200">
               <div className="flex items-center gap-5 mb-10">
                  <div className="w-16 h-16 bg-zinc-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-100">
                     <Plus className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">Injetar Conhecimento</h2>
                    <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest mt-1">Sincronização Manual Manual Neural</p>
                  </div>
               </div>

               <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Tipo de Aprendizado</label>
                        <div className="flex bg-zinc-100 p-1.5 rounded-2xl border border-zinc-200 shadow-inner">
                           <button onClick={() => setNewLearning(p => ({ ...p, learning_type: 'Base' }))} className={cn("flex-1 py-3 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all", newLearning.learning_type === 'Base' ? "bg-white text-zinc-900 shadow-md" : "text-zinc-400")}>Diretriz (Base)</button>
                           <button onClick={() => setNewLearning(p => ({ ...p, learning_type: 'Adquirida' }))} className={cn("flex-1 py-3 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all", newLearning.learning_type === 'Adquirida' ? "bg-white text-zinc-900 shadow-md" : "text-zinc-400")}>Empírico</button>
                        </div>
                     </div>
                     <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Classificação</label>
                        <select value={newLearning.classification} onChange={e => setNewLearning(p => ({ ...p, classification: e.target.value as any }))} className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl py-4 px-5 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-mono">
                           {['fato', 'hipótese', 'evidência', 'decisão', 'risco', 'pendência', 'preferência', 'aprendizado', 'instrução', 'contexto'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Tema Estrutural</label>
                        <input type="text" placeholder="Ex: Onboarding, Checkout..." value={newLearning.theme} onChange={e => setNewLearning(p => ({ ...p, theme: e.target.value }))} className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl py-4 px-6 text-sm font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all" />
                     </div>
                     <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Subtema (Contexto)</label>
                        <input type="text" placeholder="Ex: Erro de Login..." value={newLearning.sub_theme} onChange={e => setNewLearning(p => ({ ...p, sub_theme: e.target.value }))} className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl py-4 px-6 text-sm font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all" />
                     </div>
                  </div>

                  <div className="space-y-3">
                     <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Conteúdo do Aprendizado</label>
                     <textarea placeholder="Insira o conhecimento de forma atômica e clara..." value={newLearning.learning} onChange={e => setNewLearning(p => ({ ...p, learning: e.target.value }))} className="w-full bg-zinc-50 border border-zinc-100 rounded-[2.5rem] py-6 px-8 text-base font-bold placeholder:italic outline-none focus:ring-2 focus:ring-zinc-900 transition-all min-h-[160px] resize-none leading-relaxed" />
                  </div>
               </div>

               <div className="mt-12 flex gap-4">
                  <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-5 rounded-[1.75rem] bg-zinc-100 text-zinc-500 text-[11px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">Descartar</button>
                  <button onClick={handleCreateManualLearning} className="flex-[2] py-5 rounded-[1.75rem] bg-zinc-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-2xl shadow-zinc-300 hover:scale-[1.02] active:scale-[0.98]">Injetar Conhecimento</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
