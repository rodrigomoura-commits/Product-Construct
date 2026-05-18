export function normalizeEmail(email: any) {
  return String(email || "").trim().toLowerCase();
}

export function normalizeRole(role: any) {
  return String(role || "").trim().toLowerCase();
}

export function normalizeStatus(status: any) {
  return String(status || "active").trim().toLowerCase();
}

export function safeArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

export function isActiveCollaborator(collab: any) {
  return normalizeStatus(collab.status) === "active";
}

export function isOwnerCollaborator(collab: any) {
  return normalizeRole(collab.role) === "owner";
}

export function isPendingInvite(invite: any) {
  return normalizeStatus(invite.status || "pending") === "pending";
}

export function getUserAccessId(user: any) {
  return user?.uid || user?.id || user?.doc_id || null;
}

export function getProductName(product: any) {
  return product?.name || product?.title || product?.summary || "Produto sem nome";
}

export function calculateProductProgress(product: any) {
  if (typeof product?.progress === "number") return product.progress;
  if (typeof product?.overall_progress === "number") return product.overall_progress;
  if (typeof product?.maturity === "number") return product.maturity;
  return 0;
}

export function calculateAccessHealth(product: any, collaborators: any[], pendingInvites: any[]) {
  const activeCollaborators = collaborators.filter(isActiveCollaborator);
  const owners = activeCollaborators.filter(isOwnerCollaborator);

  if (owners.length === 0) {
    return {
      health: "critical",
      reason: "Produto sem proprietário ativo."
    };
  }

  if (product?.needs_access_normalization) {
    return {
      health: "warning",
      reason: "Produto antigo precisa confirmar normalização de acessos."
    };
  }

  if (pendingInvites.filter(isPendingInvite).length > 0) {
    return {
      health: "warning",
      reason: "Produto possui convites pendentes."
    };
  }

  return {
    health: "ok",
    reason: "Acessos consistentes."
  };
}

export function shouldProductNeedNormalization(product: any, collaborators: any[]) {
  const hasCollaboratorSubcollection = collaborators.length > 0;
  const hasLegacyOwner =
    Boolean(product?.owner_id) ||
    safeArray(product?.owner_ids).length > 0 ||
    Boolean(product?.created_by);

  if (!hasCollaboratorSubcollection && hasLegacyOwner) return true;

  const activeOwners = collaborators
    .filter(isActiveCollaborator)
    .filter(isOwnerCollaborator);

  if (activeOwners.length === 0) return true;

  return Boolean(product?.needs_access_normalization);
}
