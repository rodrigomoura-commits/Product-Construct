import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, limit, orderBy, writeBatch, doc, serverTimestamp, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Users, Boxes, Brain, Shield, Target, 
  Activity, CheckCircle2, AlertCircle, Clock, RefreshCw, Loader2,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';

import { seedDefaultAgents } from '../../lib/agents';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminDashboardSection() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    users: 0,
    products: 0,
    memories: 0,
    admins: 0,
    activeLoops: 0,
    scheduledActions: 0
  });
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const [
        uCount, 
        pCount, 
        mCount, 
        rCount, 
        lCount, 
        sCount
      ] = await Promise.all([
        getCountFromServer(collection(db, 'profiles')),
        getCountFromServer(collection(db, 'products')),
        getCountFromServer(collection(db, 'memories')),
        getCountFromServer(query(collection(db, 'user_roles'), where('role', 'in', ['admin', 'owner']))),
        getCountFromServer(query(collection(db, 'mindflow_loops'), where('status', '==', 'running'))),
        getCountFromServer(query(collection(db, 'scheduled_actions'), where('status', '==', 'scheduled')))
      ]);
      
      setStats({
        users: uCount.data().count,
        products: pCount.data().count,
        memories: mCount.data().count,
        admins: rCount.data().count,
        activeLoops: lCount.data().count,
        scheduledActions: sCount.data().count
      });
    } catch (e: any) {
      console.error('Failed to load stats:', e);
      if (e.message?.includes('Quota exceeded')) {
        import('react-hot-toast').then(({ toast }) => {
          toast.error("Capacidade do banco atingida (Quota). Estatísticas podem estar zeradas.");
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function runSeeds() {
    if (!confirm("Isso irá criar dados de exemplo (AI Study Companion e Epic Builder) e inicializará os Agentes Default. Continuar?")) return;
    setSeeding(true);
    try {
      // 0. Seed Default Agents first
      if (user?.uid) {
        await seedDefaultAgents(user.uid);
      }
      
      const batch = writeBatch(db);
      
      // 1. Create AI Study Companion
      const p1Id = 'ai-study-companion';
      const p1Ref = doc(db, 'products', p1Id);
      batch.set(p1Ref, {
        name: 'AI Study Companion',
        description: 'Produto para ajudar estudantes e profissionais a transformar metas de aprendizado em planos claros.',
        product_type: 'Produto digital com IA',
        status: 'active',
        current_stage: 'sense',
        progress: 17,
        quality_score: 60,
        owner_id: user.uid,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      // 2. Create Epic Builder
      const p2Id = 'epic-builder';
      const p2Ref = doc(db, 'products', p2Id);
      batch.set(p2Ref, {
        name: 'Epic Builder',
        description: 'Ferramenta para Product Managers quebrarem iniciativas complexas em épicos bem fatiados.',
        product_type: 'SaaS B2B',
        status: 'active',
        current_stage: 'sense',
        progress: 7,
        quality_score: 40,
        owner_id: user.uid,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      // Stages for AI Study Companion
      const p1Stages = ['sense', 'shape', 'sketch', 'scope', 'ship', 'sense_plus'];
      p1Stages.forEach(sk => {
        batch.set(doc(db, `products/${p1Id}/stages`, sk), {
          product_id: p1Id, stage_key: sk, progress: sk === 'sense' ? 100 : 0, 
          status: sk === 'sense' ? 'completed' : 'not_started', updated_at: serverTimestamp()
        });
      });

      // Stages for Epic Builder
      const p2Stages = ['sense', 'shape', 'sketch', 'scope', 'ship', 'sense_plus'];
      p2Stages.forEach(sk => {
        batch.set(doc(db, `products/${p2Id}/stages`, sk), {
          product_id: p2Id, stage_key: sk, progress: sk === 'sense' ? 40 : 0, 
          status: sk === 'sense' ? 'in_progress' : 'not_started', updated_at: serverTimestamp()
        });
      });
      
      // Fields for Epic Builder (Sense)
      const fields = [
        { k: 'target_audience', l: 'Público-alvo', v: 'Product Managers', c: 'fact' },
        { k: 'main_pain', l: 'Problema central', v: 'Product Managers têm dificuldade de quebrar iniciativas em épicos claros e fatiáveis.', c: 'fact' },
        { k: 'main_function', l: 'Função principal', v: 'Quebra de iniciativas em épicos com granularidade correta.', c: 'fact' },
        { k: 'purpose_hypothesis', l: 'Hipótese de propósito', v: 'Reduzir retrabalho e falta de clareza na decomposição de iniciativas.', c: 'hypothesis' },
        { k: 'difficulty_type', l: 'Tipo de dificuldade', v: 'Dificuldade de equilibrar valor de negócio e viabilidade técnica no fatiamento.', c: 'fact' },
        { k: 'root_cause', l: 'Causa raiz', v: 'Falta de critérios claros de granularidade e pressão por prazos que impedem o fatiamento técnico correto.', c: 'fact' }
      ];

      fields.forEach(f => {
        const fRef = doc(collection(db, `products/${p2Id}/fields`));
        batch.set(fRef, {
          product_id: p2Id, stage_key: 'sense', field_key: f.k, label: f.l, value: f.v,
          classification: f.c, confidence: 0.9, updated_at: serverTimestamp()
        });
      });

      // 3. Create a Decision
      const d1Ref = doc(collection(db, `products/${p1Id}/decisions`));
      batch.set(d1Ref, {
        product_id: p1Id,
        title: 'Começar por profissionais em requalificação',
        description: 'Público com dor mais clara de transformar metas de aprendizado em rotina prática.',
        reason: 'Maior poder aquisitivo e urgência imediata.',
        evidence: 'Pesquisa qualitativa n=5',
        status: 'approved',
        author_id: 'system',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      // 4. Create a Memory
      const m1Ref = doc(collection(db, 'memories'));
      batch.set(m1Ref, {
        title: 'Estilo de construção do produto',
        content: 'O produto deve ser guiado, pragmático e orientado a lacunas, evitando perguntas genéricas demais.',
        type: 'style',
        status: 'active',
        confidence: 1,
        can_ai_use: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        version: '1.0'
      });

      await batch.commit();
      alert("Seeds aplicados com sucesso!");
      loadStats();
    } catch (e) {
      console.error(e);
      alert("Erro ao aplicar seeds: " + e);
    } finally {
      setSeeding(false);
    }
  }

  const cards = [
    { label: 'Usuários Totais', value: stats.users, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Administradores', value: stats.admins, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Mindflow Ativos', value: stats.activeLoops, icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Ações Agendadas', value: stats.scheduledActions, icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Memórias Base', value: stats.memories, icon: Brain, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Dashboard Overview</h2>
          <p className="text-zinc-500 mt-1 font-medium italic">Visão geral do sistema Product Constructor.</p>
        </div>
        <button 
          onClick={runSeeds}
          disabled={seeding}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all text-xs border border-zinc-200"
        >
          {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Rodar Seeds de Exemplo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm"
          >
            <div className={`w-12 h-12 ${card.bg} rounded-2xl flex items-center justify-center mb-4`}>
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest">{card.label}</span>
              <span className="text-4xl font-black text-zinc-900 mt-1 tracking-tighter">
                {loading ? '...' : card.value}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-zinc-400" /> Saúde do Sistema
              </h3>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
               {[
                 { label: 'Auth & RBAC', status: 'OK' },
                 { label: 'Mindflow Hub', status: 'Live' },
                 { label: 'Scheduler', status: 'Running' },
                 { label: 'Generative Memory', status: 'Ready' },
                 { label: 'Artifact Engine', status: 'OK' },
                 { label: 'Audit Logs', status: 'Active' }
               ].map((item, i) => (
                 <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-tight">{item.label}</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase">{item.status}</span>
                 </div>
               ))}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-zinc-400" /> Atividades Recentes
              </h3>
              <button className="text-xs font-bold text-zinc-400 hover:text-zinc-900 uppercase">Ver tudo</button>
            </div>
            <div className="p-6 space-y-4">
               {[
                 { msg: 'Mindflow Ciclo #402 concluído com sucesso', time: 'Há 2 min', user: 'Mindflow IA' },
                 { msg: 'Novo produto "AI Study Companion" criado', time: 'Há 5 min', user: 'Rod Moura' },
                 { msg: 'Ação agendada: "Sync Memória" para as 22h', time: 'Há 8 min', user: 'Scheduler' }
               ].map((item, i) => (
                 <div key={i} className="flex items-start gap-3 pb-4 border-b border-zinc-50 last:border-0 last:pb-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 leading-tight">{item.msg}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        <span>{item.time}</span>
                        <span>•</span>
                        <span>Por {item.user}</span>
                      </div>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-zinc-900 rounded-3xl p-8 text-white shadow-xl shadow-zinc-200 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-12 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
             <div className="relative z-10">
               <Target className="w-10 h-10 mb-6 text-white" />
               <h3 className="text-2xl font-bold tracking-tight mb-2">Próximos Passos Admin</h3>
               <p className="text-zinc-400 text-sm mb-6 leading-relaxed">Revise as memórias sugeridas pela IA para garantir a qualidade do conhecimento base.</p>
               <button className="w-full py-3 bg-white text-zinc-900 rounded-2xl font-bold hover:bg-zinc-100 transition-all flex items-center justify-center gap-2">
                 Ver Sugestões <ArrowRight className="w-4 h-4" />
               </button>
             </div>
           </div>

           <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" /> Alertas Críticos
              </h3>
              <div className="space-y-3">
                 <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                   <p className="text-xs font-bold text-amber-800">Conflito de Memória Detectado</p>
                   <p className="text-[10px] text-amber-600 mt-1 uppercase font-bold">Produto: AI Study Companion</p>
                 </div>
                 <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
                   <p className="text-xs font-bold text-zinc-500 text-center italic">Nenhum outro alerta no momento.</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

// End of file
