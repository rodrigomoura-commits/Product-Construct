import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Save, 
  Settings2, 
  Bot, 
  Zap, 
  AlertCircle,
  Hash,
  PlayCircle,
  FileText,
  Clock,
  Trash2,
  ChevronRight,
  Info
} from 'lucide-react';
import { Agent, StageSpecialistBinding, ProductJourneyStage } from '../../../types';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { saveSpecialistBinding, removeSpecialistBinding } from '../../../lib/tona-architecture';
import { toast } from 'react-hot-toast';

interface BindingEditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bindingId?: string | null;
  agent?: Agent | null;
  stage?: ProductJourneyStage | null;
  onSuccess?: () => void;
}

export function BindingEditorDrawer({ 
  isOpen, 
  onClose, 
  bindingId, 
  agent, 
  stage,
  onSuccess 
}: BindingEditorDrawerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<StageSpecialistBinding>>({
    role: 'support',
    is_required: true,
    is_automatic: false,
    execution_order: 0,
    trigger_type: 'on_user_help',
    trigger_conditions: {},
    artifact_types: []
  });

  useEffect(() => {
    if (isOpen && bindingId) {
      loadBindingData();
    } else if (isOpen && !bindingId && agent && stage) {
      // New binding defaults
      setFormData({
        stage_id: stage.id,
        specialist_agent_id: agent.id,
        role: 'support',
        is_required: true,
        is_automatic: false,
        execution_order: 0,
        trigger_type: 'on_user_help',
        trigger_conditions: {},
        artifact_types: []
      });
    }
  }, [isOpen, bindingId, agent, stage]);

  async function loadBindingData() {
    if (!bindingId) return;
    setIsLoading(true);
    try {
      const snap = await getDoc(doc(db, 'stage_specialist_bindings', bindingId));
      if (snap.exists()) {
        setFormData(snap.data() as StageSpecialistBinding);
      }
    } catch (error) {
      console.error("Error loading binding:", error);
      toast.error("Não foi possível carregar as configurações do vínculo.");
    } finally {
      setIsLoading(false);
    }
  }

  const handleSave = async () => {
    if (!agent || !stage) return;
    
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        stage_id: stage.id,
        specialist_agent_id: agent.id,
        updated_at: serverTimestamp()
      };

      await saveSpecialistBinding(payload);
      toast.success("Vínculo atualizado com sucesso.");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error saving binding:", error);
      toast.error("Não foi possível salvar as configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlink = async () => {
    console.log("handleUnlink called with bindingId:", bindingId);
    if (!bindingId) {
      console.warn("No bindingId provided to handleUnlink");
      return;
    }
    
    if (!confirm("Tem certeza que deseja desvincular este agente desta etapa?")) return;

    setIsSaving(true);
    try {
      console.log("Executing removeSpecialistBinding for:", bindingId);
      await removeSpecialistBinding(bindingId);
      toast.success("Agente desvinculado com sucesso.");
      if (onSuccess) {
        console.log("Calling onSuccess callback");
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error("Error unlinking agent:", error);
      toast.error("Não foi possível desvincular o agente.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
                  <Settings2 size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Configurar Vínculo</h3>
                  <p className="text-xs text-gray-500">
                    {agent?.name} • {stage?.name}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                id="close-binding-drawer"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                </div>
              ) : (
                <>
                  {/* Role Selection */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <Bot size={16} className="text-violet-500" />
                      <h4>Papel e Responsabilidade</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'support', label: 'Suporte', desc: 'Auxilia na etapa' },
                        { id: 'primary', label: 'Primário', desc: 'Lidera a execução' },
                      ].map((role) => (
                        <button
                          key={role.id}
                          onClick={() => setFormData({ ...formData, role: role.id as any })}
                          className={`p-3 rounded-xl text-left border-2 transition-all ${
                            formData.role === role.id 
                            ? 'border-violet-600 bg-violet-50 ring-4 ring-violet-50' 
                            : 'border-gray-100 hover:border-gray-200 bg-white'
                          }`}
                          id={`role-${role.id}`}
                        >
                          <div className={`text-sm font-bold ${formData.role === role.id ? 'text-violet-700' : 'text-gray-900'}`}>
                            {role.label}
                          </div>
                          <div className="text-[10px] text-gray-500">{role.desc}</div>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Trigger Configuration */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <Zap size={16} className="text-amber-500" />
                      <h4>Gatilho de Ativação</h4>
                    </div>
                    <div className="space-y-3">
                      <select
                        value={formData.trigger_type}
                        onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                        id="trigger-type-select"
                      >
                        <option value="on_stage_start">Ao iniciar a etapa</option>
                        <option value="on_user_help">Quando o usuário pedir ajuda</option>
                        <option value="on_critical_gap">Ao identificar lacunas críticas</option>
                        <option value="on_weak_field">Em campos de baixa qualidade</option>
                        <option value="on_artifact_request">Para gerar artefatos específicos</option>
                      </select>
                      
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                        <Info size={14} className="text-amber-600 shrink-0" />
                        <p className="text-[10px] text-amber-700 leading-tight">
                          Este gatilho define quando o agente será sugerido ou ativado automaticamente pela Tona Orquestradora.
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Execution Logic */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <Clock size={16} className="text-blue-500" />
                      <h4>Lógica de Execução</h4>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium text-gray-900">Ativação Automática</div>
                          <div className="text-xs text-gray-500">Executa sem intervenção humana</div>
                        </div>
                        <button
                          onClick={() => setFormData({ ...formData, is_automatic: !formData.is_automatic })}
                          className={`w-12 h-6 rounded-full transition-colors relative ${formData.is_automatic ? 'bg-emerald-500' : 'bg-gray-200'}`}
                          id="toggle-automatic"
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.is_automatic ? 'right-1' : 'left-1'}`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium text-gray-900">Obrigatório para Avançar</div>
                          <div className="text-xs text-gray-500">Bloqueia a etapa até ser executado</div>
                        </div>
                        <button
                          onClick={() => setFormData({ ...formData, is_required: !formData.is_required })}
                          className={`w-12 h-6 rounded-full transition-colors relative ${formData.is_required ? 'bg-emerald-500' : 'bg-gray-200'}`}
                          id="toggle-required"
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.is_required ? 'right-1' : 'left-1'}`} />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Ordem de Prioridade</label>
                        <div className="flex items-center gap-4">
                          <input 
                            type="range" 
                            min="0" 
                            max="10" 
                            value={formData.execution_order || 0}
                            onChange={(e) => setFormData({ ...formData, execution_order: parseInt(e.target.value) })}
                            className="flex-1 accent-violet-600"
                            id="execution-order-range"
                          />
                          <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-700">
                            {formData.execution_order}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t bg-gray-50/50 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 p-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors border border-gray-200"
                  id="cancel-binding-save"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || isLoading}
                  className="flex-[2] p-3 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-violet-200"
                  id="save-binding-btn"
                >
                  {isSaving && !bindingId ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  Salvar Configurações
                </button>
              </div>

              {bindingId && (
                <button
                  onClick={handleUnlink}
                  disabled={isSaving || isLoading}
                  className="w-full p-3 rounded-xl border-2 border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-[0.98]"
                  id="unlink-agent-binding-action"
                >
                  {isSaving && bindingId ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Desvincular Agente desta Etapa
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
