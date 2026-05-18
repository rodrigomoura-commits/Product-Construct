import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  limit,
  Timestamp
} from "firebase/firestore";
import { db, cleanFirestoreData } from "../firebase";
import { runTonaJsonGeneration } from "../../server/tonaJsonRuntime";
import {
  buildStageClosureCompactPayload,
  hardTrimPayload,
  estimateSize,
  limitText
} from "./stageClosureCompactor";

function normalizeProgress(value: any) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function isStageCompleted(stage: any) {
  return (
    normalizeProgress(stage?.progress) >= 100 ||
    stage?.status === "completed" ||
    stage?.is_completed === true
  );
}

function toMillis(value: any) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getStageLastContentChangedAt(stage: any) {
  return Math.max(
    toMillis(stage?.updated_at),
    toMillis(stage?.completed_at),
    toMillis(stage?.last_memory_update_at),
    toMillis(stage?.last_field_update_at),
    toMillis(stage?.last_document_update_at),
    toMillis(stage?.last_decision_update_at),
    toMillis(stage?.last_conversation_update_at)
  );
}

function getClosureGeneratedAt(closure: any) {
  return Math.max(
    toMillis(closure?.updated_at),
    toMillis(closure?.generated_at)
  );
}

function shouldGenerateOrUpdateClosure(stage: any, closure: any) {
  if (
    closure?.ai_generation_failed === true &&
    getStageLastContentChangedAt(stage) <= getClosureGeneratedAt(closure)
  ) {
    return {
      shouldRun: false,
      reason: "previous_ai_failure_without_new_content"
    };
  }

  if (!closure) {
    return {
      shouldRun: true,
      reason: "missing_closure"
    };
  }

  const stageChangedAt = getStageLastContentChangedAt(stage);
  const closureGeneratedAt = getClosureGeneratedAt(closure);

  if (stageChangedAt > closureGeneratedAt + 2000) {
    return {
      shouldRun: true,
      reason: "stage_changed_after_closure"
    };
  }

  return {
    shouldRun: false,
    reason: "closure_up_to_date"
  };
}

