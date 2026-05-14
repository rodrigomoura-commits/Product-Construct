import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface MindflowSeedData {
  date: string;
  type: string;
  theme: string;
  sub_theme: string;
  knowledge: string;
}

export const MINDFLOW_SEED_DATA: MindflowSeedData[] = [
  // HMM CONCEPTS
  { "date": "2025-10-28", "type": "Base", "theme": "HMM", "sub_theme": "Conceitos", "knowledge": "O Hotmart Maturity Model (HMM) é o modelo oficial da Hotmart para medir e evoluir a maturidade das squads e tribos, avaliando práticas de estratégia, cultura, discovery, delivery e métricas de eficiência." },
  { "date": "2025-10-28", "type": "Base", "theme": "HMM", "sub_theme": "Conceitos", "knowledge": "O HMM conecta práticas operacionais, cultura organizacional e entrega de valor, transformando maturidade em um indicador de alinhamento estratégico e eficiência." },
  { "date": "2025-10-28", "type": "Base", "theme": "HMM", "sub_theme": "Dimensões", "knowledge": "O HMM possui quatro dimensões: Estratégia e Portfólio, Desenvolvimento e Cultura, Discovery e Delivery, e Métricas de Eficiência e Melhoria Contínua." },
  
  // PORTFOLIO HOTMART
  { "date": "2025-10-28", "type": "Base", "theme": "Portfólio Hotmart", "sub_theme": "Conceitos", "knowledge": "O Portfólio da Hotmart conecta estratégia, operação e cultura, garantindo que as entregas das squads estejam alinhadas ao negócio e aos OKRs corporativos." },
  { "date": "2025-10-28", "type": "Base", "theme": "Portfólio Hotmart", "sub_theme": "Iniciativas", "knowledge": "Iniciativas (horizonte trimestral) e Épicos (horizonte mensal) são os níveis centrais de execução no PORTMPROD." },
  { "date": "2025-10-28", "type": "Base", "theme": "Portfólio Hotmart", "sub_theme": "Capacidade", "knowledge": "O Capacity Allocation distribui esforço entre Novas Capacidades, Débitos Técnicos, Sustentação (KTLO) e Melhorias." },

  // LEI DO BEM & CAPITALIZAÇÃO
  { "date": "2025-10-28", "type": "Base", "theme": "Lei do Bem", "sub_theme": "Conceitos", "knowledge": "A Lei do Bem (Lei 11.196/2005) concede incentivos fiscais para inovação tecnológica, exigindo documentação de incertezas e riscos técnicos." },
  { "date": "2025-10-28", "type": "Base", "theme": "Portfólio Hotmart", "sub_theme": "Capitalização", "knowledge": "A Capitalização transforma despesas operacionais (OPEX) em ativos (CAPEX) para investimentos em P&D de software." },

  // PRODUCT FRAMEWORK
  { "date": "2026-01-06", "type": "Base", "theme": "Product Framework", "sub_theme": "Definição", "knowledge": "O Product Framework orienta a concepção e evolução de produtos, unindo estratégia, discovery, princípios e posicionamento para gerar valor real." },
  { "date": "2026-01-06", "type": "Base", "theme": "Product Framework", "sub_theme": "Value Proposition", "knowledge": "A Value Proposition conecta dores, necessidades e aspirações do usuário às capacidades reais do produto, orientando design e comunicação." },
  { "date": "2026-01-06", "type": "Base", "theme": "Product Framework", "sub_theme": "Princípios", "knowledge": "O princípio 'Let Value Lead the Way' estabelece que decisões de produto devem partir do valor gerado ao creator e ao negócio." },

  // EFFICIENCY METRICS
  { "date": "2025-12-03", "type": "Base", "theme": "Métricas de Eficiência", "sub_theme": "Lead Time", "knowledge": "Lead Time mede o tempo total desde o compromisso até a entrega final em produção, refletindo a experiência do cliente." },
  { "date": "2025-12-03", "type": "Base", "theme": "Métricas de Eficiência", "sub_theme": "Cycle Time", "knowledge": "Cycle Time foca na eficiência de execução pura, medindo o tempo gasto no desenvolvimento ativo." },
  { "date": "2025-12-03", "type": "Base", "theme": "Métricas de Eficiência", "sub_theme": "Throughput", "knowledge": "Throughput indica a quantidade de trabalho concluído em um período, sendo essencial para previsibilidade e ritmo." },
  { "date": "2025-12-03", "type": "Base", "theme": "Métricas de Eficiência", "sub_theme": "Flow Efficiency", "knowledge": "Flow Efficiency é a proporção entre tempo ativo de trabalho e tempo total no fluxo (lead time), revelando gargalos de espera." },

  // STATE OF AGILE 2025
  { "date": "2025-10-29", "type": "Adquirida", "theme": "State of Agile Report", "sub_theme": "Contexto", "knowledge": "A 18ª edição (2025) destaca a 'Quarta Onda do Desenvolvimento', integrando IA em todo o ciclo ágil, do planejamento à entrega." },
  { "date": "2025-10-29", "type": "Adquirida", "theme": "State of Agile Report", "sub_theme": "AI Adoption", "knowledge": "84% das empresas usam ou planejam usar IA; 49% já possuem guardrails definidos para segurança e ética." },
  { "date": "2025-10-29", "type": "Adquirida", "theme": "State of Agile Report", "sub_theme": "Agentic AI", "knowledge": "IA agentiva é a nova fronteira, com agentes autônomos executando decisões sob supervisão humana (human-in-the-loop)." },

  // PERSONALITY & CULTURE
  { "date": "2025-10-28", "type": "Base", "theme": "Agilene Portela", "sub_theme": "Identidade", "knowledge": "Agilene Portela é a mascote Shih Tzu Rock'n'Flow que personifica a união entre pragmatismo métrico e agilidade fluida." },
  { "date": "2025-10-28", "type": "Base", "theme": "Cultura Hotmart", "sub_theme": "Estratégia", "knowledge": "Liberdade, Autonomia e Love são os pilares que sustentam a cultura de aprendizado contínuo e protagonismo na Hotmart." },
  
  // HMM STEPS & DETAILS
  { "date": "2025-10-28", "type": "Base", "theme": "HMM", "sub_theme": "Processo", "knowledge": "O ciclo HMM inclui: preparação (dados/agendas), coleta (entrevistas/evidências), análise (DoDs) e devolutiva (plano de evolução)." },
  { "date": "2025-10-28", "type": "Base", "theme": "HMM", "sub_theme": "Avaliação", "knowledge": "Itens são avaliados como Existente (1 pt), Parcialmente (0) ou Inexistente (0). Apenas 'Existente' soma no score." },

  // METRICS DETAILS
  { "date": "2025-12-03", "type": "Base", "theme": "Métricas de Eficiência", "sub_theme": "Aging WIP", "knowledge": "Aging WIP rastreia há quantos dias itens estão em andamento, identificando gargalos e itens 'esquecidos' no fluxo." },
  { "date": "2025-12-03", "type": "Base", "theme": "Métricas de Eficiência", "sub_theme": "Cálculos", "knowledge": "Cycle Time Iniciativa = (Data Done - Data em Delivery) + 1. O acréscimo de um dia evita zeros." },

  // REDESIGN MODEL 2025
  { "date": "2025-10-28", "type": "Base", "theme": "Portfólio Hotmart", "sub_theme": "Redesign 2025", "knowledge": "O redesign de agosto/2025 reduziu campos obrigatórios de 16 para 7, focando em qualidade e integração com IA." }
];

export async function seedMindflowKnowledge() {
  if (!auth.currentUser) {
     throw new Error("Usuário não autenticado.");
  }

  const userId = auth.currentUser.uid;
  let count = 0;

  for (const item of MINDFLOW_SEED_DATA) {
    try {
      await addDoc(collection(db, 'mindflow_memories'), {
        memory_type: item.type === 'Base' ? 'base' : 'learned',
        title: `${item.theme} - ${item.sub_theme}`,
        content: item.knowledge,
        classification: item.sub_theme.toLowerCase().includes('risco') ? 'risco' : 
                        item.sub_theme.toLowerCase().includes('decisão') ? 'decisão' : 'fato',
        product_id: 'global',
        confidence_score: 1.0,
        relevance_score: 1.0,
        quality_score: 1.0,
        usage_count: 0,
        created_by: userId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        is_active: true,
        is_verified: true,
        is_user_editable: true,
        metadata: {
          original_date: item.date,
          theme: item.theme,
          sub_theme: item.sub_theme
        }
      });
      count++;
    } catch (e) {
      console.error("Error seeding item:", item, e);
    }
  }

  return count;
}
