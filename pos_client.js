// BC doanh thu theo khung giờ từ POS (pos.bachhoaxanh.com), chạy trong trình duyệt đã đăng nhập POS.
// const m = await import('https://ng-bot-c0im.onrender.com/bc-pos/client.js?v=' + Date.now());
//   trên trang /reports/home/dashboard/145 : await m.collect()   (DT theo siêu thị)
//   trên trang /reports/home/dashboard/336 : await m.collect()   (DT theo ngành hàng)
//   rồi (trang POS bất kỳ):                 await m.send({ key, slot: 12, dryRun })
const BOT = "https://ng-bot-c0im.onrender.com", STORE = "28717", LS = "bcpos_today", PREV = "bcpos_prev", HIST = "bcpos_hist";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const n = s => +String(s ?? "").replace(/,/g, "") || 0;
const fmt = v => Math.round(v).toLocaleString("vi-VN").replace(/,/g, ".");
const today = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
const nowHM = () => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(new Date());
const load = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const clean = s => String(s || "").replace(/^\d+\s*-\s*/, "").trim();

async function waitFor(fn, ms = 20000) { const t = Date.now(); while (Date.now() - t < ms) { const v = fn(); if (v) return v; await sleep(400); } return null; }

async function runReport() {
  const user = await waitFor(() => /\d{5,} - /.test(document.body.innerText) && document.querySelector(".k-grid"));
  if (!user) throw Error("POS chưa đăng nhập hoặc trang báo cáo chưa tải được");
  const sel = [...document.querySelectorAll("input")].find(i => /Siêu thị được chọn/.test(i.value || i.placeholder || "")) ||
    [...document.querySelectorAll("*")].find(e => e.children.length === 0 && /Siêu thị được chọn/.test(e.innerText || ""));
  if (!sel) throw Error("Không thấy ô chọn siêu thị");
  sel.click(); await sleep(1500);
  const tree = await waitFor(() => window.$ && $(".jstree").length && $(".jstree").first());
  if (!tree) throw Error("Không mở được danh sách siêu thị");
  let node = null;
  for (let i = 0; i < 4 && !node; i++) {
    tree.jstree("open_all"); await sleep(2000);
    node = [...document.querySelectorAll(".jstree-anchor")].find(a => a.innerText.includes(STORE + " -"));
  }
  if (!node) throw Error("Không tìm thấy siêu thị " + STORE);
  tree.jstree("deselect_all"); tree.jstree("select_node", node.closest("li").id); await sleep(500);
  const done = [...document.querySelectorAll("button")].find(b => b.innerText.trim() === "Xong");
  done && done.click(); await sleep(800);
  const picked = [...document.querySelectorAll("input")].some(i => /^1 Siêu thị được chọn/.test(i.value || ""));
  if (!picked) throw Error("Chưa chọn được đúng 1 siêu thị");
  const grid = $(".k-grid").first().data("kendoGrid");
  grid.dataSource.data([]);
  [...document.querySelectorAll("button,a")].find(b => b.innerText.trim() === "Xem báo cáo").click();
  const ok = await waitFor(() => grid.dataSource.total() > 0, 45000);
  if (!ok) throw Error("POS không trả dữ liệu (có thể chưa có bán hàng hoặc hết phiên đăng nhập)");
  grid.dataSource.pageSize(5000); await sleep(2500);
  return grid.dataSource.data().toJSON();
}

