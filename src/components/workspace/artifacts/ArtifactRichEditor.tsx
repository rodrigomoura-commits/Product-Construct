import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Highlight from '@tiptap/extension-highlight';
import CharacterCount from '@tiptap/extension-character-count';
import { 
  artifactToEditorContent, 
  artifactHtmlToMarkdown 
} from '../../../lib/artifactContentFormatter';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Save, Download, Sparkles, Check, Loader2, 
  ChevronRight, AlignLeft, Bold, Italic, List, 
  ListOrdered, Quote, Heading1, Heading2, Heading3, Link as LinkIcon,
  Table as TableIcon, Undo, Redo, Hash, MessageCircle, AlertCircle,
  Copy, Trash2, Maximize2, FileText, Layout, Info, Search, History
} from 'lucide-react';
import { Artifact, Product } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../lib/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { ARTIFACT_CATALOG } from '../../../lib/artifactCatalog';
import { ARTIFACT_TEMPLATES, calculateQuality } from './artifactUtils';
import { exportArtifactToDocx } from '../../../lib/exportArtifactToDocx';
import { deleteArtifact } from '../../../lib/artifacts';
import { cn } from '../../../lib/utils';
import { toast } from 'sonner';

interface ArtifactRichEditorProps {
  artifact: Artifact;
  product: Product;
  open: boolean;
  mode?: 'view' | 'edit';
  onClose: () => void;
  onSaved?: (artifact: Artifact) => void;
}

