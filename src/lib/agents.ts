import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, orderBy, limit, setDoc, getDoc } from 'firebase/firestore';
import { db, cleanFirestoreData } from './firebase';
import { Agent, AgentInstructionVersion, StageKey } from '../types';

/**
 * AGENT SERVICE
 * Managing agents, versions and orchestrator logic.
 */

export async function getActiveAgentForStage(stage: StageKey): Promise<Agent | null> {
  try {
    const q = query(
      collection(db, 'agents'), 
      where('primary_stage_id', '==', stage),
      where('status', '==', 'active'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Agent;
  } catch (e) {
    console.error("Error fetching active agent:", e);
    return null;
  }
}

export async function getAgentInstruction(agentId: string): Promise<string | null> {
  try {
    const q = query(
      collection(db, 'agent_instruction_versions'),
      where('agent_id', '==', agentId),
      where('is_active', '==', true),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const version = snap.docs[0].data() as AgentInstructionVersion;
    return version.compiled_prompt;
  } catch (e) {
    console.error("Error fetching agent instruction:", e);
    return null;
  }
}

export async function seedDefaultAgents(userId: string) {
  const defaultAgents = [
    // Global
    {
      name: 'Tona Orchestrator',
      slug: 'tona-orchestrator',
      description: 'Orquestradora principal da jornada de produto.',
      type: 'orchestrator',
      primary_discipline: 'Multidisciplinar',
      status: 'active',
      primary_stage_id: 'global',
      default_model: 'gemini-1.5-flash',
      temperature: 0.4,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'orchestration'
    },
    // Etapa 1: Entender o Problema (sense)
    {
      name: 'Insight Synthesizer',
      slug: 'insight-synthesizer',
      description: 'Sintetiza dores, contextos e insights iniciais.',
      type: 'discovery',
      primary_discipline: 'Product Management',
      status: 'active',
      primary_stage_id: 'sense',
      default_model: 'gemini-1.5-flash',
      temperature: 0.4,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'analysis'
    },
    {
       name: 'Problem Sharpener',
       slug: 'problem-sharpener',
       description: 'Refina a definição do problema e a dor do cliente.',
       type: 'strategy',
       primary_discipline: 'Product Management',
       status: 'active',
       primary_stage_id: 'sense',
       default_model: 'gemini-1.5-flash',
       temperature: 0.3,
       memory_enabled: true,
       mindflow_enabled: true,
       output_type: 'refinement'
    },
    {
      name: 'Client Profiler',
      slug: 'client-profiler',
      description: 'Define e detalha o perfil do cliente-alvo.',
      type: 'discovery',
      primary_discipline: 'Product Management',
      status: 'active',
      primary_stage_id: 'sense',
      default_model: 'gemini-1.5-flash',
      temperature: 0.4,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'analysis'
    },
    // Etapa 2: Definir a Proposta (shape)
    {
      name: 'Concept Builder',
      slug: 'concept-builder',
      description: 'Constrói conceitos de solução e propostas de valor.',
      type: 'strategy',
      primary_discipline: 'Product Management',
      status: 'active',
      primary_stage_id: 'shape',
      default_model: 'gemini-1.5-flash',
      temperature: 0.5,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'concept'
    },
    {
      name: 'Superpower Challenger',
      slug: 'superpower-challenger',
      description: 'Desafia a proposta buscando diferenciais únicos.',
      type: 'strategy',
      primary_discipline: 'Product Management',
      status: 'active',
      primary_stage_id: 'shape',
      default_model: 'gemini-1.5-flash',
      temperature: 0.6,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'challenge'
    },
    {
      name: 'RTB Validator',
      slug: 'rtb-validator',
      description: 'Valida os Reasons to Believe da proposta.',
      type: 'strategy',
      primary_discipline: 'Product Management',
      status: 'active',
      primary_stage_id: 'shape',
      default_model: 'gemini-1.5-flash',
      temperature: 0.3,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'validation'
    },
    {
      name: 'Alignment Check',
      slug: 'alignment-check',
      description: 'Garante o alinhamento estratégico da proposta.',
      type: 'strategy',
      primary_discipline: 'Product Management',
      status: 'active',
      primary_stage_id: 'shape',
      default_model: 'gemini-1.5-flash',
      temperature: 0.2,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'audit'
    },
    // Etapa 3: Visualizar a Solução (sketch)
    {
      name: 'Vignette Builder',
      slug: 'vignette-builder',
      description: 'Cria narrativas e vinhetas da experiência.',
      type: 'design',
      primary_discipline: 'Design',
      status: 'active',
      primary_stage_id: 'sketch',
      default_model: 'gemini-1.5-flash',
      temperature: 0.7,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'narrative'
    },
    {
      name: 'Visual Consistency Auditor',
      slug: 'visual-consistency-auditor',
      description: 'Audita a consistência visual da solução.',
      type: 'design',
      primary_discipline: 'Design',
      status: 'active',
      primary_stage_id: 'sketch',
      default_model: 'gemini-1.5-flash',
      temperature: 0.2,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'audit'
    },
    {
      name: 'Voice & Tone Guardian',
      slug: 'voice-tone-guardian',
      description: 'Protege a voz e o tom da marca na solução.',
      type: 'design',
      primary_discipline: 'Design',
      status: 'active',
      primary_stage_id: 'sketch',
      default_model: 'gemini-1.5-flash',
      temperature: 0.4,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'refinement'
    },
    {
      name: 'Taste Curator',
      slug: 'taste-curator',
      description: 'Faz curadoria estética e de tendências.',
      type: 'design',
      primary_discipline: 'Design',
      status: 'active',
      primary_stage_id: 'sketch',
      default_model: 'gemini-1.5-flash',
      temperature: 0.6,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'analysis'
    },
    // Etapa 4: Planejar o MVP (scope)
    {
      name: 'MVP Scoper',
      slug: 'mvp-scoper',
      description: 'Define e prioriza o escopo do MVP.',
      type: 'product',
      primary_discipline: 'Product Management',
      status: 'active',
      primary_stage_id: 'scope',
      default_model: 'gemini-1.5-flash',
      temperature: 0.4,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'scope'
    },
    {
      name: 'GTM Builder',
      slug: 'gtm-builder',
      description: 'Constrói a estratégia de Go-to-Market.',
      type: 'pmm',
      primary_discipline: 'Product Marketing',
      status: 'active',
      primary_stage_id: 'scope',
      default_model: 'gemini-1.5-flash',
      temperature: 0.5,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'strategy'
    },
    {
      name: 'Business Impact Modeler',
      slug: 'business-impact-modeler',
      description: 'Modela o impacto de negócio esperado.',
      type: 'product',
      primary_discipline: 'Data',
      status: 'active',
      primary_stage_id: 'scope',
      default_model: 'gemini-1.5-flash',
      temperature: 0.3,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'analysis'
    },
    // Etapa 5: Preparar a Entrega (ship)
    {
      name: 'Epic Builder',
      slug: 'epic-builder',
      description: 'Constrói épicos e documentação de entrega.',
      type: 'engineering',
      primary_discipline: 'Engenharia',
      status: 'active',
      primary_stage_id: 'ship',
      default_model: 'gemini-1.5-flash',
      temperature: 0.3,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'documentation'
    },
    {
      name: 'Story Builder',
      slug: 'story-builder',
      description: 'Quebra épicos em histórias de usuário.',
      type: 'engineering',
      primary_discipline: 'Engenharia',
      status: 'active',
      primary_stage_id: 'ship',
      default_model: 'gemini-1.5-flash',
      temperature: 0.4,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'documentation'
    },
    {
      name: 'Sprint Refiner',
      slug: 'sprint-refiner',
      description: 'Refina os itens para execução em sprint.',
      type: 'engineering',
      primary_discipline: 'Engenharia',
      status: 'active',
      primary_stage_id: 'ship',
      default_model: 'gemini-1.5-flash',
      temperature: 0.2,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'refinement'
    },
    {
      name: 'Business Rules Keeper',
      slug: 'business-rules-keeper',
      description: 'Garante que as regras de negócio sejam seguidas.',
      type: 'engineering',
      primary_discipline: 'Engenharia',
      status: 'active',
      primary_stage_id: 'ship',
      default_model: 'gemini-1.5-flash',
      temperature: 0.1,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'audit'
    },
    // Etapa 6: Acompanhar e Aprender (sense_plus)
    {
      name: 'Product Health Monitor',
      slug: 'product-health-monitor',
      description: 'Monitora a saúde e métricas do produto.',
      type: 'data',
      primary_discipline: 'Data',
      status: 'active',
      primary_stage_id: 'sense_plus',
      default_model: 'gemini-1.5-flash',
      temperature: 0.2,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'analysis'
    },
    {
      name: 'Retrospective Facilitator',
      slug: 'retrospective-facilitator',
      description: 'Facilita retrospectivas e aprendizados.',
      type: 'quality',
      primary_discipline: 'Liderança',
      status: 'active',
      primary_stage_id: 'sense_plus',
      default_model: 'gemini-1.5-flash',
      temperature: 0.5,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'facilitation'
    },
    {
      name: 'Learnings Librarian',
      slug: 'learnings-librarian',
      description: 'Organiza e cataloga aprendizados do produto.',
      type: 'memory',
      primary_discipline: 'Multidisciplinar',
      status: 'active',
      primary_stage_id: 'sense_plus',
      default_model: 'gemini-1.5-flash',
      temperature: 0.3,
      memory_enabled: true,
      mindflow_enabled: true,
      output_type: 'curation'
    }
  ];

  for (const agentData of defaultAgents) {
     const q = query(collection(db, 'agents'), where('slug', '==', agentData.slug));
     const snap = await getDocs(q);
     if (snap.empty) {
        const agentId = doc(collection(db, 'agents')).id;
        const agentDoc = {
           id: agentId,
           ...agentData,
           created_at: serverTimestamp(),
           updated_at: serverTimestamp(),
           created_by: userId
        };
        await setDoc(doc(db, 'agents', agentId), cleanFirestoreData(agentDoc));

        // Create initial empty instruction version
        const emptyBlocks = {
          identity: `Você é o ${agentData.name}.`,
          objective: agentData.description,
          when_to_use: `Utilize este agente quando estiver na etapa de ${agentData.primary_stage_id}.`,
          when_not_to_use: "Não utilize fora do escopo de sua disciplina primária.",
          expected_inputs: "{{product.name}}, {{product.description}}, {{stage.fields}}, {{conversation.history}}",
          mandatory_tasks: `1. Analisar o contexto do produto\n2. Realizar a tarefa de ${agentData.output_type}\n3. Retornar output estruturado.`,
          reasoning_method: "Pense passo a passo, considerando os artefatos e decisões anteriores.",
          questions_to_ask: "Quais são as principais lacunas identificadas?",
          quality_criteria: "A resposta deve ser específica, acionável e fundamentada em dados.",
          guardrails: "Não inventar fatos não presentes na memória ou documentos.",
          output_format: 'JSON com campos "analysis", "recommendations" e "next_steps".',
          save_behavior: "Salvar no campo principal da etapa correspondente.",
          gap_handling: "Se faltar informação, sinalize como lacuna e peça ao usuário.",
          classification_rules: "Classificar insights como fatos ou hipóteses.",
          good_examples: "Exemplo de análise profunda e estruturada.",
          bad_examples: "Respostas genéricas e pouco acionáveis."
        };

        const versionId = doc(collection(db, 'agent_instruction_versions')).id;
        await setDoc(doc(db, 'agent_instruction_versions', versionId), cleanFirestoreData({
           id: versionId,
           agent_id: agentId,
           version_number: 'v0.1',
           status: 'published',
           instruction_blocks: emptyBlocks,
           compiled_prompt: `IDENTIDADE: ${emptyBlocks.identity}\nOBJETIVO: ${emptyBlocks.objective}\nMÉTODO: ${emptyBlocks.reasoning_method}`,
           is_active: true,
           created_at: serverTimestamp(),
           created_by: userId,
           change_summary: 'Seed inicial da Tona'
        }));

        // Update agent with active version id
        await updateDoc(doc(db, 'agents', agentId), {
          active_version_id: versionId
        });

        // Create initial flow binding
        if (agentData.primary_stage_id !== 'global') {
          const bindingId = doc(collection(db, 'agent_flow_bindings')).id;
          await setDoc(doc(db, 'agent_flow_bindings', bindingId), cleanFirestoreData({
            id: bindingId,
            agent_id: agentId,
            stage_id: agentData.primary_stage_id,
            role: agentData.slug === 'tona-orchestrator' ? 'primary' : 'support',
            execution_order: 0,
            trigger_type: 'on_stage_start',
            trigger_conditions: {},
            is_required: true,
            is_automatic: true,
            is_active: true,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
          }));
        }
     }
  }
}

export async function saveAgent(agentData: Partial<Agent>, userId: string) {
  try {
    const id = agentData.id || doc(collection(db, 'agents')).id;
    const finalData = {
      ...agentData,
      id,
      created_at: agentData.created_at || serverTimestamp(),
      updated_at: serverTimestamp(),
      created_by: agentData.created_by || userId,
      status: agentData.status || 'draft'
    };
    await setDoc(doc(db, 'agents', id), cleanFirestoreData(finalData));
    return { success: true, id };
  } catch (e) {
    console.error("Error saving agent:", e);
    throw e;
  }
}

export async function updateAgent(agentId: string, payload: Partial<Agent>) {
  try {
    await updateDoc(doc(db, 'agents', agentId), {
      ...payload,
      updated_at: serverTimestamp()
    });
    return { success: true };
  } catch (e) {
    console.error("Error updating agent:", e);
    throw e;
  }
}

export async function archiveAgent(agentId: string) {
  try {
    await updateDoc(doc(db, 'agents', agentId), {
      status: 'archived',
      updated_at: serverTimestamp()
    });
    return { success: true };
  } catch (e) {
    console.error("Error archiving agent:", e);
    throw e;
  }
}

export async function canDeleteAgent(agentId: string) {
  // We'll allow archiving even if bound, but we inform the UI if it has bindings
  // This avoids hard-blocking the user while still providing context
  
  const stagesSnap = await getDocs(query(collection(db, 'product_journey_stages'), where('stage_agent_id', '==', agentId)));
  const bindingsSnap = await getDocs(query(collection(db, 'stage_specialist_bindings'), where('specialist_agent_id', '==', agentId), where('is_active', '==', true)));
  
  const hasBindings = !stagesSnap.empty || !bindingsSnap.empty;
  
  // If it has bindings, we can still "archive" but it's good to know
  // The user explicitly asked for deletion to "work"
  return { 
    can_delete: true, 
    has_bindings: hasBindings,
    reason: hasBindings ? 'Este agente possui vínculos ativos que serão desativados visualmente.' : null 
  };
}

export async function deleteAgentIfAllowed(agentId: string) {
  const check = await canDeleteAgent(agentId);
  if (!check.can_delete) throw new Error(check.reason);

  try {
    await updateDoc(doc(db, 'agents', agentId), {
      status: 'archived',
      is_active: false,
      updated_at: serverTimestamp()
    });
    return { success: true };
  } catch (e) {
    console.error("Error deleting agent:", e);
    throw e;
  }
}

export async function duplicateAgent(agentId: string, newName: string, userId: string) {
  try {
    const snap = await getDoc(doc(db, 'agents', agentId));
    if (!snap.exists()) throw new Error("Agente não encontrado");

    const data = snap.data() as Agent;
    const newId = doc(collection(db, 'agents')).id;
    const newSlug = `${data.slug}-copy-${Math.floor(Math.random() * 1000)}`;

    const newData: Partial<Agent> = {
      ...data,
      id: newId,
      name: newName,
      slug: newSlug,
      status: 'draft',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      created_by: userId,
      active_version_id: ""
    };

    await setDoc(doc(db, 'agents', newId), cleanFirestoreData(newData));

    // Copy versions if any
    const versionsSnap = await getDocs(query(collection(db, 'agent_instruction_versions'), where('agent_id', '==', agentId), orderBy('created_at', 'desc'), limit(1)));
    if (!versionsSnap.empty) {
      const vData = versionsSnap.docs[0].data() as AgentInstructionVersion;
      const newVId = doc(collection(db, 'agent_instruction_versions')).id;
      await setDoc(doc(db, 'agent_instruction_versions', newVId), cleanFirestoreData({
        ...vData,
        id: newVId,
        agent_id: newId,
        version_number: 'v0.1',
        status: 'draft',
        is_active: false,
        created_at: serverTimestamp(),
        created_by: userId,
        change_summary: `Cópia de ${data.name}`
      }));
    }

    return { success: true, id: newId };
  } catch (e) {
    console.error("Error duplicating agent:", e);
    throw e;
  }
}

export async function createAgentVersion(agentId: string, payload: Partial<AgentInstructionVersion>, userId: string) {
  try {
    const id = doc(collection(db, 'agent_instruction_versions')).id;
    const finalData = {
      ...payload,
      id,
      agent_id: agentId,
      status: payload.status || 'draft',
      is_active: false,
      created_at: serverTimestamp(),
      created_by: userId
    };
    await setDoc(doc(db, 'agent_instruction_versions', id), cleanFirestoreData(finalData));
    return { success: true, id };
  } catch (e) {
    console.error("Error creating agent version:", e);
    throw e;
  }
}

export async function publishAgentVersion(agentId: string, versionId: string) {
  try {
    // Versions where it is used
    const versionsSnap = await getDocs(query(
      collection(db, 'agent_instruction_versions'), 
      where('agent_id', '==', agentId),
      limit(50)
    ));
    for (const d of versionsSnap.docs) {
      await updateDoc(doc(db, 'agent_instruction_versions', d.id), { is_active: false });
    }

    // Activate the new one
    await updateDoc(doc(db, 'agent_instruction_versions', versionId), {
      is_active: true,
      status: 'published',
      published_at: serverTimestamp()
    });

    // Update agent
    await updateDoc(doc(db, 'agents', agentId), {
      active_version_id: versionId,
      updated_at: serverTimestamp()
    });

    return { success: true };
  } catch (e) {
    console.error("Error publishing agent version:", e);
    throw e;
  }
}

export async function archiveAgentVersion(versionId: string) {
  try {
    await updateDoc(doc(db, 'agent_instruction_versions', versionId), {
      status: 'archived',
      is_active: false
    });
    return { success: true };
  } catch (e) {
    console.error("Error archiving version:", e);
    throw e;
  }
}

export async function getAgentBindings(agentId: string) {
  const bindings: any[] = [];
  
  // Stages where it is primary
  const stagesSnap = await getDocs(query(collection(db, 'product_journey_stages'), where('stage_agent_id', '==', agentId)));
  stagesSnap.forEach(d => {
    bindings.push({ stage_id: d.id, name: d.data().name, role: 'primary' });
  });

  // Specialists bindings
  const specSnap = await getDocs(query(collection(db, 'stage_specialist_bindings'), where('specialist_agent_id', '==', agentId), where('is_active', '==', true)));
  specSnap.forEach(d => {
    bindings.push({ stage_id: d.data().stage_id, role: d.data().role, binding_id: d.id });
  });

  return bindings;
}
