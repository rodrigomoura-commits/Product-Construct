import React from 'react';
import { 
  Search, Filter, AlertTriangle, CheckCircle2, 
  ArrowRight, Database, UserX, FileWarning, 
  Zap, ExternalLink, Activity, Info, BarChart3,
  RefreshCw, ListTree, Bug
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';

export default function DatabaseDataAuditTab() {
  const issues = [
    { severity: 'CRITICAL', module: 'Produtos', table: 'products', record: 'p_882', issue: 'Produto sem owner vinculado', action: 'Atribuir Owner' },
    { severity: 'HIGH', module: 'Mindflow', table: 'mindflow_learnings', record: 'l_567', issue: 'Aprendizagem sem fonte de origem', action: 'Revisar Link' },
    { severity: 'MEDIUM', module: 'Agent Studio', table: 'stage_specialist_bindings', record: 'b_12', issue: 'Vínculo apontando para agente arquivado', action: 'Corrigir Vínculo' },
    { severity: 'LOW', module: 'Core', table: 'users', record: 'u_991', issue: 'Usuário sem papel definido', action: 'Set Role' },
    { severity: 'MEDIUM', module: 'Produtos', table: 'product_journey_stages', record: 's_44', issue: 'Etapa com progresso inconsistente', action: 'Reset Progress' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Auditoria Técnica de Integridade de Dados</h3>
          <p className="text-sm font-medium text-slate-500">Identificação de inconsistências funcionais entre registros e módulos.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20">
           <RefreshCw className="w-4 h-4" />
           Rodar Auditoria Completa
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Issues List */}
        <div className="lg:col-span-3 space-y-4">
           {issues.map((issue, i) => (
             <motion.div
               key={i}
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: i * 0.1 }}
               className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-md transition-all group border-l-4"
               style={{ borderLeftColor: issue.severity === 'CRITICAL' ? '#ef4444' : issue.severity === 'HIGH' ? '#f59e0b' : '#3b82f6' }}
             >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div className="flex gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                        issue.severity === 'CRITICAL' ? "bg-red-50 text-red-500" :
                        issue.severity === 'HIGH' ? "bg-amber-50 text-amber-500" : "bg-blue-50 text-blue-500"
                      )}>
                         {issue.severity === 'CRITICAL' ? <Bug className="w-6 h-6" /> : 
                          issue.severity === 'HIGH' ? <AlertTriangle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
                      </div>
                      
                      <div className="space-y-1">
                         <div className="flex items-center gap-2">
                            <span className={cn(
                               "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                               issue.severity === 'CRITICAL' ? "bg-red-500 text-white shadow-sm" : 
                               issue.severity === 'HIGH' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                            )}>{issue.severity}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-l border-slate-200 pl-2">{issue.module}</span>
                         </div>
                         <h4 className="text-base font-black text-slate-900 tracking-tight">{issue.issue}</h4>
                         <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                            <Database className="w-3 h-3" /> {issue.table} / <span className="text-slate-600">{issue.record}</span>
                         </div>
                      </div>
                   </div>

                   <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all opacity-0 group-hover:opacity-100 shadow-lg shadow-slate-200">
                      {issue.action}
                      <ArrowRight className="w-3.5 h-3.5" />
                   </button>
                </div>
             </motion.div>
           ))}
        </div>

        {/* Audit Stats */}
        <div className="space-y-6">
           <div className="bg-slate-900 rounded-[32px] p-8 text-white space-y-8 shadow-xl shadow-slate-200 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <BarChart3 className="w-20 h-20" />
              </div>

              <div className="space-y-6 relative z-10">
                 <h4 className="text-sm font-black tracking-tight uppercase">Audit Score</h4>
                 <div className="flex items-end gap-3">
                    <span className="text-5xl font-black text-indigo-400">82</span>
                    <span className="text-lg font-black text-indigo-400 opacity-60 mb-1">/100</span>
                 </div>
                 
                 <div className="space-y-3">
                    <AuditMetric label="Inconsistências Críticas" value={2} color="text-red-400" />
                    <AuditMetric label="High Risk Items" value={5} color="text-amber-400" />
                    <AuditMetric label="Registros Analisados" value="142k+" color="text-slate-400" />
                 </div>
              </div>

              <button className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all border border-white/10">
                 Gerar Relatório PDF
              </button>
           </div>

           <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex gap-4">
              <Info className="w-5 h-5 text-indigo-600 shrink-0" />
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium italic">
                “Audite mensalmente para garantir que o raciocínio da Tona não seja enviesado por registros órfãos ou dados corrompidos.”
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}

function AuditMetric({ label, value, color }: { label: string, value: string | number, color: string }) {
  return (
    <div className="flex items-center justify-between">
       <span className="text-xs font-medium text-white/60">{label}</span>
       <span className={cn("text-sm font-black", color)}>{value}</span>
    </div>
  );
}
