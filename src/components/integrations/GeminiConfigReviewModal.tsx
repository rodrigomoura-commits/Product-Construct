import React, { useState, useEffect } from 'react';
import { 
  X, Shield, AlertCircle, CheckCircle2, Loader2,
  Copy, RefreshCw, ChevronDown, ChevronUp,
  Lock, Key, Bug, Globe, Activity, Bot, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface HealthData {
  provider: string;
  status: string;
  envKey: string;
  configuredModel?: string;
  technicalDetails?: {
    timestamp: string;
  }
}

interface GeminiConfig {
  defaultModel: string;
  displayName: string;
  engineMode: 'direct' | 'webhook';
  webhookUrl: string;
  source: 'database' | 'env' | 'fallback';
  keyExists: boolean;
  keyValid: boolean;
  keyErrorType?: "missing_key" | "placeholder_key" | "invalid_key_format";
  keySource: string;
  keyPreview: string | null;
  keyLength: number;
}

interface GeminiConfigReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdate: () => void;
}

export default function GeminiConfigReviewModal({ isOpen, onClose, onStatusUpdate }: GeminiConfigReviewModalProps) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; timestamp: string; warning?: string } | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  // New state for model management
  const [config, setConfig] = useState<GeminiConfig | null>(null);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [engineMode, setEngineMode] = useState<'direct' | 'webhook'>('direct');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingModel, setTestingModel] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [healthResult, configResult, modelsResult] = await Promise.allSettled([
        fetch('/api/integrations/gemini/health').then(r => r.json()),
        fetch('/api/admin/integrations/gemini/config').then(r => r.json()),
        fetch('/api/admin/integrations/gemini/models').then(r => r.json())
      ]);

      if (healthResult.status === "fulfilled") setHealth(healthResult.value);
      if (configResult.status === "fulfilled") {
        setConfig(configResult.value);
        setSelectedModel(configResult.value.defaultModel || "gemini-2.5-flash");
        setEngineMode(configResult.value.engineMode || "direct");
        setWebhookUrl(configResult.value.webhookUrl || "");
      }
      if (modelsResult.status === "fulfilled") {
        setAvailableModels(modelsResult.value.models || []);
      } else {
        setAvailableModels([
          { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
          { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro" },
          { id: "gemini-2.5-flash-lite", displayName: "Gemini 2.5 Flash Lite" }
        ]);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const handleTestSpecificModel = async () => {
    if (!selectedModel) return;
    setTestingModel(true);
    try {
      const res = await fetch('/api/admin/integrations/gemini/test-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel })
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message || data.error || "Resultado do teste.",
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      setTestResult({ success: false, message: "Erro de rede ao testar modelo.", timestamp: new Date().toISOString() });
    } finally {
      setTestingModel(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/admin/integrations/gemini/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          defaultModel: selectedModel,
          displayName: availableModels.find(m => m.id === selectedModel)?.displayName || selectedModel,
          engineMode,
          webhookUrl
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        onStatusUpdate();
      }
    } catch (err) {
      console.error("Failed to save config:", err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestTemporaryKey = async () => {
    if (!tempKey) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/integrations/gemini/test-temporary-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: tempKey })
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message,
        warning: data.warning,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      setTestResult({ success: false, message: "Erro de rede ao testar chave.", timestamp: new Date().toISOString() });
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col border border-slate-200"
        >
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                 <ShieldCheck className="text-white w-6 h-6" />
               </div>
               <div>
                 <h2 className="text-xl font-black text-slate-900 tracking-tight">Arquitetura Google Gemini</h2>
               </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-8 overflow-y-auto no-scrollbar flex-1 space-y-8">
            <section className="space-y-4">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <Bot className="w-3 h-3 text-indigo-500" /> Área 0: Modo do Motor de IA
               </h3>
               <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6 space-y-6">
                 <div className="flex p-1 bg-slate-200 rounded-2xl w-full max-w-sm">
                   <button 
                     onClick={() => setEngineMode('direct')}
                     className={cn(
                       "flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                       engineMode === 'direct' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                     )}
                   >
                     Direct API (Gemini)
                   </button>
                   <button 
                     onClick={() => setEngineMode('webhook')}
                     className={cn(
                       "flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                       engineMode === 'webhook' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                     )}
                   >
                     Webhook Sync
                   </button>
                 </div>

                 {engineMode === 'webhook' && (
                   <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">URL do Webhook</label>
                     <div className="relative group">
                       <input 
                         type="text"
                         value={webhookUrl}
                         onChange={(e) => setWebhookUrl(e.target.value)}
                         placeholder="https://api-astroflow.hotmart.com/v1/webhook/..."
                         className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                       />
                       <Globe className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-hover:text-indigo-400" />
                     </div>
                     <p className="text-[10px] text-slate-400 italic px-2">
                       Este modo enviará o contexto completo estruturado para o endpoint indicado.
                     </p>
                   </div>
                 )}

                 <div className="flex justify-end">
                    <button 
                      onClick={handleSaveConfig}
                      disabled={savingConfig}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {savingConfig ? <Loader2 className="w-3 h-3 animate-spin"/> : <CheckCircle2 className="w-3 h-3"/>}
                      Salvar Configuração de Engine
                    </button>
                 </div>
               </div>
            </section>

            <section className="space-y-4">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <Key className="w-3 h-3 text-indigo-500" /> Área 1: Chave de API
               </h3>
               <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6 space-y-6">
                 {/* Area 1 Content */}
                 {(() => {
                    const isKeyValid = config?.keyValid === true || health?.status === "connected";
                    return (
                        <div className="text-sm font-black text-slate-900">Status: {isKeyValid ? "Válida" : "Inválida/Placeholder"}</div>
                    );
                 })()}
               </div>
            </section>
          </div>

          <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
             <button 
               onClick={onClose}
               className="px-8 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
             >
               Fechar
             </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
