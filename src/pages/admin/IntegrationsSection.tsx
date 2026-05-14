import React from 'react';
import { Plug } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function IntegrationsAdminSection() {
  const integrations = [
    { name: 'Supabase', status: 'connected', desc: 'Database, Auth and Storage provider.' },
    { name: 'Google Gemini', status: 'connected', desc: 'AI engine for agents and generative memory.' },
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
          <div key={i} className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm hover:border-zinc-900 transition-all group">
             <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                  <Plug className="w-6 h-6" />
                </div>
                {it.status === 'connected' ? (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[9px] font-black uppercase">Conectado</span>
                ) : (
                  <span className="px-2 py-0.5 bg-zinc-100 text-zinc-400 border border-zinc-200 rounded-full text-[9px] font-black uppercase">Offline</span>
                )}
             </div>
             <h3 className="font-bold text-lg text-zinc-900 mb-2">{it.name}</h3>
             <p className="text-sm text-zinc-500 leading-relaxed mb-6">{it.desc}</p>
             <button className={cn(
               "w-full py-2.5 rounded-xl font-bold text-xs transition-all",
               it.status === 'connected' ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"
             )}>
               {it.status === 'connected' ? 'Configurar' : 'Conectar'}
             </button>
          </div>
        ))}
      </div>
    </div>
  );
}
