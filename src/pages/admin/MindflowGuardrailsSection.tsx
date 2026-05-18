import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  AlertTriangle, 
  Search, 
  Plus, 
  X, 
  Edit3, 
  Trash2, 
  ChevronRight,
  ShieldAlert,
  Shield,
  CheckCircle2,
  Brain,
  Zap,
  Info,
  RefreshCw
} from 'lucide-react';
import { 
  collection, query, orderBy, onSnapshot, 
  addDoc, serverTimestamp, doc, updateDoc, 
  deleteDoc, limit 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

interface MindflowGuardrail {
  id: string;
  name: string;
  description: string;
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'inactive';
  created_at: any;
  updated_at: any;
}

export default function MindflowGuardrailsSection() {
  const [guardrails, setGuardrails] = useState<MindflowGuardrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newGuardrail, setNewGuardrail] = useState<Partial<MindflowGuardrail>>({
    name: '',
    description: '',
    rule: '',
    severity: 'medium',
    status: 'active'
  });

  useEffect(() => {
    const q = query(collection(db, 'mindflow_guardrails'), orderBy('created_at', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      setGuardrails(snap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowGuardrail)));
      setLoading(false);
    }, (err) => {
      console.error("[GuardrailsSection] Failed to load guardrails:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleCreate = async () => {
    if (!newGuardrail.name || !newGuardrail.rule) {
      toast.error("Nome e Regra são obrigatórios.");
      return;
    }
    try {
      await addDoc(collection(db, 'mindflow_guardrails'), {
        ...newGuardrail,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      toast.success("Guardrail ativado com sucesso!");
      setIsAddModalOpen(false);
      setNewGuardrail({ name: '', description: '', rule: '', severity: 'medium', status: 'active' });
    } catch (e) {
      toast.error("Erro ao criar guardrail.");
    }
  };

  const filtered = guardrails.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.rule.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="bg-blue-600 rounded-[3rem] p-12 text-white flex flex-col md:flex-row items-center gap-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10">
          <ShieldCheck className="w-64 h-64" />
        </div>
        <div className="w-24 h-24 bg-white/10 rounded-[2rem] flex items-center justify-center shadow-2xl backdrop-blur-xl border border-white/20 shrink-0 relative z-10">
          <Lock className="w-12 h-12 text-blue-100" />
        </div>
        <div className="relative z-10 flex-1">
          <h3 className="text-3xl font-black tracking-tight mb-2 uppercase">Mindflow Guardrails</h3>
          <p className="text-blue-100/70 font-medium text-lg italic max-w-2xl leading-relaxed">
            Regras de integridade e segurança cognitiva que a Tona deve obrigatoriamente respeitar. 
            Estes limites previnem comportamentos erráticos e garantem conformidade estratégica.
          </p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:scale-105 active:scale-95 transition-all relative z-10 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo Guardrail
        </button>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-zinc-100 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Pesquisar regras de segurança..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-zinc-50 border-none rounded-[1.5rem] text-sm font-medium focus:ring-2 focus:ring-blue-500/20 shadow-inner"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-10 h-10 text-blue-200 animate-spin mx-auto mb-4" />
            <p className="text-zinc-400 font-black uppercase text-[10px] tracking-widest">Sincronizando Escudos Cognitivos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-32 text-center bg-zinc-50 rounded-[3rem] border-2 border-dashed border-zinc-100">
             <Shield className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
             <p className="text-zinc-400 font-medium italic">Nenhum guardrail encontrado.</p>
          </div>
        ) : (
          filtered.map(guard => (
            <div key={guard.id} className="group bg-white border border-zinc-100 rounded-[3rem] p-10 hover:shadow-2xl hover:border-blue-100 transition-all flex flex-col md:flex-row gap-10">
               <div className={cn(
                 "w-20 h-20 rounded-[1.75rem] flex items-center justify-center shrink-0 border-2 shadow-xl",
                 guard.severity === 'critical' ? 'bg-rose-50 border-rose-100 text-rose-500 shadow-rose-100' :
                 guard.severity === 'high' ? 'bg-orange-50 border-orange-100 text-orange-500 shadow-orange-100' :
                 'bg-blue-50 border-blue-100 text-blue-500 shadow-blue-100'
               )}>
                 {guard.severity === 'critical' || guard.severity === 'high' ? <ShieldAlert className="w-10 h-10" /> : <ShieldCheck className="w-10 h-10" />}
               </div>
               
               <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                     <span className={cn(
                       "px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                       guard.severity === 'critical' ? 'bg-rose-500 text-white' :
                       guard.severity === 'high' ? 'bg-orange-500 text-white' :
                       'bg-blue-500 text-white'
                     )}>{guard.severity} severity</span>
                     <span className={cn(
                       "px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                       guard.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-zinc-100 text-zinc-400 border-zinc-200'
                     )}>{guard.status}</span>
                  </div>

                  <h3 className="text-2xl font-black text-zinc-900 tracking-tight mb-2 uppercase">{guard.name}</h3>
                  <p className="text-zinc-500 font-medium italic mb-6 leading-relaxed">"{guard.description}"</p>
                  
                  <div className="bg-zinc-900 text-blue-100 p-8 rounded-[2rem] font-mono text-xs leading-loose relative overflow-hidden group-hover:bg-blue-950 transition-colors">
                     <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Zap className="w-6 h-6 text-blue-400" />
                     </div>
                     <span className="text-blue-500 font-black mb-2 block uppercase text-[8px] tracking-[0.2em]">Rule Definition</span>
                     {guard.rule}
                  </div>
               </div>

               <div className="flex flex-row md:flex-col gap-2 justify-end">
                  <button className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 hover:bg-zinc-900 hover:text-white transition-all"><Edit3 className="w-5 h-5" /></button>
                  <button className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition-all"><Trash2 className="w-5 h-5" /></button>
               </div>
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsAddModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white rounded-[4rem] shadow-2xl relative w-full max-w-2xl p-12 overflow-hidden">
               <div className="flex items-center gap-5 mb-10">
                  <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white">
                     <ShieldCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">Novo Guardrail</h2>
                    <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest mt-1">Limite Cognitivo e Integridade</p>
                  </div>
               </div>

               <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Nome da Regra</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Anti-Haluciantion Proxy..." 
                          value={newGuardrail.name}
                          onChange={e => setNewGuardrail(p => ({ ...p, name: e.target.value }))}
                          className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl py-4 px-6 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" 
                        />
                     </div>
                     <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Severidade</label>
                        <select 
                          value={newGuardrail.severity}
                          onChange={e => setNewGuardrail(p => ({ ...p, severity: e.target.value as any }))}
                          className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl py-4 px-6 text-xs font-black uppercase focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        >
                           <option value="low">Low Impact</option>
                           <option value="medium">Medium</option>
                           <option value="high">High Risk</option>
                           <option value="critical">Critical Block</option>
                        </select>
                     </div>
                  </div>

                  <div className="space-y-3">
                     <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Breve Descrição</label>
                     <input 
                        type="text" 
                        placeholder="Por que esta regra existe?" 
                        value={newGuardrail.description}
                        onChange={e => setNewGuardrail(p => ({ ...p, description: e.target.value }))}
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" 
                     />
                  </div>

                  <div className="space-y-3">
                     <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Lógica/Prompt da Regra (Mindflow Syntax)</label>
                     <textarea 
                        placeholder="Descreva a regra de forma imperativa para a Tona..." 
                        value={newGuardrail.rule}
                        onChange={e => setNewGuardrail(p => ({ ...p, rule: e.target.value }))}
                        className="w-full bg-zinc-900 border-none rounded-[2rem] py-6 px-8 text-blue-100 font-mono text-xs leading-relaxed focus:ring-2 focus:ring-blue-500/20 outline-none transition-all min-h-[160px] resize-none" 
                     />
                  </div>
               </div>

               <div className="mt-12 flex gap-4">
                  <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-5 rounded-[1.75rem] bg-zinc-100 text-zinc-500 text-[11px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all font-black">Cancelar</button>
                  <button onClick={handleCreate} className="flex-[2] py-5 rounded-[1.75rem] bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-[0.98] font-black">Ativar Guardrail</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
