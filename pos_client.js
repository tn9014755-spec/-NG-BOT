// BC doanh thu theo khung giờ từ POS (pos.bachhoaxanh.com), chạy trong trình duyệt đã đăng nhập POS.
// const m = await import('https://ng-bot-c0im.onrender.com/bc-pos/client.js?v=' + Date.now());
//   trên trang /reports/home/dashboard/145 : await m.collect()   (DT theo siêu thị)
//   trên trang /reports/home/dashboard/336 : await m.collect()   (DT theo ngành hàng)
//   rồi (trang POS bất kỳ):                 await m.send({ key, slot: 12, dryRun })
const BOT = "https://ng-bot-c0im.onrender.com", STORE = "28717", LS = "bcpos_today", PREV = "bcpos_prev";
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
    const g = {}, sub = {};
    for (const r of rows) {
      if (!String(r.storeid).startsWith(STORE)) continue;
      const k = clean(r.bhxmaingroupname), s = clean(r.subgroupname);
      g[k] = (g[k] || 0) + n(r.revenuevat); sub[s] = (sub[s] || 0) + n(r.revenuevat);
    }
    data.cat = { groups: g, subs: sub, total: Object.values(g).reduce((a, b) => a + b, 0), at: nowHM(), rows: rows.length };
  }
  save(LS, data);
  return id === "145" ? data.store : { total: Math.round(data.cat.total), groups: Object.keys(data.cat.groups).length, rows: data.cat.rows };
}

function draw(d, prev, slot) {
  const s = d.store, c = d.cat, total = s.offlineVat + s.onlineVat;
  const groups = Object.entries(c.groups).sort((a, b) => b[1] - a[1]);
  const subs = Object.entries(c.subs).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const W = 1100, RH = 40, H = 120 + 190 + 60 + (groups.length + 1) * RH + 60 + Math.ceil(subs.length / 2) * RH + 90;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d"), F = "Arial, Helvetica, sans-serif", G = "#00853f";
  x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); x.textBaseline = "top";
  x.fillStyle = G; x.fillRect(0, 0, W, 100);
  x.fillStyle = "#fff"; x.font = `bold 32px ${F}`;
  x.fillText(`BC DOANH THU ${slot === 21 ? "CHỐT NGÀY" : "KHUNG " + slot + "H"} – 28717 MỸ QƯỚI`, 24, 16);
  x.font = `20px ${F}`; x.fillText(`Ngày ${d.date}  •  Dữ liệu POS lúc ${s.at}  •  Doanh thu có VAT`, 24, 62);
  // KPI
  const prevTotal = prev ? prev.store.offlineVat + prev.store.onlineVat : null;
  const kpi = [
    ["TỔNG DT", fmt(total), prev ? `+${fmt(total - prevTotal)} từ ${prev.slot === 21 ? "chốt" : prev.slot + "h"}` : ""],
    ["OFFLINE", fmt(s.offlineVat), ""],
    ["ONLINE", fmt(s.onlineVat), ""],
    ["SỐ BILL", fmt(s.bills), prev ? `+${fmt(s.bills - prev.store.bills)} bill` : ""],
    ["TB / BILL", s.bills ? fmt(total / s.bills) : "-", ""],
  ];
  const bw = (W - 48 - 4 * 12) / 5;
  kpi.forEach(([t, v, sub], i) => {
    const bx = 24 + i * (bw + 12), by = 120;
    x.fillStyle = i === 0 ? "#e8f5ec" : "#f4f6f5"; x.fillRect(bx, by, bw, 160);
    x.fillStyle = "#555"; x.font = `bold 18px ${F}`; x.fillText(t, bx + 14, by + 14);
    x.fillStyle = i === 0 ? G : "#111"; x.font = `bold ${i === 0 ? 30 : 28}px ${F}`; x.fillText(v, bx + 14, by + 52);
    if (sub) { x.fillStyle = "#d62828"; x.font = `bold 17px ${F}`; x.fillText(sub, bx + 14, by + 110); }
  });
  // Ngành hàng
  let y = 310;
  x.fillStyle = "#282828"; x.fillRect(24, y, W - 48, RH);
  x.fillStyle = "#fff"; x.font = `bold 20px ${F}`;
  const cx = [36, 600, 800, 940];
  ["Ngành hàng", "DT", "Tỷ trọng", prev ? "Tăng thêm" : ""].forEach((t, i) => x.fillText(t, cx[i], y + 10));
  y += RH;
  groups.forEach(([k, v], i) => {
    if (i % 2) { x.fillStyle = "#f7f7f7"; x.fillRect(24, y, W - 48, RH); }
    const add = prev?.cat?.groups ? v - (prev.cat.groups[k] || 0) : null;
    x.fillStyle = "#111"; x.font = `20px ${F}`; x.fillText(k.length > 44 ? k.slice(0, 43) + "…" : k, cx[0], y + 10);
    x.font = `bold 20px ${F}`; x.fillText(fmt(v), cx[1], y + 10);
    x.font = `20px ${F}`; x.fillText((c.total ? v / c.total * 100 : 0).toFixed(1) + "%", cx[2], y + 10);
    if (add !== null) { x.fillStyle = add > 0 ? G : "#888"; x.fillText((add > 0 ? "+" : "") + fmt(add), cx[3], y + 10); }
    y += RH;
  });
  x.fillStyle = "#e8f5ec"; x.fillRect(24, y, W - 48, RH);
  x.fillStyle = G; x.font = `bold 20px ${F}`; x.fillText("TỔNG", cx[0], y + 10); x.fillText(fmt(c.total), cx[1], y + 10); x.fillText("100%", cx[2], y + 10);
  y += RH + 20;
  x.fillStyle = "#111"; x.font = `bold 22px ${F}`; x.fillText("TOP NHÓM HÀNG BÁN CHẠY", 24, y); y += 36;
  subs.forEach(([k, v], i) => {
    const col = i % 2, row = Math.floor(i / 2), bx = 24 + col * ((W - 48) / 2), by = y + row * RH;
    x.fillStyle = "#111"; x.font = `20px ${F}`; x.fillText(`${i + 1}. ${k.length > 26 ? k.slice(0, 25) + "…" : k}`, bx + 8, by + 8);
    x.font = `bold 20px ${F}`; x.fillText(fmt(v), bx + 380, by + 8);
  });
  y += Math.ceil(subs.length / 2) * RH + 16;
  x.fillStyle = "#666"; x.font = `17px ${F}`;
  x.fillText("Nguồn: POS – Doanh thu theo siêu thị (145) & Doanh thu theo ngành hàng (336).", 24, y);
  if (Math.abs(c.total - total) > 1000) { x.fillStyle = "#d62828"; x.fillText(`⚠ Tổng ngành hàng lệch DT siêu thị ${fmt(c.total - total)}đ (2 báo cáo lấy cách nhau vài phút).`, 24, y + 26); }
  return cv;
}

