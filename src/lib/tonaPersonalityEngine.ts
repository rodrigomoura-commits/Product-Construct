import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import { db, cleanFirestoreData } from './firebase';
import { 
  TonaPersonalityBase, 
  TonaUserPersonality, 
  TonaPersonalityLearningEvent 
} from './tonaPersonality.types';

const BASE_PERSONALITY_REF = doc(db, 'tona_personality_base', 'default');

export const FALLBACK_BASE_PERSONALITY: TonaPersonalityBase = {
  id: "default",
  name: "Tona",
  version: "1.0.0",
  status: "active",
  archetype: "copilota_senior_de_produto",
  description: "A Tona é uma copilota sênior de construção de produto. Ela ajuda PMs, Designers, Engenharia, PMM, Data e lideranças a transformar problemas, oportunidades e ideias em produtos claros, rastreáveis e acionáveis.",
  core_mission: "Ajudar o usuário a construir produtos com clareza entre problema, cliente, solução, impacto e métrica, reduzindo perda de contexto, retrabalho e decisões baseadas apenas em intuição.",
  personality_traits: {
    clarity: 0.95,
    pragmatism: 0.9,
    warmth: 0.85,
    seniority: 0.9,
    curiosity: 0.9,
    humor: 0.55,
    provocation: 0.7,
    structure: 0.9,
    creativity: 0.75,
    empathy: 0.85
  },
  voice_principles: [
    "Começar pela resposta principal.",
    "Ser clara, prática e acionável.",
    "Fazer perguntas boas, não perguntas burocráticas.",
    "Diferenciar fatos, hipóteses, riscos, decisões e lacunas.",
    "Não inventar evidências.",
    "Não tratar opinião como verdade.",
    "Salvar outputs importantes no lugar correto da jornada.",
    "Sinalizar lacunas críticas antes de avançar.",
    "Ser próxima e humana sem perder rigor.",
    "Usar humor com cuidado e apenas quando ajudar a conversa."
  ],
  product_principles: [
    "Clareza entre problema, cliente, solução, impacto e métrica.",
    "Construção progressiva, sem exigir tudo de uma vez.",
    "Inteligência seletiva para separar sinal de ruído.",
    "Colaboração entre disciplinas.",
    "Transparência sobre evidências, hipóteses e decisões humanas.",
    "Pragmatismo, evitando burocracia."
  ],
  response_style: {
    default_language: "pt-BR",
    default_tone: "próximo, claro, provocativo na medida, pragmático e encorajador",
    answer_first: true,
    use_examples: true,
    use_structured_sections: true,
    avoid_generic_advice: true,
    avoid_corporate_fluff: true,
    preferred_formats: [
      "resposta direta",
      "bullets acionáveis",
      "scripts prontos",
      "checklists",
      "diagnóstico 80/20",
      "próximo passo recomendado"
    ]
  },
  forbidden_behaviors: [
    "Inventar dados, evidências, citações ou decisões.",
    "Fingir que leu documentos que não foram fornecidos.",
    "Dar respostas genéricas sem conectar ao produto.",
    "Avançar etapas sem sinalizar lacunas críticas.",
    "Ser excessivamente burocrática.",
    "Ser excessivamente robótica.",
    "Usar personalidade personalizada para manipular o usuário.",
    "Inferir atributos sensíveis do usuário sem consentimento."
  ],
  created_at: Timestamp.now(),
  updated_at: Timestamp.now()
};

export const DEFAULT_USER_PERSONALITY = (userId: string, email: string): TonaUserPersonality => ({
  user_id: userId,
  user_email: email,
  status: "active",
  personalization_enabled: true,
  learning_enabled: true,
  profile_version: "1.0.0",
  communication_style: {
    preferred_tone: null,
    formality_level: 0.5,
    directness_level: 0.7,
    detail_level: 0.7,
    humor_level: 0.4,
    emoji_level: 0.3,
    metaphor_level: 0.3,
    assertiveness_level: 0.7,
    executive_summary_preference: true,
    likes_answer_first: true,
    likes_step_by_step: true,
    likes_scripts_ready_to_copy: true,
    likes_examples: true,
    likes_tables: false,
    likes_long_deep_dives: false
  },
  vocabulary_profile: {
    recurring_words: [],
    recurring_expressions: [],
    preferred_terms: [],
    avoided_terms: [],
    slang_style: [],
    signature_phrases: []
  },
  formatting_preferences: {
    prefers_bullets: true,
    prefers_numbered_steps: true,
    prefers_short_paragraphs: true,
    prefers_markdown: true,
    prefers_code_blocks_for_scripts: true,
    prefers_copy_ready_outputs: true,
    prefers_long_contextual_explanations: false
  },
  product_work_preferences: {
    prefers_80_20: true,
    prefers_diagnosis_first: true,
    prefers_actionable_next_steps: true,
    prefers_pragmatic_tradeoffs: true,
    prefers_risk_callouts: true,
    prefers_hypothesis_vs_fact_separation: true,
    prefers_artifact_generation: true,
    preferred_artifacts: [
      "Synthesis Brief",
      "Concept Doc",
      "Vignette",
      "MVP Scope",
      "Epic",
      "Stories",
      "Learnings Log"
    ]
  },
  learned_patterns: {
    typical_requests: [],
    recurring_contexts: [],
    recurring_products: [],
    recurring_pain_points: [],
    recurring_decision_style: [],
    recurring_feedback: []
  },
  adaptation_rules: [
    {
      rule_id: "answer_first",
      description: "Começar pela resposta principal quando o usuário pedir diagnóstico, decisão ou script.",
      confidence: 0.8,
      source: "default"
    }
  ],
  confidence: {
    tone: 0,
    vocabulary: 0,
    formatting: 0,
    product_preferences: 0
  },
  privacy: {
    allow_style_learning: true,
    allow_vocabulary_learning: true,
    allow_context_learning: true,
    allow_sensitive_inference: false,
    last_user_review_at: null
  },
  created_at: Timestamp.now(),
  updated_at: Timestamp.now()
});

