export interface TonaCorePersonality {
  id: string;
  name: string;
  description: string;
  traits: any;
  tone_rules: any;
  questioning_rules: any;
  evidence_rules: any;
  output_rules: any;
  truth_rules: any;
  continuity_rules: any;
  save_rules: any;
  is_active: boolean;
  created_at: any;
  updated_at: any;
}

export interface UserBehaviorProfile {
  id: string;
  user_id: string;
  communication_style: any;
  preferred_depth: 'surface' | 'balanced' | 'deep';
  preferred_tone: string;
  preferred_output_format: any;
  questioning_preferences: any;
  examples_preference: any;
  script_preference: any;
  detail_level_rules: any;
  learned_patterns: any;
  dislikes: string[];
  corrections: string[];
  confidence_score: number;
  is_active: boolean;
  created_at: any;
  updated_at: any;
}

export interface ProductJourneyStage {
  id: string;
  name: string;
  slug: string;
  description: string;
  goal: string;
  central_question: string;
  short_label: string;
  icon: string;
  display_order: number;
  color: string;
  status: 'active' | 'archived';
  stage_agent_id: string;
  maturity_config: any;
  field_config: any;
  artifact_config: any;
  mindflow_usage_config: any;
  save_rules: any;
  created_at: any;
  updated_at: any;
}

export interface StageAgentConfig {
  id: string;
  stage_id: string;
  agent_id: string;
  behavior_config: any;
  questioning_config: any;
  gap_handling_rules: any;
  specialist_selection_rules: any;
  maturity_rules: any;
  uses_core_personality: boolean;
  uses_shared_mindflow: boolean;
  uses_user_behavior_profile: boolean;
  is_active: boolean;
  created_at: any;
  updated_at: any;
}

export interface StageSpecialistBinding {
  id: string;
  stage_id: string;
  specialist_agent_id: string;
  role: 'primary' | 'support' | 'auxiliary';
  execution_order: number;
  trigger_type: string;
  trigger_conditions: any;
  input_mapping: any;
  output_mapping: any;
  artifact_types: string[];
  is_required: boolean;
  is_automatic: boolean;
  is_active: boolean;
  created_at: any;
  updated_at: any;
}

export interface ProductStageMaturitySnapshot {
  id: string;
  product_id: string;
  stage_id: string;
  maturity_score: number;
  quality_label: string;
  strengths: string[];
  gaps: string[];
  blocking_issues: string[];
  recommended_next_action: string;
  explanation: string;
  calculated_at: any;
}

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface AdminCtx {
  isAdmin: boolean;
  isOwner: boolean;
  roles: UserRole[];
  userId: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  product_type?: string;
  objective?: string;
  owner_id: string;
  organization_id?: string;
  area?: string;
  team?: string;
  status: 'active' | 'paused' | 'archived' | 'completed';
  current_stage: string;
  progress: number;
  quality_score: number;
  created_at: any;
  updated_at: any;
}

export type StageKey = 'sense' | 'shape' | 'sketch' | 'scope' | 'ship' | 'sense_plus';

export interface ProductStage {
  id: string;
  product_id: string;
  stage_key: StageKey;
  name: string;
  status: 'not_started' | 'in_progress' | 'incomplete' | 'ready_for_review' | 'approved' | 'reopened';
  progress: number;
  quality_score: number;
  created_at: any;
  updated_at: any;
}

export interface StageField {
  id: string;
  product_id: string;
  stage_id: string;
  stage_key: StageKey;
  field_key: string;
  label: string;
  value: string;
  classification: 'fact' | 'hypothesis' | 'evidence' | 'decision' | 'risk' | 'pending';
  quality_status: 'empty' | 'draft' | 'sufficient' | 'strong' | 'needs_review' | 'approved';
  quality_reason?: string;
  source?: string;
  confidence: number;
  created_at: any;
  updated_at: any;
}

