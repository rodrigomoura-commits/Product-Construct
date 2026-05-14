import React from 'react';
import { 
  X, Database, Info, Layers, Key, Shield, Clock, 
  ArrowRight, Activity, Zap, AlertTriangle, FileText,
  Table as TableIcon, Hash, Type, Link2, Eye, Lock,
  CheckCircle2, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';

interface DatabaseTableDetailDrawerProps {
  path: string | null;
  onClose: () => void;
  blueprint: any;
}

export default function DatabaseTableDetailDrawer({ path, onClose, blueprint }: DatabaseTableDetailDrawerProps) {
  if (!path) return null;

  const firestorePaths = blueprint.firestore || {};
  const config = firestorePaths[path];
  const entities = blueprint.entities || {};
  const entityKey = typeof config?.schema === 'string' ? config.schema : (config?.schema?.$ref?.split('/').pop() || '');
  const entity = entities[entityKey];

  if (!config) return null;

  return (
    <AnimatePresence>
      {path && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl z-[70] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-8 bg-slate-900 text-white relative">
              <button 
                onClick={onClose}
                className="absolute top-8 right-8 p-2 hover:bg-white/10 rounded-xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-900/20">
                  <Database className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">{entityKey}</h2>
                  <code className="text-[10px] text-indigo-300 font-mono uppercase tracking-[0.2em]">{path}</code>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-1">Registros</span>
                    <span className="text-xl font-black">~1,240</span>
                 </div>
                 <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-1">Tamanho Total</span>
                    <span className="text-xl font-black">42.8 KB</span>
                 </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-8">
              {/* Summary Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <Info className="w-3 h-3" />
                  <span>Resumo Funcional</span>
                </div>
                <p className="text-sm font-medium text-slate-600 bg-slate-50 p-6 rounded-3xl leading-relaxed italic">
                   {config.description || "Tabela estrutural do sistema para armazenamento de dados relacionados ao módulo de " + entityKey + "."}
                </p>
              </section>

              {/* Columns Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                     <Layers className="w-3 h-3" />
                     <span>Colunas & Tipos</span>
                   </div>
                   <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {Object.keys(entity?.properties || {}).length} CAMPOS
                   </span>
                </div>

                <div className="space-y-2">
                  {Object.entries(entity?.properties || {}).map(([key, prop]: [string, any]) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 transition-all group">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                             <Type className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                             <span className="text-sm font-black text-slate-900 leading-none">{key}</span>
                             <span className="text-[10px] text-slate-400 font-mono mt-1">{prop.type || 'any'}{prop.format ? ` (${prop.format})` : ''}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-2">
                          {entity.required?.includes(key) && (
                            <div className="px-2 py-0.5 rounded bg-red-50 text-red-500 text-[8px] font-black uppercase tracking-wider">Required</div>
                          )}
                          <div className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                            prop.type === 'string' ? "bg-blue-50 text-blue-600" :
                            prop.type === 'number' || prop.type === 'integer' ? "bg-amber-50 text-amber-600" :
                            prop.type === 'boolean' ? "bg-purple-50 text-purple-600" : "bg-slate-100 text-slate-600"
                          )}>
                             {prop.type}
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* RLS Section */}
              <section className="space-y-4">
                 <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                   <Lock className="w-3 h-3" />
                   <span>Políticas de Segurança (RLS)</span>
                 </div>
                 <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 space-y-4">
                    <div className="flex items-center justify-between">
                       <span className="text-sm font-black text-emerald-900">RLS Habilitado</span>
                       <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="space-y-3">
                       <RLSPolicy description="Apenas usuários donos do recurso podem criar registros." action="CREATE" status="ACTIVE" />
                       <RLSPolicy description="Leitura permitida apenas para o owner do produto vinculado." action="READ" status="ACTIVE" />
                       <RLSPolicy description="Update restrito a campos específicos via Mindflow Context." action="UPDATE" status="ACTIVE" />
                    </div>
                 </div>
              </section>

              {/* Statistics Section */}
              <section className="space-y-4">
                 <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                   <Activity className="w-3 h-3" />
                   <span>Estatísticas & Performance</span>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Crescimento (7d)" value="+4.2%" trend="up" />
                    <StatCard label="Leituras (24h)" value="12.4k" trend="up" />
                    <StatCard label="Escritas (24h)" value="842" trend="down" />
                    <StatCard label="Latência Média" value="142ms" trend="up" />
                 </div>
              </section>
            </div>

            {/* Footer Ações */}
            <div className="p-8 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
               <button className="flex items-center gap-2 px-6 py-3 border border-slate-200 bg-white rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-600 hover:text-slate-900 transition-all">
                  <Download className="w-4 h-4" />
                  Exportar Estrutura
               </button>
               <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                  <Eye className="w-4 h-4" />
                  Ver Dados Reais
               </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function RLSPolicy({ description, action, status }: { description: string, action: string, status: string }) {
  return (
    <div className="p-3 bg-white/60 rounded-xl flex items-center justify-between gap-4">
       <div className="flex flex-col">
          <span className="text-[9px] font-black text-emerald-700 tracking-wider mb-0.5">{action}</span>
          <p className="text-[11px] font-medium text-emerald-900 leading-tight">{description}</p>
       </div>
       <div className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-600 text-[8px] font-black">{status}</div>
    </div>
  );
}

function StatCard({ label, value, trend }: { label: string, value: string, trend: 'up' | 'down' }) {
  return (
    <div className="p-4 bg-white border border-slate-100 rounded-2xl flex flex-col gap-1">
       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
       <div className="flex items-center justify-between">
          <span className="text-lg font-black text-slate-900">{value}</span>
          <Zap className={cn("w-4 h-4 opacity-20", trend === 'up' ? "text-emerald-500" : "text-amber-500")} />
       </div>
    </div>
  );
}
