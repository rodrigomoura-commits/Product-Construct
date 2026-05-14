import React from 'react';
import { 
  ShieldCheck, Lock, AlertTriangle, CheckCircle2, 
  Search, ExternalLink, ShieldAlert, Code, 
  Filter, ArrowRight, Eye, Shield, Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';

export default function DatabaseRLSTab() {
  const policies = [
    { table: 'products', name: 'Users can see own products', role: 'authenticated', action: 'SELECT', status: 'OK', risk: 'Low' },
    { table: 'product_artifacts', name: 'Owners can delete artifacts', role: 'authenticated', action: 'DELETE', status: 'OK', risk: 'Medium' },
    { table: 'mindflow_user_memories', name: 'System only write memory', role: 'system_service', action: 'INSERT', status: 'OK', risk: 'Low' },
    { table: 'profiles', name: 'Public profiles read-only', role: 'public', action: 'SELECT', status: 'Warning', risk: 'High' },
    { table: 'audit_logs', name: 'Admins see all logs', role: 'admin', action: 'SELECT', status: 'OK', risk: 'Low' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-emerald-900 rounded-[32px] p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 blur-[100px] rounded-full -mr-20 -mt-20" />
        <div className="relative z-10 space-y-4">
           <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-md text-emerald-400">
                 <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Row Level Security (RLS)</h2>
           </div>
           <p className="text-emerald-100/60 text-sm max-w-lg leading-relaxed font-medium">
             A governança de dados da Tona é garantida por políticas RLS robustas no nível do banco, impedindo vazamentos de contexto entre usuários e produtos.
           </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* RLS Policies List */}
        <div className="lg:col-span-3 space-y-6">
           <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Políticas Ativas por Tabela</h3>
              <div className="flex items-center gap-3">
                <button className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-900 transition-all font-black text-[10px] uppercase tracking-widest bg-white">
                   Revisar Todas
                </button>
                <button className="px-3 py-1.5 bg-slate-900 text-white rounded-lg transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-200">
                   Nova Política
                </button>
              </div>
           </div>

           <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full border-collapse">
                 <thead>
                    <tr className="bg-slate-50/50">
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Tabela</th>
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Nome da Policy</th>
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Action</th>
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Risco</th>
                       <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Ações</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {policies.map((policy, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                         <td className="px-6 py-5">
                            <span className="text-xs font-black text-slate-900 font-mono tracking-tight">{policy.table}</span>
                         </td>
                         <td className="px-6 py-5">
                            <div className="flex flex-col">
                               <span className="text-sm font-bold text-slate-700">{policy.name}</span>
                               <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{policy.role}</span>
                            </div>
                         </td>
                         <td className="px-6 py-5">
                            <div className={cn(
                               "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest w-fit",
                               policy.action === 'SELECT' ? "bg-blue-50 text-blue-600" :
                               policy.action === 'DELETE' ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                            )}>
                               {policy.action}
                            </div>
                         </td>
                         <td className="px-6 py-5 text-center">
                            <span className={cn(
                               "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest",
                               policy.risk === 'Low' ? "text-emerald-500" :
                               policy.risk === 'Medium' ? "text-amber-500" : "text-red-500"
                            )}>
                               {policy.risk}
                            </span>
                         </td>
                         <td className="px-6 py-5 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-indigo-600 border border-transparent hover:border-indigo-100 shadow-sm">
                                  <Code className="w-4 h-4" />
                               </button>
                               <button className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-indigo-600 border border-transparent hover:border-indigo-100 shadow-sm">
                                  <Eye className="w-4 h-4" />
                               </button>
                            </div>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>

        {/* Security Alerts */}
        <div className="space-y-6">
           <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alertas de Governança</h3>
           
           <div className="bg-slate-900 rounded-[32px] p-8 text-white space-y-6 shadow-xl shadow-slate-200 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <ShieldAlert className="w-20 h-20" />
              </div>
              
              <div className="space-y-6 relative z-10">
                 <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                       <h4 className="text-xs font-black uppercase tracking-widest text-red-400">Tabela Exposta</h4>
                       <p className="text-[10px] text-white/60 mt-1 leading-relaxed">A tabela <span className="text-red-400 font-bold">mindflow_runtime_logs</span> não possui RLS habilitado.</p>
                    </div>
                 </div>

                 <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                       <h4 className="text-xs font-black uppercase tracking-widest text-amber-400">Policy Muito Permissiva</h4>
                       <p className="text-[10px] text-white/60 mt-1 leading-relaxed">A policy em <span className="text-amber-400 font-bold">profiles</span> permite delete para todos autenticados.</p>
                    </div>
                 </div>
              </div>

              <button className="w-full py-3 bg-white text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-indigo-50 relative z-10">
                 Rodar Audit RLS
              </button>
           </div>

           <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Práticas Recomendadas</h4>
              <ul className="space-y-3">
                 <BestPractice label="Habilitar RLS em todas as tabelas" checked />
                 <BestPractice label="Testar políticas antes de deploy" checked />
                 <BestPractice label="Evitar policy true literal" checked={false} />
                 <BestPractice label="Auditoria periódica de acessos" checked />
              </ul>
           </div>
        </div>
      </div>
    </div>
  );
}

function BestPractice({ label, checked }: { label: string, checked: boolean }) {
  return (
    <div className="flex items-center gap-2">
       {checked ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <div className="w-3 h-3 rounded-full border border-slate-300" />}
       <span className={cn("text-[10px] font-bold text-slate-600", !checked && "text-slate-400")}>{label}</span>
    </div>
  );
}
