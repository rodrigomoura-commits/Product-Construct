import { Timestamp } from 'firebase/firestore';

export interface TonaPersonalityBase {
  id: string;
  name: string;
  version: string;
  status: 'active' | 'inactive';
  archetype: string;
  description: string;
  core_mission: string;
  personality_traits: {
    clarity: number;
    pragmatism: number;
    warmth: number;
    seniority: number;
    curiosity: number;
    humor: number;
    provocation: number;
    structure: number;
    creativity: number;
    empathy: number;
  };
  voice_principles: string[];
  product_principles: string[];
  response_style: {
    default_language: string;
    default_tone: string;
    answer_first: boolean;
    use_examples: boolean;
    use_structured_sections: boolean;
    avoid_generic_advice: boolean;
    avoid_corporate_fluff: boolean;
    preferred_formats: string[];
  };
  forbidden_behaviors: string[];
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface TonaUserPersonality {
  user_id: string;
  user_email: string;
  status: 'active' | 'inactive';
  personalization_enabled: boolean;
  learning_enabled: boolean;
  profile_version: string;

  communication_style: {
    preferred_tone: string | null;
    formality_level: number;
    directness_level: number;
    detail_level: number;
    humor_level: number;
    emoji_level: number;
    metaphor_level: number;
    assertiveness_level: number;
    executive_summary_preference: boolean;
    likes_answer_first: boolean;
    likes_step_by_step: boolean;
    likes_scripts_ready_to_copy: boolean;
    likes_examples: boolean;
    likes_tables: boolean;
    likes_long_deep_dives: boolean;
  };

  vocabulary_profile: {
    recurring_words: string[];
    recurring_expressions: string[];
    preferred_terms: string[];
    avoided_terms: string[];
    slang_style: string[];
    signature_phrases: string[];
  };

  formatting_preferences: {
    prefers_bullets: boolean;
    prefers_numbered_steps: boolean;
    prefers_short_paragraphs: boolean;
    prefers_markdown: boolean;
    prefers_code_blocks_for_scripts: boolean;
    prefers_copy_ready_outputs: boolean;
    prefers_long_contextual_explanations: boolean;
  };

  product_work_preferences: {
    prefers_80_20: boolean;
    prefers_diagnosis_first: boolean;
    prefers_actionable_next_steps: boolean;
    prefers_pragmatic_tradeoffs: boolean;
    prefers_risk_callouts: boolean;
    prefers_hypothesis_vs_fact_separation: boolean;
    prefers_artifact_generation: boolean;
    preferred_artifacts: string[];
  };

  learned_patterns: {
    typical_requests: string[];
    recurring_contexts: string[];
    recurring_products: string[];
    recurring_pain_points: string[];
    recurring_decision_style: string[];
    recurring_feedback: string[];
  };

  adaptation_rules: {
    rule_id: string;
    description: string;
    confidence: number;
    source: string;
  }[];

  confidence: {
    tone: number;
    vocabulary: number;
    formatting: number;
    product_preferences: number;
  };

  privacy: {
    allow_style_learning: boolean;
    allow_vocabulary_learning: boolean;
    allow_context_learning: boolean;
    allow_sensitive_inference: boolean;
    last_user_review_at: Timestamp | null;
  };

  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface TonaPersonalityLearningEvent {
  id?: string;
  user_id: string;
  user_email: string;
  product_id?: string;
  conversation_id?: string;
  source: 'chat' | 'feedback' | 'manual_admin' | 'implicit_pattern';
  event_type: 'tone_preference' | 'vocabulary' | 'formatting' | 'correction' | 'positive_feedback' | 'negative_feedback' | 'style_pattern';
  observed_text_sample: string;
  extracted_signal: {
    type: string;
    value: any;
    interpretation: string;
  };
  confidence: number;
  should_apply: boolean;
  reviewed_by_user: boolean;
  created_at: Timestamp;
}