export async function collect() {
  const id = (location.pathname.match(/dashboard\/(\d+)/) || [])[1];
  if (id !== "145" && id !== "336") throw Error("Mở trang POS dashboard 145 hoặc 336 trước");
  const rows = await runReport(), st = load(LS);
  const data = st && st.date === today() ? st : { date: today() };
  if (id === "145") {
    const r = rows.find(x => String(x.storeid) === STORE) || rows[0];
    data.store = { name: r.storename, offline: n(r.revenueoffline), offlineVat: n(r.revenueofflinevat), online: n(r.revenueonline), onlineVat: n(r.revenueonlinevat), bills: n(r.totalvoucher), at: nowHM(), reportDate: r.datekey };
  } else {
    const g = {}, sub = {}, mine = rows.filter(r => String(r.storeid).startsWith(STORE));
    // DT chưa VAT theo ngành: dùng cột chưa VAT nếu báo cáo có (và hợp lý so với cột có VAT), không thì quy đổi theo tỉ lệ ở send().
    const sumK = k => mine.reduce((a, r) => a + n(r[k]), 0), sv = sumK("revenuevat");
    const preKey = ["revenue", "revenuenovat", "revenuewithoutvat", "revenuebeforevat"].find(k => mine.length && k in mine[0] && sumK(k) > sv * 0.85 && sumK(k) <= sv);
    for (const r of rows) {
      if (!String(r.storeid).startsWith(STORE)) continue;
      const k = clean(r.bhxmaingroupname), s = clean(r.subgroupname);
      const v = preKey ? n(r[preKey]) : n(r.revenuevat);
      g[k] = (g[k] || 0) + v; sub[s] = (sub[s] || 0) + v;
    }
    data.cat = { groups: g, subs: sub, total: Object.values(g).reduce((a, b) => a + b, 0), novat: !!preKey, at: nowHM(), rows: rows.length };
  }
  save(LS, data);
  return id === "145" ? data.store : { total: Math.round(data.cat.total), groups: Object.keys(data.cat.groups).length, rows: data.cat.rows };
}

