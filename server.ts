import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

process.on("uncaughtException", (err) => {
  console.error("[CRITICAL] Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[CRITICAL] Unhandled Rejection at:", promise, "reason:", reason);
});

console.log("[Server] Starting server initialization...");

console.log("[Server] Importing dependencies...");
import { getGeminiClient, checkGeminiHealth, assertGeminiConfigured, testGeminiConnection } from "./src/server/geminiClient";
console.log("[Server] Gemini Client imported.");
import { resolveGeminiModel, getGeminiModelConfig, saveGeminiModelConfig } from "./src/server/geminiModelResolver";
console.log("[Server] Gemini Model Resolver imported.");
import { processProductDocument } from "./src/server/documentProcessor";
console.log("[Server] Document Processor imported.");

async function startServer() {
  console.log("[Server] inside startServer()");
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  console.log("[Server] Checking Gemini configuration...");
  const geminiStatus = assertGeminiConfigured();
  if (geminiStatus.configured) {
    console.log(`[Server] Gemini API Key found from ${geminiStatus.keySource}`);
    console.log(`[Server] Preview: ${geminiStatus.keyPreview}`);
    console.log(`[Server] Length: ${geminiStatus.length}`);
    console.log(`[Server] Prefix OK (starts with AIza): ${geminiStatus.prefixOk}`);
  } else {
    console.warn("[Server] Gemini API Key is MISSING or INVALID");
    if (geminiStatus.isPlaceholder) {
      console.warn("[Server] Reason: Key is set to placeholder 'MY_GEMINI_API_KEY'");
    }
  }

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Test Connection Endpoint (Secure Temporary Key Test)
  app.post("/api/admin/integrations/gemini/test-temporary-key", async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey) return res.status(400).json({ error: "API Key is required" });
      
      console.log(`[Security] Temporary key test initiated by user.`);
      const result = await testGeminiConnection(apiKey);
      
      res.json({
        success: result.success,
        message: result.message,
        warning: "Esta chave foi usada apenas para teste e NÃO foi salva no servidor."
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Integrations Health Check
  app.get("/api/integrations/gemini/health", async (req, res) => {
    try {
      const health = await checkGeminiHealth();
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ status: "error", message: error.message });
    }
  });

  // NEW: List available models
  app.get("/api/admin/integrations/gemini/models", async (req, res) => {
    try {
      const ai = getGeminiClient() as any;
      const response = await ai.models.list();
      const models = (response.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => ({
          name: m.name,
          id: m.name.replace('models/', ''),
          displayName: m.displayName,
          supportedGenerationMethods: m.supportedGenerationMethods
        }));
      res.json({ models });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // NEW: Test a specific model or webhook
  app.post("/api/admin/integrations/gemini/test-model", async (req, res) => {
    try {
      const { model } = req.body;
      
      // Check Engine Mode
      const aiConfig = await getGeminiModelConfig() as any;
      const isWebhookMode = aiConfig.engineMode === 'webhook' && aiConfig.webhookUrl;

      if (isWebhookMode) {
        console.log(`[LLM Test] Testing Webhook: ${aiConfig.webhookUrl}`);
        const { callAIWebhook } = await import("./src/server/aiWebhookClient");
        const result = await callAIWebhook(aiConfig.webhookUrl, {
          prompt: "Teste de conexão do Admin. Por favor, responda apenas 'CONECTADO'.",
          instructions: "TEST_MODE: Verificação de conectividade do sistema."
        });
        return res.json({ 
          success: true, 
          message: `Webhook respondendo: "${result.text.substring(0, 100)}${result.text.length > 100 ? '...' : ''}"`,
          type: 'webhook'
        });
      }

      if (!model) return res.status(400).json({ error: "Model is required in direct mode" });

      const ai = getGeminiClient() as any;
      const targetModel = model.startsWith('models/') ? model : `models/${model}`;
      
      await ai.models.generateContent({
        model: targetModel,
        contents: [{ role: "user", parts: [{ text: "ping" }] }]
      });

      res.json({ 
        success: true, 
        message: `O modelo ${model} está configurado e respondendo corretamente.`,
        type: 'direct'
      });
    } catch (error: any) {
      console.error("[LLM Test] failed:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // NEW: Save Gemini config (MODELS, ENGINE MODE, WEBHOOK)
  app.post("/api/admin/integrations/gemini/config", async (req, res) => {
    try {
      const { defaultModel, displayName, useCaseModels, engineMode, webhookUrl, userId, userEmail } = req.body;
      if (!defaultModel && engineMode === 'direct') return res.status(400).json({ error: "defaultModel is required when in direct mode" });

      // SECURITY: NEVER accept apiKey in this endpoint
      const config = await saveGeminiModelConfig({ 
        defaultModel: defaultModel || "gemini-1.5-flash", 
        displayName, 
        useCaseModels, 
        engineMode,
        webhookUrl,
        userId: userId || "admin", 
        userEmail: userEmail || "admin@tona.ai" 
      });
      
      res.json({ success: true, config });
    } catch (error: any) {
      console.error("Gemini Config Save Error:", error);
      if (error.message && error.message.includes("Could not load")) {
        return res.status(500).json({
          error: "FIREBASE_ADMIN_CREDENTIALS_MISSING",
          message: "Não consegui salvar a configuração porque o Firebase Admin não possui credenciais server-side.",
          recommendedAction: "Configure FIREBASE_SERVICE_ACCOUNT nos Secrets do ambiente."
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // NEW: Get Gemini config (MASKED)
  app.get("/api/admin/integrations/gemini/config", async (req, res) => {
    try {
      const modelConfig = await getGeminiModelConfig();
      const keyConfig = assertGeminiConfigured();
      
      res.json({
        provider: "google_gemini",
        engineMode: (modelConfig as any).engineMode || "direct",
        webhookUrl: (modelConfig as any).webhookUrl || "",
        defaultModel: modelConfig.defaultModel,
        displayName: modelConfig.displayName,
        source: modelConfig.source,
        envModel: modelConfig.envModel,
        fallbackModel: modelConfig.fallbackModel,
        keyExists: keyConfig.keyExists,
        keyValid: keyConfig.keyValid,
        keyFound: keyConfig.keyExists, // compatibility
        keyErrorType: keyConfig.errorType,
        isPlaceholder: keyConfig.isPlaceholder,
        keySource: keyConfig.keySource,
        keyPreview: keyConfig.keyPreview,
        keyLength: keyConfig.length
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Gemini Proxy Agent (Specific to Mindflow)
  app.post("/api/mindflow/chat", async (req, res) => {
    try {
      const { prompt, userMessage, model: requestedModel, config = {}, useCase, agentId, productId, stageId, userId, userEmail } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      // Check Engine Mode
      const aiConfig = await getGeminiModelConfig() as any;
      const isWebhookMode = aiConfig.engineMode === 'webhook' && aiConfig.webhookUrl;

      if (isWebhookMode) {
        console.log(`[LLM] Forwarding to Webhook: ${aiConfig.webhookUrl}`);
        const { callAIWebhook } = await import("./src/server/aiWebhookClient");
        const result = await callAIWebhook(aiConfig.webhookUrl, {
          prompt: userMessage || prompt, // Prefer original user message for "message" field
          productId,
          stageId,
          agentId,
          userId,
          userEmail,
          instructions: prompt // The full prompt acts as instructions
        });
        return res.json({ text: result.text });
      }

      // Resolve model using priority logic
      let model = await resolveGeminiModel({ useCase, agentId });
      
      // If the frontend explicitly sends a model, we can decide whether to trust it or override it.
      // The user said: "Não confiar cegamente em model vindo do frontend. Se o frontend enviar model, validar contra allowlist..."
      // For now, if a model is requested, we use it ONLY if it's in the allowed list or we just override with resolved model.
      // Let's implement a basic trust check or just prioritize resolved model.
      if (requestedModel) {
        // Validation could go here. For MVP, we'll use resolveGeminiModel which is safer.
        // If we want to allow the frontend to specify, we should check if it's valid.
      }

      console.log(`[LLM] Using model: ${model} for useCase: ${useCase || 'default'}`);

      const ai = getGeminiClient() as any;
      
      const result = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config
      });
      
      const text = result.text || "";
      res.json({ text });
    } catch (error: any) {
      console.error("Gemini Proxy Error:", error);
      
      const config = assertGeminiConfigured();
      const isInvalidKey = error.message?.includes("API key not valid");
      
      res.status(500).json({ 
        error: error.message || "Internal Server Error",
        type: isInvalidKey ? "API_KEY_INVALID" : "LLM_PROVIDER_ERROR",
        diagnostics: {
          keySource: config.keySource,
          keyPreview: config.keyPreview,
          keyLength: config.length,
          prefixOk: config.prefixOk,
          isPlaceholder: config.isPlaceholder,
          advice: config.isPlaceholder
            ? `The environment variable ${config.keySource} is currently set to a placeholder value ("${config.keyPreview}"). Please open the Secrets panel in AI Studio, delete any existing GEMINI_API_KEY, and add a NEW secret named GEMINI_API_KEY with your real API key from https://aistudio.google.com/app/apikey.`
            : isInvalidKey 
              ? "The API key being used is reported as invalid by Google. If you are using 'AI Studio Free Tier' in the Secrets panel, try deleting it and creating a manual secret named GEMINI_API_KEY with your own key."
              : "Please check your network connection and Gemini configuration."
        }
      });
    }
  });

  // Document Processing
  app.post("/api/products/:productId/documents/:documentId/process", async (req, res) => {
    try {
      const { productId, documentId } = req.params;
      const { storagePath, fileName, mimeType, stageKey, autoAddToMemory, userId, userEmail, userName } = req.body;

      if (!storagePath || !fileName) {
        return res.status(400).json({ error: "storagePath and fileName are required" });
      }

      // Start processing in background (async)
      processProductDocument({
        productId,
        documentId,
        storagePath,
        fileName,
        mimeType,
        stageKey,
        autoAddToMemory,
        userId,
        userEmail,
        userName
      }).catch(err => {
        console.error(`Background processing failed for ${documentId}:`, err);
      });

      res.json({ success: true, message: "Processamento iniciado em segundo plano." });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // New: Trigger scheduler job
  app.post("/api/admin/scheduler/run-stage-closure", async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.replace("Bearer ", "").trim();

      if (!token) {
        return res.status(401).json({
          ok: false,
          error: "unauthenticated",
          message: "Token de autenticação ausente."
        });
      }

      const {
        adminAuth,
        adminDb,
        assertAdminServiceAccountReady
      } = await import("./src/server/firebaseAdmin");

      assertAdminServiceAccountReady();

      const decoded = await adminAuth.verifyIdToken(token);

      const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
      const userData = userSnap.exists ? userSnap.data() : {};
      const email = decoded.email || userData?.email;

      const isOwner =
        userData?.system_role === "owner" ||
        userData?.role === "owner" ||
        email === "rodrigo.moura@hotmart.com" ||
        email === "celular@rodrigomoura.net";

      const isAdmin =
        isOwner ||
        userData?.system_role === "admin" ||
        userData?.role === "admin";

      if (!isAdmin) {
        return res.status(403).json({
          ok: false,
          error: "permission-denied",
          message: "Apenas OWNER ou ADMIN podem executar jobs do Agendador.",
          debug: {
            uid: decoded.uid,
            email,
            role: userData?.role || null,
            system_role: userData?.system_role || null
          }
        });
      }

      const { runStageClosureSummaryJobServer } = await import(
        "./src/server/jobs/stageClosureSummaryJob.server"
      );

      const result = await runStageClosureSummaryJobServer({
        trigger: req.body?.trigger || "manual",
        triggered_by_uid: decoded.uid,
        triggered_by_email: email,
        job_id: req.body?.job_id || "stage_closure_auto_summary",
        product_id: req.body?.product_id,
        stage_key: req.body?.stage_key,
        force: req.body?.force
      });

      return res.status(200).json({
        ok: true,
        ...result
      });
    } catch (error: any) {
      console.error("[Scheduler API] run-stage-closure failed", error);

      return res.status(500).json({
        ok: false,
        error: "scheduler-execution-failed",
        message: error?.message || String(error)
      });
    }
  });

  // --- WEBHOOKS ADMIN API ---

  // List Webhooks
  app.get("/api/admin/webhooks", async (req, res) => {
    try {
      const { adminDb } = await import("./src/server/firebaseAdmin");
      const snapshot = await adminDb.collection("webhooks").orderBy("created_at", "desc").get();
      const webhooks = snapshot.docs.map(doc => {
        const data = doc.data();
        const maskedData = { ...data };
        // Mask sensitive data
        if (maskedData.encrypted_secret_reference) {
          maskedData.encrypted_secret_reference = "••••••••••••••••";
        }
        return { id: doc.id, ...maskedData };
      });
      res.json({ webhooks });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create Webhook
  app.post("/api/admin/webhooks", async (req, res) => {
    try {
      const { adminDb, adminFieldValue } = await import("./src/server/firebaseAdmin");
      const webhookData = req.body;
      
      const docRef = await adminDb.collection("webhooks").add({
        ...webhookData,
        created_at: adminFieldValue.serverTimestamp(),
        updated_at: adminFieldValue.serverTimestamp(),
        is_active: webhookData.is_active !== undefined ? webhookData.is_active : true
      });
      
      res.json({ id: docRef.id, success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update Webhook
  app.patch("/api/admin/webhooks/:id", async (req, res) => {
    try {
      const { adminDb, adminFieldValue } = await import("./src/server/firebaseAdmin");
      const { id } = req.params;
      const updateData = req.body;
      
      // Prevent unmasking if the user didn't change it but sent the masked value back
      if (updateData.encrypted_secret_reference === "••••••••••••••••") {
        delete updateData.encrypted_secret_reference;
      }

      await adminDb.collection("webhooks").doc(id).update({
        ...updateData,
        updated_at: adminFieldValue.serverTimestamp()
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete Webhook
  app.delete("/api/admin/webhooks/:id", async (req, res) => {
    try {
      const { adminDb } = await import("./src/server/firebaseAdmin");
      const { id } = req.params;
      await adminDb.collection("webhooks").doc(id).delete();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test Webhook
  app.post("/api/admin/webhooks/test", async (req, res) => {
    const { adminDb, adminFieldValue } = await import("./src/server/firebaseAdmin");
    
    // Function to mask sensitive data
    const maskHeaderValue = (val: string): string => {
      if (!val) return "";
      if (val.startsWith("Bearer ")) {
        const token = val.substring(7);
        return `Bearer ${token.length > 4 ? "****" + token.substring(token.length - 4) : "****"}`;
      }
      return val.length > 4 ? "****" + val.substring(val.length - 4) : "****";
    };

    const maskSensitiveHeaders = (headers: any) => {
      const masked = { ...headers };
      const sensitiveKeys = ["authorization", "token", "key", "secret", "password", "x-api-key"];
      Object.keys(masked).forEach(key => {
        if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
          masked[key] = maskHeaderValue(String(masked[key]));
        }
      });
      return masked;
    };

    try {
      const { webhook, payload } = req.body;
      if (!webhook || !webhook.url) return res.status(400).json({ error: "Webhook URL é obrigatória." });

      // URL Validation
      if (!webhook.url.startsWith("https://")) {
        return res.status(400).json({ error: "Apenas conexões HTTPS são permitidas por segurança." });
      }

      const internalPatterns = ["localhost", "127.0.0.1", "0.0.0.0", "192.168.", "10.", "172.16.", "172.31."];
      if (internalPatterns.some(p => webhook.url.includes(p))) {
        return res.status(400).json({ error: "Endpoints locais ou privados não são permitidos." });
      }

      const startTime = Date.now();
      const traceId = `test_${Math.random().toString(36).substring(2, 10)}`;
      
      const axios = (await import("axios")).default;
      
      const headers: any = {
        'Content-Type': 'application/json',
        'X-Tona-Trace-ID': traceId
      };

      // Apply Auth
      let realSecret = webhook.encrypted_secret_reference;
      if (realSecret === "••••••••••••••••" && webhook.id) {
         const snap = await adminDb.collection("webhooks").doc(webhook.id).get();
         realSecret = snap.data()?.encrypted_secret_reference;
      }

      if (webhook.auth_type === 'bearer' && realSecret) {
         headers['Authorization'] = `Bearer ${realSecret}`;
      } else if (webhook.auth_type === 'apikey' && webhook.auth_header_name && realSecret) {
         headers[webhook.auth_header_name] = realSecret;
      } else if (webhook.auth_type === 'header' && webhook.auth_header_name && realSecret) {
         headers[webhook.auth_header_name] = realSecret;
      }

      // Custom Headers
      if (Array.isArray(webhook.custom_headers)) {
        webhook.custom_headers.forEach((h: any) => {
          if (h.key && h.value && h.active !== false) {
            headers[h.key] = h.value;
          }
        });
      }

      let response;
      let errorData: any = null;
      let diagnosticMessage = "";
      
      try {
        response = await axios({
          method: webhook.method || 'POST',
          url: webhook.url,
          data: payload,
          headers,
          timeout: 15000,
          validateStatus: () => true // Don't throw on 4xx/5xx
        });
      } catch (err: any) {
        if (err.code === 'ECONNABORTED') {
          diagnosticMessage = "O endpoint não respondeu dentro de 15 segundos.";
        } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
          diagnosticMessage = "Não foi possível conectar ao endpoint informado.";
        } else {
          diagnosticMessage = err.message || "Erro de conexão desconhecido.";
        }
        errorData = err.message;
      }

      if (response) {
        if (response.status === 401 || response.status === 403) {
          diagnosticMessage = "O endpoint recusou a autenticação. Revise token, headers e permissões.";
        } else if (response.status === 404) {
          diagnosticMessage = "Endpoint não encontrado. Revise a URL configurada.";
        } else if (response.status === 405) {
          diagnosticMessage = "Método HTTP não permitido pelo endpoint. Revise se deve ser POST, PUT ou PATCH.";
        } else if (response.status >= 300) {
          diagnosticMessage = `O servidor retornou erro ${response.status}.`;
        }
      }

      const duration = Date.now() - startTime;
      const success = response ? (response.status >= 200 && response.status < 300) : false;
      
      // Astroflow Diagnostics
      let astroflowErrorSuggestion = "";
      if (response?.data) {
        const bodyStr = typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data);
        if (bodyStr.includes("messages[") && bodyStr.includes(".content is not allowed to be empty")) {
          astroflowErrorSuggestion = "Foi detectado que o workflow recebeu uma ou mais mensagens vazias no array `messages`. Isso geralmente ocorre porque o campo enviado para a IA está lendo uma variável vazia ou inexistente no payload enviado.";
        }
      }

      const result = {
        status_code: response?.status || 0,
        response_body: response?.data ? response.data : (errorData || "Sem resposta"),
        response_headers: response?.headers || {},
        duration_ms: duration,
        success,
        trace_id: traceId,
        message: diagnosticMessage || (success ? "Sucesso" : "Falha na conexão"),
        diagnosis: astroflowErrorSuggestion || null,
        request_info: {
          url: webhook.url,
          method: webhook.method || 'POST',
          headers: maskSensitiveHeaders(headers),
          payload: payload
        }
      };

      // Always log attempt
      const logData = {
        webhook_id: webhook.id || "unsaved_test",
        event_type: "manual_test",
        request_url: webhook.url,
        request_method: webhook.method || "POST",
        request_headers_masked: maskSensitiveHeaders(headers),
        request_payload: payload,
        response_status_code: result.status_code,
        response_body: typeof result.response_body === 'object' ? JSON.stringify(result.response_body) : String(result.response_body),
        response_headers: result.response_headers,
        response_time_ms: result.duration_ms,
        status: result.success ? "success" : "error",
        error_message: result.message,
        diagnosis: result.diagnosis,
        trace_id: result.trace_id,
        created_at: adminFieldValue.serverTimestamp()
      };

      await adminDb.collection("webhook_logs").add(logData).catch(e => console.error("Log failed:", e));

      // Update Webhook if ID exists
      if (webhook.id) {
         await adminDb.collection("webhooks").doc(webhook.id).update({
           last_test_status: result.success ? "success" : "error",
           last_tested_at: adminFieldValue.serverTimestamp(),
           last_status_code: result.status_code
         }).catch(e => console.error("Update failed:", e));
      }

      res.json(result);
    } catch (error: any) {
      console.error("Critical Test Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Webhook Logs
  app.get("/api/admin/webhooks/logs", async (req, res) => {
    try {
      const { adminDb } = await import("./src/server/firebaseAdmin");
      const { webhook_id, limit = 50 } = req.query;
      
      let query = adminDb.collection("webhook_logs").orderBy("created_at", "desc").limit(Number(limit));
      
      if (webhook_id) {
        query = query.where("webhook_id", "==", webhook_id);
      }
      
      const snapshot = await query.get();
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ logs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Diagnostic Endpoint
  app.get("/api/admin/scheduler/diagnostic", async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.replace("Bearer ", "").trim();

      if (!token) {
        return res.status(401).json({
          ok: false,
          error: "unauthenticated",
          message: "Token ausente."
        });
      }

      const {
        adminAuth,
        adminDb,
        hasServiceAccount,
        firebaseAdminProjectId,
        firebaseClientProjectId,
        firebaseDatabaseId
      } = await import("./src/server/firebaseAdmin");

      const decoded = await adminAuth.verifyIdToken(token);

      const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
      const userData = userSnap.exists ? userSnap.data() : {};

      const email = decoded.email || userData?.email || null;

      const isOwner =
        userData?.system_role === "owner" ||
        userData?.role === "owner" ||
        email === "rodrigo.moura@hotmart.com" ||
        email === "celular@rodrigomoura.net";

      const isAdmin =
        isOwner ||
        userData?.system_role === "admin" ||
        userData?.role === "admin";

      const jobRef = adminDb
        .collection("scheduler_jobs")
        .doc("stage_closure_auto_summary");

      const jobSnap = await jobRef.get();
      const job = jobSnap.exists ? jobSnap.data() : null;

      return res.json({
        ok: true,
        authenticated: true,
        uid: decoded.uid,
        email,
        user_doc_exists: userSnap.exists,
        role: userData?.role || null,
        system_role: userData?.system_role || null,
        isOwner,
        isAdmin,
        firebase_admin: {
          has_service_account: hasServiceAccount,
          service_account_project_id: firebaseAdminProjectId,
          app_project_id: firebaseClientProjectId,
          database_id: firebaseDatabaseId,
          project_match: firebaseAdminProjectId === firebaseClientProjectId
        },
        job: {
          exists: jobSnap.exists,
          status: job?.status || null,
          interval_minutes: job?.interval_minutes || null,
          next_run_at_ms: job?.next_run_at_ms || null,
          server_time_ms: Date.now(),
          due_now: job?.next_run_at_ms ? Date.now() >= job.next_run_at_ms : true
        }
      });
    } catch (error: any) {
      console.error("[Scheduler Diagnostic] failed", error);

      return res.status(500).json({
        ok: false,
        error: "scheduler-diagnostic-failed",
        message: error?.message || String(error)
      });
    }
  });

  // Internal Cron Tick
  app.post("/api/internal/scheduler/tick", async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    try {
      const secret = req.headers["x-scheduler-secret"];

      if (!process.env.SCHEDULER_SECRET || secret !== process.env.SCHEDULER_SECRET) {
        return res.status(403).json({
          ok: false,
          error: "invalid-scheduler-secret"
        });
      }

      const {
        adminDb,
        adminTimestamp,
        adminFieldValue,
        assertAdminServiceAccountReady
      } = await import("./src/server/firebaseAdmin");

      assertAdminServiceAccountReady();

      const jobRef = adminDb
        .collection("scheduler_jobs")
        .doc("stage_closure_auto_summary");

      const jobSnap = await jobRef.get();
      const job = jobSnap.exists ? jobSnap.data() : null;

      if (!job || job.status !== "active") {
        return res.json({
          ok: true,
          skipped: true,
          reason: "job_not_active"
        });
      }

      const nextRunAtMs =
        job.next_run_at_ms ||
        job.next_run_at?.toMillis?.() ||
        0;

      if (nextRunAtMs && Date.now() < nextRunAtMs) {
        return res.json({
          ok: true,
          skipped: true,
          reason: "not_due_yet",
          next_run_at_ms: nextRunAtMs,
          server_time_ms: Date.now()
        });
      }

      const { runStageClosureSummaryJobServer } = await import(
        "./src/server/jobs/stageClosureSummaryJob.server"
      );

      const result = await runStageClosureSummaryJobServer({
        trigger: "cloud_scheduler",
        triggered_by_uid: "system",
        triggered_by_email: "system"
      });

      const intervalMinutes = Number(job.interval_minutes || job.fixed_interval || 30);
      const nextMs = Date.now() + intervalMinutes * 60 * 1000;

      const updateData: any = {
        last_run_at: adminFieldValue.serverTimestamp(),
        last_run_at_ms: Date.now(),
        next_run_at: adminTimestamp.fromMillis(nextMs),
        next_run_at_ms: nextMs,
        last_status: result.status || "success",
        updated_at: adminFieldValue.serverTimestamp(),
        updated_at_ms: Date.now()
      };

      // Lightweight migration if needed
      if (!job.interval_minutes && job.fixed_interval) {
        updateData.interval_minutes = Number(job.fixed_interval);
        updateData.recurrence_type = "fixed_interval";
      }

      await jobRef.set(updateData, { merge: true });

      return res.json({
        ok: true,
        ...result
      });
    } catch (error: any) {
      console.error("[Scheduler Tick] failed", error);

      return res.status(500).json({
        ok: false,
        error: "scheduler-tick-failed",
        message: error?.message || String(error)
      });
    }
  });

  app.post("/api/admin/scheduler/update-job-frequency", async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    try {
      const {
        adminAuth,
        adminDb,
        adminTimestamp,
        adminFieldValue,
        assertAdminServiceAccountReady
      } = await import("./src/server/firebaseAdmin");

      assertAdminServiceAccountReady();

      if (!adminAuth || !adminDb) {
        return res.status(500).json({
          ok: false,
          error: "firebase-admin-not-ready",
          message: "Firebase Admin não está pronto."
        });
      }

      const authHeader = req.headers.authorization || "";
      const token = authHeader.replace("Bearer ", "").trim();

      if (!token) {
        return res.status(401).json({
          ok: false,
          error: "unauthenticated",
          message: "Token ausente."
        });
      }

      const decoded = await adminAuth.verifyIdToken(token);

      const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
      const userData = userSnap.exists ? userSnap.data() : {};
      const email = decoded.email || userData?.email || null;

      const isOwner =
        userData?.system_role === "owner" ||
        userData?.role === "owner" ||
        email === "rodrigo.moura@hotmart.com" ||
        email === "celular@rodrigomoura.net";

      if (!isOwner) {
        return res.status(403).json({
          ok: false,
          error: "permission-denied",
          message: "Apenas OWNER pode alterar frequência de jobs de sistema."
        });
      }

      const jobId = req.body?.job_id || "stage_closure_auto_summary";
      const recurrenceType = req.body?.recurrence_type || "fixed_interval";
      const intervalMinutes = Number(req.body?.interval_minutes);

      if (recurrenceType !== "fixed_interval") {
        return res.status(400).json({
          ok: false,
          error: "invalid-recurrence-type",
          message: "Este endpoint suporta apenas recurrence_type=fixed_interval."
        });
      }

      if (!Number.isFinite(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) {
        return res.status(400).json({
          ok: false,
          error: "invalid-interval-minutes",
          message: "interval_minutes precisa ser um número entre 1 e 1440."
        });
      }

      const nowMs = Date.now();
      const nextMs = nowMs + intervalMinutes * 60 * 1000;

      const jobRef = adminDb.collection("scheduler_jobs").doc(jobId);

      await jobRef.set(
        {
          recurrence_type: "fixed_interval",
          interval_minutes: intervalMinutes,

          // Recalcular imediatamente para a nova frequência valer de verdade
          next_run_at: adminTimestamp.fromMillis(nextMs),
          next_run_at_ms: nextMs,

          updated_at: adminFieldValue.serverTimestamp(),
          updated_at_ms: nowMs,
          updated_by: decoded.uid,
          updated_by_email: email
        },
        { merge: true }
      );

      await adminDb.collection("scheduler_audit_logs").add({
        type: "scheduler_job_frequency_updated",
        job_id: jobId,
        recurrence_type: "fixed_interval",
        interval_minutes: intervalMinutes,
        next_run_at_ms: nextMs,
        actor_uid: decoded.uid,
        actor_email: email,
        created_at: adminFieldValue.serverTimestamp(),
        created_at_ms: nowMs
      });

      return res.json({
        ok: true,
        job_id: jobId,
        recurrence_type: "fixed_interval",
        interval_minutes: intervalMinutes,
        next_run_at_ms: nextMs
      });
    } catch (error: any) {
      console.error("[Scheduler API] update-job-frequency failed", error);

      return res.status(500).json({
        ok: false,
        error: "scheduler-frequency-update-failed",
        message: error?.message || String(error)
      });
    }
  });

  // Handle remaining /api/* as 404
  app.all("/api/*", (req, res) => {
    res.status(404).json({
      ok: false,
      error: "api-route-not-found",
      message: `Rota API não encontrada: ${req.method} ${req.originalUrl}`
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on("error", (error: any) => {
    console.error("[Server] Failed to start:", error);
    process.exit(1);
  });
}

startServer();
