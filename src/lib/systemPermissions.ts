export type SystemRole = "owner" | "admin" | "user";

export type SystemPermission =
  | "access_admin_console"
  | "manage_users"
  | "manage_admins"
  | "manage_instance_owners"
  | "manage_products_all"
  | "manage_mindflow"
  | "manage_personas"
  | "manage_agent_studio"
  | "manage_integrations"
  | "manage_infrastructure"
  | "manage_llm_provider"
  | "manage_billing"
  | "view_audit_logs"
  | "export_data"
  | "delete_global_memory";

export const SYSTEM_ROLE_LABELS = {
  owner: "Owner da Instância",
  admin: "Admin Operacional",
  user: "Usuário"
};

export const SYSTEM_ROLE_DESCRIPTIONS = {
  owner: "Acesso total à aplicação, integrações, infraestrutura, segurança e administração.",
  admin: "Administra operação, usuários, produtos, Mindflow, personas e agentes.",
  user: "Usa o Product Constructor para criar e colaborar em produtos."
};

export const SYSTEM_PERMISSIONS: Record<SystemRole, SystemPermission[]> = {
  owner: [
    "access_admin_console",
    "manage_users",
    "manage_admins",
    "manage_instance_owners",
    "manage_products_all",
    "manage_mindflow",
    "manage_personas",
    "manage_agent_studio",
    "manage_integrations",
    "manage_infrastructure",
    "manage_llm_provider",
    "manage_billing",
    "view_audit_logs",
    "export_data",
    "delete_global_memory"
  ],
  admin: [
    "access_admin_console",
    "manage_users",
    "manage_products_all",
    "manage_mindflow",
    "manage_personas",
    "manage_agent_studio",
    "view_audit_logs"
  ],
  user: []
};

export function hasSystemPermission(profile: any, permission: SystemPermission) {
  const role = profile?.system_role || "user";
  return SYSTEM_PERMISSIONS[role]?.includes(permission) || false;
}

export function isInstanceOwner(profile: any) {
  return profile?.system_role === "owner";
}

export function isOperationalAdmin(profile: any) {
  return profile?.system_role === "admin";
}

export function canAccessAdmin(profile: any) {
  return hasSystemPermission(profile, "access_admin_console");
}
