import React, { useState } from 'react';
import { X, Plus, Trash2, Info, Check, Sparkles, Brain, Monitor, Users, Link as LinkIcon, AlertTriangle, Lightbulb, FileText, ChevronRight, HelpCircle } from 'lucide-react';
import { 
  Product, 
  ProductDecision, 
  ProductDecisionType, 
  ProductDecisionDirection, 
  ProductDecisionStatus,
  StageKey,
  DecisionSuggestion,
  StageField
} from '../../../types';
import { createProductDecision, updateProductDecision, watchProductDecisions } from '../../../lib/productDecisions';
import { recordProductInteraction } from '../../../lib/productUserInteractions';
import { buildDecisionSuggestions } from '../../../lib/decisionSuggestions';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import toast from 'react-hot-toast';
import { cn } from '../../../lib/utils';
import { motion } from 'motion/react';

interface Props {
  isOpen: boolean;
  product: Product;
  user: any;
  decision?: ProductDecision; // For editing
  stageFields?: StageField[];
  initialData?: {
    title?: string;
    decision_statement?: string;
    type?: string;
    status?: string;
    stage?: string;
  };
  onClose: () => void;
  onSuccess?: (decisionId: string) => void;
}

const IMPACT_AREAS = [
  { id: 'customer', label: 'Cliente' },
  { id: 'business', label: 'Negócio' },
  { id: 'technology', label: 'Tecnologia' },
  { id: 'design', label: 'Design' },
  { id: 'data', label: 'Dados' },
  { id: 'operations', label: 'Operação' },
  { id: 'go_to_market', label: 'GTM' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'compliance', label: 'Compliance' }
];

const STAGES = [
  { key: 'sense', label: 'Entender o Problema' },
  { key: 'shape', label: 'Definir a Proposta' },
  { key: 'sketch', label: 'Visualizar a Solução' },
  { key: 'scope', label: 'Planejar o MVP' },
  { key: 'ship', label: 'Preparar a Entrega' },
  { key: 'sense_plus', label: 'Acompanhar e Aprender' }
];

const DECISION_TYPES = [
  { value: 'product', label: 'Produto', description: 'Direção do produto e valor.' },
  { value: 'business', label: 'Negócio', description: 'Mercado, custo e receita.' },
  { value: 'technology', label: 'Tecnologia', description: 'Stack e infraestrutura.' },
  { value: 'experience', label: 'Experiência', description: 'Design e jornada.' },
  { value: 'mvp_scope', label: 'MVP / Escopo', description: 'O que entra e o que sai.' },
  { value: 'gtm', label: 'GTM', description: 'Lançamento e mercado.' },
  { value: 'data', label: 'Dados', description: 'Métricas e privacidade.' },
  { value: 'ai', label: 'IA', description: 'Uso de modelos e automação.' },
  { value: 'integration', label: 'Integração', description: 'Figma, Jira ou APIs.' },
  { value: 'architecture', label: 'Arquitetura', description: 'Estrutura técnica.' },
  { value: 'process', label: 'Processo', description: 'Workflow e governança.' },
  { value: 'other', label: 'Outro', description: 'Outros temas.' }
];

