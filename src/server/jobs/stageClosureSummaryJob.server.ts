import {
  adminDb,
  adminFieldValue,
  adminTimestamp
} from "../firebaseAdmin";
import { generateJsonWithGemini } from "../ai/geminiClient.server";
import { buildStageClosureCompactPayload, hardTrimPayload } from "../../lib/scheduler/stageClosureCompactor";
import crypto from "crypto";

type JobParams = {
  trigger?: string;
  triggered_by_uid?: string;
  triggered_by_email?: string;
  job_id?: string;
  product_id?: string;
  stage_key?: string;
  force?: boolean;
};

function safeError(error: any) {
  return String(error?.message || error || "Erro desconhecido").slice(0, 1000);
}

function generateHash(data: any): string {
  return crypto.createHash("md5").update(JSON.stringify(data)).digest("hex");
}

/**
 * PIPELINE: Step 3 - Extract structured signals
 */
async function aiExtractStructuredSignals(compactInput: any) {
  const prompt = `
Você é a Tona, copiloto sênior de construção de produto.

Analise os dados da etapa e extraia apenas sinais estruturados.
Não escreva resumo executivo ainda.

Separe:
- decisões
- hipóteses
- fatos/evidências
- riscos
- pendências
- sinais sobre cliente/persona
- sinais sobre problema
- sinais sobre negócio

Regras:
- Não invente evidências.
- Não copie histórico bruto.
- Não mencione scheduler, Firebase, job ou Admin SDK.
- Não use percentuais antigos dentro dos textos.
- Retorne apenas JSON válido.

Dados:
${JSON.stringify(compactInput)}
`;

  const schemaHint = `
Formato:
{
  "decisions": [{"title": "", "description": "", "rationale": "", "confidence": "low|medium|high"}],
  "hypotheses": [{"title": "", "description": "", "validation_needed": ""}],
  "facts": [{"title": "", "description": "", "source_hint": ""}],
  "risks": [{"title": "", "description": "", "mitigation_hint": ""}],
  "pending_points": [{"title": "", "description": "", "suggested_action": ""}],
  "customer_signals": [],
  "problem_signals": [],
  "business_signals": []
}
`;

  const result = await generateJsonWithGemini({
    prompt,
    schemaHint,
    maxOutputTokens: 8192
  });

  return { ...result.json, model: result.model };
}

/**
 * PIPELINE: Step 4 - Generate executive closure
 */
async function aiGenerateExecutiveClosure(compactInput: any, structuredSignals: any) {
  const prompt = `
Você é a Tona, copiloto sênior de construção de produto.

A etapa está finalizada. Gere uma síntese executiva clara, bonita e útil para decisão.

Use os sinais estruturados abaixo.
Não mencione scheduler, Firebase, job, Admin SDK ou validação técnica.
Não cole conversa bruta.
Não escreva "usuário respondeu" ou "Tona orientou".
Não invente evidências.
Separe claramente o que é fato, hipótese e decisão.

Produto e etapa:
${JSON.stringify({
  product: compactInput.product,
  stage: compactInput.stage
})}

Sinais estruturados:
${JSON.stringify(structuredSignals)}
`;

  const schemaHint = `
Formato:
{
  "title": "",
  "subtitle": "",
  "executive_summary": "",
  "problem_understanding": "",
  "customer_understanding": "",
  "evidence_understanding": "",
  "decision_understanding": "",
  "risk_understanding": "",
  "pending_understanding": "",
  "recommended_next_step": {
    "title": "",
    "description": "",
    "next_stage": "",
    "cta_label": ""
  }
}
`;

  const result = await generateJsonWithGemini({
    prompt,
    schemaHint,
    maxOutputTokens: 8192
  });

  return { ...result.json, model: result.model };
}

/**
 * PIPELINE: Step 5 - Generate UI phrases
 */
