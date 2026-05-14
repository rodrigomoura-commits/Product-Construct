import { Artifact } from '../../../types';

export const ARTIFACT_TEMPLATES: Record<string, string> = {
  synthesis_brief: `# Synthesis Brief

## Cliente observado

## Contexto de uso

## Dor principal

## Evidências qualitativas

## Evidências quantitativas

## Hipóteses

## Riscos de interpretação

## Lacunas

## Próximo passo recomendado`,

  concept_doc: `# Concept Doc

## Cliente-alvo

## Hair-on-fire problem

## Pains

## Needs

## Proposta de valor

## RTBs

## Diferenciais

## Riscos

## Alinhamentos necessários`,

  vignette: `# Vignette

## Situação inicial

## Complicação

## Resolução proposta

## Benefício percebido

## Fluxo principal

## Prompts para Figma

## Riscos de experiência`,

  mvp_scope: `# MVP Scope

## Objetivo do MVP

## Must-haves

## Should-haves

## Could-haves

## Fora de escopo

## Dependências

## Métricas de sucesso

## Impacto esperado`,

  epic: `# Epic

## Contexto

## Problema que resolve

## Escopo

## Fora de escopo

## Métricas de sucesso

## Dependências

## Critérios de Done

## Riscos

## Links relacionados`,

  user_stories: `# User Stories

## História 1

Como [persona],
quero [ação],
para [benefício].

### Critérios de aceite
- Dado que...
- Quando...
- Então...

### Corner cases

### Perguntas técnicas`,

  learnings_log: `# Learnings Log

## Métricas observadas

## Feedbacks

## Hipóteses confirmadas

## Hipóteses refutadas

## Aprendizados

## Decisões de continuidade

## Recomendações para próxima iteração`
};

export function calculateQuality(artifact: Artifact) {
  const text = artifact.plain_text || artifact.content || "";
  let score = 0;
  const findings: string[] = [];
  const missing: string[] = [];

  const checkSection = (keywords: string[], weight: number, name: string) => {
    const found = keywords.some(k => text.toLowerCase().includes(k.toLowerCase()));
    if (found) {
      score += weight;
      findings.push(`Seção ${name} identificada.`);
    } else {
      missing.push(name);
    }
  };

  if (artifact.type === 'epic') {
    checkSection(['contexto'], 15, 'Contexto');
    checkSection(['problema que resolve', 'problema'], 15, 'Problema');
    checkSection(['escopo'], 15, 'Escopo');
    checkSection(['fora de escopo'], 10, 'Fora de Escopo');
    checkSection(['métricas de sucesso', 'métricas'], 15, 'Métricas');
    checkSection(['dependências'], 10, 'Dependências');
    checkSection(['critérios de done', 'definition of done'], 15, 'Critérios de Done');
    checkSection(['riscos'], 5, 'Riscos');
  } else if (artifact.type === 'user_stories') {
    checkSection(['como', 'persona'], 15, 'Persona');
    checkSection(['quero', 'ação'], 15, 'Ação');
    checkSection(['para', 'benefício'], 15, 'Benefício');
    checkSection(['critérios de aceite'], 25, 'Critérios de Aceite');
    checkSection(['corner cases'], 15, 'Corner Cases');
    checkSection(['perguntas técnicas'], 15, 'Perguntas Técnicas');
  } else {
    // Generic maturity check
    if (text.length > 500) score += 40;
    else if (text.length > 100) score += 20;
    
    if (text.includes('##')) score += 30;
    if (text.includes('- ')) score += 30;
  }

  let status: Artifact['quality_status'] = 'draft';
  if (score === 0) status = 'empty';
  else if (score >= 80) status = 'strong';
  else if (score >= 50) status = 'sufficient';
  else if (score > 0) status = 'draft';

  return { score, status, findings, missing };
}
