import React, { useState, useEffect } from 'react';
import { 
  X, Save, Users, Mail, Shield, Trash2, UserPlus, 
  Clock, ArrowRight, Settings, Info, History, 
  CheckCircle2, AlertCircle, Loader2, Link as LinkIcon,
  Search, User, AlertTriangle, Plus
} from 'lucide-react';
import { 
  doc, updateDoc, serverTimestamp, collection, 
  query, orderBy, getDocs, Timestamp, writeBatch, addDoc
} from 'firebase/firestore';
import { db, cleanFirestoreData } from '../../../lib/firebase';
import { Product, ProductInvite, ProductHistoryEvent, UserRole, Profile } from '../../../types';
import { formatDate } from '../../../lib/utils';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { recalculateProductAccess } from '../../../lib/productAccess';

interface Props {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProductAdminEditModal({ product, onClose, onSaved }: Props) {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'collaborators' | 'invites' | 'history'>('general');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ProductHistoryEvent[]>([]);
  const [invites, setInvites] = useState<ProductInvite[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isNormalized, setIsNormalized] = useState(false);
  
  // Local Draft State
  const [draft, setDraft] = useState<Product>(() => {
    // Normalization logic
    const owners = product.collaborators?.filter(c => c.role === 'owner') || [];
    const ownerId = product.owner_id || product.created_by || owners[0]?.user_id || '';
    const ownerEmail = product.owner_email || product.created_by_email || owners[0]?.email || '';
    const ownerName = product.owner_name || product.created_by_name || owners[0]?.name || ownerEmail;

    let collaborators = [...(product.collaborators || [])];
    const hasOwnerInCollabs = collaborators.some(c => c.user_id === ownerId || c.email === ownerEmail);

    if (!hasOwnerInCollabs && (ownerId || ownerEmail)) {
      collaborators.unshift({
        user_id: ownerId,
        email: ownerEmail,
        name: ownerName,
        role: "owner",
        status: "active",
        added_by: 'system_normalization',
        added_at: Timestamp.now()
      });
    }

    const normalized = recalculateProductAccess({
      ...product,
      owner_id: ownerId,
      owner_email: ownerEmail,
      owner_name: ownerName,
      collaborators
    }) as Product;

    return normalized;
  });

  // Check if normalization was meaningful
  useEffect(() => {
    const hasOldFields = !product.owner_id || !product.collaborators || product.collaborators.length === 0;
    if (hasOldFields) {
      setIsNormalized(true);
    }
  }, [product]);

  // Form states for adding collaborator
  const [selectedUserId, setSelectedUserId] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<"editor" | "viewer">("editor");
  
  useEffect(() => {
    loadUsers();
    if (activeTab === 'history') loadHistory();
    if (activeTab === 'invites') loadInvites();
  }, [activeTab]);

