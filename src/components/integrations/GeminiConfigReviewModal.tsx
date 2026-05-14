import React, { useState, useEffect } from 'react';
import { 
  X, Shield, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, 
  Copy, Trash2, RefreshCw, ChevronDown, ChevronUp, ExternalLink,
  Lock, Key, Bug, Globe, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface HealthData {
  provider: string;
  status: 'connected' | 'missing_key' | 'placeholder_key' | 'invalid_key' | 'model_not_found' | 'model_method_not_supported' | 'api_disabled' | 'network_error' | 'unknown_error';
  envKey: string;
  modelEnvKey?: string;
  configuredModel?: string;
  canReadEnv: boolean;
  canListModels: boolean;
  canCallGenerateContent: boolean;
  message: string;
  recommendedAction?: string;
  availableModels?: any[];
  technicalDetails?: {
    errorCode?: string;
    errorMessage?: string;
    timestamp: string;
    keyPreview?: string;
    prefixOk?: boolean;
    keyLength?: number;
    isPlaceholder?: boolean;
  }
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
  const [showKey, setShowKey] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; timestamp: string } | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/gemini/health');
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      console.error("Failed to fetch gemini health:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/integrations/gemini/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: tempKey || undefined })
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        onStatusUpdate();
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: "Erro de rede ao tentar conectar.",
        timestamp: new Date().toISOString()
      });
    } finally {
      setTesting(false);
    }
  };

  const handleRetestStatus = () => {
    fetchHealth();
    onStatusUpdate();
  };

  const handleCopyInstructions = () => {
    const instructions = `
Como configurar GEMINI_API_KEY:
1. Acesse https://aistudio.google.com/app/apikey
2. Crie uma nova API Key.
3. No Google AI Studio (ou seu painel de deploy), procure pela seção "Secrets" ou "Variáveis de Ambiente".
4. Adicione uma variável chamada GEMINI_API_KEY.
5. Cole o valor da chave (começando com AIza).
6. Reinicie a aplicação.
    `.trim();
    navigator.clipboard.writeText(instructions);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col border border-slate-200"
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                 <Shield className="text-white w-6 h-6" />
               </div>
               <div>
                 <h2 className="text-xl font-black text-slate-900 tracking-tight">Revisar configuração do Google Gemini</h2>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Diagnóstico e Autenticação</p>
               </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-8 overflow-y-auto no-scrollbar flex-1 space-y-8">
            
            {/* 1. Resumo do Problema */}
            <section>
              <div className={cn(
                "p-6 rounded-[2rem] border transition-all",
                health?.status === 'connected' ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
              )}>
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    health?.status === 'connected' ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                  )}>
                    {health?.status === 'connected' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className={cn(
                      "font-black text-lg",
                      health?.status === 'connected' ? "text-emerald-900" : "text-red-900"
                    )}>
                      {loading ? "Verificando..." : health?.message || "Erro de diagnóstico"}
                    </h3>
                    <p className={cn(
                      "text-sm font-medium mt-1 leading-relaxed",
                      health?.status === 'connected' ? "text-emerald-700/80" : "text-red-700/80"
                    )}>
                      {health?.recommendedAction || (health?.status === 'connected' 
                        ? "Sua integração está saudável. Os agentes e a memória generativa podem processar informações normalmente."
                        : "Não encontramos uma GEMINI_API_KEY válida no ambiente atual."
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Checklist de Configuração */}
            <section className="space-y-4">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <Activity className="w-3 h-3" /> Checklist de Configuração
               </h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {[
                   { label: "Variável GEMINI_API_KEY existe?", status: health?.canReadEnv ? 'success' : 'error' },
                   { label: "A chave não está vazia?", status: (health?.technicalDetails?.keyLength ?? 0) > 0 ? 'success' : 'error' },
                   { label: "A chave não é placeholder?", status: health?.status === 'placeholder_key' ? 'error' : (health?.canReadEnv ? 'success' : 'pending') },
                   { label: "Serviço Google respondeu?", status: health?.canListModels ? 'success' : (health?.status === 'network_error' || health?.status === 'invalid_key' ? 'error' : 'pending') },
                   { label: "Modelo configurado existe?", status: health?.status === 'model_not_found' ? 'error' : (health?.canListModels ? 'success' : 'pending') },
                   { label: "Modelo suporta generateContent?", status: health?.status === 'model_method_not_supported' ? 'error' : (health?.canListModels && health?.status !== 'model_not_found' ? 'success' : 'pending') },
                   { label: "Conexão validada?", status: health?.status === 'connected' ? 'success' : (health?.canCallGenerateContent ? 'success' : 'pending') },
                 ].map((item, idx) => (
                   <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm">
                     <span className="text-xs font-bold text-slate-600">{item.label}</span>
                     {loading ? (
                       <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
                     ) : item.status === 'success' ? (
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                     ) : item.status === 'error' ? (
                       <AlertCircle className="w-4 h-4 text-red-500" />
                     ) : (
                       <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-slate-400 animate-spin" />
                     )}
                   </div>
                 ))}
               </div>
            </section>

            {/* 3. Campo de Chave */}
            <section className="space-y-4">
               <div className="flex items-center justify-between">
                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <Key className="w-3 h-3" /> Revisar chave de API
                 </h3>
                 <a 
                   href="https://aistudio.google.com/app/apikey" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:underline underline-offset-4"
                 >
                   Obter Chave <ExternalLink className="w-2.5 h-2.5" />
                 </a>
               </div>

               <div className="space-y-3">
                 <div className="relative group">
                   <input 
                     type={showKey ? "text" : "password"}
                     value={tempKey}
                     onChange={(e) => setTempKey(e.target.value)}
                     placeholder={health?.technicalDetails?.keyPreview ? `Atual: ${health?.technicalDetails?.keyPreview}` : "Cole sua chave do Google AI Studio aqui"}
                     className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-mono text-slate-900 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 focus:outline-none transition-all pr-32"
                   />
                   <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                     <button 
                       onClick={() => setShowKey(!showKey)}
                       className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-900 rounded-xl transition-all"
                       title={showKey ? "Ocultar" : "Mostrar"}
                     >
                       {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                     </button>
                     <button 
                       onClick={() => setTempKey('')}
                       className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-all"
                       title="Limpar"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                 </div>
                 
                 <div className="flex items-center gap-2">
                   <button 
                     onClick={() => navigator.clipboard.writeText(health?.envKey || 'GEMINI_API_KEY')}
                     className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                   >
                     <Copy className="w-3 h-3" /> Copiar nome da variável
                   </button>
                   <p className="text-[10px] font-bold text-slate-400 italic">
                     <Lock className="inline w-2.5 h-2.5 mr-1" /> Chaves inseridas aqui são usadas apenas para o teste temporário.
                   </p>
                 </div>
               </div>

               {testResult && (
                 <motion.div 
                   initial={{ opacity: 0, height: 0 }}
                   animate={{ opacity: 1, height: 'auto' }}
                   className={cn(
                     "p-4 rounded-2xl border text-sm font-bold flex items-center gap-3 shadow-sm",
                     testResult.success ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"
                   )}
                 >
                   {testResult.success ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                   {testResult.message}
                 </motion.div>
               )}
            </section>

            {/* 5. Logs Técnicos */}
            <section className="bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-800 shadow-xl">
               <button 
                 onClick={() => setDetailsExpanded(!detailsExpanded)}
                 className="w-full flex items-center justify-between px-6 py-4 text-slate-400 hover:bg-slate-800 transition-all group"
               >
                 <div className="flex items-center gap-3">
                   <Bug className="text-indigo-400 w-4 h-4" />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em]">Detalhes Técnicos</span>
                 </div>
                 {detailsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
               </button>
               
               <AnimatePresence>
                 {detailsExpanded && (
                   <motion.div 
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: 'auto', opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     className="px-6 pb-6"
                   >
                     <div className="bg-black/40 rounded-2xl p-4 font-mono text-[11px] space-y-2 text-indigo-100 overflow-x-auto whitespace-nowrap lg:whitespace-normal custom-scrollbar">
                       <div className="flex gap-4">
                         <span className="text-indigo-500/60 font-bold min-w-[100px]">PROVIDER:</span>
                         <span>{health?.provider || 'N/A'}</span>
                       </div>
                       <div className="flex gap-4">
                         <span className="text-indigo-500/60 font-bold min-w-[100px]">STATUS:</span>
                         <span className={cn(
                           "font-black uppercase",
                           health?.status === 'connected' ? "text-emerald-400" : "text-red-400"
                         )}>{health?.status || 'N/A'}</span>
                       </div>
                       <div className="flex gap-4">
                         <span className="text-indigo-500/60 font-bold min-w-[100px]">VAR_ENV:</span>
                         <span>{health?.envKey || 'N/A'}</span>
                       </div>
                       <div className="flex gap-4">
                         <span className="text-indigo-500/60 font-bold min-w-[100px]">MODEL_VAR:</span>
                         <span>{health?.modelEnvKey || 'GEMINI_MODEL'}</span>
                       </div>
                       <div className="flex gap-4">
                         <span className="text-indigo-500/60 font-bold min-w-[100px]">CONFIGURED_MODEL:</span>
                         <span className="text-amber-400 font-bold">{health?.configuredModel || 'N/A'}</span>
                       </div>
                       <div className="flex gap-4">
                         <span className="text-indigo-500/60 font-bold min-w-[100px]">TIMESTAMP:</span>
                         <span className="text-slate-400">{health?.technicalDetails?.timestamp || 'N/A'}</span>
                       </div>
                       <div className="flex gap-4">
                         <span className="text-indigo-500/60 font-bold min-w-[100px]">ERROR_CODE:</span>
                         <span className="text-red-300 font-bold">{health?.technicalDetails?.errorCode || 'NONE'}</span>
                       </div>
                       <div className="flex gap-4">
                         <span className="text-indigo-500/60 font-bold min-w-[100px]">CAN_READ:</span>
                         <span>{health?.canReadEnv ? 'TRUE' : 'FALSE'}</span>
                       </div>
                       <div className="flex gap-4">
                         <span className="text-indigo-500/60 font-bold min-w-[100px]">ENVIRONMENT:</span>
                         <span>{window.location.hostname}</span>
                       </div>
                       {health?.technicalDetails?.errorMessage && (
                         <div className="mt-3 pt-3 border-t border-slate-800 text-red-300/80">
                           <p className="font-bold mb-1 text-slate-500 uppercase text-[9px] tracking-widest">System Message:</p>
                           <p className="italic leading-relaxed">{health.technicalDetails.errorMessage}</p>
                         </div>
                       )}
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
            </section>
          </div>

          {/* Footer Footer */}
          <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
             <div className="flex gap-2">
               <button 
                 onClick={handleCopyInstructions}
                 className="px-4 py-2 text-slate-500 hover:text-slate-900 font-bold text-xs transition-all flex items-center gap-2"
               >
                 <Copy className="w-4 h-4" /> Instruções
               </button>
             </div>
             <div className="flex gap-3">
               <button 
                 onClick={handleRetestStatus}
                 disabled={loading}
                 className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm"
               >
                 <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Retestar status
               </button>
               <button 
                 onClick={handleTestConnection}
                 disabled={testing || (tempKey.length < 5 && !health?.canReadEnv)}
                 className="px-8 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 min-w-[160px] justify-center"
               >
                 {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                 Testar conexão
               </button>
             </div>
          </div>

          {/* Persistent Hint for Non-Runtime Editable envs */}
          <div className="bg-amber-50 px-8 py-2 border-t border-amber-100 flex items-center gap-3">
             <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
             <p className="text-[10px] font-medium text-amber-700 italic">
               Esta aplicação não consegue alterar variáveis de ambiente em runtime. Configure GEMINI_API_KEY no painel do deploy e reinicie a aplicação.
             </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
