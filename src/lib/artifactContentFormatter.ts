import { marked } from 'marked';
import TurndownService from 'turndown';
import DOMPurify from 'dompurify';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

// Avoid converting badges/smart blocks back to raw text in a way that breaks them
turndownService.addRule('smartBadges', {
  filter: (node) => {
    return node.nodeName === 'SPAN' && node.getAttribute('data-smart-block') !== null;
  },
  replacement: (content) => {
    return `[${content}]`;
  }
});

export function artifactMarkdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return '';

  const normalized = markdown
    // Fix cases where AI puts markdown stuck to text
    .replace(/---\s*#/g, '---\n\n#')
    .replace(/([^\n])(\s*#{1,3}\s)/g, '$1\n\n$2')
    .replace(/([^\n])(\s*-\s)/g, '$1\n$2')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  const rawHtml = marked.parse(normalized, {
    breaks: true,
    gfm: true,
  }) as string;

  const sanitizedHtml = DOMPurify.sanitize(rawHtml);
  return enhanceSemanticBadges(sanitizedHtml);
}

export function artifactHtmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return '';
  return turndownService.turndown(html);
}

function enhanceSemanticBadges(html: string): string {
  return html
    .replace(/\[FATO\]/g, '<span data-smart-block="fact" class="smart-badge smart-badge-fact">FATO</span>')
    .replace(/\[HIPÓTESE\]/g, '<span data-smart-block="hypothesis" class="smart-badge smart-badge-hypothesis">HIPÓTESE</span>')
    .replace(/\[EVIDÊNCIA\]/g, '<span data-smart-block="evidence" class="smart-badge smart-badge-evidence">EVIDÊNCIA</span>')
    .replace(/\[DECISÃO\]/g, '<span data-smart-block="decision" class="smart-badge smart-badge-decision">DECISÃO</span>')
    .replace(/\[RISCO\]/g, '<span data-smart-block="risk" class="smart-badge smart-badge-risk">RISCO</span>')
    .replace(/\[LACUNA\]/g, '<span data-smart-block="gap" class="smart-badge smart-badge-gap">LACUNA</span>');
}

export function artifactToEditorContent(artifact: any): string {
  if (artifact?.content_html && artifact.content_html.trim()) {
    return artifact.content_html;
  }

  if (artifact?.content && artifact.content.trim()) {
    return artifactMarkdownToHtml(artifact.content);
  }

  return artifactMarkdownToHtml(getDefaultArtifactTemplate(artifact?.type));
}

export function getDefaultArtifactTemplate(type?: string): string {
  switch (type) {
    case 'synthesis_brief':
      return `# Synthesis Brief

## Cliente observado

## Contexto de uso

## Dor principal

## Evidências

## Hipóteses

## Riscos

## Lacunas

## Próximo passo recomendado`;

    case 'concept_doc':
      return `# Concept Doc

## Cliente-alvo

## Problema

## Proposta de valor

## Pains

## Needs

## RTBs

## Diferenciais

## Riscos`;

    case 'epic':
      return `# Epic

## Contexto

## Problema que resolve

## Escopo

## Fora de escopo

## Métricas de sucesso

## Dependências

## Critérios de Done

## Riscos`;

    case 'user_stories':
      return `# User Stories

## História 1

Como [persona], quero [ação], para [benefício].

### Critérios de aceite

- Dado que...
- Quando...
- Então...

### Corner cases

### Perguntas técnicas`;

    default:
      return `# Artefato

## Contexto

## Conteúdo

## Próximos passos`;
  }
}

export function cleanGeneratedArtifactMarkdown(markdown: string): string {
  return markdown
    .replace(/^Olá,\s*eu sou a\s*\*\*Tona\*\*.*?\n/i, '')
    .replace(/^Com base nos dados fornecidos.*?\n/i, '')
    .trim();
}