// Ảnh báo cáo kiểu dashboard (nền tối, thẻ KPI, donut Offline/Online, biểu đồ cộng dồn theo khung, thanh ngành hàng).
function draw(d, prev, slot, hist = []) {
  const s = d.store, c = d.cat, total = s.offline + s.online;
  const groups = Object.entries(c.groups).sort((a, b) => b[1] - a[1]);
  const subs = Object.entries(c.subs).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const pts = hist.filter(p => p.slot < slot).concat([{ slot, total, bills: s.bills }]);
  const showTrend = pts.length >= 2;
  const P = 32, W = 1080, CW = W - 2 * P, GAP = 18, RH = 54;
  const C = { bg: "#eef3f0", card: "#ffffff", line: "#e3e9e6", text: "#0f1f17", sub: "#5b6b63", dim: "#94a39b", g: "#16a34a", g2: "#15803d", b: "#0284c7", warn: "#b45309", red: "#dc2626", track: "#edf2ef" };
  const F = "'Segoe UI', Arial, Helvetica, sans-serif";
  const hHead = 120, hHero = 230, hKpi = 132, hTrend = showTrend ? 270 : 0, hCat = 70 + groups.length * RH + 20, hTop = 70 + Math.ceil(subs.length / 2) * 64 + 10;
  const H = P + hHead + GAP + hHero + GAP + hKpi + GAP + (showTrend ? hTrend + GAP : 0) + hCat + GAP + hTop + 80;
  const SC = 2, cv = document.createElement("canvas"); cv.width = W * SC; cv.height = H * SC;
  const x = cv.getContext("2d"); x.scale(SC, SC); x.textBaseline = "alphabetic";
  const font = (w, sz) => (x.font = `${w} ${sz}px ${F}`);
  const txt = (t, X, Y, col, align = "left") => { x.fillStyle = col; x.textAlign = align; x.fillText(t, X, Y); x.textAlign = "left"; };
  const rr = (X, Y, w, h, r, col) => { x.beginPath(); x.roundRect ? x.roundRect(X, Y, w, h, r) : x.rect(X, Y, w, h); x.fillStyle = col; x.fill(); };
  const card = (X, Y, w, h) => { x.save(); x.shadowColor = "rgba(15,31,23,.08)"; x.shadowBlur = 18; x.shadowOffsetY = 4; rr(X, Y, w, h, 18, C.card); x.restore(); x.strokeStyle = C.line; x.lineWidth = 1; x.beginPath(); x.roundRect ? x.roundRect(X + .5, Y + .5, w - 1, h - 1, 18) : x.rect(X, Y, w, h); x.stroke(); };
  const fit = (t, w) => { if (x.measureText(t).width <= w) return t; while (t.length > 1 && x.measureText(t + "…").width > w) t = t.slice(0, -1); return t + "…"; };
  const short = v => v >= 1e9 ? (v / 1e9).toFixed(2).replace(".", ",") + " tỷ" : v >= 1e6 ? (v / 1e6).toFixed(1).replace(".", ",") + "tr" : fmt(v);
  const slotName = v => v === 21 ? "21h" : v + "h";
  const chip = (t, X, Y, col) => { font("bold", 17); const w = x.measureText(t).width + 24; rr(X, Y, w, 32, 16, col + "26"); txt(t, X + 12, Y + 22, col); return w; };

  // nền
  x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W - 120, 0, 10, W - 120, 0, 520); glow.addColorStop(0, "rgba(34,197,94,.18)"); glow.addColorStop(1, "rgba(34,197,94,0)");
  x.fillStyle = glow; x.fillRect(0, 0, W, 520);

  // tiêu đề
  let y = P;
  rr(P, y + 6, 64, 64, 16, C.g); font("900", 22); txt("BHX", P + 32, y + 46, "#ffffff", "center");
  font("bold", 34); txt(slot === 21 ? "DOANH THU CHỐT NGÀY" : `DOANH THU KHUNG ${slot}H`, P + 84, y + 36, C.text);
  font("normal", 20); txt(`Siêu thị 28717 Mỹ Qưới  •  Ngày ${d.date}  •  POS lúc ${s.at}`, P + 84, y + 68, C.sub);
  const live = slot === 21 ? "CHỐT NGÀY" : "LIVE"; font("bold", 17); const lw = x.measureText(live).width + 40;
  rr(W - P - lw, y + 14, lw, 34, 17, slot === 21 ? C.b + "26" : C.g + "26");
  x.beginPath(); x.arc(W - P - lw + 17, y + 31, 5, 0, 7); x.fillStyle = slot === 21 ? C.b : C.g; x.fill();
  txt(live, W - P - lw + 28, y + 37, slot === 21 ? C.b : C.g);
  y += hHead + GAP - 20;

  // hero: tổng DT + donut
  card(P, y, CW, hHero);
  font("bold", 18); txt("TỔNG DOANH THU (CHƯA VAT)", P + 28, y + 44, C.sub);
  font("900", 64); txt(fmt(total), P + 28, y + 118, C.text);
  const tw = x.measureText(fmt(total)).width; font("bold", 28); txt("đ", P + 34 + tw, y + 118, C.sub);
  let cxp = P + 28;
  if (prev) {
    const pt = prev.store.offline + prev.store.online, add = total - pt;
    cxp += chip(`▲ +${fmt(add)}đ so với ${slotName(prev.slot)}`, cxp, y + 146, add >= 0 ? C.g : C.red) + 10;
    if (pt > 0) cxp += chip(`+${((add / pt) * 100).toFixed(1)}%`, cxp, y + 146, C.b) + 10;
  } else chip("Khung đầu tiên trong ngày", cxp, y + 146, C.b);
  // donut
  const dx = W - P - 150, dy = y + hHero / 2, R = 78, off = s.offline / (total || 1);
  x.lineWidth = 24; x.lineCap = "butt";
  x.beginPath(); x.arc(dx, dy, R, -Math.PI / 2, -Math.PI / 2 + off * Math.PI * 2); x.strokeStyle = C.g; x.stroke();
  x.beginPath(); x.arc(dx, dy, R, -Math.PI / 2 + off * Math.PI * 2, Math.PI * 1.5); x.strokeStyle = C.b; x.stroke();
  font("bold", 15); txt("OFFLINE", dx, dy - 4, C.sub, "center"); font("900", 26); txt(Math.round(off * 100) + "%", dx, dy + 26, C.text, "center");
  const lx = dx - R - 230;
  [[C.g, "Offline", s.offline], [C.b, "Online", s.online]].forEach(([col, t, v], i) => {
    const ly = dy - 34 + i * 64; rr(lx, ly - 12, 12, 12, 3, col);
    font("normal", 17); txt(t, lx + 22, ly, C.sub); font("bold", 22); txt(fmt(v), lx + 22, ly + 28, C.text);
  });
  y += hHero + GAP;

  // KPI
  const per = s.bills ? total / s.bills : 0, pPer = prev && prev.store.bills ? (prev.store.offline + prev.store.online) / prev.store.bills : null;
  const top1 = groups[0];
  const kpis = [
    ["SỐ BILL", fmt(s.bills), prev ? `+${fmt(s.bills - prev.store.bills)} bill` : "", C.g],
    ["TRUNG BÌNH / BILL", fmt(per) + "đ", pPer ? `${per >= pPer ? "▲" : "▼"} ${fmt(Math.abs(per - pPer))}đ` : "", per >= (pPer ?? 0) ? C.g : C.red],
    ["NGÀNH DẪN ĐẦU", top1 ? top1[0] : "-", top1 ? `${short(top1[1])} • ${(top1[1] / (c.total || 1) * 100).toFixed(1)}%` : "", C.b],
  ];
  const kw = (CW - 2 * GAP) / 3;
  kpis.forEach(([t, v, sub, col], i) => {
    const kx = P + i * (kw + GAP); card(kx, y, kw, hKpi);
    font("bold", 16); txt(t, kx + 22, y + 36, C.sub);
    font("900", i === 2 ? 26 : 34); txt(fit(v, kw - 44), kx + 22, y + 80, C.text);
    if (sub) { font("bold", 17); txt(fit(sub, kw - 44), kx + 22, y + 112, col); }
  });
  y += hKpi + GAP;

  // biểu đồ cộng dồn theo khung
  if (showTrend) {
    card(P, y, CW, hTrend);
    font("bold", 20); txt("DOANH THU CỘNG DỒN THEO KHUNG", P + 28, y + 42, C.text);
    const gx = P + 60, gy = y + 80, gw = CW - 120, gh = hTrend - 140, mx = Math.max(...pts.map(p => p.total)) * 1.1 || 1;
    x.strokeStyle = C.line; x.lineWidth = 1;
    for (let k = 0; k <= 3; k++) { const yy = gy + gh - gh * k / 3; x.beginPath(); x.moveTo(gx, yy); x.lineTo(gx + gw, yy); x.stroke(); }
    const X = i => gx + (pts.length === 1 ? gw / 2 : gw * i / (pts.length - 1)), Y = v => gy + gh - gh * v / mx;
    const ar = x.createLinearGradient(0, gy, 0, gy + gh); ar.addColorStop(0, "rgba(22,163,74,.22)"); ar.addColorStop(1, "rgba(34,197,94,0)");
    x.beginPath(); x.moveTo(X(0), gy + gh); pts.forEach((p, i) => x.lineTo(X(i), Y(p.total))); x.lineTo(X(pts.length - 1), gy + gh); x.closePath(); x.fillStyle = ar; x.fill();
    x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(X(i), Y(p.total)) : x.moveTo(X(i), Y(p.total))); x.strokeStyle = C.g; x.lineWidth = 4; x.lineJoin = "round"; x.stroke();
    pts.forEach((p, i) => {
      const last = i === pts.length - 1;
      x.beginPath(); x.arc(X(i), Y(p.total), last ? 8 : 6, 0, 7); x.fillStyle = last ? C.g : C.card; x.fill(); x.lineWidth = 3; x.strokeStyle = C.g; x.stroke();
      font(last ? "900" : "bold", last ? 18 : 16); txt(short(p.total), X(i), Y(p.total) - 16, last ? C.text : C.sub, "center");
      font("bold", 16); txt(slotName(p.slot), X(i), gy + gh + 30, last ? C.g : C.sub, "center");
    });
    y += hTrend + GAP;
  }

  // ngành hàng
  card(P, y, CW, hCat);
  font("bold", 20); txt("DOANH THU THEO NGÀNH HÀNG", P + 28, y + 42, C.text);
  if (prev?.cat?.groups) { font("bold", 15); txt(`TĂNG THÊM TỪ ${slotName(prev.slot).toUpperCase()}`, W - P - 28, y + 42, C.dim, "right"); }
  const mxg = groups.length ? groups[0][1] : 1, nameW = 330, barX = P + 28 + nameW, barW = CW - 56 - nameW - 300;
  let gy2 = y + 70;
  groups.forEach(([k, v], i) => {
    const add = prev?.cat?.groups ? v - (prev.cat.groups[k] || 0) : null, pct = c.total ? v / c.total * 100 : 0;
    font("bold", 16); txt(String(i + 1).padStart(2, "0"), P + 28, gy2 + 32, C.dim);
    font("normal", 19); txt(fit(k, nameW - 46), P + 64, gy2 + 32, C.text);
    rr(barX, gy2 + 16, barW, 22, 11, C.track);
    const bw = Math.max(8, barW * v / mxg), bg = x.createLinearGradient(barX, 0, barX + bw, 0); bg.addColorStop(0, C.g2); bg.addColorStop(1, i < 3 ? "#22c55e" : "#4ade80");
    rr(barX, gy2 + 16, bw, 22, 11, bg);
    font("bold", 19); txt(fmt(v), barX + barW + 158, gy2 + 34, C.text, "right");
    font("normal", 16); txt(pct.toFixed(1) + "%", barX + barW + 222, gy2 + 34, C.sub, "right");
    if (add !== null) { font("bold", 17); txt(add > 0 ? "+" + short(add) : "–", W - P - 28, gy2 + 34, add > 0 ? C.g : C.dim, "right"); }
    if (i < groups.length - 1) { x.strokeStyle = C.line; x.lineWidth = 1; x.beginPath(); x.moveTo(P + 28, gy2 + RH); x.lineTo(W - P - 28, gy2 + RH); x.stroke(); }
    gy2 += RH;
  });
  y += hCat + GAP;

  // top nhóm hàng
  card(P, y, CW, hTop);
  font("bold", 20); txt("TOP NHÓM HÀNG BÁN CHẠY", P + 28, y + 42, C.text);
  const tw2 = (CW - 56 - GAP) / 2, mxs = subs.length ? subs[0][1] : 1, medal = ["#eab308", "#94a3b8", "#c2710c"];
  subs.forEach(([k, v], i) => {
    const col = i % 2, row = Math.floor(i / 2), bx = P + 28 + col * (tw2 + GAP), by = y + 66 + row * 64;
    rr(bx, by, 36, 36, 18, i < 3 ? medal[i] : C.track); font("900", 17); txt(String(i + 1), bx + 18, by + 24, i < 3 ? "#ffffff" : C.sub, "center");
    font("normal", 18); txt(fit(k, tw2 - 200), bx + 50, by + 18, C.text);
    rr(bx + 50, by + 30, tw2 - 200, 6, 3, C.track); rr(bx + 50, by + 30, Math.max(6, (tw2 - 200) * v / mxs), 6, 3, C.b);
    font("bold", 19); txt(fmt(v), bx + tw2, by + 26, C.text, "right");
  });
  y += hTop + 24;

  // chân trang
  font("normal", 15); txt("Nguồn: POS Bách Hoá Xanh – DT theo siêu thị (145) & DT theo ngành hàng (336). Doanh thu chưa VAT.", P, y + 6, C.dim);
  if (Math.abs(c.total - total) > 1000) { font("bold", 15); txt(`⚠ Tổng ngành hàng lệch DT siêu thị ${fmt(c.total - total)}đ (2 báo cáo lấy cách nhau vài phút).`, P, y + 30, C.warn); }
  return cv;
}

