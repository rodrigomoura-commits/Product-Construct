import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  ChevronRight, 
  Brain, 
  Database, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Archive, 
  Zap,
  MoreVertical,
  Activity,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Layers,
  Split,
  History,
  Lock,
  ChevronDown,
  LayoutGrid,
  List
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, 
  orderBy, limit, doc, updateDoc,
  serverTimestamp, getDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  MindflowConflict, 
  MindflowConflictGroup, 
  MindflowLearning 
} from '../../types';
import { cn, formatDate } from '../../lib/utils';
import { safeText } from '../../lib/safeText';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { detectMindflowConflicts, resolveMindflowConflictGroup } from '../../lib/mindflowConflicts';

function LearningDetailCard({ id }: { id: string }) {
  const [learning, setLearning] = useState<MindflowLearning | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLearning = async () => {
      try {
        const snap = await getDoc(doc(db, 'mindflow_learnings', id));
        if (snap.exists()) {
          const raw = snap.data();
          setLearning({ 
            id: snap.id, 
            ...raw,
            learning: safeText(raw.learning),
            theme: safeText(raw.theme),
            classification: safeText(raw.classification) as any,
            learning_type: safeText(raw.learning_type) as any
          } as MindflowLearning);
        }
      } catch (error: any) {
        console.error("[LearningDetailCard] Failed to fetch learning:", error);
        setLearning(null);
      } finally {
        setLoading(false);
      }
    };
    fetchLearning();
  }, [id]);

  if (loading) return <div className="h-40 bg-zinc-100 animate-pulse rounded-3xl" />;
  if (!learning) return null;

  return (
    <div className="bg-white border border-zinc-200 rounded-[2.5rem] p-8 shadow-sm">
       <div className="flex items-center justify-between mb-4">
          <span className={cn(
            "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
            learning.learning_type === 'Base' ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
          )}>
            {learning.learning_type}
          </span>
          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
            Confiança: {(learning.confidence_score * 100).toFixed(0)}%
          </span>
       </div>
       <p className="text-zinc-800 font-bold italic leading-relaxed">"{learning.learning}"</p>
       <div className="mt-4 pt-4 border-t border-zinc-50 flex items-center gap-2">
          <Brain className="w-3 h-3 text-zinc-400" />
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{learning.theme} / {learning.classification}</span>
       </div>
    </div>
  );
}

