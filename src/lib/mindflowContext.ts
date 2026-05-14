import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, orderBy, limit, writeBatch, getDoc } from 'firebase/firestore';
import { db, cleanFirestoreData } from './firebase';
import { 
  MindflowContext, 
  MindflowUserMemory,
  MindflowLearning,
  MindflowScope,
  MindflowContextMap
} from '../types';

import { getUserMemoriesCollection, getUserMemoryDoc } from './mindflowCollections';
import { callGeminiProxy } from './geminiProxy';

/**
 * MINDFLOW CONTEXT MODULE
 * Handles interaction classification and storage.
 */

/**
 * Gets the official Mindflow context map based on the stage key.
 */
export async function getMindflowContextForStage(stageKey: string): Promise<MindflowContextMap | null> {
  const mapping: Record<string, string> = {
    'understand_problem': 'understand_problem',
    'sense': 'understand_problem',
    'define_proposal': 'define_proposal',
    'shape': 'define_proposal',
    'visualize_solution': 'visualize_solution',
    'sketch': 'visualize_solution',
    'plan_mvp': 'plan_mvp',
    'scope': 'plan_mvp',
    'prepare_delivery': 'prepare_delivery',
    'ship': 'prepare_delivery',
    'monitor_learn': 'monitor_learn',
    'sense_plus': 'monitor_learn'
  };

  const docId = mapping[stageKey] || 'understand_problem';
  
  try {
    const dSnap = await getDoc(doc(db, 'mindflow_context_maps', docId));
    if (dSnap.exists()) {
      return { id: dSnap.id, ...dSnap.data() } as MindflowContextMap;
    }
    return null;
  } catch (e) {
    console.error("Error fetching context map:", e);
    return null;
  }
}

export async function storeUserMemory(data: {
  userId: string;
  userIdentifier?: string;
  userMessage: string;
  assistantMessage?: string;
  conversationId?: string;
  productId?: string;
  stageId?: string;
  agentId?: string;
  stageAgentId?: string;
  specialistAgentId?: string;
  rawPayload?: any;
}) {
  try {
    const classification = await classifyInteractionContext({
      userMessage: data.userMessage,
      assistantMessage: data.assistantMessage,
      productId: data.productId,
      agentId: data.agentId
    });

    const docData: Omit<MindflowUserMemory, 'id'> = {
      user_id: data.userId,
      user_identifier: data.userIdentifier || null,
      memory_date: new Date().toISOString().split('T')[0],
      memory_time: new Date().toLocaleTimeString(),
      product: data.productId || 'Geral', // Usar productId ou fallback
      context: classification.name || 'Geral',
      sub_context: classification.intention || 'Conversa',
      detected_intention: classification.intention || null,
      user_message: data.userMessage,
      tona_response: data.assistantMessage || null,
      conversation_id: data.conversationId || null,
      product_id: data.productId || null,
      agent_id: data.agentId || null,
      context_id: classification.id || null,
      context_confidence_score: classification.confidence_score === 'Alta' ? 0.9 : (classification.confidence_score === 'Média' ? 0.6 : 0.3),
      raw_payload: data.rawPayload || {},
      used_learning_ids: [],
      used_reasoning_ids: [],
      generated_learning_ids: [],
      status: 'completed',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      metadata: (classification as any).confidence_score === 'Baixa' ? { needs_review: true } : {}
    } as any;

    const docRef = await addDoc(getUserMemoriesCollection(db), cleanFirestoreData(docData));
    return { id: docRef.id, ...classification };
  } catch (error) {
    console.error("Error storing interaction memory:", error);
    try {
        await addDoc(getUserMemoriesCollection(db), cleanFirestoreData({
            user_id: data.userId,
            user_message: data.userMessage,
            memory_date: new Date().toISOString().split('T')[0],
            status: 'failed',
            product: data.productId || 'Geral',
            context: 'Error Recovery',
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            metadata: { error: true, error_details: String(error) }
        } as any));
    } catch (e) {
        console.error("Critical failure saving memory:", e);
    }
    return null;
  }
}