// Ngành hàng về chưa VAT: nếu báo cáo 336 chỉ có cột có VAT thì quy đổi theo tỉ lệ chưa VAT / có VAT của siêu thị (145).
function noVat(d) {
  if (!d.cat || d.cat.novat) return d;
  const s = d.store, k = (s.offlineVat + s.onlineVat) ? (s.offline + s.online) / (s.offlineVat + s.onlineVat) : 1;
  const sc = o => Object.fromEntries(Object.entries(o).map(([a, v]) => [a, v * k]));
  return { ...d, cat: { ...d.cat, groups: sc(d.cat.groups), subs: sc(d.cat.subs), total: d.cat.total * k, novat: "scaled" } };
}

export async function send({ key, slot, dryRun = false, to } = {}) {
  let d = load(LS);
  if (!d || d.date !== today() || !d.store || !d.cat) throw Error("Chưa đủ dữ liệu hôm nay: chạy collect() ở trang 145 và 336 trước");
  d = noVat(d);
  const total = d.store.offline + d.store.online;
  let prev = load(PREV); if (!prev || prev.date !== d.date || prev.slot >= slot) prev = null;
  const check = { total: Math.round(total), catTotal: Math.round(d.cat.total), diff: Math.round(d.cat.total - total), bills: d.store.bills, catBasis: d.cat.novat === true ? "cột chưa VAT" : "quy đổi", prevSlot: prev?.slot || null, prevTotal: prev ? Math.round(prev.store.offline + prev.store.online) : null };
  if (dryRun) return check;
  let hist = load(HIST); hist = hist && hist.date === d.date ? hist.points : [];
  const cv = draw(d, prev, slot, hist), image = cv.toDataURL("image/jpeg", 0.9);
  const text = `📊 BC DOANH THU ${slot === 21 ? "CHỐT NGÀY" : slot + "H"} – 28717\n💰 ${fmt(total)}đ  •  🧾 ${d.store.bills} bill` + batteryLine(await battery());
  const r = await fetch(BOT + "/api/flash-sale", { method: "POST", headers: { "Content-Type": "application/json", "x-push-key": key }, body: JSON.stringify({ image, text, to }) });
  const res = await r.text();
  if (r.ok) { save(PREV, { ...d, slot }); saveHist(d.date, slot, total, d.store.bills); }
  return { ...check, status: r.status, result: res };
}

