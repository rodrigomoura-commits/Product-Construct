import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, 
  Trash2, 
  X, 
  Info,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface DeleteAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  agentName: string;
  isDeleting: boolean;
}

export function DeleteAgentModal({ isOpen, onClose, onConfirm, agentName, isDeleting }: DeleteAgentModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-8 text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Arquivar Agente?</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Você está prestes a arquivar <span className="font-semibold text-gray-800">"{agentName}"</span>. 
                Ele não aparecerá mais como opção para novas etapas, mas dados históricos serão mantidos.
              </p>
              
              <div className="flex gap-3 mt-8">
                <button
                  onClick={onClose}
                  className="flex-1 p-3.5 rounded-2xl text-sm font-semibold text-gray-700 hover:bg-gray-50 border border-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isDeleting}
                  className="flex-1 p-3.5 rounded-2xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-200"
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Sim, Arquivar"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface DeleteBlockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  reason: string;
  bindings: any[];
  onOpenBindings?: () => void;
}

export function DeleteBlockedModal({ isOpen, onClose, agentName, reason, bindings, onOpenBindings }: DeleteBlockedModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 mb-6">
                <ShieldAlert size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Ação Bloqueada</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Não é possível arquivar <span className="font-semibold text-gray-800">"{agentName}"</span> pois ele possui vínculos ativos na Tona.
              </p>

              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
                    <Info size={12} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">Motivo do Bloqueio</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">{reason}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <button
                  onClick={onOpenBindings}
                  className="w-full p-4 rounded-2xl bg-violet-50 text-violet-700 text-sm font-semibold hover:bg-violet-100 transition-colors flex items-center justify-between"
                >
                  Ver Vínculos Ativos
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={onClose}
                  className="w-full p-4 rounded-2xl text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