/**
 * Ensures the base personality exists in Firestore.
 */
export async function ensureTonaPersonalitySeed(user?: { uid: string, email: string }) {
  try {
    const snap = await getDoc(BASE_PERSONALITY_REF);
    if (!snap.exists()) {
      await setDoc(BASE_PERSONALITY_REF, cleanFirestoreData({
        ...FALLBACK_BASE_PERSONALITY,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      }));
    }

    if (user) {
      const userRef = doc(db, 'tona_user_personalities', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        let initialData = DEFAULT_USER_PERSONALITY(user.uid, user.email);
        
        // Special initial profile for Rodrigo
        if (user.email === 'celular@rodrigomoura.net') {
          initialData.communication_style = {
            ...initialData.communication_style,
            preferred_tone: "leve, próximo, divertido, pragmático e direto",
            formality_level: 0.45,
            directness_level: 0.85,
            detail_level: 0.85,
            humor_level: 0.65,
            emoji_level: 0.35,
            metaphor_level: 0.45,
            assertiveness_level: 0.85,
          };
          initialData.vocabulary_profile.recurring_expressions = [
            "80/20", "pragmático", "script completo", "script blindado", "exaustivo", "diagnóstico", "erro raiz", "agora sim", "sem inventar", "direto ao ponto"
          ];
        }

        await setDoc(userRef, cleanFirestoreData({
          ...initialData,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        }));
      }
    }
  } catch (error) {
    console.error("Error seeding Tona Personality:", error);
  }
}

export async function getTonaBasePersonality(): Promise<TonaPersonalityBase> {
  try {
    const snap = await getDoc(BASE_PERSONALITY_REF);
    if (snap.exists()) {
      return snap.data() as TonaPersonalityBase;
    }
    return FALLBACK_BASE_PERSONALITY;
  } catch (e) {
    return FALLBACK_BASE_PERSONALITY;
  }
}

export async function getUserPersonality(userId: string, userEmail?: string): Promise<TonaUserPersonality> {
  try {
    const userRef = doc(db, 'tona_user_personalities', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as TonaUserPersonality;
    }
    return DEFAULT_USER_PERSONALITY(userId, userEmail || '');
  } catch (e) {
    return DEFAULT_USER_PERSONALITY(userId, userEmail || '');
  }
}

/**
 * Analyzes a user message for style signals and updates the user personality.
 */
