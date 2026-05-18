import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, History, FileText, Check, Loader2, AlertTriangle, Edit3, Eye, Download, Trash2 } from 'lucide-react';
import { Artifact, Product } from '../../types';
import { updateArtifactContent, createArtifactVersion, deleteArtifact } from '../../lib/artifacts';
import { exportArtifactToDocx } from '../../lib/exportArtifactToDocx';
import { useAuth } from '../../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import { cn, formatDate } from '../../lib/utils';
import { toast } from 'sonner';
import { artifactMarkdownToHtml } from '../../lib/artifactContentFormatter';

import ArtifactRichEditor from './artifacts/ArtifactRichEditor';

interface ArtifactDetailDrawerProps {
  artifact: Artifact | null;
  product?: Product;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  onEdit?: (artifact: Artifact) => void;
}

export default function ArtifactDetailDrawer({ artifact, product, open, onClose, onUpdate, onEdit }: ArtifactDetailDrawerProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [versioning, setVersioning] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    if (!user || !artifact) return;
    
    setIsDeleting(true);
    try {
      await deleteArtifact(artifact.product_id, artifact.id);
      toast.success('Artefato excluído com sucesso!');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir artefato.');
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(false);
    }
  };

  useEffect(() => {
    if (artifact) {
      setContent(artifact.content || '');
      setTitle(artifact.title || '');
      setStatus(artifact.status || 'draft');
    }
  }, [artifact]);

  if (!artifact) return null;

  const handleCreateVersion = async () => {
    if (!user) return;
    setVersioning(true);
    try {
      const nextVersion = await createArtifactVersion(artifact, user.uid, user.email || '');
      toast.success(`Nova versão ${nextVersion} criada!`);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar nova versão.');
    } finally {
      setVersioning(false);
    }
  };

  const handleExportDocx = async () => {
    if (!artifact || !user) return;
    setExportingDocx(true);
    try {
      await exportArtifactToDocx(artifact, product || {}, { uid: user.uid, email: user.email || '' });
      toast.success('Artefato salvo como DOCX.');
    } catch (error: any) {
      console.error(error);
      toast.error(`Erro ao salvar DOCX: ${error.message}`);
    } finally {
      setExportingDocx(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[250]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-[251] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">{title}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                     <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{artifact.type}</span>
                     <span className="w-1 h-1 bg-slate-300 rounded-full" />
                     <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">{artifact.version}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportDocx}
                  disabled={exportingDocx}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all border border-slate-200"
                  title="Exportar para DOCX"
                >
                  {exportingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">DOCX</span>
                </button>
                {deleteConfirm ? (
                  <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-100">
                    <button 
                      onClick={() => setDeleteConfirm(false)}
                      className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-500 hover:bg-white rounded-lg transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="px-3 py-1.5 bg-red-600 text-white text-[9px] font-black uppercase rounded-lg shadow-sm hover:bg-red-700 transition-all flex items-center gap-1.5"
                    >
                      {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Confirmar
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setDeleteConfirm(true)}
                    disabled={isDeleting}
                    className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-500 transition-all"
                    title="Excluir Artefato"
                  >
                    {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                  </button>
                )}
                <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-50 p-8">
               <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-8 min-h-full artifact-editor">
                  <div className="prose prose-slate max-w-none prose-indigo">
                     {artifact.content_html ? (
                       <div dangerouslySetInnerHTML={{ __html: artifact.content_html }} />
                     ) : artifact.content ? (
                       <div dangerouslySetInnerHTML={{ __html: artifactMarkdownToHtml(artifact.content) }} />
                     ) : (
                       <p className="text-slate-400 italic">Sem conteúdo.</p>
                     )}
                  </div>
               </div>
            </div>

            {/* Action Bar */}
            <div className="p-6 border-t border-slate-100 bg-white grid grid-cols-2 gap-4 shrink-0">
               <button 
                 type="button"
                 onClick={() => {
                   console.log("[ArtifactDetailDrawer] Edit clicked", artifact.id);
                   onEdit?.(artifact);
                 }}
                 className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-100 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
               >
                 <Edit3 className="w-4 h-4" /> Editar Artefato
               </button>
               <button 
                 onClick={handleCreateVersion}
                 disabled={versioning}
                 className="flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
               >
                 {versioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />}
                 Versionar v0.{artifact.version_number ? artifact.version_number + 1 : 2}
               </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
