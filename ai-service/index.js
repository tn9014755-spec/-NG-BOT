const express = require("express");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 10000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "openai-ai-service" });
});

app.post("/chat", async (req, res) => {
  try {
    if (!AI_SERVICE_TOKEN || req.get("authorization") !== `Bearer ${AI_SERVICE_TOKEN}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: "OPENAI_API_KEY is not configured" });
    }

    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const context = typeof req.body?.context === "string" ? req.body.context.trim() : "";
    if (!message) return res.status(400).json({ error: "message is required" });

    const messages = [
      {
        role: "system",
        content: typeof req.body?.system === "string" && req.body.system.trim() ? req.body.system.trim().slice(0, 12000) : "Bạn là trợ lý tiếng Việt cho bot LINE của cửa hàng. Trả lời rõ ràng, ngắn gọn, không tự bịa số liệu."
      },
      ...(context ? [{ role: "system", content: "Ngữ cảnh dữ liệu do hệ thống cung cấp:\n" + context.slice(0, 20000) }] : []),
      { role: "user", content: message.slice(0, 12000) }
    ];

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: Math.max(256, Math.min(Number(req.body?.maxTokens || 4096), 8192))
      }),
      signal: AbortSignal.timeout(45000)
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("OpenAI API error", upstream.status, data?.error?.message || "unknown");
      return res.status(502).json({ error: "upstream AI request failed" });
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({ error: "empty AI response" });
    }
    return res.json({ reply: reply.trim() });
  } catch (err) {
    console.error("AI service request failed:", err?.message || err);
    return res.status(500).json({ error: "internal service error" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`OpenAI AI service listening on port ${PORT}`);
});
