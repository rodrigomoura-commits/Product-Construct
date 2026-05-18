import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Loader2, CheckCircle2, Info } from 'lucide-react';
import { Product } from '../../types';
import toast from 'react-hot-toast';
import { uploadProductDocument, ProductDocumentUploadProgress } from '../../lib/productDocuments';

interface Props {
  product: Product;
  user: any;
  activeStage?: string;
  onClose: () => void;
  onUploadComplete?: () => void;
}

export default function ProductDocumentUploadModal({ product, user, activeStage, onClose, onUploadComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [stageKey, setStageKey] = useState<string>(activeStage || '');
  const [autoAddToMemory, setAutoAddToMemory] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<ProductDocumentUploadProgress | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    
    try {
      await uploadProductDocument({
        product,
        file,
        stageKey,
        source: "documents_tab",
        autoProcess: true,
        autoAddToMemory,
        currentUser: user,
        onProgress: (p) => {
          setUploadProgress(p);
        }
      });

      toast.success('Documento enviado! A Tona está analisando...');
      onUploadComplete?.();
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erro ao salvar documento');
    } finally {
      setUploading(false);
    }
  };

  const stages = [
    { id: 'sense', label: 'Entender o Problema' },
    { id: 'shape', label: 'Definir a Proposta' },
    { id: 'sketch', label: 'Visualizar a Solução' },
    { id: 'scope', label: 'Planejar o MVP' },
    { id: 'ship', label: 'Preparar a Entrega' },
    { id: 'sense_plus', label: 'Acompanhar e Aprender' },
  ];

  return (
    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-zinc-900">Adicionar Documento</h2>
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">Leitura Inteligente</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {!file ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-100 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer group"
            >
              <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-zinc-300 group-hover:text-indigo-500" />
              </div>
              <p className="text-sm font-bold text-zinc-900">Clique ou arraste um arquivo</p>
              <p className="text-xs text-zinc-400 mt-2">PDF, DOCX, TXT, MD ou CSV (máx 20MB)</p>
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                onChange={handleFileSelect}
                accept=".pdf,.docx,.txt,.md,.markdown,.csv"
              />
            </div>
          ) : (
            <div className="p-6 bg-zinc-50 rounded-[2rem] border border-zinc-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-zinc-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-zinc-900 truncate">{file.name}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button 
                onClick={() => setFile(null)}
                className="p-2 hover:bg-white rounded-lg text-zinc-400 hover:text-rose-500 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Etapa Relacionada</label>
            <select 
              value={stageKey}
              onChange={(e) => setStageKey(e.target.value)}
              className="w-full h-12 px-4 bg-zinc-50 border border-zinc-100 rounded-xl text-sm font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Não vincular a etapa específica</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-start gap-3 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
            <input 
              type="checkbox" 
              id="auto-memory"
              checked={autoAddToMemory}
              onChange={(e) => setAutoAddToMemory(e.target.checked)}
              className="mt-1 w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500"
            />
            <div className="flex-1">
              <label htmlFor="auto-memory" className="text-xs font-bold text-zinc-900 cursor-pointer">
                Adicionar extrações relevantes à memória do produto automaticamente
              </label>
              <p className="text-[10px] text-zinc-500 mt-1">
                A Tona vai filtrar apenas os fatos e evidências com alta confiança.
              </p>
            </div>
          </div>

          {uploading && uploadProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-indigo-600">{uploadProgress.message}</span>
                <span className="text-zinc-400">{Math.round(uploadProgress.percent)}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Info className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Análise via Gemini 2.0</span>
          </div>
          <button 
            disabled={!file || uploading}
            onClick={handleUpload}
            className="px-8 py-4 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando e Analisando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Enviar e Analisar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