async function aiGenerateUiPhrases(executiveClosure: any, structuredSignals: any) {
  const prompt = `
Você é a Tona escrevendo textos curtos para a interface do Product Constructor.

Gere frases curtas para:
- painel lateral "Entendimento Atual"
- card "Resumo Consolidado"
- card informativo de próximo passo
- card conversacional de etapa concluída
- "Onde Paramos"

Regras:
- Textos curtos.
- Nada técnico.
- Nada de scheduler, Firebase, job ou Admin SDK.
- Nada de percentuais antigos.
- Não repetir o resumo inteiro.
- Linguagem clara, executiva e amigável.

Resumo executivo:
${JSON.stringify(executiveClosure)}

Sinais:
${JSON.stringify(structuredSignals)}
`;

  const schemaHint = `
Formato:
{
  "right_panel": {
    "strategic_synthesis_title": "Entendimento Atual",
    "strategic_synthesis_body": "máximo 450 caracteres",
    "consolidated_summary_body": "máximo 350 caracteres",
    "next_step_hint": "máximo 220 caracteres"
  },
  "where_we_stopped": {
    "theme": "",
    "summary": "",
    "next_question": ""
  },
  "conversation_card": {
    "title": "",
    "body": "",
    "quick_actions": [
      {
        "label": "",
        "intent": "",
        "message": ""
      }
    ]
  }
}
`;

  const result = await generateJsonWithGemini({
    prompt,
    schemaHint,
    maxOutputTokens: 4096
  });

  return { ...result.json, model: result.model };
}

/**
 * FALLBACK: When AI fails
 */
function buildFriendlyClosureFallback(compactInput: any, structuredSignals: any = {}) {
  const stageName = compactInput.stage.name || "Etapa";

  return {
    title: `${stageName} consolidada`,
    subtitle: "Resumo compacto gerado a partir das informações salvas.",
    executive_summary:
      "A etapa foi concluída com informações suficientes para orientar o próximo passo. Há decisões, hipóteses e sinais registrados que estruturam o entendimento atual, mas o resumo completo por IA não pôde ser gerado agora.",
    problem_understanding:
      "O problema foi trabalhado durante a etapa e possui registros salvos na memória do produto.",
    customer_understanding:
      "A definição de cliente/persona possui sinais registrados, mas pode ser revisitada para ganhar precisão.",
    evidence_understanding:
      "Existem evidências e fatos registrados, mas recomenda-se revisar a força dessas evidências antes de decisões críticas.",
    decision_understanding:
      "As decisões registradas foram preservadas e podem ser rediscutidas individualmente.",
    risk_understanding:
      "Os riscos identificados devem ser revisados antes do avanço para a próxima etapa.",
    pending_understanding:
      "As pendências restantes devem ser tratadas como pontos de atenção para o próximo ciclo.",
    right_panel: {
      strategic_synthesis_title: "Entendimento Atual",
      strategic_synthesis_body:
        "A etapa foi concluída e possui informações suficientes para orientar o próximo passo. Revise decisões, hipóteses e evidências antes de avançar.",
      consolidated_summary_body:
        "Resumo compacto disponível. Gere novamente para obter uma síntese mais rica.",
      next_step_hint:
        "Revise o resumo compacto ou avance para a próxima etapa."
    },
    where_we_stopped: {
      theme: "Etapa consolidada",
      summary:
        "A etapa foi concluída. O produto possui uma base mínima registrada para avançar.",
      next_question:
        "Você quer avançar para a próxima etapa ou rediscutir algum ponto específico?"
    },
    conversation_card: {
      title: "Resumo inteligente da etapa",
      body:
        "A etapa foi consolidada com base nas informações salvas. Você pode avançar, rediscutir pontos específicos ou regenerar o resumo.",
      quick_actions: [
        {
          label: "Avançar etapa",
          intent: "advance_next_stage",
          message: "Avance para a próxima etapa com base no entendimento consolidado."
        },
        {
          label: "Rediscutir ponto",
          intent: "reopen_stage_discussion",
          message: "Quero rediscutir um ponto da etapa concluída."
        },
        {
          label: "Regenerar resumo",
          intent: "regenerate_stage_summary",
          message: "Regere o resumo inteligente da etapa."
        }
      ]
    },
    recommended_next_step: {
      title: "Avançar para a próxima etapa",
      description:
        "Use o entendimento consolidado como base para continuar a construção do produto.",
      next_stage: compactInput.stage.next_stage || null,
      cta_label: "Avançar etapa"
    }
  };
}

/**
 * PROJECTIONS: Update all relevant documents
 */