export interface Artifact {
  id: string;
  product_id: string;
  stage_id: string;
  stage_name?: string;
  framework_key?: string;
  type: string;
  title: string;
  description?: string;
  version: string;
  version_number?: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'final' | 'generated' | 'draft_generated';
  content: string;
  content_html?: string;
  content_json?: any;
  plain_text?: string;
  word_count?: number;
  character_count?: number;
  content_blocks?: any[];
  source_data?: any;
  creation_mode?: 'blank' | 'tona_generated' | 'versioned';
  source?: 'manual' | 'tona_generated' | 'versioned';
  is_core?: boolean;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  
  quality_score?: number;
  quality_status?: "empty" | "draft" | "sufficient" | "strong" | "needs_review";
  review_status?: "not_reviewed" | "in_review" | "approved" | "rejected";
  
  comments_count?: number;
  unresolved_comments_count?: number;
  
  created_by: string;
  created_by_email?: string;
  updated_by?: string;
  updated_by_email?: string;
  approved_by?: string;
  approved_by_email?: string;
  approved_at?: any;
  created_at: any;
  updated_at: any;
  last_edited_at?: any;
  last_exported_at?: any;
}

export interface Decision {
  id: string;
  product_id: string;
  stage_id?: string;
  title: string;
  description: string;
  reason: string;
  evidence: string;
  impact: string;
  status: 'proposed' | 'in_discussion' | 'approved' | 'reverted' | 'obsolete';
  author_id: string;
  previous_decision_id?: string;
  created_at: any;
  updated_at: any;
}

export interface Memory {
  id: string;
  product_id?: string;
  stage_id?: string;
  type: 'base' | 'learned' | 'decision' | 'evidence' | 'style' | 'gap' | 'risk' | 'rule' | 'template' | 'instruction';
  title: string;
  content: string;
  source?: string;
  confidence: number;
  status: 'active' | 'pending' | 'approved' | 'rejected' | 'archived' | 'obsolete' | 'conflict';
  can_ai_use: boolean;
  created_by: string;
  created_at: any;
  updated_at: any;
  version: string;
  previous_version_id?: string;
  metadata?: any;
}

export interface MindflowStep {
  id: string;
  type: 'analysis' | 'planning' | 'execution' | 'observation' | 'learning';
  status: 'pending' | 'running' | 'completed' | 'failed';
  goal: string;
  reasoning: string;
  action_taken?: string;
  result?: string;
  started_at: any;
  completed_at?: any;
}

export interface MindflowLoop {
  id: string;
  product_id: string;
  user_id: string;
  status: 'idle' | 'running' | 'paused' | 'error';
  current_goal: string;
  steps: MindflowStep[];
  started_at: any;
  updated_at: any;
}

export interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string;
  long_description?: string;
  type: 'orchestrator' | 'stage_agent' | 'specialist' | 'behavioral' | 'custom' | 'discovery' | 'strategy' | 'product' | 'design' | 'engineering' | 'pmm' | 'data' | 'quality' | 'memory' | 'artifact' | 'evaluation' | 'validator' | 'auditor';
  primary_discipline: 'Product Management' | 'Design' | 'Engenharia' | 'Product Marketing' | 'Data' | 'Liderança' | 'Multidisciplinar';
  status: 'draft' | 'active' | 'testing' | 'paused' | 'deprecated' | 'archived' | 'obsolete';
  primary_stage_id: StageKey | 'global';
  secondary_stage_ids?: StageKey[];
  icon?: string;
  color?: string;
  tags?: string[];
  default_model: string;
  temperature: number;
  tools: string[];
  memory_enabled: boolean;
  base_memory_enabled: boolean;
  learned_memory_enabled: boolean;
  mindflow_enabled?: boolean;
  uses_shared_mindflow?: boolean;
  uses_core_personality?: boolean;
  uses_user_behavior_profile?: boolean;
  allowed_memory_types?: string[];
  retrieval_strategy?: 'hybrid_search' | 'semantic_search' | 'graph_search' | 'recency_search' | 'product_only' | 'user_preference_only' | 'decision_first' | 'artifact_first' | 'stage_context_first';
  max_memories?: number;
  can_save_learnings?: boolean;
  learning_requires_review?: boolean;
  input_mapping?: any;
  output_mapping?: any;
  output_schema?: any;
  output_type: string;
  artifact_type?: string;
  save_target?: {
    type: 'field' | 'artifact' | 'history' | 'decision' | 'mindflow' | 'maturity' | 'next_action';
    key: string;
  };
  behavior_config?: {
    role?: string;
    tone?: string;
    depth?: 'surface' | 'balanced' | 'deep';
    provocation?: 'none' | 'low' | 'medium' | 'high';
    question_style?: string;
    response_style?: string;
    gap_handling?: string;
    challenge_style?: string;
    evidence_request_style?: string;
    uncertainty_handling?: string;
    user_adaptation?: string;
    generic_avoidance?: string;
    continuity_style?: string;
  };
  created_by: string;
  created_at: any;
  updated_at: any;
  active_version_id?: string;
}

