import React from 'react';
import { 
  Zap, Clock, Activity, BarChart3, Search, 
  ArrowUpRight, AlertTriangle, CheckCircle2,
  Table, RefreshCw, Filter, Play, Code, Info
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';

export default function DatabasePerformanceTab() {
  const slowQueries = [
    { query: 'SELECT * FROM mindflow_learnings WHERE theme = $1', duration: '1,240ms', calls: '4.2k/h', impact: 'High' },
    { query: 'SELECT COUNT(*) FROM product_artifacts', duration: '840ms', calls: '120/h', impact: 'Medium' },
    { query: 'SELECT * FROM mindflow_user_memories ORDER BY created_at DESC', duration: '720ms', calls: '12k/h', impact: 'Critical' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <MetricCard label="Latência Média (Read)" value="124ms" icon={Clock} color="text-indigo-600" trend="up" />
         <MetricCard label="Latência Média (Write)" value="242ms" icon={Zap} color="text-amber-600" trend="down" />
         <MetricCard label="Cache Hit Rate" value="89.4%" icon={Activity} color="text-emerald-600" trend="up" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Slow Queries List */}
        <div className="lg:col-span-3 space-y-6">
           <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Queries Lentas & Gargalos</h3>
              <div className="flex items-center gap-2">
                 <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-400">
                    <RefreshCw className="w-4 h-4" />
                 </button>
                 <select className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-indigo-500">
                    <option>Últimas 24h</option>
                    <option>Últimas 7 dias</option>
                 </select>
              </div>
           </div>

           <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full border-collapse">
                 <thead>
                    <tr className="bg-slate-50/50">
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Query Pattern</th>
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Duração</th>
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Frequência</th>
                       <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Impacto</th>
                       <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Ação</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {slowQueries.map((q, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                         <td className="px-6 py-5">
                            <div className="flex flex-col gap-1.5">
                               <code className="text-xs font-mono text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 block max-w-sm truncate group-hover:max-w-none transition-all">{q.query}</code>
                            </div>
                         </td>
                         <td className="px-6 py-5">
                            <span className={cn(
                               "text-sm font-black",
                               parseInt(q.duration) > 1000 ? "text-red-500" : "text-amber-500"
                            )}>{q.duration}</span>
                         </td>
                         <td className="px-6 py-5">
                            <span className="text-xs font-bold text-slate-500">{q.calls}</span>
                         </td>
                         <td className="px-6 py-5 text-center">
                            <div className={cn(
                               "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest w-fit mx-auto",
                               q.impact === 'Critical' ? "bg-red-900 shadow-lg shadow-red-900/20 text-white" :
                               q.impact === 'High' ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                            )}>
                               {q.impact}
                            </div>
                         </td>
                         <td className="px-6 py-5 text-right">
                            <button className="p-2 hover:bg-indigo-600 hover:text-white rounded-lg transition-all text-slate-400 border border-transparent shadow-sm">
                               <Code className="w-4 h-4" />
                            </button>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>

        {/* Index Optimization */}
        <div className="space-y-6">
           <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Otimização de Índices</h3>
           
           <div className="bg-slate-900 rounded-[32px] p-8 text-white space-y-6 shadow-xl shadow-slate-200">
              <div className="flex items-center justify-between">
                 <h4 className="text-sm font-black tracking-tight uppercase">Index Health</h4>
                 <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                    <BarChart3 className="w-5 h-5" />
                 </div>
              </div>

              <div className="space-y-4">
                 <IndexStat label="Total Índices Ativos" value="48" />
                 <IndexStat label="Índices Não Utilizados" value="4" />
                 <IndexStat label="Missing Indices (Avg)" value="2" />
              </div>

              <div className="pt-6 border-t border-white/10 space-y-4">
                 <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                    <div className="flex gap-3">
                       <AlertTriangle className="w-5 h-5 text-indigo-400 shrink-0" />
                       <div className="space-y-1">
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Sugerencia</h5>
                          <p className="text-[10px] text-white/60 leading-relaxed font-medium">Recomendado criar índice composto para <span className="text-indigo-400">mindflow_learnings(theme, sub_theme)</span>.</p>
                       </div>
                    </div>
                 </div>
              </div>

              <button className="w-full py-3 bg-white text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-indigo-50">
                 Gerar Plano de Índices
              </button>
           </div>

           <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl flex gap-4">
              <Info className="w-5 h-5 text-slate-400 shrink-0" />
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Estatísticas avançadas de performance dependem de logs de execução ativados no Firestore Dashboard.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, trend }: { label: string, value: string, icon: any, color: string, trend: 'up' | 'down' }) {
  return (
    <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between group">
       <div className="flex items-center gap-4">
          <div className={cn("w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center transition-all group-hover:bg-indigo-50", color)}>
             <Icon className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</span>
             <span className="text-2xl font-black text-slate-900 tracking-tight">{value}</span>
          </div>
       </div>
       <div className={cn(
         "w-8 h-8 rounded-full flex items-center justify-center",
         trend === 'up' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
       )}>
          {trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className={cn("w-4 h-4", trend === 'down' ? 'rotate-180' : '')} strokeWidth={3} />}
       </div>
    </div>
  );
}

const ArrowDownRight = ({ className, strokeWidth }: { className?: string, strokeWidth?: number }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth || 2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 7l10 10M17 7v10H7" />
  </svg>
);

function IndexStat({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex items-center justify-between">
       <span className="text-xs font-medium text-slate-400">{label}</span>
       <span className="text-sm font-black text-white">{value}</span>
    </div>
  );
}
