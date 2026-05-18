import React, { useEffect, useState } from 'react';
import { Settings, Shield, Bell, Cloud, Lock, Database, Loader2, RefreshCw, ChevronRight } from 'lucide-react';
import GeminiConfigReviewModal from '../../components/integrations/GeminiConfigReviewModal';
import { GeminiConfig } from '../../components/admin/integrations/GeminiConfig';
import { cn } from '../../lib/utils';

export default function SettingsAdminSection() {
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchConfig = async () => {
    // ... force children to reload or something. For now, it's ok.
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Configurações do Sistema</h2>
          <p className="text-zinc-500 mt-1 font-medium italic">Gerencie parâmetros globais, segurança e infraestrutura.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <div className="space-y-6">
            <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
               <h3 className="font-bold text-zinc-900 flex items-center gap-2 mb-4">
                 <Shield className="w-5 h-5 text-blue-500" /> Segurança & Acesso
               </h3>
               <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl">
                    <span className="text-sm font-semibold text-zinc-700">Login Social (Google)</span>
                    <span className="text-[10px] font-black text-emerald-600 uppercase">Habilitado</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl">
                    <span className="text-sm font-semibold text-zinc-700">Auto-registro de Perfis</span>
                    <span className="text-[10px] font-black text-amber-600 uppercase">Habilitado</span>
                  </div>
               </div>
            </section>

            <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
               <h3 className="font-bold text-zinc-900 flex items-center gap-2 mb-4">
                 <Database className="w-5 h-5 text-emerald-500" /> Dados & Memória
               </h3>
               <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl">
                    <span className="text-sm font-semibold text-zinc-700">Mindflow (Memória Adquirida) Ativa</span>
                    <div className="w-10 h-5 bg-zinc-900 rounded-full relative">
                      <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl">
                    <span className="text-sm font-semibold text-zinc-700">Auto-aprendizado (Experimental)</span>
                    <div className="w-10 h-5 bg-zinc-200 rounded-full relative">
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                    </div>
                  </div>
               </div>
            </section>
         </div>

         <div className="space-y-6">
            <GeminiConfig />
         </div>
      </div>

      <GeminiConfigReviewModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onStatusUpdate={fetchConfig}
      />
    </div>
  );
}
