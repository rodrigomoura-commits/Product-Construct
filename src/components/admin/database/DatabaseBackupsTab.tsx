import React from 'react';
import { 
  Download, Calendar, Database, Clock, HardDrive, 
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, 
  HelpCircle, MoreVertical, ShieldCheck, ArrowRight,
  Plus
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';

export default function DatabaseBackupsTab() {
  const backupHistory = [
    { id: 'BK-001', name: 'Automatic Daily Backup', date: '2026-05-12 04:00', size: '2.4 GB', status: 'Success', type: 'System' },
    { id: 'BK-002', name: 'Pre-migration Snapshot', date: '2026-05-12 10:15', size: '2.3 GB', status: 'Success', type: 'Manual' },
    { id: 'BK-003', name: 'Automatic Daily Backup', date: '2026-05-11 04:00', size: '2.3 GB', status: 'Success', type: 'System' },
    { id: 'BK-004', name: 'Automatic Daily Backup', date: '2026-05-10 04:00', size: '2.2 GB', status: 'Failed', type: 'System' },
    { id: 'BK-005', name: 'Manual Full Dump', date: '2026-05-09 18:30', size: '4.8 GB', status: 'Success', type: 'Manual' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Backup Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 bg-slate-900 rounded-[32px] p-10 text-white relative overflow-hidden flex flex-col justify-between shadow-xl shadow-slate-200">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[120px] rounded-full -mr-40 -mt-40" />
            
            <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-md">
                      <ShieldCheck className="text-white w-8 h-8" />
                   </div>
                   <div>
                      <h2 className="text-2xl font-black text-white tracking-tight">Estratégia de Backup</h2>
                      <p className="text-indigo-200/60 text-sm font-medium">Backup automático diário e snapshots preventivos.</p>
                   </div>
                </div>

                <div className="grid grid-cols-3 gap-6 pt-4">
                   <BackupMetric label="Último Backup" value="há 8h" icon={Clock} />
                   <BackupMetric label="Retenção" value="30 dias" icon={Calendar} />
                   <BackupMetric label="Próximo" value="em 16h" icon={RefreshCw} />
                </div>
            </div>

            <div className="relative z-10 pt-10 flex items-center gap-4">
               <button className="flex items-center gap-3 px-6 py-3 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-lg">
                  <Plus className="w-4 h-4" />
                  Gerar Snapshot Agora
               </button>
               <button className="flex items-center gap-3 px-6 py-3 bg-white/10 text-white border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all">
                  Configurar Política
               </button>
            </div>
         </div>

         <div className="space-y-6">
            <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Armazenamento de Backup</h3>
               <div className="flex flex-col items-center justify-center py-6">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                     <svg className="w-full h-full -rotate-90">
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364} strokeDashoffset={364 - (0.42 * 364)} className="text-indigo-500" strokeLinecap="round" />
                     </svg>
                     <div className="absolute flex flex-col items-center">
                        <span className="text-2xl font-black text-slate-900">42%</span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-0.5">USED</span>
                     </div>
                  </div>
                  <p className="mt-6 text-sm font-black text-slate-900 leading-none">8.4 GB / 20 GB</p>
                  <p className="mt-1 text-[10px] text-slate-400 font-medium">Bucket: default-backups</p>
               </div>
            </div>
         </div>
      </div>

      {/* Backup History Table */}
      <div className="space-y-4">
         <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Histórico de Snapshots</h3>
         <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full border-collapse">
               <thead>
                  <tr className="bg-slate-50/50">
                     <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">ID / Nome</th>
                     <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Data e Hora</th>
                     <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Tamanho</th>
                     <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Tipo</th>
                     <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                     <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Ações</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50 text-sm">
                  {backupHistory.map((backup) => (
                    <tr key={backup.id} className="hover:bg-slate-50/50 transition-colors group">
                       <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                             <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                                <HardDrive className="w-4 h-4" />
                             </div>
                             <div className="flex flex-col">
                                <span className="font-black text-slate-900 tracking-tight">{backup.name}</span>
                                <code className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">{backup.id}</code>
                             </div>
                          </div>
                       </td>
                       <td className="px-6 py-5 font-bold text-slate-600">
                          {backup.date}
                       </td>
                       <td className="px-6 py-5 font-bold text-slate-600">
                          {backup.size}
                       </td>
                       <td className="px-6 py-5">
                          <span className={cn(
                             "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                             backup.type === 'System' ? "bg-slate-100 text-slate-500" : "bg-indigo-50 text-indigo-600"
                          )}>
                             {backup.type}
                          </span>
                       </td>
                       <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                             {backup.status === 'Success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                             <span className={cn(
                               "text-[10px] font-black uppercase tracking-widest",
                               backup.status === 'Success' ? "text-emerald-600" : "text-red-600"
                             )}>{backup.status}</span>
                          </div>
                       </td>
                       <td className="px-6 py-5 text-right">
                          <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 border border-transparent shadow-sm">
                             <Download className="w-4 h-4" />
                          </button>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}

function BackupMetric({ label, value, icon: Icon }: { label: string, value: string, icon: any }) {
  return (
    <div className="flex flex-col gap-2">
       <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-300">
          <Icon className="w-3 h-3" />
          <span>{label}</span>
       </div>
       <span className="text-xl font-black text-white">{value}</span>
    </div>
  );
}
