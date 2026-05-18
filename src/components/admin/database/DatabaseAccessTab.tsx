import React from 'react';
import { 
  Users, Shield, Lock, UserCheck, Key, AlertCircle, 
  Search, MoreVertical, LogIn, ShieldAlert, CheckCircle2,
  Filter, MoreHorizontal, Mail, Calendar, Eye, UserX,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';

export default function DatabaseAccessTab() {
  const users = [
    { id: '1', name: 'Rodrigo Moura', email: 'celular@rodrigomoura.net', role: 'Owner', permissions: 'Full Access', lastLogin: 'há 10 min', status: 'Active' },
    { id: '2', name: 'Sérgio Santos', email: 'sergio@tona.ai', role: 'Admin', permissions: 'High Level', lastLogin: 'há 2h', status: 'Active' },
    { id: '3', name: 'Ana Costa', email: 'ana@tona.ai', role: 'Editor', permissions: 'Read/Write', lastLogin: 'há 1 dia', status: 'Active' },
    { id: '4', name: 'Paulo Lima', email: 'paulo@cona.ai', role: 'Viewer', permissions: 'Read Only', lastLogin: 'há 3 dias', status: 'Inactive' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Access Summary */}
        <div className="lg:col-span-2 space-y-6">
           <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Usuários com Acesso ao Admin</h3>
              <div className="flex items-center gap-3">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar usuário..." 
                      className="pl-8 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold focus:ring-2 focus:ring-indigo-500"
                    />
                 </div>
                 <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-900/20">
                    Convidar Admin
                 </button>
              </div>
           </div>

           <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full border-collapse">
                 <thead>
                    <tr className="bg-slate-50/50">
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Usuário</th>
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Papel</th>
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Último Acesso</th>
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                       <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Ações</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                         <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                               <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:border-indigo-200 group-hover:text-indigo-600 transition-all overflow-hidden">
                                  <Users className="w-4 h-4" />
                               </div>
                               <div className="flex flex-col">
                                  <span className="text-sm font-black text-slate-900 tracking-tight">{user.name}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">{user.email}</span>
                               </div>
                            </div>
                         </td>
                         <td className="px-6 py-5">
                            <span className={cn(
                               "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                               user.role === 'Owner' ? "bg-indigo-50 text-indigo-600" :
                               user.role === 'Admin' ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-500"
                            )}>
                               {user.role}
                            </span>
                         </td>
                         <td className="px-6 py-5">
                            <div className="flex items-center gap-1.5">
                               <Calendar className="w-3 h-3 text-slate-400" />
                               <span className="text-[10px] font-bold text-slate-600 uppercase transition-colors">{user.lastLogin}</span>
                            </div>
                         </td>
                         <td className="px-6 py-5">
                            <div className={cn(
                               "w-2 h-2 rounded-full",
                               user.status === 'Active' ? "bg-emerald-500" : "bg-slate-300"
                            )} />
                         </td>
                         <td className="px-6 py-5 text-right">
                            <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-slate-900 transition-all">
                               <MoreHorizontal className="w-4 h-4" />
                            </button>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>

        {/* Permissions & Security Insights */}
        <div className="space-y-6">
           <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Governança & Riscos</h3>
           
           <div className="bg-slate-900 rounded-[32px] p-8 text-white space-y-8 shadow-xl shadow-slate-200">
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black tracking-tight uppercase">Privilégios Técnicos</h4>
                    <ShieldAlert className="w-5 h-5 text-indigo-400" />
                 </div>
                 <div className="space-y-3">
                    <PermissionCheck label="Acesso DB Direto" count={2} color="text-indigo-400" />
                    <PermissionCheck label="Execução de Migrations" count={4} color="text-emerald-400" />
                    <PermissionCheck label="Exclusão de Backup" count={1} color="text-red-400" />
                    <PermissionCheck label="Exportação de CSV" count={6} color="text-amber-400" />
                 </div>
              </div>

              <div className="pt-6 border-t border-white/10 space-y-4">
                 <h4 className="text-sm font-black tracking-tight uppercase flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Auditoria de Segurança
                 </h4>
                 <ul className="space-y-3">
                    <SecurityAlert label="Usuários sem 2FA ativo" count={0} status="OK" />
                    <SecurityAlert label="Logs de acesso expirados" count={1} status="WARN" />
                    <SecurityAlert label="Tentativas de intrusão (24h)" count={0} status="OK" />
                 </ul>
              </div>
           </div>

           <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 space-y-4">
              <div className="flex items-center gap-2 text-indigo-600">
                 <Lock className="w-4 h-4" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Controle de Contexto</span>
              </div>
              <p className="text-[11px] text-indigo-900 leading-relaxed font-medium">
                 A Tona utiliza permissões modulares. Você pode restringir um usuário para ver apenas <span className="font-black italic">Mindflow</span> sem acessar o <span className="font-black">Financeiro</span> ou <span className="font-black">Produtos</span>.
              </p>
              <button className="w-full py-2 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest">
                 Ver Matrix de Permissões
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

function PermissionCheck({ label, count, color }: { label: string, count: number, color: string }) {
  return (
    <div className="flex items-center justify-between group">
       <span className="text-xs font-medium text-slate-400 group-hover:text-white transition-colors">{label}</span>
       <span className={cn("text-[10px] font-black", color)}>{count} USER{count !== 1 ? 'S' : ''}</span>
    </div>
  );
}

function SecurityAlert({ label, count, status }: { label: string, count: number, status: 'OK' | 'WARN' | 'DANGER' }) {
  return (
    <div className="flex items-center justify-between">
       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{label}</span>
       <div className={cn(
         "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
         status === 'OK' ? "bg-emerald-500/20 text-emerald-400" :
         status === 'WARN' ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
       )}>
          {status} {count > 0 ? `(${count})` : ''}
       </div>
    </div>
  );
}
