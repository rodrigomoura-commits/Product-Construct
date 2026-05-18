import React from 'react';
import { 
  ListTree, GitBranch, Calendar, User, CheckCircle2, 
  XCircle, Clock, Search, Filter, ArrowRight, Table,
  Code, Play, AlertCircle, RefreshCw, FileCode
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';

export default function DatabaseMigrationsTab() {
  const migrations = [
    { name: '20260512_add_interaction_id_to_learnings', date: '2026-05-12 10:42', user: 'Rodrigo Moura', status: 'Success', tables: ['mindflow_learnings'] },
    { name: '20260510_create_mindflow_context_groups', date: '2026-05-10 15:20', user: 'System', status: 'Success', tables: ['mindflow_conflict_groups'] },
    { name: '20260508_refactor_product_stages', date: '2026-05-08 09:15', user: 'Sérgio Santos', status: 'Success', tables: ['product_journey_stages'] },
    { name: '20260505_add_reasoning_priority', date: '2026-05-05 14:00', user: 'Rodrigo Moura', status: 'Error', tables: ['mindflow_reasonings'] },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between">
         <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Histórico de Alterações de Schema</h3>
         <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-600 hover:text-slate-900 shadow-sm transition-all">
               <RefreshCw className="w-4 h-4" />
               Verificar Estrutura Esperada
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all">
               <Play className="w-4 h-4 fill-current" />
               Nova Migration
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Migration History */}
        <div className="lg:col-span-3">
           <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                 <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar por nome ou autor..." 
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                    />
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 border-r border-slate-200 mr-2">Filtros</span>
                    <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 font-bold text-xs hover:text-slate-700">
                       <Filter className="w-4 h-4" />
                    </button>
                 </div>
              </div>

              <div className="divide-y divide-slate-50">
                 {migrations.map((mig, i) => (
                    <div key={i} className="p-6 hover:bg-slate-50/50 transition-all group flex items-center justify-between">
                       <div className="flex items-center gap-6">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                            mig.status === 'Success' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                          )}>
                             {mig.status === 'Success' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                          </div>
                          
                          <div className="space-y-1">
                             <div className="flex items-center gap-3">
                                <h4 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{mig.name}</h4>
                                <div className="flex gap-1">
                                   {mig.tables.map(t => (
                                      <span key={t} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[8px] font-black uppercase tracking-widest">{t}</span>
                                   ))}
                                </div>
                             </div>
                             <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {mig.date}</span>
                                <span className="flex items-center gap-1.5"><User className="w-3 h-3" /> {mig.user}</span>
                             </div>
                          </div>
                       </div>

                       <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="flex items-center gap-2 p-2 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 border border-transparent transition-all">
                             <Code className="w-4 h-4" />
                          </button>
                          <button className="flex items-center gap-2 px-3 py-2 hover:bg-indigo-600 hover:text-white rounded-xl text-slate-400 font-black text-[10px] uppercase tracking-widest border border-transparent shadow-sm transition-all">
                             Datalhes
                          </button>
                       </div>
                    </div>
                 ))}
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
                 <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                    Carregar Histórico Antigo
                 </button>
              </div>
           </div>
        </div>

        {/* Sync Status Side Panels */}
        <div className="space-y-6">
           <div className="bg-slate-900 rounded-[32px] p-8 text-white space-y-6 shadow-xl shadow-slate-200">
              <div className="flex items-center justify-between">
                 <h4 className="text-sm font-black tracking-tight uppercase">Status de Sync</h4>
                 <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Versão Schema</span>
                    <span className="text-white font-black">v2.4.12</span>
                 </div>
                 <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Ambiente</span>
                    <span className="text-white font-black uppercase tracking-widest text-[9px]">Production</span>
                 </div>
                 <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Check Automático</span>
                    <span className="text-emerald-400 font-black">Enabled</span>
                 </div>
              </div>

              <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-900/40 hover:bg-indigo-500 transition-all">
                 Compare with Local
              </button>
           </div>

           <div className="p-6 bg-red-50 border border-red-100 rounded-3xl space-y-3">
              <div className="flex items-center gap-2 text-red-600">
                 <AlertCircle className="w-4 h-4" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Divergência Detectada</span>
              </div>
              <p className="text-[11px] text-red-900 font-medium leading-relaxed">
                 O campo <code className="font-black">interaction_id</code> na tabela <code className="font-black">mindflow_learnings</code> existe no banco mas não está definido no blueprint local.
              </p>
              <button className="text-[10px] font-black text-red-600 hover:underline flex items-center gap-1 uppercase tracking-tight">
                 Resolver Conflitos
                 <ArrowRight className="w-3 h-3" />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
