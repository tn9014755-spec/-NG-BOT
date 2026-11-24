// Nhận ảnh tổng hợp Flash Sale (sữa / bia / nước giải khát) và đẩy vào nhóm LINE.
// POST /api/flash-sale  header x-push-key: <FLASH_PUSH_KEY>
// body JSON: { image: "<base64 PNG/JPEG>", text?: "lời nhắn kèm", to?: "groupId" }
// Mặc định gửi vào các nhóm đang nhận nhắc MT (hoặc FLASH_SALE_TO nếu có).
const express = require("express"), crypto = require("crypto"), fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "data", "flash_sale");
fs.mkdirSync(DIR, { recursive: true });

function keyOk(given) {
  const want = process.env.FLASH_PUSH_KEY || "";
  if (!want || !given) return false;
  const a = Buffer.from(String(given)), b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function cors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, x-push-key");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}
function cleanup() {
  try {
    const f = fs.readdirSync(DIR).map(n => ({ n, t: fs.statSync(path.join(DIR, n)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const x of f.slice(30)) fs.unlinkSync(path.join(DIR, x.n));
  } catch (e) { console.warn("FLASH SALE cleanup", e.message); }
}

module.exports = function register(app, { push, targets }) {
  app.get("/flash-sale/client.js", (_, res) => {
    cors(res); res.set("Cache-Control", "no-store");
    res.type("application/javascript").send(fs.readFileSync(path.join(__dirname, "flash_sale_client.js"), "utf8"));
  });
  app.get("/bc-pos/client.js", (_, res) => {
    cors(res); res.set("Cache-Control", "no-store");
    res.type("application/javascript").send(fs.readFileSync(path.join(__dirname, "pos_client.js"), "utf8"));
  });
  app.get("/flash-sale/:name", (req, res) => {
    const name = path.basename(req.params.name);
    if (!/^[\w-]+\.(png|jpg)$/.test(name)) return res.status(404).end();
    const file = path.join(DIR, name);
    if (!fs.existsSync(file)) return res.status(404).end();
    res.type(name.endsWith(".png") ? "png" : "jpg").send(fs.readFileSync(file));
  });
  app.options("/api/flash-sale", (_, res) => { cors(res); res.status(204).end(); });
  app.post("/api/flash-sale", express.json({ limit: "12mb" }), async (req, res) => {
    cors(res);
    if (!keyOk(req.get("x-push-key"))) return res.status(401).json({ ok: false, error: "sai khoá" });
    try {
      const raw = String(req.body?.image || "").replace(/^data:image\/\w+;base64,/, "");
      const env0 = String(process.env.FLASH_SALE_TO || "").split(/[;,\s]+/).filter(Boolean);
      if (!raw && req.body?.text) {
        const to0 = req.body?.to ? [String(req.body.to)] : (env0.length ? env0 : targets());
        if (!to0.length) return res.status(400).json({ ok: false, error: "chưa có nhóm nhận" });
        const rs = []; for (const t of to0) rs.push(await push(t, [{ type: "text", text: String(req.body.text).slice(0, 4900) }]));
        return res.json({ ok: rs.every(Boolean), sent: rs.filter(Boolean).length, groups: to0.length });
      }
      const buf = Buffer.from(raw, "base64");
      const isPng = buf.slice(0, 4).toString("hex") === "89504e47", isJpg = buf.slice(0, 2).toString("hex") === "ffd8";
      if (!isPng && !isJpg) return res.status(400).json({ ok: false, error: "ảnh phải là PNG hoặc JPEG" });
      if (buf.length > 10 * 1024 * 1024) return res.status(400).json({ ok: false, error: "ảnh quá 10MB" });
      const name = `fs-${Date.now()}.${isPng ? "png" : "jpg"}`;
      fs.writeFileSync(path.join(DIR, name), buf); cleanup();
      const base = String(process.env.PUBLIC_BASE_URL || `https://${req.get("host")}`).replace(/\/$/, "");
      const url = `${base}/flash-sale/${name}`;
      const msgs = [];
      if (req.body?.text) msgs.push({ type: "text", text: String(req.body.text).slice(0, 4900) });
      msgs.push({ type: "image", originalContentUrl: url, previewImageUrl: url });
      const env = String(process.env.FLASH_SALE_TO || "").split(/[;,\s]+/).filter(Boolean);
      const to = req.body?.to ? [String(req.body.to)] : (env.length ? env : targets());
      if (!to.length) return res.status(400).json({ ok: false, error: "chưa có nhóm nhận" });
      const results = [];
      for (const t of to) results.push(await push(t, msgs));
      console.log("🛒 FLASH SALE → gửi", to.length, "nhóm", results);
      res.json({ ok: results.every(Boolean), sent: results.filter(Boolean).length, groups: to.length, url });
    } catch (e) {
      console.error("FLASH SALE PUSH", e);
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });
  console.log("🛒 FLASH SALE PUSH: /api/flash-sale", process.env.FLASH_PUSH_KEY ? "(key OK)" : "(THIẾU FLASH_PUSH_KEY)");
};
