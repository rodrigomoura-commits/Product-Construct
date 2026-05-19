import React from 'react';
import { 
  X, Copy, Clock, Globe, Terminal, Code, Activity, 
  Shield, AlertCircle, CheckCircle2, ChevronRight,
  ArrowRight, FileText, Info, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatSafeDate } from '../../../lib/utils';
import toast from 'react-hot-toast';

interface WebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  request_url: string;
  request_method: string;
  request_headers_masked: any;
  request_payload: any;
  response_status_code: number;
  response_body: string;
  response_headers?: any;
  response_time_ms: number;
  status: 'success' | 'error';
  error_message?: string;
  diagnosis?: string;
  trace_id: string;
  created_at: any;
}

interface WebhookDetailsDrawerProps {
  log: WebhookLog | null;
  onClose: () => void;
  webhookName?: string;
  onRepeatTest?: (log: WebhookLog) => void;
}

export default function WebhookDetailsDrawer({ log, onClose, webhookName, onRepeatTest }: WebhookDetailsDrawerProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const parseBody = (body: string) => {
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return body;
    }
  };

  return (
    <AnimatePresence>
      {log && (
        <div className="fixed inset-0 z-[120] flex items-stretch justify-end">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm shadow-inner"
          />
          
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="bg-white w-full max-w-3xl shadow-2xl relative flex flex-col overflow-hidden"
          >
            {/* Header */}
            <header className="p-8 border-b border-zinc-100 flex items-start justify-between bg-zinc-50/50">
               <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                     <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
                        log.status === 'success' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                     )}>
                        {log.status === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        Status {log.response_status_code}
                     </span>
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic opacity-50">•</span>
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">{log.response_time_ms}ms</span>
                  </div>
                  <h2 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-[500px]">
                     {webhookName || 'Detalhes da Execução'}
                  </h2>
                  <p className="text-zinc-400 text-xs font-mono font-bold uppercase tracking-tight">{log.trace_id}</p>
               </div>
               <button 
                 onClick={onClose}
                 className="p-3 bg-white border border-zinc-200 text-zinc-400 hover:text-zinc-900 rounded-2xl transition-all shadow-sm"
               >
                 <X className="w-6 h-6" />
               </button>
            </header>

            <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-10">
               {/* Quick Info Grid */}
               <div className="grid grid-cols-2 gap-6 pb-6 border-b border-zinc-100">
                  <div className="space-y-4">
                     <div className="space-y-1">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest italic leading-none">Evento / Gatilho</p>
                        <p className="text-sm font-black text-zinc-900 uppercase tracking-tight italic">{log.event_type.replace(/_/g, ' ')}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest italic leading-none">Método HTTP</p>
                        <p className="text-sm font-black text-indigo-600 italic tracking-widest">{log.request_method}</p>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <div className="space-y-1 text-right">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest italic leading-none">Data / Hora</p>
                        <p className="text-sm font-bold text-zinc-600">{formatSafeDate(log.created_at)}</p>
                     </div>
                     <div className="space-y-1 text-right">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest italic leading-none">URL do Endpoint</p>
                        <p className="text-xs font-mono font-bold text-zinc-400 truncate max-w-[200px] ml-auto" title={log.request_url}>
                           {log.request_url}
                        </p>
                     </div>
                  </div>
               </div>

               {/* Diagnosis Section */}
               {log.status === 'error' && (
                  <div className="p-8 bg-red-50 border border-red-100 rounded-[2.5rem] space-y-6 animate-in slide-in-from-top-4">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-600 shadow-sm border border-red-100">
                           <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                           <h4 className="text-sm font-black text-red-900 uppercase tracking-widest italic leading-none">Diagnóstico de Falha</h4>
                           <p className="text-xs text-red-700 font-bold opacity-60 mt-1">Análise automática da resposta do endpoint.</p>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <p className="text-sm font-bold text-red-900 italic leading-relaxed">
                           {log.diagnosis || log.error_message || "Não foi possível identificar a causa raiz. Verifique os logs do Astroflow."}
                        </p>
                        {log.diagnosis && (
                           <div className="space-y-2 mt-4 pt-4 border-t border-red-200/50">
                              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest italic flex items-center gap-2">
                                 <ArrowRight className="w-3 h-3" /> Corrija Agora
                              </p>
                              <p className="text-xs font-medium text-red-800 leading-relaxed">
                                Verifique se o campo enviado para a IA está carregando a mensagem correta. Use <code className="bg-white/50 px-1 rounded font-bold">result.input.message</code> ou simule um payload real no Painel de Testes.
                              </p>
                           </div>
                        )}
                     </div>
                  </div>
               )}

               {/* Request Details */}
               <section className="space-y-6">
                  <div className="flex items-center justify-between">
                     <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em] flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-indigo-500" /> Detalhes do Request
                     </h3>
                     <button 
                        onClick={() => copyToClipboard(JSON.stringify(log.request_payload, null, 2))}
                        className="text-[9px] font-black text-zinc-400 uppercase tracking-widest hover:text-zinc-900 transition-all flex items-center gap-1.5"
                     >
                        <Copy className="w-3 h-3" /> Copiar Payload
                     </button>
                  </div>

                  <div className="space-y-4">
                     <div className="p-6 bg-zinc-50 border border-zinc-100 rounded-3xl space-y-3">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest italic">Headers Enviados (Mascarados)</p>
                        <div className="grid grid-cols-1 gap-2 text-[10px] font-mono text-zinc-500 overflow-hidden">
                           {log.request_headers_masked && Object.entries(log.request_headers_masked).map(([k, v]) => (
                              <div key={k} className="flex gap-2">
                                 <span className="font-bold shrink-0">{k}:</span>
                                 <span className="text-zinc-900 truncate">{String(v)}</span>
                              </div>
                           ))}
                        </div>
                     </div>

                     <div className="space-y-2">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest italic px-2">Payload Enviado</p>
                        <div className="bg-zinc-900 rounded-[2.5rem] p-8 text-xs font-mono text-indigo-300 overflow-x-auto h-[250px] custom-scrollbar border border-zinc-800 shadow-xl">
                           <pre>{JSON.stringify(log.request_payload, null, 2)}</pre>
                        </div>
                     </div>
                  </div>
               </section>

               {/* Response Details */}
               <section className="space-y-6 pb-20">
                  <div className="flex items-center justify-between">
                     <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em] flex items-center gap-2">
                        <Code className="w-4 h-4 text-emerald-500" /> Detalhes do Response
                     </h3>
                     <button 
                        onClick={() => copyToClipboard(log.response_body)}
                        className="text-[9px] font-black text-zinc-400 uppercase tracking-widest hover:text-zinc-900 transition-all flex items-center gap-1.5"
                     >
                        <Copy className="w-3 h-3" /> Copiar Response
                     </button>
                  </div>

                  <div className="space-y-4">
                     <div className="p-6 bg-emerald-50/30 border border-emerald-100/50 rounded-3xl space-y-3">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest italic">Headers de Resposta</p>
                        <div className="grid grid-cols-1 gap-2 text-[10px] font-mono text-zinc-500">
                           {log.response_headers && Object.entries(log.response_headers).map(([k, v]) => (
                              <div key={k} className="flex gap-2">
                                 <span className="font-bold shrink-0">{k}:</span>
                                 <span className="text-emerald-900 truncate">{String(v)}</span>
                              </div>
                           ))}
                           {!log.response_headers && <p className="italic">Nenhum header capturado.</p>}
                        </div>
                     </div>

                     <div className="space-y-2">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest italic px-2">Response Body</p>
                        <div className={cn(
                           "rounded-[2.5rem] p-8 text-xs font-mono overflow-x-auto h-[250px] custom-scrollbar border shadow-xl",
                           log.status === 'success' ? "bg-emerald-950 text-emerald-400 border-emerald-900" : "bg-red-950 text-red-400 border-red-900"
                        )}>
                           <pre>{parseBody(log.response_body)}</pre>
                        </div>
                     </div>
                  </div>
               </section>
            </div>

            {/* Footer */}
            <footer className="p-8 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between sticky bottom-0">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white border border-zinc-200 rounded-lg flex items-center justify-center text-zinc-400">
                     <Activity className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">Persistido no Banco de Dados</p>
               </div>
               <div className="flex gap-4">
                  {onRepeatTest && (
                    <button 
                       onClick={() => onRepeatTest(log)}
                       className="px-8 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-50 transition-all shadow-sm flex items-center gap-2"
                    >
                       <RefreshCw className="w-4 h-4" /> Repetir Teste
                    </button>
                  )}
                  <button 
                     onClick={onClose}
                     className="px-8 py-3 bg-zinc-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg"
                  >
                     Fechar Detalhes
                  </button>
               </div>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
