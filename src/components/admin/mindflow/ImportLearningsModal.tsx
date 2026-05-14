import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Upload, FileUp, CheckCircle2, AlertCircle, 
  Loader2, ChevronRight, LayoutGrid, Info, 
  Database, ShieldCheck, Brain, AlertTriangle,
  History, Settings2, Trash2, CheckCircle, DatabaseZap, Plus,
  FileText, Activity, Terminal, ClipboardCheck, Sparkles,
  ArrowRight, Download, ExternalLink, RefreshCw, XCircle, Eye
} from 'lucide-react';
import { cn, formatDate } from '../../../lib/utils';
import { AdminCtx, MindflowKnowledgeType, MindflowImportJob, MindflowImportJobEvent } from '../../../types';
import { 
  validateLearningImportCsv, 
  importMindflowLearningsFromCsvWithProgress,
  getImportJobStatus,
  LearningImportValidationResult,
  LearningImportOptions
} from '../../../lib/mindflowImport';
import { toast } from 'react-hot-toast';

interface ImportLearningsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctx: AdminCtx;
}

type ImportStep = 'upload' | 'validation' | 'processing' | 'result' | 'report';

export default function ImportLearningsModal({ isOpen, onClose, ctx }: ImportLearningsModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [validationResult, setValidationResult] = useState<LearningImportValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<MindflowImportJob | null>(null);
  const [events, setEvents] = useState<MindflowImportJobEvent[]>([]);
  
  const [options, setOptions] = useState<LearningImportOptions>({
    defaultType: 'Adquirida',
    ignoreDuplicates: true,
    generateReasonings: true,
    runConflictDetection: true
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error("Por favor, selecione um arquivo CSV.");
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Limite de 5MB.");
        return;
      }
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        setFileContent(event.target?.result as string);
        processValidation(event.target?.result as string, selectedFile);
      };
      reader.readAsText(selectedFile);
    }
  };

  const processValidation = async (content: string, selectedFile: File) => {
    setIsLoading(true);
    try {
      const result = await validateLearningImportCsv(content, options);
      setValidationResult(result);
      if (result.is_valid) {
        setStep('validation');
      } else {
        toast.error("Arquivo CSV inválido.");
      }
    } catch (e) {
      toast.error("Erro na validação do arquivo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartImport = async () => {
    if (!file) return;
    setIsLoading(true);
    setStep('processing');
    try {
      const newJobId = await importMindflowLearningsFromCsvWithProgress(
        ctx.userId, 
        file.name, 
        file.size, 
        fileContent, 
        options
      );
      setJobId(newJobId);
      pollJobStatus(newJobId);
    } catch (e: any) {
      toast.error(e.message || "Falha ao iniciar importação.");
      setIsLoading(false);
      setStep('validation');
    }
  };

  const pollJobStatus = async (id: string) => {
    try {
      const { job: updatedJob, events: updatedEvents } = await getImportJobStatus(id);
      setJob(updatedJob);
      setEvents(updatedEvents);
      
      if (updatedJob.status === 'completed' || updatedJob.status === 'completed_with_warnings' || updatedJob.status === 'failed') {
        setStep('result');
        setIsLoading(false);
        return;
      }
      
      setTimeout(() => pollJobStatus(id), 1000);
    } catch (error) {
      console.error('Polling error:', error);
      // Fallback: stop polling if too many errors? 
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info className="w-4 h-4 text-blue-500" />;
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-rose-500" />;
      case 'reasoning': return <Sparkles className="w-4 h-4 text-indigo-500" />;
      case 'conflict': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'system': return <Settings2 className="w-4 h-4 text-zinc-500" />;
      default: return <Info className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md" 
        onClick={step !== 'processing' ? onClose : undefined} 
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[3rem] shadow-2xl relative w-full max-w-4xl max-h-[90vh] overflow-hidden border border-zinc-200 flex flex-col"
      >
        {/* Header */}
        <div className="p-8 md:p-10 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
               <Upload className="w-7 h-7" />
            </div>
            <div>
               <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Importar Aprendizagens</h2>
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Concuratela de Conhecimento via CSV</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={step === 'processing'}
            className="w-11 h-11 bg-white border border-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 hover:text-rose-500 hover:border-rose-100 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-8 md:p-10">
          <AnimatePresence mode="wait">
            {step === 'upload' && (
              <motion.div 
                key="upload"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-4 border-dashed border-zinc-100 rounded-[3rem] p-20 flex flex-col items-center justify-center text-center hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                >
                   <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl border border-zinc-100 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                      {isLoading ? (
                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                      ) : (
                        <FileUp className="w-10 h-10 text-indigo-500" />
                      )}
                   </div>
                   <h3 className="text-2xl font-black text-zinc-800 mb-2 underline decoration-indigo-500 decoration-4 underline-offset-4">Clique para selecionar seu CSV</h3>
                   <p className="text-zinc-400 font-medium max-w-sm">Ou arraste e solte o arquivo aqui. <br/><span className="text-[10px] uppercase font-black">Limite de 5MB • Formato CSV</span></p>
                   <input 
                     type="file" 
                     ref={fileInputRef} 
                     onChange={handleFileChange} 
                     accept=".csv" 
                     className="hidden" 
                   />
                </div>

                <div className="bg-zinc-50 border border-zinc-100 rounded-[2rem] p-8">
                   <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Info className="w-4 h-4" /> Layout esperado do CSV
                   </h4>
                   <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {['Data', 'Tipo de Conhecimento', 'Tema', 'Sub_Tema', 'Conhecimento'].map(col => (
                        <div key={col} className="bg-white border border-zinc-200 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                           <span className="text-[10px] font-black text-zinc-800">{col}</span>
                           <span className={cn(
                             "text-[8px] font-bold uppercase mt-1",
                             col === 'Conhecimento' ? "text-rose-500" : "text-zinc-400"
                           )}>
                             {col === 'Conhecimento' ? "Obrigatório" : "Opcional"}
                           </span>
                        </div>
                      ))}
                   </div>
                </div>
              </motion.div>
            )}

            {step === 'validation' && validationResult && (
              <motion.div 
                key="validation"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-10"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="bg-zinc-50 rounded-[2rem] p-6 border border-zinc-100">
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total de Linhas</p>
                      <p className="text-3xl font-black text-zinc-900">{validationResult.total_rows}</p>
                   </div>
                   <div className="bg-emerald-50 rounded-[2rem] p-6 border border-emerald-100">
                      <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Linhas Válidas</p>
                      <div className="flex items-center gap-3">
                        <p className="text-3xl font-black text-emerald-600">{validationResult.valid_rows}</p>
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      </div>
                   </div>
                   <div className="bg-rose-50 rounded-[2rem] p-6 border border-rose-100">
                      <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Erros Críticos</p>
                      <div className="flex items-center gap-3">
                        <p className="text-3xl font-black text-rose-600">{validationResult.error_rows}</p>
                        {validationResult.error_rows > 0 && <AlertCircle className="w-6 h-6 text-rose-500" />}
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <h4 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                      <LayoutGrid className="w-6 h-6 text-zinc-300" /> Preview dos Dados (V2)
                   </h4>
                   <div className="border border-zinc-100 rounded-[2rem] overflow-hidden bg-white shadow-inner">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 border-b border-zinc-100">
                           <tr>
                              <th className="px-6 py-4 font-black uppercase text-zinc-400 tracking-widest">Tema</th>
                              <th className="px-6 py-4 font-black uppercase text-zinc-400 tracking-widest">Tipo</th>
                              <th className="px-6 py-4 font-black uppercase text-zinc-400 tracking-widest">Conhecimento</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                           {validationResult.preview.map((row, i) => (
                             <tr key={i}>
                                <td className="px-6 py-4 font-bold text-zinc-700">{row.Tema || row.theme || "---"}</td>
                                <td className="px-6 py-4">
                                   <span className="px-2 py-0.5 bg-zinc-100 rounded text-[9px] font-black uppercase">
                                     {row['Tipo de Conhecimento'] || row.learning_type || "Adquirida"}
                                   </span>
                                </td>
                                <td className="px-6 py-4 text-zinc-500 line-clamp-1 italic">{row.Conhecimento || row.learning}</td>
                             </tr>
                           ))}
                        </tbody>
                      </table>
                   </div>
                </div>

                <div className="bg-zinc-50 rounded-[2.5rem] p-8 border border-zinc-200">
                   <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Settings2 className="w-4 h-4" /> Opções de Ingestão
                   </h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                         <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-zinc-100">
                            <div>
                               <p className="text-xs font-black text-zinc-800">Tipo Padrão</p>
                               <p className="text-[10px] text-zinc-400 font-medium">Se o CSV não especificar</p>
                            </div>
                            <div className="flex bg-zinc-50 p-1.5 rounded-xl border border-zinc-100">
                               <button 
                                 onClick={() => setOptions(o => ({ ...o, defaultType: 'Adquirida' }))}
                                 className={cn("px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all", options.defaultType === 'Adquirida' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}
                               >Adquirida</button>
                               <button 
                                 onClick={() => setOptions(o => ({ ...o, defaultType: 'Base' }))}
                                 className={cn("px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all", options.defaultType === 'Base' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}
                               >Base</button>
                            </div>
                         </div>

                         <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-zinc-100">
                            <div>
                               <p className="text-xs font-black text-zinc-800">Ignorar Duplicadas</p>
                               <p className="text-[10px] text-zinc-400 font-medium">Evita itens repetidos na base</p>
                            </div>
                            <button 
                              onClick={() => setOptions(o => ({ ...o, ignoreDuplicates: !o.ignoreDuplicates }))}
                              className={cn(
                                "w-14 h-8 rounded-full flex items-center px-1 transition-all",
                                options.ignoreDuplicates ? "bg-indigo-600" : "bg-zinc-200"
                              )}
                            >
                               <div className={cn("w-6 h-6 bg-white rounded-full shadow-sm transition-transform", options.ignoreDuplicates ? "translate-x-6" : "translate-x-0")} />
                            </button>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-zinc-100">
                            <div>
                               <p className="text-xs font-black text-zinc-800">Deteção de Conflitos</p>
                               <p className="text-[10px] text-zinc-400 font-medium">Auto-executa auditoria pós-import</p>
                            </div>
                            <button 
                              onClick={() => setOptions(o => ({ ...o, runConflictDetection: !o.runConflictDetection }))}
                              className={cn(
                                "w-14 h-8 rounded-full flex items-center px-1 transition-all",
                                options.runConflictDetection ? "bg-indigo-600" : "bg-zinc-200"
                              )}
                            >
                               <div className={cn("w-6 h-6 bg-white rounded-full shadow-sm transition-transform", options.runConflictDetection ? "translate-x-6" : "translate-x-0")} />
                            </button>
                         </div>

                         <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-zinc-100">
                            <div>
                               <p className="text-xs font-black text-zinc-800">Gerar Raciocínios</p>
                               <p className="text-[10px] text-zinc-400 font-medium font-bold italic">Processamento Cognitivo Ativo</p>
                            </div>
                            <button 
                              onClick={() => setOptions(o => ({ ...o, generateReasonings: !o.generateReasonings }))}
                              className={cn(
                                "w-14 h-8 rounded-full flex items-center px-1 transition-all",
                                options.generateReasonings ? "bg-indigo-600" : "bg-zinc-200"
                              )}
                            >
                               <div className={cn("w-6 h-6 bg-white rounded-full shadow-sm transition-transform", options.generateReasonings ? "translate-x-6" : "translate-x-0")} />
                            </button>
                         </div>
                      </div>
                   </div>
                </div>

                {validationResult.errors.length > 0 && (
                   <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6">
                      <h5 className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                         <AlertTriangle className="w-4 h-4" /> Problemas Encontrados
                      </h5>
                      <ul className="space-y-1.5">
                         {validationResult.errors.slice(0, 3).map((err, i) => (
                           <li key={i} className="text-xs font-medium text-rose-800 flex items-center gap-2 select-none">
                              <div className="w-1 h-1 bg-rose-400 rounded-full" /> {err}
                           </li>
                         ))}
                         {validationResult.errors.length > 3 && (
                           <li className="text-[10px] font-bold text-rose-400 italic">...e mais {validationResult.errors.length - 3} erros.</li>
                         )}
                      </ul>
                   </div>
                )}
              </motion.div>
            )}

            {step === 'processing' && (
              <motion.div 
                key="processing"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="space-y-12 py-10"
              >
                 <div className="flex flex-col items-center justify-center text-center">
                    <div className="relative mb-12">
                      <div className="absolute inset-0 bg-indigo-500/20 blur-3xl animate-pulse rounded-full" />
                      <DatabaseZap className="w-24 h-24 text-indigo-500 animate-bounce relative z-10" />
                    </div>
                    <h3 className="text-4xl font-black text-zinc-900 tracking-tighter mb-4">
                      {Math.round(job?.progress || 0)}%
                    </h3>
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">
                      {job?.current_step || 'Iniciando operação cognitiva...'}
                    </p>
                    <p className="text-zinc-400 font-medium max-w-sm mt-3 italic">
                      "{job?.current_message || 'Preparando lote de dados para ingestão.'}"
                    </p>
                 </div>

                 <div className="space-y-6">
                    <div className="w-full h-4 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                       <motion.div 
                         className="h-full bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                         initial={{ width: "0%" }}
                         animate={{ width: `${job?.progress || 0}%` }}
                         transition={{ duration: 0.5 }}
                       />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       <div className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm">
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Processados</p>
                          <p className="text-2xl font-black text-zinc-900">{job?.imported_rows || 0}</p>
                       </div>
                       <div className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm">
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Duplicados</p>
                          <p className="text-2xl font-black text-zinc-900">{job?.duplicate_rows || 0}</p>
                       </div>
                       <div className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm">
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Base</p>
                          <p className="text-2xl font-black text-zinc-900">{job?.base_rows || 0}</p>
                       </div>
                       <div className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm">
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Erros</p>
                          <p className="text-2xl font-black text-zinc-900">{job?.error_rows || 0}</p>
                       </div>
                    </div>

                    <div className="bg-zinc-900 rounded-[2.5rem] p-8 overflow-hidden relative">
                       <div className="absolute top-0 right-0 p-8 opacity-10">
                          <Terminal className="w-32 h-32 text-zinc-400" />
                       </div>
                       <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <Activity className="w-3 h-3" /> Trilha da Importação em Tempo Real
                       </h4>
                       <div 
                         ref={scrollRef}
                         className="h-48 overflow-y-auto space-y-3 font-mono text-[11px] no-scrollbar pr-4"
                       >
                          {events.map((ev, i) => (
                            <motion.div 
                              key={ev.id || i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-start gap-3 group"
                            >
                               <span className="text-zinc-600 shrink-0">{new Date(ev.created_at?.seconds * 1000 || Date.now()).toLocaleTimeString()}</span>
                               <div className="shrink-0 mt-0.5">{getEventIcon(ev.event_type)}</div>
                               <span className={cn(
                                 "flex-1",
                                 ev.event_type === 'error' ? "text-rose-400" :
                                 ev.event_type === 'success' ? "text-emerald-400" :
                                 ev.event_type === 'reasoning' ? "text-indigo-300" :
                                 "text-zinc-300"
                               )}>
                                 {ev.message}
                               </span>
                            </motion.div>
                          ))}
                          {events.length === 0 && (
                            <div className="text-zinc-700 italic">Aguardando sinais vitais...</div>
                          )}
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}

            {step === 'result' && job && (
              <motion.div 
                key="result"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="space-y-10"
              >
                 <div className="flex flex-col items-center text-center">
                    <div className="w-24 h-24 bg-emerald-100 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-xl shadow-emerald-50">
                       <CheckCircle className="w-12 h-12 text-emerald-600" />
                    </div>
                    <h3 className="text-4xl font-black text-zinc-900 tracking-tighter">Ingestão Concluída!</h3>
                    <p className="text-zinc-500 font-medium mt-2 max-w-md text-lg italic leading-relaxed">
                      O processo de importação foi finalizado. {job.imported_rows} novos aprendizados foram integrados à Tona.
                    </p>
                 </div>

                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <div className="bg-white border border-zinc-100 rounded-3xl p-6 text-center shadow-sm">
                       <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Importados</p>
                       <p className="text-3xl font-black text-zinc-900">{job.imported_rows}</p>
                    </div>
                    <div className="bg-white border border-zinc-100 rounded-3xl p-6 text-center shadow-sm">
                       <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Duplicadas</p>
                       <p className="text-3xl font-black text-zinc-900">{job.duplicate_rows}</p>
                    </div>
                    <div className="bg-white border border-zinc-100 rounded-3xl p-6 text-center shadow-sm">
                       <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Base</p>
                       <p className="text-3xl font-black text-zinc-900">{job.base_rows}</p>
                    </div>
                    <div className="bg-white border border-zinc-100 rounded-3xl p-6 text-center shadow-sm">
                       <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Conflitos</p>
                       <p className="text-3xl font-black text-amber-600">{job.conflicts_detected || 0}</p>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 text-center shadow-sm">
                       <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Raciocínios</p>
                       <p className="text-3xl font-black text-indigo-600">{job.reasonings_created || 0}</p>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 rounded-3xl p-6 text-center shadow-sm">
                       <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Erros</p>
                       <p className="text-3xl font-black text-rose-600">{job.error_rows}</p>
                    </div>
                 </div>

                 <div className="bg-zinc-900 rounded-[3rem] p-10 text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-10 opacity-10">
                       <Brain className="w-40 h-40 text-amber-500" />
                    </div>
                    
                    <div className="relative z-10">
                       <div className="flex items-center gap-4 mb-6">
                          <div className="px-4 py-1.5 bg-amber-500 rounded-full text-[10px] font-black uppercase text-zinc-950">Síntese Ativa</div>
                          <div className="h-px bg-zinc-800 flex-1" />
                       </div>
                       
                       <h4 className="text-2xl font-black tracking-tight mb-4 uppercase">Raciocínios Profundos Gerados</h4>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                          <div className="space-y-4">
                             <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-2xl border border-zinc-700/50">
                                <span className="text-xs font-bold text-zinc-400">Ativados Imediatamente</span>
                                <span className="text-xl font-black text-emerald-400">{job.reasonings_activated || 0}</span>
                             </div>
                             <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-2xl border border-zinc-700/50">
                                <span className="text-xs font-bold text-zinc-400">Aguardando Revisão</span>
                                <span className="text-xl font-black text-amber-400">{job.reasonings_pending_review || 0}</span>
                             </div>
                          </div>
                          <div className="space-y-4">
                             <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-2xl border border-zinc-700/50">
                                <span className="text-xs font-bold text-zinc-400">Rejeitados (Rasos)</span>
                                <span className="text-xl font-black text-zinc-500">{job.reasonings_rejected_as_shallow || 0}</span>
                             </div>
                             <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-2xl border border-zinc-700/50">
                                <span className="text-xs font-bold text-zinc-400">Bloqueados por Conflito</span>
                                <span className="text-xl font-black text-rose-400">{job.reasonings_blocked_by_base_conflict || 0}</span>
                             </div>
                          </div>
                       </div>
                       
                       <div className="flex flex-col md:flex-row gap-4">
                          <button className="flex-1 px-8 py-5 bg-white text-zinc-900 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                             <Eye className="w-4 h-4" /> Ver Aprendizagens Importadas
                          </button>
                          <button className="flex-1 px-8 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                             <Brain className="w-4 h-4" /> Ver Raciocínios Gerados
                          </button>
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {step !== 'processing' && step !== 'result' && (
          <div className="p-8 md:p-10 bg-zinc-50 border-t border-zinc-100 flex justify-between items-center">
            <button 
              onClick={step === 'validation' ? () => setStep('upload') : onClose}
              className="px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all"
            >
              {step === 'validation' ? 'Voltar' : 'Cancelar'}
            </button>
            <div className="flex gap-4">
              {step === 'validation' && (
                <>
                  <button 
                    onClick={() => {
                      setFile(null);
                      setFileContent('');
                      setStep('upload');
                    }}
                    className="px-8 py-4 rounded-2xl bg-white border border-zinc-200 text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Limpar Arquivo
                  </button>
                  <button 
                    onClick={handleStartImport}
                    disabled={validationResult?.valid_rows === 0}
                    className="px-10 py-4 bg-zinc-900 text-white rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-zinc-200 flex items-center gap-3 disabled:opacity-50"
                  >
                    Importar Aprendizagens <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
