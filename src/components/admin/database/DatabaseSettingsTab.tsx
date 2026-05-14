import React, { useState } from 'react';
import { 
  Settings, FileCode, Database, Eye, EyeOff, 
  Shield, AlertTriangle, Save, RefreshCw, 
  Trash2, Download, Terminal, Braces, Info,
  CheckCircle2, Lock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';

export default function DatabaseSettingsTab() {
  const [showSensitive, setShowSensitive] = useState(false);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-4xl">
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
         <div className="p-8">
            <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2">Configurações do Módulo</h3>
            <p className="text-sm font-medium text-slate-500">Controle de visualização, limites e ações técnicas do console de banco de dados.</p>
         </div>

         <div className="p-8 space-y-8">
           {/* Display Settings */}
           <div className="space-y-6">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                 <Settings className="w-3 h-3" />
                 <span>Preferências de Visualização</span>
              </div>
              
              <div className="space-y-4">
                 <SettingItem 
                    label="Mostrar Tabelas de Sistema" 
                    description="Exibir coleções internas do Firebase e metadados técnicos."
                    checked={false}
                 />
                 <SettingItem 
                    label="Modo Somente Leitura" 
                    description="Bloqueia todas as ações de escrita e delete via console admin."
                    checked={true}
                 />
                 <SettingItem 
                    label="Mascarar Dados Sensíveis" 
                    description="Oculta emails, IDs e campos marcados como confidenciais."
                    checked={!showSensitive}
                    onChange={() => setShowSensitive(!showSensitive)}
                 />
              </div>
           </div>

           {/* Security Settings */}
           <div className="space-y-6">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                 <Shield className="w-3 h-3" />
                 <span>Segurança & Governança</span>
              </div>
              
              <div className="space-y-4">
                 <SettingItem 
                    label="Exigir Confirmação Dupla" 
                    description="Solicita confirmação textual para qualquer ação que afete mais de 100 registros."
                    checked={true}
                 />
                 <SettingItem 
                    label="Log de Auditoria Detalhado" 
                    description="Registra payloads completos em todas as operações (Pode afetar performance)."
                    checked={false}
                 />
              </div>
           </div>

           {/* Technical Limits */}
           <div className="space-y-6">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                 <Terminal className="w-3 h-3" />
                 <span>Limites Técnicos</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1.5 focus-within:border-indigo-200 transition-colors">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Timeout de Query (ms)</label>
                    <input type="number" defaultValue={5000} className="bg-transparent border-none p-0 text-sm font-black text-slate-900 focus:ring-0" />
                 </div>
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1.5 focus-within:border-indigo-200 transition-colors">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Limite de Linhas na Prévia</label>
                    <input type="number" defaultValue={20} className="bg-transparent border-none p-0 text-sm font-black text-slate-900 focus:ring-0" />
                 </div>
              </div>
           </div>
         </div>

         <div className="p-8 bg-slate-50 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
               <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Ambiente: <span className="text-slate-900 uppercase">Production</span>
               </span>
            </div>
            <div className="flex items-center gap-3">
               <button className="px-6 py-2.5 border border-slate-200 bg-white rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">
                  Resetar Padrões
               </button>
               <button className="flex items-center gap-2 px-8 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                  <Save className="w-4 h-4" />
                  Salvar Configurações
               </button>
            </div>
         </div>
      </div>

      <div className="p-8 bg-amber-50 rounded-[32px] border border-amber-100 flex gap-6 italic">
         <AlertTriangle className="w-10 h-10 text-amber-600 shrink-0" />
         <div className="space-y-2">
            <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Zona de Risco Técnico</h4>
            <p className="text-xs text-amber-900 leading-relaxed font-medium">
               Alterar estas configurações pode afetar a estabilidade do admin e a governança dos dados da Tona. Apenas usuários <span className="font-black italic underline">Owner</span> podem alterar políticas de segurança e limites de query em produção.
            </p>
         </div>
      </div>
    </div>
  );
}

function SettingItem({ label, description, checked, onChange }: { label: string, description: string, checked: boolean, onChange?: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white border border-slate-50 rounded-[20px] hover:border-slate-200 transition-all group">
       <div className="flex flex-col gap-0.5">
          <span className="text-sm font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors uppercase tracking-widest text-[11px]">{label}</span>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">{description}</p>
       </div>
       <button 
         onClick={onChange}
         className={cn(
           "w-12 h-6 rounded-full relative transition-all duration-300",
           checked ? "bg-indigo-600" : "bg-slate-200"
         )}
       >
          <div className={cn(
            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm",
            checked ? "left-7" : "left-1"
          )} />
       </button>
    </div>
  );
}
