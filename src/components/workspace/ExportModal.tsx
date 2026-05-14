import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Download, Package, Layers, Files, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  activeStageName: string;
}

export default function ExportModal({ open, onClose, productId, activeStageName }: ExportModalProps) {
  const handleExport = (type: string) => {
    toast.success(`Iniciando exportação: ${type}. Em uma aplicação real, isso geraria um PDF/Markdown.`);
    // onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200]"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[201] pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-lg bg-white rounded-[40px] shadow-2xl shadow-slate-900/10 pointer-events-auto overflow-hidden"
            >
              <div className="p-8 pb-0 flex items-center justify-between">
                 <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                    <Download className="w-6 h-6" />
                 </div>
                 <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all">
                    <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">Exportar Produto</h2>
                  <p className="text-slate-400 text-sm font-medium italic mt-2">Escolha o formato e escopo da exportação.</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => handleExport("Pacote de Entrega")}
                    className="flex items-center gap-4 p-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                      <Package className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-black text-indigo-900 uppercase text-xs">Pacote de Entrega (Jira Ready)</h4>
                      <p className="text-[10px] text-indigo-600 font-medium uppercase tracking-tight">Epic + User Stories + Critérios de Aceite</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-indigo-300 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button
                    onClick={() => handleExport(`Artefatos da Etapa: ${activeStageName}`)}
                    className="flex items-center gap-4 p-5 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-black text-slate-900 uppercase text-xs">Artefatos da Etapa</h4>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{activeStageName}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button
                    onClick={() => handleExport("Todos os Artefatos")}
                    className="flex items-center gap-4 p-5 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                      <Files className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-black text-slate-900 uppercase text-xs">Dossiê Completo</h4>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">Todos os artefatos de todas as etapas</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button
                    onClick={() => handleExport("Somente Conteúdo Atual")}
                    className="flex items-center gap-4 p-5 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-black text-slate-900 uppercase text-xs">Documento Atual</h4>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">Exportar o que está aberto no momento</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Formato de Saída</span>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-slate-600 uppercase">PDF</span>
                  <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-slate-600 uppercase">Markdown</span>
                  <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[9px] font-black text-slate-600 uppercase border border-indigo-600 shadow-sm shadow-indigo-100">Jira Script</span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
