// Nhắc QL Đăng "BC CHECKING" trong nhóm LINE theo lịch ca của anh.
// Giờ nhắc = giờ BẮT ĐẦU mỗi đoạn làm trong ngày:
//   ca 1 → 6h, ca 3 → 12h, ca 4 → 14h, ca 5 → 16h (chỉ khi ca liền trước KHÔNG có).
//   VD ca "12356": nhắc 6h (bắt đầu 123) và 16h (bắt đầu 56).
// Lịch ca lấy từ: (1) data/checkin_dang.json (đã đối chiếu bhxwork);
//                 (2) ngày chưa có trong file → Google Sheet lịch QL khu vực (dòng mã siêu thị 28717).
// Người được tag: CHECKIN_USER_ID (env) hoặc người đã nhắn "BẬT NHẮC CHECKING" cho bot.
// Nhóm nhận: CHECKIN_GROUP_ID (env) / nhóm đã bật / các nhóm nhắc MT.
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const BASE = path.join(__dirname, "data", "checkin_dang.json");
const STATE = path.join(process.env.BC_DATA_DIR || "/tmp/bc", "checkin_state.json");
const SHEET_ID = process.env.CHECKIN_SHEET_ID || "1QglkclrZzMsboUi-SA9lu_EvoF_8GDbWiMq4XfmvEjg";
const STORE = process.env.CHECKIN_STORE || "28717";
const NAME = process.env.CHECKIN_NAME || "Anh Đăng";
const HOURS = { 6: 1, 12: 3, 14: 4, 16: 5 }; // giờ nhắc → ca bắt đầu

function loadJson(f, d) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } }
function saveState(s) { try { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); } catch (e) { console.warn("⚠️ CHECKING → không lưu được:", e.message); } }
const state = () => loadJson(STATE, { sent: {} });

function vnNow() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const o = Object.fromEntries(p.map(x => [x.type, x.value]));
  return { day: `${o.year}-${o.month}-${o.day}`, year: +o.year, month: +o.month, hour: +o.hour, minute: +o.minute };
}