export default function ArtifactRichEditor({ artifact, product, open, mode = 'edit', onClose, onSaved }: ArtifactRichEditorProps) {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showQuality, setShowQuality] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    if (!user || !artifact) return;
    
    setIsDeleting(true);
    try {
      await deleteArtifact(product.id, artifact.id);
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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Placeholder.configure({
        placeholder: 'Escreva algo incrível ou peça ajuda da Tona...',
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Highlight,
      CharacterCount,
    ],
    content: artifactToEditorContent(artifact),
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none min-h-[680px] focus:outline-none text-slate-900 leading-relaxed',
      },
    },
    onUpdate: ({ editor }) => {
      setSaveStatus('idle');
    },
  });

  const [isDirty, setIsDirty] = useState(false);

  // Mark as dirty when content changes
  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => setIsDirty(true);
    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor]);

  // Update content when artifact changes
  useEffect(() => {
    if (editor && artifact) {
      const nextContent = artifactToEditorContent(artifact);
      if (editor.getHTML() !== nextContent) {
        editor.commands.setContent(nextContent);
        setIsDirty(false);
      }
    }
  }, [artifact?.id, editor]);

  // Handle read-only mode
  useEffect(() => {
    if (editor) {
      editor.setEditable(mode === 'edit');
    }
  }, [editor, mode]);

  const saveArtifact = useCallback(async (manual = false) => {
    if (!editor || !user || !artifact) return;

    setSaveStatus('saving');
    if (manual) setIsSaving(true);

    try {
      const html = editor.getHTML();
      const json = editor.getJSON();
      const text = editor.getText();
      const markdown = artifactHtmlToMarkdown(html);
      const wordCount = editor.storage.characterCount.words();
      const charCount = editor.storage.characterCount.characters();

      const quality = calculateQuality({ ...artifact, plain_text: text });

      const payload = {
        content: markdown,
        content_html: html,
        content_json: json,
        plain_text: text,
        word_count: wordCount,
        character_count: charCount,
        quality_score: quality.score,
        quality_status: quality.status,
        updated_by: user.uid,
        updated_by_email: user.email || '',
        updated_at: serverTimestamp(),
        last_edited_at: serverTimestamp(),
      };

      await setDoc(doc(db, `products/${product.id}/artifacts`, artifact.id), payload, { merge: true });

      setSaveStatus('saved');
      setIsDirty(false);
      if (manual) toast.success('Artefato salvo com sucesso!');
      
      // Register event occasionally
      if (manual) {
        await addDoc(collection(db, 'artifact_edit_events'), {
          artifact_id: artifact.id,
          product_id: product.id,
          event_type: 'manual_saved',
          summary: `Artefato "${artifact.title}" salvo manualmente.`,
          created_by: user.uid,
          created_by_email: user.email || '',
          created_at: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error(error);
      setSaveStatus('error');
      if (manual) toast.error('Erro ao salvar artefato.');
    } finally {
      if (manual) setIsSaving(false);
    }
  }, [editor, user, artifact, product]);

  // Auto-save logic
  useEffect(() => {
    if (saveStatus !== 'idle' || !isDirty) return;

    const timer = setTimeout(() => {
      saveArtifact();
    }, 2000);

    return () => clearTimeout(timer);
  }, [saveStatus, isDirty, saveArtifact]);

  const handleCreateVersion = async () => {
    if (!user || !artifact || !editor) return;
    
    setIsSaving(true);
    try {
      const currentVersion = artifact.version_number || 1;
      const nextVersion = currentVersion + 1;
      const nextLabel = `v0.${nextVersion}`;

      // 1. Create version record
      await addDoc(collection(db, `products/${product.id}/artifact_versions`), {
        artifact_id: artifact.id,
        product_id: product.id,
        stage_id: artifact.stage_id,
        type: artifact.type,
        title: artifact.title,
        content: editor.getText(),
        content_html: editor.getHTML(),
        content_json: editor.getJSON(),
        version: artifact.version || 'v0.1',
        version_number: currentVersion,
        status: artifact.status || 'draft',
        created_by: user.uid,
        created_by_email: user.email || '',
        created_at: serverTimestamp(),
      });

      // 2. Update artifact version
      await setDoc(doc(db, `products/${product.id}/artifacts`, artifact.id), {
        version_number: nextVersion,
        version: nextLabel,
        updated_at: serverTimestamp(),
      }, { merge: true });

      toast.success(`Versão ${nextLabel} criada!`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar nova versão.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportDocx = async () => {
    if (!artifact || !editor) return;
    setIsExporting(true);
    try {
      const html = editor.getHTML();
      const markdown = artifactHtmlToMarkdown(html);
      const fullArtifact = {
        ...artifact,
        content: markdown,
        content_html: html
      };
      await exportArtifactToDocx(fullArtifact as any, product, { uid: user?.uid || '', email: user?.email || '' });
    } catch (error) {
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleApprove = async () => {
    if (!user || !artifact) return;
    setIsApproving(true);
    try {
      await setDoc(doc(db, `products/${product.id}/artifacts`, artifact.id), {
        status: 'approved',
        review_status: 'approved',
        approved_by: user.uid,
        approved_by_email: user.email || '',
        approved_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }, { merge: true });
      
      toast.success('Artefato aprovado com sucesso!');
    } catch (error) {
      console.error(error);
    } finally {
      setIsApproving(false);
    }
  };

  const insertBlock = (type: string, label: string) => {
    if (!editor) return;
    const badgeHtml = `<span data-smart-block="${type}" class="smart-badge smart-badge-${type}">${label.toUpperCase()}</span> `;
    editor
      .chain()
      .focus()
      .insertContent(badgeHtml)
      .run();
  };

  if (!editor) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm flex flex-col items-center p-4 sm:p-8"
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="w-full max-w-6xl h-full bg-slate-50 rounded-[40px] shadow-2xl flex flex-col overflow-hidden relative"
          >
            {/* Header */}
            <div className="bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-6 min-w-0">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                       <h3 className="text-xl font-black text-slate-900 tracking-tight truncate uppercase">{artifact.title}</h3>
                       <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest">{artifact.version || 'v0.1'}</span>
                       {isDirty && saveStatus === 'idle' && (
                         <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[8px] font-black uppercase tracking-widest border border-amber-100">
                           <AlertCircle className="w-2.5 h-2.5" />
                           Alterações não salvas
                         </div>
                       )}
                       {saveStatus === 'saving' && (
                         <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[8px] font-black uppercase tracking-widest border border-indigo-100 animate-pulse">
                           <Loader2 className="w-2.5 h-2.5 animate-spin" />
                           Salvando...
                         </div>
                       )}
                       {saveStatus === 'saved' && (
                         <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[8px] font-black uppercase tracking-widest border border-emerald-100">
                           <Check className="w-2.5 h-2.5" />
                           Salvo
                         </div>
                       )}
                       {saveStatus === 'error' && (
                         <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 text-red-600 rounded text-[8px] font-black uppercase tracking-widest border border-red-100">
                           <AlertCircle className="w-2.5 h-2.5" />
                           Erro ao salvar
                         </div>
                       )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] font-black uppercase text-indigo-500 tracking-tight">{ARTIFACT_CATALOG[artifact.stage_id]?.stage_name || artifact.stage_id}</span>
                      <span className="w-1 h-1 bg-slate-200 rounded-full" />
                      <span className={cn(
                        "text-[9px] font-black uppercase px-2 py-0.5 rounded",
                        artifact.status === 'approved' ? "bg-emerald-100 text-emerald-700" : "bg-indigo-50 text-indigo-600"
                      )}>
                        {artifact.status || 'draft'}
                      </span>
                    </div>
                  </div>
               </div>

               <div className="flex items-center gap-2">
                 <button 
                   onClick={() => saveArtifact(true)}
                   disabled={isSaving}
                   className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50"
                 >
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                   Salvar
                 </button>
                 <button 
                    onClick={handleExportDocx}
                    disabled={isExporting}
                    className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-100"
                    title="Exportar DOCX"
                 >
                   {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                 </button>
                 <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-100"
                 >
                   <X className="w-6 h-6" />
                 </button>
               </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
               {/* Toolbar - Vertical Left */}
               <div className="w-16 bg-white border-r border-slate-100 flex flex-col items-center py-6 gap-4 shrink-0 overflow-y-auto no-scrollbar">
                  <div className="flex flex-col gap-1 w-full px-2">
                    <button 
                      onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                      className={cn("p-3 rounded-xl transition-all", editor.isActive('heading', { level: 1 }) ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50")}
                    ><Heading1 className="w-5 h-5" /></button>
                    <button 
                      onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                      className={cn("p-3 rounded-xl transition-all", editor.isActive('heading', { level: 2 }) ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50")}
                    ><Heading2 className="w-5 h-5" /></button>
                    <button 
                      onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                      className={cn("p-3 rounded-xl transition-all", editor.isActive('heading', { level: 3 }) ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50")}
                    ><Heading3 className="w-5 h-5" /></button>
                  </div>

                  <div className="w-full h-px bg-slate-50" />

                  <div className="flex flex-col gap-1 w-full px-2">
                    <button 
                      onClick={() => editor.chain().focus().toggleBold().run()}
                      className={cn("p-3 rounded-xl transition-all", editor.isActive('bold') ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50")}
                    ><Bold className="w-5 h-5" /></button>
                    <button 
                      onClick={() => editor.chain().focus().toggleItalic().run()}
                      className={cn("p-3 rounded-xl transition-all", editor.isActive('italic') ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50")}
                    ><Italic className="w-5 h-5" /></button>
                  </div>

                  <div className="w-full h-px bg-slate-50" />

                  <div className="flex flex-col gap-1 w-full px-2">
                    <button 
                      onClick={() => editor.chain().focus().toggleBulletList().run()}
                      className={cn("p-3 rounded-xl transition-all", editor.isActive('bulletList') ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50")}
                    ><List className="w-5 h-5" /></button>
                    <button 
                      onClick={() => editor.chain().focus().toggleOrderedList().run()}
                      className={cn("p-3 rounded-xl transition-all", editor.isActive('orderedList') ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50")}
                    ><ListOrdered className="w-5 h-5" /></button>
                    <button 
                      onClick={() => editor.chain().focus().toggleBlockquote().run()}
                      className={cn("p-3 rounded-xl transition-all", editor.isActive('blockquote') ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50")}
                    ><Quote className="w-5 h-5" /></button>
                  </div>

                  <div className="w-full h-px bg-slate-50" />

                  <div className="flex flex-col gap-1 w-full px-2">
                    <button 
                      onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                      className="p-3 text-slate-400 hover:bg-slate-50 rounded-xl transition-all"
                    ><TableIcon className="w-5 h-5" /></button>
                  </div>
               </div>

               {/* Editor Space */}
               <div className="flex-1 overflow-y-auto px-12 py-16 custom-scrollbar bg-[#f8fafc] artifact-editor">
                  <div className="max-w-3xl mx-auto bg-white min-h-full rounded-2xl shadow-sm border border-slate-100 p-16">
                    <EditorContent editor={editor} />
                  </div>
               </div>

               {/* Right Side Panel */}
               <div className="w-80 bg-white border-l border-slate-100 flex flex-col shrink-0 overflow-y-auto">
                  <div className="p-6 space-y-8">
                     {/* Smart Blocks */}
                     <div>
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2">
                          <Layout className="w-3 h-3" /> Blocos Inteligentes
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'fact', label: 'Fato' },
                            { id: 'hypothesis', label: 'Hipótese' },
                            { id: 'evidence', label: 'Evidência' },
                            { id: 'decision', label: 'Decisão' },
                            { id: 'risk', label: 'Risco' },
                            { id: 'gap', label: 'Lacuna' },
                          ].map(block => (
                            <button
                              key={block.id}
                              onClick={() => insertBlock(block.id, block.label)}
                              className="px-3 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-[10px] font-black uppercase text-left transition-all border border-transparent hover:border-indigo-100"
                            >
                              {block.label}
                            </button>
                          ))}
                        </div>
                     </div>

                     {/* Quality Status */}
                     <div>
                        <button 
                          onClick={() => setShowQuality(!showQuality)}
                          className="w-full flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 outline-none"
                        >
                          <div className="flex items-center gap-2"><Sparkles className="w-3 h-3" /> Qualidade do Artefato</div>
                          <ChevronRight className={cn("w-3 h-3 transition-transform", showQuality && "rotate-90")} />
                        </button>
                        
                        <div className="space-y-4">
                           <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-600">Score</span>
                              <span className="text-xl font-black text-indigo-600">{calculateQuality({ ...artifact, plain_text: editor.getText() }).score}</span>
                           </div>
                           <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${calculateQuality({ ...artifact, plain_text: editor.getText() }).score}%` }}
                                className="h-full bg-indigo-600"
                              />
                           </div>
                           
                           {showQuality && (
                             <div className="space-y-3">
                                {calculateQuality({ ...artifact, plain_text: editor.getText() }).missing.length > 0 && (
                                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                     <h5 className="text-[9px] font-black uppercase text-amber-700 tracking-widest mb-2">Lacunas Identificadas</h5>
                                     <ul className="space-y-1">
                                        {calculateQuality({ ...artifact, plain_text: editor.getText() }).missing.map(m => (
                                          <li key={m} className="text-[9px] font-bold text-amber-600 list-disc list-inside uppercase tracking-tight">{m}</li>
                                        ))}
                                     </ul>
                                  </div>
                                )}
                             </div>
                           )}
                        </div>
                     </div>

                     {/* Actions */}
                     <div className="space-y-3 pt-6 border-t border-slate-50">
                        <button 
                          onClick={handleCreateVersion}
                          disabled={isSaving}
                          className="w-full flex items-center gap-3 p-4 bg-white border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 rounded-2xl text-slate-700 hover:text-indigo-600 transition-all text-left"
                        >
                          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-100">
                             <History className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="text-[10px] font-black uppercase">Criar Nova Versão</h5>
                            <p className="text-[8px] font-bold uppercase opacity-60">Arquivar snapshot v{artifact.version || '0.1'}</p>
                          </div>
                        </button>

                        <button 
                          onClick={handleApprove}
                          disabled={isApproving || artifact.status === 'approved'}
                          className={cn(
                            "w-full flex items-center gap-3 p-4 border rounded-2xl transition-all text-left",
                            artifact.status === 'approved' 
                              ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                              : "bg-white border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700"
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            artifact.status === 'approved' ? "bg-emerald-100" : "bg-slate-50"
                          )}>
                             <Check className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="text-[10px] font-black uppercase">{artifact.status === 'approved' ? 'Aprovado' : 'Aprovar Artefato'}</h5>
                            <p className="text-[8px] font-bold uppercase opacity-60">Validar para entrega</p>
                          </div>
                        </button>

                        {deleteConfirm ? (
                          <div className="w-full grid grid-cols-2 p-1 gap-1 bg-red-50 border border-red-100 rounded-xl">
                            <button 
                              onClick={() => setDeleteConfirm(false)}
                              className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 hover:bg-white rounded-lg transition-all"
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={handleDelete}
                              disabled={isDeleting}
                              className="px-4 py-3 bg-red-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                            >
                              {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                              Confirmar Exclusão
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeleteConfirm(true)}
                            className="w-full flex items-center gap-3 p-4 bg-white border border-slate-100 hover:border-red-200 hover:bg-red-50 text-slate-700 hover:text-red-700 transition-all text-left group"
                          >
                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-red-100">
                               {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                            </div>
                            <div>
                               <h5 className="text-[10px] font-black uppercase">Excluir Artefato</h5>
                               <p className="text-[8px] font-bold uppercase opacity-60">Remover permanentemente</p>
                            </div>
                          </button>
                        )}
                     </div>
                  </div>

                  <div className="mt-auto p-6 bg-slate-50 border-t border-slate-100">
                     <div className="flex items-center justify-between text-[8px] font-black uppercase text-slate-400 tracking-widest mb-3">
                        <span>Estatísticas</span>
                         <Info className="w-3 h-3" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <div className="text-[8px] text-slate-400 uppercase font-black tracking-widest">Palavras</div>
                           <div className="text-sm font-black text-slate-700">{editor.storage.characterCount.words()}</div>
                        </div>
                        <div>
                           <div className="text-[8px] text-slate-400 uppercase font-black tracking-widest">Caracteres</div>
                           <div className="text-sm font-black text-slate-700">{editor.storage.characterCount.characters()}</div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
