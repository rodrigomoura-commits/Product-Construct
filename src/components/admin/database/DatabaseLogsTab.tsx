import React, { useState } from 'react';
import { 
  History, Search, Filter, ArrowRight, Download, 
  Trash2, ShieldAlert, Monitor, User, Calendar, 
  Clock, Database, Code, Zap, List, Braces,
  MoreVertical, RefreshCw, Layers, Activity
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';

export default function DatabaseLogsTab() {
  const [filterType, setFilterType] = useState('All');

  const logs = [
    { type: 'WRITE', action: 'Update Record', table: 'mindflow_learnings', user: 'Rodrigo Moura', time: '10:42:15', status: 'Success', detail: '{"interaction_id": "int_9821"}' },
    { type: 'READ', action: 'Query Collection', table: 'products', user: 'System', time: '10:41:02', status: 'Success', detail: 'WHERE owner_id = "user_123"' },
    { type: 'DELETE', action: 'Remove Document', table: 'mindflow_learning_candidates', user: 'Admin Auto', time: '10:35:44', status: 'Success', detail: 'ID: cand_567' },
    { type: 'SECURITY', action: 'RLS Blocked', table: 'profiles', user: 'Anonymous', time: '10:20:11', status: 'Blocked', detail: 'Unauthorized read attempt' },
    { type: 'SCHEMA', action: 'Alter Table', table: 'mindflow_learnings', user: 'Rodrigo Moura', time: '09:12:05', status: 'Success', detail: 'Added column interaction_id' },
  ];

  const types = ['All', 'WRITE', 'READ', 'DELETE', 'SECURITY', 'SCHEMA'];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Logs Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
           <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Filtrar logs por usuário, tabela ou ação..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500"
              />
           </div>
           <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100">
              {types.map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                    filterType === t ? "bg-white text-indigo-600 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {t}
                </button>
              ))}
           </div>
        </div>
        <div className="flex items-center gap-2">
           <button className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-900 transition-all">
              <Download className="w-4 h-4" />
           </button>
           <button className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-900 transition-all">
              <RefreshCw className="w-4 h-4" />
           </button>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
         <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stream de Atividade do Banco</h4>
            <div className="flex items-center gap-2">
               <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-widest px-3 border-r border-slate-200">
                  <Activity className="w-3 h-3 animate-pulse" />
                  Live Monitoring
               </div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Total: 4.2k logs (24h)</span>
            </div>
         </div>

         <div className="divide-y divide-slate-50">
            {logs.map((log, i) => (
              <div key={i} className="p-6 hover:bg-slate-50/50 transition-colors group flex items-start gap-6">
                 <div className={cn(
                    "w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border transition-all",
                    log.status === 'Blocked' ? "bg-red-50 text-red-500 border-red-100" : "bg-white text-slate-400 border-slate-100 group-hover:border-indigo-100 group-hover:text-indigo-600"
                 )}>
                    {log.type === 'WRITE' ? <Code className="w-5 h-5" /> : 
                     log.type === 'DELETE' ? <Trash2 className="w-5 h-5" /> :
                     log.type === 'SECURITY' ? <ShieldAlert className="w-5 h-5" /> : <List className="w-5 h-5" />}
                    <span className="text-[7px] font-black uppercase tracking-tighter mt-0.5">{log.type}</span>
                 </div>

                 <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <h5 className="text-sm font-black text-slate-900 leading-none tracking-tight">{log.action}</h5>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                             <Database className="w-2.5 h-2.5" />
                             {log.table}
                          </div>
                          {log.status === 'Blocked' && (
                            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-black uppercase tracking-widest text-[8px]">DENIED</span>
                          )}
                       </div>
                       <span className="text-[10px] font-black text-slate-400 font-mono tracking-widest">{log.time}</span>
                    </div>

                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                          <span className="flex items-center gap-1.5"><User className="w-3 h-3 text-slate-300" /> {log.user}</span>
                          <span className="flex items-center gap-1.5"><Braces className="w-3 h-3 text-slate-300" /> {log.detail}</span>
                       </div>
                       <button className="text-[9px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest flex items-center gap-1 group/btn">
                          View Details
                          <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
                       </button>
                    </div>
                 </div>
              </div>
            ))}
         </div>

         <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Mostrando os últimos 50 eventos técnicos</p>
            <div className="flex items-center gap-2">
               <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-600 hover:text-slate-900 shadow-sm transition-all">
                  Anterior
               </button>
               <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-600 hover:text-slate-900 shadow-sm transition-all">
                  Próxima
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
