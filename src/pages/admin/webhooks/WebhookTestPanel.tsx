import React, { useState, useEffect } from 'react';
import { 
  X, Play, Loader2, CheckCircle2, AlertCircle, Copy, RefreshCw, 
  Code, Info, Terminal, Globe, Clock, Shield, Database, Layout, 
  MessageSquare, History, FileJson, ZoomIn, Search, HelpCircle,
  Eye, EyeOff, ChevronDown, ChevronUp, ArrowRight, Zap, FileCode,
  Settings, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../../lib/utils';
import toast from 'react-hot-toast';

interface Webhook {
  id: string;
  name: string;
  url: string;
  method: string;
  auth_type: string;
  auth_header_name?: string;
  encrypted_secret_reference?: string;
  custom_headers?: any[];
  is_active: boolean;
  last_test_status?: string;
  last_status_code?: number;
  last_tested_at?: any;
}

interface WebhookTestPanelProps {
  isOpen: boolean;
  onClose: () => void;
  webhook: Webhook;
  onTestSuccess: () => void;
  initialPayload?: string;
}

type TestType = 'simple' | 'real' | 'custom';

export default function WebhookTestPanel({ isOpen, onClose, webhook, onTestSuccess, initialPayload }: WebhookTestPanelProps) {
  const [testType, setTestType] = useState<TestType>(initialPayload ? 'custom' : 'simple');
  const [payload, setPayload] = useState(initialPayload || '');
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'request' | 'response' | 'normalization' | 'diagnosis'>('request');
  const [isPayloadValid, setIsPayloadValid] = useState(true);
  const [showFullHeaders, setShowFullHeaders] = useState(false);

  const generatePayload = (type: TestType) => {
    const now = new Date().toISOString();
    const traceId = `test_${Math.random().toString(36).substring(2, 10)}`;

    if (type === 'simple') {
      return JSON.stringify({
        event_type: "manual_test",
        event_time: now,
        source: "product_constructor",
        message: "Teste manual de webhook enviado pelo Product Constructor",
        trace_id: traceId
      }, null, 2);
    }

    if (type === 'real') {
      return JSON.stringify({
        result: {
          message: "Mensagem de teste enviada pelo Product Constructor",
          normalized_user_message: "Mensagem de teste enviada pelo Product Constructor",
          agent: "concept_builder",
          action: "send_message",
          instructions: "Você é um agente do Product Framework.",
          input: {
            product: {
              id: "test_product_id",
              name: "Produto de teste",
              status: "active"
            },
            module: {
              key: "concept_builder",
              name: "Concept Builder",
              phaseKey: "strategy_foundation",
              phaseName: "Fundação Estratégica"
            },
            actionType: "send_message",
            message: "Mensagem de teste enviada pelo Product Constructor",
            conversationHistory: [
              {
                role: "user",
                text: "Quero estruturar uma proposta de valor.",
                timestamp: now
              },
              {
                role: "assistant",
                text: "Vamos começar entendendo o problema do cliente.",
                timestamp: now
              }
            ],
            continuityContext: {
              currentUserMessage: "Mensagem de teste enviada pelo Product Constructor",
              lastUserMessage: "Quero estruturar uma proposta de valor.",
              lastAssistantMessage: "Vamos começar entendendo o problema do cliente."
            },
            situationalContext: {
              currentModule: "concept_builder",
              currentPhase: "strategy_foundation",
              actionType: "send_message",
              userMessage: "Mensagem de teste enviada pelo Product Constructor",
              expectedBehavior: "continue_existing_conversation"
            }
          },
          runtime: {
            source: "product_framework_workspace",
            channel: "backend_module_gateway",
            requestId: `req_${Math.random().toString(36).substring(2, 10)}`,
            traceId: traceId,
            timestamp: now,
            environment: "development"
          },
          responseFormat: "markdown"
        }
      }, null, 2);
    }

    return payload; // Keep current for custom
  };

  useEffect(() => {
    if (isOpen) {
      if (initialPayload) {
        setPayload(initialPayload);
        setTestType('custom');
      } else {
        setPayload(generatePayload(testType));
      }
      setResult(null);
      setActiveTab('request');
    }
  }, [isOpen, testType, initialPayload]);

  const handlePayloadChange = (val: string) => {
    setPayload(val);
    try {
      JSON.parse(val);
      setIsPayloadValid(true);
    } catch (e) {
      setIsPayloadValid(false);
    }
  };

  const getNormalizationData = () => {
    if (!isPayloadValid) return null;
    try {
      const data = JSON.parse(payload);
      const raw = data.result || data;
      
      let normalized_user_message = "";
      if (raw.input?.message) normalized_user_message = raw.input.message;
      else if (raw.input?.continuityContext?.currentUserMessage) normalized_user_message = raw.input.continuityContext.currentUserMessage;
      else if (raw.input?.situationalContext?.userMessage) normalized_user_message = raw.input.situationalContext.userMessage;
      else if (raw.result?.message) normalized_user_message = raw.result.message;
      else if (raw.message) normalized_user_message = raw.message;

      return {
        normalized_user_message: normalized_user_message || "(Não encontrado)",
        instructions: raw.instructions || "(Não encontrado)",
        response_format: raw.responseFormat || "(Padrão)",
        history_count: Array.isArray(raw.input?.conversationHistory) ? raw.input.conversationHistory.length : 0
      };
    } catch (e) {
      return null;
    }
  };

  const executeTest = async () => {
    if (!isPayloadValid) {
      toast.error("JSON inválido. Corrija o payload antes de testar.");
      return;
    }

    const norm = getNormalizationData();
    if (testType !== 'simple' && (!norm?.normalized_user_message || norm.normalized_user_message === '(Não encontrado)')) {
      if (!confirm("A mensagem do usuário (normalized_user_message) não foi encontrada no payload. Isso pode causar erro no Astroflow. Deseja continuar mesmo assim?")) {
        return;
      }
    }

    setIsTesting(true);
    setResult(null);
    setActiveTab('response');

    try {
      const res = await fetch('/api/admin/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook, payload: JSON.parse(payload) })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro no servidor");
      }

      const data = await res.json();
      setResult(data);
      
      if (data.success) {
        toast.success("Teste concluído com sucesso!");
        onTestSuccess();
      } else {
        toast.error(`Falha no teste: status ${data.status_code}`);
      }
    } catch (error: any) {
      toast.error(`Erro na execução: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  const normData = getNormalizationData();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-stretch justify-end">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="bg-zinc-50 w-full max-w-5xl shadow-2xl relative flex flex-col border-l border-white overflow-hidden"
          >
            {/* Header */}
            <header className="p-8 pb-6 bg-white border-b border-zinc-200">
               <div className="flex items-start justify-between mb-6">
                  <div className="space-y-1">
                     <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest italic">
                        <Zap className="w-3 h-3" /> Integração de Dados
                     </div>
                     <h2 className="text-3xl font-black text-zinc-900 tracking-tighter uppercase leading-none">
                        Painel de Teste <span className="text-zinc-300">do</span> Webhook
                     </h2>
                     <p className="text-zinc-500 font-medium italic">Simule eventos, envie payloads e analise a resposta do endpoint.</p>
                  </div>
                  <button 
                    onClick={onClose}
                    className="p-3 bg-zinc-100 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 rounded-2xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
               </div>

               <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-4 flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-zinc-100 shadow-sm text-zinc-400">
                        <Globe className="w-5 h-5" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest tracking-tighter">Endpoint</p>
                        <p className="text-sm font-black text-zinc-900 truncate max-w-[200px]">{webhook.name}</p>
                     </div>
                  </div>
                  <div className="h-8 w-px bg-zinc-200 hidden md:block" />
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-zinc-100 shadow-sm text-zinc-400">
                        <Shield className="w-5 h-5" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest tracking-tighter">Status</p>
                        <div className="flex items-center gap-1.5">
                           <div className={cn("w-2 h-2 rounded-full", webhook.is_active ? "bg-emerald-500" : "bg-zinc-300")} />
                           <p className="text-sm font-black text-zinc-900 uppercase tracking-widest italic text-[11px]">{webhook.is_active ? 'Ativo' : 'Inativo'}</p>
                        </div>
                     </div>
                  </div>
                  <div className="h-8 w-px bg-zinc-200 hidden md:block" />
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-zinc-100 shadow-sm text-zinc-400">
                        <Terminal className="w-5 h-5" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest tracking-tighter">Método / URL</p>
                        <p className="text-xs font-mono font-bold text-zinc-600 truncate max-w-[250px]">
                           <span className="text-indigo-600 font-black">{webhook.method}</span> {webhook.url}
                        </p>
                     </div>
                  </div>
               </div>
            </header>

            <div className="flex-1 overflow-hidden flex flex-col">
               {/* Test Config & Payload Selection */}
               <div className="p-8 space-y-8 flex-1 overflow-y-auto no-scrollbar pb-32">
                  <section className="space-y-6">
                     <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] flex items-center gap-2 italic">
                           <Settings className="w-3 h-3 text-indigo-500" /> 1. Configuração do Teste
                        </h3>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                           { id: 'simple', label: 'Teste Simples', desc: 'Valida conectividade básica.', icon: Zap },
                           { id: 'real', label: 'Execução Real', desc: 'Simula o Product Constructor completo.', icon: Layout },
                           { id: 'custom', label: 'Customizado', desc: 'Editor JSON para casos específicos.', icon: Edit3 }
                        ].map(type => (
                           <button
                              key={type.id}
                              onClick={() => setTestType(type.id as TestType)}
                              className={cn(
                                 "p-6 text-left rounded-[2rem] border transition-all flex flex-col gap-3 group relative overflow-hidden",
                                 testType === type.id 
                                    ? "bg-white border-zinc-900 shadow-xl shadow-zinc-100 ring-4 ring-zinc-900/5 scale-[1.02] z-10" 
                                    : "bg-white border-zinc-200 hover:border-zinc-400 opacity-60 hover:opacity-100"
                              )}
                           >
                              <div className={cn(
                                 "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all",
                                 testType === type.id ? "bg-zinc-900 text-white border-zinc-900" : "bg-zinc-50 text-zinc-400 border-zinc-100"
                              )}>
                                 <type.icon className="w-5 h-5" />
                              </div>
                              <div>
                                 <p className="text-xs font-black text-zinc-900 uppercase tracking-widest italic">{type.label}</p>
                                 <p className="text-[10px] text-zinc-500 font-medium italic mt-0.5 leading-relaxed">{type.desc}</p>
                              </div>
                              {testType === type.id && (
                                 <div className="absolute top-4 right-4">
                                    <CheckCircle2 className="w-5 h-5 text-zinc-900" />
                                 </div>
                              )}
                           </button>
                        ))}
                     </div>
                  </section>

                  {/* Body Editor & Tabs */}
                  <section className="space-y-6 flex-1 flex flex-col">
                     <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] flex items-center gap-2 italic">
                           <Code className="w-3 h-3 text-indigo-500" /> 2. Payload e Diagnóstico
                        </h3>
                        <div className="flex p-1 bg-zinc-200 rounded-2xl">
                           {[
                              { id: 'request', label: 'Request JSON', icon: FileJson },
                              { id: 'normalization', label: 'Normalização IA', icon: MessageSquare },
                           ].map(tab => (
                              <button
                                 key={tab.id}
                                 onClick={() => setActiveTab(tab.id as any)}
                                 className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    activeTab === tab.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                                 )}
                              >
                                 <tab.icon className="w-3 h-3" /> {tab.label}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden flex flex-col">
                        {activeTab === 'request' && (
                           <div className="flex flex-col h-[400px]">
                              <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                    <span className={cn(
                                       "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                                       isPayloadValid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                    )}>
                                       {isPayloadValid ? 'JSON VÁLIDO' : 'JSON INVÁLIDO'}
                                    </span>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => copyToClipboard(payload)}
                                      className="p-2 text-zinc-400 hover:text-zinc-900 transition-all"
                                      title="Copiar JSON"
                                    >
                                       <Copy className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => setPayload(generatePayload(testType))}
                                      className="p-2 text-zinc-400 hover:text-zinc-900 transition-all"
                                      title="Restaurar padrão"
                                    >
                                       <RefreshCw className="w-4 h-4" />
                                    </button>
                                 </div>
                              </div>
                              <textarea 
                                 value={payload}
                                 onChange={(e) => handlePayloadChange(e.target.value)}
                                 readOnly={testType !== 'custom'}
                                 className={cn(
                                    "flex-1 p-8 text-xs font-mono focus:outline-none leading-relaxed custom-scrollbar bg-zinc-900 text-indigo-300",
                                    testType !== 'custom' && "opacity-80"
                                 )}
                                 spellCheck={false}
                              />
                           </div>
                        )}

                        {activeTab === 'normalization' && (
                           <div className="p-10 space-y-8 min-h-[400px] animate-in fade-in duration-300">
                              <div className="space-y-4">
                                 <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] italic">Como a IA lerá este payload:</h4>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-6 bg-zinc-50 border border-zinc-100 rounded-3xl space-y-2">
                                       <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Variable: normalized_user_message</p>
                                       <p className={cn(
                                          "text-sm font-bold",
                                          normData?.normalized_user_message === '(Não encontrado)' ? "text-red-500 italic" : "text-zinc-900"
                                       )}>
                                          {normData?.normalized_user_message}
                                       </p>
                                       {normData?.normalized_user_message === '(Não encontrado)' && (
                                          <div className="flex items-center gap-1.5 text-[10px] text-red-400 font-bold mt-2">
                                             <AlertCircle className="w-3 h-3" /> Erro: Fluxo pode falhar no Astroflow.
                                          </div>
                                       )}
                                    </div>
                                    <div className="p-6 bg-zinc-50 border border-zinc-100 rounded-3xl space-y-2">
                                       <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Variable: normalized_instructions</p>
                                       <p className="text-sm font-bold text-zinc-900 underline decoration-indigo-200 underline-offset-4">
                                          {normData?.instructions}
                                       </p>
                                    </div>
                                    <div className="p-6 bg-zinc-50 border border-zinc-100 rounded-3xl space-y-2">
                                       <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Variable: conversation_history_count</p>
                                       <p className="text-sm font-bold text-zinc-900 italic">
                                          {normData?.history_count} mensagens detectadas
                                       </p>
                                    </div>
                                    <div className="p-6 bg-zinc-50 border border-zinc-100 rounded-3xl space-y-2">
                                       <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Response Format</p>
                                       <p className="text-sm font-black text-indigo-600 uppercase tracking-widest">
                                          {normData?.response_format}
                                       </p>
                                    </div>
                                 </div>
                              </div>

                              <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl flex gap-4 items-start">
                                 <Info className="w-5 h-5 text-amber-500 shrink-0" />
                                 <div className="space-y-1">
                                    <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">Dica de Diagnóstico</p>
                                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                                       Sempre use <code className="bg-amber-100 px-1 rounded font-bold">result.input.message</code> ou variáveis normalizadas no Astroflow. Webhooks que recebem <code className="bg-amber-100 px-1 rounded font-bold">messages</code> vazias costumam falhar com erro 400.
                                    </p>
                                 </div>
                              </div>
                           </div>
                        )}
                     </div>
                  </section>

                  {/* Execution Results Section */}
                  <AnimatePresence>
                     {result && (
                        <motion.section 
                           initial={{ opacity: 0, y: 20 }}
                           animate={{ opacity: 1, y: 0 }}
                           className="space-y-6 pt-4"
                        >
                           <div className="flex items-center justify-between">
                              <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] flex items-center gap-2 italic">
                                 <Terminal className="w-3 h-3 text-indigo-500" /> 3. Resultado da Execução
                              </h3>
                              <div className="flex gap-2">
                                 <button 
                                    onClick={() => setActiveTab('response')}
                                    className={cn(
                                       "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                       activeTab === 'response' ? "bg-zinc-900 text-white" : "bg-white text-zinc-500 border border-zinc-200"
                                    )}
                                 >
                                    Response Body
                                 </button>
                                 {result.diagnosis && (
                                    <button 
                                       onClick={() => setActiveTab('diagnosis')}
                                       className={cn(
                                          "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 animate-pulse",
                                          activeTab === 'diagnosis' ? "bg-red-600 text-white shadow-lg shadow-red-200" : "bg-red-50 text-red-600 border border-red-100"
                                       )}
                                    >
                                       <AlertCircle className="w-3 h-3" /> Diagnóstico
                                    </button>
                                 )}
                              </div>
                           </div>

                           <div className="bg-white border border-zinc-200 rounded-[3rem] p-8 space-y-8 shadow-sm">
                              {/* Quick summary bar */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                 <div className="space-y-1">
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest italic">Status Code</p>
                                    <div className="flex items-center gap-2">
                                       <div className={cn(
                                          "w-2 h-2 rounded-full",
                                          result.success ? "bg-emerald-500" : "bg-red-500"
                                       )} />
                                       <p className={cn(
                                          "text-2xl font-black italic tracking-tighter",
                                          result.success ? "text-emerald-600" : "text-red-600"
                                       )}>
                                          {result.status_code}
                                       </p>
                                    </div>
                                 </div>
                                 <div className="space-y-1">
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest italic">Tempo</p>
                                    <p className="text-2xl font-black text-zinc-900 italic tracking-tighter">
                                       {result.duration_ms}<span className="text-xs opacity-30 ml-1">ms</span>
                                    </p>
                                 </div>
                                 <div className="space-y-1">
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest italic">Trace ID</p>
                                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => copyToClipboard(result.trace_id)}>
                                       <p className="text-sm font-mono font-bold text-zinc-600 truncate max-w-[120px]">{result.trace_id}</p>
                                       <Copy className="w-3 h-3 text-zinc-300 group-hover:text-zinc-600" />
                                    </div>
                                 </div>
                                 <div className="space-y-1">
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest italic">Mensagem</p>
                                    <p className="text-xs font-bold text-zinc-900 truncate">
                                       {result.message}
                                    </p>
                                 </div>
                              </div>

                              <div className="h-px bg-zinc-100" />

                              {activeTab === 'response' && (
                                 <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                                    <div className="space-y-4">
                                       <div className="flex items-center justify-between">
                                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic flex items-center gap-2">
                                             <ChevronDown className="w-3 h-3" /> Headers de Respostas
                                          </p>
                                          <button 
                                             onClick={() => setShowFullHeaders(!showFullHeaders)}
                                             className="text-[9px] font-black text-indigo-600 uppercase tracking-widest italic hover:underline"
                                          >
                                             {showFullHeaders ? 'Ocultar Headers' : 'Ver Todos'}
                                          </button>
                                       </div>
                                       
                                       <div className={cn(
                                          "bg-zinc-50 border border-zinc-100 rounded-2xl p-4 text-[10px] font-mono grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 overflow-hidden transition-all duration-500",
                                          !showFullHeaders && "max-h-[80px]"
                                       )}>
                                          {Object.entries(result.response_headers || {}).map(([key, value]) => (
                                             <div key={key} className="flex gap-2">
                                                <span className="text-zinc-400 whitespace-nowrap">{key}:</span>
                                                <span className="text-zinc-900 break-all">{String(value)}</span>
                                             </div>
                                          ))}
                                          {Object.keys(result.response_headers || {}).length === 0 && (
                                             <div className="text-zinc-400 italic">Headers não disponíveis</div>
                                          )}
                                       </div>
                                    </div>

                                    <div className="space-y-4">
                                       <div className="flex items-center justify-between">
                                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic flex items-center gap-2">
                                             <FileCode className="w-3 h-3" /> Response Body
                                          </p>
                                          <button 
                                             onClick={() => copyToClipboard(JSON.stringify(result.response_body, null, 2))}
                                             className="text-[9px] font-black text-zinc-400 uppercase tracking-widest hover:text-zinc-900 transition-all flex items-center gap-1.5"
                                          >
                                             <Copy className="w-3 h-3" /> Copiar Body
                                          </button>
                                       </div>
                                       <div className="bg-zinc-900 rounded-[2rem] p-8 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed h-[300px] custom-scrollbar border border-zinc-800 shadow-inner">
                                          <pre>{JSON.stringify(result.response_body, null, 2)}</pre>
                                       </div>
                                    </div>
                                 </div>
                              )}

                              {activeTab === 'diagnosis' && result.diagnosis && (
                                 <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                    <div className="p-8 bg-red-50 border border-red-100 rounded-[2.5rem] space-y-6">
                                       <div className="flex items-center gap-4">
                                          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 shadow-sm border border-red-200">
                                             <AlertCircle className="w-6 h-6" />
                                          </div>
                                          <div>
                                             <h4 className="text-sm font-black text-red-900 uppercase tracking-widest italic">Diagnóstico Automático</h4>
                                             <p className="text-xs text-red-700 font-bold opacity-70">Identificamos o problema na integração.</p>
                                          </div>
                                       </div>

                                       <div className="space-y-4">
                                          <div className="bg-white/60 p-6 rounded-2xl border border-red-100">
                                             <p className="text-sm font-bold text-red-900 leading-relaxed italic">
                                                "{result.diagnosis}"
                                             </p>
                                          </div>

                                          <div className="space-y-2">
                                             <p className="text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                                                <ArrowRight className="w-3 h-3" /> Correção Sugerida
                                             </p>
                                             <ul className="space-y-3">
                                                {[
                                                   "Revise o bloco de entrada no Astroflow.",
                                                   "Certifique-se que o array `messages` não receba itens com conteúdo vazio.",
                                                   "Utilize a variável `normalized_user_message` enviada pelo simulador para carregar a mensagem da IA.",
                                                   "Verifique se o payload do 'Product Constructor' está sendo mapeado corretamente."
                                                ].map((step, i) => (
                                                   <li key={i} className="flex gap-3 text-xs font-bold text-red-800">
                                                      <span className="w-5 h-5 bg-red-100 text-red-600 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black">{i+1}</span>
                                                      {step}
                                                   </li>
                                                ))}
                                             </ul>
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                              )}
                           </div>
                        </motion.section>
                     )}
                  </AnimatePresence>
               </div>

               {/* Footer Action Bar */}
               <footer className="p-8 bg-white border-t border-zinc-200 flex items-center justify-between sticky bottom-0 z-20">
                  <div className="flex items-center gap-6">
                     <div className="flex items-center gap-2">
                        <div className={cn(
                           "w-3 h-3 rounded-full shadow-sm",
                           isPayloadValid ? "bg-emerald-500" : "bg-red-500"
                        )} />
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] italic">
                           Payload {isPayloadValid ? 'Pronto' : 'Inválido'}
                        </span>
                     </div>
                     <div className="h-4 w-px bg-zinc-200" />
                     <p className="text-[10px] text-zinc-400 font-bold italic max-w-xs">
                        {isPayloadValid 
                           ? "JSON pronto para disparo. O teste será registrado no histórico administrativo." 
                           : "Por favor, corrija os erros de sintaxe no editor JSON acima."}
                     </p>
                  </div>

                  <div className="flex gap-4">
                     <button
                        onClick={onClose}
                        className="px-8 py-4 text-zinc-400 font-black text-[11px] uppercase tracking-widest hover:text-zinc-900 transition-all italic"
                     >
                        Cancelar
                     </button>
                     <button
                        onClick={executeTest}
                        disabled={isTesting || !isPayloadValid}
                        className={cn(
                           "px-10 py-4 rounded-3xl font-black text-xs uppercase tracking-[0.3em] flex items-center gap-3 transition-all shadow-xl shadow-zinc-200 relative overflow-hidden group",
                           isTesting ? "bg-zinc-100 text-zinc-400" : "bg-zinc-900 text-white hover:bg-indigo-600 shadow-indigo-100"
                        )}
                     >
                        {isTesting ? (
                           <>
                              <Loader2 className="w-5 h-5 animate-spin" /> EXECUTANDO...
                           </>
                        ) : (
                           <>
                              <Play className="w-5 h-5 group-hover:scale-125 transition-all" /> ENVIAR TESTE AGORA
                           </>
                        )}
                     </button>
                  </div>
               </footer>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
