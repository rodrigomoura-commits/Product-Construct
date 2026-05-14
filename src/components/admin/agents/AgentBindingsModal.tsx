import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Layers, 
  ExternalLink, 
  ShieldCheck, 
  Zap, 
  HelpCircle,
  MapPin,
  Bot
} from 'lucide-react';

interface BindingInfo {
  stage_id: string;
  name?: string;
  role: string;
  binding_id?: string;
}

interface AgentBindingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  bindings: BindingInfo[];
}

export function AgentBindingsModal({ isOpen, onClose, agentName, bindings }: AgentBindingsModalProps) {
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
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Vínculos Ativos</h3>
                  <p className="text-xs text-gray-500">{agentName}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 max-h-[60vh]">
              {bindings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300 mx-auto mb-4">
                    <Bot size={32} />
                  </div>
                  <p className="text-gray-500 text-sm">Este agente não possui vínculos ativos no momento.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bindings.map((binding, idx) => (
                    <div 
                      key={idx} 
                      className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 flex items-center justify-between transition-all hover:border-violet-200 hover:bg-white group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          binding.role === 'primary' ? 'bg-indigo-100 text-indigo-600' : 'bg-violet-100 text-violet-600'
                        }`}>
                          {binding.role === 'primary' ? <ShieldCheck size={20} /> : <Zap size={20} />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900 group-hover:text-violet-700 transition-colors">
                            {binding.name || binding.stage_id}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                              binding.role === 'primary' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {binding.role === 'primary' ? 'Stage Agent' : 'Especialista'}
                            </span>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <MapPin size={10} />
                              ID: {binding.stage_id}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {binding.role !== 'primary' && (
                          <div className="p-2 text-gray-400 hover:text-violet-600 transition-colors opacity-0 group-hover:opacity-100 cursor-help" title="Configurável via menu do card">
                             <HelpCircle size={16} />
                          </div>
                        )}
                        <div className="p-2 text-gray-400 group-hover:text-violet-600">
                          <ExternalLink size={16} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={onClose}
                className="w-full p-4 rounded-2xl bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors shadow-sm"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
