export const AUDIT_TYPE_LABELS: Record<string, string> = {
  user_created_manually: "Usuário adicionado",
  user_invited: "Convite enviado",
  user_invite_accepted: "Convite aceito",
  user_role_changed: "Papel alterado",
  user_suspended: "Usuário suspenso",
  user_reactivated: "Usuário reativado",
  admin_access_denied: "Acesso negado",
  gemini_key_tested: "Chave Gemini testada",
  gemini_model_changed: "Modelo Gemini alterado",
  integration_health_checked: "Integração testada",
  mindflow_memory_created: "Memória criada",
  mindflow_memory_updated: "Memória atualizada",
  mindflow_memory_deleted: "Memória removida",
  product_created: "Produto criado",
  product_updated: "Produto atualizado",
  product_access_changed: "Acesso do produto alterado",
  decision_created: "Decisão criada",
  decision_updated: "Decisão atualizada",
  decision_superseded: "Decisão substituída",
  document_uploaded: "Documento enviado",
  document_processed: "Documento processado",
  system_setting_changed: "Configuração alterada"
};

export const AUDIT_CATEGORY_LABELS: Record<string, string> = {
  user_management: "Usuários",
  access: "Acesso",
  product: "Produto",
  decision: "Decisão",
  document: "Documento",
  mindflow: "Mindflow",
  integration: "Integrações",
  llm: "LLM",
  security: "Segurança",
  system: "Sistema"
};

export const AUDIT_SEVERITY_LABELS: Record<string, string> = {
  info: "Informativo",
  warning: "Atenção",
  critical: "Crítico"
};

export function getAuditTypeLabel(type?: string) {
  return AUDIT_TYPE_LABELS[type || ""] || type || "Evento";
}

export function getAuditCategoryLabel(category?: string) {
  return AUDIT_CATEGORY_LABELS[category || ""] || "Sistema";
}

export function getAuditSeverityLabel(severity?: string) {
  return AUDIT_SEVERITY_LABELS[severity || "info"] || "Informativo";
}