// Báo cáo không gửi LINE: trả số liệu đã tính sẵn (kèm phần tăng thêm so với khung trước) và ghi nhớ khung này.
export function report({ slot } = {}) {
  let d = load(LS);
  if (!d || d.date !== today() || !d.store || !d.cat) throw Error("Chưa đủ dữ liệu hôm nay: chạy collect() ở trang 145 và 336 trước");
  d = noVat(d);
  let prev = load(PREV); if (!prev || prev.date !== d.date || prev.slot >= slot) prev = null;
  const total = d.store.offline + d.store.online, ptotal = prev ? prev.store.offline + prev.store.online : null;
  const out = {
    date: d.date, slot, posAt: d.store.at,
    total: Math.round(total), offline: Math.round(d.store.offline), online: Math.round(d.store.online),
    bills: d.store.bills, perBill: d.store.bills ? Math.round(total / d.store.bills) : 0,
    catTotal: Math.round(d.cat.total), diff: Math.round(d.cat.total - total),
    prevSlot: prev?.slot || null, addTotal: prev ? Math.round(total - ptotal) : null, addBills: prev ? d.store.bills - prev.store.bills : null,
    groups: Object.entries(d.cat.groups).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: k, dt: Math.round(v), pct: +(v / d.cat.total * 100).toFixed(1), add: prev?.cat?.groups ? Math.round(v - (prev.cat.groups[k] || 0)) : null })),
    top: Object.entries(d.cat.subs).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ name: k, dt: Math.round(v) })),
  };
  save(PREV, { ...d, slot }); saveHist(d.date, slot, total, d.store.bills);
  return out;
}

