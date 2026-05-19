import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Share2, Plus, Search, Globe, Shield, Activity, 
  Trash2, Copy, ToggleLeft, ToggleRight, Edit3, Play, 
  ChevronRight, Clock, CheckCircle2, AlertCircle, Info, 
  Loader2, ExternalLink, ShieldCheck, Key, Settings,
  Hash, Code, Terminal, Filter, MoreVertical, X,
  RefreshCw as RefreshCwIcon
} from 'lucide-react';
import { cn, formatSafeDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import WebhookTestPanel from './webhooks/WebhookTestPanel';
import WebhookDetailsDrawer from './webhooks/WebhookDetailsDrawer';

interface Webhook {
  id: string;
  name: string;
  description: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  auth_type: 'none' | 'bearer' | 'header' | 'apikey';
  auth_header_name?: string;
  encrypted_secret_reference?: string;
  custom_headers: { key: string; value: string; active: boolean }[];
  event_types: string[];
  payload_mode: 'default' | 'custom';
  custom_payload_template?: string;
  is_active: boolean;
  last_test_status?: string;
  last_tested_at?: any;
  last_status_code?: number;
  created_at?: any;
}

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
  response_time_ms: number;
  status: 'success' | 'error';
  error_message?: string;
  trace_id: string;
  created_at: any;
}

const EVENT_TYPES = [
  { id: 'conversation_started', label: 'Nova conversa iniciada', desc: 'Gatilho quando o chat é aberto.' },
  { id: 'message_received', label: 'Nova mensagem recebida', desc: 'Gatilho quando o usuário envia mensagem.' },
  { id: 'response_generated', label: 'Resposta gerada pelo agente', desc: 'Gatilho após o Tona responder.' },
  { id: 'artifact_created', label: 'Artefato criado', desc: 'Gatilho quando um documento/output é gerado.' },
  { id: 'artifact_updated', label: 'Artefato atualizado', desc: 'Gatilho em novas versões de artefatos.' },
  { id: 'stage_completed', label: 'Etapa concluída', desc: 'Gatilho ao finalizar Sense, Shape, etc.' },
  { id: 'processing_error', label: 'Erro no processamento', desc: 'Gatilho em caso de falhas críticas.' },
  { id: 'manual_execution', label: 'Execução manual', desc: 'Apenas disparado via botão de teste.' },
];

const VARIABLES = [
  { key: '{{event_type}}', desc: 'Tipo do evento' },
  { key: '{{event_time}}', desc: 'Timestamp ISO' },
  { key: '{{environment}}', desc: 'Ambiente (dev/prod)' },
  { key: '{{product_id}}', desc: 'ID do Produto' },
  { key: '{{product_name}}', desc: 'Nome do Produto' },
  { key: '{{stage}}', desc: 'Etapa atual' },
  { key: '{{module}}', desc: 'Módulo do agente' },
  { key: '{{user_id}}', desc: 'ID do usuário' },
  { key: '{{user_name}}', desc: 'Nome do usuário' },
  { key: '{{user_email}}', desc: 'Email do usuário' },
  { key: '{{user_role}}', desc: 'Papel do usuário' },
  { key: '{{conversation_id}}', desc: 'ID da conversa' },
  { key: '{{input_text}}', desc: 'Mensagem do usuário' },
  { key: '{{output_text}}', desc: 'Resposta do sistema' },
  { key: '{{app_version}}', desc: 'Versão do App' },
  { key: '{{trace_id}}', desc: 'Trace ID único' },
];

const DEFAULT_PAYLOAD = `{
  "event_type": "{{event_type}}",
  "event_time": "{{event_time}}",
  "product_constructor": {
    "environment": "{{environment}}",
    "product_id": "{{product_id}}",
    "product_name": "{{product_name}}",
    "stage": "{{stage}}",
    "module": "{{module}}"
  },
  "user": {
    "id": "{{user_id}}",
    "name": "{{user_name}}",
    "email": "{{user_email}}",
    "role": "{{user_role}}"
  },
  "conversation": {
    "id": "{{conversation_id}}",
    "input_text": "{{input_text}}",
    "output_text": "{{output_text}}"
  },
  "metadata": {
    "source": "product_constructor",
    "version": "{{app_version}}",
    "trace_id": "{{trace_id}}"
  }
}`;