export interface InstructionBlocks {
  identity: string;
  objective: string;
  when_to_use: string;
  when_not_to_use: string;
  expected_inputs: string;
  mandatory_tasks: string;
  reasoning_method: string;
  questions_to_ask: string;
  quality_criteria: string;
  guardrails: string;
  output_format: string;
  save_behavior: string;
  gap_handling: string;
  classification_rules: string;
  good_examples: string;
  bad_examples: string;
}

export interface AgentInstructionVersion {
  id: string;
  agent_id: string;
  version_number: string;
  status: 'draft' | 'testing' | 'published' | 'archived' | 'reverted';
  change_summary: string;
  change_reason?: string;
  expected_impact?: string;
  change_type?: 'tone' | 'guardrail' | 'output' | 'stage' | 'behavior' | 'fix' | 'quality' | 'experimental';
  instruction_blocks: InstructionBlocks;
  compiled_prompt: string;
  output_schema?: any;
  guardrails?: any;
  created_by: string;
  created_at: any;
  published_at?: any;
  is_active: boolean;
}

export interface AgentFlowBinding {
  id: string;
  agent_id: string;
  stage_id: StageKey;
  role: 'primary' | 'support' | 'auxiliary';
  execution_order: number;
  trigger_type: 'on_stage_start' | 'on_user_help' | 'on_weak_field' | 'on_missing_evidence' | 'on_artifact_request' | 'on_decision' | 'on_ready_for_review' | 'on_document_upload' | 'on_critical_gap' | 'on_tona_selection';
  trigger_conditions: any;
  save_target?: any;
  artifact_type?: string;
  is_required: boolean;
  is_automatic: boolean;
  is_active: boolean;
  created_at: any;
  updated_at: any;
}

export interface AgentTestRun {
  id: string;
  agent_id: string;
  version_id: string;
  product_id?: string;
  stage_id?: string;
  user_input: string;
  context_snapshot: any;
  response: string;
  parsed_output: any;
  evaluation?: {
    clarity: 'ruim' | 'regular' | 'bom' | 'excelente';
    utility: 'ruim' | 'regular' | 'bom' | 'excelente';
    adherence: 'ruim' | 'regular' | 'bom' | 'excelente';
    score: number;
    feedback: string;
  };
  status: 'success' | 'failed';
  created_by: string;
  created_at: any;
}

export type MindflowKnowledgeType = 'Base' | 'Adquirida';
export type MindflowClassification = 'fato' | 'hipótese' | 'evidência' | 'decisão' | 'risco' | 'pendência' | 'preferência' | 'aprendizado' | 'instrução' | 'artefato' | 'contexto' | 'regra' | 'exemplo' | 'comportamento';
export type MindflowScope = 'global' | 'user' | 'product' | 'stage' | 'agent' | 'artifact' | 'conversation';

