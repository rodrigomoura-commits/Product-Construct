import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Plus, Loader2, ChevronRight, Check, Sparkles, FilePlus, Copy, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { createArtifact } from '../../lib/artifacts';
import { StageKey } from '../../types';
import { toast } from 'sonner';
import { ARTIFACT_CATALOG, getArtifactsByStage } from '../../lib/artifactCatalog';
import { cn } from '../../lib/utils';

interface CreateArtifactModalProps {
  productId: string;
  currentStage: StageKey;
  open: boolean;
  onClose: () => void;
  onCreated?: (artifactId: string) => void;
}

type WizardStep = 'stage' | 'type' | 'mode';

const STAGES_ORDER = [
  'understand_problem',
  'define_proposal',
  'visualize_solution',
  'plan_mvp',
  'prepare_delivery',
  'monitor_learn'
];

export default function CreateArtifactModal({ productId, currentStage, open, onClose, onCreated }: CreateArtifactModalProps) {
  const { user } = useAuth();
  
  // Find catalog stage matching the current framework stage
  const initialStageId = STAGES_ORDER.find(id => ARTIFACT_CATALOG[id].framework_key === currentStage) || STAGES_ORDER[0];
  
  const [step, setStep] = useState<WizardStep>('stage');
  const [selectedStageId, setSelectedStageId] = useState<string>(initialStageId);
  const [selectedArtifactType, setSelectedArtifactType] = useState<string>('');
  const [creationMode, setCreationMode] = useState<'blank' | 'tona_generated' | 'versioned'>('blank');
  
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  // Auto-select type when stage changes
  useEffect(() => {
    const stageArtifacts = getArtifactsByStage(selectedStageId);
    if (stageArtifacts.length > 0) {
      const core = stageArtifacts.find((a: any) => a.is_core) || stageArtifacts[0];
      setSelectedArtifactType(core.type);
      setTitle(core.title);
    }
  }, [selectedStageId]);

  const handleStageSelect = (stageId: string) => {
    setSelectedStageId(stageId);
    setStep('type');
  };

  const handleTypeSelect = (type: string, defaultTitle: string) => {
    setSelectedArtifactType(type);
    setTitle(defaultTitle);
    setStep('mode');
  };

  const handleSubmit = async () => {
    if (!user || !productId) return;
    if (!selectedStageId || !selectedArtifactType) return;
    if (!title.trim()) {
      toast.error('O título do artefato é obrigatório.');
      return;
    }

    setCreating(true);
    try {
      const artifactId = await createArtifact({
        productId,
        stageId: selectedStageId,
        type: selectedArtifactType,
        title: title.trim(),
        creationMode,
        userId: user.uid,
        userEmail: user.email || ''
      });
      
      toast.success('Artefato criado com sucesso!');
      if (onCreated) onCreated(artifactId);
      onClose();
      // Reset wizard
      setStep('stage');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar artefato.');
    } finally {
      setCreating(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'stage':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              {STAGES_ORDER.map((id) => (
                <button
                  key={id}
                  onClick={() => handleStageSelect(id)}
                  className={cn(
                    "flex items-center justify-between p-5 rounded-2xl border transition-all text-left group",
                    selectedStageId === id 
                      ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/10" 
                      : "bg-white border-slate-100 hover:border-slate-300"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-0.5">
                      {ARTIFACT_CATALOG[id].framework_key}
                    </span>
                    <span className={cn(
                      "font-black tracking-tight transition-colors truncate",
                      selectedStageId === id ? "text-indigo-900" : "text-slate-700"
                    )}>
                      {ARTIFACT_CATALOG[id].stage_name}
                    </span>
                  </div>
                  <ChevronRight className={cn(
                    "w-5 h-5 transition-transform group-hover:translate-x-1",
                    selectedStageId === id ? "text-indigo-600" : "text-slate-300"
                  )} />
                </button>
              ))}
            </div>
          </div>
        );

      case 'type':
        const stageArtifacts = getArtifactsByStage(selectedStageId);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {stageArtifacts.map((art: any) => (
                <button
                  key={art.type}
                  onClick={() => handleTypeSelect(art.type, art.title)}
                  className={cn(
                    "flex flex-col p-5 rounded-[24px] border transition-all text-left relative group",
                    selectedArtifactType === art.type
                      ? "bg-indigo-50 border-indigo-200 shadow-sm"
                      : "bg-white border-slate-100 hover:border-slate-300 shadow-sm"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-black tracking-tight uppercase text-sm",
                        selectedArtifactType === art.type ? "text-indigo-900" : "text-slate-900"
                      )}>
                        {art.title}
                      </span>
                      {art.priority === 'critical' && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[9px] font-black uppercase rounded-lg border border-rose-200">
                          Crítico
                        </span>
                      )}
                      {art.is_core && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-black uppercase rounded-lg border border-amber-100">
                          Core
                        </span>
                      )}
                      {(art.type === 'epic' || art.type === 'user_stories') && (
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[9px] font-black uppercase rounded-lg border border-indigo-200">
                          Jira
                        </span>
                      )}
                    </div>
                    {selectedArtifactType === art.type && (
                      <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {art.description}
                  </p>
                </button>
              ))}
            </div>
            <button 
              onClick={() => setStep('stage')}
              className="text-xs font-black uppercase text-slate-400 hover:text-slate-900 transition-colors tracking-widest flex items-center gap-2"
            >
              Voltar para Etapas
            </button>
          </div>
        );

      case 'mode':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Título do Artefato</label>
              <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Synthesis Brief v1"
                className="w-full px-5 py-5 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-lg"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Modo de Criação</label>
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => setCreationMode('blank')}
                  className={cn(
                    "flex items-center gap-4 p-5 rounded-2xl border transition-all text-left",
                    creationMode === 'blank' ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-100 hover:border-slate-200"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                    creationMode === 'blank' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                  )}>
                    <FilePlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 uppercase text-xs">Criar em Branco</h4>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">Inicie do zero com um template estruturado</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCreationMode('tona_generated')}
                  className={cn(
                    "flex items-center gap-4 p-5 rounded-2xl border transition-all text-left",
                    creationMode === 'tona_generated' ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-100 hover:border-slate-200"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                    creationMode === 'tona_generated' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                  )}>
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 uppercase text-xs">Gerar com a Tona</h4>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">IA gera o conteúdo baseada na memória do produto</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCreationMode('versioned')}
                  className={cn(
                    "flex items-center gap-4 p-5 rounded-2xl border transition-all text-left",
                    creationMode === 'versioned' ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-100 hover:border-slate-200"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                    creationMode === 'versioned' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                  )}>
                    <Copy className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 uppercase text-xs">Nova Versão</h4>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">Cria v2, v3 a partir de um artefato existente</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={() => setStep('type')}
                className="flex-1 px-6 py-5 bg-slate-100 text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Voltar
              </button>
              <button 
                type="button"
                onClick={handleSubmit}
                disabled={creating}
                className="flex-1 px-6 py-5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    <Check className="w-4 h-4" /> Finalizar e Criar
                  </>
                )}
              </button>
            </div>
          </div>
        );
    }
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
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200]"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[201] pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-2xl bg-white rounded-[48px] shadow-2xl shadow-black/20 pointer-events-auto overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-10 pb-0 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-indigo-50 rounded-[28px] flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                       <Plus className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">Novo Artefato</h2>
                      <div className="flex items-center gap-3 mt-2 font-black uppercase text-[10px] tracking-widest">
                         <span className={cn(step === 'stage' ? "text-indigo-600" : "text-slate-400")}>1. Etapa</span>
                         <span className="w-1 h-1 bg-slate-200 rounded-full" />
                         <span className={cn(step === 'type' ? "text-indigo-600" : "text-slate-400")}>2. Tipo</span>
                         <span className="w-1 h-1 bg-slate-200 rounded-full" />
                         <span className={cn(step === 'mode' ? "text-indigo-600" : "text-slate-400")}>3. Modo</span>
                      </div>
                    </div>
                 </div>
                 <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-2xl text-slate-300 hover:text-slate-900 transition-all border border-transparent hover:border-slate-100">
                    <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="p-10 overflow-y-auto custom-scrollbar">
                {renderStep()}
              </div>

              {selectedStageId && (
                <div className="px-10 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                      {ARTIFACT_CATALOG[selectedStageId].stage_name}
                    </div>
                    {selectedArtifactType && (
                      <div className="px-3 py-1.5 bg-indigo-50 rounded-xl border border-indigo-100 text-[10px] font-black uppercase text-indigo-600 tracking-widest">
                        {selectedArtifactType}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                     <AlertCircle className="w-4 h-4" />
                     <span className="text-[9px] font-black uppercase tracking-tight">Vincule sempre à etapa correta</span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
