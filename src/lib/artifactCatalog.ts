export const ARTIFACT_CATALOG: Record<string, any> = {
  understand_problem: {
    stage_id: "understand_problem",
    stage_name: "Entender o Problema",
    framework_key: "sense",
    artifacts: [
      {
        type: "synthesis_brief",
        title: "Synthesis Brief",
        description: "Consolida cliente, contexto, dor, evidências, hipóteses, riscos e lacunas.",
        required_maturity: 60,
        priority: "high",
        is_core: true
      }
    ]
  },

  define_proposal: {
    stage_id: "define_proposal",
    stage_name: "Definir a Proposta",
    framework_key: "shape",
    artifacts: [
      {
        type: "concept_doc",
        title: "Concept Doc",
        description: "Consolida cliente-alvo, problema, proposta de valor, pains, needs, RTBs, diferenciais, riscos e alinhamentos.",
        required_maturity: 60,
        priority: "high",
        is_core: true
      }
    ]
  },

  visualize_solution: {
    stage_id: "visualize_solution",
    stage_name: "Visualizar a Solução",
    framework_key: "sketch",
    artifacts: [
      {
        type: "vignette",
        title: "Vignette",
        description: "Narrativa visual da solução com situação, complicação, resolução e benefício percebido.",
        required_maturity: 50,
        priority: "high",
        is_core: true
      },
      {
        type: "figma_prompts",
        title: "Prompts para Figma",
        description: "Prompts estruturados para gerar protótipo ou direção visual no Figma Make.",
        required_maturity: 50,
        priority: "medium",
        is_core: false
      },
      {
        type: "craft_checklist",
        title: "Checklist de Craft",
        description: "Checklist inicial de experiência, microcopy, estados de interface e consistência visual.",
        required_maturity: 50,
        priority: "medium",
        is_core: false
      }
    ]
  },

  plan_mvp: {
    stage_id: "plan_mvp",
    stage_name: "Planejar o MVP",
    framework_key: "scope",
    artifacts: [
      {
        type: "mvp_scope",
        title: "MVP Scope",
        description: "Define objetivo do MVP, must-haves, should-haves, could-haves, fora de escopo, dependências, riscos e métricas.",
        required_maturity: 60,
        priority: "high",
        is_core: true
      },
      {
        type: "gtm_brief",
        title: "GTM Brief",
        description: "Define público, narrativa, canais, mensagem central e estratégia de lançamento.",
        required_maturity: 60,
        priority: "medium",
        is_core: false
      },
      {
        type: "impact_model",
        title: "Modelo de Impacto",
        description: "Organiza hipótese de impacto, métricas de sucesso, baseline e conexão com objetivos do negócio.",
        required_maturity: 60,
        priority: "medium",
        is_core: false
      },
      {
        type: "initial_roadmap",
        title: "Roadmap Inicial",
        description: "Organiza primeira visão de evolução após o MVP.",
        required_maturity: 60,
        priority: "medium",
        is_core: false
      }
    ]
  },

  prepare_delivery: {
    stage_id: "prepare_delivery",
    stage_name: "Preparar a Entrega",
    framework_key: "ship",
    artifacts: [
      {
        type: "epic",
        title: "Epic",
        description: "Epic pronto para Jira com contexto, problema, escopo, fora de escopo, métricas, dependências e critérios de done.",
        required_maturity: 50,
        priority: "critical",
        is_core: true
      },
      {
        type: "user_stories",
        title: "User Stories",
        description: "Histórias de usuário refinadas com critérios de aceite, regras de negócio, corner cases e perguntas técnicas.",
        required_maturity: 50,
        priority: "critical",
        is_core: true
      },
      {
        type: "acceptance_criteria",
        title: "Critérios de Aceite",
        description: "Critérios de aceite cobrindo caminho feliz, exceções, estados de erro e validações.",
        required_maturity: 50,
        priority: "high",
        is_core: true
      },
      {
        type: "definition_of_done",
        title: "Critérios de Done",
        description: "Critérios mínimos para considerar a entrega pronta com qualidade.",
        required_maturity: 50,
        priority: "high",
        is_core: false
      },
      {
        type: "business_rules",
        title: "Regras de Negócio",
        description: "Regras funcionais e decisões de comportamento do produto.",
        required_maturity: 50,
        priority: "high",
        is_core: false
      },
      {
        type: "delivery_checklist",
        title: "Checklist de Execução",
        description: "Checklist de dependências, validações, riscos e próximos passos para execução.",
        required_maturity: 50,
        priority: "medium",
        is_core: false
      }
    ]
  },

  monitor_learn: {
    stage_id: "monitor_learn",
    stage_name: "Acompanhar e Aprender",
    framework_key: "sense_plus",
    artifacts: [
      {
        type: "health_dashboard",
        title: "Health Dashboard",
        description: "Resumo de métricas, adoção, retenção, tickets, bugs, feedbacks e sinais de saúde.",
        required_maturity: 50,
        priority: "high",
        is_core: true
      },
      {
        type: "learnings_log",
        title: "Learnings Log",
        description: "Registro de hipóteses confirmadas, refutadas, aprendizados e recomendações para o próximo ciclo.",
        required_maturity: 50,
        priority: "high",
        is_core: true
      },
      {
        type: "retro_summary",
        title: "Resumo de Retro",
        description: "Síntese de aprendizados do time, pontos de melhoria e ações recomendadas.",
        required_maturity: 50,
        priority: "medium",
        is_core: false
      },
      {
        type: "next_iteration_recommendations",
        title: "Recomendações para Próxima Iteração",
        description: "Recomendações para iterar, escalar, pausar ou revisar o produto.",
        required_maturity: 50,
        priority: "high",
        is_core: false
      }
    ]
  }
};

export function getArtifactsByStage(stageId: string) {
  return ARTIFACT_CATALOG[stageId]?.artifacts || [];
}

export function getArtifactDefinition(stageId: string, type: string) {
  return ARTIFACT_CATALOG[stageId]?.artifacts.find((artifact: any) => artifact.type === type);
}

export function getStageArtifactCatalog() {
  return ARTIFACT_CATALOG;
}
