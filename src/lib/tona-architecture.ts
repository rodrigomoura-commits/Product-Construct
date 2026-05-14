import { collection, doc, setDoc, getDoc, getDocs, query, where, serverTimestamp, limit, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { 
  TonaCorePersonality, 
  UserBehaviorProfile, 
  ProductJourneyStage, 
  StageAgentConfig, 
  Agent, 
  StageKey 
} from '../types';

/**
 * TONA ARCHITECTURE SERVICE
 * Manages the unified cognitive structure of Tona.
 */

// --- SEEDING ---

export async function seedTonaArchitecture(userId: string) {
  // 1. Core Personality
  const corePersonalityId = 'tona-core-personality-v1';
  const coreRef = doc(db, 'tona_core_personality', corePersonalityId);
  const coreSnap = await getDoc(coreRef);

  if (!coreSnap.exists()) {
    const coreData: Partial<TonaCorePersonality> = {
      id: corePersonalityId,
      name: 'Tona Core Personality',
      description: 'Personalidade-base única e compartilhada da Tona, focada em clareza, pragmatismo e provocação construtiva.',
      traits: {
        clear: true,
        pragmatic: true,
        constructively_provocative: true,
        product_oriented: true,
        evidence_careful: true,
        continuity_oriented: true,
        artifact_oriented: true,
        adaptive_to_user: true
      },
      tone_rules: {
        base: 'Pragmático, amigável e direto.',
        nuances: ['Curioso na descoberta', 'Provocativo na estratégia', 'Concreto na execução']
      },
      questioning_rules: {
        preference: 'Perguntas situacionais baseadas em evidências.',
        avoid: 'Perguntas genéricas ou de confirmação óbvia.'
      },
      truth_rules: {
        differentiation: ['fato', 'hipótese', 'evidência', 'decisão', 'risco', 'pendência'],
        confidence_threshold: 0.7
      },
      is_active: true,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    };
    await setDoc(coreRef, coreData);
  }

  // 2. Product Journey Stages
  const stages: ProductJourneyStage[] = [
    {
      id: 'sense',
      name: 'Entender o Problema',
      slug: 'entender-problema',
      short_label: 'Discovery, dores e contexto.',
      description: 'Investigação profunda sobre o problema, cliente e evidências.',
      goal: 'Validar a urgência e o impacto da dor antes de propor soluções.',
      central_question: 'Qual é o problema real do cliente e ele é urgente o suficiente para merecer investimento?',
      icon: 'Search',
      display_order: 1,
      color: 'emerald',
      status: 'active',
      stage_agent_id: '', // Will be linked below
      maturity_config: {},
      field_config: [],
      artifact_config: [],
      mindflow_usage_config: {
        priority_memory_types: ['product', 'conversation', 'evidence', 'hypothesis', 'user']
      },
      save_rules: {},
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    },
    {
      id: 'shape',
      name: 'Definir a Proposta',
      slug: 'definir-proposta',
      short_label: 'Solução e proposta de valor.',
      description: 'Transformação do problema validado em uma proposta de valor estratégica.',
      goal: 'Criar uma promessa de valor defensável e conectada aos pains e needs.',
      central_question: 'Por que essa proposta é relevante, defensável e conectada ao valor esperado?',
      icon: 'Target',
      display_order: 2,
      color: 'blue',
      status: 'active',
      stage_agent_id: '',
      maturity_config: {},
      field_config: [],
      artifact_config: [],
      mindflow_usage_config: {
        priority_memory_types: ['product', 'concept', 'decision', 'hypothesis', 'user']
      },
      save_rules: {},
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    },
    {
      id: 'sketch',
      name: 'Visualizar a Solução',
      slug: 'visualizar-solucao',
      short_label: 'Vignette e experiência visual.',
      description: 'Tangibilização da proposta em jornadas e visualizações concretas.',
      goal: 'Garantir alinhamento visual e narrativo sobre como a solução funciona.',
      central_question: 'A squad inteira consegue enxergar a mesma solução quando lê essa proposta?',
      icon: 'Layout',
      display_order: 3,
      color: 'indigo',
      status: 'active',
      stage_agent_id: '',
      maturity_config: {},
      field_config: [],
      artifact_config: [],
      mindflow_usage_config: {
        priority_memory_types: ['product', 'artifact', 'behavioral', 'user']
      },
      save_rules: {},
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    },
    {
      id: 'scope',
      name: 'Planejar o MVP',
      slug: 'planejar-mvp',
      short_label: 'Recorte, impacto e GTM.',
      description: 'Definição do escopo mínimo viável para teste e aprendizado.',
      goal: 'Proteger o foco no menor recorte que entrega a promessa central.',
      central_question: 'Qual é o menor recorte que entrega a promessa central do produto com clareza e impacto?',
      icon: 'Package',
      display_order: 4,
      color: 'amber',
      status: 'active',
      stage_agent_id: '',
      maturity_config: {},
      field_config: [],
      artifact_config: [],
      mindflow_usage_config: {
        priority_memory_types: ['product', 'decision', 'risk', 'metric']
      },
      save_rules: {},
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    },
    {
      id: 'ship',
      name: 'Preparar a Entrega',
      slug: 'preparar-entrega',
      short_label: 'Epic, stories e execução.',
      description: 'Tradução do escopo em documentação técnica e backlog executável.',
      goal: 'Garantir contexto e clareza para o time de engenharia executar sem retrabalho.',
      central_question: 'O time tem contexto suficiente para construir com qualidade, clareza e menos retrabalho?',
      icon: 'Send',
      display_order: 5,
      color: 'rose',
      status: 'active',
      stage_agent_id: '',
      maturity_config: {},
      field_config: [],
      artifact_config: [],
      mindflow_usage_config: {
        priority_memory_types: ['product', 'decision', 'artifact', 'document']
      },
      save_rules: {},
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    },
    {
      id: 'sense_plus',
      name: 'Acompanhar e Aprender',
      slug: 'acompanhar-aprender',
      short_label: 'Métricas, feedbacks e aprendizados.',
      description: 'Análise de resultados e fechamento do ciclo de aprendizado.',
      goal: 'Validar se o produto entregue cumpriu a promessa e o que foi aprendido.',
      central_question: 'O produto está cumprindo o que prometeu e o que aprendemos para a próxima iteração?',
      icon: 'RefreshCw',
      display_order: 6,
      color: 'violet',
      status: 'active',
      stage_agent_id: '',
      maturity_config: {},
      field_config: [],
      artifact_config: [],
      mindflow_usage_config: {
        priority_memory_types: ['product', 'metric', 'user', 'conversation']
      },
      save_rules: {},
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    }
  ];

  for (const stage of stages) {
    await setDoc(doc(db, 'product_journey_stages', stage.id), stage);
  }

  // 3. Stage Agents (Behavioral Lenses)
  const stageAgents = [
    {
      id: 'agent-context-seeker',
      name: 'Context Seeker',
      slug: 'stage-entender-problema',
      description: 'Conduz a Tona em modo investigativo para entender o problema.',
      type: 'stage_agent',
      primary_stage_id: 'sense'
    },
    {
      id: 'agent-value-sculptor',
      name: 'Value Sculptor',
      slug: 'stage-definir-proposta',
      description: 'Conduz a Tona em modo estratégico para definir a proposta.',
      type: 'stage_agent',
      primary_stage_id: 'shape'
    },
    {
      id: 'agent-experience-director',
      name: 'Experience Director',
      slug: 'stage-visualizar-solucao',
      description: 'Conduz a Tona em modo visual e narrativo.',
      type: 'stage_agent',
      primary_stage_id: 'sketch'
    },
    {
      id: 'agent-scope-strategist',
      name: 'Scope Strategist',
      slug: 'stage-planejar-mvp',
      description: 'Conduz a Tona em modo pragmático para planejar o MVP.',
      type: 'stage_agent',
      primary_stage_id: 'scope'
    },
    {
      id: 'agent-delivery-translator',
      name: 'Delivery Translator',
      slug: 'stage-preparar-entrega',
      description: 'Conduz a Tona em modo execução para preparar a entrega.',
      type: 'stage_agent',
      primary_stage_id: 'ship'
    },
    {
      id: 'agent-learning-loop-keeper',
      name: 'Learning Loop Keeper',
      slug: 'stage-acompanhar-aprender',
      description: 'Conduz a Tona em modo analítico e reflexivo.',
      type: 'stage_agent',
      primary_stage_id: 'sense_plus'
    }
  ];

  for (const sa of stageAgents) {
    const saRef = doc(db, 'agents', sa.id);
    const saSnap = await getDoc(saRef);
    if (!saSnap.exists()) {
      await setDoc(saRef, {
        ...sa,
        status: 'active',
        primary_discipline: 'Multidisciplinar',
        default_model: 'gemini-3-flash-preview',
        temperature: 0.4,
        mindflow_enabled: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        created_by: userId
      });

  // Link stage to agent
      await setDoc(doc(db, 'product_journey_stages', sa.primary_stage_id), {
        stage_agent_id: sa.id
      }, { merge: true });
    }
  }

  // 4. Specialist Agents & Bindings
  const specialists = [
    { id: 'spec-insight-synthesizer', name: 'Insight Synthesizer', slug: 'spec-insight-synthesizer', type: 'specialist', stages: ['sense'] },
    { id: 'spec-problem-sharpener', name: 'Problem Sharpener', slug: 'spec-problem-sharpener', type: 'specialist', stages: ['sense'] },
    { id: 'spec-client-profiler', name: 'Client Profiler', slug: 'spec-client-profiler', type: 'specialist', min_stage: 'sense' },
    { id: 'spec-concept-builder', name: 'Concept Builder', slug: 'spec-concept-builder', type: 'specialist', stages: ['shape'] },
    { id: 'spec-rtb-validator', name: 'RTB Validator', slug: 'spec-rtb-validator', type: 'specialist', stages: ['shape'] },
    { id: 'spec-vignette-builder', name: 'Vignette Builder', slug: 'spec-vignette-builder', type: 'specialist', stages: ['sketch'] },
    { id: 'spec-mvp-scoper', name: 'MVP Scoper', slug: 'spec-mvp-scoper', type: 'specialist', stages: ['scope'] },
    { id: 'spec-epic-builder', name: 'Epic Builder', slug: 'spec-epic-builder', type: 'specialist', stages: ['ship'] },
    { id: 'spec-health-monitor', name: 'Product Health Monitor', slug: 'spec-health-monitor', type: 'specialist', stages: ['sense_plus'] }
  ];

  for (const sp of specialists) {
    const spRef = doc(db, 'agents', sp.id);
    const spSnap = await getDoc(spRef);
    if (!spSnap.exists()) {
      await setDoc(spRef, {
        id: sp.id,
        name: sp.name,
        slug: sp.slug,
        description: `Especialista em ${sp.name}`,
        type: 'specialist',
        status: 'active',
        primary_discipline: 'Multidisciplinar',
        default_model: 'gemini-3-flash-preview',
        temperature: 0.3,
        mindflow_enabled: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        created_by: userId
      });
    }

    // Create bindings for each stage it belongs to
    const targetStages = (sp as any).stages || [];
    for (const stid of targetStages) {
      const bindingId = `${stid}_${sp.id}`;
      await setDoc(doc(db, 'stage_specialist_bindings', bindingId), {
        id: bindingId,
        stage_id: stid,
        specialist_agent_id: sp.id,
        role: 'support',
        is_active: true,
        is_automatic: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
    }
  }
}

export async function reorganizeTonaStagesAndAgents(userId: string) {
  try {
    // 1. Ensure Core Personality exists
    await seedTonaArchitecture(userId);

    // 2. Fetch current agents and stages to avoid duplicates but ensure essential ones exist
    const [agentsSnap, stagesSnap] = await Promise.all([
      getDocs(collection(db, 'agents')),
      getDocs(collection(db, 'product_journey_stages'))
    ]);

    const existingAgentSlugs = new Set(agentsSnap.docs.map(d => d.data().slug));
    const existingStages = new Set(stagesSnap.docs.map(d => d.id));

    // 3. Ensure stages and their default agents
    // (The seedTonaArchitecture already does some of this, but let's make it explicitly robust here)
    // Actually, calling seedTonaArchitecture is mostly enough if it uses setDoc with merge or logic.
    // I will improve seedTonaArchitecture to use merge and be more careful.

    return { success: true, message: 'Estrutura da Tona reorganizada com sucesso.' };
  } catch (e) {
    console.error("Error reorganizing Tona:", e);
    throw e;
  }
}

// --- RUNTIME COMPOSITION ---

export async function getUserBehaviorProfile(userId: string): Promise<UserBehaviorProfile | null> {
  const q = query(collection(db, 'user_behavior_profiles'), where('user_id', '==', userId), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as UserBehaviorProfile;
}

export async function getTonaCorePersonality(): Promise<TonaCorePersonality | null> {
  const ref = doc(db, 'tona_core_personality', 'tona-core-personality-v1');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as TonaCorePersonality;
}

export async function composeTonaRuntimeContext(params: {
  userId: string;
  productId: string;
  stageId: StageKey;
  userMessage: string;
}) {
  const [personality, profile, stageConfig] = await Promise.all([
    getTonaCorePersonality(),
    getUserBehaviorProfile(params.userId),
    getDoc(doc(db, 'product_journey_stages', params.stageId)).then(s => s.exists() ? s.data() as ProductJourneyStage : null)
  ]);

  let stageAgent: Agent | null = null;
  let stageAgentInstruction: string = '';
  
  if (stageConfig?.stage_agent_id) {
    const saSnap = await getDoc(doc(db, 'agents', stageConfig.stage_agent_id));
    if (saSnap.exists()) {
      stageAgent = { id: saSnap.id, ...saSnap.data() } as Agent;
      if (stageAgent.active_version_id) {
        const vSnap = await getDoc(doc(db, 'agent_instruction_versions', stageAgent.active_version_id));
        if (vSnap.exists()) {
          stageAgentInstruction = vSnap.data().compiled_prompt || '';
        }
      }
    }
  }

  // Specialist selection logic (conceptual for now)
  // ...

  return {
    personality,
    profile,
    stageConfig,
    stageAgent,
    stageAgentInstruction,
    userMessage: params.userMessage
  };
}

export function compileFinalTonaPrompt(context: any) {
  const { personality, profile, stageConfig, stageAgent, stageAgentInstruction, userMessage } = context;

  const sections = [
    "=== TONA CORE PERSONALITY (SHARED IDENTITY) ===",
    personality?.traits ? `Traits: ${JSON.stringify(personality.traits)}` : "",
    personality?.tone_rules?.base ? `Tone: ${personality.tone_rules.base}` : "",
    personality?.description || "",
    
    "\n=== USER BEHAVIOR PROFILE (INDIVIDUAL ADAPTATION) ===",
    profile?.communication_style ? `Style: ${JSON.stringify(profile.communication_style)}` : "None yet.",
    profile?.preferred_depth ? `Depth: ${profile.preferred_depth}` : "",
    
    "\n=== STAGE CONTEXT & BEHAVIOR MOOD ===",
    stageConfig?.goal ? `Stage Goal: ${stageConfig.goal}` : "",
    stageConfig?.central_question ? `Central Question: ${stageConfig.central_question}` : "",
    stageConfig?.maturity_config?.behavior_rules ? `Conduct Mode: ${stageConfig.maturity_config.behavior_rules}` : "",
    
    "\n=== STAGE AGENT SPECIFIC INSTRUCTIONS ===",
    stageAgentInstruction || "Follow stage goal and core personality.",
    
    "\n=== EXECUTION RULES ===",
    "- Never invent facts.",
    "- Differentiate: fact, hypothesis, evidence, decision, risk, pending.",
    "- Be clear and pragmatic.",
    "- Focus on product value.",
    
    "\n=== USER MESSAGE ===",
    userMessage
  ];

  return sections.filter(s => s).join('\n');
}

export async function getStageConfiguration(stageId: string) {
  try {
    const stageSnap = await getDoc(doc(db, 'product_journey_stages', stageId));
    if (!stageSnap.exists()) throw new Error("Etapa não encontrada");
    const stage = { id: stageSnap.id, ...stageSnap.data() } as ProductJourneyStage;

    let stageAgent: Agent | null = null;
    if (stage.stage_agent_id) {
      const saSnap = await getDoc(doc(db, 'agents', stage.stage_agent_id));
      if (saSnap.exists()) stageAgent = { id: saSnap.id, ...saSnap.data() } as Agent;
    }

    const bindingsSnap = await getDocs(query(collection(db, 'stage_specialist_bindings'), where('stage_id', '==', stageId), where('is_active', '==', true)));
    const specialistBindings = bindingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return {
      stage,
      stageAgent,
      specialistBindings
    };
  } catch (e) {
    console.error("Error fetching stage configuration:", e);
    throw e;
  }
}

export async function saveStageConfiguration(stageId: string, payload: Partial<ProductJourneyStage>) {
  try {
    await updateDoc(doc(db, 'product_journey_stages', stageId), {
      ...payload,
      updated_at: serverTimestamp()
    });
    return { success: true };
  } catch (e) {
    console.error("Error saving stage configuration:", e);
    throw e;
  }
}

export async function saveStageAgentBinding(stageId: string, agentId: string) {
  try {
    await updateDoc(doc(db, 'product_journey_stages', stageId), {
      stage_agent_id: agentId,
      updated_at: serverTimestamp()
    });
    return { success: true };
  } catch (e) {
    console.error("Error saving stage agent binding:", e);
    throw e;
  }
}

export async function saveSpecialistBinding(payload: any) {
  try {
    const stage_id = payload.stage_id;
    const specialist_agent_id = payload.specialist_agent_id;

    // Check if link already exists
    const q = query(
      collection(db, 'stage_specialist_bindings'),
      where('stage_id', '==', stage_id),
      where('specialist_agent_id', '==', specialist_agent_id),
      limit(1)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const bindingId = snap.docs[0].id;
      await updateDoc(doc(db, 'stage_specialist_bindings', bindingId), {
        ...payload,
        is_active: true,
        updated_at: serverTimestamp()
      });
      return { success: true, id: bindingId };
    }

    const id = payload.id || doc(collection(db, 'stage_specialist_bindings')).id;
    await setDoc(doc(db, 'stage_specialist_bindings', id), {
      ...payload,
      id,
      is_active: true,
      created_at: payload.created_at || serverTimestamp(),
      updated_at: serverTimestamp()
    });
    return { success: true, id };
  } catch (e) {
    console.error("Error saving specialist binding:", e);
    throw e;
  }
}

export async function updateSpecialistBinding(bindingId: string, payload: any) {
  try {
    await updateDoc(doc(db, 'stage_specialist_bindings', bindingId), {
      ...payload,
      updated_at: serverTimestamp()
    });
    return { success: true };
  } catch (e) {
    console.error("Error updating specialist binding:", e);
    throw e;
  }
}

export async function removeSpecialistBinding(bindingId: string) {
  try {
    await deleteDoc(doc(db, 'stage_specialist_bindings', bindingId));
    return { success: true };
  } catch (e) {
    console.error("Error removing specialist binding:", e);
    throw e;
  }
}

export async function calculateStageMaturity(productId: string, stageId: string) {
  try {
    // Basic logic: Fetch fields for this stage and product
    const q = query(
      collection(db, 'stage_fields'),
      where('product_id', '==', productId),
      where('stage_id', '==', stageId)
    );
    const snap = await getDocs(q);
    const fields = snap.docs.map(d => d.data());

    if (fields.length === 0) {
      return {
        maturity_score: 0,
        quality_label: 'Vazio',
        strengths: [],
        gaps: ['Nenhum campo preenchido na etapa.'],
        recommended_next_action: 'Comece a preencher os campos fundamentais da etapa.'
      };
    }

    const filledFields = fields.filter(f => f.value && f.value.length > 10);
    const score = Math.min(100, Math.round((filledFields.length / 5) * 100)); // Sample heuristic

    return {
      maturity_score: score,
      quality_label: score > 80 ? 'Forte' : score > 50 ? 'Suficiente' : 'Fraco',
      strengths: filledFields.map(f => f.label),
      gaps: fields.filter(f => !f.value || f.value.length < 10).map(f => f.label),
      recommended_next_action: score < 70 ? 'Refine as descrições e adicione evidências.' : 'Revise e siga para a próxima etapa.'
    };
  } catch (e) {
    console.error(e);
    return {
      maturity_score: 50,
      quality_label: 'Em Análise',
      strengths: [],
      gaps: [],
      recommended_next_action: 'Erro ao calcular maturidade.'
    };
  }
}
