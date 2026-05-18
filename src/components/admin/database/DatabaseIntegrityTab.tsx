import React from 'react';
import { 
  CheckCircle2, AlertTriangle, XCircle, Search, 
  Activity, ArrowRight, ShieldCheck, Database, 
  Hash, Code, Layers, Zap, Info, Bug,
  FileSearch, Trash2, RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';

export default function DatabaseIntegrityTab() {
  const checks = [
    { name: 'Registros Órfãos (Dangling Refs)', status: 'Warning', found: 42, description: 'Referências a documentos que já foram deletados.' },
    { name: 'Foreign Keys Virtuais', status: 'Healthy', found: 0, description: 'Integridade de relacionamentos transversais.' },
    { name: 'IDs Duplicados (Hash Collision)', status: 'Healthy', found: 0, description: 'Conflito de identificadores únicos no sistema.' },
    { name: 'Campos JSON Malformados', status: 'Healthy', found: 2, description: 'Payloads que divergem do schema esperado.' },
    { name: 'Missing Timestamps', status: 'Warning', found: 12, description: 'Documentos criados sem created_at ou updated_at.' },
    { name: 'Owner Desconhecido', status: 'Healthy', found: 0, description: 'Registros privados sem vínculo de usuário dono.' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-900 rounded-[32px] p-10 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
         
         <div className="relative z-10 space-y-6 flex-1">
            <div className="flex items-center gap-4">
               <div className="w-14 h-14 bg-indigo-500 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-900/40">
                  <ShieldCheck className="w-8 h-8 text-white" />
               </div>
               <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Integridade Estrutural</h2>
                  <p className="text-indigo-200/60 text-sm font-medium">Diagnóstico profundo da saúde física e lógica das coleções.</p>
               </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
               <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-black text-white">420/434 Coleções OK</span>
               </div>
               <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black text-white">14 Problemas Estruturais</span>
               </div>
            </div>
         </div>

         <button className="relative z-10 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/40 flex items-center gap-3">
            <RefreshCw className="w-5 h-5" />
            Rodar Diagnóstico
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {checks.map((check, i) => (
           <motion.div
             key={i}
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ delay: i * 0.05 }}
             className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between h-full"
           >
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <div className={cn(
                       "w-10 h-10 rounded-xl flex items-center justify-center",
                       check.status === 'Healthy' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                    )}>
                       {check.status === 'Healthy' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <span className={cn(
                       "text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-lg",
                       check.status === 'Healthy' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                       {check.status}
                    </span>
                 </div>
                 <div className="space-y-1">
                    <h4 className="text-base font-black text-slate-900 tracking-tight">{check.name}</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{check.description}</p>
                 </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                 <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Ocorrências</span>
                    <span className="text-xl font-black text-slate-900 mt-1">{check.found}</span>
                 </div>
                 <button className="flex items-center gap-2 text-xs font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-tight group-hover:translate-x-1 transition-transform">
                    {check.found > 0 ? 'Resolver' : 'Validar'}
                    <ArrowRight className="w-4 h-4" />
                 </button>
              </div>
           </motion.div>
         ))}

         <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[28px] p-6 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-white hover:border-indigo-200 transition-all">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-indigo-600 shadow-sm transition-all mb-4">
               <Plus className="w-6 h-6" />
            </div>
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Adicionar Check Customizado</span>
         </div>
      </div>
    </div>
  );
}

const Plus = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