export interface MindflowLearning {
  id: string;
  learning_date?: string | any;
  learning_type: MindflowKnowledgeType;
  theme: string;
  sub_theme?: string;
  title?: string;
  learning: string;
  summary?: string;
  classification: MindflowClassification;
  source_type?: string;
  source_id?: string;
  interaction_id?: string;
  source_reference?: string;
  scope_type: MindflowScope;
  user_id?: string;
  product_id?: string;
  stage_id?: string;
  agent_id?: string;
  artifact_id?: string;
  conversation_id?: string;
  context_id?: string;
  product?: string;
  context?: string;
  sub_context?: string;
  source_user_memory_ids?: string[];
  confidence_score: number;
  relevance_score: number;
  quality_score: number;
  usage_count: number;
  last_used_at?: any;
  is_verified: boolean;
  needs_review: boolean;
  is_active: boolean;
  is_promoted_to_base?: boolean;
  promoted_from_learning_id?: string;
  created_by?: string;
  created_at: any;
  updated_at: any;
  metadata: any;
  embedding?: number[];
}

export interface MindflowLearningRelationship {
  id: string;
  source_learning_id: string;
  target_learning_id: string;
  relationship_type: string;
  strength: number;
  created_at: any;
  updated_at: any;
  metadata: any;
}

export interface MindflowLearningCandidate {
  id: string;
  user_id?: string;
  source_user_memory_ids?: string[];
  product_id?: string;
  stage_id?: string;
  agent_id?: string;
  conversation_id?: string;
  context_id?: string;
  source_type: string;
  raw_input: string;
  tona_response?: string;
  extracted_learning: string;
  suggested_theme?: string;
  suggested_sub_theme?: string;
  suggested_classification?: MindflowClassification;
  confidence_score: number;
  should_save: boolean;
  saved_learning_id?: string;
  review_status: 'pending' | 'approved' | 'rejected' | 'auto_saved' | 'ignored';
  reviewed_by?: string;
  reviewed_at?: any;
  created_at: any;
  metadata: any;
}

export interface MindflowRetrievalLog {
  id: string;
  user_id?: string;
  product_id?: string;
  stage_id?: string;
  agent_id?: string;
  query_text: string;
  retrieval_strategy: string;
  learnings_retrieved: string[];
  learnings_used: string[];
  reasonings_retrieved: string[];
  reasonings_used: string[];
  response_id?: string;
  created_at: any;
  metadata: any;
}

export type MindflowReasoningType = 
  | 'base_reasoning' 
  | 'acquired_reasoning' 
  | 'hybrid_reasoning' 
  | 'behavioral_reasoning' 
  | 'product_reasoning' 
  | 'stage_reasoning' 
  | 'agent_reasoning' 
  | 'contradiction_reasoning' 
  | 'opportunity_reasoning' 
  | 'risk_reasoning'
  | 'metacognitive_reasoning'
  | 'strategic'
  | 'behavioral'
  | 'systemic';

export type MindflowInferenceType = 
  | 'deductive' 
  | 'inductive' 
  | 'abductive' 
  | 'analogical' 
  | 'metacognitive' 
  | 'mixed';

export type MindflowReasoningStatus = 
  | 'draft' 
  | 'active' 
  | 'pending_review' 
  | 'rejected' 
  | 'archived' 
  | 'superseded' 
  | 'contradicted' 
  | 'needs_base_validation';

export interface ReasoningChainStep {
  step: number;
  type: 'base_learning_anchor' | 'acquired_learning_signal' | 'contextual_synthesis' | 'deep_conclusion' | 'future_application' | 'base_validation' | 'metacognitive_note';
  description: string;
  source_id?: string | null;
}

