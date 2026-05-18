export type ProductRole = "owner" | "editor" | "commenter" | "viewer";

export function normalizeProductRole(role: any): ProductRole {
  const normalized = String(role || "viewer").trim().toLowerCase();

  if (normalized === "owner") return "owner";
  if (normalized === "editor") return "editor";
  if (normalized === "commenter") return "commenter";
  if (normalized === "viewer") return "viewer";

  return "viewer";
}

export function getProductPermission(role: any) {
  const normalizedRole = normalizeProductRole(role);

  const map = {
    owner: {
      role: "owner",
      label: "Owner",
      canView: true,
      canEdit: true,
      canComment: true,
      canDelete: true,
      canEditProduct: true,
      canChat: true,
      canCreateMessages: true,
      canCreateArtifacts: true,
      canEditArtifacts: true,
      canDeleteArtifacts: true,
      canCreateDecisions: true,
      canEditDecisions: true,
      canDeleteDecisions: true,
      canUploadDocuments: true,
      canDeleteDocuments: true,
      canManageAccess: true,
      canExport: true,
      canArchiveProduct: true,
      canDeleteProduct: true
    },

    editor: {
      role: "editor",
      label: "Editor",
      canView: true,
      canEdit: true,
      canComment: true,
      canDelete: false,
      canEditProduct: true,
      canChat: true,
      canCreateMessages: true,
      canCreateArtifacts: true,
      canEditArtifacts: true,
      canDeleteArtifacts: false,
      canCreateDecisions: true,
      canEditDecisions: true,
      canDeleteDecisions: false,
      canUploadDocuments: true,
      canDeleteDocuments: false,
      canManageAccess: false,
      canExport: true,
      canArchiveProduct: false,
      canDeleteProduct: false
    },

    commenter: {
      role: "commenter",
      label: "Comentador",
      canView: true,
      canEdit: false,
      canComment: true,
      canDelete: false,
      canEditProduct: false,
      canChat: true,
      canCreateMessages: true,
      canCreateArtifacts: false,
      canEditArtifacts: false,
      canDeleteArtifacts: false,
      canCreateDecisions: false,
      canEditDecisions: false,
      canDeleteDecisions: false,
      canUploadDocuments: false,
      canDeleteDocuments: false,
      canManageAccess: false,
      canExport: false,
      canArchiveProduct: false,
      canDeleteProduct: false
    },

    viewer: {
      role: "viewer",
      label: "Visualizador",
      canView: true,
      canEdit: false,
      canComment: false,
      canDelete: false,
      canEditProduct: false,
      canChat: false,
      canCreateMessages: false,
      canCreateArtifacts: false,
      canEditArtifacts: false,
      canDeleteArtifacts: false,
      canCreateDecisions: false,
      canEditDecisions: false,
      canDeleteDecisions: false,
      canUploadDocuments: false,
      canDeleteDocuments: false,
      canManageAccess: false,
      canExport: false,
      canArchiveProduct: false,
      canDeleteProduct: false
    }
  };

  return map[normalizedRole];
}
