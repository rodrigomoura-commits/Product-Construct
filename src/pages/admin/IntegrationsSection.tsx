import React, { useEffect, useState } from 'react';
import { Plug, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getLLMHealth } from '../../lib/geminiProxy';

export default function IntegrationsAdminSection() {
  const [llmHealth, setLLMHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkHealth() {
      const health = await getLLMHealth();
      setLLMHealth(health);
      setLoading(false);
    }
    checkHealth();
  }, []);

  const integrations = [
    { 
      name: 'Google Gemini', 
      status: loading ? 'loading' : (llmHealth?.status === 'success' ? 'connected' : 'error'), 
      desc: 'AI engine for agents and generative memory.',
      error: llmHealth?.status === 'error' ? (llmHealth.errorType === 'CONFIG_MISSING' ? 'Key Missing (GEMINI_API_KEY)' : 'Invalid Key') : null
    },
    { name: 'Supabase', status: 'connected', desc: 'Database, Auth and Storage provider.' },
    { name: 'Jira', status: 'disconnected', desc: 'Sync product epics and stories with tickets.' },
    { name: 'Figma', status: 'disconnected', desc: 'Embedded prototypes and design system sync.' },
    { name: 'Google Drive', status: 'disconnected', desc: 'Source files for knowledge base.' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Integrações Modernas</h2>
        <p className="text-zinc-500 mt-1 font-medium italic">Conecte o Product Constructor ao seu ecossistema de ferramentas.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((it, i) => (
          <div key={i} className={cn(
            "bg-white border rounded-3xl p-6 shadow-sm transition-all group relative overflow-hidden",
            it.status === 'error' ? "border-red-200" : "border-zinc-200 hover:border-zinc-900"
          )}>
             {it.status === 'error' && (
               <div className="absolute top-0 right-0 p-4">
                  <AlertCircle className="w-4 h-4 text-red-500" />
               </div>
             )}
             <div className="flex items-center justify-between mb-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                  it.status === 'connected' ? "bg-emerald-50 text-emerald-600" : 
                  it.status === 'error' ? "bg-red-50 text-red-600" : "bg-zinc-50 text-zinc-400"
                )}>
                  {it.status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plug className="w-6 h-6" />}
                </div>
                
                {it.status === 'connected' ? (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[9px] font-black uppercase">Conectado</span>
                ) : it.status === 'error' ? (
                  <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded-full text-[9px] font-black uppercase">Erro de Config</span>
                ) : it.status === 'loading' ? (
                  <span className="px-2 py-0.5 bg-zinc-100 text-zinc-400 border border-zinc-200 rounded-full text-[9px] font-black uppercase">Verificando...</span>
                ) : (
                  <span className="px-2 py-0.5 bg-zinc-100 text-zinc-400 border border-zinc-200 rounded-full text-[9px] font-black uppercase">Offline</span>
                )}
             </div>
             <h3 className="font-bold text-lg text-zinc-900 mb-2">{it.name}</h3>
             <p className="text-sm text-zinc-500 leading-relaxed mb-6">{it.desc}</p>
             
             {it.error && (
               <p className="text-[10px] font-bold text-red-500 mb-4 bg-red-50 p-2 rounded-lg border border-red-100">
                 {it.error}
               </p>
             )}

             <button className={cn(
               "w-full py-2.5 rounded-xl font-bold text-xs transition-all",
               it.status === 'connected' ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200" : 
               it.status === 'error' ? "bg-red-600 text-white hover:bg-red-700" : "bg-zinc-900 text-white hover:bg-zinc-800"
             )}>
               {it.status === 'connected' ? 'Configurar' : it.status === 'error' ? 'Revisar Key' : 'Conectar'}
             </button>
          </div>
        ))}
      </div>
    </div>
  );
}