export interface TonaContextPack {
  interaction_id: string;
  detected_context: any;
  tona_core_personality: any;
  user_behavior_profile: any;
  product_state: any;
  stage_state: any;
  stage_agent: any;
  specialist_agent?: any;
  base_learnings: MindflowLearning[];
  acquired_learnings: MindflowLearning[];
  base_reasonings: MindflowReasoning[];
  active_reasonings: MindflowReasoning[];
  user_memories: MindflowUserMemory[];
  save_rules: any;
  warnings: string[];
  personality_context?: string;
}

export interface TonaStructuredOutput {
  user_response: string;
  structured_output: {
    facts?: string[];
    hypotheses?: string[];
    evidence?: string[];
    decisions?: string[];
    risks?: string[];
    pending_items?: string[];
    preferences?: string[];
    learnings?: string[];
  };
  save_recommendations: {
    target: 'mindflow_learning' | 'mindflow_memory' | 'product_field' | 'artifact' | 'decision' | 'interaction' | 'reasoning_candidate';
    content: string;
    classification: string;
    confidence_score: number;
  }[];
  next_action?: string;
  warnings?: string[];
}

export interface MindflowRuntimeLog {
  id: string;
  interaction_id: string;
  user_id: string;
  product_id?: string;
  stage_id?: string;
  agent_id?: string;
  context_id?: string;
  base_memory_ids: string[];
  acquired_memory_ids: string[];
  reasoning_ids: string[];
  recent_interaction_ids: string[];
  prompt_tokens_estimate?: number;
  completion_tokens_estimate?: number;
  warnings: string[];
  created_at: any;
}

export type MindflowConflictType = 
  | 'base_vs_acquired'
  | 'base_vs_reasoning'
  | 'acquired_vs_acquired'
  | 'decision_vs_decision'
  | 'preference_vs_preference'
  | 'context_vs_context'
  | 'reasoning_vs_reasoning'
  | 'duplicated_divergent_memory'
  | 'low_confidence_high_usage'
  | 'unverified_vs_verified'
  | 'other';

export type MindflowConflictStatus = 'open' | 'grouped' | 'in_review' | 'resolved' | 'ignored' | 'archived';
export type MindflowSeverity = 'low' | 'medium' | 'high' | 'critical';
export type MindflowPriority = 'low' | 'medium' | 'high' | 'critical';

export interface MindflowSuggestedAction {
  action_id: string;
  label: string;
  description: string;
  recommended: boolean;
  risk_level: 'low' | 'medium' | 'high';
  requires_confirmation: boolean;
  effects: string[];
}

export interface MindflowConflict {
  id: string;
  conflict_group_id?: string;
  conflict_type: MindflowConflictType;
  title: string;
  summary: string;
  conflict_reason: string;
  impact_description?: string;
  severity: MindflowSeverity;
  status: MindflowConflictStatus;
  priority: MindflowPriority;
  primary_memory_id?: string;
  conflicting_memory_id?: string;
  primary_reasoning_id?: string;
  conflicting_reasoning_id?: string;
  context_id?: string;
  user_id?: string;
  product_id?: string;
  stage_id?: string;
  agent_id?: string;
  involved_memory_ids: string[];
  involved_interaction_ids: string[];
  suggested_actions: MindflowSuggestedAction[];
  resolution_decision?: string;
  resolution_action?: string;
  resolved_by?: string;
  resolved_at?: any;
  detected_at: any;
  updated_at: any;
  metadata: any;
}

export interface MindflowConflictGroup {
  id: string;
  title: string;
  summary: string;
  group_reason: string;
  main_conflict_type: string;
  theme?: string;
  sub_theme?: string;
  scope_type: 'global' | 'user' | 'product' | 'stage';
  user_id?: string;
  product_id?: string;
  stage_id?: string;
  agent_id?: string;
  context_id?: string;
  severity: MindflowSeverity;
  priority: MindflowPriority;
  status: MindflowConflictStatus;
  conflict_count: number;
  suggested_actions: MindflowSuggestedAction[];
  recommended_resolution?: string;
  created_at: any;
  updated_at: any;
  resolved_by?: string;
  resolved_at?: any;
  metadata: any;
}

