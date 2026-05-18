import React, { useState } from 'react';
import { 
  Table, Search, ArrowRight, Filter, Download, 
  ExternalLink, Layers, Database, Shield, Layout,
  MoreVertical, FileText, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../../lib/utils';
import DatabaseTableDetailDrawer from './DatabaseTableDetailDrawer';

interface DatabaseTablesTabProps {
  blueprint: any;
}

export default function DatabaseTablesTab({ blueprint }: DatabaseTablesTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [filterModule, setFilterModule] = useState('All');

  const entities = blueprint.entities || {};
  const firestorePaths = blueprint.firestore || {};

  const tables = Object.entries(firestorePaths).map(([path, config]: [string, any]) => {
    const entityKey = typeof config.schema === 'string' ? config.schema : (config.schema.$ref?.split('/').pop() || '');
    const entity = entities[entityKey];
    
    // Guess module based on path
    let module = 'Core';
    if (path.startsWith('mindflow')) module = 'Mindflow';
    else if (path.startsWith('products')) module = 'Produtos';
    else if (path.startsWith('agents')) module = 'Agent Studio';
    else if (path.startsWith('user_roles') || path.startsWith('profiles')) module = 'Usuários';
    else if (path.startsWith('memories')) module = 'Mindflow';

    return {
      path,
      name: entityKey || path.split('/').shift() || 'Unknown',
      description: config.description || entity?.description || 'Coleção de dados do sistema.',
      module,
      records: Math.floor(Math.random() * 5000) + 100, // Simulated
      size: (Math.random() * 50).toFixed(1) + ' KB', // Simulated
      hasRLS: true,
      hasIndexes: true,
      lastUpdate: '2026-05-12',
      schema: entity
    };
  });

  const filteredTables = tables.filter(t => 
    (t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.path.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterModule === 'All' || t.module === filterModule)
  );

  const modules = ['All', ...Array.from(new Set(tables.map(t => t.module)))];

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou caminho da tabela..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
            {modules.map(mod => (
              <button
                key={mod}
                onClick={() => setFilterModule(mod)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  filterModule === mod ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {mod}
              </button>
            ))}
          </div>
          <button className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-500">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tables Table/Grid */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Tabela / Coleção</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Descrição</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Registros</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Tamanho</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">RLS</th>
                <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredTables.map((table) => (
                <tr 
                  key={table.path} 
                  className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                  onClick={() => setSelectedTable(table.path)}
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                        <Database className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 tracking-tight">{table.name}</span>
                        <code className="text-[10px] text-slate-400 font-mono">{table.path}</code>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 max-w-xs">
                    <div className="flex flex-col gap-1.5">
                       <span className={cn(
                          "w-fit px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                          table.module === 'Mindflow' ? "bg-purple-50 text-purple-600" :
                          table.module === 'Produtos' ? "bg-blue-50 text-blue-600" :
                          table.module === 'Usuários' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                       )}>
                          {table.module}
                       </span>
                       <p className="text-xs text-slate-500 line-clamp-1 italic">{table.description}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="text-sm font-black text-slate-700">{table.records.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col items-start">
                       <span className="text-sm font-bold text-slate-700">{table.size}</span>
                       <div className="w-16 h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-slate-300 rounded-full" style={{ width: `${(parseFloat(table.size) / 50) * 100}%` }} />
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex justify-center">
                       <Shield className={cn("w-4 h-4", table.hasRLS ? "text-emerald-500" : "text-amber-500")} />
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-indigo-600 border border-transparent hover:border-indigo-100 shadow-sm">
                          <Download className="w-4 h-4" />
                       </button>
                       <button className="p-2 hover:bg-indigo-600 rounded-lg transition-all text-slate-400 hover:text-white border border-transparent shadow-sm">
                          <ArrowRight className="w-4 h-4" />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredTables.length === 0 && (
          <div className="p-20 flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Search className="w-8 h-8 text-slate-200" />
             </div>
             <h3 className="text-lg font-black text-slate-900 mb-1">Nenhuma tabela encontrada</h3>
             <p className="text-slate-500 text-sm max-w-xs font-medium">Ajuste os filtros ou o termo de busca para encontrar o que procura.</p>
          </div>
        )}

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Listando {filteredTables.length} coleções de sistema</p>
           <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Páginas: 1 de 1</span>
           </div>
        </div>
      </div>

      {/* Detail Drawer */}
      <DatabaseTableDetailDrawer 
        path={selectedTable} 
        onClose={() => setSelectedTable(null)} 
        blueprint={blueprint}
      />
    </div>
  );
}
