import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  resolveWorkspaceAccess,
  touchWorkspaceAccess
} from "../lib/workspaceAccess";
import { getProductPermission } from "../lib/productPermissions";

export function useWorkspaceAccess(productId: string | undefined) {
  const { user, profile, loading } = useAuth();

  const [loadingAccess, setLoadingAccess] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [workspaceAccess, setWorkspaceAccess] = useState<any | null>(null);
  const [permissions, setPermissions] = useState<any>(getProductPermission("viewer"));

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      if (loading) return;

      setLoadingAccess(true);
      setAccessError(null);

      try {
        if (!user?.uid || !productId) {
          if (!cancelled) {
            setWorkspaceAccess(null);
            setPermissions(getProductPermission("viewer"));
            setAccessError("Usuário ou produto não identificado.");
          }
          return;
        }

        console.log("[WorkspaceAccess] resolving", {
          uid: user.uid,
          email: user.email,
          profileId: profile?.id,
          productId
        });

        const result = await resolveWorkspaceAccess({
          uid: user.uid,
          productId,
          email: user.email
        });

        console.log("[WorkspaceAccess] result", result);

        if (cancelled) return;

        if (!result.hasAccess) {
          setWorkspaceAccess(result.access || null);
          setPermissions(result.permissions || getProductPermission("viewer"));
          setAccessError(result.reason || "Acesso negado.");
          return;
        }

        setWorkspaceAccess(result.access);
        setPermissions(result.permissions);

        await touchWorkspaceAccess({
          uid: user.uid,
          productId
        });
      } catch (error: any) {
        console.error("[WorkspaceAccess] error", error);

        if (!cancelled) {
          setWorkspaceAccess(null);
          setPermissions(getProductPermission("viewer"));
          setAccessError(error?.message || "Não foi possível validar seu acesso.");
        }
      } finally {
        if (!cancelled) {
          setLoadingAccess(false);
        }
      }
    }

    loadAccess();

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    user?.uid,
    user?.email,
    profile?.id,
    productId
  ]);

  return {
    loadingAccess,
    accessError,
    workspaceAccess,
    permissions,
    role: permissions?.role || "viewer"
  };
}