export async function send({ key, slot, dryRun = false, to } = {}) {
  const d = load(LS);
  if (!d || d.date !== today() || !d.store || !d.cat) throw Error("Chưa đủ dữ liệu hôm nay: chạy collect() ở trang 145 và 336 trước");
  const total = d.store.offlineVat + d.store.onlineVat;
  let prev = load(PREV); if (!prev || prev.date !== d.date || prev.slot >= slot) prev = null;
  const check = { total: Math.round(total), catTotal: Math.round(d.cat.total), diff: Math.round(d.cat.total - total), bills: d.store.bills, prevSlot: prev?.slot || null, prevTotal: prev ? Math.round(prev.store.offlineVat + prev.store.onlineVat) : null };
  if (dryRun) return check;
  const cv = draw(d, prev, slot), image = cv.toDataURL("image/png");
  const text = `📊 BC DOANH THU ${slot === 21 ? "CHỐT NGÀY" : slot + "H"} – 28717\n💰 ${fmt(total)}đ  •  🧾 ${d.store.bills} bill` + batteryLine(await battery());
  const r = await fetch(BOT + "/api/flash-sale", { method: "POST", headers: { "Content-Type": "application/json", "x-push-key": key }, body: JSON.stringify({ image, text, to }) });
  const res = await r.text();
  if (r.ok) save(PREV, { ...d, slot });
  return { ...check, status: r.status, result: res };
}

// Báo cáo không gửi LINE: trả số liệu đã tính sẵn (kèm phần tăng thêm so với khung trước) và ghi nhớ khung này.
export function report({ slot } = {}) {
  const d = load(LS);
  if (!d || d.date !== today() || !d.store || !d.cat) throw Error("Chưa đủ dữ liệu hôm nay: chạy collect() ở trang 145 và 336 trước");
  let prev = load(PREV); if (!prev || prev.date !== d.date || prev.slot >= slot) prev = null;
  const total = d.store.offlineVat + d.store.onlineVat, ptotal = prev ? prev.store.offlineVat + prev.store.onlineVat : null;
  const out = {
    date: d.date, slot, posAt: d.store.at,
    total: Math.round(total), offline: Math.round(d.store.offlineVat), online: Math.round(d.store.onlineVat),
    bills: d.store.bills, perBill: d.store.bills ? Math.round(total / d.store.bills) : 0,
    catTotal: Math.round(d.cat.total), diff: Math.round(d.cat.total - total),
    prevSlot: prev?.slot || null, addTotal: prev ? Math.round(total - ptotal) : null, addBills: prev ? d.store.bills - prev.store.bills : null,
    groups: Object.entries(d.cat.groups).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: k, dt: Math.round(v), pct: +(v / d.cat.total * 100).toFixed(1), add: prev?.cat?.groups ? Math.round(v - (prev.cat.groups[k] || 0)) : null })),
    top: Object.entries(d.cat.subs).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ name: k, dt: Math.round(v) })),
  };
  save(PREV, { ...d, slot });
  return out;
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
