import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { getGeminiClient, checkGeminiHealth, assertGeminiConfigured, testGeminiConnection } from "./src/server/geminiClient";

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // Integrations Health Check
  app.get("/api/integrations/gemini/health", async (req, res) => {
    try {
      const health = await checkGeminiHealth();
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ status: "error", message: error.message });
    }
  });

  // Test Connection Endpoint
  app.post("/api/integrations/gemini/test", async (req, res) => {
    try {
      const { apiKey } = req.body;
      const result = await testGeminiConnection(apiKey);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // LLM Health Check (Legacy or internal shorthand)
  app.get("/api/admin/llm/health", async (req, res) => {
    try {
      const health = await checkGeminiHealth();
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ status: "error", message: error.message });
    }
  });

  // Gemini Proxy Agent (Specific to Mindflow)
  app.post("/api/mindflow/chat", async (req, res) => {
    try {
      const defaultModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const { prompt, model = defaultModel, config = {} } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const ai = getGeminiClient();
      const generativeModel = ai.getGenerativeModel({ model });
      
      const result = await generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: config
      });
      
      const response = await result.response;
      res.json({ text: response.text() });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