export default function MindflowConflictsSection() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'groups' | 'individual'>('groups');
  const [groups, setGroups] = useState<MindflowConflictGroup[]>([]);
  const [conflicts, setConflicts] = useState<MindflowConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState<MindflowConflictGroup | null>(null);
  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);
  const [resolutionAction, setResolutionAction] = useState<any>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [error, setError] = useState<{ message: string, code?: string, path?: string } | null>(null);

  useEffect(() => {
    const qGroups = query(
      collection(db, 'mindflow_conflict_groups'), 
      where('status', 'in', ['open', 'in_review']),
      orderBy('created_at', 'desc'),
      limit(50)
    );
    
    const unsubGroups = onSnapshot(qGroups, (snap) => {
      setGroups(snap.docs.map(d => {
        const raw = d.data();
        return { 
          id: d.id, 
          ...raw,
          title: safeText(raw.title),
          summary: safeText(raw.summary),
          group_reason: safeText(raw.group_reason)
        } as MindflowConflictGroup;
      }));
      setLoading(false);
    }, (error) => {
      console.error("[ConflictsSection] Failed to load conflict groups:", error);
      setLoading(false);
      setError({
        message: error?.message || String(error),
        code: (error as any)?.code,
        path: 'mindflow_conflict_groups'
      });
    });

    const qConflicts = query(
      collection(db, 'mindflow_conflicts'),
      where('status', '==', 'open'),
      orderBy('detected_at', 'desc'),
      limit(100)
    );

    const unsubConflicts = onSnapshot(qConflicts, (snap) => {
      setConflicts(snap.docs.map(d => {
        const raw = d.data();
        return { 
          id: d.id, 
          ...raw,
          title: safeText(raw.title),
          summary: safeText(raw.summary)
        } as MindflowConflict;
      }));
    }, (error) => {
      console.error("[ConflictsSection] Failed to load conflicts:", error);
      setError({
        message: error?.message || String(error),
        code: (error as any)?.code,
        path: 'mindflow_conflicts'
      });
    });

    return () => {
      unsubGroups();
      unsubConflicts();
    };
  }, []);

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setSyncProgress(prev => (prev < 95 ? prev + Math.random() * 2 : prev));
      }, 400);
      return () => clearInterval(interval);
    } else {
      setSyncProgress(100);
    }
  }, [loading]);

  const handleDetectConflicts = async () => {
    setIsDetecting(true);
    setDetectionProgress(0);
    try {
      const result = await detectMindflowConflicts((p) => setDetectionProgress(p));
      toast.success(`Detectados ${result.conflicts_detected} conflitos. Criados ${result.groups_created} grupos.`);
    } catch (e) {
      toast.error("Erro ao detectar conflitos.");
      console.error(e);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedGroup || !resolutionAction || !user) return;

    try {
      await resolveMindflowConflictGroup({
        conflictGroupId: selectedGroup.id,
        actionId: resolutionAction.action_id,
        resolutionNotes,
        userId: user.uid
      });
      toast.success("Conflito resolvido com sucesso!");
      setIsResolutionModalOpen(false);
      setSelectedGroup(null);
      setResolutionNotes('');
    } catch (e) {
      toast.error("Erro ao resolver conflito.");
      console.error(e);
    }
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-6 bg-rose-50 border border-rose-100 rounded-[2rem] flex gap-4">
          <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <p className="text-xs font-black text-rose-900 uppercase tracking-widest">Falha de Dados: {error.path}</p>
            <p className="text-sm text-rose-700 mt-1 font-medium italic">{error.message}</p>
            {error.code === 'permission-denied' && (
              <p className="text-[11px] text-rose-600 font-bold mt-2">Acesso Negado. Verifique se o usuário tem privilégios administrativos.</p>
            )}
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-rose-300 hover:text-rose-500">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Progress Bar Container */}
      {(loading || isDetecting) && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="fixed top-0 left-0 right-0 z-[100] h-2 bg-zinc-900/10 backdrop-blur-sm shadow-inner"
        >
          <motion.div 
            className="h-full bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,1)]"
            initial={{ width: 0 }}
            animate={{ width: `${isDetecting ? detectionProgress : syncProgress}%` }}
            transition={{ type: 'spring', damping: 25, stiffness: 80 }}
          />
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-2 rounded-2xl shadow-2xl flex items-center gap-3 border border-indigo-500/30">
            <div className="relative">
              <RefreshCw className={cn("w-4 h-4 text-indigo-400", (loading || isDetecting) && "animate-spin")} />
              <div className="absolute inset-0 bg-indigo-500 blur-md opacity-20 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                {isDetecting ? 'Deep Cognitive Audit' : 'Neural Syncronization'}
              </span>
              <span className="text-[11px] font-mono font-bold text-indigo-300">
                {isDetecting ? `Processando Heurísticas... ${Math.floor(detectionProgress)}%` : `Carregando Central... ${Math.floor(syncProgress)}%`}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200 shadow-inner">
          <button 
            onClick={() => setViewMode('groups')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              viewMode === 'groups' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            <LayoutGrid className="w-4 h-4" /> Grupos de Conflitos
          </button>
          <button 
            onClick={() => setViewMode('individual')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              viewMode === 'individual' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            <List className="w-4 h-4" /> Conflitos Individuais
          </button>
        </div>

        <button 
          onClick={handleDetectConflicts}
          disabled={isDetecting}
          className="flex items-center gap-3 px-8 py-3 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-zinc-200 disabled:opacity-50"
        >
          {isDetecting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          Detectar Conflitos Agora
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-100 p-6 rounded-[2rem] flex flex-col items-center text-center">
           <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Grupos Abertos</span>
           <span className="text-3xl font-black text-zinc-900">{groups.length}</span>
        </div>
        <div className="bg-white border border-zinc-100 p-6 rounded-[2rem] flex flex-col items-center text-center">
           <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Conflitos Totais</span>
           <span className="text-3xl font-black text-zinc-900">{conflicts.length}</span>
        </div>
        <div className="bg-white border border-rose-50 p-6 rounded-[2rem] flex flex-col items-center text-center">
           <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Críticos</span>
           <span className="text-3xl font-black text-rose-600">{groups.filter(g => g.severity === 'critical').length}</span>
        </div>
        <div className="bg-white border border-emerald-50 p-6 rounded-[2rem] flex flex-col items-center text-center">
           <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Resolvidos (Hoje)</span>
           <span className="text-3xl font-black text-emerald-600">0</span>
        </div>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {loading ? (
          <div className="py-24 text-center">
            <Activity className="w-12 h-12 text-indigo-300 animate-spin mx-auto mb-4" />
            <p className="text-zinc-400 font-black uppercase text-[10px] tracking-widest">Sincronizando Central de Conflitos...</p>
          </div>
        ) : viewMode === 'groups' ? (
          <motion.div 
            key="groups-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 gap-6"
          >
            {groups.length === 0 ? (
               <div className="py-32 text-center bg-white border border-zinc-100 rounded-[3rem] shadow-sm">
                 <CheckCircle2 className="w-20 h-20 text-emerald-100 mx-auto mb-6" />
                 <h4 className="text-xl font-black text-zinc-900 tracking-tight">Céu de Brigadeiro Cognitive</h4>
                 <p className="text-zinc-500 font-medium italic mt-2">Nenhum conflito de memória detectado no Mindflow.</p>
               </div>
            ) : (
              groups.map(group => (
                <div key={group.id} className="group bg-white border border-zinc-200 rounded-[3rem] p-10 hover:shadow-2xl hover:border-indigo-200 transition-all relative overflow-hidden">
                   <div className="flex flex-col lg:flex-row gap-10">
                      <div className="w-24 h-24 rounded-[2rem] bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        {group.severity === 'critical' ? (
                          <AlertTriangle className="w-12 h-12 text-rose-500" />
                        ) : (
                          <Layers className="w-12 h-12 text-indigo-500" />
                        )}
                      </div>
                      
                      <div className="flex-1 space-y-6">
                         <div className="flex flex-wrap items-center gap-3">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                              group.severity === 'critical' ? "bg-rose-50 text-rose-600 border-rose-100" :
                              group.severity === 'high' ? "bg-amber-50 text-amber-600 border-amber-100" :
                              "bg-indigo-50 text-indigo-600 border-indigo-100"
                            )}>
                              {group.severity} severity
                            </span>
                            <span className="px-3 py-1 bg-zinc-100 text-zinc-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-zinc-200">
                               {group.main_conflict_type}
                            </span>
                            <span className="px-3 py-1 bg-zinc-100 text-zinc-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-zinc-200">
                               {group.conflict_count} conflitos
                            </span>
                         </div>

                         <div>
                            <h3 className="text-2xl font-black text-zinc-900 tracking-tight mb-2 underline decoration-indigo-500/20">{group.title}</h3>
                            <p className="text-zinc-600 font-medium italic leading-relaxed text-lg line-clamp-2">"{group.summary}"</p>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Causa Raiz</p>
                               <p className="text-sm font-bold text-zinc-800 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">{group.group_reason}</p>
                            </div>
                            <div className="space-y-2">
                               <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Resolução Recomendada</p>
                               <p className="text-sm font-bold text-indigo-900 bg-indigo-50 p-4 rounded-2xl border border-indigo-100 italic">
                                 {group.recommended_resolution || "Aguardando análise da IA..."}
                               </p>
                            </div>
                         </div>

                         <div className="flex items-center gap-3 pt-4 border-t border-zinc-50">
                            <button 
                              onClick={() => setSelectedGroup(group)}
                              className="px-8 py-3 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-zinc-200"
                            >
                              Analisar Detalhes e Resolver
                            </button>
                            <button className="p-3 bg-zinc-100 text-zinc-400 rounded-2xl hover:bg-zinc-200 transition-all">
                              <MoreVertical className="w-5 h-5" />
                            </button>
                         </div>
                      </div>
                   </div>
                </div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="individual-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {conflicts.map(conflict => (
              <div key={conflict.id} className="bg-white border border-zinc-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center gap-6 hover:shadow-lg transition-all">
                <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center shrink-0">
                  <AlertTriangle className={cn("w-6 h-6", conflict.severity === 'critical' ? 'text-rose-500' : 'text-amber-500')} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-black text-zinc-900 tracking-tight">{conflict.title}</h4>
                  <p className="text-xs text-zinc-500 font-medium italic mt-0.5">{conflict.summary}</p>
                </div>
                <div className="flex items-center gap-4">
                   <div className="text-right">
                     <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Tipo</p>
                     <p className="text-[11px] font-bold text-zinc-700">{conflict.conflict_type}</p>
                   </div>
                   <button className="p-2.5 bg-zinc-50 text-zinc-400 rounded-xl hover:bg-zinc-100">
                     <ArrowRight className="w-4 h-4" />
                   </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawer for Details */}
      <AnimatePresence>
        {selectedGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/20 backdrop-blur-sm"
              onClick={() => setSelectedGroup(null)}
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-4xl h-full bg-white shadow-2xl relative z-10 flex flex-col overflow-hidden"
            >
               <div className="p-10 border-b border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                     <div className="w-16 h-16 bg-zinc-900 rounded-[1.5rem] flex items-center justify-center text-white">
                        <Activity className="w-8 h-8" />
                     </div>
                     <div>
                        <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Análise Neural de Conflito</h2>
                        <p className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest mt-1">ID do Grupo: {selectedGroup.id.slice(0, 12)}...</p>
                     </div>
                  </div>
                  <button 
                    onClick={() => setSelectedGroup(null)}
                    className="w-12 h-12 bg-zinc-50 text-zinc-400 rounded-2xl hover:bg-zinc-100 flex items-center justify-center transition-all"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto p-12 no-scrollbar space-y-12 bg-zinc-50/50">
                  <div className="bg-white p-10 rounded-[3rem] border border-zinc-200 shadow-sm">
                     <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-1.5">
                       <Zap className="w-4 h-4 text-amber-500" /> Resumo do Diagnóstico
                     </h3>
                     <p className="text-2xl font-black text-zinc-900 tracking-tight leading-tight mb-4">{selectedGroup.title}</p>
                     <p className="text-zinc-600 font-medium italic text-lg leading-relaxed mb-8">"{selectedGroup.summary}"</p>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-4">
                           <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Motivação do Conflito</h4>
                           <p className="text-sm font-bold text-zinc-800 bg-zinc-50 p-6 rounded-3xl border border-zinc-100 flex-1">{selectedGroup.group_reason}</p>
                        </div>
                        <div className="space-y-4">
                           <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Impacto se não resolvido</h4>
                           <p className="text-sm font-bold text-orange-900 bg-orange-50 p-6 rounded-3xl border border-orange-100 flex-1 italic text-balance">
                             Os comportamentos da AI podem tornar-se inconsistentes, gerando respostas que ignoram regras de base ou variam de forma aleatória entre preferências.
                           </p>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
                       <Database className="w-5 h-5 text-zinc-400" /> Aprendizados em Disputa
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {conflicts.filter(c => c.conflict_group_id === selectedGroup.id).flatMap(c => c.involved_memory_ids).filter((v, i, a) => a.indexOf(v) === i).map(mid => (
                         <LearningDetailCard key={mid} id={mid} />
                       ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
                       <Sparkles className="w-5 h-5 text-indigo-500" /> Ações de Resolução Sugeridas
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                       {(selectedGroup.suggested_actions || []).map((action: any) => (
                         <div 
                           key={action.action_id}
                           className={cn(
                             "group bg-white border rounded-[2rem] p-8 transition-all hover:shadow-xl cursor-pointer",
                             action.recommended ? "border-indigo-500 flex-1" : "border-zinc-200"
                           )}
                           onClick={() => {
                             setResolutionAction(action);
                             setIsResolutionModalOpen(true);
                           }}
                         >
                            <div className="flex items-center justify-between mb-4">
                               <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center",
                                    action.recommended ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-400"
                                  )}>
                                     {action.action_id === 'prioritize_base' ? <ShieldCheck className="w-5 h-5" /> :
                                      action.action_id === 'contextualize_memories' ? <Split className="w-5 h-5" /> :
                                      <RefreshCw className="w-5 h-5" />}
                                  </div>
                                  <div>
                                    <h4 className="text-lg font-black text-zinc-900 tracking-tight">{action.label}</h4>
                                    {action.recommended && <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Recomendação IA</span>}
                                  </div>
                               </div>
                               <button className="w-10 h-10 bg-zinc-50 rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                 <ArrowRight className="w-5 h-5" />
                               </button>
                            </div>
                            <p className="text-zinc-500 font-medium italic text-[13px] mb-6 leading-relaxed">{action.description}</p>
                            
                            <div className="flex flex-wrap gap-2">
                               {(action.effects || []).map((eff: string, idx: number) => (
                                 <span key={idx} className="px-3 py-1 bg-zinc-50 border border-zinc-100 rounded-full text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                   • {eff}
                                 </span>
                               ))}
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Resolution Modal */}
      <AnimatePresence>
        {isResolutionModalOpen && resolutionAction && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
               onClick={() => setIsResolutionModalOpen(false)}
             />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-[3rem] w-full max-w-2xl relative z-10 shadow-2xl flex flex-col overflow-hidden"
             >
                <div className="p-8 border-b border-zinc-100 bg-zinc-900 text-white flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                        <Lock className="w-6 h-6 text-indigo-400" />
                      </div>
                      <h3 className="text-xl font-black tracking-tight">Confirmar Resolução Cognitiva</h3>
                   </div>
                   <button onClick={() => setIsResolutionModalOpen(false)} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-white/10">
                     <XCircle className="w-5 h-5" />
                   </button>
                </div>

                <div className="p-10 space-y-8">
                   <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-[2rem]">
                      <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-3">Efeito esperado</h4>
                      <p className="text-lg font-black text-indigo-900 mb-4">{resolutionAction.label}</p>
                      <div className="space-y-2">
                        {resolutionAction.effects.map((eff: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-indigo-700/70 text-xs font-bold leading-relaxed">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-500" />
                            <span>{eff}</span>
                          </div>
                        ))}
                      </div>
                   </div>

                   <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Justificativa da Decisão (Opcional)</label>
                      <textarea 
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Descreva por que esta ação é a mais adequada para este conflito..."
                        className="w-full bg-zinc-50 border-none rounded-[1.5rem] p-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 shadow-inner min-h-[120px]"
                      />
                   </div>

                   <div className="flex items-center gap-3 pt-4">
                      <button 
                        onClick={handleResolve}
                        className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-zinc-200"
                      >
                         Confirmar e Aplicar Resolução
                      </button>
                      <button 
                        onClick={() => setIsResolutionModalOpen(false)}
                        className="px-8 py-4 bg-zinc-100 text-zinc-400 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all"
                      >
                         Cancelar
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
