import { callGeminiProxy } from './geminiProxy';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, orderBy, limit, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Artifact, Product, StageKey } from '../types';
import { ARTIFACT_CATALOG, getArtifactDefinition } from './artifactCatalog';

// removal of direct AI instantiation

const EPIC_TEMPLATE = `# Epic

## Contexto

## Problema que resolve

## Escopo

## Fora de escopo

## Métricas de sucesso

## Dependências

## Critérios de Done

## Riscos

## Links relacionados`;

const USER_STORIES_TEMPLATE = `# User Stories

## História 1
Como [persona],
quero [ação],
para [benefício].

### Critérios de aceite
- Dado que...
- Quando...
- Então...

### Corner cases
- 

### Perguntas técnicas
- `;

const DEFAULT_TEMPLATES: Record<string, string> = {
  'epic': EPIC_TEMPLATE,
  'user_stories': USER_STORIES_TEMPLATE
};

export async function createArtifact(data: {
  productId: string;
  stageId: string;
  type: string;
  title: string;
  creationMode: 'blank' | 'tona_generated' | 'versioned';
  userId: string;
  userEmail: string;
}) {
  const stageInfo = ARTIFACT_CATALOG[data.stageId];
  const artDef = getArtifactDefinition(data.stageId, data.type);
  
  if (!stageInfo || !artDef) throw new Error("Stage or Artifact Definition not found");

  const ref = doc(collection(db, `products/${data.productId}/artifacts`));
  
  let content = DEFAULT_TEMPLATES[data.type] || "";
  let status: any = "draft";
  let source: any = "manual";

  if (data.creationMode === 'tona_generated') {
    source = "tona_generated";
    try {
      content = await generateArtifactContent({
        productId: data.productId,
        stageId: data.stageId,
        frameworkKey: stageInfo.framework_key,
        artifactType: data.type,
        artifactTitle: data.title
      });
      status = "draft"; // Or "generated" as requested
    } catch (error) {
      console.error("Error generating with Tona:", error);
      // Fallback to blank
    }
  }

  const payload: Partial<Artifact> = {
    id: ref.id,
    product_id: data.productId,
    stage_id: data.stageId,
    stage_name: stageInfo.stage_name,
    framework_key: stageInfo.framework_key,
    type: data.type,
    title: data.title,
    description: artDef.description || "",
    content: content,
    version: "v0.1",
    version_number: 1,
    status: status,
    creation_mode: data.creationMode,
    source: source,
    is_core: artDef.is_core,
    priority: artDef.priority,
    created_by: data.userId,
    created_by_email: data.userEmail,
    updated_by: data.userId,
    updated_by_email: data.userEmail,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  };

  await setDoc(ref, payload);

  // Register history
  let historyType = "artifact_created";
  if (data.type === 'epic') historyType = "epic_created";
  if (data.type === 'user_stories') historyType = "user_stories_created";

  await addDoc(collection(db, 'product_history'), {
    product_id: data.productId,
    type: historyType,
    title: `Artefato criado: ${data.title}`,
    description: `${data.title} foi criado na etapa ${stageInfo.stage_name}.`,
    artifact_id: ref.id,
    stage_id: data.stageId,
    created_by: data.userId,
    created_by_email: data.userEmail,
    created_at: serverTimestamp()
  });

  return ref.id;
}

async function generateArtifactContent({
  productId,
  stageId,
  frameworkKey,
  artifactType,
  artifactTitle
}: any): Promise<string> {
  const productSnap = await getDoc(doc(db, 'products', productId));
  const product = productSnap.data() as Product;

  // Simple context fetch
  const memoriesSnap = await getDocs(query(collection(db, `products/${productId}/memories`), limit(30)));
  const memories = memoriesSnap.docs.map(d => d.data());

  const prompt = `
    Você é a Tona, uma IA especialista em Strategy Design e Product Discovery.
    Gere o conteúdo para o artefato "${artifactTitle}" (tipo: ${artifactType}) para o produto "${product.name}".
    Este artefato pertence à etapa "${stageId}" (${frameworkKey}).

    CONTEXTO DO PRODUTO:
    Nome: ${product.name}
    Descrição: ${product.description}
    Maturidade: ${product.progress}%

    MEMÓRIAS E DECISÕES RECENTES:
    ${JSON.stringify(memories, null, 2)}

    REGRAS:
    - Retorne APENAS o conteúdo do artefato em Markdown puro.
    - NÃO inclua saudações como "Olá, eu sou a Tona", introduções conversacionais ou comentários sobre o que você fez.
    - Se for um Epic ou User Stories, siga rigorosamente a estrutura de templates padrão da indústria.
    - Seja estratégico, profundo e baseado nas evidências da memória.
    - Use as tags [FATO], [HIPÓTESE], [EVIDÊNCIA], [DECISÃO], [RISCO], [LACUNA] quando apropriado para destacar informações.
  `;

  const content = await callGeminiProxy({
    prompt: prompt,
    model: "gemini-3-flash-preview"
  });
  
  return content || "";
}

export async function updateArtifactContent(productId: string, artifactId: string, data: {
  title: string;
  content: string;
  status: string;
  userId: string;
  userEmail: string;
}) {
  await setDoc(doc(db, `products/${productId}/artifacts`, artifactId), {
    title: data.title,
    content: data.content,
    status: data.status,
    updated_by: data.userId,
    updated_by_email: data.userEmail,
    updated_at: serverTimestamp()
  }, { merge: true });
}

export async function createArtifactVersion(artifact: Artifact, userId: string, userEmail: string) {
  const versionId = doc(collection(db, `products/${artifact.product_id}/artifact_versions`)).id;
  
  // Save current version to history collection
  await setDoc(doc(db, `products/${artifact.product_id}/artifact_versions`, versionId), {
    id: versionId,
    artifact_id: artifact.id,
    product_id: artifact.product_id,
    stage_id: artifact.stage_id,
    type: artifact.type,
    title: artifact.title,
    content: artifact.content,
    version: artifact.version,
    version_number: artifact.version_number,
    status: artifact.status,
    created_by: userId,
    created_by_email: userEmail,
    created_at: serverTimestamp()
  });

  const nextVersionNum = (artifact.version_number || 0) + 1;
  const nextVersion = `v0.${nextVersionNum}`;

  // Update main artifact
  await setDoc(doc(db, `products/${artifact.product_id}/artifacts`, artifact.id), {
    version: nextVersion,
    version_number: nextVersionNum,
    updated_at: serverTimestamp()
  }, { merge: true });

  return nextVersion;
}

export async function deleteArtifact(productId: string, artifactId: string) {
  await deleteDoc(doc(db, `products/${productId}/artifacts`, artifactId));
}

