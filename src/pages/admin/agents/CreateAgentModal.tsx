import React, { useState } from 'react';
import { Bot, X, Save, AlertCircle, Info, Sparkles, Brain, Zap, Target, FileText, Workflow, Loader2 } from 'lucide-react';
import { db, auth } from '../../../lib/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { Agent, StageKey } from '../../../types';
import { GEMINI_MODEL, GEMINI_MODELS } from '../../../config/ai';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AGENT_TYPES = [
  { value: 'orchestrator', label: 'Orquestrador (Central)' },
  { value: 'stage_agent', label: 'Stage Agent (Modo de Etapa)' },
  { value: 'specialist', label: 'Especialista (Capacidade)' },
  { value: 'behavioral', label: 'Comportamental (Perfil)' },
  { value: 'custom', label: 'Customizado' },
];

const DISCIPLINES = [
  'Product Management',
  'Design',
  'Engenharia',
  'Product Marketing',
  'Data',
  'Liderança',
  'Multidisciplinar'
];

const STAGES: { id: StageKey | 'global'; label: string }[] = [
  { id: 'global', label: 'Global (Orquestrador)' },
  { id: 'sense', label: '1. Entender o Problema' },
  { id: 'shape', label: '2. Definir a Proposta' },
  { id: 'sketch', label: '3. Visualizar a Solução' },
  { id: 'scope', label: '4. Planejar o MVP' },
  { id: 'ship', label: '5. Preparar a Entrega' },
  { id: 'sense_plus', label: '6. Acompanhar e Aprender' },
];

