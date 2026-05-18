import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../../lib/firebase';
import { ref, deleteObject } from 'firebase/storage';
import { Product, ProductDocument, ProductDocumentExtraction } from '../../types';
import { 
  FileText, Plus, Search, Filter, Loader2, 
  CheckCircle2, AlertCircle, Clock, Trash2, 
  RefreshCcw, Eye, Download, ChevronRight, 
  Tag, Info, MoreVertical, X
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import ProductDocumentUploadModal from './ProductDocumentUploadModal';

interface Props {
  product: Product;
  activeStage?: string;
  user: any;
  onProductUpdated?: () => void;
  onMemoryUpdated?: () => void;
}

export default function ProductDocumentsPanel({ product, activeStage, user, onProductUpdated, onMemoryUpdated }: Props) {
  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<ProductDocument | null>(null);
  const [extractions, setExtractions] = useState<any[]>([]);
  const [loadingExtractions, setLoadingExtractions] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'products', product.id, 'documents'),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProductDocument));
      setDocuments(docs.filter(d => d.status !== 'deleted'));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [product.id]);

  useEffect(() => {
    if (selectedDoc) {
      loadExtractions(selectedDoc);
    } else {
      setExtractions([]);
    }
  }, [selectedDoc]);

  async function loadExtractions(document: ProductDocument) {
    setLoadingExtractions(true);
    try {
      const q = query(
        collection(db, 'products', product.id, 'documents', document.id, 'extractions'),
        orderBy('created_at', 'asc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setExtractions(items);
        setLoadingExtractions(false);
      });

      return unsubscribe;
    } catch (e) {
      console.error(e);
      setLoadingExtractions(false);
    }
  }

  const handleReprocess = async (docObj: ProductDocument) => {
    try {
      toast.loading('Iniciando reprocessamento...');
      await updateDoc(doc(db, 'products', product.id, 'documents', docObj.id), {
        status: 'uploading',
        updated_at: serverTimestamp(),
        error_message: null
      });

      const response = await fetch(`/api/products/${product.id}/documents/${docObj.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storagePath: docObj.storage_path,
          fileName: docObj.file_name,
          mimeType: docObj.mime_type,
          stageKey: docObj.stage_key,
          autoAddToMemory: true,
          userId: user.uid,
          userEmail: user.email,
          userName: user.displayName
        })
      });

      if (!response.ok) throw new Error('Falha ao reprocessar.');
      toast.dismiss();
      toast.success('Reprocessamento iniciado!');
    } catch (e: any) {
      toast.dismiss();
      toast.error(e.message);
    }
  };

  const handleDelete = async (docObj: ProductDocument) => {
    if (!window.confirm('Tem certeza que deseja excluir este documento?')) return;

    try {
      // Soft delete in Firestore
      await updateDoc(doc(db, 'products', product.id, 'documents', docObj.id), {
        status: 'deleted',
        updated_at: serverTimestamp()
      });

      // Optionally delete from Storage
      if (docObj.storage_path) {
        const storageRef = ref(storage, docObj.storage_path);
        await deleteObject(storageRef).catch(err => console.warn('Storage delete fail:', err));
      }

      toast.success('Documento excluído.');
    } catch (e) {
      toast.error('Erro ao excluir documento.');
    }
  };

  const getStatusIcon = (status: ProductDocument['status']) => {
    switch (status) {
      case 'processed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'uploading':
      case 'uploaded':
      case 'extracting_text':
      case 'processing_ai': return <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />;
      default: return <Clock className="w-4 h-4 text-zinc-300" />;
    }
  };

  const getStatusLabel = (status: ProductDocument['status']) => {
    switch (status) {
      case 'processed': return 'Processado';
      case 'failed': return 'Falha';
      case 'uploading': return 'Enviando...';
      case 'uploaded': return 'Recebido';
      case 'extracting_text': return 'Lendo texto...';
      case 'processing_ai': return 'Analisando...';
      default: return status;
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <h2 className="text-3xl font-black text-zinc-900 leading-tight">Leitura Inteligente</h2>
           <p className="text-zinc-500 font-medium italic mt-1 max-w-2xl text-sm">
             Suba notas de discovery, métricas, pesquisas ou documentos de produto. A Tona extrai fatos, hipóteses e decisões para alimentar a jornada.
           </p>
        </div>
        <button 
          onClick={() => setShowUpload(true)}
          className="px-6 py-4 bg-zinc-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200 flex items-center gap-3 self-start md:self-auto active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Adicionar Documento
        </button>
      </div>

      {/* States */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center space-y-4">
           <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
           <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Carregando documentos...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-[3rem] p-12 text-center border-2 border-dashed border-zinc-100 flex flex-col items-center justify-center space-y-6">
           <div className="w-20 h-20 bg-zinc-50 rounded-[2rem] flex items-center justify-center">
              <FileText className="w-10 h-10 text-zinc-200" />
           </div>
           <div className="space-y-2">
              <h3 className="text-lg font-black text-zinc-900">Nenhum documento processado ainda</h3>
              <p className="text-sm text-zinc-400 max-w-md mx-auto italic font-medium">
                Envie documentos de discovery, pesquisas, métricas, entrevistas ou planilhas. A Tona vai extrair sinais úteis para o seu produto.
              </p>
           </div>
           <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              {['PDF', 'DOCX', 'TXT', 'MARKDOWN', 'CSV'].map(format => (
                 <span key={format} className="px-3 py-1 bg-zinc-50 rounded-lg text-[9px] font-black text-zinc-400 border border-zinc-100 uppercase tracking-widest">
                    {format}
                 </span>
              ))}
           </div>
           <button 
             onClick={() => setShowUpload(true)}
             className="px-8 py-4 bg-zinc-50 text-zinc-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all border border-zinc-100"
           >
             Subir meu primeiro documento
           </button>
        </div>
      ) : (
        <div className="space-y-4">
           <div className="flex items-center gap-4 bg-white p-2 rounded-[2rem] border border-zinc-100 shadow-sm max-w-md">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-50 shrink-0">
                 <Search className="w-4 h-4 text-zinc-400" />
              </div>
              <input 
                type="text" 
                placeholder="Buscar por nome do arquivo..."
                className="flex-1 bg-transparent border-none focus:outline-none text-sm font-bold text-zinc-900 placeholder:text-zinc-300 placeholder:italic"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocs.map(doc => (
                <div 
                  key={doc.id}
                  className="bg-white rounded-[2.5rem] border border-zinc-100 p-6 space-y-6 hover:shadow-xl hover:shadow-zinc-200/50 transition-all group flex flex-col"
                >
                   <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <FileText className="w-6 h-6 text-zinc-400" />
                        </div>
                        <div className="min-w-0">
                           <p className="text-sm font-black text-zinc-900 truncate leading-none mb-1">{doc.file_name}</p>
                           <div className="flex items-center gap-2">
                             <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{doc.file_extension}</span>
                             <span className="text-[9px] text-zinc-300">•</span>
                             <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{(doc.size_bytes / 1024).toFixed(0)} KB</span>
                           </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleReprocess(doc)}
                          className="p-2 hover:bg-zinc-50 rounded-xl text-zinc-300 hover:text-indigo-500 transition-all"
                          title="Reprocessar"
                        >
                          <RefreshCcw className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(doc)}
                          className="p-2 hover:bg-zinc-50 rounded-xl text-zinc-300 hover:text-rose-500 transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                   </div>

                   <div className="space-y-4 flex-1">
                      <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            {getStatusIcon(doc.status)}
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{getStatusLabel(doc.status)}</span>
                         </div>
                         {doc.created_at && (
                           <span className="text-[10px] font-bold text-zinc-400">
                             {format(doc.created_at.toDate(), "dd MMM, HH:mm", { locale: ptBR })}
                           </span>
                         )}
                      </div>

                      {doc.extracted_items_count && doc.status === 'processed' && (
                        <div className="grid grid-cols-2 gap-2">
                           {Object.entries(doc.extracted_items_count).map(([key, val]) => val > 0 && (
                             <div key={key} className="px-3 py-1.5 bg-white border border-zinc-100 rounded-lg flex items-center justify-between shadow-sm">
                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{key}</span>
                                <span className="text-[10px] font-black text-zinc-900">{val}</span>
                             </div>
                           ))}
                        </div>
                      )}

                      {doc.stage_key && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg w-fit">
                           <Tag className="w-3 h-3 text-indigo-400" />
                           <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{doc.stage_key}</span>
                        </div>
                      )}
                   </div>

                   <button 
                     disabled={doc.status !== 'processed'}
                     onClick={() => setSelectedDoc(doc)}
                     className="w-full py-4 bg-zinc-50 text-zinc-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all border border-zinc-100 flex items-center justify-center gap-2 group/btn disabled:opacity-50"
                   >
                     Ver Análise Completa
                     <ChevronRight className="w-4 h-4 text-zinc-300 group-hover/btn:translate-x-1 transition-transform" />
                   </button>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Analysis Drawer/Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-50 flex justify-end">
           <motion.div 
             initial={{ x: '100%' }}
             animate={{ x: 0 }}
             exit={{ x: '100%' }}
             className="w-full max-w-2xl bg-white h-screen shadow-2xl flex flex-col"
           >
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                       <FileText className="w-6 h-6 text-indigo-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-zinc-900">{selectedDoc.file_name}</h2>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Análise da Tona</p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedDoc(null)} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
                   <X className="w-5 h-5 text-zinc-400" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                 {/* Summary */}
                 <div className="space-y-4">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Resumo</h3>
                    </div>
                    <div className="p-8 bg-zinc-50 rounded-[2.5rem] border border-zinc-100 italic font-medium text-zinc-600 leading-relaxed text-sm">
                       {selectedDoc.ai_summary || 'Nenhum resumo gerado.'}
                    </div>
                 </div>

                 {/* Extractions */}
                 <div className="space-y-6">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Insights Extraídos</h3>
                       </div>
                       <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">{extractions.length} itens capturados</span>
                    </div>

                    {loadingExtractions ? (
                      <div className="py-20 flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                        <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Extraindo detalhes...</p>
                      </div>
                    ) : extractions.length === 0 ? (
                      <div className="text-center py-10">
                         <p className="text-xs text-zinc-400 italic">Nenhum item extraído deste documento.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                         {extractions.map((item) => (
                            <div key={item.id} className="p-6 bg-white border border-zinc-100 rounded-[2rem] space-y-4 hover:border-indigo-100 transition-colors shadow-sm group">
                               <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-center gap-2">
                                     <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                       item.type === 'risk' ? 'bg-rose-50 text-rose-500 border border-rose-100' :
                                       item.type === 'gap' ? 'bg-amber-50 text-amber-500 border border-amber-100' :
                                       item.type === 'decision' ? 'bg-emerald-50 text-emerald-500 border border-emerald-100' :
                                       'bg-zinc-50 text-zinc-400 border border-zinc-100'
                                     }`}>
                                       {item.type}
                                     </span>
                                     <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                       item.confidence === 'high' ? 'text-indigo-400' : 'text-zinc-300'
                                     }`}>
                                       Confiança: {item.confidence}
                                     </span>
                                  </div>
                                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                     {item.memory_status === 'added' ? (
                                       <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-500 uppercase tracking-widest mr-2">
                                         <CheckCircle2 className="w-3 h-3" /> Adicionado à Memória
                                       </span>
                                     ) : (
                                       <button className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-sm">
                                         Adicionar à Memória
                                       </button>
                                     )}
                                  </div>
                               </div>
                               <div>
                                  <h4 className="text-sm font-black text-zinc-900 mb-2 leading-tight">{item.title}</h4>
                                  <p className="text-xs text-zinc-500 leading-relaxed font-medium">{item.content}</p>
                               </div>
                               {item.source_quote && (
                                 <div className="mt-4 p-4 bg-zinc-50 border-l-2 border-zinc-200 rounded-r-xl">
                                    <p className="text-[11px] italic text-zinc-400 leading-tight">"{item.source_quote}"</p>
                                 </div>
                               )}
                            </div>
                         ))}
                      </div>
                    )}
                 </div>
              </div>

              <div className="p-8 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between">
                 <button 
                   onClick={() => setSelectedDoc(null)}
                   className="px-6 py-3 text-zinc-400 text-[10px] font-black uppercase tracking-widest hover:text-zinc-900 transition-all"
                 >
                   Fechar Painel
                 </button>
                 <button 
                  onClick={() => window.open(selectedDoc.download_url)}
                  className="px-6 py-3 bg-white border border-zinc-100 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-sm hover:shadow-md transition-all active:scale-95"
                 >
                   <Download className="w-4 h-4 text-zinc-300" />
                   Baixar Original
                 </button>
              </div>
           </motion.div>
        </div>
      )}

      {showUpload && (
        <ProductDocumentUploadModal 
          product={product} 
          user={user} 
          activeStage={activeStage}
          onClose={() => setShowUpload(false)}
          onUploadComplete={() => {
            onProductUpdated?.();
            onMemoryUpdated?.();
          }}
        />
      )}
    </div>
  );
}