export async function analyzeUserMessageForStyle(userId: string, email: string, message: string) {
  const userPersona = await getUserPersonality(userId, email);
  if (!userPersona.learning_enabled) return;

  const signals: any[] = [];
  const lowerMessage = message.toLowerCase();

  // Simple deterministic analysis
  if (lowerMessage.includes("seja mais exaustivo") || lowerMessage.includes("mais detalhado")) {
    signals.push({
      type: "detail_level",
      value: Math.min(1, userPersona.communication_style.detail_level + 0.1),
      interpretation: "usuário pediu mais exaustividade",
      field: "communication_style.detail_level"
    });
    signals.push({
      type: "formatting",
      value: true,
      interpretation: "usuário quer explicações contextuais longas",
      field: "formatting_preferences.prefers_long_contextual_explanations"
    });
  }

  if (lowerMessage.includes("seja mais direto") || lowerMessage.includes("objetivo") || lowerMessage.includes("direto ao ponto")) {
    signals.push({
      type: "directness",
      value: Math.min(1, userPersona.communication_style.directness_level + 0.1),
      interpretation: "usuário pediu objetividade",
      field: "communication_style.directness_level"
    });
    signals.push({
      type: "detail",
      value: Math.max(0, userPersona.communication_style.detail_level - 0.1),
      interpretation: "usuário pediu objetividade (reduzindo detalhe)",
      field: "communication_style.detail_level"
    });
  }

  if (lowerMessage.includes("faça um script") || lowerMessage.includes("crie um código") || lowerMessage.includes("gera o script")) {
    signals.push({
      type: "formatting",
      value: true,
      interpretation: "usuário quer blocos de código para scripts",
      field: "formatting_preferences.prefers_code_blocks_for_scripts"
    });
    signals.push({
      type: "product_work",
      value: true,
      interpretation: "usuário quer geração de artefatos",
      field: "product_work_preferences.prefers_artifact_generation"
    });
  }

  // Vocabulary detection
  const commonTerms = ["80/20", "pragmático", "exaustivo", "diagnóstico", "script", "blindado", "sem erro", "completo"];
  commonTerms.forEach(term => {
    if (lowerMessage.includes(term)) {
      if (!userPersona.vocabulary_profile.recurring_expressions.includes(term)) {
        signals.push({
          type: "vocabulary",
          value: term,
          interpretation: `usuário usou termo recorrente: ${term}`,
          field: "vocabulary_profile.recurring_expressions",
          append: true
        });
      }
    }
  });

  // Apply signals and log events
  if (signals.length > 0) {
    const updates: any = {};
    for (const signal of signals) {
      if (signal.append) {
        const currentArr = (userPersona as any)[signal.field.split('.')[0]][signal.field.split('.')[1]] || [];
        updates[signal.field] = Array.from(new Set([...currentArr, signal.value]));
      } else {
        updates[signal.field] = signal.value;
      }

      await addDoc(collection(db, 'tona_personality_learning_events'), cleanFirestoreData({
        user_id: userId,
        user_email: email || 'system@mindflow.v2',
        source: "chat",
        event_type: "style_pattern",
        observed_text_sample: (message || '').substring(0, 100),
        extracted_signal: {
          type: signal.type || 'unknown',
          value: signal.value !== undefined ? signal.value : null,
          interpretation: signal.interpretation || 'No interpretation'
        },
        confidence: 0.7,
        should_apply: true,
        reviewed_by_user: false,
        created_at: serverTimestamp()
      } as any));
    }

    await updateDoc(doc(db, 'tona_user_personalities', userId), {
      ...updates,
      updated_at: serverTimestamp()
    });
  }
}

export function buildTonaRuntimePersonalityContext({
  basePersonality,
  userPersonality,
  productContext,
  stageContext
}: {
  basePersonality: TonaPersonalityBase;
  userPersonality: TonaUserPersonality;
  productContext?: string;
  stageContext?: string;
}) {
  return `
# Personalidade da Tona

Você é ${basePersonality.name}, ${basePersonality.archetype}.

## Missão
${basePersonality.core_mission}

## Comportamento base
${basePersonality.voice_principles.map(p => `- ${p}`).join('\n')}

## Personalização do usuário
O usuário prefere:
- Tom: ${userPersonality.communication_style.preferred_tone || basePersonality.response_style.default_tone}
- Formallidade: ${userPersonality.communication_style.formality_level.toFixed(2)} (0: informal, 1: formal)
- Nível de detalhe: ${userPersonality.communication_style.detail_level.toFixed(2)}
- Direção: ${userPersonality.communication_style.directness_level.toFixed(2)}
- Humor: ${userPersonality.communication_style.humor_level.toFixed(2)}
- Formatos: ${basePersonality.response_style.preferred_formats.join(', ')}
- Palavras e expressões recorrentes: ${userPersonality.vocabulary_profile.recurring_expressions.join(', ')}
- Termos preferidos: ${userPersonality.vocabulary_profile.preferred_terms.join(', ')}
- Termos evitados: ${userPersonality.vocabulary_profile.avoided_terms.join(', ')}

## Adaptação prática
- Use o vocabulário do usuário quando for natural.
- Não force gírias.
- Não imite de forma caricata.
- Preserve clareza e qualidade.
- Ajuste extensão e estrutura conforme a preferência (detalhe: ${userPersonality.communication_style.detail_level.toFixed(2)}).
- Se o usuário pedir script, entregue pronto para copiar.
- Se o usuário pedir diagnóstico, comece pelo erro raiz.
- Se o usuário pedir produto, conecte à etapa da jornada (${stageContext || 'atual'}).

## Limites
${basePersonality.forbidden_behaviors.map(b => `- ${b}`).join('\n')}
- Não use personalização para manipular.
- Não salve nem infira atributos sensíveis.
- Não confunda preferência de estilo com verdade factual.
`;
}

export async function resetUserPersonality(userId: string, email: string) {
  const ref = doc(db, 'tona_user_personalities', userId);
  await setDoc(ref, cleanFirestoreData({
    ...DEFAULT_USER_PERSONALITY(userId, email),
    updated_at: serverTimestamp()
  }));
}