async function applyStageClosureProjections(productId: string, stageKey: string, closure: any) {
  const batch = adminDb.batch();

  // 1. Update synthesis
  const synthesisRef = adminDb.collection("mindflow_product_synthesis")
    .doc(productId)
    .collection("items")
    .doc(`${stageKey}_stage_closure`);
  batch.set(synthesisRef, closure, { merge: true });

  // 2. Update stage doc
  const stageRef = adminDb.collection("products").doc(productId).collection("stages").doc(stageKey);
  batch.set(stageRef, {
    closure_status: closure.status || "generated",
    closure_summary: closure.executive_summary,
    closure_title: closure.title,
    closure_subtitle: closure.subtitle,
    closure_generated_at: closure.generated_at || adminFieldValue.serverTimestamp(),
    closure_generated_at_ms: closure.generated_at_ms || Date.now(),
    understanding_summary: closure.right_panel.strategic_synthesis_body,
    consolidated_summary: closure.right_panel.consolidated_summary_body,
    next_step_hint: closure.right_panel.next_step_hint,
    where_we_stopped: closure.where_we_stopped,
    recommended_next_step: closure.recommended_next_step,
    updated_at: adminFieldValue.serverTimestamp(),
    updated_at_ms: Date.now()
  }, { merge: true });

  // 3. Update product doc
  const productRef = adminDb.collection("products").doc(productId);
  batch.set(productRef, {
    current_understanding: closure.right_panel.strategic_synthesis_body,
    current_stage_summary: closure.executive_summary,
    current_stage_next_step: closure.recommended_next_step?.description || null,
    updated_at: adminFieldValue.serverTimestamp(),
    updated_at_ms: Date.now()
  }, { merge: true });

  // 4. Update conversation card
  const cardRef = adminDb.collection("products").doc(productId).collection("conversation_cards").doc(`stage_closure_${stageKey}`);
  batch.set(cardRef, {
    type: "stage_closure",
    stage_key: stageKey,
    ...closure.conversation_card,
    recommended_next_step: closure.recommended_next_step,
    created_at: adminFieldValue.serverTimestamp(),
    updated_at: adminFieldValue.serverTimestamp()
  }, { merge: true });

  await batch.commit();
}

