import React from 'react';
import { History } from 'lucide-react';

export default function AuditAdminSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Audit Log</h2>
        <p className="text-zinc-500 mt-1 font-medium italic">Histórico completo de ações administrativas e mudanças críticas de estado.</p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-3xl p-24 text-center">
         <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <History className="w-8 h-8 text-zinc-300" />
         </div>
         <h3 className="text-xl font-bold text-zinc-900 mb-2">Logs Indisponíveis</h3>
         <p className="text-zinc-500 max-w-sm mx-auto">
            A infraestrutura de auditoria centralizada está sendo preparada. 
            No momento, use as seções de Memória e Permissões para logs específicos.
         </p>
      </div>
    </div>
  );
}
