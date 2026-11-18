// BC SỨC KHỎE SIÊU THỊ 28717 — so sánh T10 (đã khóa) và T11 (cập nhật theo file NẠP DỮ LIỆU)
// T10: data/health_t10_locked.json (cố định, không ghi đè)
// T11: đọc từ 2 file bot đang giữ sau lệnh NẠP DỮ LIỆU (data/bc_report/latest_store.xlsx + latest_industry.xlsx)
const fs = require("fs"), path = require("path"), XLSX = require("xlsx");

const DIR = path.join(__dirname, "data");
const LOCKED = path.join(DIR, "health_t10_locked.json");
const STORE = path.join(DIR, "bc_report", "latest_store.xlsx");
const INDUSTRY = path.join(DIR, "bc_report", "latest_industry.xlsx");
const TEMPLATE = path.join(__dirname, "health_v2.html");
const CUR_MONTH = 11, CUR_YEAR = 2026, CUR_DAYS = 30;

// Nhóm theo mã "Ngành hàng BHX": ĐÔNG MÁT = 12 đông lạnh-hàng mát, 13 sữa bảo quản mát, 14 kem
// FRESH = 8 rau củ, 11 thịt, 17 cá-hải sản, 18 trái cây, 19 trứng. Còn lại FMCG.
const MAT = new Set([12, 13, 14]), FRESH = new Set([8, 11, 17, 18, 19]);
function group(name) {
  const m = String(name || "").match(/^\s*(\d+)/), c = m ? +m[1] : -1;
  return MAT.has(c) ? "mat" : FRESH.has(c) ? "fresh" : "fmcg";
}

function num(v) { if (typeof v === "number") return isFinite(v) ? v : 0; const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return isFinite(n) ? n : 0; }
function ymd(v) {
  if (typeof v === "number") { const x = XLSX.SSF.parse_date_code(v); return x ? { y: x.y, m: x.m, d: x.d } : null; }
  if (v instanceof Date && !isNaN(v)) return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() };
  const s = String(v ?? "").trim();
  let a = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (a) return { y: +a[1], m: +a[2], d: +a[3] };
  a = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (a) return { y: +a[3], m: +a[2], d: +a[1] };
  return null;
}
function rows(file) {
  const wb = XLSX.readFile(file, { cellDates: false }), out = [];
  for (const sn of wb.SheetNames) out.push(...XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: null, raw: true }));
  return out;
}
function col(r0, names) {
  const ks = Object.keys(r0 || {});
  for (const n of names) { const k = ks.find(x => String(x).trim().toLowerCase() === n.toLowerCase()); if (k) return k; }
  return null;
}

