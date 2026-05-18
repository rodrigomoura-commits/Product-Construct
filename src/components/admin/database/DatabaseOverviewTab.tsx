import React from 'react';
import { 
  Activity, Table, Share2, HardDrive, ShieldCheck, Zap, 
  ListTree, Download, History, Search, CheckCircle2, 
  AlertCircle, ArrowUpRight, ArrowDownRight, Clock, ArrowRight, AlertTriangle
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';

export default function DatabaseOverviewTab() {
  const stats = [
    { label: "Total de Tabelas", value: "32", icon: Table, color: "bg-blue-500", detail: "Coleções Firestore" },
    { label: "Total de Registros", value: "~142.5k", icon: Activity, color: "bg-indigo-500", detail: "+12% esta semana" },
    { label: "Armazenamento", value: "4.2 GB", icon: HardDrive, color: "bg-emerald-500", detail: "68% de cota" },
    { label: "Saúde Geral", value: "94/100", icon: CheckCircle2, color: "bg-amber-500", detail: "Status: Saudável" },
  ];

  const alerts = [
    { type: 'warning', title: 'Queries Lentas Detectadas', description: '3 queries estão acima de 800ms de execução.', time: 'há 12 min' },
    { type: 'error', title: 'Policy RLS Ausente', description: 'A tabela mindflow_runtime_logs não possui política restritiva.', time: 'há 1h' },
    { type: 'info', title: 'Backup Concluído', description: 'Backup automatizado diário concluído com sucesso.', time: 'há 4h' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={stat.color + " w-10 h-10 rounded-xl flex items-center justify-center text-white"}>
                <stat.icon className="w-5 h-5" />
              </div>
              {i === 1 && (
                <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                  <ArrowUpRight className="w-3 h-3" />
                  Ativo
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</h3>
              <p className="text-slate-400 text-[10px] font-medium">{stat.detail}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Health Score Card */}
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Database Health Score</h3>
              <p className="text-slate-500 text-sm font-medium">Análise de integridade e performance em tempo real.</p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-slate-900 flex flex-col items-center justify-center text-white shadow-lg shadow-slate-200">
               <span className="text-xl font-black leading-none">94</span>
               <span className="text-[8px] uppercase tracking-widest font-black mt-0.5 opacity-60">SCORE</span>
            </div>
          </div>
          
          <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
             <div className="space-y-6">
                <HealthFactor label="Integridade Referencial" score={98} />
                <HealthFactor label="Disponibilidade de Storage" score={85} />
                <HealthFactor label="Performance de Queries" score={92} />
                <HealthFactor label="Políticas de RLS" score={88} />
             </div>
             <div className="space-y-6">
                <HealthFactor label="Ausência de Índices" score={95} />
                <HealthFactor label="Migrations em Dia" score={100} />
                <HealthFactor label="Backups Recentes" score={100} />
                <HealthFactor label="Erros Técnicos" score={91} />
             </div>
          </div>

          <div className="mt-auto p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Última análise completa há 45 minutos</p>
             <button className="text-xs font-black text-indigo-600 hover:text-indigo-700 transition-colors uppercase tracking-tight flex items-center gap-2">
                Ver Relatório Detalhado
                <ArrowRight className="w-3 h-3" />
             </button>
          </div>
        </div>

        {/* Alerts & Notifications */}
        <div className="bg-slate-900 rounded-[32px] shadow-xl shadow-slate-200 p-8 flex flex-col">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-black text-white tracking-tight">Alertas Técnicos</h3>
              <div className="px-2 py-0.5 rounded-md bg-red-500 text-white text-[10px] font-black">3 ATIVOS</div>
           </div>

           <div className="space-y-6 flex-1">
              {alerts.map((alert, i) => (
                <div key={i} className="flex gap-4 group cursor-pointer">
                   <div className={cn(
                     "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                     alert.type === 'error' ? 'bg-red-500/20 text-red-400' : 
                     alert.type === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                   )}>
                      {alert.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : 
                       alert.type === 'warning' ? <Zap className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                   </div>
                   <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{alert.title}</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{alert.description}</p>
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-2 block">{alert.time}</span>
                   </div>
                </div>
              ))}
           </div>

           <button className="mt-8 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all">
              Ver Todos os Logs
           </button>
        </div>
      </div>
    </div>
  );
}

function HealthFactor({ label, score }: { label: string, score: number }) {
  const getStatusColor = (s: number) => {
    if (s >= 95) return 'bg-emerald-500';
    if (s >= 80) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-wider">
        <span>{label}</span>
        <span className={cn("px-1.5 py-0.5 rounded", score >= 90 ? "text-emerald-600" : "text-amber-600")}>{score}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          className={cn("h-full rounded-full transition-all duration-1000", getStatusColor(score))}
        />
      </div>
    </div>
  );
}
