import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, limit, where, updateDoc, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserProfile } from '../../lib/userService';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Plus, Mail, ShieldCheck, Crown, Search, RefreshCw, MoreVertical, X, User as UserIcon, Shield, Ban, RotateCcw, Copy, Loader2, Trash2 } from 'lucide-react';
import { SYSTEM_ROLE_LABELS } from '../../lib/systemPermissions';
import { cn } from '../../lib/utils';
import { formatUserDate } from '../../lib/dateUtils';
import InviteUserModal from '../../components/admin/users/InviteUserModal';
import AddUserModal from '../../components/admin/users/AddUserModal';
import { deleteSuspendedUser } from '../../lib/adminUserDeletion';
import { toast } from 'sonner';

function MetricCard({ label, value, description, icon: Icon }: { label: string; value: number; description: string; icon: any }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
          <p className="mt-3 text-4xl font-black text-slate-950 tracking-tight">{value}</p>
        </div>
        <div className="h-11 w-11 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
          <Icon className="h-5 w-5 text-indigo-500" />
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-500">{description}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const config: any = {
    owner: { label: "Owner da Instância", className: "bg-violet-50 text-violet-700 border-violet-100" },
    admin: { label: "Admin Operacional", className: "bg-blue-50 text-blue-700 border-blue-100" },
    user: { label: "Usuário", className: "bg-slate-100 text-slate-600 border-slate-200" }
  };
  const item = config[role] || config.user;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest", item.className)}>
      {item.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: any = {
    active: { label: "Ativo", className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
    invited: { label: "Convidado", className: "bg-amber-50 text-amber-700 border-amber-100" },
    suspended: { label: "Suspenso", className: "bg-rose-50 text-rose-700 border-rose-100" },
  };
  const item = config[status] || { label: "Ativo", className: "bg-emerald-50 text-emerald-700 border-emerald-100" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest", item.className)}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {item.label}
    </span>
  );
}

function SimpleUserActionModal({
  title,
  description,
  user,
  onClose,
  children
}: {
  title: string;
  description?: string;
  user: any;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <h2 className="text-2xl font-black text-slate-950">
              {title}
            </h2>

            {description && (
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-50 p-3 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">
              {user.display_name || user.email}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {user.email}
            </p>
            <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {user.system_role || "user"} · {user.status || "active"}
            </p>
          </div>

          {children}
        </div>

        <div className="flex justify-end border-t border-slate-100 p-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersAdminSection() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitesCount, setInvitesCount] = useState(0);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  
  const [openActionMenuUserId, setOpenActionMenuUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isChangeRoleOpen, setIsChangeRoleOpen] = useState(false);
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);
  const [isReactivateOpen, setIsReactivateOpen] = useState(false);
  const [deleteUserModalOpen, setDeleteUserModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);

  const [newRole, setNewRole] = useState<"owner" | "admin" | "user">("user");
  const [roleChangeReason, setRoleChangeReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [suspensionReason, setSuspensionReason] = useState("");

  const { user: firebaseUser, profile, adminCtx } = useAuth();

  const currentProfile = {
    uid: firebaseUser?.uid,
    id: firebaseUser?.uid,
    email: firebaseUser?.email,
    system_role:
      (profile as any)?.system_role ||
      (adminCtx?.isOwner ? "owner" : adminCtx?.isAdmin ? "admin" : "user"),
    isOwner: adminCtx?.isOwner || (profile as any)?.system_role === "owner",
    isAdmin:
      adminCtx?.isAdmin ||
      (profile as any)?.system_role === "admin" ||
      (profile as any)?.system_role === "owner"
  };

  const getActiveOwnersCount = (usersArr: any[]) => usersArr.filter((u) => (u.system_role || "user") === "owner" && (u.status || "active") === "active").length;
  const isSameUser = (targetUser: any) => {
    const currentId = currentProfile?.uid || currentProfile?.id;
    const targetId = targetUser?.uid || targetUser?.id;
    return Boolean(currentId && targetId && currentId === targetId);
  };
  const canChangeUserRole = (targetUser: any) => {
    if (!currentProfile || !targetUser || isSameUser(targetUser)) return false;
    return Boolean(currentProfile.system_role === 'owner' || currentProfile.isOwner);
  };
  const canSuspendUser = (targetUser: any) => {
    if (!currentProfile || !targetUser || isSameUser(targetUser)) return false;
    const targetRole = targetUser.system_role || "user";
    const currentRole = currentProfile.system_role || "user";
    if (targetRole === "owner" && getActiveOwnersCount(users) <= 1) return false;
    return Boolean(currentProfile.system_role === 'owner' || currentProfile.isOwner || (currentProfile.isAdmin && targetRole === 'user'));
  };
  const canReactivateUser = (targetUser: any) => {
    if (!currentProfile || !targetUser) return false;
    const targetRole = targetUser.system_role || "user";
    const currentRole = currentProfile.system_role || "user";
    return Boolean(currentProfile.system_role === 'owner' || currentProfile.isOwner || (currentProfile.isAdmin && targetRole === 'user'));
  };

  const getRoleLabel = (role: string) => ({ owner: "Owner da Instância", admin: "Admin Operacional", user: "Usuário" })[role] || "Usuário";
  const getStatusLabel = (status: string) => ({ active: "Ativo", invited: "Convidado", suspended: "Suspenso", disabled: "Desativado" })[status] || "Ativo";

  async function handleSuspendUser() {
    if (!selectedUser) return;
    setActionError(null);
    if (!canSuspendUser(selectedUser)) {
      setActionError("Você não tem permissão para suspender este usuário.");
      return;
    }
    if (!suspensionReason.trim()) {
      setActionError("Informe o motivo da suspensão.");
      return;
    }
    setActionLoading(true);
    const targetId = selectedUser.uid || selectedUser.id;
    try {
      await updateDoc(doc(db, "users", targetId), {
        status: "suspended",
        suspended_by: currentProfile?.uid || null,
        suspended_by_email: currentProfile?.email || null,
        suspended_at: serverTimestamp(),
        suspension_reason: suspensionReason.trim(),
        updated_at: serverTimestamp()
      });
      await addDoc(collection(db, "audit_logs"), {
        type: "user_suspended",
        category: "security",
        severity: "critical",
        actor_id: currentProfile?.uid || null,
        actor_email: currentProfile?.email || null,
        target_user_id: targetId,
        target_email: selectedUser.email || null,
        summary: `${selectedUser.email} foi suspenso.`,
        metadata: { reason: suspensionReason.trim(), previous_status: selectedUser.status || "active", new_status: "suspended" },
        created_at: serverTimestamp()
      });
      setIsSuspendOpen(false);
      setSelectedUser(null);
      setSuspensionReason("");
      await loadUsers();
    } catch (error: any) {
      setActionError(error?.message || "Não foi possível suspender o usuário.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivateUser() {
    if (!selectedUser) return;
    setActionError(null);
    if (!canReactivateUser(selectedUser)) {
      setActionError("Você não tem permissão para reativar este usuário.");
      return;
    }
    setActionLoading(true);
    const targetId = selectedUser.uid || selectedUser.id;
    try {
      await updateDoc(doc(db, "users", targetId), {
        status: "active",
        suspended_by: null,
        suspended_by_email: null,
        suspended_at: null,
        suspension_reason: null,
        updated_at: serverTimestamp()
      });
      await addDoc(collection(db, "audit_logs"), {
        type: "user_reactivated",
        category: "user_management",
        severity: "warning",
        actor_id: currentProfile?.uid || null,
        actor_email: currentProfile?.email || null,
        target_user_id: targetId,
        target_email: selectedUser.email || null,
        summary: `${selectedUser.email} foi reativado.`,
        metadata: { previous_status: selectedUser.status || "suspended", new_status: "active" },
        created_at: serverTimestamp()
      });
      setIsReactivateOpen(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (error: any) {
      setActionError(error?.message || "Não foi possível reativar o usuário.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteSuspendedUser() {
    if (!userToDelete) return;

    setDeletingUser(true);
    setDeleteUserError(null);

    try {
      const result = await deleteSuspendedUser({
        targetUser: userToDelete,
        currentUser: currentProfile
      });

      console.log("[UsersSection] user deleted", result);

      setDeleteUserModalOpen(false);
      setUserToDelete(null);
      setDeleteConfirmationText("");

      await loadUsers();

      toast.success("Usuário deletado e acessos removidos.");
    } catch (error: any) {
      console.error("[UsersSection] delete suspended user failed:", error);
      setDeleteUserError(error?.message || "Não foi possível deletar o usuário.");
    } finally {
      setDeletingUser(false);
    }
  }

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  async function handleChangeRole() {
    if (!selectedUser) return;
    setActionError(null);
    if (!canChangeUserRole(selectedUser)) {
      setActionError("Você não tem permissão para alterar o papel deste usuário.");
      return;
    }
    if (!roleChangeReason.trim()) {
      setActionError("Informe o motivo da alteração.");
      return;
    }
    const previousRole = selectedUser.system_role || "user";
    if (previousRole === "owner" && newRole !== "owner" && getActiveOwnersCount(users) <= 1) {
      setActionError("Não é possível remover o último Owner ativo da instância.");
      return;
    }
    const targetId = selectedUser.uid || selectedUser.id;
    if (!targetId) {
      setActionError("Não encontrei o ID do usuário selecionado.");
      return;
    }
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "users", targetId), {
        system_role: newRole,
        updated_at: serverTimestamp()
      });
      await addDoc(collection(db, "audit_logs"), {
        type: "user_role_changed",
        actor_id: currentProfile?.uid || null,
        actor_email: currentProfile?.email || null,
        target_user_id: targetId,
        target_email: selectedUser.email || null,
        summary: `${selectedUser.email} teve papel alterado de ${previousRole} para ${newRole}.`,
        metadata: { previous_role: previousRole, new_role: newRole, reason: roleChangeReason.trim() },
        created_at: serverTimestamp()
      });
      setIsChangeRoleOpen(false);
      setSelectedUser(null);
      setRoleChangeReason("");
      await loadUsers();
    } catch (error: any) {
      setActionError(error?.message || "Não foi possível alterar o papel.");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    function handleClickOutside() {
      setOpenActionMenuUserId(null);
    }

    if (openActionMenuUserId) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [openActionMenuUserId]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "users"), orderBy("created_at", "desc"), limit(100));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          uid: data.uid || d.id,
          email: data.email || "",
          display_name: data.display_name || data.email || "Usuário",
          photo_url: data.photo_url || null,
          system_role: data.system_role || "user",
          status: data.status || "active",
          created_at: data.created_at || null,
          updated_at: data.updated_at || null,
          last_login_at: data.last_login_at || null,
          ...data
        } as UserProfile;
      }));

      const iq = query(collection(db, "user_invites"), where("status", "==", "pending"));
      const iSnap = await getDocs(iq);
      setInvitesCount(iSnap.size);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
      const matchesSearch = u.display_name?.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || u.system_role === roleFilter;
      const matchesStatus = statusFilter === "all" || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-500 mb-2">Administração</p>
          <h1 className="text-4xl font-black text-slate-950 tracking-tight">Usuários</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">Gerencie usuários, papéis globais e status de acesso da instância.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setIsAddUserOpen(true)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-sm hover:bg-slate-50 transition-all">
                Adicionar usuário
            </button>
            <button onClick={() => setIsInviteOpen(true)} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-indigo-600 transition-all">
                <Plus className="w-4 h-4" /> Convidar usuário
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Ativos" value={users.filter(u => u.status === 'active').length} description="Usuários com acesso liberado" icon={Users} />
        <MetricCard label="Convites" value={invitesCount} description="Aguardando aceite" icon={Mail} />
        <MetricCard label="Admins" value={users.filter(u => u.system_role === 'admin').length} description="Operação da plataforma" icon={ShieldCheck} />
        <MetricCard label="Owners" value={users.filter(u => u.system_role === 'owner').length} description="Controle total da instância" icon={Crown} />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
            <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Buscar por nome ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
                <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                    <option value="all">Todos os papéis</option>
                    <option value="owner">Owners</option>
                    <option value="admin">Admins</option>
                    <option value="user">Usuários</option>
                </select>
                <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="all">Todos os status</option>
                    <option value="active">Ativos</option>
                    <option value="invited">Convidados</option>
                    <option value="suspended">Suspensos</option>
                </select>
                <button onClick={loadUsers} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all"><RefreshCw className="w-4 h-4" /></button>
            </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-visible">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Usuário</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Papel Global</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Último Acesso</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-bold">Carregando usuários...</td></tr> : filteredUsers.map(u => (
              <tr key={u.id} className="group hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 flex items-center gap-3">
                    <img src={u.photo_url || ''} className="h-10 w-10 rounded-2xl object-cover border border-slate-200 bg-slate-100" />
                    <div>
                        <p className="text-sm font-black text-slate-950">{u.display_name}</p>
                        <p className="text-xs font-semibold text-slate-400">{u.email}</p>
                    </div>
                </td>
                <td className="px-6 py-4"><RoleBadge role={u.system_role} /></td>
                <td className="px-6 py-4"><StatusBadge status={u.status} /></td>
                <td className="px-6 py-4 text-xs font-bold text-slate-500">{formatUserDate(u.last_login_at)}</td>
                <td className="relative px-6 py-4 text-right">
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            setOpenActionMenuUserId(openActionMenuUserId === u.id ? null : u.id);
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {openActionMenuUserId === u.id && (
                        <div onClick={(e) => e.stopPropagation()} className="absolute right-5 top-14 z-[9999] w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                            <button type="button" onClick={() => { setSelectedUser(u); setIsDetailsOpen(true); setOpenActionMenuUserId(null); }} className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"><UserIcon className="w-4 h-4 text-slate-400" />Ver detalhes</button>
                            <button 
                                type="button" 
                                disabled={!canChangeUserRole(u)}
                                onClick={() => { 
                                    if (!canChangeUserRole(u)) return;
                                    setSelectedUser(u); 
                                    setNewRole((u.system_role || "user") as "owner" | "admin" | "user");
                                    setRoleChangeReason("");
                                    setActionError(null);
                                    setIsChangeRoleOpen(true); 
                                    setOpenActionMenuUserId(null); 
                                }} 
                                className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                                    <Shield className="w-4 h-4 text-slate-400" />Alterar papel
                            </button>
                            {u.status === "suspended" ? (
                                <>
                                  <button type="button" onClick={() => { setSelectedUser(u); setIsReactivateOpen(true); setOpenActionMenuUserId(null); }} className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-emerald-700 hover:bg-emerald-50"><RotateCcw className="w-4 h-4" />Reativar</button>
                                  {!isSameUser(u) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setUserToDelete(u);
                                        setDeleteConfirmationText("");
                                        setDeleteUserError(null);
                                        setDeleteUserModalOpen(true);
                                        setOpenActionMenuUserId(null);
                                      }}
                                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-rose-700 hover:bg-rose-50"
                                    >
                                      <Trash2 className="w-4 h-4" />Deletar usuário
                                    </button>
                                  )}
                                </>
                            ) : (
                                <button type="button" onClick={() => { setSelectedUser(u); setIsSuspendOpen(true); setOpenActionMenuUserId(null); }} className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-rose-700 hover:bg-rose-50"><Ban className="w-4 h-4" />Suspender</button>
                            )}
                            <button type="button" onClick={async () => { await navigator.clipboard.writeText(u.uid || u.id); setOpenActionMenuUserId(null); }} className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"><Copy className="w-4 h-4 text-slate-400" />Copiar ID</button>
                        </div>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isInviteOpen && <InviteUserModal onClose={() => setIsInviteOpen(false)} onSuccess={loadUsers} />}
      {isAddUserOpen && <AddUserModal onClose={() => setIsAddUserOpen(false)} />}

      {isDetailsOpen && selectedUser && (
        <SimpleUserActionModal
            title="Detalhes do usuário"
            user={selectedUser}
            onClose={() => { setIsDetailsOpen(false); setSelectedUser(null); }}
        />
      )}
      {isChangeRoleOpen && selectedUser && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Alterar papel</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Mude o papel global deste usuário na instância.</p>
              </div>
              <button type="button" onClick={() => { setIsChangeRoleOpen(false); setSelectedUser(null); setActionError(null); }} className="rounded-2xl bg-slate-50 p-3 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 p-6">
              {actionError && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{actionError}</div>}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-950">{selectedUser.display_name || selectedUser.email}</p>
                <p className="text-xs font-semibold text-slate-500">{selectedUser.email}</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Papel atual: {getRoleLabel(selectedUser.system_role || "user")}</p>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Novo papel</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="user">Usuário</option>
                  <option value="admin">Admin Operacional</option>
                  <option value="owner">Owner da Instância</option>
                </select>
              </div>
              {newRole === "owner" && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">Atenção: Owner da Instância tem acesso total a integrações, configurações críticas, usuários e infraestrutura.</div>}
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Motivo da alteração</label>
                <textarea value={roleChangeReason} onChange={(e) => setRoleChangeReason(e.target.value)} placeholder="Explique por que este papel está sendo alterado." className="mt-2 min-h-[110px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 p-6">
              <button type="button" onClick={() => { setIsChangeRoleOpen(false); setSelectedUser(null); setActionError(null); }} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button type="button" disabled={actionLoading} onClick={handleChangeRole} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50">
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar alteração
              </button>
            </div>
          </div>
        </div>
      )}
      {isSuspendOpen && selectedUser && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Suspender usuário</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Este usuário não poderá mais acessar a plataforma.</p>
              </div>
              <button type="button" onClick={() => { setIsSuspendOpen(false); setSelectedUser(null); setActionError(null); }} className="rounded-2xl bg-slate-50 p-3 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 p-6">
              {actionError && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{actionError}</div>}
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Motivo da suspensão</label>
                <textarea value={suspensionReason} onChange={(e) => setSuspensionReason(e.target.value)} placeholder="Explique por que este usuário está sendo suspenso." className="mt-2 min-h-[110px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 p-6">
              <button type="button" onClick={() => { setIsSuspendOpen(false); setSelectedUser(null); setActionError(null); }} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button type="button" disabled={actionLoading} onClick={handleSuspendUser} className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-black text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar suspensão
              </button>
            </div>
          </div>
        </div>
      )}
      {isReactivateOpen && selectedUser && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Reativar usuário</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Este usuário voltará a ter acesso à plataforma.</p>
              </div>
              <button type="button" onClick={() => { setIsReactivateOpen(false); setSelectedUser(null); setActionError(null); }} className="rounded-2xl bg-slate-50 p-3 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 p-6">
              {actionError && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{actionError}</div>}
              <p className="font-semibold text-slate-700">Tem certeza que deseja reativar o usuário <span className="font-black">{selectedUser.display_name}</span>?</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 p-6">
              <button type="button" onClick={() => { setIsReactivateOpen(false); setSelectedUser(null); setActionError(null); }} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button type="button" disabled={actionLoading} onClick={handleReactivateUser} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50">
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar reativação
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteUserModalOpen && userToDelete && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">
                  Deletar usuário suspenso?
                </h2>

                <p className="mt-3 text-sm font-semibold text-slate-500">
                  Esta ação vai remover o usuário da instância e eliminar todos os acessos dele a produtos.
                  O histórico criado por ele será preservado para auditoria.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeleteUserModalOpen(false);
                  setUserToDelete(null);
                }}
                className="rounded-2xl bg-slate-50 p-3 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-center gap-3">
                <img src={userToDelete.photo_url || ''} className="h-10 w-10 rounded-xl object-cover border border-rose-200 bg-white" />
                <div>
                  <p className="text-sm font-black text-rose-900">
                    {userToDelete.display_name || userToDelete.name || "Usuário sem nome"}
                  </p>
                  <p className="text-xs font-semibold text-rose-700">
                    {userToDelete.email}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-4">
                 <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">
                   Status: {userToDelete.status}
                 </p>
                 <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">
                   ID: {userToDelete.uid || userToDelete.id}
                 </p>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400">
                Digite DELETAR para confirmar
              </label>

              <input
                value={deleteConfirmationText}
                onChange={(event) => setDeleteConfirmationText(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500"
                placeholder="DELETAR"
              />
            </div>

            {deleteUserError && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                {deleteUserError}
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteUserModalOpen(false);
                  setUserToDelete(null);
                }}
                className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 transition-colors"
                disabled={deletingUser}
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={deleteConfirmationText !== "DELETAR" || deletingUser}
                onClick={handleDeleteSuspendedUser}
                className="rounded-2xl bg-rose-600 px-6 py-3 text-sm font-black text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40 transition-all flex items-center gap-2"
              >
                {deletingUser && <Loader2 className="w-4 h-4 animate-spin" />}
                {deletingUser ? "Deletando..." : "Deletar usuário"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

