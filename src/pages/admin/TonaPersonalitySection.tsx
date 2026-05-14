import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  limit, 
  doc, 
  updateDoc, 
  serverTimestamp,
  getDoc,
  setDoc,
  where
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  TonaPersonalityBase, 
  TonaUserPersonality, 
  TonaPersonalityLearningEvent 
} from '../../lib/tonaPersonality.types';
import { 
  Sparkles, 
  User, 
  Shield, 
  Brain, 
  History, 
  Settings2, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  Eye, 
  Trash2, 
  AlertCircle,
  Search,
  Filter,
  ArrowRight,
  MessageSquare,
  BarChart3,
  Fingerprint,
  Zap,
  Info,
  ChevronRight,
  UserCheck,
  TrendingUp,
  Sliders,
  Layers,
  LucideIcon,
  XCircle,
  Loader2
} from 'lucide-react';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { FALLBACK_BASE_PERSONALITY } from '../../lib/tonaPersonalityEngine';

type TabId = 'overview' | 'base' | 'users' | 'learning';

export default function TonaPersonalitySection() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [basePersonality, setBasePersonality] = useState<TonaPersonalityBase | null>(null);
  const [userPersonalities, setUserPersonalities] = useState<TonaUserPersonality[]>([]);
  const [learningEvents, setLearningEvents] = useState<TonaPersonalityLearningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditingBase, setIsEditingBase] = useState(false);
  const [editedBase, setEditedBase] = useState<TonaPersonalityBase | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubs: (() => void)[] = [];

    // 1. Base Personality
    const unsubBase = onSnapshot(doc(db, 'tona_personality_base', 'default'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as TonaPersonalityBase;
        setBasePersonality(data);
        if (!isEditingBase) setEditedBase(data);
      } else {
        setBasePersonality(FALLBACK_BASE_PERSONALITY);
        if (!isEditingBase) setEditedBase(FALLBACK_BASE_PERSONALITY);
      }
    });
    unsubs.push(unsubBase);

    // 2. User Personalities
    const unsubUsers = onSnapshot(query(collection(db, 'tona_user_personalities'), limit(50)), (snap) => {
      setUserPersonalities(snap.docs.map(d => ({ user_id: d.id, ...d.data() } as any)));
    });
    unsubs.push(unsubUsers);

    // 3. Learning Events
    const unsubLearning = onSnapshot(query(collection(db, 'tona_personality_learning_events'), orderBy('created_at', 'desc'), limit(50)), (snap) => {
      setLearningEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      setLoading(false);
    });
    unsubs.push(unsubLearning);

    return () => unsubs.forEach(unsub => unsub());
  }, []);

  const handleSaveBase = async () => {
    if (!editedBase) return;
    try {
      await setDoc(doc(db, 'tona_personality_base', 'default'), {
        ...editedBase,
        updated_at: serverTimestamp()
      });
      toast.success("Personalidade Base atualizada com sucesso!");
      setIsEditingBase(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'tona_personality_base');
    }
  };

  const tabs: { id: TabId; label: string; icon: LucideIcon; color: string }[] = [
    { id: 'overview', label: 'Dashboard', icon: BarChart3, color: 'text-indigo-600' },
    { id: 'base', label: 'Personalidade Base', icon: Shield, color: 'text-indigo-600' },
    { id: 'users', label: 'Personalização por Usuário', icon: User, color: 'text-emerald-600' },
    { id: 'learning', label: 'Centro de Aprendizado', icon: Brain, color: 'text-amber-500' },
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 bg-zinc-900 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-indigo-100">
               <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-zinc-900 tracking-tighter">Tona Personality Module</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-md text-[8px] font-black uppercase tracking-widest">Active Core</span>
                <span className="text-zinc-400 font-bold uppercase text-[9px] tracking-[0.2em]">Identity Layer V1.0</span>
              </div>
            </div>
          </div>
          <p className="text-zinc-500 font-medium text-base italic max-w-2xl leading-relaxed">
            Gerencie a identidade oficial da Tona e acompanhe sua evolução adaptativa em tempo real para cada usuário.
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
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <div className="py-40 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
            <p className="text-zinc-400 font-black uppercase text-[10px] tracking-widest">Carregando Identidade...</p>
          </div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {activeTab === 'overview' && (
              <div className="space-y-10">
                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white border border-zinc-100 rounded-[2.5rem] p-10 shadow-sm hover:shadow-xl transition-all border-b-4 border-b-indigo-500">
                    <Shield className="w-8 h-8 text-indigo-600 mb-4" />
                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Status Base</h3>
                    <div className="text-3xl font-black text-zinc-900">{basePersonality?.status || 'Offline'}</div>
                    <p className="text-[10px] text-zinc-500 font-bold mt-2 uppercase tracking-wide">Identidade Oficial Ativa</p>
                  </div>
                  <div className="bg-white border border-zinc-100 rounded-[2.5rem] p-10 shadow-sm hover:shadow-xl transition-all border-b-4 border-b-emerald-500">
                    <UserCheck className="w-8 h-8 text-emerald-600 mb-4" />
                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Perfis Adaptados</h3>
                    <div className="text-3xl font-black text-zinc-900">{userPersonalities.length}</div>
                    <p className="text-[10px] text-zinc-500 font-bold mt-2 uppercase tracking-wide">Adaptação Individual</p>
                  </div>
                  <div className="bg-white border border-zinc-100 rounded-[2.5rem] p-10 shadow-sm hover:shadow-xl transition-all border-b-4 border-b-amber-500">
                    <Brain className="w-8 h-8 text-amber-500 mb-4" />
                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Eventos Aprendidos</h3>
                    <div className="text-3xl font-black text-zinc-900">{learningEvents.length}</div>
                    <p className="text-[10px] text-zinc-500 font-bold mt-2 uppercase tracking-wide">Sinais de Estilo Detectados</p>
                  </div>
                  <div className="bg-white border border-zinc-100 rounded-[2.5rem] p-10 shadow-sm hover:shadow-xl transition-all border-b-4 border-b-rose-500">
                    <TrendingUp className="w-8 h-8 text-rose-600 mb-4" />
                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Taxa de Adaptação</h3>
                    <div className="text-3xl font-black text-zinc-900">84%</div>
                    <p className="text-[10px] text-zinc-500 font-bold mt-2 uppercase tracking-wide">Confiança Cognitiva</p>
                  </div>
                </div>

                {/* Main Visualizer */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-zinc-900 rounded-[3.5rem] p-12 text-white relative overflow-hidden group border border-zinc-800 shadow-2xl">
                    <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 group-hover:scale-[1.7] transition-transform duration-1000">
                      <Sparkles className="w-64 h-64" />
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-3xl font-black mb-4 tracking-tighter">Identity Core</h3>
                      <p className="text-zinc-400 font-medium mb-10 leading-relaxed text-lg italic">
                        "{basePersonality?.description}"
                      </p>
                      <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-12">
                         {Object.entries(basePersonality?.personality_traits || {}).slice(0, 4).map(([trait, value]: [string, any]) => (
                           <div key={trait}>
                              <div className="flex justify-between items-end mb-1">
                                <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">{trait}</span>
                                <span className="text-xs font-black text-white">{(value * 100).toFixed(0)}%</span>
                              </div>
                              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                <motion.div 
                                  className="h-full bg-indigo-500" 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${value * 100}%` }}
                                />
                              </div>
                           </div>
                         ))}
                      </div>
                      <button 
                        onClick={() => setActiveTab('base')}
                        className="px-8 py-4 bg-white text-zinc-900 rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
                      >
                        Ajustar Personalidade Base
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border border-zinc-100 rounded-[3.5rem] p-12 shadow-sm overflow-hidden relative">
                    <div className="absolute -bottom-10 -right-10 opacity-[0.03] text-zinc-900">
                      <History className="w-64 h-64" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full">
                      <h3 className="text-2xl font-black text-zinc-900 mb-3 tracking-tight">Atividade do Engine</h3>
                      <p className="text-zinc-500 font-medium text-sm italic mb-8">Últimos sinais de aprendizagem processados.</p>
                      <div className="flex-1 space-y-4 mb-8">
                        {learningEvents.slice(0, 4).map(event => (
                          <div key={event.id} className="flex items-center gap-4 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl group hover:border-zinc-300 transition-all">
                             <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-zinc-200">
                                <Zap className="w-5 h-5 text-amber-500" />
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-zinc-800 truncate italic">"{event.observed_text_sample}"</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[8px] font-black uppercase text-zinc-400 tracking-widest shrink-0">{event.event_type}</span>
                                  <div className="w-1 h-1 bg-zinc-200 rounded-full" />
                                  <span className="text-[8px] font-black uppercase text-indigo-500 tracking-widest truncate">{event.extracted_signal?.interpretation}</span>
                                </div>
                             </div>
                             <span className="text-[9px] font-black text-zinc-300 uppercase shrink-0">{formatDate(event.created_at)}</span>
                          </div>
                        ))}
                      </div>
                      <button 
                        onClick={() => setActiveTab('learning')}
                        className="w-full py-4 bg-zinc-100 text-zinc-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 hover:text-white transition-all shadow-sm"
                      >
                        Ver Centro de Aprendizado
                      </button>
                    </div>
                  </div>
                </div>

                {/* Special Profile Section */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-[3rem] p-12 flex items-center justify-between overflow-hidden relative">
                   <div className="absolute top-0 right-0 p-12 opacity-5 scale-150">
                      <Fingerprint className="w-48 h-48 text-indigo-900" />
                   </div>
                   <div className="flex items-center gap-8 relative z-10">
                      <div className="w-20 h-20 bg-white border border-indigo-100 rounded-3xl flex items-center justify-center shadow-xl">
                        <Fingerprint className="w-10 h-10 text-indigo-600" />
                      </div>
                      <div>
                        <h4 className="text-2xl font-black text-indigo-900 tracking-tight">Perfis de Elite (Alpha)</h4>
                        <p className="text-indigo-800/60 font-medium italic max-w-lg leading-relaxed">
                          Configurações manuais robustas para usuários específicos que guiam o treinamento do modelo base.
                        </p>
                      </div>
                   </div>
                   <button 
                    onClick={() => {
                        setActiveTab('users');
                        setSearchTerm('celular@rodrigomoura.net');
                    }}
                    className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 relative z-10"
                   >
                     Inspecionar Perfil Rodrigo
                   </button>
                </div>
              </div>
            )}

            {activeTab === 'base' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <div className="lg:col-span-2 space-y-8">
                   <div className="bg-white border border-zinc-100 rounded-[3.5rem] p-12 shadow-sm">
                      <div className="flex items-center justify-between mb-10">
                        <div>
                          <h3 className="text-2xl font-black text-zinc-900 tracking-tighter">Editor de Identidade</h3>
                          <p className="text-zinc-500 font-medium text-sm italic">Defina as bases inabaláveis da Tona.</p>
                        </div>
                        <div className="flex items-center gap-3">
                           {isEditingBase ? (
                             <>
                               <button 
                                 onClick={() => {
                                   setIsEditingBase(false);
                                   setEditedBase(basePersonality);
                                 }} 
                                 className="px-5 py-2.5 bg-zinc-100 text-zinc-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-200 transition-all"
                               >
                                 Cancelar
                               </button>
                               <button 
                                 onClick={handleSaveBase}
                                 className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2"
                               >
                                 <Save className="w-4 h-4" /> Salvar Identidade
                               </button>
                             </>
                           ) : (
                             <button 
                               onClick={() => setIsEditingBase(true)}
                               className="px-5 py-2.5 bg-zinc-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-lg flex items-center gap-2"
                             >
                               <Settings2 className="w-4 h-4" /> Editar Atributos
                             </button>
                           )}
                        </div>
                      </div>

                      <div className="space-y-8">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                               <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Nome Oficial</label>
                               <input 
                                 type="text" 
                                 value={editedBase?.name || ''} 
                                 disabled={!isEditingBase}
                                 onChange={e => setEditedBase(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                                 className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-60"
                               />
                            </div>
                            <div className="space-y-2">
                               <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Arquétipo</label>
                               <input 
                                 type="text" 
                                 value={editedBase?.archetype || ''} 
                                 disabled={!isEditingBase}
                                 onChange={e => setEditedBase(prev => prev ? ({ ...prev, archetype: e.target.value }) : null)}
                                 className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-60"
                               />
                            </div>
                         </div>

                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Missão Central</label>
                            <textarea 
                              value={editedBase?.core_mission || ''} 
                              disabled={!isEditingBase}
                              onChange={e => setEditedBase(prev => prev ? ({ ...prev, core_mission: e.target.value }) : null)}
                              className="w-full bg-zinc-50 border border-zinc-100 rounded-[2rem] px-6 py-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-60 min-h-[120px] resize-none leading-relaxed"
                            />
                         </div>

                         <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1 block">Traços de Personalidade</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6 p-8 bg-zinc-50 rounded-[2.5rem] border border-zinc-100">
                               {Object.entries(editedBase?.personality_traits || {}).map(([trait, value]: [string, any]) => (
                                 <div key={trait} className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{trait}</span>
                                      <span className="text-xs font-black text-indigo-600">{(value * 100).toFixed(0)}%</span>
                                    </div>
                                    <input 
                                      type="range" 
                                      min="0" max="1" step="0.05"
                                      value={value}
                                      disabled={!isEditingBase}
                                      onChange={e => {
                                        const newVal = parseFloat(e.target.value);
                                        setEditedBase(prev => prev ? ({ ...prev, personality_traits: { ...prev.personality_traits, [trait]: newVal } }) : null);
                                      }}
                                      className="w-full h-1.5 bg-zinc-200 rounded-full appearance-none cursor-pointer accent-indigo-600 disabled:cursor-not-allowed"
                                    />
                                 </div>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="bg-white border border-zinc-100 rounded-[3.5rem] p-12 shadow-sm">
                      <h3 className="text-2xl font-black text-zinc-900 tracking-tighter mb-8">Invariantes & Limites</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                         <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                               <Shield className="w-4 h-4" /> Comportamentos Proibidos
                            </h4>
                            <div className="space-y-3">
                               {editedBase?.forbidden_behaviors.map((b, idx) => (
                                 <div key={idx} className="flex items-start gap-3 p-4 bg-rose-50/30 border border-rose-100/50 rounded-2xl">
                                    <XCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                                    <span className="text-xs font-bold text-zinc-700 leading-relaxed">{b}</span>
                                 </div>
                               ))}
                            </div>
                         </div>
                         <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                               <Sparkles className="w-4 h-4" /> Princípios de Voz
                            </h4>
                            <div className="space-y-3">
                               {editedBase?.voice_principles.map((p, idx) => (
                                 <div key={idx} className="flex items-start gap-3 p-4 bg-emerald-50/30 border border-emerald-100/50 rounded-2xl">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                    <span className="text-xs font-bold text-zinc-700 leading-relaxed">{p}</span>
                                 </div>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                 </div>

                 <div className="space-y-8">
                    <div className="bg-zinc-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-8 opacity-5">
                          <Settings2 className="w-32 h-32" />
                       </div>
                       <h4 className="text-lg font-black mb-6 flex items-center gap-3">
                          <Zap className="w-5 h-5 text-amber-500" /> Runtime Engine
                       </h4>
                       <div className="space-y-6">
                           <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                              <span className="text-xs font-bold text-zinc-400">Answer First</span>
                              <div className="w-10 h-6 bg-indigo-600 rounded-full flex items-center px-1">
                                 <div className="w-4 h-4 bg-white rounded-full ml-auto shadow-sm" />
                              </div>
                           </div>
                           <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                              <span className="text-xs font-bold text-zinc-400">Deep Diagnostics</span>
                              <div className="w-10 h-6 bg-indigo-600 rounded-full flex items-center px-1">
                                 <div className="w-4 h-4 bg-white rounded-full ml-auto shadow-sm" />
                              </div>
                           </div>
                           <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                              <span className="text-xs font-bold text-zinc-400">Force Scripts</span>
                              <div className="w-10 h-6 bg-indigo-600 rounded-full flex items-center px-1">
                                 <div className="w-4 h-4 bg-white rounded-full ml-auto shadow-sm" />
                              </div>
                           </div>
                       </div>
                       <div className="mt-8 pt-8 border-t border-white/10">
                         <p className="text-[10px] text-zinc-500 font-medium italic leading-relaxed">
                           Estes parâmetros controlam o comportamento global de todas as instâncias da Tona.
                         </p>
                       </div>
                    </div>

                    <div className="bg-white border border-zinc-100 rounded-[3rem] p-10 shadow-sm">
                       <h4 className="text-lg font-black text-zinc-900 mb-6 uppercase tracking-tight">Estilo de Resposta</h4>
                       <div className="space-y-6">
                          <div>
                            <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest block mb-2">Tom Padrão</span>
                            <div className="px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-bold text-zinc-700 italic">
                               "{basePersonality?.response_style.default_tone}"
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest block mb-2">Formatos Preferidos</span>
                            <div className="flex flex-wrap gap-2">
                               {basePersonality?.response_style.preferred_formats.map(f => (
                                 <span key={f} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest">{f}</span>
                               ))}
                            </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'users' && (
               <div className="space-y-8">
                  {/* Search and Filters */}
                  <div className="bg-white border border-zinc-100 rounded-[2.5rem] p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-1 relative w-full">
                       <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                       <input 
                         type="text" 
                         placeholder="Pesquisar por email ou ID do usuário..."
                         value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                         className="w-full pl-14 pr-6 py-4 bg-zinc-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 shadow-inner"
                       />
                    </div>
                    <div className="flex items-center gap-3">
                       <button className="px-6 py-4 bg-zinc-100 text-zinc-500 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                         <Filter className="w-4 h-4" /> Filtros
                       </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     {userPersonalities.filter(up => up.user_email.toLowerCase().includes(searchTerm.toLowerCase())).map(up => (
                        <div key={up.user_id} className="bg-white border border-zinc-100 rounded-[3rem] p-10 hover:shadow-2xl hover:border-emerald-200 transition-all group overflow-hidden relative">
                           <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:scale-110 transition-transform">
                              <Fingerprint className="w-40 h-40" />
                           </div>
                           
                           <div className="flex items-start justify-between mb-8 relative z-10">
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-50">
                                   <User className="w-8 h-8" />
                                </div>
                                <div>
                                   <h4 className="text-xl font-black text-zinc-900 tracking-tight line-clamp-1">{up.user_email}</h4>
                                   <div className="flex items-center gap-2 mt-0.5">
                                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                      <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Ativo</span>
                                      <span className="text-[9px] font-black uppercase text-zinc-300 tracking-widest ml-2">ID: {up.user_id.slice(0, 12)}...</span>
                                   </div>
                                </div>
                              </div>
                              <div className="text-right">
                                 <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest block mb-1">Modelo V1.0</span>
                                 <button onClick={() => toast.error("Recalibração manual disponível em breve.")} className="p-2 bg-zinc-50 text-zinc-300 rounded-lg hover:bg-zinc-900 hover:text-white transition-all"><Sliders className="w-4 h-4" /></button>
                              </div>
                           </div>

                           <div className="space-y-8 relative z-10">
                              <div className="p-6 bg-zinc-50 rounded-[2rem] border border-zinc-100 flex flex-col gap-6">
                                 <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                                    {[
                                      { label: 'Formalidade', val: up.communication_style.formality_level },
                                      { label: 'Objetividade', val: up.communication_style.directness_level },
                                      { label: 'Exaustividade', val: up.communication_style.detail_level },
                                      { label: 'Humor', val: up.communication_style.humor_level }
                                    ].map(metric => (
                                      <div key={metric.label}>
                                         <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">{metric.label}</span>
                                            <span className="text-[10px] font-black text-zinc-900">{(metric.val * 100).toFixed(0)}%</span>
                                         </div>
                                         <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                                            <motion.div 
                                              className="h-full bg-emerald-500" 
                                              initial={{ width: 0 }}
                                              animate={{ width: `${metric.val * 100}%` }}
                                            />
                                         </div>
                                      </div>
                                    ))}
                                 </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                 <div>
                                    <h5 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                       <Layers className="w-3.5 h-3.5" /> Preferências
                                    </h5>
                                    <div className="flex flex-wrap gap-1.5">
                                       {up.communication_style.likes_answer_first && <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[8px] font-black uppercase tracking-widest border border-emerald-100">Answer First</span>}
                                       {up.communication_style.likes_scripts_ready_to_copy && <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[8px] font-black uppercase tracking-widest border border-emerald-100">Ready Scripts</span>}
                                       {up.formatting_preferences.prefers_bullets && <span className="px-2 py-1 bg-zinc-100 text-zinc-500 rounded-lg text-[8px] font-black uppercase tracking-widest border border-zinc-200">Bullets</span>}
                                    </div>
                                 </div>
                                 <div>
                                    <h5 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                       <Zap className="w-3.5 h-3.5" /> Vocabulário Chave
                                    </h5>
                                    <div className="flex flex-wrap gap-1.5">
                                       {up.vocabulary_profile.recurring_expressions.slice(0, 5).map(exp => (
                                          <span key={exp} className="px-2 py-1 bg-zinc-900 text-white rounded-lg text-[8px] font-black uppercase tracking-widest truncate max-w-[80px]">{exp}</span>
                                       ))}
                                       {up.vocabulary_profile.recurring_expressions.length === 0 && <span className="text-[10px] text-zinc-300 font-medium italic">Nenhum termo ainda.</span>}
                                    </div>
                                 </div>
                              </div>
                           </div>

                           <div className="mt-10 pt-8 border-t border-zinc-50 flex gap-3">
                              <button className="flex-1 px-4 py-3.5 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center justify-center gap-2">
                                <History className="w-4 h-4" /> Logs de Adaptação
                              </button>
                              <button 
                                onClick={async () => {
                                  if (confirm(`Tem certeza que deseja resetar a personalidade de ${up.user_email}?`)) {
                                    try {
                                      await setDoc(doc(db, 'tona_user_personalities', up.user_id), {
                                        ...up,
                                        communication_style: FALLBACK_BASE_PERSONALITY.personality_traits, // simplified reset for demo
                                        vocabulary_profile: { recurring_expressions: [] },
                                        updated_at: serverTimestamp()
                                      });
                                      toast.success("Personalidade resetada!");
                                    } catch (e) {
                                      toast.error("Erro ao resetar.");
                                    }
                                  }
                                }}
                                className="px-4 py-3.5 bg-zinc-100 text-zinc-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center gap-2 border border-zinc-100"
                              >
                                <RotateCcw className="w-4 h-4" /> Resetar
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}

            {activeTab === 'learning' && (
              <div className="space-y-8">
                 <div className="bg-amber-50 border border-amber-100 rounded-[3rem] p-12 flex flex-col md:flex-row items-center gap-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-5">
                       <Brain className="w-64 h-64 text-amber-900" />
                    </div>
                    <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-amber-200 border-2 border-amber-100 shrink-0 relative z-10">
                       <Zap className="w-12 h-12 text-amber-500" />
                    </div>
                    <div className="relative z-10">
                       <h3 className="text-3xl font-black text-amber-900 tracking-tight mb-2 uppercase italic">Style Detection Center</h3>
                       <p className="text-amber-800/70 font-medium text-lg italic max-w-2xl leading-relaxed">
                          Audite a extração de sinais de estilo. O motor analisa interações e propõe micro-ajustes nos perfis individuais para aumentar o alinho sintático.
                       </p>
                    </div>
                 </div>

                 <div className="bg-white border border-zinc-100 rounded-[3rem] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="bg-zinc-50">
                             <th className="px-8 py-6 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Usuário / Data</th>
                             <th className="px-8 py-6 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Mensagem Observada</th>
                             <th className="px-8 py-6 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Sinal Extraído</th>
                             <th className="px-8 py-6 text-[10px] font-black uppercase text-zinc-400 tracking-widest text-right">Ação</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-zinc-50">
                          {learningEvents.map(event => (
                            <tr key={event.id} className="group hover:bg-zinc-50/50 transition-all">
                               <td className="px-8 py-8">
                                  <div className="flex flex-col gap-1">
                                     <span className="text-[11px] font-black text-zinc-900 truncate max-w-[140px]">{event.user_email || 'Usuário'}</span>
                                     <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{formatDate(event.created_at)}</span>
                                  </div>
                               </td>
                               <td className="px-8 py-8 w-1/3">
                                  <div className="relative p-4 bg-zinc-50 border border-zinc-100 rounded-2xl group-hover:bg-white transition-colors">
                                     <p className="text-xs font-bold text-zinc-600 italic line-clamp-2">"{event.observed_text_sample}"</p>
                                  </div>
                               </td>
                               <td className="px-8 py-8">
                                  <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                                        <Zap className="w-4 h-4 text-amber-500" />
                                     </div>
                                     <div className="flex flex-col">
                                        <span className="text-[8px] font-black uppercase text-zinc-400 tracking-tighter">{event.extracted_signal?.type}</span>
                                        <span className="text-xs font-black text-zinc-800">{event.extracted_signal?.interpretation}</span>
                                     </div>
                                  </div>
                               </td>
                               <td className="px-8 py-8 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                     <button className="w-10 h-10 bg-zinc-50 text-zinc-300 rounded-xl hover:bg-zinc-900 hover:text-white transition-all flex items-center justify-center border border-zinc-100">
                                        <Eye className="w-5 h-5" />
                                     </button>
                                     <button className="w-10 h-10 bg-zinc-50 text-zinc-300 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center border border-zinc-100">
                                        <Trash2 className="w-5 h-5" />
                                     </button>
                                  </div>
                               </td>
                            </tr>
                          ))}
                          {learningEvents.length === 0 && (
                            <tr>
                               <td colSpan={4} className="py-20 text-center text-zinc-300 font-medium italic">Nenhum sinal detectado recentemente.</td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
