import React, { useState, useEffect } from 'react';
import { 
  Database, Table, Share2, HardDrive, ShieldCheck, Lock, 
  Search, FileCode, History, Activity, AlertTriangle, 
  CheckCircle2, Info, ArrowRight, Download, RefreshCw,
  Layers, UserCheck, Key, Zap, ListTree
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import blueprintData from '../../../firebase-blueprint.json';

// Sub-components for Tabs
import DatabaseOverviewTab from '../../components/admin/database/DatabaseOverviewTab';
import DatabaseTablesTab from '../../components/admin/database/DatabaseTablesTab';
import DatabaseRelationshipsTab from '../../components/admin/database/DatabaseRelationshipsTab';
import DatabaseStorageTab from '../../components/admin/database/DatabaseStorageTab';
import DatabaseAccessTab from '../../components/admin/database/DatabaseAccessTab';
import DatabaseRLSTab from '../../components/admin/database/DatabaseRLSTab';
import DatabasePerformanceTab from '../../components/admin/database/DatabasePerformanceTab';
import DatabaseMigrationsTab from '../../components/admin/database/DatabaseMigrationsTab';
import DatabaseBackupsTab from '../../components/admin/database/DatabaseBackupsTab';
import DatabaseLogsTab from '../../components/admin/database/DatabaseLogsTab';
import DatabaseDataAuditTab from '../../components/admin/database/DatabaseDataAuditTab';
import DatabaseIntegrityTab from '../../components/admin/database/DatabaseIntegrityTab';
import DatabaseSettingsTab from '../../components/admin/database/DatabaseSettingsTab';

const TABS = [
  { id: 'overview', label: 'Visão Geral', icon: Activity },
  { id: 'tables', label: 'Tabelas', icon: Table },
  { id: 'relationships', label: 'Relacionamentos', icon: Share2 },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'access', label: 'Acessos e Permissões', icon: Lock },
  { id: 'rls', label: 'Políticas RLS', icon: ShieldCheck },
  { id: 'performance', label: 'Queries e Performance', icon: Zap },
  { id: 'migrations', label: 'Migrations', icon: ListTree },
  { id: 'backups', label: 'Backups', icon: Download },
  { id: 'logs', label: 'Logs', icon: History },
  { id: 'audit', label: 'Auditoria de Dados', icon: Search },
  { id: 'integrity', label: 'Integridade', icon: CheckCircle2 },
  { id: 'settings', label: 'Configurações Técnicas', icon: FileCode },
];

export default function DatabaseSection() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showHelp, setShowHelp] = useState(false);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview': return <DatabaseOverviewTab />;
      case 'tables': return <DatabaseTablesTab blueprint={blueprintData} />;
      case 'relationships': return <DatabaseRelationshipsTab blueprint={blueprintData} />;
      case 'storage': return <DatabaseStorageTab />;
      case 'access': return <DatabaseAccessTab />;
      case 'rls': return <DatabaseRLSTab />;
      case 'performance': return <DatabasePerformanceTab />;
      case 'migrations': return <DatabaseMigrationsTab />;
      case 'backups': return <DatabaseBackupsTab />;
      case 'logs': return <DatabaseLogsTab />;
      case 'audit': return <DatabaseDataAuditTab />;
      case 'integrity': return <DatabaseIntegrityTab />;
      case 'settings': return <DatabaseSettingsTab />;
      default: return <DatabaseOverviewTab />;
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Database className="text-white w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Banco de Dados</h1>
              <p className="text-slate-500 font-medium">Monitore tabelas, armazenamento, permissões, relações, backups e saúde do banco da Tona.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowHelp(true)}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
          >
            <Info className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
            <RefreshCw className="w-4 h-4" />
            Recarregar Dados
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-slate-200 -mx-8 px-8 gap-8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 py-4 border-b-2 transition-all whitespace-nowrap px-1",
              activeTab === tab.id
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-400 font-medium hover:text-slate-600"
            )}
          >
            <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-indigo-600" : "text-slate-400")} />
            <span className="text-sm tracking-tight">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {renderActiveTab()}
        </motion.div>
      </AnimatePresence>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-24">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHelp(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl shadow-indigo-900/20 overflow-hidden border border-slate-100"
            >
              <div className="p-8 sm:p-12 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                      <Database className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Como usar o módulo Banco de Dados</h2>
                      <p className="text-slate-500 font-medium mt-1">Visão técnica do ecossistema de dados da Tona.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowHelp(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-900"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <Activity className="w-4 h-4 text-indigo-600" />
                      </div>
                      <p className="text-xs text-slate-600">
                        <span className="font-bold text-slate-900 block mb-1 uppercase tracking-wider text-[9px] text-indigo-600">Visão Geral</span>
                        Monitoramento da saúde técnica e estatísticas do banco.
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <Table className="w-4 h-4 text-indigo-600" />
                      </div>
                      <p className="text-xs text-slate-600">
                        <span className="font-bold text-slate-900 block mb-1 uppercase tracking-wider text-[9px] text-indigo-600">Tabelas</span>
                        Gestão de coleções e documentos (Firestore).
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      </div>
                      <p className="text-xs text-slate-600">
                        <span className="font-bold text-slate-900 block mb-1 uppercase tracking-wider text-[9px] text-indigo-600">Políticas RLS</span>
                        Governança de acesso e regras de segurança.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <HardDrive className="w-4 h-4 text-indigo-600" />
                      </div>
                      <p className="text-xs text-slate-600">
                        <span className="font-bold text-slate-900 block mb-1 uppercase tracking-wider text-[9px] text-indigo-600">Storage</span>
                        Monitoramento de arquivos e buckets.
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <Search className="w-4 h-4 text-indigo-600" />
                      </div>
                      <p className="text-xs text-slate-600">
                        <span className="font-bold text-slate-900 block mb-1 uppercase tracking-wider text-[9px] text-indigo-600">Audit & Integrity</span>
                        Identificação de órfãos e falhas estruturais.
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <History className="w-4 h-4 text-indigo-600" />
                      </div>
                      <p className="text-xs text-slate-600">
                        <span className="font-bold text-slate-900 block mb-1 uppercase tracking-wider text-[9px] text-indigo-600">Logs & Performance</span>
                        Rastreabilidade técnica e tunagem de queries.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-900 font-medium leading-relaxed">
                    Ações destrutivas são bloqueadas ou exigem confirmação textual direta por padrão para proteger os dados da Tona em produção.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const X = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