// Đọc T11 từ file đang giữ. Lỗi/thiếu file → trả về rỗng để trang vẫn hiển thị T10.
function readCurrent() {
  const res = { daily: [], catDaily: {}, note: "" };
  try {
    if (!fs.existsSync(STORE) || !fs.existsSync(INDUSTRY)) { res.note = "Chưa có dữ liệu T11 — gửi 2 file và gõ NẠP DỮ LIỆU"; return res; }
    const sr = rows(STORE), r0 = sr.find(x => x && Object.keys(x).length) || {};
    const kd = col(r0, ["Ngày"]), ko = col(r0, ["Doanh thu offline"]), kn = col(r0, ["Doanh thu Online"]), kb = col(r0, ["Tổng số bill"]), ks = col(r0, ["Mã siêu thị"]);
    const byDay = new Map();
    for (const r of sr) {
      const d = ymd(r[kd]); if (!d || d.y !== CUR_YEAR || d.m !== CUR_MONTH) continue;
      if (ks && String(r[ks]).indexOf("28717") < 0) continue;
      const x = byDay.get(d.d) || { day: d.d, offline: 0, online: 0, bills: 0 };
      x.offline += num(r[ko]); x.online += num(r[kn]); x.bills += num(r[kb]); byDay.set(d.d, x);
    }
    res.daily = [...byDay.values()].sort((a, b) => a.day - b.day);
    const ir = rows(INDUSTRY), i0 = ir.find(x => x && Object.keys(x).length) || {};
    const kid = col(i0, ["Ngày xuất", "Ngày"]), kin = col(i0, ["Ngành hàng BHX"]), kir = col(i0, ["Doanh thu"]);
    for (const r of ir) {
      const d = ymd(r[kid]); if (!d || d.y !== CUR_YEAR || d.m !== CUR_MONTH) continue;
      const n = String(r[kin] || "").trim(); if (!n) continue;
      (res.catDaily[n] = res.catDaily[n] || Array(CUR_DAYS).fill(0))[d.d - 1] += num(r[kir]);
    }
    if (!res.daily.length) res.note = "File đang giữ chưa có ngày nào của T11";
    // Hai file lệch ngày → cắt theo ngày cuối của file doanh thu siêu thị để mọi số so cùng kỳ khớp nhau
    const last = res.daily.length ? res.daily[res.daily.length - 1].day : 0;
    let catLast = 0;
    for (const n in res.catDaily) res.catDaily[n].forEach((v, i) => { if (v) catLast = Math.max(catLast, i + 1); });
    if (catLast !== last && last) {
      for (const n in res.catDaily) res.catDaily[n] = res.catDaily[n].map((v, i) => i < last ? v : 0);
      res.note = `File ngành hàng tới ${catLast}/11, file doanh thu siêu thị tới ${last}/11 — đang tính chung tới ${last}/11`;
    }
  } catch (e) { console.error("❌ BC SỨC KHỎE đọc T11", e); res.note = "Lỗi đọc file T11: " + String(e.message || e).slice(0, 120); }
  return res;
}

function sumDays(daily, upto) {
  const t = { offline: 0, online: 0, bills: 0, days: 0 };
  for (const x of daily) if (x.day <= upto) { t.offline += x.offline; t.online += x.online; t.bills += x.bills; t.days++; }
  t.dt = t.offline + t.online; t.billValue = t.bills ? t.dt / t.bills : 0; return t;
}

function buildData() {
  const t10 = JSON.parse(fs.readFileSync(LOCKED, "utf8")), cur = readCurrent();
  const lastDay = cur.daily.length ? cur.daily[cur.daily.length - 1].day : 0;
  const t10Full = sumDays(t10.daily, 31), t10Same = sumDays(t10.daily, lastDay), t11 = sumDays(cur.daily, lastDay);
  const forecast = lastDay ? t11.dt / lastDay * CUR_DAYS : 0;
  const names = new Set([...Object.keys(t10.catDaily), ...Object.keys(cur.catDaily)]);
  const cats = [...names].map(name => {
    const a = t10.catDaily[name] || [], b = cur.catDaily[name] || [];
    const full = a.reduce((s, v) => s + v, 0), same = a.slice(0, lastDay).reduce((s, v) => s + v, 0), now = b.reduce((s, v) => s + v, 0);
    return { name, group: group(name), t10Full: full, t10Same: same, t11: now };
  }).filter(c => c.t10Full || c.t11);
  const dailyT10 = t10.daily.map(x => ({ day: x.day, dt: x.offline + x.online, bills: x.bills }));
  const dailyT11 = cur.daily.map(x => ({ day: x.day, dt: x.offline + x.online, bills: x.bills }));
  return { store: "28717 - Mỹ Quới", lastDay, curDays: CUR_DAYS, note: cur.note, t10Full, t10Same, t11, forecast, cats, dailyT10, dailyT11, builtAt: new Date().toISOString() };
}

function page() {
  const html = fs.readFileSync(TEMPLATE, "utf8");
  return html.replace("/*__DATA__*/null", JSON.stringify(buildData()).replace(/</g, "\\u003c"));
}

function mount(app) {
  app.get("/suc-khoe", (_, res) => { try { res.set("Cache-Control", "no-store").type("html").send(page()); } catch (e) { console.error("❌ /suc-khoe", e); res.status(500).send("BC SỨC KHỎE lỗi: " + e.message); } });
  app.get("/suc-khoe.json", (_, res) => { try { res.set("Cache-Control", "no-store").json(buildData()); } catch (e) { res.status(500).json({ error: e.message }); } });
}

module.exports = { mount, buildData, page };