// ---- đọc Google Sheet (CSV) ----
function parseCsv(t) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function sheetToSchedule(rows, now) {
  const hi = rows.findIndex(r => r.some(c => /TÊN\s*QUẢN\s*LÝ/i.test(c)));
  if (hi < 0) return {};
  const head = rows[hi], row = rows.find(r => r.some(c => String(c).trim() === STORE));
  if (!row) return {};
  const out = {};
  head.forEach((h, i) => {
    const m = String(h).trim().match(/^(\d{1,2})\.(\d{1,2})$/);
    if (!m) return;
    const d = +m[1], mo = +m[2];
    let y = now.year; if (mo < now.month - 6) y++; else if (mo > now.month + 6) y--;
    const key = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const v = String(row[i] || "").trim().toUpperCase();
    if (out[key]) return; // lấy cột đầu tiên của ngày
    if (/^[1-6]+$/.test(v)) out[key] = v;
    else if (/OFF/.test(v)) out[key] = "OFF";
  });
  return out;
}
let cache = { at: 0, data: {}, src: "" };
async function sheetSchedule(now) {
  if (Date.now() - cache.at < 30 * 60e3) return cache;
  const names = String(process.env.CHECKIN_SHEET_NAMES || "Trang tính15,THÁNG 12").split(",").map(s => s.trim()).filter(Boolean);
  const data = {}; let src = "";
  for (const n of names) {
    try {
      const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(n)}`, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      const s = sheetToSchedule(parseCsv(await r.text()), now);
      for (const [k, v] of Object.entries(s)) if (!data[k]) data[k] = v;
      if (Object.keys(s).length) src += (src ? "+" : "") + n;
    } catch (e) { console.warn("⚠️ CHECKING → không đọc được sheet", n, e.message); }
  }
  cache = { at: Date.now(), data, src };
  return cache;
}

async function codesFor(day, now) {
  const base = loadJson(BASE, {}); // lịch đã đối chiếu bhxwork → ưu tiên
  if (base[day]) return { codes: base[day], src: "repo" };
  const sh = await sheetSchedule(now);
  if (sh.data[day]) return { codes: sh.data[day], src: "sheet:" + sh.src };
  return { codes: "", src: "none" };
}
function startCas(codes) { // các ca bắt đầu một đoạn làm
  if (!/^[1-6]+$/.test(codes)) return [];
  const set = new Set(codes.split("").map(Number));
  return [1, 3, 4, 5].filter(c => set.has(c) && !set.has(c - 1));
}
const hourOf = { 1: 6, 3: 12, 4: 14, 5: 16 };

function userId() { return String(process.env.CHECKIN_USER_ID || state().userId || "").trim(); }
function groups(mtTargets) {
  const env = String(process.env.CHECKIN_GROUP_ID || "").split(/[;,\s]+/).filter(Boolean);
  if (env.length) return env;
  const s = state(); if (s.groupId) return [s.groupId];
  return mtTargets();
}
function message(ca, hour, codes) {
  const body = `⏰ ${hour}H – BC CHECKING (ca ${ca})\n${NAME} check-in và báo cáo checking nhé!\n📋 Ca hôm nay: ${codes}`;
  const uid = userId();
  if (!uid) return { type: "text", text: `@${NAME} ` + body };
  const tag = "@" + NAME;
  return { type: "text", text: `${tag} ${body}`, mention: { mentionees: [{ index: 0, length: tag.length, userId: uid }] } };
}

async function tick(push, mtTargets) {
  const now = vnNow();
  const ca = HOURS[now.hour];
  if (!ca || now.minute >= 10) return;
  const { codes, src } = await codesFor(now.day, now);
  if (!startCas(codes).includes(ca)) return;
  const s = state(); s.sent = s.sent || {};
  for (const g of groups(mtTargets)) {
    const key = `${now.day}|${now.hour}|${g}`;
    if (s.sent[key]) continue;
    s.sent[key] = Date.now(); saveState(s);
    let ok = await push(g, [message(ca, now.hour, codes)]);
    if (!ok) ok = await push(g, [{ type: "text", text: message(ca, now.hour, codes).text }]);
    console.log(`⏰ CHECKING → ${now.day} ${now.hour}h ca ${ca} (${codes}, ${src}) → ${g}: ${ok ? "OK" : "LỖI"}`);
  }
  for (const k of Object.keys(s.sent)) if (!k.startsWith(now.day)) delete s.sent[k];
  saveState(s);
}

function enable(uid, groupId) { const s = state(); s.userId = uid || s.userId; s.groupId = groupId || s.groupId; saveState(s); console.log("⏰ CHECKING → BẬT, user", uid, "nhóm", groupId); }

async function preview(days = 7) {
  const now = vnNow(), out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(now.year, now.month - 1, +now.day.slice(8) + i));
    const key = d.toISOString().slice(0, 10);
    const { codes, src } = await codesFor(key, now);
    out.push({ day: key, codes, src, nhac: startCas(codes).map(c => hourOf[c] + "h") });
  }
  return out;
}

function register(app, { push, mtTargets, keyOk }) {
  app.get("/api/checkin-preview", async (req, res) => {
    try {
      const uid = userId();
      res.json({ ok: true, store: STORE, coUserId: !!uid, userFp: uid ? crypto.createHash("sha256").update(uid).digest("hex").slice(0, 6) : null, nhom: groups(mtTargets).length, lich: await preview(+req.query.days || 7) });
    } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
  // trả userId đã lưu (cần khoá) để ghi cố định vào env CHECKIN_USER_ID
  app.get("/api/checkin-user", (req, res) => {
    res.set("Access-Control-Allow-Origin", "*"); res.set("Access-Control-Allow-Headers", "x-push-key");
    if (!keyOk(req.get("x-push-key"))) return res.status(401).json({ ok: false });
    const s = state(); res.json({ ok: true, userId: s.userId || null, groupId: s.groupId || null, env: !!process.env.CHECKIN_USER_ID });
  });
  app.options("/api/checkin-user", (_, res) => { res.set("Access-Control-Allow-Origin", "*"); res.set("Access-Control-Allow-Headers", "x-push-key"); res.status(204).end(); });
}

function start(push, mtTargets) {
  console.log("⏰ CHECKING → bật, tag", userId() ? "có userId" : "(chưa có userId)", "| nhóm:", groups(mtTargets).join(", ") || "(chưa có)");
  setInterval(() => tick(push, mtTargets).catch(e => console.error("❌ CHECKING", e)), 60000);
  tick(push, mtTargets).catch(e => console.error("❌ CHECKING", e));
}

module.exports = { start, enable, register, preview, startCas, sheetToSchedule, parseCsv };