export async function classifyInteractionContext(params: {
  userMessage: string;
  assistantMessage?: string;
  productId?: string;
  stageId?: string;
  agentId?: string;
}) {
  const text = (params.userMessage + ' ' + (params.assistantMessage || '')).toLowerCase();
  
  const rules = [
    { 
      id: 'understand_problem', 
      name: 'Entender o Problema', 
      intention: 'Investigar o problema',
      terms: ['dor', 'cliente', 'evidência', 'problema', 'frequência', 'severidade', 'discovery'],
      reason: 'A mensagem contém termos ligados à investigação de dores e validação de problemas.'
    },
    { 
      id: 'define_proposal', 
      name: 'Definir a Proposta', 
      intention: 'Estruturar proposta de valor',
      terms: ['proposta', 'valor', 'rtb', 'diferencial', 'pains', 'needs', 'estratégia'],
      reason: 'A mensagem foca na definição da proposta de valor e diferenciais competitivos.'
    },
    { 
      id: 'visualize_solution', 
      name: 'Visualizar a Solução', 
      intention: 'Tangibilizar a experiência',
      terms: ['fluxo', 'protótipo', 'tela', 'experiência', 'figma', 'microcopy', 'sketch'],
      reason: 'A mensagem descreve fluxos, telas ou elementos de interface e experiência.'
    },
    { 
      id: 'plan_mvp', 
      name: 'Planejar o MVP', 
      intention: 'Definir escopo e trade-offs',
      terms: ['mvp', 'must-have', 'escopo', 'fora de escopo', 'roadmap', 'gtm', 'priorização'],
      reason: 'A mensagem trata de priorização, definições de escopo ou estratégia de lançamento.'
    },
    { 
      id: 'prepare_delivery', 
      name: 'Preparar a Entrega', 
      intention: 'Refinar para execução',
      terms: ['epic', 'story', 'critério de aceite', 'dependência', 'entrega', 'jira', 'ship'],
      reason: 'A mensagem contém elementos técnicos de preparação para o desenvolvimento ou refino.'
    },
    { 
      id: 'monitor_learn', 
      name: 'Acompanhar e Aprender', 
      intention: 'Analisar impacto e métricas',
      terms: ['métrica', 'aprendizado', 'feedback', 'adoção', 'retenção', 'hipótese confirmada', 'sense_plus'],
      reason: 'A mensagem busca analisar resultados Reais, aprendizados e saúde do produto.'
    }
  ];

  let bestMatch = null;
  let maxScore = -1;

  for (const rule of rules) {
    let score = 0;
    rule.terms.forEach(term => {
      if (text.includes(term)) score++;
    });

    if (score > maxScore) {
      maxScore = score;
      bestMatch = rule;
    }
  }

  // Fallback para understand_problem ou primeiro se empate
  if (maxScore <= 0) {
    return {
      id: 'understand_problem',
      name: 'Entender o Problema',
      intention: 'Investigar o problema (Fallback)',
      confidence_score: 'Baixa',
      reason: 'Não foram encontrados termos específicos. O sistema assumiu o contexto inicial de Discovery.'
    };
  }

  return {
    ...bestMatch!,
    confidence_score: maxScore > 2 ? 'Alta' : 'Média',
  };
}

export async function extractLearningsFromMemories() {
    const q = query(
        getUserMemoriesCollection(db), 
        where('status', '==', 'completed'),
        limit(50)
    );
    const snap = await getDocs(q);
    const memories = snap.docs.map(d => ({ id: d.id, ...d.data() } as MindflowUserMemory));

    if (memories.length === 0) return;

    for (const memory of memories) {
        const prompt = `
            Analise a seguinte memória do usuário para extrair aprendizados estruturados.
            
            USUÁRIO: ${memory.user_message}
            ASSISTENTE: ${memory.tona_response || 'N/A'}
            CONTEXTO: ${memory.product} > ${memory.context}
            
            Responda em JSON:
            {
              "learnings": [
                {
                  "learning": "fato ou aprendizado",
                  "classification": "preferência | decisão | evidência | risco | aprendizado",
                  "confidence_score": 0.0 a 1.0,
                  "theme": "tema"
                }
              ]
            }
        `;

        try {
            const responseText = await callGeminiProxy({
                model: "gemini-1.5-flash",
                prompt: prompt,
                config: {
                    responseMimeType: "application/json"
                }
            });

            const data = JSON.parse(responseText || '{"learnings":[]}');
            const generatedLearningIds: string[] = [];

            for (const l of data.learnings) {
                const learningData: Omit<MindflowLearning, 'id'> = {
                    learning_type: 'Adquirida',
                    theme: l.theme || memory.context || 'Geral',
                    learning: l.learning,
                    classification: l.classification as any,
                    source_type: 'memory',
                    source_id: memory.id,
                    scope_type: 'user' as MindflowScope,
                    user_id: memory.user_id,
                    product_id: memory.product_id || null,
                    interaction_id: memory.id,
                    context_id: memory.context_id || null,
                    product: memory.product || 'Geral',
                    context: memory.context || 'Geral',
                    confidence_score: typeof l.confidence_score === 'number' ? l.confidence_score : 0.5,
                    relevance_score: 0.8,
                    quality_score: 0.8,
                    usage_count: 0,
                    is_verified: l.confidence_score > 0.8,
                    needs_review: l.confidence_score <= 0.8,
                    is_active: l.confidence_score > 0.8,
                    learning_date: new Date().toISOString().split('T')[0],
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp(),
                    metadata: { original_memory: memory.user_message }
                };

                const learnRef = await addDoc(collection(db, 'mindflow_learnings'), cleanFirestoreData(learningData));
                generatedLearningIds.push(learnRef.id);
            }

            if (memory.id) {
                await updateDoc(getUserMemoryDoc(db, memory.id), {
                    generated_learning_ids: generatedLearningIds,
                    updated_at: serverTimestamp()
                });
            }

        } catch (e) {
            console.error(`Error extracting learning from memory ${memory.id}:`, e);
        }
    }
}
