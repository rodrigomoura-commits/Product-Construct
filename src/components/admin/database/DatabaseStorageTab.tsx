import React from 'react';
import { 
  HardDrive, FileText, Database, Package, Image as ImageIcon, 
  Search, Download, Trash2, ArrowRight, Activity, Zap, 
  ExternalLink, Layers, PieChart, Filter, Plus
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';

export default function DatabaseStorageTab() {
  const buckets = [
    { id: 'product-artifacts', name: 'Arquivos de Produtos', files: 1240, size: '2.4 GB', type: 'Artifacts', status: 'Healthy' },
    { id: 'mindflow-imports', name: 'Importações Mindflow', files: 82, size: '42 MB', type: 'JSON/CSV', status: 'Healthy' },
    { id: 'user-uploads', name: 'Uploads de Usuários', files: 540, size: '840 MB', type: 'Mixed', status: 'Warning' },
    { id: 'agent-outputs', name: 'Outputs de Agentes', files: 2150, size: '1.2 GB', type: 'Images/Text', status: 'Healthy' },
    { id: 'system-exports', name: 'Exports de Sistema', files: 45, size: '210 MB', type: 'ZIP', status: 'Healthy' },
    { id: 'backups', name: 'Backups Automáticos', files: 30, size: '8.4 GB', type: 'SQL/Archive', status: 'Healthy' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Storage Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <StorageStatCard label="Tamanho Total DB" value="4.2 GB" icon={Database} subValue="+120MB / mês" />
         <StorageStatCard label="Total Arquivos (Files)" value="12.4 GB" icon={HardDrive} subValue="6 Buckets ativos" />
         <StorageStatCard label="Média por Artefato" value="1.8 MB" icon={Package} subValue="Versão 1.2.4" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Buckets List */}
        <div className="lg:col-span-3 space-y-6">
           <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Buckets de Armazenamento Ativos</h3>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all font-black text-[10px] uppercase tracking-widest">
                 <Plus className="w-3 h-3" />
                 Novo Bucket
              </button>
           </div>

           <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full border-collapse">
                 <thead>
                    <tr className="bg-slate-50/50">
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Bucket</th>
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Arquivos</th>
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Tamanho</th>
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Tipo</th>
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                       <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Ações</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {buckets.map((bucket) => (
                      <tr key={bucket.id} className="hover:bg-slate-50/50 transition-colors group">
                         <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                                  <HardDrive className="w-5 h-5" />
                               </div>
                               <div className="flex flex-col">
                                  <span className="text-sm font-black text-slate-900 tracking-tight">{bucket.name}</span>
                                  <code className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">{bucket.id}</code>
                               </div>
                            </div>
                         </td>
                         <td className="px-6 py-5">
                            <span className="text-sm font-bold text-slate-700">{bucket.files.toLocaleString()}</span>
                         </td>
                         <td className="px-6 py-5">
                            <span className="text-sm font-bold text-slate-700">{bucket.size}</span>
                         </td>
                         <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                               <ImageIcon className="w-3 h-3 text-slate-400" />
                               <span className="text-xs font-medium text-slate-500">{bucket.type}</span>
                            </div>
                         </td>
                         <td className="px-6 py-5">
                            <div className={cn(
                               "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest w-fit",
                               bucket.status === 'Healthy' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                            )}>
                               {bucket.status}
                            </div>
                         </td>
                         <td className="px-6 py-5 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-indigo-600 border border-transparent hover:border-indigo-100 shadow-sm">
                                  <Download className="w-4 h-4" />
                               </button>
                               <button className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-red-600 border border-transparent hover:border-red-100 shadow-sm">
                                  <Trash2 className="w-4 h-4" />
                               </button>
                            </div>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>

        {/* Storage Insights */}
        <div className="lg:col-span-1 space-y-6">
           <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Análise de Espaço</h3>
           
           <div className="bg-slate-900 rounded-[32px] p-6 text-white space-y-6">
              <div className="flex items-center justify-between">
                 <span className="text-xs font-bold opacity-60">Uso de Quota GCloud</span>
                 <span className="text-xs font-black">68%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                 <div className="h-full bg-indigo-500 rounded-full" style={{ width: '68%' }} />
              </div>
              
              <div className="space-y-4 pt-4 border-t border-white/10">
                 <StorageUsageItem label="Imagens" size="4.2 GB" color="bg-blue-500" />
                 <StorageUsageItem label="Documentos" size="2.8 GB" color="bg-purple-500" />
                 <StorageUsageItem label="Vídeos / Media" size="3.1 GB" color="bg-amber-500" />
                 <StorageUsageItem label="System Log Archives" size="2.3 GB" color="bg-slate-500" />
              </div>
           </div>

           <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 space-y-3">
              <div className="flex items-center gap-2 text-amber-600">
                 <Zap className="w-4 h-4" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Cleanup Recommendation</span>
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                 Foram detectados <span className="font-black italic">420 arquivos órfãos</span> (não referenciados em nenhuma tabela) que ocupam cerca de <span className="font-black">1.2 GB</span>.
              </p>
              <button className="w-full py-2 bg-amber-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-amber-200">
                 Identificar Arquivos Órfãos
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

function StorageStatCard({ label, value, icon: Icon, subValue }: { label: string, value: string, icon: any, subValue: string }) {
  return (
    <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-5 group">
       <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
          <Icon className="w-7 h-7" />
       </div>
       <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</span>
          <span className="text-2xl font-black text-slate-900 leading-none">{value}</span>
          <span className="text-[10px] font-medium text-slate-500 mt-2">{subValue}</span>
       </div>
    </div>
  );
}

function StorageUsageItem({ label, size, color }: { label: string, size: string, color: string }) {
  return (
    <div className="flex items-center justify-between group">
       <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", color)} />
          <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">{label}</span>
       </div>
       <span className="text-[10px] font-black text-white">{size}</span>
    </div>
  );
}