  async function loadUsers() {
    try {
      const q = query(collection(db, "profiles"), orderBy("email", "asc"));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Profile)));
    } catch (e) {
      console.error("Error loading users:", e);
    }
  }

  async function loadHistory() {
    try {
      const q = query(collection(db, `products/${product.id}/history_events`), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductHistoryEvent)));
    } catch (e) {
      console.error(e);
    }
  }

  async function loadInvites() {
    try {
      const q = query(collection(db, `products/${product.id}/invites`), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductInvite)));
    } catch (e) {
      console.error(e);
    }
  }

  const handleSaveAll = async () => {
    setLoading(true);
    try {
      const finalProduct = recalculateProductAccess(draft);
      const productRef = doc(db, 'products', product.id);
      
      await updateDoc(productRef, cleanFirestoreData({
        ...finalProduct,
        updated_at: serverTimestamp()
      }));

      // History event
      const historyRef = collection(db, `products/${product.id}/history_events`);
      await addDoc(historyRef, cleanFirestoreData({
        product_id: product.id,
        type: 'product_settings_updated',
        title: 'Configurações de Acesso Atualizadas',
        summary: 'Owner e/ou colaboradores do produto foram atualizados via Admin.',
        actor_id: currentUser?.uid || 'admin',
        actor_email: currentUser?.email || 'admin@system.com',
        created_at: serverTimestamp()
      }));

      toast.success('Produto atualizado com sucesso!');
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar produto.');
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerChange = (uId: string) => {
    const selectedUser = users.find(u => u.id === uId);
    if (!selectedUser) return;

    const email = selectedUser.email || '';
    const name = selectedUser.display_name || email;

    setDraft(prev => {
      // Ensure the new owner is in the collaborators list
      const collabs = [...(prev.collaborators || [])];
      const existingIdx = collabs.findIndex(c => c.user_id === uId);

      if (existingIdx >= 0) {
        // Change existing role to owner
        collabs[existingIdx] = { ...collabs[existingIdx], role: 'owner' as any };
      } else {
        // Add as new owner
        collabs.push({
          user_id: uId,
          email,
          name,
          role: 'owner' as any,
          status: "active" as const,
          added_by: currentUser?.uid || 'admin',
          added_at: Timestamp.now()
        });
      }

      // Demote other owners to editors (optional logic, but usually safe)
      const updatedCollabs = collabs.map(c => {
        if (c.user_id !== uId && c.role === 'owner') {
          return { ...c, role: 'editor' as any };
        }
        return c;
      });

      return {
        ...prev,
        owner_id: uId,
        owner_email: email,
        owner_name: name,
        collaborators: updatedCollabs
      };
    });
  };

  const handleAddCollaborator = () => {
    const selectedUser = users.find(u => u.id === selectedUserId);
    const email = selectedUser?.email || manualEmail.trim().toLowerCase();
    const name = selectedUser?.display_name || email;
    const userId = selectedUser?.id || "";

    if (!email) {
      toast.error("Informe um usuário ou email.");
      return;
    }

    const alreadyExists = draft.collaborators?.some(c =>
      (userId && c.user_id === userId) ||
      c.email?.toLowerCase() === email.toLowerCase()
    );

    if (alreadyExists) {
      toast.error("Essa pessoa já está como colaboradora.");
      return;
    }

    const newCollaborator = {
      user_id: userId,
      email,
      name,
      role: selectedRole as any,
      status: "active" as const,
      added_by: currentUser?.uid || 'admin',
      added_at: Timestamp.now()
    };

    setDraft(prev => ({
      ...prev,
      collaborators: [...(prev.collaborators || []), newCollaborator]
    }));

    setSelectedUserId("");
    setManualEmail("");
    setSelectedRole("editor");
  };

  const handleUpdateRole = (userId: string, newRole: any) => {
    setDraft(prev => {
      const collaborators = (prev.collaborators || []).map(c => {
        if (c.user_id === userId) return { ...c, role: newRole as any };
        return c;
      });

      // If making someone an owner, update the product fields
      if (newRole === 'owner') {
        const newOwner = collaborators.find(c => c.user_id === userId);
        // Demote other owners
        const fixedCollabs = collaborators.map(c => {
          if (c.user_id !== userId && c.role === 'owner') return { ...c, role: 'editor' as any };
          return c;
        });

        return {
          ...prev,
          owner_id: userId,
          owner_email: newOwner?.email || '',
          owner_name: newOwner?.name || '',
          collaborators: fixedCollabs
        };
      }

      return { ...prev, collaborators };
    });
  };

  const handleRemoveCollaborator = (userId: string) => {
    const collab = draft.collaborators?.find(c => c.user_id === userId);
    if (collab?.role === 'owner' && draft.collaborators?.filter(c => c.role === 'owner').length === 1) {
      toast.error("Não é possível remover o único owner.");
      return;
    }

    setDraft(prev => ({
      ...prev,
      collaborators: prev.collaborators?.filter(c => c.user_id !== userId)
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-zinc-200">
        
        {/* Header */}
        <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Editar Produto</h2>
              <span className="px-3 py-1 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">ADMIN</span>
            </div>
            <p className="text-zinc-500 text-sm font-medium italic">ID: {product.id}</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-zinc-200 shadow-sm">
            <X className="w-6 h-6 text-zinc-400" />
          </button>
        </div>

        {/* Normalization Alert */}
        {isNormalized && (
          <div className="px-8 py-4 bg-amber-50 border-b border-amber-100 flex items-center gap-4">
             <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
               <AlertTriangle className="w-6 h-6 text-amber-600" />
             </div>
             <div>
               <p className="text-sm font-bold text-amber-900">Normalização necessária</p>
               <p className="text-xs text-amber-700 font-medium">Este produto antigo ainda não tinha vínculos de acesso. Revisamos e normalizamos os dados. Salve para confirmar.</p>
             </div>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="flex px-8 border-b border-zinc-100 gap-8 bg-white overflow-x-auto">
          {[
            { id: 'general', label: 'Geral', icon: Info },
            { id: 'collaborators', label: 'Colaboradores', icon: Users },
            { id: 'invites', label: 'Convites', icon: Mail },
            { id: 'history', label: 'Histórico', icon: History },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 py-6 border-b-2 transition-all text-xs font-black uppercase tracking-widest whitespace-nowrap",
                activeTab === tab.id ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-400 hover:text-zinc-600"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-zinc-50/30">
          
          {activeTab === 'general' && (
            <div className="space-y-8 max-w-2xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Nome do Produto</label>
                  <input 
                    type="text" 
                    value={draft.name}
                    onChange={e => setDraft(p => ({...p, name: e.target.value}))}
                    className="w-full px-5 py-4 bg-white border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all shadow-sm"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Proprietário (Owner)</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <select 
                      value={draft.owner_id}
                      onChange={e => handleOwnerChange(e.target.value)}
                      className="w-full pl-12 pr-10 py-4 bg-white border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all shadow-sm appearance-none"
                    >
                      <option value="">Selecione um usuário...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.display_name} | {u.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-medium italic ml-1">O owner tem controle total sobre o produto e colaboradores.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Status</label>
                  <select 
                    value={draft.status}
                    onChange={e => setDraft(p => ({...p, status: e.target.value as any}))}
                    className="w-full px-5 py-4 bg-white border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all shadow-sm appearance-none"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Visibilidade</label>
                   <div className="flex gap-4">
                      {['private', 'shared'].map(v => (
                        <button
                          key={v}
                          onClick={() => setDraft(p => ({...p, visibility: v as any}))}
                          className={cn(
                            "flex-1 py-4 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            draft.visibility === v ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-400 hover:border-zinc-300"
                          )}
                        >
                          {v === 'private' ? 'Privado' : 'Compartilhado'}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Descrição</label>
                  <textarea 
                    value={draft.description || ''}
                    onChange={e => setDraft(p => ({...p, description: e.target.value}))}
                    rows={3}
                    className="w-full px-5 py-4 bg-white border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-zinc-900 outline-none transition-all shadow-sm resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <button 
                  onClick={handleSaveAll}
                  disabled={loading}
                  className="flex items-center gap-2 px-8 py-4 bg-zinc-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-zinc-200 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Todas as Alterações
                </button>
              </div>
            </div>
          )}

          {activeTab === 'collaborators' && (
            <div className="space-y-8">
              {/* Adicionar Colaborador Form */}
              <div className="p-8 bg-white border border-zinc-100 rounded-[2rem] shadow-sm space-y-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Adicionar Colaborador
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-6 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Buscar Usuário</label>
                    <select 
                      value={selectedUserId}
                      onChange={e => {
                        setSelectedUserId(e.target.value);
                        setManualEmail("");
                      }}
                      className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:bg-white outline-none transition-all"
                    >
                      <option value="">Selecione um usuário...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.email}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Papel</label>
                    <select 
                      value={selectedRole}
                      onChange={e => setSelectedRole(e.target.value as any)}
                      className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:bg-white outline-none transition-all"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>

                  <div className="md:col-span-3 flex items-end">
                    <button 
                      onClick={handleAddCollaborator}
                      className="w-full py-4 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-zinc-400 italic">Ou digite um e-mail manualmente se o usuário ainda não tiver perfil.</p>
                <input 
                  type="email" 
                  placeholder="email@manual.com"
                  value={manualEmail}
                  onChange={e => setManualEmail(e.target.value)}
                  className="w-full max-w-md px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-medium focus:bg-white outline-none transition-all"
                />
              </div>

              {/* Tabela de Colaboradores */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-4">
                  <h3 className="text-xl font-black text-zinc-900">Ativos ({draft.collaborators?.length || 0})</h3>
                </div>
                
                <div className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Usuário</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Papel</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {draft.collaborators?.map(collab => (
                        <tr key={collab.user_id || collab.email} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-6 py-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center font-black text-zinc-400 text-xs">
                                {collab.name?.charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-black text-zinc-900 text-sm tracking-tight">{collab.name || 'Sem nome'}</span>
                                <span className="text-zinc-500 text-xs font-medium">{collab.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <select 
                              value={collab.role}
                              onChange={(e) => handleUpdateRole(collab.user_id, e.target.value)}
                              className="bg-zinc-100 border-none rounded-lg text-[10px] font-black uppercase tracking-widest py-1.5 px-3 appearance-none hover:bg-zinc-200 transition-all cursor-pointer"
                            >
                              <option value="owner">OWNER</option>
                              <option value="editor">EDITOR</option>
                              <option value="viewer">VIEWER</option>
                            </select>
                          </td>
                          <td className="px-6 py-6">
                             <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest">Ativo</span>
                          </td>
                          <td className="px-6 py-6 text-right">
                             <button 
                                onClick={() => handleRemoveCollaborator(collab.user_id)}
                                className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <button 
                  onClick={handleSaveAll}
                  disabled={loading}
                  className="flex items-center gap-2 px-10 py-5 bg-zinc-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-zinc-200 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar TUDO
                </button>
              </div>
            </div>
          )}

          {activeTab === 'invites' && (
            <div className="text-center py-20 max-w-md mx-auto space-y-6">
               <div className="w-20 h-20 bg-zinc-100 rounded-[2rem] flex items-center justify-center mx-auto">
                 <Mail className="w-10 h-10 text-zinc-300" />
               </div>
               <div>
                  <h3 className="text-xl font-black text-zinc-900 mb-2">Convites em Breve</h3>
                  <p className="text-zinc-500 text-sm font-medium italic">
                    Estamos configurando os envios automáticos por e-mail. Por enquanto, você pode adicionar pessoas diretamente usando a aba <b>Colaboradores</b>.
                  </p>
               </div>
               <button 
                onClick={() => setActiveTab('collaborators')}
                className="px-8 py-4 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest"
               >
                 Ir para Colaboradores
               </button>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-zinc-900 mb-6">Histórico de Alterações</h3>
              <div className="space-y-4">
                {history.map(event => (
                  <div key={event.id} className="p-6 bg-white border border-zinc-100 rounded-3xl flex gap-4 shadow-sm">
                    <div className="w-10 h-10 bg-zinc-50 rounded-2xl flex items-center justify-center shrink-0 border border-zinc-100">
                      <Clock className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-sm text-zinc-900 uppercase tracking-tight">{event.title}</span>
                        <span className="text-[10px] font-bold text-zinc-400">{formatDate(event.created_at)}</span>
                      </div>
                      <p className="text-xs text-zinc-600 leading-relaxed font-medium">{event.summary}</p>
                      <p className="text-[9px] font-black text-zinc-300 uppercase tracking-widest mt-2 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Por: {event.actor_email}
                      </p>
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="p-12 text-center text-zinc-400 italic">Nenhum histórico disponível.</div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