export default function ProductDecisionModal({ isOpen, product, user, decision, stageFields: providedStageFields, initialData, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [existingDecisions, setExistingDecisions] = useState<ProductDecision[]>([]);
  const [stageFields, setStageFields] = useState<StageField[]>(providedStageFields || []);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  
  if (!isOpen) return null;

  // Fetch data if not provided
  React.useEffect(() => {
    if (!isOpen) return;

    // Fetch existing decisions
    const unsubDecisions = watchProductDecisions(product.id, (docs) => {
      setExistingDecisions(docs);
    });

    // Fetch stage fields if not provided
    let unsubFields: () => void = () => {};
    if (!providedStageFields) {
      const q = query(
        collection(db, `products/${product.id}/fields`),
        orderBy('updated_at', 'desc'),
        limit(50)
      );
      unsubFields = onSnapshot(q, (snap) => {
        setStageFields(snap.docs.map(d => ({ id: d.id, ...d.data() } as StageField)));
      });
    }

    return () => {
      unsubDecisions();
      unsubFields();
    };
  }, [product.id, isOpen, providedStageFields]);

  // Fields
  const [title, setTitle] = useState(decision?.title || initialData?.title || '');
  const [type, setType] = useState<ProductDecisionType>((decision?.decision_type as ProductDecisionType) || (initialData?.type as ProductDecisionType) || 'product');
  const [direction, setDirection] = useState<ProductDecisionDirection>(decision?.direction || 'chosen');
  const [status, setStatus] = useState<ProductDecisionStatus>((decision?.status as ProductDecisionStatus) || (initialData?.status as ProductDecisionStatus) || 'active');
  const [stageKey, setStageKey] = useState<StageKey | ''>((decision?.stage_key as StageKey) || (initialData?.stage as StageKey) || (product.current_stage as StageKey) || '');
  
  const [statement, setStatement] = useState(decision?.decision_statement || initialData?.decision_statement || '');
  const [rationale, setRationale] = useState(decision?.rationale || '');
  
  const [impactAreas, setImpactAreas] = useState<string[]>(decision?.impact_areas || []);
  const [implications, setImplications] = useState<string[]>(decision?.implications || ['']);
  
  const [alternatives, setAlternatives] = useState(decision?.alternatives_considered || [{ option: '', reason_not_chosen: '' }]);
  const [risks, setRisks] = useState<string[]>(decision?.risks || ['']);
  const [assumptions, setAssumptions] = useState<string[]>(decision?.assumptions || ['']);
  
  const [links, setLinks] = useState(decision?.related_links || [{ label: '', url: '' }]);

  const suggestions = buildDecisionSuggestions({
    product,
    activeStage: (stageKey as StageKey) || (product.current_stage as StageKey) || 'sense',
    stageFields,
    existingDecisions
  });

  const visibleSuggestions = showAllSuggestions ? suggestions : suggestions.slice(0, 4);

  const applySuggestion = (s: DecisionSuggestion) => {
    setSelectedSuggestionId(s.id);
    setTitle(s.prefill.title || s.title);
    setType(s.prefill.decision_type || s.decision_type);
    if (s.prefill.direction) setDirection(s.prefill.direction);
    if (s.prefill.decision_statement) setStatement(s.prefill.decision_statement);
    if (s.prefill.rationale) setRationale(s.prefill.rationale);
    if (s.prefill.impact_areas) setImpactAreas(s.prefill.impact_areas);
    if (s.prefill.assumptions) setAssumptions(s.prefill.assumptions);
    if (s.prefill.risks) setRisks(s.prefill.risks);
    if (s.prefill.stage_key) setStageKey(s.prefill.stage_key);
    
    toast(`Sugestão aplicada: ${s.label}`, { icon: '✨' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !statement || !rationale) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      const data: Partial<ProductDecision> = {
        title,
        decision_type: type,
        direction,
        status,
        stage_key: (stageKey as StageKey) || null,
        decision_statement: statement,
        rationale,
        impact_areas: impactAreas,
        implications: implications.filter(i => i.trim()),
        alternatives_considered: alternatives.filter(a => a.option.trim()),
        risks: risks.filter(r => r.trim()),
        assumptions: assumptions.filter(a => a.trim()),
        related_links: links.filter(l => l.label && l.url)
      };

      if (decision) {
        await updateProductDecision({
          product,
          decisionId: decision.id,
          data,
          currentUser: user
        });
        toast.success('Decisão atualizada!');
      } else {
        const id = await createProductDecision({
          product,
          data,
          currentUser: user
        });
        toast.success('Decisão registrada!');
        // Record interaction
        recordProductInteraction({
          productId: product.id,
          user,
          profile: null,
          role: 'editor',
          section: 'decisions',
          event: 'decision_created'
        });
        onSuccess?.(id);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao salvar decisão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-end p-4 md:p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl h-full bg-white rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-10 duration-500">
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {decision ? 'Editar Decisão' : 'Nova Decisão Direcionadora'}
            </h2>
            <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wider">
              Documente escolhas que mudam o rumo do produto.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-12 space-y-16 custom-scrollbar">
          
          {!decision && suggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  {suggestions.some(s => s.source !== 'fallback' && s.source !== 'stage_based') 
                    ? 'Sugestões baseadas no produto' 
                    : 'Sugestões iniciais'}
                </label>
                {suggestions.length > 4 && (
                  <button 
                    type="button"
                    onClick={() => setShowAllSuggestions(!showAllSuggestions)}
                    className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                  >
                    {showAllSuggestions ? 'Ver menos' : 'Ver mais sugestões'}
                  </button>
                )}
              </div>
              
              {stageFields.some(f => f.classification === 'pending' || f.classification === 'risk') && (
                <p className="text-[10px] font-bold text-slate-400 italic">
                  Geradas a partir das lacunas e riscos atuais.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {visibleSuggestions.map(s => {
                  const isSelected = selectedSuggestionId === s.id;
                  const isContextual = s.source === 'contextual';
                  const isGap = s.source === 'gap_based';
                  const isRisk = s.source === 'risk_based';

                  return (
                    <button 
                      key={s.id}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      title={s.description || s.title}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border-2",
                        isSelected 
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-lg" 
                          : "bg-white border-slate-100 text-slate-500 hover:border-indigo-100 hover:text-indigo-600",
                        isContextual && !isSelected && "border-indigo-100 bg-indigo-50/30",
                        isGap && !isSelected && "border-amber-100 bg-amber-50/30",
                        isRisk && !isSelected && "border-rose-100 bg-rose-50/30"
                      )}
                    >
                      {isRisk ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      ) : isGap ? (
                        <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                      ) : isContextual ? (
                        <div className="relative">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                          <div className="absolute inset-0 bg-indigo-400 blur-sm opacity-50 animate-pulse rounded-full" />
                        </div>
                      ) : (
                        <Brain className="w-3.5 h-3.5 opacity-60" />
                      )}
                      {s.label}
                    </button>
                  );
                })}
              </div>

              {selectedSuggestionId && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-start gap-3"
                >
                  <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Sugestão Selecionada</h5>
                    <p className="text-xs font-bold text-slate-600">
                      {suggestions.find(s => s.id === selectedSuggestionId)?.description || 'Esta sugestão foi gerada com base no contexto atual do produto.'}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Section: Identification */}
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Identificação</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Título da Decisão</label>
                <input 
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: O MVP será web-first"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-indigo-400 transition-all outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Tipo de Decisão</label>
                <select 
                  value={type}
                  onChange={e => setType(e.target.value as ProductDecisionType)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-900 focus:bg-white focus:border-indigo-400 transition-all outline-none"
                >
                  {DECISION_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Etapa Relacionada</label>
                <select 
                  value={stageKey}
                  onChange={e => setStageKey(e.target.value as StageKey)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-900 focus:bg-white focus:border-indigo-400 transition-all outline-none"
                >
                  <option value="">Nenhuma etapa específica</option>
                  {STAGES.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Direção</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['chosen', 'rejected', 'deferred', 'open_for_review'] as ProductDecisionDirection[]).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirection(d)}
                      className={cn(
                        "px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 transition-all",
                        direction === d 
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                          : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      {d === 'chosen' ? 'Escolhida' : d === 'rejected' ? 'Rejeitada' : d === 'deferred' ? 'Adiada' : 'Em Revisão'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Status</label>
                <select 
                  value={status}
                  onChange={e => setStatus(e.target.value as ProductDecisionStatus)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-900 focus:bg-white focus:border-indigo-400 transition-all outline-none"
                >
                  <option value="active">Ativa</option>
                  <option value="draft">Rascunho</option>
                  <option value="archived">Arquivada</option>
                </select>
              </div>
            </div>
          </section>

          {/* Section: The Decision */}
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
                <Check className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">A Decisão</h3>
            </div>

            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Decisão Tomada</label>
                <textarea 
                  value={statement}
                  onChange={e => setStatement(e.target.value)}
                  placeholder="O que foi decidido exatamente?"
                  rows={4}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-8 py-6 font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-indigo-400 transition-all outline-none resize-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Motivo / Racional</label>
                <textarea 
                  value={rationale}
                  onChange={e => setRationale(e.target.value)}
                  placeholder="Por que essa escolha foi feita? Quais benefícios ela traz?"
                  rows={4}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-8 py-6 font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-indigo-400 transition-all outline-none resize-none"
                  required
                />
              </div>
            </div>
          </section>

          {/* Section: Impacts */}
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-100">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Impactos e Implicações</h3>
            </div>

            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Áreas Impactadas</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {IMPACT_AREAS.map(area => {
                    const isSelected = impactAreas.includes(area.id);
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) setImpactAreas(prev => prev.filter(i => i !== area.id));
                          else setImpactAreas(prev => [...prev, area.id]);
                        }}
                        className={cn(
                          "px-4 py-3 rounded-xl flex items-center gap-3 transition-all border-2",
                          isSelected 
                            ? "bg-violet-50 border-violet-600 text-violet-700 font-black shadow-sm" 
                            : "bg-white border-slate-100 text-slate-400 font-bold hover:border-slate-200"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center",
                          isSelected ? "bg-violet-600 border-violet-600 text-white" : "border-slate-200"
                        )}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <span className="text-[10px] uppercase tracking-widest">{area.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Implicações</label>
                <div className="space-y-3">
                  {implications.map((imp, idx) => (
                    <div key={idx} className="flex gap-3">
                      <input 
                        type="text"
                        value={imp}
                        onChange={e => {
                          const newImps = [...implications];
                          newImps[idx] = e.target.value;
                          setImplications(newImps);
                        }}
                        placeholder="Ex: O time de design deve focar no fluxo desktop."
                        className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl px-6 py-3 font-bold text-slate-900 focus:bg-white focus:border-indigo-400 transition-all outline-none"
                      />
                      <button 
                        type="button"
                        onClick={() => setImplications(prev => prev.filter((_, i) => i !== idx))}
                        className="w-12 h-12 bg-rose-50 text-rose-400 rounded-xl flex items-center justify-center hover:bg-rose-100 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  <button 
                    type="button"
                    onClick={() => setImplications(prev => [...prev, ''])}
                    className="flex items-center gap-2 text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:gap-3 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Adicionar implicação
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Alternatives */}
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-100">
                <Lightbulb className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Alternativas Consideradas</h3>
            </div>

            <div className="space-y-4">
              {alternatives.map((alt, idx) => (
                <div key={idx} className="p-6 bg-slate-50 border border-slate-100 rounded-2xl space-y-4 relative">
                  <button 
                    type="button"
                    onClick={() => setAlternatives(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Opção Considerada</label>
                      <input 
                        type="text"
                        value={alt.option}
                        onChange={e => {
                          const newAlts = [...alternatives];
                          newAlts[idx].option = e.target.value;
                          setAlternatives(newAlts);
                        }}
                        placeholder="Ex: Mobile First"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-900 focus:border-indigo-400 transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Por que não foi escolhida?</label>
                      <input 
                        type="text"
                        value={alt.reason_not_chosen}
                        onChange={e => {
                          const newAlts = [...alternatives];
                          newAlts[idx].reason_not_chosen = e.target.value;
                          setAlternatives(newAlts);
                        }}
                        placeholder="Ex: Aumentaria esforço de design no MVP."
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-900 focus:border-indigo-400 transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button 
                type="button"
                onClick={() => setAlternatives(prev => [...prev, { option: '', reason_not_chosen: '' }])}
                className="flex items-center gap-2 text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:gap-3 transition-all"
              >
                <Plus className="w-4 h-4" /> Adicionar alternativa
              </button>
            </div>
          </section>

          {/* Section: Risks and Assumptions */}
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-100">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Riscos e Premissas</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Riscos</label>
                <div className="space-y-3">
                  {risks.map((risk, idx) => (
                    <div key={idx} className="flex gap-2">
                       <input 
                        type="text"
                        value={risk}
                        onChange={e => {
                          const newRisks = [...risks];
                          newRisks[idx] = e.target.value;
                          setRisks(newRisks);
                        }}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold"
                       />
                       <button type="button" onClick={() => setRisks(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="w-4 h-4 text-slate-300"/></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setRisks(prev => [...prev, ''])} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">+ Adicionar risco</button>
                </div>
              </div>

               <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Premissas</label>
                <div className="space-y-3">
                  {assumptions.map((ass, idx) => (
                    <div key={idx} className="flex gap-2">
                       <input 
                        type="text"
                        value={ass}
                        onChange={e => {
                          const newAss = [...assumptions];
                          newAss[idx] = e.target.value;
                          setAssumptions(newAss);
                        }}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold"
                       />
                       <button type="button" onClick={() => setAssumptions(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="w-4 h-4 text-slate-300"/></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setAssumptions(prev => [...prev, ''])} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">+ Adicionar premissa</button>
                </div>
              </div>
            </div>
          </section>

          {/* Links */}
          <section className="space-y-8">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-600 rounded-xl flex items-center justify-center shadow-lg shadow-slate-100">
                  <LinkIcon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Recursos Relacionados</h3>
             </div>

             <div className="space-y-3">
                {links.map((link, idx) => (
                   <div key={idx} className="flex gap-3">
                      <input 
                        type="text" placeholder="Nome do link" value={link.label} 
                        onChange={e => {
                          const newL = [...links]; newL[idx].label = e.target.value; setLinks(newL);
                        }}
                        className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold" 
                      />
                      <input 
                        type="text" placeholder="URL" value={link.url}
                        onChange={e => {
                          const newL = [...links]; newL[idx].url = e.target.value; setLinks(newL);
                        }}
                        className="flex-[2] bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold" 
                      />
                   </div>
                ))}
                <button type="button" onClick={() => setLinks(prev => [...prev, { label:'', url:'' }])} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">+ Adicionar link</button>
             </div>
          </section>

        </form>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-400">
            <Info className="w-4 h-4" />
            <span className="text-[9px] font-black uppercase tracking-widest">
              Esta decisão será sincronizada com a Inteligência do Produto.
            </span>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={onClose}
              className="px-8 py-4 text-slate-500 font-black uppercase tracking-widest text-[10px] hover:text-slate-700 transition-all border border-slate-200 rounded-2xl bg-white"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className="px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:scale-100 active:scale-95 flex items-center gap-2"
            >
              {loading ? <Plus className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              {decision ? 'Salvar Alterações' : 'Registrar Decisão'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