export interface MindflowConflictResolutionLog {
  id: string;
  conflict_group_id: string;
  conflict_id?: string;
  action_id: string;
  resolution_notes?: string;
  before_state: any;
  after_state: any;
  resolved_by: string;
  created_at: any;
}

export type MindflowReasoningClassification = 
  | 'regra' 
  | 'aprendizado' 
  | 'recomendação' 
  | 'alerta' 
  | 'padrão' 
  | 'hipótese' 
  | 'decisão' 
  | 'preferência' 
  | 'risco' 
  | 'oportunidade' 
  | 'melhoria_de_agente' 
  | 'melhoria_de_produto' 
  | 'melhoria_de_etapa';

export interface MindflowReasoning {
  id: string;
  reasoning_date: string;
  reasoning_type: MindflowReasoningType;
  inference_type: MindflowInferenceType;
  title: string;
  reasoning: string;
  summary?: string;
  why_it_matters?: string;
  theme: string;
  sub_theme?: string;
  classification: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  scope_type: MindflowScope;
  user_id?: string;
  product_id?: string;
  stage_id?: string;
  agent_id?: string;
  context_id?: string;
  source_learning_ids: string[];
  base_learning_ids: string[];
  acquired_learning_ids: string[];
  supporting_user_memory_ids: string[];
  source_context_ids?: string[];
  conclusion_depth: 'medium' | 'deep' | 'strategic';
  abstraction_level: 'operational' | 'behavioral' | 'tactical' | 'strategic' | 'architectural' | 'systemic';
  applicability_rules?: any;
  transfer_contexts?: string[];
  recommended_actions: any[];
  risks_if_ignored: any[];
  reasoning_chain: ReasoningChainStep[];
  confidence_score: number;
  quality_score: number;
  base_alignment_score: number;
  contradiction_score: number;
  usage_count: number;
  last_used_at?: any;
  status: MindflowReasoningStatus;
  needs_review: boolean;
  is_active: boolean;
  generated_by: string;
  reviewed_by?: string;
  reviewed_at?: any;
  created_at: any;
  updated_at: any;
  metadata: any;
  embedding?: number[];
}

export interface MindflowMemoryLearningLink {
  id: string;
  user_memory_id: string;
  learning_id: string;
  relationship_type: 'generated' | 'supported' | 'contradicted' | 'refined' | 'confirmed' | 'source' | 'used_in_response';
  confidence_score: number;
  created_at: any;
  metadata: any;
}

export interface MindflowLearningReasoningLink {
  id: string;
  learning_id: string;
  reasoning_id: string;
  learning_role: 'primary_basis' | 'base_validator' | 'acquired_signal' | 'supporting_learning' | 'contradiction_candidate' | 'context_condition' | 'rejected_basis';
  contribution_score: number;
  created_at: any;
  metadata: any;
}

export interface MindflowReasoningRun {
  id: string;
  run_date: string;
  started_at: any;
  finished_at?: any;
  completed_at?: any;
  status: 'running' | 'completed' | 'completed_with_warnings' | 'failed';
  total_memories_analyzed: number;
  base_memories_analyzed: number;
  acquired_memories_analyzed: number;
  reasonings_generated: number;
  reasonings_activated: number;
  reasonings_pending_review: number;
  contradictions_detected: number;
  errors: any[];
  metadata: any;
}