// Lưu DT cộng dồn từng khung trong ngày để vẽ biểu đồ.
function saveHist(date, slot, total, bills) {
  const h = load(HIST), pts = (h && h.date === date ? h.points : []).filter(p => p.slot !== slot);
  pts.push({ slot, total, bills }); pts.sort((a, b) => a.slot - b.slot);
  save(HIST, { date, points: pts });
}

export async function battery() {
  try { const b = await navigator.getBattery(); return { charging: b.charging, level: Math.round(b.level * 100), minutesLeft: isFinite(b.dischargingTime) ? Math.round(b.dischargingTime / 60) : null }; } catch { return null; }
}
export function batteryLine(b) {
  if (!b || b.charging) return "";
  const t = b.minutesLeft ? ` (còn khoảng ${Math.floor(b.minutesLeft / 60)}h${String(b.minutesLeft % 60).padStart(2, "0")})` : "";
  return `\n🔋 MÁY CHẠY BÁO CÁO CHƯA CẮM SẠC – pin còn ${b.level}%${t}. Nhờ cắm sạc giúp!`;
}
// Gửi riêng cảnh báo pin (chỉ gửi khi chưa cắm sạc, trừ khi force).
export async function batteryAlert({ key, force = false, to } = {}) {
  const b = await battery();
  if (!b) return { ok: false, error: "không đọc được pin" };
  if (b.charging && !force) return { ...b, sent: false };
  const text = b.charging ? `🔌 Máy chạy báo cáo đang cắm sạc – pin ${b.level}%.` : batteryLine(b).trim();
  const r = await fetch("https://ng-bot-c0im.onrender.com/api/flash-sale", { method: "POST", headers: { "Content-Type": "application/json", "x-push-key": key }, body: JSON.stringify({ text, to }) });
  return { ...b, sent: r.ok, status: r.status, result: await r.text() };
}
