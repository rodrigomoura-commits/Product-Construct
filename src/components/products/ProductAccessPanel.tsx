import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Shield, Mail, Trash2, 
  Crown, Edit3, MessageSquare, Eye, 
  CheckCircle2, Clock, MoreVertical, 
  ChevronRight, AlertCircle, Loader2, Copy, RefreshCw 
} from 'lucide-react';
import { 
  doc, updateDoc, serverTimestamp, 
  collection, query, orderBy, getDocs, addDoc,
  setDoc, arrayUnion, writeBatch
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product, AdminCtx, UserRole } from '../../types';
import { recalculateProductAccess } from '../../lib/productAccess';
import { formatShortDate, formatSafeDate } from '../../lib/dateUtils';
import { cleanFirestoreData } from '../../lib/firestoreSanitizer';
import { upsertUserProductAccess, removeUserProductAccess } from '../../lib/userProductAccess';
import ProductInviteModal from './ProductInviteModal';
import toast from 'react-hot-toast';

type Props = {
  product: Product;
  user: any;
  adminCtx?: AdminCtx;
  onProductUpdated?: () => void;
};

export default function ProductAccessPanel({ product, user, adminCtx, onProductUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invites, setInvites] = useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  const [collaborators, setCollaborators] = useState<any[]>([]);

  const isSystemOwnerOrAdmin = Boolean(
    adminCtx?.isOwner ||
    adminCtx?.isAdmin ||
    adminCtx?.roles?.includes("owner") ||
    adminCtx?.roles?.includes("admin")
  );
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<'editor' | 'commenter' | 'viewer'>('editor');
  const [accessError, setAccessError] = useState<string | null>(null);
  const [savingAccess, setSavingAccess] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleSyncAccess() {
    if (!product?.id || syncing) return;
    setSyncing(true);
    setAccessError(null);

    try {
      const collaboratorsSnap = await getDocs(
        collection(db, "products", product.id, "collaborators")
      );

      const batch = writeBatch(db);
      let count = 0;

      collaboratorsSnap.docs.forEach((docSnap) => {
        const collaborator = docSnap.data();
        
        // Find user by email to get correct UID if missing or docId is wrong
        const matchedUser = allUsers.find((u) => {
          const sameEmail =
            String(u.email || "").toLowerCase() === String(collaborator.email || "").toLowerCase();

          const sameUid =
            u.uid &&
            (u.uid === collaborator.uid || u.uid === collaborator.user_id || u.uid === docSnap.id);

          return sameUid || sameEmail;
        });

        const uid = collaborator.uid || matchedUser?.uid || null;
        const status = String(collaborator.status || "active").toLowerCase();
        const role = String(collaborator.role || "viewer").toLowerCase();

        if (!uid || uid.includes("@")) return;
        if (status !== "active") return;

        batch.set(
          doc(db, "user_product_access", uid, "products", product.id),
          {
            product_id: product.id,
            product_name: product.name || (product as any).title || "Produto sem nome",
            product_description: product.description || (product as any).summary || "",
            product_status: product.status || "active",
            current_stage: product.current_stage || (product as any).stage || "sense",
            progress:
              typeof product.progress === "number"
                ? product.progress
                : typeof (product as any).overall_progress === "number"
                  ? (product as any).overall_progress
                  : 0,
            role,
            status: "active",
            updated_at: serverTimestamp()
          },
          { merge: true }
        );
        count++;
      });

      await batch.commit();
      toast.success(`${count} permissões sincronizadas.`);
      onProductUpdated?.();
    } catch (e: any) {
      console.error("[ProductAccess] Sync error", e);
      setAccessError("Erro ao sincronizar: " + (e.message || "Erro desconhecido."));
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadProductCollaborators();
    loadProductInvites();
    loadAllInstanceUsers();
  }, [product?.id]);

  function normalizeEmail(email: any) {
    return String(email || "").trim().toLowerCase();
  }

  function normalizeRole(role: any) {
    return String(role || "").trim().toLowerCase();
  }

  function isActiveCollaborator(collab: any) {
    return (collab.status || "active") === "active";
  }

  function isOwnerCollaborator(collab: any) {
    return normalizeRole(collab.role) === "owner";
  }

  function sanitizeFirestoreId(value: string) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[.#$/[\]]/g, "_");
  }

  function getUserAccessId(user: any) {
    return user?.uid || user?.id || user?.doc_id || null;
  }

  function getCollaboratorIdFromUserOrEmail(user: any, email: string) {
    const accessId = getUserAccessId(user);
    if (accessId) {
      return sanitizeFirestoreId(accessId);
    }
    return sanitizeFirestoreId(email);
  }
  
  async function loadAllInstanceUsers() {
    setUsersLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "users"),
          orderBy("email", "asc")
        )
      );
      const data = snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          doc_id: docSnap.id,
          uid: data.uid || null,
          access_id: data.uid || docSnap.id,
          email: String(data.email || "").toLowerCase(),
          display_name: data.display_name || data.name || data.email || "Sem nome",
          photo_url: data.photo_url || data.avatar_url || null,
          system_role: data.system_role || "user",
          status: data.status || "active",
          ...data
        };
      });
      setAllUsers(data);
    } catch (error) {
      console.error("[ProductAccess] Error loading users:", error);
    } finally {
      setUsersLoading(false);
    }
  }

  const activeCollaboratorIds = new Set(
    (collaborators || [])
      .map((collab: any) => collab.user_id || collab.uid || collab.id || collab.doc_id)
      .filter(Boolean)
  );

  const activeCollaboratorEmails = new Set(
    (collaborators || []).map((collab: any) => String(collab.email || "").toLowerCase())
  );

  const availableUsers = allUsers.filter((user) => {
    const status = user.status || "active";
    if (status !== "active") return false;

    const userAccessId = getUserAccessId(user);
    const email = String(user.email || "").toLowerCase();

    const alreadyCollaborator =
      activeCollaboratorIds.has(userAccessId) ||
      activeCollaboratorEmails.has(email);

    if (alreadyCollaborator) return false;

    const search = userSearch.trim().toLowerCase();
    if (!search) return true;

    return (
      String(user.display_name || "").toLowerCase().includes(search) ||
      String(user.email || "").toLowerCase().includes(search)
    );
  });

  async function loadProductCollaborators() {
    if (!product?.id) {
      setCollaborators([]);
      return;
    }

    try {
      const snap = await getDocs(
        collection(db, "products", product.id, "collaborators")
      );

      const rawCollaborators = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      console.log("[ProductAccess] loaded collaborators raw", rawCollaborators);

      const enriched = rawCollaborators
        .filter((collab: any) => (collab.status || "active") === "active")
        .map((collab: any) => {
          const collabId =
            collab.user_id ||
            collab.uid ||
            collab.source_user_doc_id ||
            collab.id;

          const collabEmail = normalizeEmail(collab.email);

          const matchedUser = allUsers.find((user) => {
            const userAccessId = getUserAccessId(user);
            const userEmail = normalizeEmail(user.email);

            return (
              userAccessId === collabId ||
              user.id === collab.source_user_doc_id ||
              userEmail === collabEmail
            );
          });

          return {
            ...collab,
            display_name:
              collab.display_name ||
              matchedUser?.display_name ||
              matchedUser?.email ||
              collab.email ||
              "Sem nome",
            email:
              collab.email ||
              matchedUser?.email ||
              "",
            photo_url:
              collab.photo_url ||
              matchedUser?.photo_url ||
              null
          };
        });

      console.log("[ProductAccess] loaded collaborators enriched", enriched);

      setCollaborators(enriched);
    } catch (error: any) {
      console.error("[ProductAccess] Error loading collaborators:", error);
      setAccessError(error?.message || "Não consegui carregar colaboradores.");
    }
  }

  async function loadProductInvites() {
    setLoadingInvites(true);
    try {
      const q = query(collection(db, `products/${product.id}/invites`), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInvites(false);
    }
  }

  async function handleRevokeInvite(invite: any) {
    if (!window.confirm(`Deseja revogar o convite para ${invite.email}?`)) return;

    setAccessError(null);
    setSavingAccess(true);

    try {
      await updateDoc(
        doc(db, "products", product.id, "invites", invite.id),
        cleanFirestoreData({
          status: "revoked",
          revoked_at: serverTimestamp(),
          revoked_by: user?.uid || null,
          revoked_by_email: user?.email || null,
          updated_at: serverTimestamp()
        })
      );
      loadProductInvites();
    } catch (e: any) {
      console.error("[ProductAccess] Error revoking invite:", e);
      setAccessError(e?.message || "Não foi possível excluir o convite.");
    } finally {
      setSavingAccess(false);
    }
  }

  const saveProductAccess = async (updatedProduct: Partial<Product>, eventSummary?: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "products", product.id), {
        owner_id: updatedProduct.owner_id,
        owner_email: updatedProduct.owner_email,
        owner_name: updatedProduct.owner_name,
        collaborators: updatedProduct.collaborators,
        collaborator_ids: updatedProduct.collaborator_ids,
        collaborator_emails: updatedProduct.collaborator_emails,
        owner_ids: updatedProduct.owner_ids,
        editor_ids: updatedProduct.editor_ids,
        commenter_ids: updatedProduct.commenter_ids,
        viewer_ids: updatedProduct.viewer_ids,
        updated_at: serverTimestamp()
      });

      await addDoc(collection(db, `products/${product.id}/history_events`), {
        type: "product_access_updated",
        title: "Acessos atualizados",
        summary: eventSummary || "As permissões do produto foram atualizadas.",
        actor_id: user.uid,
        actor_email: user.email,
        created_at: serverTimestamp()
      });

      toast.success("Acessos atualizados.");
      onProductUpdated?.();
    } catch (e: any) {
      console.error(e);
      setAccessError(e?.message || "Erro ao salvar alterações.");
      toast.error("Erro ao salvar alterações.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (collaborator: any, newRole: string) => {
    const activeCollaborators = [...collaborators];
    const owners = activeCollaborators.filter((c: any) => c.status !== "removed" && c.role === "owner");

    if (collaborator.role === "owner" && owners.length === 1 && newRole !== "owner") {
      toast.error("O produto precisa ter pelo menos um owner.");
      return;
    }

    try {
      const collaboratorDocId = collaborator.id || getCollaboratorIdFromUserOrEmail(collaborator, collaborator.email);
      
      await updateDoc(
        doc(db, "products", product.id, "collaborators", collaboratorDocId),
        cleanFirestoreData({ role: newRole, updated_at: serverTimestamp() })
      );

      const collabUid = collaborator.uid || collaborator.user_id;
      if (collabUid) {
        try {
          await upsertUserProductAccess({
            uid: collabUid,
            product: {
              id: product.id,
              name: product.name || (product as any).title,
              description: product.description || (product as any).summary,
              status: product.status || "active",
              current_stage: product.current_stage || (product as any).stage || "sense",
              progress: product.progress || (product as any).overall_progress || 0
            },
            role: newRole as "owner" | "editor" | "commenter" | "viewer"
          });
        } catch (e) {
          console.error("Failed to update index", e);
        }
      }

      // Re-fetch or manually update product arrays
      // Note: we can defer updating product aggregate arrays to cloud function or rely on manual sync
      await loadProductCollaborators();

      await addDoc(collection(db, "audit_logs"), cleanFirestoreData({
        type: "product_access_changed",
        category: "product",
        actor_id: user?.uid || null,
        actor_email: user?.email || null,
        product_id: product.id,
        summary: `O papel de ${collaborator.email} foi alterado para ${newRole}.`,
        created_at: serverTimestamp()
      }));

      toast.success("O papel foi alterado.");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao alterar papel.");
    }
  };

  const handleRemoveCollaborator = async (collaborator: any) => {
    if (collaborator.role === "owner") {
      const owners = collaborators.filter((c: any) => c.status !== "removed" && c.role === "owner");
      if (owners.length === 1) {
        toast.error("Não é possível remover o único owner.");
        return;
      }
    }

    if (!window.confirm(`Remover acesso de ${collaborator.email}?`)) return;

    try {
      const collaboratorDocId = collaborator.id || getCollaboratorIdFromUserOrEmail(collaborator, collaborator.email);
      
      await updateDoc(
        doc(db, "products", product.id, "collaborators", collaboratorDocId),
        cleanFirestoreData({ status: "removed", removed_at: serverTimestamp() })
      );

      const collabUid = collaborator.uid || collaborator.user_id;
      if (collabUid) {
         try {
           await removeUserProductAccess(collabUid, product.id);
         } catch (e) {
           console.error("Failed to remove from index", e);
         }
      }

      await loadProductCollaborators();

      await addDoc(collection(db, "audit_logs"), cleanFirestoreData({
        type: "product_access_removed",
        category: "product",
        actor_id: user?.uid || null,
        actor_email: user?.email || null,
        product_id: product.id,
        summary: `${collaborator.email} foi removido dos colaboradores.`,
        created_at: serverTimestamp()
      }));

      toast.success("Acesso removido.");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao remover acesso.");
    }
  };

  async function handleAddCollaborator() {
    console.log("[ProductAccess] handleAddCollaborator:start", {
      product,
      productId: product?.id,
      selectedUserId,
      selectedRole,
      manualEmail,
      allUsersCount: allUsers?.length,
      collaboratorsCount: collaborators?.length
    });

    setAccessError(null);

    if (!product?.id) {
      console.error("[ProductAccess] Missing product.id", product);
      setAccessError("Produto sem ID. Não foi possível salvar colaborador.");
      return;
    }

    const selectedUser = selectedUserId
      ? allUsers.find((user) => user.id === selectedUserId)
      : null;

    console.log("[ProductAccess] selectedUser", selectedUser);

    const collaboratorEmail = normalizeEmail(
      selectedUser?.email || manualEmail
    );

    if (!selectedUserId) {
      setAccessError("Selecione um usuário existente. Para pessoas fora do sistema, use Convidar via e-mail.");
      return;
    }

    if (!collaboratorEmail || !collaboratorEmail.includes("@")) {
      setAccessError("Selecione um usuário ou informe um e-mail válido.");
      return;
    }

    const collaboratorUserId = selectedUser?.uid || null;

    if (!collaboratorUserId) {
      setAccessError("Este usuário ainda não ativou a conta com login. Use Convidar via e-mail.");
      return;
    }

    const collaboratorDocId = getCollaboratorIdFromUserOrEmail(
      selectedUser,
      collaboratorEmail
    );

    const collaboratorName =
      selectedUser?.display_name ||
      selectedUser?.name ||
      collaboratorEmail;

    const role = selectedRole || "editor";

    console.log("[ProductAccess] computed collaborator", {
      collaboratorDocId,
      collaboratorUserId,
      collaboratorEmail,
      collaboratorName,
      role
    });

    setSavingAccess(true);

    try {
      const collaboratorPayload = cleanFirestoreData({
        id: collaboratorDocId,
        user_id: collaboratorUserId,
        uid: selectedUser?.uid || null,
        source_user_doc_id: selectedUser?.id || null,
        email: collaboratorEmail,
        display_name: collaboratorName,
        photo_url: selectedUser?.photo_url || null,
        role,
        status: "active",
        added_at: serverTimestamp(),
        added_by: user?.uid || null,
        added_by_email: user?.email || null
      });

      console.log("[ProductAccess] saving collaborator payload", collaboratorPayload);

      await setDoc(
        doc(db, "products", product.id, "collaborators", collaboratorDocId),
        collaboratorPayload,
        { merge: true }
      );

      console.log("[ProductAccess] collaborator saved");

      const productPatch: any = {
        collaborator_emails: arrayUnion(collaboratorEmail),
        updated_at: serverTimestamp()
      };

      if (collaboratorUserId) {
        productPatch.collaborator_ids = arrayUnion(collaboratorUserId);

        if ((role as string) === "owner") {
          productPatch.owner_ids = arrayUnion(collaboratorUserId);
        }

        if (role === "editor") {
          productPatch.editor_ids = arrayUnion(collaboratorUserId);
        }

        if (role === "commenter") {
          productPatch.commenter_ids = arrayUnion(collaboratorUserId);
        }

        if (role === "viewer") {
          productPatch.viewer_ids = arrayUnion(collaboratorUserId);
        }
      }

      console.log("[ProductAccess] updating product patch", productPatch);

      try {
        await updateDoc(
          doc(db, "products", product.id),
          cleanFirestoreData(productPatch)
        );
        console.log("[ProductAccess] product patch saved");
      } catch (productPatchError) {
        console.warn("[ProductAccess] Product aggregate patch failed, but collaborator was saved:", productPatchError);
      }

      try {
        await addDoc(collection(db, "audit_logs"), cleanFirestoreData({
          type: "product_access_changed",
          category: "product",
          severity: "warning",
          actor_id: user?.uid || null,
          actor_email: user?.email || null,
          product_id: product.id,
          product_name: product.name || (product as any).title || null,
          target_user_id: collaboratorUserId,
          target_email: collaboratorEmail,
          summary: `${collaboratorEmail} foi adicionado ao produto ${product.name || (product as any).title || product.id} como ${role}.`,
          metadata: {
            role,
            source: selectedUser ? "existing_user" : "manual_email",
            source_user_doc_id: selectedUser?.id || null
          },
          created_at: serverTimestamp()
        }));
        console.log("[ProductAccess] audit log saved");
      } catch (auditError) {
        console.warn("[ProductAccess] Audit log failed but collaborator was saved:", auditError);
      }

      if (collaboratorUserId) {
        try {
          await upsertUserProductAccess({
            uid: collaboratorUserId,
            product: {
              id: product.id,
              name: product.name || (product as any).title,
              description: product.description || (product as any).summary,
              status: product.status || "active",
              current_stage: product.current_stage || (product as any).stage || "sense",
              progress: product.progress || (product as any).overall_progress || 0
            },
            role: role as "owner" | "editor" | "commenter" | "viewer"
          });
          console.log("[ProductAccess] created user_product_access", {
            uid: collaboratorUserId,
            productId: product.id,
            role
          });
        } catch (indexError) {
          console.error("[ProductAccess] Error setting user index", indexError);
        }
      }

      setSelectedUserId("");
      setManualEmail("");
      setUserSearch("");
      setSelectedRole("editor");

      await loadProductCollaborators();
      loadProductInvites();
      loadAllInstanceUsers();

      console.log("[ProductAccess] reload complete");
    } catch (error: any) {
      console.error("[ProductAccess] Error adding collaborator:", error);
      setAccessError(error?.message || "Erro ao salvar alterações.");
    } finally {
      setSavingAccess(false);
    }
  }

  const activeCollaborators = (collaborators || []).filter(isActiveCollaborator);
  const ownersCount = activeCollaborators.filter(isOwnerCollaborator).length;
  const activeCollaboratorsCount = activeCollaborators.length;

  const pendingInvitesCount = (invites || []).filter((invite) => {
    return (invite.status || "pending") === "pending";
  }).length;

  const fallbackOwnersCount =
    ownersCount > 0
      ? ownersCount
      : Array.isArray(product?.owner_ids)
        ? product.owner_ids.length
        : product?.owner_id
          ? 1
          : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto p-8 space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">Pessoas e acessos</h1>
            <p className="text-slate-500 font-medium italic">Gerencie quem pode visualizar, editar ou colaborar neste produto.</p>
          </div>
          <div className="flex gap-4">
            {(adminCtx?.isAdmin || adminCtx?.isOwner) && (
              <button 
                onClick={handleSyncAccess}
                disabled={syncing}
                className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
              >
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Sincronizar Permissões
              </button>
            )}
            <button 
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
            >
              <UserPlus className="w-4 h-4" />
              Convidar via E-mail
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Crown className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Proprietário</span>
            </div>
            <p className="font-black text-slate-900 truncate">
              {fallbackOwnersCount > 0 ? `${fallbackOwnersCount} proprietário${fallbackOwnersCount > 1 ? "s" : ""}` : "Nenhum proprietário"}
            </p>
          </div>
          <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ativos</span>
            </div>
            <p className="font-black text-slate-900">{activeCollaboratorsCount} pessoas</p>
          </div>
          <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pendentes</span>
            </div>
            <p className="font-black text-slate-900">{pendingInvitesCount} convites</p>
          </div>
        </div>

        {accessError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {accessError}
          </div>
        )}

        {/* Add Collaborator UI */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-black text-slate-900">Adicionar usuário existente</h2>
          <p className="text-[10px] font-black uppercase text-slate-500 mb-4">Use esta opção para pessoas que já têm cadastro no sistema.</p>
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <input 
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setManualEmail(e.target.value);
                }}
                placeholder="Buscar por nome ou e-mail..."
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-1 focus:ring-slate-900 outline-none"
              />
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-1 focus:ring-slate-900 outline-none"
              >
                <option value="">
                  {usersLoading ? "Carregando..." : availableUsers.length ? "Selecione um usuário..." : "Nenhum usuário ativo disponível."}
                </option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as any)}
              className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-1 focus:ring-slate-900 outline-none"
            >
              <option value="editor">Editor</option>
              <option value="commenter">Comentador</option>
              <option value="viewer">Visualizador</option>
            </select>
            <button 
              onClick={handleAddCollaborator}
              disabled={savingAccess || !selectedUserId}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-800 disabled:opacity-50"
            >
              {savingAccess ? <Loader2 className="w-5 h-5 animate-spin" /> : "Adicionar"}
            </button>
          </div>
        </div>

        {/* Collaborators List */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-slate-900 px-2 flex items-center gap-3">
            Colaboradores Ativos
            {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          </h2>
          
          <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Nome / E-mail</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Papel</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Desde</th>
                  <th className="px-8 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {collaborators?.map(collab => {
                  const matchedUser = allUsers.find(u => (u.uid || u.id) === (collab.user_id || collab.uid));
                  const name = collab.name || matchedUser?.display_name || 'Sem nome';
                  const email = collab.email || matchedUser?.email || '';
                  const photo = collab.photo_url || matchedUser?.photo_url;

                  return (
                    <tr key={collab.user_id || collab.email} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs shadow-sm overflow-hidden">
                            {photo ? <img src={photo} alt={name} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900 text-sm tracking-tight">{name}</span>
                            <span className="text-slate-500 text-xs font-medium">{email}</span>
                          </div>
                          {collab.role === 'owner' && (
                            <div className="p-1 px-2 bg-amber-50 text-amber-600 rounded-lg text-[8px] font-black uppercase tracking-widest border border-amber-100">
                              Owner
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <select 
                          value={collab.role}
                          onChange={(e) => handleChangeRole(collab, e.target.value)}
                          disabled={loading}
                          className="bg-slate-50 border-none rounded-lg text-[10px] font-black uppercase tracking-widest py-1.5 px-3 appearance-none hover:bg-slate-100 transition-all cursor-pointer outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-50"
                        >
                          <option value="owner">Owner</option>
                          <option value="editor">Editor</option>
                          <option value="commenter">Comentador</option>
                          <option value="viewer">Visualizador</option>
                        </select>
                      </td>
                      <td className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                        {formatShortDate(collab.added_at)}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => handleRemoveCollaborator(collab)}
                          disabled={loading}
                          className="p-2.5 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-50"
                          title="Remover acesso"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!collaborators?.length && (
                  <tr>
                    <td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-medium italic">
                      Ainda não há colaboradores neste produto.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Invites */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-slate-900 px-2 flex items-center justify-between">
            Convites Pendentes
            {loadingInvites && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invites.filter(i => i.status === 'pending').map(invite => (
                  <div key={invite.id} className="p-6 bg-white border border-slate-100 rounded-[2rem] flex flex-col gap-4 shadow-sm hover:border-slate-200 transition-all group">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 truncate max-w-[180px]">{invite.email}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{invite.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                     <button className="p-2 text-slate-400 hover:text-slate-900 transition-all" title="Copiar link" onClick={() => {
                       const link = `${window.location.origin}/invites/product/${invite.token}`;
                       navigator.clipboard.writeText(link);
                       toast.success("Link copiado!");
                     }}>
                        <Copy className="w-4 h-4" />
                     </button>
                     <button
                        type="button"
                        onClick={() => handleRevokeInvite(invite)}
                        className="p-2 text-slate-400 hover:text-rose-600 transition-all"
                        title="Excluir convite"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Enviado em {formatShortDate(invite.created_at)}
                  </span>
                  <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[8px] font-black uppercase tracking-widest">Pendente</span>
                </div>
              </div>
            ))}
            {invites.filter(i => i.status === 'pending').length === 0 && (
              <div className="col-span-full p-12 bg-white border border-slate-100 border-dashed rounded-[2rem] text-center text-slate-400 font-medium italic">
                Nenhum convite pendente.
              </div>
            )}
          </div>
        </div>

      </div>

      {inviteOpen && (
        <ProductInviteModal 
          product={product}
          user={user}
          adminCtx={adminCtx}
          onClose={() => setInviteOpen(false)}
          onInviteSent={() => {
            setInviteOpen(false);
            onProductUpdated?.();
            loadProductInvites();
          }}
        />
      )}
    </div>
  );
}