export default function CreateAgentModal({ isOpen, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    type: 'discovery',
    primary_discipline: 'Product Management',
    primary_stage_id: 'sense' as StageKey | 'global',
    status: 'draft' as const,
    default_model: GEMINI_MODEL,
    temperature: 0.4,
    mindflow_enabled: true,
    initial_instruction: '',
    output_type: 'analysis',
    save_target_type: 'field',
    save_target_key: ''
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.currentUser) return;
    setLoading(true);

    try {
      const agentId = doc(collection(db, 'agents')).id;
      const agentData: Partial<Agent> = {
        name: formData.name,
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-'),
        description: formData.description,
        type: formData.type as any,
        primary_discipline: formData.primary_discipline as any,
        primary_stage_id: formData.primary_stage_id,
        status: formData.status,
        default_model: formData.default_model,
        temperature: formData.temperature,
        mindflow_enabled: formData.mindflow_enabled,
        output_type: formData.output_type,
        save_target: {
          type: formData.save_target_type as any,
          key: formData.save_target_key
        },
        created_by: auth.currentUser.uid,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      await setDoc(doc(db, 'agents', agentId), agentData);

      // Create initial instruction version
      const versionId = doc(collection(db, 'agent_instruction_versions')).id;
      const emptyBlocks = {
        identity: `Você é o ${formData.name}.`,
        objective: formData.description,
        when_to_use: `Utilize este agente quando estiver na etapa de ${formData.primary_stage_id}.`,
        when_not_to_use: "Não utilize fora do escopo de sua disciplina primária.",
        expected_inputs: "{{product.name}}, {{product.description}}, {{stage.fields}}, {{conversation.history}}",
        mandatory_tasks: formData.initial_instruction || "Analisar contexto e gerar output estruturado.",
        reasoning_method: "Pense passo a passo.",
        questions_to_ask: "",
        quality_criteria: "",
        guardrails: "",
        output_format: formData.output_type,
        save_behavior: `Salvar em ${formData.save_target_key}`,
        gap_handling: "",
        classification_rules: "",
        good_examples: "",
        bad_examples: ""
      };

      await setDoc(doc(db, 'agent_instruction_versions', versionId), {
        id: versionId,
        agent_id: agentId,
        version_number: 'v0.1',
        status: 'draft',
        instruction_blocks: emptyBlocks,
        compiled_prompt: `IDENTIDADE: ${emptyBlocks.identity}\nOBJETIVO: ${emptyBlocks.objective}`,
        is_active: false,
        created_at: serverTimestamp(),
        created_by: auth.currentUser.uid,
        change_summary: 'Criação inicial do agente'
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert('Erro ao criar agente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 sm:p-24 bg-zinc-900/60 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-zinc-50 w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20"
          >
            {/* Header */}
            <div className="p-8 bg-white border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
                  <Bot className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-zinc-900 tracking-tighter">Criar Novo Agente</h3>
                  <p className="text-zinc-500 font-medium italic">Configure o DNA de inteligência do seu novo agente da Tona.</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center bg-zinc-50 rounded-2xl text-zinc-400 hover:text-zinc-900 transition-all active:scale-90"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto no-scrollbar p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Left Column: Basic Info */}
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                      <Info className="w-3 h-3" /> Identidade & Básico
                    </h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Nome do Agente *</label>
                        <input 
                          required
                          type="text" 
                          placeholder="Ex: Refinador de Problemas"
                          className="w-full px-5 py-3.5 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all font-medium text-sm"
                          value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Slug (Identificador Único) *</label>
                        <input 
                          required
                          type="text" 
                          placeholder="ex-refinador-problemas"
                          className="w-full px-5 py-3.5 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all font-medium text-sm font-mono text-xs"
                          value={formData.slug}
                          onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Descrição Curta *</label>
                        <textarea 
                          required
                          rows={2}
                          placeholder="O que este agente faz em poucas palavras?"
                          className="w-full px-5 py-3.5 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all font-medium text-sm"
                          value={formData.description}
                          onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Tipo de Agente</label>
                      <select 
                        className="w-full px-5 py-3.5 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all text-sm font-bold"
                        value={formData.type}
                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                      >
                        {AGENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Disciplina</label>
                      <select 
                        className="w-full px-5 py-3.5 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all text-sm font-bold"
                        value={formData.primary_discipline}
                        onChange={e => setFormData({ ...formData, primary_discipline: e.target.value })}
                      >
                        {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                       <Workflow className="w-3 h-3" /> Localização no Fluxo
                    </h4>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Etapa Principal *</label>
                      <select 
                        required
                        className="w-full px-5 py-3.5 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all text-sm font-bold"
                        value={formData.primary_stage_id}
                        onChange={e => setFormData({ ...formData, primary_stage_id: e.target.value as any })}
                      >
                        {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Right Column: Execution & Logic */}
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                      <Zap className="w-3 h-3" /> Execução & Inteligência
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Modelo GenAI</label>
                        <select 
                          className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all text-xs font-bold"
                          value={formData.default_model}
                          onChange={e => setFormData({ ...formData, default_model: e.target.value })}
                        >
                          {GEMINI_MODELS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Temperatura: {formData.temperature}</label>
                        <input 
                          type="range" 
                          min="0" max="1" step="0.1"
                          className="w-full accent-zinc-900 mt-2"
                          value={formData.temperature}
                          onChange={e => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-[2rem] flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                             <Brain className="w-6 h-6" />
                          </div>
                          <div>
                             <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Mindflow Ativado</p>
                             <p className="text-[9px] text-indigo-500 font-medium leading-none">O agente terá acesso à memória neural.</p>
                          </div>
                       </div>
                       <button 
                         type="button"
                         onClick={() => setFormData({ ...formData, mindflow_enabled: !formData.mindflow_enabled })}
                         className={cn(
                           "w-12 h-6 rounded-full transition-all relative border",
                           formData.mindflow_enabled ? "bg-indigo-600 border-indigo-700" : "bg-zinc-200 border-zinc-300"
                         )}
                       >
                         <div className={cn(
                           "w-4 h-4 bg-white rounded-full absolute top-1/2 -translate-y-1/2 transition-all shadow-sm",
                           formData.mindflow_enabled ? "right-1" : "left-1"
                         )} />
                       </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                       <Target className="w-3 h-3" /> Output & Destino
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Tipo de Output</label>
                          <input 
                            placeholder="Ex: refinement"
                            className="w-full px-5 py-3.5 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all text-sm font-bold"
                            value={formData.output_type}
                            onChange={e => setFormData({ ...formData, output_type: e.target.value })}
                          />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Key de Salvamento</label>
                          <input 
                            placeholder="Ex: stage_field_key"
                            className="w-full px-5 py-3.5 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all text-sm font-bold"
                            value={formData.save_target_key}
                            onChange={e => setFormData({ ...formData, save_target_key: e.target.value })}
                          />
                       </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                       <FileText className="w-3 h-3" /> Instrução Inicial (DNA)
                    </h4>
                    <textarea 
                      rows={4}
                      placeholder="Quais as tarefas obrigatórias deste agente?"
                      className="w-full px-5 py-3.5 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all font-medium text-sm"
                      value={formData.initial_instruction}
                      onChange={e => setFormData({ ...formData, initial_instruction: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="mt-12 flex gap-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all active:scale-95 border border-zinc-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-[2] py-4 bg-zinc-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" /> Criar e Ativar Agente
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
