import { Product, AdminCtx } from '../types';

export function getUserProductRole(product: Product, user: any) {
  if (!user) return null;

  if (product.owner_id === user.uid) return "owner";

  const collaborator = product.collaborators?.find(c =>
    c.user_id === user.uid ||
    c.email?.toLowerCase() === user.email?.toLowerCase()
  );

  return collaborator?.role || null;
}

export function canViewProduct(product: Product, user: any, adminCtx?: AdminCtx) {
  if (adminCtx?.isAdmin || adminCtx?.isOwner) return true;

  const role = getUserProductRole(product, user);
  return ["owner", "editor", "commenter", "viewer"].includes(role as string);
}

export function canEditProduct(product: Product, user: any, adminCtx?: AdminCtx) {
  if (adminCtx?.isAdmin || adminCtx?.isOwner) return true;

  const role = getUserProductRole(product, user);
  return ["owner", "editor"].includes(role as string);
}

export function canManageProductAccess(product: Product, user: any, adminCtx?: AdminCtx) {
  if (adminCtx?.isAdmin || adminCtx?.isOwner) return true;

  const role = getUserProductRole(product, user);
  return role === "owner";
}

export function canCommentProduct(product: Product, user: any, adminCtx?: AdminCtx) {
  if (adminCtx?.isAdmin || adminCtx?.isOwner) return true;

  const role = getUserProductRole(product, user);
  return ["owner", "editor", "commenter"].includes(role as string);
}

export function normalizeProductAccess(product: Product, currentUser: any, adminCtx?: AdminCtx) {
  const fallbackUserId =
    product.owner_id ||
    product.created_by ||
    currentUser?.uid ||
    adminCtx?.userId;

  const fallbackEmail =
    product.owner_email ||
    product.created_by_email ||
    currentUser?.email ||
    adminCtx?.email;

  const fallbackName =
    product.owner_name ||
    product.created_by_name ||
    currentUser?.displayName ||
    adminCtx?.displayName ||
    fallbackEmail;

  const collaborators = Array.isArray(product.collaborators)
    ? product.collaborators
    : [];

  const activeCollaborators = collaborators.filter((c: any) => c.status !== "removed");

  const hasOwner = activeCollaborators.some(c =>
    c.role === "owner" &&
    (
      c.user_id === fallbackUserId ||
      c.email?.toLowerCase() === fallbackEmail?.toLowerCase()
    )
  );

  const normalizedCollaborators = hasOwner
    ? activeCollaborators
    : [
        {
          user_id: fallbackUserId,
          email: fallbackEmail,
          name: fallbackName,
          role: "owner" as const,
          status: "active" as const,
          added_by: currentUser?.uid || adminCtx?.userId,
          added_by_email: currentUser?.email || adminCtx?.email,
          added_at: new Date()
        },
        ...activeCollaborators
      ];

  return recalculateProductAccess({
    ...product,
    owner_id: fallbackUserId,
    owner_email: fallbackEmail,
    owner_name: fallbackName,
    collaborators: normalizedCollaborators
  }) as Product;
}

export function recalculateProductAccess(product: Partial<Product>): any {
  const collaborators = ((product.collaborators as any[]) || [])
    .filter((c: any) => c.status !== "removed");

  const ownerCollaborators = collaborators.filter(c => c.role === "owner");
  const editorCollaborators = collaborators.filter(c =>
    ["owner", "editor"].includes(c.role || "")
  );
  const commenterCollaborators = collaborators.filter(c =>
    ["owner", "editor", "commenter"].includes(c.role || "")
  );
  const viewerCollaborators = collaborators.filter(c =>
    c.role === "viewer"
  );

  const primaryOwner = ownerCollaborators[0];
  const unique = (arr: any[]) => Array.from(new Set(arr.filter(Boolean)));

  return {
    ...product,

    owner_id: primaryOwner?.user_id || product.owner_id,
    owner_email: primaryOwner?.email || product.owner_email,
    owner_name: primaryOwner?.name || product.owner_name,

    collaborators,

    collaborator_ids: unique(collaborators.map(c => c.user_id)),
    collaborator_emails: unique(collaborators.map(c => c.email?.toLowerCase())),

    owner_ids: unique(ownerCollaborators.map(c => c.user_id)),
    editor_ids: unique(editorCollaborators.map(c => c.user_id)),
    commenter_ids: unique(commenterCollaborators.map(c => c.user_id)),
    viewer_ids: unique(viewerCollaborators.map(c => c.user_id))
  } as Partial<Product>;
}