export async function runStageClosureSummaryJobServer(params: JobParams = {}) {
  const startedAtMs = Date.now();
  const runRef = adminDb.collection("scheduler_runs").doc();

  const logs: any[] = [];
  const errors: any[] = [];
  const stats = {
    products_checked: 0,
    stages_checked: 0,
    summaries_created: 0,
    summaries_updated: 0,
    summaries_skipped: 0,
    ai_calls: 0,
    fallbacks_created: 0
  };

  let runCreated = false;

  const updateRunProgress = async (message?: string, level: "info" | "success" | "error" = "info", forceWrite = false) => {
    if (message) {
      logs.push({ level, message, created_at_ms: Date.now() });
      console.log(`[Scheduler Job] ${message}`);
    }

    if (!forceWrite && !message?.includes("Iniciada") && (stats.products_checked + stats.stages_checked) % 10 !== 0) {
      return;
    }

    const payload: any = {
      status: "running",
      heartbeat_at: adminFieldValue.serverTimestamp(),
      heartbeat_at_ms: Date.now(),
      ...stats,
      errors_count: errors.length,
      errors: errors.slice(-10), // Reduced slice to save space/bandwidth
      logs: logs.slice(-20),   // Reduced slice to save space/bandwidth
      updated_at: adminFieldValue.serverTimestamp(),
      updated_at_ms: Date.now()
    };

    if (!runCreated) {
      payload.job_id = "stage_closure_auto_summary";
      payload.job_name = "Resumo inteligente de etapas finalizadas";
      payload.trigger = params.trigger || "manual";
      payload.triggered_by_uid = params.triggered_by_uid || null;
      payload.triggered_by_email = params.triggered_by_email || null;
      payload.started_at = adminFieldValue.serverTimestamp();
      payload.started_at_ms = startedAtMs;
      payload.created_at = adminFieldValue.serverTimestamp();
      payload.created_at_ms = startedAtMs;
      runCreated = true;
    }

    await runRef.set(payload, { merge: true });
  };

  await updateRunProgress(`Execução iniciada pelo trigger: ${params.trigger || "manual"}.`);

  try {
    let productsDocs: any[] = [];

    if (params.product_id) {
      const doc = await adminDb.collection("products").doc(params.product_id).get();
      if (doc.exists) productsDocs = [doc];
    } else {
      const snap = await adminDb.collection("products").get();
      productsDocs = snap.docs;
    }

    stats.products_checked = productsDocs.length;
    await updateRunProgress();

    for (const productDoc of productsDocs) {
      const productId = productDoc.id;
      const productData = productDoc.data();
      const productName = productData.name || productData.title || productId;

      await updateRunProgress(`Processando produto: ${productName}`);

      let stagesDocs: any[] = [];
      const stagesCol = adminDb.collection("products").doc(productId).collection("stages");

      if (params.stage_key) {
        const doc = await stagesCol.doc(params.stage_key).get();
        if (doc.exists) stagesDocs = [doc];
      } else {
        const snap = await stagesCol.get();
        stagesDocs = snap.docs;
      }

      for (const stageDoc of stagesDocs) {
        const stage = { id: stageDoc.id, ...stageDoc.data() } as any;
        const stageKey = stage.stage_key || stage.key || stageDoc.id;
        const stageName = stage.name || stageKey;

        const progress = Number(stage.progress ?? stage.maturity ?? 0);
        const status = String(stage.status || "").toLowerCase();

        const isClosed =
          progress >= 100 ||
          status === "completed" ||
          status === "done" ||
          status === "closed";

        if (!isClosed) {
          stats.summaries_skipped += 1;
          continue;
        }

        stats.stages_checked += 1;

        // Fetch supporting data
        const [fieldsSnap, messagesSnap, memoriesSnap, artifactsSnap, documentsSnap] = await Promise.all([
          adminDb.collection("products").doc(productId).collection("fields").where("stage_key", "==", stageKey).get(),
          adminDb.collection("conversation_messages").where("product_id", "==", productId).orderBy("created_at", "desc").limit(40).get(),
          adminDb.collection("products").doc(productId).collection("memories").where("stage_key", "==", stageKey).get(),
          adminDb.collection("products").doc(productId).collection("artifacts").where("stage_key", "==", stageKey).get(),
          adminDb.collection("products").doc(productId).collection("documents").where("stage_key", "==", stageKey).get()
        ]);

        const rawData = {
          product: { id: productId, ...productData },
          stage: { id: stageKey, ...stage },
          fields: fieldsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          messages: messagesSnap.docs.map(d => ({ id: d.id, ...d.data() })).reverse(),
          memories: memoriesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          artifacts: artifactsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          documents: documentsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        };

        const compactPayload = hardTrimPayload(buildStageClosureCompactPayload(rawData));
        const sourceHash = generateHash(compactPayload);

        const synthesisRef = adminDb
          .collection("mindflow_product_synthesis")
          .doc(productId)
          .collection("items")
          .doc(`${stageKey}_stage_closure`);

        const existingSnap = await synthesisRef.get();
        const existingData = existingSnap.exists ? existingSnap.data() : null;

        if (!params.force && existingData?.source_hash === sourceHash) {
          await updateRunProgress(`Resumo para ${productName} / ${stageKey} já está atualizado. Pulando.`);
          stats.summaries_skipped += 1;
          continue;
        }

        await updateRunProgress(`Gerando síntese inteligente para ${productName} / ${stageKey}...`);

        let closure: any = null;
        let aiModelsUsed: any = {};
        let aiFailed = false;

        try {
          // PIPELINE START
          const structuredSignals = await aiExtractStructuredSignals(compactPayload);
          stats.ai_calls += 1;
          aiModelsUsed.extraction = structuredSignals.model;

          const executiveClosure = await aiGenerateExecutiveClosure(compactPayload, structuredSignals);
          stats.ai_calls += 1;
          aiModelsUsed.executive = executiveClosure.model;

          const uiPhrases = await aiGenerateUiPhrases(executiveClosure, structuredSignals);
          stats.ai_calls += 1;
          aiModelsUsed.ui = uiPhrases.model;

          closure = {
            product_id: productId,
            stage_key: stageKey,
            stage_name: stageName,
            status: existingData ? "regenerated" : "generated",
            maturity: progress,
            generated_by: "ai_stage_closure_summary",
            generated_at: adminFieldValue.serverTimestamp(),
            generated_at_ms: Date.now(),
            updated_at: adminFieldValue.serverTimestamp(),
            updated_at_ms: Date.now(),
            source_hash: sourceHash,

            ...executiveClosure,
            ...uiPhrases,

            decisions: structuredSignals.decisions || [],
            hypotheses: structuredSignals.hypotheses || [],
            facts: structuredSignals.facts || [],
            risks: structuredSignals.risks || [],
            pending_points: structuredSignals.pending_points || [],
            
            ai_models_used: aiModelsUsed
          };
        } catch (aiError) {
          aiFailed = true;
          console.error(`[Scheduler Job] AI Pipeline Error for ${productId}/${stageKey}:`, aiError);
          errors.push({
            product_id: productId,
            product_name: productName,
            stage_key: stageKey,
            stage_name: stageName,
            error: safeError(aiError)
          });
          await updateRunProgress(`Falha ao gerar pipeline IA para ${stageKey}: ${safeError(aiError)}. Aplicando fallback.`, "error");

          // FALLBACK
          const fallbackData = buildFriendlyClosureFallback(compactPayload);
          closure = {
            ...fallbackData,
            product_id: productId,
            stage_key: stageKey,
            stage_name: stageName,
            status: "success_with_fallback",
            maturity: progress,
            generated_by: "ai_stage_closure_fallback",
            generated_at: adminFieldValue.serverTimestamp(),
            generated_at_ms: Date.now(),
            updated_at: adminFieldValue.serverTimestamp(),
            updated_at_ms: Date.now(),
            source_hash: sourceHash,
            ai_error: safeError(aiError)
          };
          stats.fallbacks_created += 1;
        }

        if (closure) {
          await applyStageClosureProjections(productId, stageKey, closure);
          
          if (existingSnap.exists) {
            stats.summaries_updated += 1;
          } else {
            stats.summaries_created += 1;
          }
          await updateRunProgress(`Resumo inteligente ${aiFailed ? "com fallback" : "completo"} projetado para ${stageKey}.`, "success");
        }
      }
    }

    const finishedAtMs = Date.now();
    // Rule: if fallback saved, it's success_with_fallback, but job status success if no total failures
    const finalStatus = errors.length ? (stats.summaries_created + stats.summaries_updated > 0 ? "partial" : "error") : "success";

    await runRef.set(
      {
        status: finalStatus,
        finished_at: adminFieldValue.serverTimestamp(),
        finished_at_ms: finishedAtMs,
        duration_ms: finishedAtMs - startedAtMs,
        ...stats,
        errors_count: errors.length,
        errors: errors.slice(-50),
        logs,
        updated_at: adminFieldValue.serverTimestamp(),
        updated_at_ms: finishedAtMs
      },
      { merge: true }
    );

    const jobRef = adminDb
      .collection("scheduler_jobs")
      .doc("stage_closure_auto_summary");

    const jobSnap = await jobRef.get();
    const job = jobSnap.exists ? jobSnap.data() : {};
    const intervalMinutes = Number(job?.interval_minutes || job?.fixed_interval || 30);
    const nextMs = Date.now() + intervalMinutes * 60 * 1000;

    const updateData: any = {
      last_run_at: adminFieldValue.serverTimestamp(),
      last_run_at_ms: Date.now(),
      next_run_at: adminTimestamp.fromMillis(nextMs),
      next_run_at_ms: nextMs,
      last_status: finalStatus,
      updated_at: adminFieldValue.serverTimestamp(),
      updated_at_ms: Date.now()
    };

    // Migration if needed
    if (!job.interval_minutes && job.fixed_interval) {
      updateData.interval_minutes = Number(job.fixed_interval);
      updateData.recurrence_type = "fixed_interval";
    }

    await jobRef.set(updateData, { merge: true });

    return {
      ok: true,
      status: finalStatus,
      ...stats,
      errors_count: errors.length
    };
  } catch (error: any) {
    const finishedAtMs = Date.now();
    const message = safeError(error);

    errors.push({ 
      product_id: params.product_id || null,
      stage_key: params.stage_key || null,
      message 
    });

    await runRef.set(
      {
        status: "error",
        finished_at: adminFieldValue.serverTimestamp(),
        finished_at_ms: finishedAtMs,
        duration_ms: finishedAtMs - startedAtMs,
        ...stats,
        errors_count: errors.length,
        errors: errors.slice(-50),
        logs: [
          ...logs,
          {
            level: "error",
            message,
            created_at_ms: Date.now()
          }
        ],
        updated_at: adminFieldValue.serverTimestamp(),
        updated_at_ms: finishedAtMs
      },
      { merge: true }
    );

    const jobRef = adminDb
      .collection("scheduler_jobs")
      .doc("stage_closure_auto_summary");

    const retryMs = Date.now() + 5 * 60 * 1000;

    await jobRef.set(
      {
        last_run_at: adminFieldValue.serverTimestamp(),
        last_run_at_ms: Date.now(),
        next_run_at: adminTimestamp.fromMillis(retryMs),
        next_run_at_ms: retryMs,
        last_status: "error",
        last_error: message,
        updated_at: adminFieldValue.serverTimestamp(),
        updated_at_ms: Date.now()
      },
      { merge: true }
    );

    throw error;
  }
}