export interface MindflowContextMap {
  id: string;
  order: number;
  name: string;
  framework_key: string;
  product_context_label: string;
  focus: string;
  intention: string;
  description: string;
  cognitive_mode: string;
  central_question: string;
  focus_areas: string[];
  quality_criteria: string[];
  common_gaps: string[];
  recommended_artifacts: string[];
  recommended_agents: string[];
  forbidden_shortcuts: string[];
  weights: {
    hypothesis: "H" | "M" | "L";
    memory: "H" | "M" | "L";
    learning: "H" | "M" | "L";
    risk: "H" | "M" | "L";
    evidence: "H" | "M" | "L";
    decision: "H" | "M" | "L";
  };
  maturity_behavior: {
    low: string;
    medium: string;
    high: string;
  };
  response_behavior: {
    default_opening: string;
    question_style: string;
    should_ask_for_evidence: boolean;
    should_challenge_shortcuts: boolean;
    should_recommend_next_step: boolean;
    should_generate_artifact: boolean;
  };
  status: "active" | "inactive";
  is_system_context: true;
  created_at: any;
  updated_at: any;
}

export interface MindflowContext {
  id: string;
  product: string;
  context: string;
  sub_context: string;
  intention?: string;
  description?: string;
  expected_output?: string;
  high_weight_terms?: string;
  medium_weight_terms?: string;
  low_weight_terms?: string;
  high_weight_terms_array: string[];
  medium_weight_terms_array: string[];
  low_weight_terms_array: string[];
  priority: number;
  is_active: boolean;
  created_by?: string;
  created_at: any;
  updated_at: any;
  metadata: any;
}

export interface MindflowUserMemory {
  id: string;
  user_id: string;
  user_identifier?: string;
  memory_date: string;
  memory_time?: string;
  product?: string;
  context?: string;
  sub_context?: string;
  context_confidence_score?: number;
  detected_intention?: string;
  user_message: string;
  tona_response?: string;
  conversation_id?: string;
  product_id?: string;
  agent_id?: string;
  context_id?: string;
  used_learning_ids: string[];
  used_reasoning_ids: string[];
  generated_learning_ids: string[];
  status: 'completed' | 'failed' | 'ignored' | 'pending_response';
  created_at: any;
  updated_at: any;
  metadata: any;
}

export interface ScheduledAction {
  id: string;
  type: 'artifact_generation' | 'memory_sync' | 'maturity_check' | 'user_nudge' | 'market_research';
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  schedule_time: any;
  payload: any;
  result?: any;
  product_id: string;
  created_by: string;
  created_at: any;
  updated_at: any;
}

export interface ConversationMemory {
  id: string;
  product_id: string;
  user_id: string;
  active_stage_key: StageKey;
  conversation_summary?: string;
  last_assistant_message?: string;
  last_user_message?: string;
  last_question_asked?: string;
  last_question_type?: string;
  last_options_presented?: any[];
  selected_options?: string[];
  pending_question?: string;
  pending_answer_expected?: string;
  current_intent?: string;
  current_reasoning_thread?: string;
  next_best_action?: string;
  unresolved_gaps?: string[];
  open_hypotheses?: string[];
  last_artifact_suggestion?: string;
  last_maturity_snapshot?: any;
  status: 'active' | 'paused' | 'resolved' | 'archived';
  created_at: any;
  updated_at: any;
}

export interface Document {
  id: string;
  product_id: string;
  title: string;
  file_url: string;
  file_type: string;
  processing_status: 'pending' | 'processing' | 'processed' | 'error';
  extracted_content?: string;
  created_by: string;
  created_at: any;
  updated_at: any;
}

export interface MindflowImportJob {
  id: string;
  import_type: 'learnings_csv' | 'user_memories_csv' | 'contexts_csv';
  file_name: string;
  file_size_bytes: number;
  status: 'processing' | 'completed' | 'completed_with_warnings' | 'failed' | 'cancelled';
  progress: number;
  current_step?: string;
  current_message?: string;
  total_rows: number;
  valid_rows?: number;
  imported_rows: number;
  skipped_rows: number;
  error_rows: number;
  duplicate_rows: number;
  base_rows: number;
  acquired_rows: number;
  reasoning_candidates_generated?: number;
  reasonings_created?: number;
  reasonings_activated?: number;
  reasonings_pending_review?: number;
  reasonings_rejected_as_shallow?: number;
  reasonings_blocked_by_base_conflict?: number;
  conflicts_detected?: number;
  conflict_groups_created?: number;
  warnings: string[];
  errors: string[];
  created_by: string;
  created_at: any;
  started_at?: any;
  finished_at?: any;
  metadata: any;
}

