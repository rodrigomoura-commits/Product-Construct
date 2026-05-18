import { collection, doc, setDoc, updateDoc, serverTimestamp, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { Product, AdminCtx, ProductDocument, ProductDocumentStatus } from '../types';
import { canEditProduct } from './productAccess';
import { cleanFirestoreData } from './firestoreSanitizer';
import { touchStage } from './progressEngine';

const ACCEPTED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/csv"
];

const ACCEPTED_DOCUMENT_EXTENSIONS = [
  "pdf",
  "docx",
  "txt",
  "md",
  "markdown",
  "csv"
];

const MAX_FILE_SIZE_MB = 20;

export type ProductDocumentUploadProgress = {
  documentId?: string;
  phase:
    | "validating"
    | "creating_record"
    | "uploading"
    | "uploaded"
    | "extracting_text"
    | "processing_ai"
    | "updating_memory"
    | "processed"
    | "failed";
  percent: number;
  message: string;
};

export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop() || '';
}

function inferMimeTypeFromExtension(extension: string): string {
  switch (extension.toLowerCase()) {
    case 'pdf': return 'application/pdf';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt': return 'text/plain';
    case 'md':
    case 'markdown': return 'text/markdown';
    case 'csv': return 'text/csv';
    default: return 'application/octet-stream';
  }
}

export function validateProductDocumentFile(file: File) {
  const extension = getFileExtension(file.name).toLowerCase();

  const validExtension = ACCEPTED_DOCUMENT_EXTENSIONS.includes(extension);
  const validMime = ACCEPTED_DOCUMENT_TYPES.includes(file.type) || validExtension;

  if (!validMime) {
    throw new Error("Formato não suportado. Envie PDF, DOCX, TXT, Markdown ou CSV.");
  }

  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`Arquivo grande demais. Envie um arquivo de até ${MAX_FILE_SIZE_MB} MB.`);
  }

  return {
    extension,
    mimeType: file.type || inferMimeTypeFromExtension(extension)
  };
}

function buildProductDocumentStoragePath({
  organizationId,
  productId,
  documentId,
  fileName
}: {
  organizationId?: string | null;
  productId: string;
  documentId: string;
  fileName: string;
}) {
  const safeFileName = fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
  if (organizationId) {
    return `organizations/${organizationId}/products/${productId}/documents/${documentId}/${safeFileName}`;
  }
  return `products/${productId}/documents/${documentId}/${safeFileName}`;
}

export async function uploadProductDocument({
  product,
  file,
  stageKey,
  source,
  autoProcess = true,
  autoAddToMemory = true,
  currentUser,
  adminContext,
  onProgress
}: {
  product: Product;
  file: File;
  stageKey?: string;
  source: "conversation_attachment" | "documents_tab" | "empty_state";
  autoProcess?: boolean;
  autoAddToMemory?: boolean;
  currentUser: any;
  adminContext?: AdminCtx;
  onProgress?: (progress: ProductDocumentUploadProgress) => void;
}) {
  onProgress?.({
    phase: "validating",
    percent: 5,
    message: "Validando documento..."
  });

  if (!canEditProduct(product, currentUser, adminContext)) {
    throw new Error("Você não tem permissão para adicionar documentos neste produto.");
  }

  const { extension, mimeType } = validateProductDocumentFile(file);

  onProgress?.({
    phase: "creating_record",
    percent: 10,
    message: "Criando registro do documento..."
  });

  const documentRef = doc(collection(db, "products", product.id, "documents"));
  const documentId = documentRef.id;

  const storagePath = buildProductDocumentStoragePath({
    organizationId: product.organization_id,
    productId: product.id,
    documentId,
    fileName: file.name
  });

  const docData = cleanFirestoreData({
    id: documentId,
    product_id: product.id,
    organization_id: product.organization_id ?? null,
    file_name: file.name,
    file_extension: extension,
    mime_type: mimeType,
    size_bytes: file.size,
    storage_path: storagePath,
    status: "uploading" as ProductDocumentStatus,
    source,
    uploaded_by: currentUser.uid,
    uploaded_by_email: currentUser.email || null,
    uploaded_by_name: currentUser.displayName || currentUser.email || null,
    stage_key: stageKey || product.current_stage || null,
    auto_add_to_memory: autoAddToMemory,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });

  await setDoc(documentRef, docData);

  onProgress?.({
    documentId,
    phase: "uploading",
    percent: 25,
    message: "Enviando arquivo..."
  });

  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, {
    contentType: mimeType
  });

  await updateDoc(documentRef, {
    status: "uploaded",
    updated_at: serverTimestamp()
  });

  // History event
  await addDoc(collection(db, `products/${product.id}/history_events`), cleanFirestoreData({
    type: "document_uploaded",
    title: "Documento enviado",
    summary: `${currentUser.email || 'Um usuário'} enviou ${file.name}.`,
    actor_id: currentUser.uid,
    actor_email: currentUser.email || null,
    document_id: documentId,
    document_name: file.name,
    source,
    stage_key: stageKey || product.current_stage || null,
    created_at: serverTimestamp()
  }));

  if (autoProcess) {
    onProgress?.({
      documentId,
      phase: "processing_ai",
      percent: 45,
      message: "A Tona está lendo o documento..."
    });

    try {
      await processProductDocument({
        productId: product.id,
        documentId,
        storagePath,
        fileName: file.name,
        mimeType,
        stageKey: stageKey || product.current_stage,
        autoAddToMemory,
        userId: currentUser.uid,
        userEmail: currentUser.email || '',
        userName: currentUser.displayName || currentUser.email || ''
      });
      
      onProgress?.({
        documentId,
        phase: "processed",
        percent: 100,
        message: "Documento processado com sucesso!"
      });
    } catch (err) {
      console.error("Processing failed:", err);
      onProgress?.({
        documentId,
        phase: "failed",
        percent: 100,
        message: "Falha ao processar documento pela IA."
      });
    }
  }

  if (stageKey || product.current_stage) {
    await touchStage(product.id, (stageKey || product.current_stage) as string, 'document');
  }

  return {
    documentId,
    storagePath
  };
}

export async function processProductDocument(params: {
  productId: string;
  documentId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  stageKey?: string;
  autoAddToMemory: boolean;
  userId: string;
  userEmail: string;
  userName?: string;
}) {
  const response = await fetch(`/api/products/${params.productId}/documents/${params.documentId}/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erro ao processar documento.");
  }

  return response.json();
}

export function watchProductDocuments(productId: string, callback: (docs: ProductDocument[]) => void) {
  const q = query(
    collection(db, 'products', productId, 'documents'),
    orderBy('created_at', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductDocument));
    callback(docs);
  });
}
