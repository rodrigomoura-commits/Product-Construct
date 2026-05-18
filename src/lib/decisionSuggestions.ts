import { 
  Product, 
  ProductDecision, 
  ProductDecisionType, 
  ProductDecisionDirection, 
  StageKey, 
  StageField,
  DecisionSuggestion,
  DecisionSuggestionSource
} from '../types';

/**
 * Builds intelligent decision suggestions based on the current product context.
 */
export function buildDecisionSuggestions({
  product,
  activeStage,
  stageFields = [],
  existingDecisions = [],
  conversationSummary,
  strategicSynthesis
}: {
  product: Product;
  activeStage: StageKey;
  stageFields?: StageField[];
  existingDecisions?: ProductDecision[];
  conversationSummary?: string;
  strategicSynthesis?: string;
}): DecisionSuggestion[] {
  const suggestions: DecisionSuggestion[] = [];

  // Helper to check if a decision with a similar title already exists
  const isAlreadyDecided = (title: string) => {
    const normalizedTitle = normalizeKey(title);
    return existingDecisions.some(d => 
      normalizeKey(d.title).includes(normalizedTitle) || 
      normalizedTitle.includes(normalizeKey(d.title))
    );
  };

  // 1. Suggestions from Hypotheses
  const hypotheses = stageFields.filter(f => f.classification === 'hypothesis');
  hypotheses.forEach(h => {
    const suggestionTitle = `Validar: ${h.label || 'Hipótese'}`;
    if (!isAlreadyDecided(suggestionTitle)) {
      suggestions.push({
        id: `hypo-${h.id}`,
        label: h.label || 'Hipótese',
        title: suggestionTitle,
        description: h.value,
        decision_type: 'product',
        source: 'contextual',
        priority: 'medium',
        prefill: {
          title: `Posicionamento: ${h.label}`,
          decision_type: 'product',
          decision_statement: `Definir se o produto seguirá a linha da hipótese: "${h.value}"`,
          rationale: `Esta hipótese foi identificada durante a etapa de ${activeStage}.`,
          stage_key: activeStage,
          impact_areas: ['product', 'experience']
        },
        source_refs: [{ type: 'memory', id: h.id, title: h.label }]
      });
    }
  });

  // 2. Suggestions from Gaps
  const gaps = stageFields.filter(f => f.classification === 'pending' || f.id.includes('gap')); 
  // Note: some gaps might be passed differently, but if we have StageFields classified as pending/gap:
  gaps.forEach(g => {
    if (!isAlreadyDecided(g.label)) {
      suggestions.push({
        id: `gap-${g.id}`,
        label: g.label,
        title: `Decidir: ${g.label}`,
        description: g.value,
        decision_type: inferTypeFromLabel(g.label),
        source: 'gap_based',
        priority: 'high',
        prefill: {
          title: `Definição de ${g.label}`,
          decision_type: inferTypeFromLabel(g.label),
          decision_statement: `Resolver a lacuna: ${g.value}`,
          rationale: `Identificado como uma lacuna aberta que impede o progresso.`,
          stage_key: activeStage
        },
        source_refs: [{ type: 'gap', id: g.id, title: g.label }]
      });
    }
  });

  // 3. Suggestions from Risks
  const risks = stageFields.filter(f => f.classification === 'risk');
  risks.forEach(r => {
    const suggestionTitle = `Mitigar Risco: ${r.label}`;
    if (!isAlreadyDecided(suggestionTitle)) {
      suggestions.push({
        id: `risk-${r.id}`,
        label: r.label,
        title: suggestionTitle,
        description: r.value,
        decision_type: inferTypeFromLabel(r.label),
        source: 'risk_based',
        priority: 'high',
        prefill: {
          title: `Estratégia de Mitigação: ${r.label}`,
          decision_type: inferTypeFromLabel(r.label),
          decision_statement: `Decidir como lidar com o risco: ${r.value}`,
          rationale: `Risco identificado que pode impactar a viabilidade ou entrega.`,
          stage_key: activeStage
        },
        source_refs: [{ type: 'risk', id: r.id, title: r.label }]
      });
    }
  });

  // 4. Stage-based Fallbacks
  const stageFallbacks = getStageFallbacks(activeStage);
  stageFallbacks.forEach(f => {
    if (!isAlreadyDecided(f.title)) {
      suggestions.push(f);
    }
  });

  // 5. Global Fallbacks (if still low on suggestions)
  if (suggestions.length < 4) {
    const globals = getGlobalFallbacks();
    globals.forEach(g => {
      if (!isAlreadyDecided(g.title) && !suggestions.some(s => s.title === g.title)) {
        suggestions.push(g);
      }
    });
  }

  // Deduplicate and Order
  const finalSuggestions = deduplicateSuggestions(suggestions, existingDecisions);
  
  return finalSuggestions.sort((a, b) => {
    // 1. High priority first
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;

    // 2. Then by source order
    const sourceScore: Record<DecisionSuggestionSource, number> = { 
      gap_based: 5, 
      risk_based: 4, 
      contextual: 3, 
      stage_based: 2, 
      fallback: 1 
    };
    
    return (sourceScore[b.source] || 0) - (sourceScore[a.source] || 0);
  });
}

