import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, setDoc, deleteDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Profile, UserRole } from '../../types';
import { Users, Search, MoreVertical, Shield, UserPlus, UserMinus, Copy, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export default function UsersAdminSection() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesMap, setRolesMap] = useState<Record<string, UserRole[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { adminCtx } = useAuth();
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const pSnap = await getDocs(query(collection(db, 'profiles'), limit(20)));
      const rSnap = await getDocs(query(collection(db, 'user_roles'), limit(100)));
      
      const pData = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Profile));
      const rMap: Record<string, UserRole[]> = {};
      
      rSnap.docs.forEach(d => {
        const data = d.data();
        if (!rMap[data.user_id]) rMap[data.user_id] = [];
        rMap[data.user_id].push(data.role);
      });
      
      setProfiles(pData);
      setRolesMap(rMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function toggleRole(userId: string, role: UserRole) {
    if (!adminCtx?.isOwner) return;
    setUpdating(userId + role);
    try {
      const roleId = `${userId}_${role}`;
      const currentRoles = rolesMap[userId] || [];
      const hasRole = currentRoles.includes(role);

      if (hasRole) {
        // Prevent removing the last owner
        if (role === 'owner' && Object.values(rolesMap).filter(r => r.includes('owner')).length <= 1) {
          alert("Não é possível remover o último Owner do sistema.");
          return;
        }
        await deleteDoc(doc(db, 'user_roles', roleId));
      } else {
        await setDoc(doc(db, 'user_roles', roleId), {
          user_id: userId,
          role: role,
          granted_by: adminCtx.userId,
          created_at: serverTimestamp()
        });
      }
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(null);
    }
  }

  const filtered = profiles.filter(p => 
    p.display_name.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Gerenciamento de Usuários</h2>
          <p className="text-zinc-500 mt-1 font-medium italic">Visualize e controle o acesso dos usuários à plataforma.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou email..."
            className="pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm w-80 focus:ring-2 focus:ring-zinc-900 outline-none shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Usuário</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Roles Ativas</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Ações Rápidas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center">
                  <Loader2 className="w-6 h-6 text-zinc-300 animate-spin mx-auto mb-2" />
                  <span className="text-zinc-400 text-sm font-bold uppercase">Carregando usuários...</span>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center italic text-zinc-400">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : filtered.map((p) => {
              const uRoles = rolesMap[p.id] || [];
              return (
                <tr key={p.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-zinc-200 overflow-hidden border border-zinc-100">
                          {p.avatar_url && <img src={p.avatar_url} alt="Avatar" referrerPolicy="no-referrer" />}
                       </div>
                       <div>
                         <p className="font-bold text-zinc-900 leading-none">{p.display_name}</p>
                         <p className="text-xs text-zinc-400 mt-1">{p.email}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {uRoles.length > 0 ? uRoles.map(r => (
                        <span key={r} className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-md text-[10px] font-black uppercase border border-zinc-200">
                          {r}
                        </span>
                      )) : (
                        <span className="text-[10px] font-black uppercase text-zinc-300">Sem roles</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        {(['owner', 'admin', 'editor', 'viewer'] as UserRole[]).map(r => (
                          <button
                            key={r}
                            disabled={updating === (p.id + r) || !adminCtx?.isOwner}
                            onClick={() => toggleRole(p.id, r)}
                            className={cn(
                              "p-1.5 rounded-lg border transition-all relative overflow-hidden",
                              uRoles.includes(r) 
                                ? "bg-zinc-900 border-zinc-900 text-white shadow-md" 
                                : "bg-white border-zinc-200 text-zinc-400 hover:border-zinc-900 hover:text-zinc-900"
                            )}
                            title={uRoles.includes(r) ? `Remover role: ${r}` : `Adicionar role: ${r}`}
                          >
                            {updating === (p.id + r) ? <Loader2 className="w-4 h-4 animate-spin" /> : (uRoles.includes(r) ? <CheckCircle2 className="w-4 h-4" /> : <Shield className="w-4 h-4" />)}
                            <span className="sr-only">{r}</span>
                          </button>
                        ))}
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(p.id);
                            alert("UserID copiado!");
                          }}
                          className="p-1.5 bg-white border border-zinc-200 text-zinc-400 hover:text-zinc-900 rounded-lg"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                     </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
