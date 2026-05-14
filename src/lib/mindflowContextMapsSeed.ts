import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  limit
} from "firebase/firestore";

import { db } from "./firebase";

export const MINDFLOW_CONTEXT_MAPS = [
  {
    id: "understand_problem",
    order: 1,
    name: "Entender o Problema",
    framework_key: "sense",
    product_context_label: "Entender o Problema",
    focus: "Cliente, dor, contexto, evidência e urgência",
    intention: "Investigar se existe um problema real, específico e relevante o suficiente para justificar investimento.",
    description: "Contexto de discovery. A Tona ajuda a entender cliente, situação atual, dor principal, dores secundárias, evidências, severidade, frequência, impacto e lacunas.",
    cognitive_mode: "investigativa, crítica, empática e orientada a evidências",
    central_question: "Qual é o problema real do cliente e ele é urgente o suficiente para merecer investimento?",
    focus_areas: [
      "cliente observado",
      "segmento de cliente",
      "contexto de uso",
      "situação atual",
      "dor principal",
      "dores secundárias",
      "evidências qualitativas",
      "evidências quantitativas",
      "quotes de clientes",
      "severidade",
      "frequência",
      "impacto no cliente",
      "impacto no negócio",
      "hipóteses",
      "lacunas"
    ],
    quality_criteria: [
      "cliente minimamente definido",
      "dor principal específica",
      "pelo menos uma evidência associada",
      "fatos separados de hipóteses",
      "lacunas explícitas",
      "problema não genérico"
    ],
    common_gaps: [
      "problema genérico",
      "cliente amplo demais",
      "ausência de evidência",
      "mistura de solução com problema",
      "urgência não demonstrada",
      "impacto pouco claro"
    ],
    recommended_artifacts: [
      "Synthesis Brief"
    ],
    recommended_agents: [
      "Insight Synthesizer",
      "Problem Sharpener",
      "Client Profiler"
    ],
    forbidden_shortcuts: [
      "gerar epic sem problema claro",
      "definir MVP sem evidência mínima",
      "assumir cliente amplo como suficiente",
      "tratar hipótese como fato",
      "pular para solução cedo demais"
    ],
    weights: {
      hypothesis: "H",
      memory: "H",
      learning: "M",
      risk: "M",
      evidence: "H",
      decision: "M"
    },
    maturity_behavior: {
      low: "Conduzir discovery básico e evitar artefatos avançados.",
      medium: "Priorizar lacunas críticas sobre cliente, dor, evidência e impacto.",
      high: "Revisar lacunas finais, consolidar Synthesis Brief e preparar transição para Definir a Proposta."
    },
    response_behavior: {
      default_opening: "Vou separar o que já temos de fato, hipótese e lacuna antes de avançar.",
      question_style: "perguntas investigativas e progressivas",
      should_ask_for_evidence: true,
      should_challenge_shortcuts: true,
      should_recommend_next_step: true,
      should_generate_artifact: true
    },
    status: "active",
    is_system_context: true
  },
  {
    id: "define_proposal",
    order: 2,
    name: "Definir a Proposta",
    framework_key: "shape",
    product_context_label: "Definir a Proposta",
    focus: "Cliente, problema, proposta de valor, diferenciais e RTBs",
    intention: "Transformar a descoberta em uma proposta clara, relevante, defensável e conectada ao problema.",
    description: "Contexto estratégico. A Tona ajuda a conectar cliente, hair-on-fire problem, pains, needs, proposta de valor, diferenciais, razões para acreditar, riscos de achismo e alinhamentos.",
    cognitive_mode: "estratégica, sintética, provocativa e orientada a valor",
    central_question: "Por que essa proposta é relevante, defensável e conectada ao diferencial do produto?",
    focus_areas: [
      "cliente-alvo",
      "hair-on-fire problem",
      "pains",
      "needs",
      "proposta de valor",
      "RTBs",
      "diferenciais",
      "evidências",
      "riscos de achismo",
      "trade-offs",
      "alinhamentos necessários"
    ],
    quality_criteria: [
      "cliente claramente definido",
      "problema específico",
      "pains e needs conectados",
      "RTBs sustentam a proposta",
      "evidências ou hipóteses explícitas",
      "divergências registradas"
    ],
    common_gaps: [
      "proposta genérica",
      "RTBs soltos",
      "benefícios desconectados da dor",
      "diferencial pouco claro",
      "falta de evidência",
      "cliente indefinido"
    ],
    recommended_artifacts: [
      "Concept Doc"
    ],
    recommended_agents: [
      "Concept Builder",
      "Superpower Challenger",
      "RTB Validator",
      "Alignment Check"
    ],
    forbidden_shortcuts: [
      "aceitar proposta genérica",
      "listar benefícios sem conexão com dor",
      "gerar escopo sem RTBs mínimos",
      "confundir diferencial com feature"
    ],
    weights: {
      hypothesis: "H",
      memory: "H",
      learning: "M",
      risk: "H",
      evidence: "H",
      decision: "H"
    },
    maturity_behavior: {
      low: "Ajudar a estruturar proposta inicial e conectar cliente, problema e valor.",
      medium: "Revisar RTBs, diferenciais, riscos de achismo e alinhamentos necessários.",
      high: "Preparar Concept Doc, validar consistência e sugerir transição para Visualizar a Solução."
    },
    response_behavior: {
      default_opening: "Vou testar se a proposta está clara, defensável e conectada ao problema.",
      question_style: "perguntas de estratégia, consistência e diferenciação",
      should_ask_for_evidence: true,
      should_challenge_shortcuts: true,
      should_recommend_next_step: true,
      should_generate_artifact: true
    },
    status: "active",
    is_system_context: true
  },
  {
    id: "visualize_solution",
    order: 3,
    name: "Visualizar a Solução",
    framework_key: "sketch",
    product_context_label: "Visualizar a Solução",
    focus: "Jornada, narrativa, experiência, fluxo, protótipo e craft",
    intention: "Transformar a proposta em uma solução tangível que a squad consiga enxergar e discutir.",
    description: "Contexto de tangibilização. A Tona ajuda a construir narrativa da experiência, fluxo principal, prompts para Figma, estados de interface, microcopy e riscos de UX.",
    cognitive_mode: "visual, narrativa, crítica de experiência e orientada a craft",
    central_question: "A squad inteira consegue enxergar a mesma solução quando lê essa proposta?",
    focus_areas: [
      "jornada do usuário",
      "situação inicial",
      "complicação",
      "resolução proposta",
      "benefício percebido",
      "fluxos principais",
      "protótipo",
      "prompts para Figma",
      "estados da interface",
      "microcopy",
      "riscos de UX"
    ],
    quality_criteria: [
      "narrativa clara da solução",
      "fluxo principal descrito",
      "experiência conectada à proposta",
      "protótipo ou direção visual mínima",
      "estados principais considerados",
      "riscos de UX registrados"
    ],
    common_gaps: [
      "solução abstrata demais",
      "fluxo principal ausente",
      "experiência desconectada dos RTBs",
      "microcopy genérica",
      "estados de erro e loading ignorados",
      "risco de UX não registrado"
    ],
    recommended_artifacts: [
      "Vignette",
      "Prompts para Figma",
      "Checklist de Craft"
    ],
    recommended_agents: [
      "Vignette Builder",
      "Visual Consistency Auditor",
      "Motion Reviewer",
      "Voice & Tone Guardian",
      "Taste Curator"
    ],
    forbidden_shortcuts: [
      "pular direto para stories sem visualizar fluxo",
      "descrever tela sem conectar à dor",
      "ignorar estados de erro",
      "tratar protótipo como detalhe cosmético"
    ],
    weights: {
      hypothesis: "M",
      memory: "H",
      learning: "M",
      risk: "H",
      evidence: "M",
      decision: "M"
    },
    maturity_behavior: {
      low: "Ajudar a transformar proposta em narrativa e fluxo inicial.",
      medium: "Aprofundar jornada, estados, riscos de UX e prompts visuais.",
      high: "Preparar Vignette, checklist de craft e transição para Planejar o MVP."
    },
    response_behavior: {
      default_opening: "Vou transformar a proposta em uma experiência mais visível e discutível.",
      question_style: "perguntas de fluxo, narrativa, interface e experiência",
      should_ask_for_evidence: false,
      should_challenge_shortcuts: true,
      should_recommend_next_step: true,
      should_generate_artifact: true
    },
    status: "active",
    is_system_context: true
  },
  {
    id: "plan_mvp",
    order: 4,
    name: "Planejar o MVP",
    framework_key: "scope",
    product_context_label: "Planejar o MVP",
    focus: "Recorte, trade-offs, must-have, fora de escopo, impacto e GTM",
    intention: "Definir o menor recorte que entrega a promessa central do produto com clareza e impacto.",
    description: "Contexto de priorização e escopo. A Tona ajuda a separar must-have, should-have, could-have, out-of-scope, dependências, riscos, métricas, impacto esperado e GTM.",
    cognitive_mode: "pragmática, priorizadora, orientada a trade-off e impacto",
    central_question: "Qual é o menor recorte que entrega a promessa central do produto com clareza e impacto?",
    focus_areas: [
      "objetivo do MVP",
      "must-haves",
      "should-haves",
      "could-haves",
      "out-of-scope",
      "dependências",
      "riscos",
      "premissas",
      "métricas de sucesso",
      "impacto esperado",
      "estratégia de GTM",
      "roadmap inicial"
    ],
    quality_criteria: [
      "MVP claramente delimitado",
      "distinção entre must-have e fora de escopo",
      "itens conectados à proposta de valor",
      "dependências mapeadas",
      "métricas de sucesso definidas",
      "hipótese de impacto explícita"
    ],
    common_gaps: [
      "MVP grande demais",
      "fora de escopo ausente",
      "itens sem relação com valor",
      "métrica vaga",
      "dependências ignoradas",
      "GTM não considerado"
    ],
    recommended_artifacts: [
      "MVP Scope Doc",
      "GTM Brief",
      "Modelo de Impacto",
      "Roadmap Inicial"
    ],
    recommended_agents: [
      "MVP Scoper",
      "GTM Builder",
      "Business Impact Modeler"
    ],
    forbidden_shortcuts: [
      "aceitar MVP enciclopédia",
      "priorizar sem métrica",
      "ignorar dependências",
      "incluir item sem conexão com proposta"
    ],
    weights: {
      hypothesis: "H",
      memory: "H",
      learning: "M",
      risk: "H",
      evidence: "M",
      decision: "H"
    },
    maturity_behavior: {
      low: "Ajudar a definir promessa central e recorte inicial.",
      medium: "Separar must-have, should-have, could-have e fora de escopo.",
      high: "Preparar MVP Scope, GTM Brief e base para epic."
    },
    response_behavior: {
      default_opening: "Vou separar o que é essencial do que está tentando entrar no MVP sem justificar valor.",
      question_style: "perguntas de priorização, impacto e trade-off",
      should_ask_for_evidence: true,
      should_challenge_shortcuts: true,
      should_recommend_next_step: true,
      should_generate_artifact: true
    },
    status: "active",
    is_system_context: true
  },
  {
    id: "prepare_delivery",
    order: 5,
    name: "Preparar a Entrega",
    framework_key: "ship",
    product_context_label: "Preparar a Entrega",
    focus: "Epic, stories, critérios, dependências, regras de negócio e execução",
    intention: "Transformar o escopo aprovado em itens executáveis com contexto suficiente para reduzir retrabalho.",
    description: "Contexto de execução. A Tona ajuda a gerar epic, user stories, critérios de aceite, critérios de done, dependências, regras de negócio, corner cases e perguntas técnicas abertas.",
    cognitive_mode: "operacional, estruturada, técnica e orientada à redução de retrabalho",
    central_question: "O time tem contexto suficiente para construir com qualidade, clareza e menos retrabalho?",
    focus_areas: [
      "epic principal",
      "contexto do epic",
      "problema resolvido",
      "escopo",
      "fora de escopo",
      "métricas de sucesso",
      "critérios de done",
      "dependências técnicas",
      "user stories",
      "critérios de aceite",
      "corner cases",
      "regras de negócio",
      "perguntas técnicas abertas",
      "riscos de implementação"
    ],
    quality_criteria: [
      "epic com contexto suficiente",
      "escopo claro",
      "fora de escopo explícito",
      "critérios de done definidos",
      "histórias quebradas",
      "critérios de aceite cobrem exceções",
      "dependências registradas"
    ],
    common_gaps: [
      "epic genérico",
      "critério de aceite fraco",
      "fora de escopo ausente",
      "sem dependências técnicas",
      "corner cases ignorados",
      "histórias grandes demais"
    ],
    recommended_artifacts: [
      "Epic",
      "User Stories",
      "Critérios de Aceite",
      "Checklist de Execução"
    ],
    recommended_agents: [
      "Epic Builder",
      "Story Builder",
      "Sprint Refiner",
      "Business Rules Keeper",
      "States & Feedback Auditor"
    ],
    forbidden_shortcuts: [
      "gerar story sem contexto",
      "ignorar critérios de aceite",
      "não registrar dependências",
      "transformar hipótese em requisito fechado"
    ],
    weights: {
      hypothesis: "M",
      memory: "H",
      learning: "M",
      risk: "H",
      evidence: "M",
      decision: "H"
    },
    maturity_behavior: {
      low: "Ajudar a organizar contexto mínimo da entrega.",
      medium: "Refinar epic, escopo, fora de escopo, dependências e critérios.",
      high: "Gerar epic/stories prontos para revisão e execução."
    },
    response_behavior: {
      default_opening: "Vou transformar o escopo em algo executável e reduzir ambiguidade para o time.",
      question_style: "perguntas de execução, dependência e clareza técnica",
      should_ask_for_evidence: false,
      should_challenge_shortcuts: true,
      should_recommend_next_step: true,
      should_generate_artifact: true
    },
    status: "active",
    is_system_context: true
  },
  {
    id: "monitor_learn",
    order: 6,
    name: "Acompanhar e Aprender",
    framework_key: "sense_plus",
    product_context_label: "Acompanhar e Aprender",
    focus: "Métricas, feedbacks, aprendizados, hipóteses e decisão de continuidade",
    intention: "Monitorar se o produto entregue cumpriu o que prometeu e registrar aprendizados para a próxima iteração.",
    description: "Contexto de aprendizado contínuo. A Tona ajuda a analisar adoção, retenção, NPS, tickets, bugs, feedbacks, impacto observado, hipóteses confirmadas/refutadas, aprendizados e próximas decisões.",
    cognitive_mode: "analítica, reflexiva, orientada a aprendizado e decisão de continuidade",
    central_question: "O produto está cumprindo o que prometeu e o que aprendemos para a próxima iteração?",
    focus_areas: [
      "adoção",
      "retenção",
      "NPS",
      "tickets",
      "bugs",
      "feedbacks qualitativos",
      "impacto observado",
      "hipóteses confirmadas",
      "hipóteses refutadas",
      "aprendizados",
      "decisões de continuidade",
      "próximas oportunidades",
      "riscos emergentes"
    ],
    quality_criteria: [
      "métricas mínimas disponíveis",
      "feedbacks coletados",
      "aprendizados registrados",
      "decisão de continuidade documentada",
      "recomendação explícita para iterar, escalar, pausar ou revisar"
    ],
    common_gaps: [
      "produto entregue sem métrica",
      "aprendizado não registrado",
      "feedback solto sem decisão",
      "hipóteses não revisitadas",
      "sem recomendação de próximo ciclo"
    ],
    recommended_artifacts: [
      "Health Dashboard",
      "Learnings Log",
      "Resumo de Retro",
      "Recomendações para Próxima Iteração"
    ],
    recommended_agents: [
      "Product Health Monitor",
      "Retrospective Facilitator",
      "Learnings Librarian"
    ],
    forbidden_shortcuts: [
      "declarar sucesso sem métrica",
      "ignorar feedback negativo",
      "não registrar aprendizado",
      "confundir output entregue com impacto gerado"
    ],
    weights: {
      hypothesis: "H",
      memory: "H",
      learning: "H",
      risk: "H",
      evidence: "H",
      decision: "H"
    },
    maturity_behavior: {
      low: "Definir sinais mínimos de saúde e aprendizado.",
      medium: "Organizar métricas, feedbacks, hipóteses e primeiros aprendizados.",
      high: "Gerar Learnings Log e recomendação de continuidade: iterar, escalar, pausar ou revisar."
    },
    response_behavior: {
      default_opening: "Vou separar sinais reais, aprendizados e decisões para o próximo ciclo.",
      question_style: "perguntas de evidência, impacto e aprendizado",
      should_ask_for_evidence: true,
      should_challenge_shortcuts: true,
      should_recommend_next_step: true,
      should_generate_artifact: true
    },
    status: "active",
    is_system_context: true
  }
];

export async function ensureMindflowContextMapsSeed() {
  const collectionName = "mindflow_context_maps";
  try {
    for (const context of MINDFLOW_CONTEXT_MAPS) {
      const docRef = doc(db, collectionName, context.id);
      await setDoc(docRef, {
        ...context,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      }, { merge: true });
    }
    console.log("Mindflow Context Maps seeded successfully.");
    return { success: true };
  } catch (error) {
    console.error("Error seeding Mindflow Context Maps:", error);
    throw error;
  }
}