export interface MindflowImportJobEvent {
  id: string;
  import_job_id: string;
  event_order: number;
  event_type: 'info' | 'success' | 'warning' | 'error' | 'reasoning' | 'conflict' | 'system';
  step: string;
  message: string;
  progress: number;
  metadata?: any;
  created_at: any;
}

export interface MindflowBehavioralProfile {
  id: string;
  user_id: string;
  user_identifier?: string;
  preferred_depth: 'short' | 'balanced' | 'detailed' | 'exhaustive';
  preferred_format?: 'script' | 'checklist' | 'bullets' | 'explanation' | 'artifact' | 'json' | 'table' | 'conversation' | 'mixed';
  preferred_tone?: string;
  preferred_structure?: string;
  communication_style: any;
  format_preferences: any;
  depth_preferences_by_context: any;
  tone_preferences_by_context: any;
  correction_patterns: string[];
  approval_patterns: string[];
  rejection_patterns: string[];
  recurring_contexts: string[];
  recurring_outputs: string[];
  interaction_cadence: any;
  confidence_score: number;
  is_active: boolean;
  created_at: any;
  updated_at: any;
  metadata: any;
}

export interface MindflowBehavioralSignal {
  id: string;
  user_id: string;
  user_memory_id?: string;
  context_id?: string;
  product_id?: string;
  stage_id?: string;
  agent_id?: string;
  signal_type: 'depth_preference' | 'format_preference' | 'tone_preference' | 'correction_pattern' | 'approval_pattern' | 'rejection_pattern' | 'context_preference' | 'output_preference' | 'continuity_expectation' | 'implementation_bias' | 'strategic_bias' | 'technical_bias' | 'conversational_style' | 'interaction_cadence';
  signal_value: string;
  signal_strength: number;
  confidence_score: number;
  evidence?: string;
  source_type: string;
  created_at: any;
  metadata: any;
}

export interface MindflowCognitiveTrace {
  id: string;
  user_memory_id?: string;
  user_id: string;
  conversation_id?: string;
  product_id?: string;
  stage_id?: string;
  agent_id?: string;
  stage_agent_id?: string;
  specialist_agent_id?: string;
  context_id?: string;
  detected_context: any;
  context_confidence_score: number;
  used_memory_ids: string[];
  used_learning_ids: string[];
  used_reasoning_ids: string[];
  used_behavioral_signal_ids: string[];
  detected_conflict_ids: string[];
  perception_summary?: string;
  interpretation_summary?: string;
  response_strategy?: string;
  adaptation_applied: any;
  warnings: any[];
  save_actions: any[];
  prompt_snapshot?: string;
  context_pack_snapshot?: any;
  model_output_snapshot?: any;
  created_at: any;
  metadata: any;
}

export interface MindflowCognitiveTraceEvent {
  id: string;
  trace_id: string;
  event_order: number;
  event_type: 'user_message_received' | 'context_detected' | 'user_memory_created' | 'base_learning_retrieved' | 'acquired_learning_retrieved' | 'reasoning_retrieved' | 'behavioral_profile_loaded' | 'behavioral_signal_detected' | 'conflict_warning_detected' | 'stage_agent_selected' | 'specialist_agent_selected' | 'prompt_composed' | 'model_called' | 'response_generated' | 'memory_updated' | 'learning_candidate_created' | 'learning_saved' | 'artifact_generated' | 'maturity_recalculated' | 'trace_completed';
  title: string;
  description?: string;
  entity_type?: string;
  entity_id?: string;
  confidence_score?: number;
  metadata: any;
  created_at: any;
}

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url?: string;
  created_at: any;
  updated_at: any;
}