async function loadStageFields(productId: string, stageKey: string) {
  const snap = await getDocs(
    query(
      collection(db, "products", productId, "fields"),
      where("stage_key", "==", stageKey)
    )
  );

  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

async function loadStageMessages(productId: string, stageKey: string) {
  try {
    const snap = await getDocs(
      query(
        collection(db, "products", productId, "messages"),
        where("stage_key", "==", stageKey),
        limit(30)
      )
    );

    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (error) {
    console.warn("[StageClosureJob] Could not load messages", productId, stageKey, error);
    return [];
  }
}

async function loadConversationMemories(productId: string) {
  try {
    const snap = await getDocs(
      collection(db, "products", productId, "conversation_memory")
    );

    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (error) {
    console.warn("[StageClosureJob] Could not load conversation memories", productId, error);
    return [];
  }
}

function sanitizeErrorMessage(error: any) {
  const raw = String(error?.message || error || "Erro desconhecido");

  if (raw.includes("PayloadTooLargeError")) {
    return "PayloadTooLargeError: o payload enviado para geração do resumo inteligente está grande demais. Reduza fields, mensagens e memórias.";
  }

  if (raw.includes("<!DOCTYPE html>")) {
    return "Erro HTML retornado pelo runtime da IA.";
  }

  return raw
    .replace(/<!DOCTYPE[\s\S]*$/gi, "Erro HTML retornado pelo runtime da IA.")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 1000)
    .trim();
}

function buildFallbackClosure({ product, stage, fields }: any) {
  const decisions = fields
    .filter((f: any) => String(f.classification || f.type || "").toLowerCase().includes("decision"))
    .slice(0, 8)
    .map((f: any) => ({
      title: f.label || f.title || "Decisão",
      description: f.value || f.content || ""
    }));

  const hypotheses = fields
    .filter((f: any) => String(f.classification || f.type || "").toLowerCase().includes("hypothesis"))
    .slice(0, 8)
    .map((f: any) => ({
      title: f.label || f.title || "Hipótese",
      description: f.value || f.content || "",
      validation_needed: "Validar com evidências adicionais."
    }));

  return {
    title: `${stage.name || stage.stage_key || "Etapa"} consolidada`,
    executive_summary: `A etapa foi concluída com aprendizados estruturados. Foram consolidadas decisões, hipóteses e evidências suficientes para orientar a próxima fase do produto.`,
    problem_understanding: "",
    target_customer: "",
    evidence_summary: "",
    decision_summary: "",
    open_questions_summary: "",
    decisions,
    hypotheses,
    facts: [],
    risks: [],
    pending_points: [],
    recommended_next_step: {
      title: "Avançar para a próxima etapa",
      description: "Revise os pontos consolidados e avance para a próxima fase.",
      next_stage: "shape"
    }
  };
}

async function generateClosureWithAI({
  product,
  stage,
  fields,
  messages,
  conversationMemories,
  artifacts,
  documents,
  logs
}: any) {
  const compactPayloadRaw = buildStageClosureCompactPayload({
    product,
    stage,
    fields,
    messages,
    memories: conversationMemories,
    artifacts,
    documents
  });

  const compactPayload = hardTrimPayload(compactPayloadRaw, 18000);
  const payloadSize = estimateSize(compactPayload);

  logs.push({
    level: "info",
    message: `Payload compactado: ${payloadSize} caracteres. Campos ${compactPayload.counts?.selected_fields}/${compactPayload.counts?.raw_fields}, mensagens ${compactPayload.counts?.selected_messages}/${compactPayload.counts?.raw_messages}, memórias ${compactPayload.counts?.selected_memories}/${compactPayload.counts?.raw_memories}.`,
    created_at_ms: Date.now()
  });

  const prompt = `
Você é a Tona, copiloto sênior de construção de produto.

Gere um resumo inteligente da etapa finalizada.

Regras obrigatórias:
- Não copie histórico bruto.
- Não escreva "Usuário respondeu" nem "Tona orientou".
- Não inclua percentuais de maturidade no texto.
- Não invente evidências.
- Decisões são compromissos já assumidos.
- Hipóteses são afirmações ainda não comprovadas.
- Fatos/evidências são dados ou observações comprováveis.
- Pendências são perguntas abertas ou pontos que precisam ser fechados.
- Retorne apenas JSON válido.

Formato:
{
  "title": "...",
  "executive_summary": "...",
  "problem_understanding": "...",
  "target_customer": "...",
  "evidence_summary": "...",
  "decision_summary": "...",
  "open_questions_summary": "...",
  "decisions": [
    { "title": "...", "description": "..." }
  ],
  "hypotheses": [
    { "title": "...", "description": "...", "validation_needed": "..." }
  ],
  "facts": [
    { "title": "...", "description": "..." }
  ],
  "risks": [
    { "title": "...", "description": "...", "mitigation_hint": "..." }
  ],
  "pending_points": [
    { "title": "...", "description": "...", "suggested_action": "..." }
  ],
  "recommended_next_step": {
    "title": "...",
    "description": "...",
    "next_stage": "shape"
  }
}

DADOS:
${JSON.stringify(compactPayload)}
`;

  if (prompt.length > 25000) {
    throw new Error(`COMPACTED_PAYLOAD_TOO_LARGE:${prompt.length}`);
  }

  try {
    return await runTonaJsonGeneration(prompt);
  } catch (error: any) {
    const safeError = sanitizeErrorMessage(error);
    
    if (
        safeError.includes("PayloadTooLargeError") ||
        safeError.includes("COMPACTED_PAYLOAD_TOO_LARGE") ||
        safeError.includes("PROMPT_TOO_LARGE")
      ) {
            logs.push({ level: "warn", message: "Resumo fallback gerado porque o payload ainda ficou grande para a IA.", created_at_ms: Date.now() });
            
            const fallbackClosure = buildFallbackClosure({ product, stage, fields });
            return {
                ...fallbackClosure,
                ai_generation_failed: true,
                ai_generation_error: safeError
            };
      }

    logs.push({ level: "error", message: `Erro ao gerar IA: ${safeError}`, created_at_ms: Date.now() });
    
    // Fallback
    const fallback = buildFallbackClosure({ product, stage, fields });
    return {
      ...fallback,
      ai_generation_failed: true,
      ai_generation_error: safeError
    };
  }
}

function sanitizeClosure(aiClosure: any, { product, stage }: any) {
  const stageKey = stage.stage_key || stage.id;

  function asArray(value: any) {
    return Array.isArray(value) ? value : [];
  }

  function text(value: any, fallback = "") {
    return String(value || fallback || "").trim();
  }

  return cleanFirestoreData({
    product_id: product.id,
    product_name: product.name || null,
    stage_id: stageKey,
    stage_name: stage.name || stageKey,

    synthesis_type: "stage_closure",
    status: "active",

    title: text(aiClosure.title, `${stage.name || stageKey} consolidada`),
    executive_summary: text(aiClosure.executive_summary),
    problem_understanding: text(aiClosure.problem_understanding),
    target_customer: text(aiClosure.target_customer),
    evidence_summary: text(aiClosure.evidence_summary),
    decision_summary: text(aiClosure.decision_summary),
    open_questions_summary: text(aiClosure.open_questions_summary),

    decisions: asArray(aiClosure.decisions).slice(0, 12),
    hypotheses: asArray(aiClosure.hypotheses).slice(0, 12),
    facts: asArray(aiClosure.facts).slice(0, 12),
    risks: asArray(aiClosure.risks).slice(0, 8),
    pending_points: asArray(aiClosure.pending_points).slice(0, 8),

    recommended_next_step: aiClosure.recommended_next_step || {
      title: "Avançar para a próxima etapa",
      description: "A etapa foi consolidada e está pronta para seguir.",
      next_stage: "shape"
    },

    generated_by: "tona_scheduler",
    generated_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });
}

async function saveClosure({ product, stage, closure }: any) {
  const stageKey = stage.stage_key || stage.id;

  await setDoc(
    doc(db, "mindflow_product_synthesis", product.id, "items", `${stageKey}_stage_closure`),
    closure,
    { merge: true }
  );

  await setDoc(
    doc(db, "products", product.id, "stages", stageKey),
    cleanFirestoreData({
      status: "completed",
      is_completed: true,
      completion_title: closure.title,
      completion_summary: closure.executive_summary,
      completion_generated_at: serverTimestamp(),
      updated_at: serverTimestamp()
    }),
    { merge: true }
  );
}

export async function runStageClosureSummaryJob() {
  const startedAt = Date.now();
  const now = new Date();

  // Check if job is active before running
  const jobDoc = await getDoc(doc(db, "scheduler_jobs", "stage_closure_auto_summary"));
  if (jobDoc.exists()) {
    const job = jobDoc.data();
    if (job.status !== "active") return { status: "skipped_paused" };

    const nextRun = toMillis(job.next_run_at);
    if (nextRun && Date.now() < nextRun) {
      return { status: "skipped_time" };
    }
  }

  const stats = {
    products_checked: 0,
    stages_checked: 0,
    summaries_created: 0,
    summaries_updated: 0,
    summaries_skipped: 0,
    errors: [] as any[]
  };

  const logs = [
    { level: 'info', message: 'Execução iniciada.', created_at_ms: Date.now() }
  ];

  const runRef = await addDoc(
    collection(db, "scheduler_runs"),
    cleanFirestoreData({
      job_id: "stage_closure_auto_summary",
      job_name: "Resumo inteligente de etapas finalizadas",
      status: "running",
      started_at: serverTimestamp(),
      started_at_ms: now.getTime(),
      created_at: serverTimestamp(),
      created_at_ms: now.getTime(),
      updated_at: serverTimestamp(),
      heartbeat_at: serverTimestamp(),
      heartbeat_at_ms: now.getTime(),
      products_checked: 0,
      stages_checked: 0,
      summaries_created: 0,
      summaries_updated: 0,
      summaries_skipped: 0,
      errors_count: 0,
      errors: [],
      logs
    })
  );

  const updateHeartbeat = async (message?: string) => {
    if (message) logs.push({ level: 'info', message, created_at_ms: Date.now() });
    await updateDoc(runRef, cleanFirestoreData({
      heartbeat_at: serverTimestamp(),
      heartbeat_at_ms: Date.now(),
      updated_at: serverTimestamp(),
      products_checked: stats.products_checked,
      stages_checked: stats.stages_checked,
      summaries_created: stats.summaries_created,
      summaries_updated: stats.summaries_updated,
      summaries_skipped: stats.summaries_skipped,
      errors_count: stats.errors.length,
      logs
    }));
  };

  try {
    const productsSnap = await getDocs(
      query(collection(db, "products"), where("status", "in", ["active", "draft", "in_progress"]), limit(50))
    );

    for (const productDoc of productsSnap.docs) {
      const product = {
        id: productDoc.id,
        ...productDoc.data()
      } as any;

      stats.products_checked += 1;
      await updateHeartbeat(`Processando produto: ${product.name}`);

      const stagesSnap = await getDocs(
        collection(db, "products", product.id, "stages")
      );

      for (const stageDoc of stagesSnap.docs) {
        const stage = {
          id: stageDoc.id,
          ...stageDoc.data()
        } as any;

        const stageKey = stage.stage_key || stageDoc.id;

        if (!isStageCompleted(stage)) continue;

        stats.stages_checked += 1;

        try {
          const closureRef = doc(
            db,
            "mindflow_product_synthesis",
            product.id,
            "items",
            `${stageKey}_stage_closure`
          );

          const closureSnap = await getDoc(closureRef);
          const existingClosure = closureSnap.exists()
            ? { id: closureSnap.id, ...closureSnap.data() }
            : null;

          const decision = shouldGenerateOrUpdateClosure(stage, existingClosure);

          if (!decision.shouldRun) {
            stats.summaries_skipped += 1;
            continue;
          }

          logs.push({ level: 'info', message: `Gerando resumo para etapa: ${stage.name || stageKey} (${decision.reason})`, created_at_ms: Date.now() });

          const fields = await loadStageFields(product.id, stageKey);
          const messages = await loadStageMessages(product.id, stageKey);
          const conversationMemories = await loadConversationMemories(product.id);

          const aiClosure = await generateClosureWithAI({
            product,
            stage,
            fields,
            messages,
            conversationMemories,
            artifacts: [], // Assuming no artifacts for now, or fetch them if needed
            documents: [], // Assuming no documents for now, or fetch them if needed
            logs
          });

          const sanitizedClosure = sanitizeClosure(aiClosure, {
            product,
            stage
          });

          await saveClosure({
            product,
            stage,
            closure: sanitizedClosure
          });

          if (existingClosure) {
            stats.summaries_updated += 1;
          } else {
            stats.summaries_created += 1;
          }
          await updateHeartbeat();
        } catch (stageError: any) {
          const errMsg = stageError?.message || String(stageError);
          stats.errors.push({
            product_id: product.id,
            stage_id: stageKey,
            message: errMsg
          });
          logs.push({ level: 'error', message: `Erro na etapa ${stageKey}: ${errMsg}`, created_at_ms: Date.now() });
        }
      }
    }

    const status = stats.errors.length > 0 ? "partial" : "success";
    const duration = Date.now() - startedAt;

    logs.push({ 
      level: status === 'success' ? 'info' : 'warn', 
      message: `Execução finalizada. Produtos: ${stats.products_checked}, etapas: ${stats.stages_checked}, criados: ${stats.summaries_created}, atualizados: ${stats.summaries_updated}, ignorados: ${stats.summaries_skipped}, erros: ${stats.errors.length}.`, 
      created_at_ms: Date.now() 
    });

    await updateDoc(runRef, cleanFirestoreData({
      status,
      finished_at: serverTimestamp(),
      finished_at_ms: Date.now(),
      duration_ms: duration,
      ...stats,
      errors_count: stats.errors.length,
      logs,
      updated_at: serverTimestamp()
    }));

    const nextRunInterval = jobDoc.exists() ? (jobDoc.data().interval_minutes || 1) : 1;

    await setDoc(
      doc(db, "scheduler_jobs", "stage_closure_auto_summary"),
      cleanFirestoreData({
        id: "stage_closure_auto_summary",
        name: "Resumo inteligente de etapas finalizadas",
        description: "Gera ou atualiza automaticamente o resumo inteligente de etapas concluídas.",
        type: "stage_closure_summary",
        category: "system",
        system_job: true,
        status: "active",
        recurrence_type: "fixed_interval",
        interval_minutes: nextRunInterval,
        next_run_at: Timestamp.fromDate(new Date(Date.now() + nextRunInterval * 60 * 1000)),
        last_run_at: serverTimestamp(),
        last_status: status,
        last_result: stats,
        updated_at: serverTimestamp()
      }),
      { merge: true }
    );

    return {
      status,
      ...stats
    };
  } catch (error: any) {
    const duration = Date.now() - startedAt;
    const errMsg = error?.message || String(error);
    
    logs.push({ level: 'error', message: `Erro fatal no job: ${errMsg}`, created_at_ms: Date.now() });

    await updateDoc(runRef, cleanFirestoreData({
      status: "error",
      finished_at: serverTimestamp(),
      finished_at_ms: Date.now(),
      duration_ms: duration,
      error: errMsg,
      ...stats,
      errors_count: stats.errors.length + 1,
      errors: [...stats.errors, { message: errMsg, stack: error?.stack || null }],
      logs,
      updated_at: serverTimestamp()
    }));

    await setDoc(
      doc(db, "scheduler_jobs", "stage_closure_auto_summary"),
      cleanFirestoreData({
        id: "stage_closure_auto_summary",
        name: "Resumo inteligente de etapas finalizadas",
        type: "stage_closure_summary",
        category: "system",
        system_job: true,
        status: "active",
        recurrence_type: "fixed_interval",
        interval_minutes: 1,
        last_run_at: serverTimestamp(),
        last_status: "error",
        last_error: errMsg,
        updated_at: serverTimestamp()
      }),
      { merge: true }
    );

    throw error;
  }
}
