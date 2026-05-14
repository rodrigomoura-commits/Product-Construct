import React, { useEffect, useState } from 'react';
import { Plug, AlertCircle, CheckCircle2, Loader2, RefreshCw, Settings2, Globe, ShieldAlert, CloudOff, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getLLMHealth } from '../../lib/geminiProxy';
import GeminiConfigReviewModal from '../../components/integrations/GeminiConfigReviewModal';
import { motion } from 'motion/react';

export default function IntegrationsAdminSection() {
  const [llmHealth, setLLMHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    const health = await getLLMHealth();
    setLLMHealth(health);
    setLoading(false);
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const getGeminiStatus = () => {
    if (loading) return { label: 'Verificando...', status: 'loading', color: 'bg-zinc-100 text-zinc-400 border-zinc-200' };
    
    switch (llmHealth?.status) {
      case 'connected':
        return { 
          label: 'Conectado', 
          status: 'connected', 
          color: 'bg-emerald-50 text-emerald-700 border-emerald-100', 
          message: llmHealth.message
        };
      case 'missing_key':
        return { 
          label: 'Erro de Config', 
          status: 'error', 
          color: 'bg-red-50 text-red-700 border-red-100', 
          message: llmHealth.message
        };
      case 'placeholder_key':
        return { 
          label: 'Chave Placeholder', 
          status: 'error', 
          color: 'bg-amber-50 text-amber-700 border-amber-100', 
          message: llmHealth.message
        };
      case 'invalid_key':
        return { 
          label: 'Key Inválida', 
          status: 'error', 
          color: 'bg-red-50 text-red-700 border-red-100', 
          message: llmHealth.message
        };
      case 'model_not_found':
        return { 
          label: 'Modelo Não Encontrado', 
          status: 'error', 
          color: 'bg-amber-50 text-amber-700 border-amber-100', 
          message: llmHealth.message
        };
      case 'model_method_not_supported':
        return { 
          label: 'Método Indisponível', 
          status: 'error', 
          color: 'bg-amber-50 text-amber-700 border-amber-100', 
          message: llmHealth.message
        };
      case 'api_disabled':
        return { 
          label: 'API Desabilitada', 
          status: 'error', 
          color: 'bg-amber-50 text-amber-700 border-amber-100', 
          message: llmHealth.message
        };
      case 'network_error':
        return { 
          label: 'Falha de Rede', 
          status: 'error', 
          color: 'bg-amber-50 text-amber-700 border-amber-100', 
          message: llmHealth.message
        };
      default:
        return { 
          label: 'Erro Desconhecido', 
          status: 'error', 
          color: 'bg-red-50 text-red-700 border-red-100', 
          message: llmHealth?.message || 'Erro desconhecido na integração.' 
        };
    }
  };

  const geminiStatus = getGeminiStatus();

  const integrations = [
    { 
      name: 'Google Gemini', 
      status: geminiStatus.status, 
      label: geminiStatus.label,
      color: geminiStatus.color,
      desc: 'AI engine for agents and generative memory.',
      error: geminiStatus.message,
      icon: Globe,
      isGemini: true
    },
    { name: 'Supabase', status: 'connected', label: 'Conectado', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', desc: 'Database, Auth and Storage provider.', icon: Settings2 },
    { name: 'Jira', status: 'disconnected', label: 'Offline', color: 'bg-zinc-100 text-zinc-400 border-zinc-200', desc: 'Sync product epics and stories with tickets.', icon: Plug },
    { name: 'Figma', status: 'disconnected', label: 'Offline', color: 'bg-zinc-100 text-zinc-400 border-zinc-200', desc: 'Embedded prototypes and design system sync.', icon: Settings2 },
    { name: 'Google Drive', status: 'disconnected', label: 'Offline', color: 'bg-zinc-100 text-zinc-400 border-zinc-200', desc: 'Source files for knowledge base.', icon: CloudOff },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Integrações Modernas</h2>
          <p className="text-zinc-500 mt-1 font-medium italic">Conecte o Product Constructor ao seu ecossistema de ferramentas.</p>
        </div>
        <button 
          onClick={checkHealth}
          className="p-3 bg-white border border-zinc-200 rounded-2xl hover:bg-zinc-50 transition-all text-zinc-400 hover:text-zinc-900 shadow-sm"
          title="Recarregar status"
        >
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((it, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "bg-white border rounded-[2.5rem] p-8 shadow-sm transition-all group relative overflow-hidden flex flex-col",
              it.status === 'error' ? "border-red-200 shadow-red-50" : "border-zinc-200 hover:border-zinc-900 hover:shadow-xl hover:shadow-zinc-100"
            )}
          >
             {it.status === 'error' && (
               <div className="absolute top-0 right-0 p-6">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
               </div>
             )}
             
             <div className="flex items-center justify-between mb-6">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110",
                  it.status === 'connected' ? "bg-emerald-50 text-emerald-600 shadow-lg shadow-emerald-100" : 
                  it.status === 'error' ? "bg-red-50 text-red-600 shadow-lg shadow-red-100" : "bg-zinc-50 text-zinc-400"
                )}>
                  {it.status === 'loading' ? <Loader2 className="w-6 h-6 animate-spin" /> : <it.icon className="w-7 h-7" />}
                </div>
                
                <span className={cn(
                  "px-3 py-1 border rounded-full text-[10px] font-black uppercase tracking-widest",
                  it.color
                )}>
                  {it.label}
                </span>
             </div>

             <h3 className="font-black text-xl text-zinc-900 mb-2 tracking-tight">{it.name}</h3>
             <p className="text-sm text-zinc-500 font-medium leading-relaxed mb-8 flex-1">{it.desc}</p>
             
             {it.error && (
               <div className="mb-6 flex items-start gap-2 bg-red-50/50 p-4 rounded-2xl border border-red-100">
                 <Info className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                 <p className="text-xs font-bold text-red-600 leading-tight">
                   {it.error}
                 </p>
               </div>
             )}

             <div className="flex gap-3">
               <button 
                 onClick={() => it.isGemini && setIsModalOpen(true)}
                 className={cn(
                   "flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg",
                   it.status === 'connected' ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 shadow-zinc-100 text-[9px]" : 
                   it.status === 'error' ? "bg-red-600 text-white hover:bg-red-700 shadow-red-200" : "bg-zinc-900 text-white hover:bg-zinc-800 shadow-zinc-200"
                 )}
               >
                 {it.status === 'connected' ? 'Gerenciar' : 
                  (it.isGemini && llmHealth?.status === 'api_disabled' ? 'Ver instruções' : 'Revisar Key')}
               </button>
               
               {it.isGemini && it.status === 'connected' && (
                 <button 
                   onClick={() => setIsModalOpen(true)}
                   className="px-4 py-3.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-2xl font-black text-[9px] uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-100"
                 >
                   Testar
                 </button>
               )}
             </div>
          </motion.div>
        ))}
      </div>

      <GeminiConfigReviewModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onStatusUpdate={checkHealth}
      />
    </div>
  );
}
