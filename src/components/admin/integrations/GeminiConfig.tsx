import React, { useState, useEffect } from 'react';
import { Cloud, CheckCircle2, ShieldAlert, Loader2, Play } from 'lucide-react';
import { cn } from '../../../lib/utils';

export const GeminiConfig = () => {
  const [models, setModels] = useState<any[]>([]);
  const [currentConfig, setCurrentConfig] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfigAndModels();
  }, []);

  async function fetchConfigAndModels() {
    setLoading(true);
    try {
      const [modelsRes, configRes] = await Promise.all([
        fetch('/api/admin/integrations/gemini/models'),
        fetch('/api/admin/integrations/gemini/config')
      ]);
      
      const modelsData = await modelsRes.json();
      const configData = await configRes.json();

      let availableModels = modelsData.models || [];
      if (availableModels.length === 0) {
         availableModels = [
            { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash (Fallback)" },
            { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro (Fallback)" },
            { id: "gemini-2.5-flash-lite", displayName: "Gemini 2.5 Flash Lite (Fallback)" },
         ];
      }

      setModels(availableModels);
      setCurrentConfig(configData);
      
      if (configData.defaultModel) {
        setSelectedModel(configData.defaultModel);
      } else if (availableModels.length > 0) {
        setSelectedModel(availableModels[0].id);
      }
    } catch (error) {
      console.error("Failed to load Gemini config:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    if (!selectedModel) return;
    setTesting(true);
    try {
      const response = await fetch('/api/admin/integrations/gemini/test-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao testar');
      alert(`Sucesso: ${data.message}`);
    } catch (error: any) {
      alert(`Erro no teste: ${error.message}`);
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!selectedModel) return;
    setSaving(true);
    try {
      const response = await fetch('/api/admin/integrations/gemini/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultModel: selectedModel, displayName: 'Google Gemini' }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'Falha ao salvar');
      
      alert("Modelo Gemini atualizado com sucesso. O novo modelo será usado pela Tona, MindFlow e geração de artefatos.");
      fetchConfigAndModels();
    } catch (error: any) {
      alert("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </section>
    );
  }

  return (
    <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-zinc-900 flex items-center gap-2">
          <Cloud className="w-5 h-5 text-purple-500" /> Infraestrutura
        </h3>
      </div>
      
      <div className="space-y-4">
        <div className="p-5 bg-zinc-900 rounded-[2rem] relative group overflow-hidden border border-zinc-800 shadow-lg">
          <div className="flex items-center justify-between mb-4 relative z-10">
             <div className="px-3 py-1 bg-white/10 rounded-lg backdrop-blur-sm border border-white/5">
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Provider</p>
                <p className="text-white text-xs font-black">Google Gemini</p>
             </div>
             <div className={cn(
               "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm",
               currentConfig?.keyExists && !currentConfig?.isPlaceholder 
                 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                 : "bg-red-500/20 text-red-400 border border-red-500/30"
             )}>
               Key: {currentConfig?.keyExists && !currentConfig?.isPlaceholder ? `Presente · ${currentConfig?.keySource}` : "Ausente / Placeholder"}
             </div>
          </div>

          <div className="space-y-1 relative z-10">
             <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Modelo Atual</p>
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <p className="text-white text-lg font-black tracking-tight">
                  {currentConfig?.defaultModel || "Indefinido"}
                </p>
                <div className={cn(
                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest w-fit",
                  currentConfig?.source === 'database' || currentConfig?.source === 'admin' ? "bg-indigo-500 text-white" : 
                  currentConfig?.source === 'env' ? "bg-amber-500 text-white" : "bg-zinc-700 text-zinc-300"
                )}>
                  Origem: {currentConfig?.source}
                </div>
             </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
        </div>

        <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl space-y-4">
          <div>
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest block mb-2">Alterar Modelo</label>
            <select 
              value={selectedModel} 
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full p-3 border border-zinc-300 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium text-sm text-zinc-800"
            >
              <option value="">Selecione um modelo</option>
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.displayName || m.name} ({m.id})</option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
             <button 
               onClick={handleTest}
               disabled={testing || !selectedModel}
               className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-zinc-300 text-zinc-700 rounded-xl font-bold text-xs hover:bg-zinc-50 transition-colors disabled:opacity-50"
             >
               {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
               Testar Modelo
             </button>
             <button 
               onClick={handleSave}
               disabled={saving || !selectedModel}
               className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-md shadow-indigo-100"
             >
               {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
               Salvar como padrão global
             </button>
          </div>
        </div>
        
        <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center justify-between">
           <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Embedding Engine</p>
              <p className="text-zinc-500 font-bold tracking-tight italic text-xs">Utilizando Google Embed-004</p>
           </div>
           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-200" />
        </div>
      </div>
    </section>
  );
};
