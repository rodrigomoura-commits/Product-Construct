import React from 'react';
import { 
  Share2, ArrowRight, Database, AlertCircle, 
  Layers, Package, Brain, Bot, Users, Shield, 
  HelpCircle, Link2, GitBranch
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';

interface DatabaseRelationshipsTabProps {
  blueprint: any;
}

export default function DatabaseRelationshipsTab({ blueprint }: DatabaseRelationshipsTabProps) {
  const firestorePaths = blueprint.firestore || {};

  // Group paths by module for visualization
  const modules = {
    'Core': [] as string[],
    'Produtos': [] as string[],
    'Agent Studio': [] as string[],
    'Mindflow': [] as string[],
    'Sistema': [] as string[]
  };

  Object.keys(firestorePaths).forEach(path => {
    if (path.startsWith('mindflow')) modules.Mindflow.push(path);
    else if (path.startsWith('products')) modules.Produtos.push(path);
    else if (path.startsWith('agents')) modules['Agent Studio'].push(path);
    else if (path.startsWith('profiles') || path.startsWith('user_roles')) modules.Core.push(path);
    else modules.Sistema.push(path);
  });

  const relationships = [
    { from: 'products', to: 'product_journey_stages', type: '1:N', module: 'Produtos' },
    { from: 'product_journey_stages', to: 'product_stage_fields', type: '1:N', module: 'Produtos' },
    { from: 'products', to: 'product_artifacts', type: '1:N', module: 'Produtos' },
    { from: 'mindflow_user_memories', to: 'mindflow_learnings', type: '1:N', module: 'Mindflow' },
    { from: 'mindflow_learnings', to: 'mindflow_reasonings', type: 'N:N', module: 'Mindflow' },
    { from: 'agents', to: 'agent_versions', type: '1:N', module: 'Agent Studio' },
    { from: 'profiles', to: 'user_roles', type: '1:1', module: 'Core' },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Visual Header */}
      <div className="bg-slate-900 rounded-[32px] p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full -mr-20 -mt-20" />
        <div className="relative z-10 space-y-4">
           <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-md">
                 <Share2 className="text-white w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Relações & Dependências</h2>
           </div>
           <p className="text-slate-400 text-sm max-w-lg leading-relaxed font-medium">
             A Tona utiliza um modelo híbrido. Embora o Firestore seja NoSQL, mantemos integridade referencial forte entre módulos para garantir a precisão do Mindflow.
           </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Module Dependency Summary */}
        <div className="lg:col-span-1 space-y-6">
           <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dependências por Módulo</div>
           <div className="space-y-3">
              {Object.entries(modules).map(([name, paths]) => (
                <div key={name} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between group">
                   <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                        name === 'Mindflow' ? "bg-purple-50 text-purple-600" :
                        name === 'Produtos' ? "bg-blue-50 text-blue-600" :
                        name === 'Agent Studio' ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400"
                      )}>
                         {name === 'Mindflow' ? <Brain className="w-4 h-4" /> : 
                          name === 'Produtos' ? <Package className="w-4 h-4" /> :
                          name === 'Agent Studio' ? <Bot className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                      </div>
                      <span className="text-sm font-bold text-slate-900 leading-none">{name}</span>
                   </div>
                   <span className="text-[10px] font-black text-slate-400">{paths.length} nodes</span>
                </div>
              ))}
           </div>

           <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 flex gap-4">
              <AlertCircle className="w-6 h-6 text-indigo-600 shrink-0" />
              <p className="text-[11px] text-indigo-900 font-medium leading-relaxed">
                 O Mindflow V2 introduziu <span className="font-black italic">Cognitive Links</span> que conectam memórias brutas a raciocínios estratégicos.
              </p>
           </div>
        </div>

        {/* Relationships List */}
        <div className="lg:col-span-3 space-y-6">
           <div className="flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grafo de Relacionamentos Técnicos</div>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">FK Direct</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cognitive Link</span>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {relationships.map((rel, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white p-6 rounded-3xl border border-slate-100 hover:border-indigo-200 transition-all shadow-sm group hover:shadow-lg hover:shadow-indigo-900/5"
                >
                   <div className="flex items-center justify-between mb-6">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                        rel.module === 'Mindflow' ? "bg-purple-50 text-purple-600" :
                        rel.module === 'Produtos' ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-400"
                      )}>
                         {rel.module}
                      </span>
                      <span className="text-[10px] font-black text-slate-400 font-mono">{rel.type}</span>
                   </div>
                   
                   <div className="flex items-center gap-3">
                      <div className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center group-hover:bg-indigo-50 transition-colors">
                         <span className="text-[11px] font-black text-slate-900 truncate block">{rel.from}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-all group-hover:translate-x-1" />
                      <div className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center group-hover:bg-indigo-50 transition-colors">
                         <span className="text-[11px] font-black text-slate-900 truncate block">{rel.to}</span>
                      </div>
                   </div>

                   <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                         <Shield className="w-3 h-3 text-emerald-500" />
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cascade Protect</span>
                      </div>
                      <button className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-tight">Ver Detalhes</button>
                   </div>
                </motion.div>
              ))}

              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center text-center opacity-60">
                 <Link2 className="w-8 h-8 text-slate-300 mb-2" />
                 <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Adicionar Relação Manual</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
