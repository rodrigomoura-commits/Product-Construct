import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Shield, Loader2, Clock, User } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export default function PermissionsAdminSection() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const rSnap = await getDocs(collection(db, 'user_roles'));
        const pSnap = await getDocs(collection(db, 'profiles'));
        
        const profilesMap: any = {};
        pSnap.docs.forEach(d => profilesMap[d.id] = d.data());
        
        const roles = rSnap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          user_name: profilesMap[d.data().user_id]?.display_name || 'Desconhecido',
          user_email: profilesMap[d.data().user_id]?.email || 'N/A'
        }));
        
        setData(roles);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Audit de Permissões</h2>
        <p className="text-zinc-500 mt-1 font-medium italic">Visão técnica de todas as concessões de papéis ativas no sistema.</p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Usuário</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Papel (Role)</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Concedido por</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 font-mono text-[11px]">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <Loader2 className="w-6 h-6 text-zinc-300 animate-spin mx-auto" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center italic text-zinc-400">
                  Nenhuma permissão registrada.
                </td>
              </tr>
            ) : data.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-zinc-900">{item.user_name}</span>
                    <span className="text-[10px] text-zinc-400">{item.user_id}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                   <div className="flex items-center gap-2">
                     <div className={cn(
                       "w-2 h-2 rounded-full",
                       item.role === 'owner' ? "bg-red-500" : item.role === 'admin' ? "bg-amber-500" : "bg-blue-500"
                     )} />
                     <span className="font-bold uppercase text-zinc-900">{item.role}</span>
                   </div>
                </td>
                <td className="px-6 py-4 text-zinc-500">
                   {item.granted_by === 'system' ? (
                     <span className="px-1.5 py-0.5 bg-zinc-100 rounded text-[9px] font-black">SYSTEM</span>
                   ) : item.granted_by}
                </td>
                <td className="px-6 py-4 text-zinc-400">
                   {formatDate(item.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="p-6 bg-zinc-900 rounded-3xl text-white">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" /> Matriz de Permissões
            </h3>
            <div className="space-y-4 text-xs font-medium">
               <div className="flex justify-between border-b border-white/10 pb-2">
                 <span className="text-zinc-400 uppercase tracking-widest text-[9px]">Ação</span>
                 <span className="text-zinc-400 uppercase tracking-widest text-[9px]">Papel Mínimo</span>
               </div>
               <div className="flex justify-between">
                 <span>Gerenciar Roles Host/Admin</span>
                 <span className="font-bold text-red-400">OWNER</span>
               </div>
               <div className="flex justify-between">
                 <span>Configurações Globais</span>
                 <span className="font-bold text-amber-400">ADMIN</span>
               </div>
               <div className="flex justify-between">
                 <span>Curar Mindflow (Memória e Aprendizagem)</span>
                 <span className="font-bold text-amber-400">ADMIN</span>
               </div>
               <div className="flex justify-between">
                 <span>Criar Novos Produtos</span>
                 <span className="font-bold text-blue-400">EDITOR</span>
               </div>
            </div>
         </div>
         
         <div className="p-6 bg-white border border-zinc-200 rounded-3xl">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-zinc-900">
              <User className="w-5 h-5 text-blue-500" /> Registro de Sessão
            </h3>
            <p className="text-sm text-zinc-500 mb-4 leading-relaxed">
              O sistema utiliza tokens de autenticação curtos e validações RLS em tempo real. Cada acesso ao console administrativo é auditado.
            </p>
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 rounded-xl border border-zinc-100">
               <Clock className="w-4 h-4 text-zinc-400" />
               <span className="text-xs font-bold text-zinc-600 uppercase tracking-tight">Time: {new Date().toLocaleTimeString()}</span>
            </div>
         </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
