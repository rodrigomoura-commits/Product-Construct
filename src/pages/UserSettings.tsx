import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  User, 
  Shield, 
  Brain, 
  Zap, 
  Settings2, 
  RotateCcw, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  Loader2,
  Sliders,
  Layout,
  Sparkles,
  MessageSquare,
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { 
  doc, 
  onSnapshot, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { TonaUserPersonality } from '../lib/tonaPersonality.types';
import { resetUserPersonality } from '../lib/tonaPersonalityEngine';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

export default function UserSettings() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [userPersonality, setUserPersonality] = useState<TonaUserPersonality | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(doc(db, 'tona_user_personalities', user.uid), (snap) => {
      if (snap.exists()) {
        setUserPersonality(snap.data() as TonaUserPersonality);
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'tona_user_personalities');
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const handleTogglePreference = async (field: string, value: any) => {
    if (!user || !userPersonality) return;
    try {
      const updates: any = {};
      updates[field] = value;
      updates.updated_at = serverTimestamp();
      
      await updateDoc(doc(db, 'tona_user_personalities', user.uid), updates);
      toast.success("Preferências atualizadas!");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'tona_user_personalities');
    }
  };

  const handleReset = async () => {
    if (!user || !confirm("Deseja mesmo redefinir a memória de personalidade da Tona? Isso apagará seu estilo aprendido.")) return;
    try {
      setSaving(true);
      await resetUserPersonality(user.uid, user.email || '');
      toast.success("Memória de personalidade reiniciada!");
    } catch (e) {
      toast.error("Erro ao reiniciar memória.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans mb-20">
      <header className="h-16 px-8 border-b border-slate-200 bg-white flex items-center justify-between sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/products')} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 group transition-all">
             <ChevronLeft className="w-5 h-5 group-hover:text-slate-900 transition-colors" />
          </button>
          <div className="flex flex-col">
            <h1 className="font-black text-lg text-slate-900 tracking-tight uppercase">Minha Conta & Preferências</h1>
            <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Ajustes da Experiência Tona</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-3 px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-full shadow-inner">
             <span className="text-[11px] font-black text-slate-900">{profile?.display_name}</span>
             <div className="w-8 h-8 rounded-full border border-slate-200 overflow-hidden bg-slate-200 shadow-sm">
               {user?.photoURL && <img src={user.photoURL} alt="Avatar" referrerPolicy="no-referrer" />}
             </div>
           </div>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full space-y-12">
        {/* Intro Section */}
        <section className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm flex flex-col md:flex-row items-center gap-10">
           <div className="w-24 h-24 bg-indigo-50 border border-indigo-100 rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-50 shrink-0">
              <UserCheck className="w-12 h-12 text-indigo-600" />
           </div>
           <div className="flex-1 text-center md:text-left">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Sua Identidade no Mindflow</h2>
              <p className="text-slate-500 font-medium text-lg italic max-w-2xl leading-relaxed">
                 A Tona aprende com o seu jeito de trabalhar. Aqui você controla o que ela sabe sobre o seu estilo e como ela deve se adaptar.
              </p>
           </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
           {/* Sidebar controls */}
           <div className="lg:col-span-1 space-y-8">
              <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                    <Zap className="w-32 h-32" />
                 </div>
                 <h3 className="text-lg font-black mb-6 flex items-center gap-3 uppercase tracking-tight">
                    <Brain className="w-5 h-5 text-indigo-400" /> Motor de Aprendizado
                 </h3>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                       <div className="flex flex-col">
                          <span className="text-xs font-bold text-white">Aprendizado Ativo</span>
                          <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Evolução Contínua</span>
                       </div>
                       <button 
                         onClick={() => handleTogglePreference('learning_enabled', !userPersonality?.learning_enabled)}
                         className={cn(
                           "w-12 h-7 rounded-full flex items-center px-1 transition-all",
                           userPersonality?.learning_enabled ? "bg-indigo-600" : "bg-zinc-700"
                         )}
                       >
                          <motion.div 
                            className="w-5 h-5 bg-white rounded-full shadow-lg"
                            animate={{ x: userPersonality?.learning_enabled ? 20 : 0 }}
                          />
                       </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                       <div className="flex flex-col">
                          <span className="text-xs font-bold text-white">Personalização</span>
                          <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Uso das Preferências</span>
                       </div>
                       <button 
                         onClick={() => handleTogglePreference('personalization_enabled', !userPersonality?.personalization_enabled)}
                         className={cn(
                           "w-12 h-7 rounded-full flex items-center px-1 transition-all",
                           userPersonality?.personalization_enabled ? "bg-indigo-600" : "bg-zinc-700"
                         )}
                       >
                          <motion.div 
                            className="w-5 h-5 bg-white rounded-full shadow-lg"
                            animate={{ x: userPersonality?.personalization_enabled ? 20 : 0 }}
                          />
                       </button>
                    </div>
                 </div>
                 <div className="mt-8 pt-8 border-t border-white/10">
                   <p className="text-[10px] text-zinc-400 font-medium italic leading-relaxed">
                     Ao desativar o aprendizado, a Tona deixará de extrair sinais de estilo das suas conversas.
                   </p>
                 </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
                 <h3 className="text-lg font-black text-slate-900 mb-6 uppercase tracking-tight flex items-center gap-3">
                    <Lock className="w-5 h-5 text-slate-400" /> Privacidade
                 </h3>
                 <div className="space-y-4">
                    {[
                      { label: 'Estilo', field: 'privacy.allow_style_learning' },
                      { label: 'Vocabulário', field: 'privacy.allow_vocabulary_learning' },
                      { label: 'Contexto', field: 'privacy.allow_context_learning' }
                    ].map(p => (
                       <div key={p.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                          <span className="text-xs font-bold text-slate-600">{p.label}</span>
                          <button 
                             onClick={() => {
                               const path = p.field.split('.');
                               const current = (userPersonality as any)[path[0]][path[1]];
                               const updates: any = {};
                               updates[p.field] = !current;
                               updateDoc(doc(db, 'tona_user_personalities', user!.uid), updates);
                             }}
                             className="text-slate-400 hover:text-indigo-600 transition-all"
                          >
                             {(userPersonality as any)[p.field.split('.')[0]][p.field.split('.')[1]] ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                       </div>
                    ))}
                 </div>
                 <button 
                  onClick={handleReset}
                  disabled={saving}
                  className="w-full mt-8 py-4 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-all border border-slate-100 flex items-center justify-center gap-2"
                 >
                   {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                   Resetar Memória da Tona
                 </button>
              </div>
           </div>

           {/* Main personalization controls */}
           <div className="lg:col-span-2 space-y-8">
              <div className="bg-white border border-slate-200 rounded-[3rem] p-12 shadow-sm relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 scale-125">
                    <Sparkles className="w-48 h-48" />
                 </div>
                 <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-8 mb-12">
                    <div>
                       <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Sua Biometria de Estilo</h3>
                       <p className="text-slate-400 font-medium italic mt-1">Como a Tona percebe suas interações.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                       {userPersonality?.vocabulary_profile.recurring_expressions.slice(0, 6).map(exp => (
                          <span key={exp} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                             {exp}
                          </span>
                       ))}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
                    <div className="space-y-8">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <Sliders className="w-4 h-4" /> Tom & Dinâmica
                       </h4>
                       {[
                         { label: 'Diretividade', field: 'communication_style.directness_level', desc: 'Preferencia por respostas curtas' },
                         { label: 'Exaustividade', field: 'communication_style.detail_level', desc: 'Profundidade das explicações' },
                         { label: 'Formalidade', field: 'communication_style.formality_level', desc: 'Tom corporativo vs casual' },
                         { label: 'Linguagem Visual', field: 'communication_style.emoji_level', desc: 'Uso de emojis e ícones' }
                       ].map(metric => {
                          const val = (userPersonality as any)[metric.field.split('.')[0]][metric.field.split('.')[1]];
                          return (
                            <div key={metric.label}>
                               <div className="flex justify-between items-end mb-2">
                                  <div className="flex flex-col">
                                     <span className="text-xs font-black text-slate-800 tracking-tight">{metric.label}</span>
                                     <span className="text-[9px] text-slate-400 font-medium">{metric.desc}</span>
                                  </div>
                                  <span className="text-sm font-black text-indigo-600">{(val * 100).toFixed(0)}%</span>
                               </div>
                               <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <motion.div 
                                    className="h-full bg-indigo-500 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${val * 100}%` }}
                                  />
                               </div>
                            </div>
                          );
                       })}
                    </div>

                    <div className="space-y-8">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <Layout className="w-4 h-4" /> Formatação & Output
                       </h4>
                       <div className="space-y-4">
                          {[
                            { label: 'Resposta Prioritária (Answer First)', field: 'communication_style.likes_answer_first' },
                            { label: 'Scripts prontos para copiar', field: 'formatting_preferences.prefers_code_blocks_for_scripts' },
                            { label: 'Uso intenso de Bullets', field: 'formatting_preferences.prefers_bullets' },
                            { label: 'Explicações Longas', field: 'formatting_preferences.prefers_long_contextual_explanations' },
                            { label: 'Uso de Exemplos', field: 'communication_style.likes_examples' }
                          ].map(pref => {
                             const isActive = (userPersonality as any)[pref.field.split('.')[0]][pref.field.split('.')[1]];
                             return (
                               <button 
                                 key={pref.label}
                                 onClick={() => handleTogglePreference(pref.field, !isActive)}
                                 className={cn(
                                   "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                                   isActive 
                                     ? "bg-indigo-50 border-indigo-100 text-indigo-900 shadow-sm" 
                                     : "bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200"
                                 )}
                               >
                                  <span className="text-xs font-bold">{pref.label}</span>
                                  {isActive ? <CheckCircle2 className="w-4 h-4 text-indigo-600" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
                               </button>
                             );
                          })}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="bg-indigo-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden group">
                 <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-repeat" />
                 <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="w-20 h-20 bg-white/10 rounded-[1.75rem] flex items-center justify-center border border-white/20 shadow-2xl backdrop-blur-xl">
                       <MessageSquare className="w-10 h-10 text-indigo-300" />
                    </div>
                    <div className="flex-1">
                       <h3 className="text-2xl font-black mb-2 tracking-tight">Experimente seu tom atual</h3>
                       <p className="text-indigo-200/70 font-medium italic">Inicie uma conversa para testar como as mudanças afetam as falas da Tona.</p>
                    </div>
                    <button 
                      onClick={() => navigate('/products')}
                      className="px-8 py-4 bg-white text-indigo-950 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center gap-3"
                    >
                       Abrir Workspace <ArrowRight className="w-4 h-4" />
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </main>
    </div>
  );
}
