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
    if (!selectedModel) return;
    setSavingConfig(true);
    try {
      const res = await fetch('/api/admin/integrations/gemini/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          defaultModel: selectedModel,
          displayName: availableModels.find(m => m.id === selectedModel)?.displayName || selectedModel
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