export default function WebhooksAdminSection({ onBack }: { onBack: () => void }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [activeTestWebhook, setActiveTestWebhook] = useState<Webhook | null>(null);
  const [isTestPanelOpen, setIsTestPanelOpen] = useState(false);
  const [repeatPayload, setRepeatPayload] = useState<string | undefined>(undefined);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Webhook>>({
    method: 'POST',
    auth_type: 'none',
    custom_headers: [],
    event_types: [],
    payload_mode: 'default',
    is_active: true
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [wRes, lRes] = await Promise.all([
        fetch('/api/admin/webhooks').then(r => r.json()),
        fetch('/api/admin/webhooks/logs').then(r => r.json())
      ]);
      setWebhooks(wRes.webhooks || []);
      setLogs(lRes.logs || []);
    } catch (e) {
      toast.error("Erro ao carregar dados dos webhooks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.url) {
      toast.error("Nome e URL são obrigatórios.");
      return;
    }

    try {
      const url = editingWebhook ? `/api/admin/webhooks/${editingWebhook.id}` : '/api/admin/webhooks';
      const method = editingWebhook ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        toast.success(editingWebhook ? "Webhook atualizado!" : "Webhook criado!");
        setIsFormOpen(false);
        setEditingWebhook(null);
        fetchData();
      } else {
        throw new Error();
      }
    } catch (e) {
      toast.error("Falha ao salvar webhook.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este webhook? Essa ação não poderá ser desfeita.")) return;
    
    try {
      const res = await fetch(`/api/admin/webhooks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Webhook excluído.");
        fetchData();
      }
    } catch (e) {
      toast.error("Erro ao excluir.");
    }
  };

  const handleTestStatus = (webhook: Webhook, payload?: string) => {
    setActiveTestWebhook(webhook);
    setRepeatPayload(payload);
    setIsTestPanelOpen(true);
  };

  const handleRepeatTestFromLog = (log: WebhookLog) => {
    const webhook = webhooks.find(w => w.id === log.webhook_id);
    if (!webhook) {
      toast.error("Webhook original não encontrado.");
      return;
    }
    handleTestStatus(webhook, JSON.stringify(log.request_payload, null, 2));
    setSelectedLog(null);
  };

  const toggleStatus = async (webhook: Webhook) => {
    try {
      const res = await fetch(`/api/admin/webhooks/${webhook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !webhook.is_active })
      });
      if (res.ok) {
        toast.success(webhook.is_active ? "Webhook desativado" : "Webhook ativado");
        fetchData();
      }
    } catch (e) {
      toast.error("Erro ao alterar status.");
    }
  };

  const openForm = (webhook?: Webhook) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setFormData(webhook);
    } else {
      setEditingWebhook(null);
      setFormData({
        method: 'POST',
        auth_type: 'none',
        custom_headers: [],
        event_types: [],
        payload_mode: 'default',
        is_active: true
      });
    }
    setIsFormOpen(true);
  };

  const metrics = {
    total: webhooks.length,
    active: webhooks.filter(w => w.is_active).length,
    errors: webhooks.filter(w => w.last_test_status === 'error').length,
    lastTest: webhooks.sort((a, b) => (b.last_tested_at || 0) - (a.last_tested_at || 0))[0]?.last_tested_at
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Breadcrumb & Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-zinc-400">
            <button onClick={onBack} className="flex items-center gap-1.5 hover:text-zinc-900 transition-all font-bold text-xs uppercase tracking-widest group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Integrações
            </button>
            <ChevronRight className="w-4 h-4 opacity-50" />
            <span className="text-zinc-400 font-bold text-xs uppercase tracking-widest opacity-50">Webhooks</span>
          </div>
          <h1 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase">Webhooks</h1>
          <p className="text-zinc-500 font-medium italic">Configure endpoints para conectar o Product Constructor com fluxos externos.</p>
        </div>
        
        <div className="flex gap-4">
           {webhooks.length > 0 && (
             <button 
               onClick={() => handleTestStatus(webhooks[0])}
               className="px-8 py-4 bg-white border border-zinc-200 text-zinc-900 rounded-3xl font-black text-xs uppercase tracking-[0.3em] flex items-center gap-3 hover:bg-zinc-50 transition-all shadow-sm"
             >
               <Play className="w-5 h-5" /> Testar Webhook
             </button>
           )}
           <button 
             onClick={fetchData}
             className="p-4 bg-white border border-zinc-200 rounded-3xl hover:bg-zinc-50 transition-all text-zinc-400 hover:text-indigo-600 shadow-sm"
           >
             <RefreshCwIcon className={cn("w-5 h-5", loading && "animate-spin")} />
           </button>
           <button 
             onClick={() => openForm()}
             className="px-8 py-4 bg-zinc-900 text-white rounded-3xl font-black text-xs uppercase tracking-[0.3em] flex items-center gap-3 hover:bg-indigo-600 transition-all shadow-xl shadow-zinc-200"
           >
             <Plus className="w-5 h-5" /> Criar Webhook
           </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-white border border-zinc-200 rounded-[2.5rem] p-8 shadow-sm flex items-center justify-between group overflow-hidden relative">
            <div className="space-y-1 relative z-10">
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">Webhooks Ativos</p>
               <h4 className="text-4xl font-black text-zinc-900 tracking-tighter">{metrics.active} <span className="text-lg opacity-30 text-zinc-400 italic">/ {metrics.total}</span></h4>
            </div>
            <Share2 className="w-12 h-12 text-zinc-50 opacity-10 absolute right-[-10px] top-1/2 -translate-y-1/2 group-hover:scale-125 transition-transform" />
         </div>
         <div className="bg-white border border-zinc-200 rounded-[2.5rem] p-8 shadow-sm flex items-center justify-between group overflow-hidden relative">
            <div className="space-y-1 relative z-10">
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">Status Geral</p>
               <div className="flex items-center gap-2">
                 <div className={cn("w-3 h-3 rounded-full animate-pulse", metrics.errors > 0 ? "bg-red-500" : metrics.active > 0 ? "bg-emerald-500" : "bg-zinc-300")} />
                 <h4 className="text-xl font-black text-zinc-900 tracking-tighter uppercase italic">{metrics.errors > 0 ? 'CRÍTICO' : metrics.active > 0 ? 'ESTÁVEL' : 'OFFLINE'}</h4>
               </div>
            </div>
            <Activity className="w-12 h-12 text-zinc-50 opacity-10 absolute right-[-10px] top-1/2 -translate-y-1/2 group-hover:scale-125 transition-transform" />
         </div>
         <div className="bg-white border border-zinc-200 rounded-[2.5rem] p-8 shadow-sm col-span-2 flex items-center justify-between group overflow-hidden relative">
            <div className="space-y-1 relative z-10">
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">Última Sincronização</p>
               <h4 className="text-xl font-bold text-zinc-600 tracking-tight leading-none uppercase">
                 {formatSafeDate(metrics.lastTest)}
               </h4>
            </div>
            <Clock className="w-12 h-12 text-zinc-50 opacity-10 absolute right-[-10px] top-1/2 -translate-y-1/2 group-hover:scale-125 transition-transform" />
         </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Webhooks List */}
        <div className="lg:col-span-2 space-y-6">
           <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                 <Globe className="w-6 h-6 text-indigo-600" /> Endpoints Configurados
              </h3>
              <div className="bg-zinc-100 p-1 rounded-xl flex">
                 <button className="px-4 py-2 bg-white text-zinc-900 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">Todos</button>
                 <button className="px-4 py-2 text-zinc-500 rounded-lg text-[10px] font-black uppercase tracking-widest hover:text-zinc-900 transition-all">Ativos</button>
              </div>
           </div>

           <div className="space-y-4">
              {webhooks.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-zinc-100 rounded-[3rem] p-20 flex flex-col items-center text-center space-y-6">
                   <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-200">
                      <Share2 className="w-10 h-10" />
                   </div>
                   <div className="space-y-2">
                     <h4 className="text-2xl font-black text-zinc-900 uppercase italic">Nenhum webhook configurado</h4>
                     <p className="text-zinc-500 font-medium max-w-sm">Crie seu primeiro webhook para conectar o Product Constructor a fluxos externos.</p>
                   </div>
                   <button onClick={() => openForm()} className="px-8 py-4 bg-indigo-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all">
                     Criar Webhook
                   </button>
                </div>
              ) : (
                webhooks.map((w, index) => (
                  <motion.div 
                    key={w.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "group bg-white border border-zinc-200 rounded-[2.5rem] p-6 hover:shadow-2xl hover:shadow-zinc-100 transition-all overflow-hidden relative",
                      !w.is_active && "opacity-60 grayscale"
                    )}
                  >
                    <div className="flex items-center justify-between gap-6 relative z-10">
                       <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
                            w.last_test_status === 'success' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                            w.last_test_status === 'error' ? "bg-red-50 text-red-600 border-red-100" : "bg-zinc-50 text-zinc-400 border-zinc-100"
                          )}>
                            <Globe className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                             <div className="flex items-center gap-3">
                                <h4 className="font-black text-zinc-900 truncate tracking-tight">{w.name}</h4>
                                <span className={cn(
                                  "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                                  w.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-zinc-50 text-zinc-400 border-zinc-200"
                                )}>
                                  {w.is_active ? 'Ativo' : 'Inativo'}
                                </span>
                                <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-zinc-200">
                                  {w.method}
                                </span>
                             </div>
                             <p className="text-zinc-400 text-xs font-mono truncate mt-1">
                               {w.url.replace(/(https?:\/\/).{5}/, '$1*****')}
                             </p>
                          </div>
                       </div>

                       <div className="flex items-center gap-2">
                          <div className="hidden md:flex flex-col items-end mr-4 text-right">
                             <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Última Execução</p>
                             <p className="text-[11px] font-bold text-zinc-600 mt-0.5">
                               {w.last_tested_at ? formatSafeDate(w.last_tested_at).split(' ')[1] : '--:--'}
                               <span className={cn(
                                 "ml-2 font-black",
                                 w.last_status_code && w.last_status_code >= 200 && w.last_status_code < 300 ? "text-emerald-500" : "text-red-500"
                               )}>
                                 {w.last_status_code || ''}
                               </span>
                             </p>
                          </div>

                          <div className="flex items-center gap-1.5 p-1 bg-zinc-50 border border-zinc-100 rounded-2xl group-hover:bg-white group-hover:border-zinc-200 transition-all">
                             <button 
                               onClick={() => handleTestStatus(w)}
                               className="p-3 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                               title="Abrir Painel de Teste"
                             >
                               <Play className="w-5 h-5" />
                             </button>
                             <button 
                               onClick={() => openForm(w)}
                               className="p-3 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                               title="Editar"
                             >
                               <Edit3 className="w-5 h-5" />
                             </button>
                             <button 
                               onClick={() => toggleStatus(w)}
                               className="p-3 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                               title={w.is_active ? "Desativar" : "Ativar"}
                             >
                               {w.is_active ? <ToggleLeft className="w-5 h-5" /> : <ToggleRight className="w-5 h-5" />}
                             </button>
                             <button 
                               onClick={() => handleDelete(w.id)}
                               className="p-3 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                               title="Excluir"
                             >
                               <Trash2 className="w-5 h-5" />
                             </button>
                          </div>
                       </div>
                    </div>
                  </motion.div>
                ))
              )}
           </div>
        </div>

        {/* Recent Logs List */}
        <div className="space-y-6">
           <h3 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
              <Activity className="w-6 h-6 text-indigo-600" /> Histórico Recente
           </h3>

           <div className="bg-white border border-zinc-200 rounded-[3rem] p-2 divide-y divide-zinc-50 overflow-hidden shadow-sm">
              {logs.length === 0 ? (
                <div className="p-12 text-center text-zinc-400 italic text-sm font-medium">Nenhuma execução registrada.</div>
              ) : (
                logs.map((log) => (
                  <button 
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="w-full p-6 text-left hover:bg-zinc-50 transition-all flex items-center justify-between group first:rounded-t-[2.8rem] last:rounded-b-[2.8rem]"
                  >
                     <div className="flex items-center gap-4 min-w-0">
                        <div className={cn(
                          "w-3 h-3 rounded-full",
                          log.status === 'success' ? "bg-emerald-500 shadow-lg shadow-emerald-200" : "bg-red-500 shadow-lg shadow-red-200"
                        )} />
                        <div className="min-w-0">
                           <p className="font-black text-zinc-900 text-xs truncate uppercase tracking-widest">
                              {webhooks.find(w => w.id === log.webhook_id)?.name || 'Webhook'}
                           </p>
                           <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                                 {log.event_type.replace(/_/g, ' ')}
                              </p>
                              <span className="text-[10px] text-zinc-300">•</span>
                              <p className="text-[10px] text-zinc-400 font-medium">
                                {formatSafeDate(log.created_at)}
                              </p>
                           </div>
                        </div>
                     </div>
                     <ChevronRight className="w-4 h-4 text-zinc-200 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                  </button>
                ))
              )}
           </div>
           
           <button 
             onClick={fetchData}
             className="w-full py-4 text-zinc-400 font-black text-[10px] uppercase tracking-[0.2em] hover:text-zinc-600 transition-all"
           >
             Ver todos os logs
           </button>
        </div>
      </div>

      {/* MODAL FORM */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsFormOpen(false)}
               className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
             />
             
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="bg-zinc-50 w-full max-w-5xl max-h-[90vh] rounded-[3.5rem] shadow-2xl relative overflow-hidden flex flex-col border border-white"
             >
                <header className="p-8 pb-4 flex items-center justify-between border-b border-zinc-200 bg-white shadow-sm">
                   <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-zinc-900 text-white rounded-3xl flex items-center justify-center shadow-lg shadow-zinc-200">
                         <Share2 className="w-7 h-7" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-black text-zinc-900 tracking-tighter uppercase italic">{editingWebhook ? 'Editar Webhook' : 'Novo Webhook'}</h2>
                        <p className="text-zinc-500 text-xs font-bold font-mono tracking-tight mt-1">{editingWebhook?.id || 'NOVA_CONEXAO_EXTERNA'}</p>
                      </div>
                   </div>
                   <button 
                     onClick={() => setIsFormOpen(false)}
                     className="p-4 bg-zinc-100 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 rounded-2xl transition-all"
                   >
                     <X className="w-6 h-6" />
                   </button>
                </header>

                <div className="flex-1 overflow-y-auto no-scrollbar p-8">
                   <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-10">
                        <section className="space-y-6">
                           <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] flex items-center gap-2">
                             <Info className="w-3 h-3 text-indigo-500" /> Identificação e Destino
                           </h3>
                           <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-4 italic">Nome do Webhook</label>
                                <input 
                                  type="text" 
                                  required
                                  value={formData.name || ''}
                                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                                  placeholder="Ex: Disparo Astroflow Workspace"
                                  className="w-full bg-white border border-zinc-200 rounded-[2.5rem] px-8 py-5 text-sm font-black focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all italic tracking-tight"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-4 italic">Descrição</label>
                                <input 
                                  type="text" 
                                  value={formData.description || ''}
                                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                                  placeholder="Para que serve este webhook?"
                                  className="w-full bg-white border border-zinc-200 rounded-[2.5rem] px-8 py-5 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all opacity-70"
                                />
                              </div>
                              <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-1 space-y-2 text-center flex flex-col items-center">
                                   <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Método</label>
                                   <select 
                                     value={formData.method || 'POST'}
                                     onChange={e => setFormData({ ...formData, method: e.target.value as any })}
                                     className="w-full bg-zinc-900 text-white border-0 rounded-[2rem] px-4 py-4 text-xs font-black uppercase tracking-widest appearance-none text-center cursor-pointer hover:bg-zinc-800 transition-all"
                                   >
                                     <option value="POST">POST</option>
                                     <option value="PUT">PUT</option>
                                     <option value="PATCH">PATCH</option>
                                   </select>
                                </div>
                                <div className="col-span-3 space-y-2">
                                   <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-4">URL do Endpoint</label>
                                   <input 
                                     type="url" 
                                     required
                                     value={formData.url || ''}
                                     onChange={e => setFormData({ ...formData, url: e.target.value })}
                                     placeholder="https://api.empresa.com/webhook"
                                     className="w-full bg-white border border-zinc-200 rounded-[2.5rem] px-8 py-5 text-sm font-bold font-mono focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                                   />
                                </div>
                              </div>
                           </div>
                        </section>

                        <section className="space-y-6">
                           <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] flex items-center gap-2">
                             <Shield className="w-3 h-3 text-indigo-500" /> Segurança e Autenticação
                           </h3>
                           <div className="bg-white border border-zinc-200 rounded-[3rem] p-8 space-y-8">
                              <div className="space-y-4">
                                 <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block italic">Tipo de Autenticação</label>
                                 <div className="grid grid-cols-2 gap-3">
                                    {[
                                      { id: 'none', label: 'Nenhuma', icon: Shield },
                                      { id: 'bearer', label: 'Bearer Token', icon: Key },
                                      { id: 'header', label: 'Custom Header', icon: Settings },
                                      { id: 'apikey', label: 'API Key', icon: ShieldCheck },
                                    ].map(auth => (
                                      <button
                                        key={auth.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, auth_type: auth.id as any })}
                                        className={cn(
                                          "flex items-center gap-3 px-5 py-4 rounded-3xl border transition-all text-xs font-black uppercase tracking-widest",
                                          formData.auth_type === auth.id 
                                            ? "bg-zinc-900 border-zinc-900 text-white shadow-xl shadow-zinc-200 scale-105" 
                                            : "bg-zinc-50 border-zinc-100 text-zinc-400 hover:border-zinc-300"
                                        )}
                                      >
                                        <auth.icon className="w-4 h-4" />
                                        {auth.label}
                                      </button>
                                    ))}
                                 </div>
                              </div>

                              {formData.auth_type !== 'none' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                                   {(['header', 'apikey'].includes(formData.auth_type || '')) && (
                                     <div className="space-y-2">
                                       <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-4 italic">Nome do Header</label>
                                       <input 
                                         type="text" 
                                         value={formData.auth_header_name || ''}
                                         onChange={e => setFormData({ ...formData, auth_header_name: e.target.value })}
                                         placeholder={formData.auth_type === 'apikey' ? 'X-API-KEY' : 'X-My-Auth'}
                                         className="w-full bg-zinc-50 border border-zinc-100 rounded-[2.5rem] px-8 py-4 text-xs font-black tracking-widest focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all font-mono"
                                       />
                                     </div>
                                   )}
                                   <div className="space-y-2">
                                     <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-4 italic">Valor do Token / Key</label>
                                     <div className="relative">
                                       <input 
                                         type="password" 
                                         value={formData.encrypted_secret_reference || ''}
                                         onChange={e => setFormData({ ...formData, encrypted_secret_reference: e.target.value })}
                                         placeholder={editingWebhook ? '••••••••••••••••' : 'Cole aqui seu token sensível'}
                                         className="w-full bg-zinc-50 border border-zinc-100 rounded-[2.5rem] px-8 py-5 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all placeholder:font-sans"
                                       />
                                     </div>
                                     <p className="text-[10px] text-zinc-400 px-4 italic">Tokens são persistidos de forma segura no backend.</p>
                                   </div>
                                </div>
                              )}
                           </div>
                        </section>
                      </div>

                      <div className="space-y-10">
                        <section className="space-y-6">
                           <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] flex items-center gap-2">
                             <Activity className="w-3 h-3 text-indigo-500" /> Gatilhos (Eventos)
                           </h3>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {EVENT_TYPES.map(event => {
                                const selected = (formData.event_types || []).includes(event.id);
                                return (
                                  <button
                                    key={event.id}
                                    type="button"
                                    onClick={() => {
                                      const current = formData.event_types || [];
                                      if (selected) {
                                        setFormData({ ...formData, event_types: current.filter(id => id !== event.id) });
                                      } else {
                                        setFormData({ ...formData, event_types: [...current, event.id] });
                                      }
                                    }}
                                    className={cn(
                                      "p-5 text-left rounded-[2rem] border transition-all flex items-start gap-4 group",
                                      selected 
                                        ? "bg-white border-zinc-900 shadow-xl shadow-zinc-100 ring-2 ring-zinc-900/10" 
                                        : "bg-white border-zinc-200 hover:border-zinc-400 opacity-60 hover:opacity-100"
                                    )}
                                  >
                                    <div className={cn(
                                      "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-all",
                                      selected ? "bg-zinc-900 text-white border-zinc-900" : "bg-zinc-50 text-zinc-300 border-zinc-100 group-hover:bg-zinc-200"
                                    )}>
                                       {selected ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-2 h-2 rounded-full bg-zinc-300" />}
                                    </div>
                                    <div className="min-w-0">
                                       <p className="text-[11px] font-black text-zinc-900 uppercase tracking-widest">{event.label}</p>
                                       <p className="text-[10px] text-zinc-400 font-medium italic leading-relaxed mt-0.5">{event.desc}</p>
                                    </div>
                                  </button>
                                );
                              })}
                           </div>
                        </section>

                        <section className="space-y-6">
                           <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] flex items-center gap-2">
                             <Code className="w-3 h-3 text-indigo-500" /> Configuração do Payload
                           </h3>
                           <div className="bg-white border border-zinc-200 rounded-[3rem] p-8 space-y-8">
                              <div className="flex p-1 bg-zinc-100 rounded-2xl w-full max-w-xs mx-auto">
                                <button 
                                  type="button"
                                  onClick={() => setFormData({ ...formData, payload_mode: 'default' })}
                                  className={cn(
                                    "flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                                    formData.payload_mode === 'default' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                                  )}
                                >
                                  Padrão
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => setFormData({ ...formData, payload_mode: 'custom' })}
                                  className={cn(
                                    "flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                                    formData.payload_mode === 'custom' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                                  )}
                                >
                                  JSON Customizado
                                </button>
                              </div>

                              <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block italic">Estrutura JSON</label>
                                  <div className="flex items-center gap-2">
                                     <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                     <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest italic tracking-tighter">Variáveis válidas</span>
                                  </div>
                                </div>
                                <textarea 
                                  rows={12}
                                  value={formData.payload_mode === 'default' ? DEFAULT_PAYLOAD : formData.custom_payload_template || ''}
                                  onChange={e => setFormData({ ...formData, custom_payload_template: e.target.value })}
                                  readOnly={formData.payload_mode === 'default'}
                                  placeholder={formData.payload_mode === 'custom' ? '{ "hint": "Sua chave vai aqui" }' : ''}
                                  className={cn(
                                    "w-full bg-zinc-900 text-indigo-300 border-0 rounded-[2.5rem] p-10 text-xs font-mono focus:outline-none focus:ring-4 focus:ring-indigo-100/50 transition-all custom-scrollbar leading-relaxed h-[400px]",
                                    formData.payload_mode === 'default' && "opacity-60 cursor-not-allowed select-none"
                                  )}
                                />
                                
                                <div className="p-6 bg-zinc-100 rounded-[2rem] border border-zinc-200">
                                   <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-4 text-center">Variáveis de Dinamização</p>
                                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      {VARIABLES.slice(0, 12).map(v => (
                                        <div key={v.key} className="p-2 bg-white rounded-lg border border-zinc-200 text-center cursor-help group relative" title={v.desc}>
                                           <code className="text-[9px] font-black text-zinc-600 group-hover:text-indigo-600 transition-all">{v.key}</code>
                                        </div>
                                      ))}
                                   </div>
                                </div>
                              </div>
                           </div>
                        </section>
                      </div>
                   </form>
                </div>

                <footer className="p-8 border-t border-zinc-200 bg-white flex items-center justify-between">
                   <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-3 h-3 rounded-full", formData.is_active ? "bg-emerald-500" : "bg-zinc-300")} />
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{formData.is_active ? 'WEBHOOK ATIVO' : 'WEBHOOK INATIVO'}</span>
                      </div>
                      <div className="w-px h-6 bg-zinc-100" />
                      <button 
                        type="button"
                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                      >
                        {formData.is_active ? 'Pausar Webhook' : 'Retomar Atividades'}
                      </button>
                   </div>
                   <div className="flex items-center gap-4">
                      <button 
                         onClick={() => setIsFormOpen(false)}
                         className="px-10 py-5 bg-zinc-100 text-zinc-400 hover:text-zinc-900 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all"
                      >
                         Cancelar
                      </button>
                      <button 
                         onClick={handleSave}
                         className="px-12 py-5 bg-zinc-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-zinc-200 flex items-center gap-3"
                      >
                         {editingWebhook ? <CheckCircle2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                         {editingWebhook ? 'Salvar Alterações' : 'Criar Webhook'}
                      </button>
                   </div>
                </footer>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LOG DRAWER */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-[150] flex justify-end">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setSelectedLog(null)}
               className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
             />
             
             <motion.div 
               initial={{ x: '100%' }}
               animate={{ x: 0 }}
               exit={{ x: '100%' }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className="relative w-full max-w-2xl bg-zinc-50 h-full shadow-2xl flex flex-col border-l border-white"
             >
                <header className="p-8 bg-white border-b border-zinc-200 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg",
                        selectedLog.status === 'success' ? "bg-emerald-500 shadow-emerald-100" : "bg-red-500 shadow-red-100"
                      )}>
                         <Terminal className="w-6 h-6" />
                      </div>
                      <div>
                         <h3 className="text-xl font-black text-zinc-900 uppercase tracking-tight italic">Detalhes da Execução</h3>
                         <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Trace ID: {selectedLog.trace_id}</p>
                      </div>
                   </div>
                   <button 
                     onClick={() => setSelectedLog(null)}
                     className="p-4 bg-zinc-100 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 rounded-2xl transition-all"
                   >
                     <X className="w-6 h-6" />
                   </button>
                </header>

                <div className="flex-1 overflow-y-auto p-10 space-y-10 no-scrollbar">
                   {/* Status Summary */}
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-6 rounded-[2.5rem] border border-zinc-200 shadow-sm flex flex-col justify-center">
                         <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 italic">Status Code</p>
                         <p className={cn(
                           "text-3xl font-black",
                           selectedLog.response_status_code >= 200 && selectedLog.response_status_code < 300 ? "text-emerald-500" : "text-red-500"
                         )}>
                           {selectedLog.response_status_code || "Sem Resposta"}
                         </p>
                      </div>
                      <div className="bg-white p-6 rounded-[2.5rem] border border-zinc-200 shadow-sm flex flex-col justify-center">
                         <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 italic">Tempo de Resposta</p>
                         <p className="text-3xl font-black text-zinc-900 tracking-tight">
                           {selectedLog.response_time_ms} <span className="text-sm font-bold text-zinc-400 opacity-50 uppercase">ms</span>
                         </p>
                      </div>
                   </div>

                   {/* Request Info */}
                   <section className="space-y-4">
                      <h4 className="text-[11px] font-black text-zinc-900 uppercase tracking-[0.2em] flex items-center gap-2 px-2">
                        <Globe className="w-4 h-4 text-indigo-500" /> Endpoint Request
                      </h4>
                      <div className="bg-zinc-900 rounded-[2.5rem] p-8 space-y-6 overflow-hidden">
                         <div className="space-y-2">
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">URL Completa</p>
                            <p className="text-xs font-mono text-zinc-300 break-all leading-relaxed bg-black/30 p-4 rounded-xl border border-white/5">{selectedLog.request_url}</p>
                         </div>
                         <div className="flex gap-8">
                            <div className="space-y-1">
                               <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Método</p>
                               <span className="px-3 py-1 bg-white/10 rounded-lg text-white text-[10px] font-black tracking-widest border border-white/10 uppercase">{selectedLog.request_method}</span>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Timestamp</p>
                               <span className="text-zinc-400 text-[10px] font-bold font-mono">{formatSafeDate(selectedLog.created_at)}</span>
                            </div>
                         </div>
                         <div className="space-y-4 pt-4 border-t border-white/5">
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Headers Enviados (Mascarados)</p>
                            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                               {selectedLog.request_headers_masked && Object.entries(selectedLog.request_headers_masked).map(([key, val]) => (
                                 <div key={key} className="flex items-start justify-between gap-4 p-2.5 bg-black/20 rounded-lg border border-white/5">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tight">{key}</span>
                                    <span className="text-[10px] font-mono text-zinc-500 break-all text-right">{String(val)}</span>
                                 </div>
                               ))}
                            </div>
                         </div>
                         <div className="space-y-2">
                            <p className="text-[9px] font-black text-zinc-500 uppercase trackingest">Payload Enviado</p>
                            <pre className="bg-black/30 p-6 rounded-2xl text-[10px] text-emerald-400 font-mono overflow-auto max-h-60 custom-scrollbar border border-white/5">
                               {JSON.stringify(selectedLog.request_payload, null, 2)}
                            </pre>
                         </div>
                      </div>
                   </section>

                   {/* Response Info */}
                   <section className="space-y-4 pb-10">
                      <h4 className="text-[11px] font-black text-zinc-900 uppercase tracking-[0.2em] flex items-center gap-2 px-2">
                        <Activity className="w-4 h-4 text-indigo-500" /> Response Body
                      </h4>
                      <div className={cn(
                        "rounded-[2.5rem] p-8 border-2 shadow-sm",
                        selectedLog.status === 'success' ? "bg-emerald-50/50 border-emerald-100" : "bg-red-50/50 border-red-100"
                      )}>
                         {selectedLog.error_message && (
                           <div className="mb-6 p-4 bg-red-100/50 border border-red-200 rounded-2xl flex items-start gap-3">
                              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black text-red-700 uppercase tracking-widest">Erro Diagnosticado</p>
                                 <p className="text-xs font-bold text-red-600 italic leading-relaxed">{selectedLog.error_message}</p>
                              </div>
                           </div>
                         )}
                         <pre className={cn(
                           "p-6 rounded-2xl text-[10px] font-mono overflow-auto max-h-80 custom-scrollbar border shadow-inner",
                           selectedLog.status === 'success' ? "bg-white text-zinc-800 border-emerald-200" : "bg-white text-red-800 border-red-200"
                         )}>
                            {(() => {
                              try {
                                const parsed = JSON.parse(selectedLog.response_body || '{}');
                                return JSON.stringify(parsed, null, 2);
                              } catch (e) {
                                return selectedLog.response_body || 'Sem corpo de resposta disponível.';
                              }
                            })()}
                         </pre>
                      </div>
                   </section>
                </div>

                <footer className="p-8 border-t border-zinc-200 bg-white shadow-sm">
                   <button 
                     onClick={() => setSelectedLog(null)}
                     className="w-full py-5 bg-zinc-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-100"
                   >
                     Fechar Detalhes
                   </button>
                </footer>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NEW: TEST PANEL & LOG DRAWER */}
      {activeTestWebhook && (
        <WebhookTestPanel 
          isOpen={isTestPanelOpen}
          onClose={() => {
            setIsTestPanelOpen(false);
            setActiveTestWebhook(null);
            setRepeatPayload(undefined);
          }}
          webhook={activeTestWebhook}
          initialPayload={repeatPayload}
          onTestSuccess={fetchData}
        />
      )}

      <WebhookDetailsDrawer 
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        webhookName={webhooks.find(w => w.id === selectedLog?.webhook_id)?.name}
        onRepeatTest={handleRepeatTestFromLog}
      />
    </div>
  );
}
