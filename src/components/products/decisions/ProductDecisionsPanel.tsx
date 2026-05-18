import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  ListTodo, 
  Loader2, 
  MessageCircle, 
  ArrowRight,
  TrendingUp,
  Brain,
  Monitor,
  Target,
  History,
  Info
} from 'lucide-react';
import { Product, ProductDecision, ProductDecisionType, ProductDecisionStatus, DiscussWithTonaPayload } from '../../../types';
import { watchProductDecisions, archiveProductDecision } from '../../../lib/productDecisions';
import ProductDecisionCard from './ProductDecisionCard';
import ProductDecisionModal from './ProductDecisionModal';
import { cn } from '../../../lib/utils';

interface Props {
  product: Product;
  user: any;
  onDiscussWithTona?: (payload: DiscussWithTonaPayload) => void;
}

const trendingUp = TrendingUp;

export default function ProductDecisionsPanel({ product, user, onDiscussWithTona }: Props) {
  const [decisions, setDecisions] = useState<ProductDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<ProductDecision | undefined>();
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');

  useEffect(() => {
    const unsub = watchProductDecisions(product.id, (docs) => {
      setDecisions(docs);
      setLoading(false);
    });
    return unsub;
  }, [product.id]);

  const filteredDecisions = decisions.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         d.decision_statement.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || d.decision_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: decisions.filter(d => d.status === 'active').length,
    ai: decisions.filter(d => d.decision_type === 'ai' && d.status === 'active').length,
    tech: decisions.filter(d => d.decision_type === 'technology' && d.status === 'active').length,
    scope: decisions.filter(d => d.decision_type === 'mvp_scope' && d.status === 'active').length,
    superseded: decisions.filter(d => d.status === 'superseded').length
  };

  const handleDiscuss = (d: ProductDecision) => {
    onDiscussWithTona?.({
      source: "decision",
      title: d.title,
      content: d.decision_statement,
      suggestedPrompt: `Quero discutir esta decisão do produto.

Título: ${d.title}
Tipo: ${d.decision_type}
Decisão atual: ${d.decision_statement}
Racional: ${d.rationale}
Impactos: ${d.impact_areas.join(", ")}

Me ajude a validar se essa decisão está bem formulada, quais riscos ela cria, quais alternativas deveríamos considerar e se ela deveria virar uma decisão ativa.`
    });
  };

  return (
    <div className="space-y-12 pb-24">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Registro de Decisões</h2>
          <p className="text-lg font-bold text-slate-400 max-w-2xl leading-relaxed">
            Documente escolhas que direcionam o produto, a experiência, a tecnologia, o MVP e a entrega.
          </p>
        </div>
        <button 
          onClick={() => {
            setSelectedDecision(undefined);
            setIsModalOpen(true);
          }}
          className="px-8 py-4 bg-slate-900 text-white rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group shrink-0 active:scale-95"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          Nova Decisão
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Ativas', val: stats.total, icon: trendingUp, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
          { label: 'IA', val: stats.ai, icon: Brain, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
          { label: 'Técnicas', val: stats.tech, icon: Monitor, color: 'text-blue-600 bg-blue-50 border-blue-100' },
          { label: 'Escopo', val: stats.scope, icon: Target, color: 'text-violet-600 bg-violet-50 border-violet-100' },
          { label: 'Substituídas', val: stats.superseded, icon: History, color: 'text-slate-500 bg-slate-50 border-slate-100' }
        ].map((s, idx) => (
          <div key={idx} className={cn("p-4 rounded-[24px] border flex items-center justify-between", s.color)}>
            <div className="space-y-1">
              <p className="text-[8px] font-black uppercase tracking-widest opacity-60">{s.label}</p>
              <p className="text-xl font-black">{s.val}</p>
            </div>
            {React.createElement(s.icon || TrendingUp, { className: "w-5 h-5 opacity-40" })}
          </div>
        ))}
      </div>

      {/* Filters & List */}
      <div className="space-y-8">
        <div className="bg-white border border-slate-100 p-4 rounded-[28px] shadow-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por título, decisão ou racional..."
              className="w-full bg-slate-50 border-transparent border-2 rounded-2xl px-14 py-3 text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-indigo-100 transition-all outline-none"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <div className="relative">
              <select 
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 focus:bg-white focus:border-indigo-200 outline-none pr-10 cursor-pointer"
              >
                <option value="all">Todos os Tipos</option>
                <option value="product">Produto</option>
                <option value="ai">IA</option>
                <option value="technology">Tecnologia</option>
                <option value="experience">Experiência</option>
                <option value="mvp_scope">MVP / Escopo</option>
                <option value="business">Negócio</option>
              </select>
              <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 focus:bg-white focus:border-indigo-200 outline-none pr-10 cursor-pointer"
              >
                <option value="active">Ativas</option>
                <option value="all">Todas as Datas</option>
                <option value="draft">Rascunhos</option>
                <option value="superseded">Substituídas</option>
                <option value="archived">Arquivadas</option>
              </select>
              <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-400" />
            <p className="text-xs font-black text-slate-300 uppercase tracking-widest mt-4">Carregando decisões...</p>
          </div>
        ) : filteredDecisions.length === 0 ? (
          <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[48px] bg-white shadow-xl shadow-slate-100/30">
            <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mx-auto mb-8 border border-slate-100 group">
              <ListTodo className="w-10 h-10 text-slate-200 group-hover:scale-110 transition-transform duration-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Nenhuma decisão direcionadora registrada</h3>
            <p className="text-slate-400 max-w-sm mx-auto text-sm font-bold leading-relaxed mb-10">
              Registre escolhas que mudam o rumo do produto, como uso de IA, público priorizado, integrações, escopo do MVP ou decisões de experiência.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
               <button 
                onClick={() => setIsModalOpen(true)}
                className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95"
              >
                Registrar primeira decisão
                <ArrowRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onDiscussWithTona?.({
                  source: "decision",
                  title: "Ajuda para identificar decisões",
                  content: "Nenhuma decisão registrada ainda.",
                  suggestedPrompt: "Me ajude a identificar quais decisões direcionadoras já deveríamos registrar para este produto."
                })}
                className="px-8 py-4 bg-white text-slate-600 border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 transition-all flex items-center gap-2 active:scale-95 shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                Pedir ajuda para a Tona
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredDecisions.map(d => (
              <ProductDecisionCard 
                key={d.id} 
                decision={d} 
                product={product}
                onEdit={() => {
                  setSelectedDecision(d);
                  setIsModalOpen(true);
                }}
                onDiscuss={() => handleDiscuss(d)}
                onSupersede={() => {
                   // Open modal pre-filled as "new" but with old ID for logic
                   // Implement shorthand for superseding later if needed
                   setSelectedDecision(d);
                   setIsModalOpen(true);
                }}
                onArchive={() => archiveProductDecision(product, d.id, user)}
              />
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <ProductDecisionModal 
          isOpen={isModalOpen}
          product={product}
          user={user}
          decision={selectedDecision}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