function normalizeKey(str: string): string {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function deduplicateSuggestions(suggestions: DecisionSuggestion[], existingDecisions: ProductDecision[]) {
  const existingKeys = new Set(
    existingDecisions
      .filter(d => d.status === 'active')
      .map(d => normalizeKey(d.title))
  );

  const seen = new Set<string>();

  return suggestions.filter(s => {
    const key = normalizeKey(s.title);

    if (seen.has(key)) return false;
    seen.add(key);

    const alreadyDecided = Array.from(existingKeys).some(existing =>
      existing.includes(key) || key.includes(existing)
    );

    return !alreadyDecided;
  });
}

function inferTypeFromLabel(label: string): ProductDecisionType {
  const l = label.toLowerCase();
  if (l.includes('ia') || l.includes('ai') || l.includes('inteligencia')) return 'ai';
  if (l.includes('dado') || l.includes('data')) return 'data';
  if (l.includes('integra') || l.includes('jira') || l.includes('hubspot')) return 'integration';
  if (l.includes('web') || l.includes('mobile') || l.includes('interface') || l.includes('tela')) return 'experience';
  if (l.includes('mvp') || l.includes('escopo') || l.includes('fatiamento')) return 'mvp_scope';
  if (l.includes('negocio') || l.includes('business') || l.includes('valor')) return 'business';
  if (l.includes('tecnic') || l.includes('tech') || l.includes('arquitetura')) return 'technology';
  if (l.includes('go-to-market') || l.includes('gtm') || l.includes('lancamento')) return 'gtm';
  return 'product';
}

function getStageFallbacks(stage: StageKey): DecisionSuggestion[] {
  const fallbacks: Record<StageKey, Array<Partial<DecisionSuggestion>>> = {
    sense: [
      { label: 'Público Inicial', title: 'Definir Público Inicial', decision_type: 'product', source: 'stage_based', priority: 'medium' },
      { label: 'Dor Prioritária', title: 'Definir Dor Prioritária', decision_type: 'product', source: 'stage_based', priority: 'medium' },
      { label: 'Evidência Mínima', title: 'Aceitar Evidência Mínima', decision_type: 'business', source: 'stage_based', priority: 'medium' },
      { label: 'Origem do Problema', title: 'Problema Interno ou Externo?', decision_type: 'business', source: 'stage_based', priority: 'low' }
    ],
    shape: [
      { label: 'Proposta Principal', title: 'Definir Proposta de Valor Principal', decision_type: 'product', source: 'stage_based', priority: 'medium' },
      { label: 'Modo de Serviço', title: 'Self-service ou Assistido?', decision_type: 'experience', source: 'stage_based', priority: 'medium' },
      { label: 'Papel da IA', title: 'A IA Recomenda ou Decide?', decision_type: 'ai', description: 'Decidir o nível de autonomia da IA na geração de sugestões.', source: 'stage_based', priority: 'high' },
      { label: 'Diferencial', title: 'Qual Diferencial será Defendido?', decision_type: 'product', source: 'stage_based', priority: 'medium' }
    ],
    sketch: [
      { label: 'Plataformas', title: 'Web, Mobile ou Híbrido?', decision_type: 'experience', source: 'stage_based', priority: 'medium' },
      { label: 'Interface', title: 'Fluxo Conversacional ou Formulário?', decision_type: 'experience', source: 'stage_based', priority: 'medium' },
      { label: 'Modo Guiado', title: 'Terá Modo de Introdução Guiada?', decision_type: 'experience', source: 'stage_based', priority: 'low' }
    ],
    scope: [
      { label: 'Fatiamento MVP', title: 'O que fica fora do MVP?', decision_type: 'mvp_scope', source: 'stage_based', priority: 'high' },
      { label: 'Integrações', title: 'Jira entra no MVP?', decision_type: 'integration', description: 'Decidir se a integração com Jira é requisito para o primeiro lançamento.', source: 'stage_based', priority: 'medium' },
      { label: 'Alimentação Dados', title: 'Dado será Manual ou Automático?', decision_type: 'data', description: 'Como os dados de trade-off e progresso serão alimentados no sistema.', source: 'stage_based', priority: 'high' },
      { label: 'Primeiro Valor', title: 'Qual recorte garante Primeiro Valor?', decision_type: 'mvp_scope', description: 'Definir o conjunto mínimo de funcionalidades que entrega o primeiro valor real.', source: 'stage_based', priority: 'high' }
    ],
    ship: [
      { label: 'Estratégia Rollout', title: 'Lançamento Piloto ou Aberto?', decision_type: 'gtm', source: 'stage_based', priority: 'medium' },
      { label: 'Aprovação Final', title: 'Quem aprova a entrega final?', decision_type: 'process', source: 'stage_based', priority: 'medium' },
      { label: 'Canal Rollout', title: 'Qual canal de rollout será usado?', decision_type: 'gtm', source: 'stage_based', priority: 'low' }
    ],
    sense_plus: [
      { label: 'Métrica Sucesso', title: 'Qual métrica decide continuidade?', decision_type: 'business', source: 'stage_based', priority: 'high' },
      { label: 'Definição Sucesso', title: 'O que define sucesso desse ciclo?', decision_type: 'product', source: 'stage_based', priority: 'medium' },
      { label: 'Pivotar ou Manter', title: 'Quando Pivotar?', decision_type: 'strategy' as any, source: 'stage_based', priority: 'medium' }
    ]
  };

  const stageData = fallbacks[stage] || [];
  return stageData.map((d, i) => ({
    id: `stage-${stage}-${i}`,
    label: d.label!,
    title: d.title!,
    decision_type: d.decision_type || 'product',
    source: 'stage_based',
    priority: d.priority || 'medium',
    prefill: {
      title: d.title!,
      decision_type: d.decision_type || 'product',
      stage_key: stage,
    }
  }));
}

function getGlobalFallbacks(): DecisionSuggestion[] {
  return [
    {
      id: 'fallback-ai',
      label: 'Usa IA?',
      title: 'Decidir sobre o uso de IA',
      decision_type: 'ai',
      source: 'fallback',
      priority: 'low',
      prefill: { title: 'Uso de IA no Produto', decision_type: 'ai' }
    },
    {
      id: 'fallback-platform',
      label: 'Web ou Mobile?',
      title: 'Definir plataforma principal',
      decision_type: 'experience',
      source: 'fallback',
      priority: 'low',
      prefill: { title: 'Plataforma Principal', decision_type: 'experience' }
    },
    {
      id: 'fallback-audience',
      label: 'Público Inicial',
      title: 'Definir público-alvo inicial',
      decision_type: 'product',
      source: 'fallback',
      priority: 'low',
      prefill: { title: 'Público Alvo Inicial', decision_type: 'product' }
    },
    {
      id: 'fallback-mvp',
      label: 'Integração no MVP?',
      title: 'Definir integrações do MVP',
      decision_type: 'integration',
      source: 'fallback',
      priority: 'low',
      prefill: { title: 'Integrações do MVP', decision_type: 'integration' }
    }
  ];
}
