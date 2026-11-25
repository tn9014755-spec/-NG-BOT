// Chạy trong trang https://www.bachhoaxanh.com/khuyen-mai (đã đăng nhập, đã chọn địa chỉ).
// Dùng: const run = (await import('https://ng-bot-c0im.onrender.com/flash-sale/client.js')).default;
//       await run({ key: '<FLASH_PUSH_KEY>', send: true })
// Quét mọi khung Flash Sale, lọc Sữa / Bia / Nước giải khát, vẽ ảnh bảng và gửi vào nhóm LINE qua bot.
const BOT = "https://ng-bot-c0im.onrender.com";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PRICE = /^[\d.]+đ$/;
const num = s => +String(s || "").replace(/[^\d]/g, "");
const fmt = n => n.toLocaleString("vi-VN").replace(/,/g, ".");

function groupOf(name) {
  const n = name.toLowerCase();
  if (/sữa tắm|sữa rửa|rửa mặt|dưỡng thể|dưỡng da|cà phê|kem |bánh|kẹo|ngũ cốc|bột giặt/.test(n)) return null;
  if (/\bbia\b|somersby|lên men|cocktail|vodka|soju|rượu/.test(n)) return "BIA";
  if (/sữa|ensure|milo|ovaltine|yakult|probi/.test(n)) return "SỮA";
  if (/nước giặt|nước xả|nước rửa|nước lau|nước mắm|nước tương|nước chấm|nước tẩy|nước hoa|nước súc/.test(n)) return null;
  if (/nước ngọt|pepsi|coca|7up|sprite|fanta|mirinda|sting|redbull|red bull|tăng lực|\btrà\b|c2|nước suối|nước khoáng|điện giải|nước gạo|revive|aquafina|lavie|nước ép|nước uống|soda|sá xị|number ?1|wake up|warrior|nước dừa|nước yến/.test(n)) return "NƯỚC GIẢI KHÁT";
  return null;
}

function parseSlot(text) {
  const L = text.split("\n").map(x => x.trim()).filter(Boolean), out = [];
  for (let i = 2; i < L.length; i++) {
    if (!PRICE.test(L[i]) || PRICE.test(L[i - 1])) continue;
    const name = L[i - 2]; let old = "", note = [];
    let j = i + 1;
    if (PRICE.test(L[j] || "")) { old = L[j]; j++; }
    if (/^-\d+%$/.test(L[j] || "")) j++;
    while (j < L.length && note.length < 3 && !PRICE.test(L[j + 2] || "")) { note.push(L[j]); j++; }
    if (!groupOf(name)) continue;
    const promo = note.find(x => /\d+K|\d{2,}\.?\d*Đ|TẶNG|MUA|COMBO/i.test(x) && !/suất|Tối đa/i.test(x)) || "";
    const limit = (note.find(x => /Tối đa/.test(x)) || "").replace("Tối đa ", "");
    out.push({ name, unit: L[i - 1], price: num(L[i]), old: num(old), promo, limit });
  }
  return out;
}

async function scan() {
  const main = document.querySelector("main");
  const fsTab = [...main.querySelectorAll("*")].find(e => e.children.length === 0 && e.innerText?.trim() === "FLASH SALE");
  if (fsTab) { fsTab.click(); await sleep(1500); }
  const slots = [...main.querySelectorAll("*")].filter(e => e.children.length === 0 && /^\d+h - \d+h$/.test(e.innerText?.trim() || ""));
  if (!slots.length) throw Error("Không thấy các khung giờ Flash Sale");
  const items = new Map(), slotNames = [];
  const lastLabel = slots[slots.length - 1].innerText.trim();
  const slotBody = () => { const t = main.innerText; return t.slice(t.lastIndexOf(lastLabel)).split("Bán hàng 7:30")[0]; };
  const priceCount = () => slotBody().split("\n").filter(x => PRICE.test(x.trim())).length;
  for (const s of slots) {
    const label = s.innerText.trim(); slotNames.push(label);
    window.scrollTo(0, 0); s.click(); await sleep(2500);
    // Danh sách tải dần khi cuộn (khung đang diễn ra có thể vài chục món): cuộn tới khi số giá đứng yên 3 lần liền.
    let prev = -1, still = 0;
    for (let k = 0; k < 40 && still < 3; k++) {
      window.scrollTo(0, document.body.scrollHeight); await sleep(1200);
      const n = priceCount(); still = n === prev ? still + 1 : 0; prev = n;
    }
    const body = slotBody();
    for (const it of parseSlot(body)) {
      const k = it.name + "|" + it.price;
      if (!items.has(k)) items.set(k, { ...it, group: groupOf(it.name), slots: [] });
      items.get(k).slots.push(label.split(" ")[0]);
    }
  }
  return { slotNames, items: [...items.values()] };
}

function slotText(sl, all) {
  if (sl.length === all.length) return `Cả ${all.length} khung`;
  const h = sl.map(x => +x.replace("h", "")), idx = all.map(x => +x.split("h")[0]);
  const pos = h.map(x => idx.indexOf(x)).sort((a, b) => a - b);
  const contiguous = pos.every((p, i) => i === 0 || p === pos[i - 1] + 1);
  if (contiguous && pos.length > 2) { const end = all[pos[pos.length - 1]].split(" - ")[1].replace("00h", "24h"); return `${all[pos[0]].split(" ")[0]} – ${end}`; }
  return h.map(x => x + "h").join(", ");
}

function draw(data, meta) {
  const groups = ["SỮA", "NƯỚC GIẢI KHÁT", "BIA"];
  const cols = [["Sản phẩm", 560], ["Giá FS", 140], ["Giá gốc", 140], ["Giảm", 90], ["Khung giờ", 270]];
  const W = cols.reduce((s, c) => s + c[1], 0) + 40, RH = 46;
  const rows = groups.reduce((s, g) => s + 1 + Math.max(1, data.filter(x => x.group === g).length), 0);
  const H = 130 + RH + rows * RH + 90;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const d = c.getContext("2d"), F = "Arial, Helvetica, sans-serif";
  d.fillStyle = "#fff"; d.fillRect(0, 0, W, H);
  d.fillStyle = "#00853f"; d.fillRect(0, 0, W, 110);
  d.fillStyle = "#fff"; d.textBaseline = "top";
  d.font = `bold 34px ${F}`; d.fillText("FLASH SALE BÁCH HOÁ XANH – SỮA · BIA · NƯỚC GIẢI KHÁT", 20, 16);
  d.font = `20px ${F}`; d.fillText(`${meta.date}  •  Giá online khu vực ${meta.area}  •  ${meta.slots} khung giờ`, 20, 68);
  let y = 130, x = 20;
  d.fillStyle = "#282828"; d.fillRect(20, y, W - 40, RH);
  d.fillStyle = "#fff"; d.font = `bold 22px ${F}`;
  for (const [n, w] of cols) { d.fillText(n, x + 10, y + 12); x += w; }
  y += RH;
  for (const g of groups) {
    d.fillStyle = "#e8f5ec"; d.fillRect(20, y, W - 40, RH);
    d.fillStyle = "#00853f"; d.font = `bold 22px ${F}`; d.fillText(g, 30, y + 12); y += RH;
    const list = data.filter(it => it.group === g);
    if (!list.length) {
      d.fillStyle = "#5a5a5a"; d.font = `22px ${F}`; d.fillText(`Không có sản phẩm ${g.toLowerCase()} nào trong Flash Sale hôm nay`, 30, y + 12);
      d.fillStyle = "#dcdcdc"; d.fillRect(20, y + RH - 1, W - 40, 1); y += RH; continue;
    }
    for (const it of list) {
      x = 20;
      let name = it.name + (it.promo ? ` (${it.promo})` : "");
      d.font = `22px ${F}`;
      while (d.measureText(name).width > cols[0][1] - 20) name = name.slice(0, -2);
      if (name.length < (it.name + (it.promo ? ` (${it.promo})` : "")).length) name = name.slice(0, -1) + "…";
      const pct = it.old ? `-${Math.round((1 - it.price / it.old) * 100)}%` : "";
      const vals = [name, fmt(it.price), it.old ? fmt(it.old) : "", pct, it.slotLabel];
      vals.forEach((v, i) => {
        d.font = (i === 1 || i === 3 ? "bold " : "") + `22px ${F}`;
        d.fillStyle = i === 1 || i === 3 ? "#d62828" : i === 2 ? "#828282" : "#000";
        d.fillText(v, x + 10, y + 12);
        if (i === 2 && v) { const tw = d.measureText(v).width; d.fillRect(x + 10, y + 23, tw, 2); }
        x += cols[i][1];
      });
      d.fillStyle = "#dcdcdc"; d.fillRect(20, y + RH - 1, W - 40, 1); y += RH;
    }
  }
  d.fillStyle = "#5a5a5a"; d.font = `20px ${F}`;
  d.fillText(meta.footer1, 20, y + 15);
  d.fillText(`Nguồn: bachhoaxanh.com/khuyen-mai, quét lúc ${meta.time} – số suất có thể thay đổi trong ngày.`, 20, y + 45);
  return c;
}

export default async function run({ key, send = false, to } = {}) {
  if (!location.pathname.startsWith("/khuyen-mai")) throw Error("Hãy mở bachhoaxanh.com/khuyen-mai trước");
  let header = "";
  for (let i = 0; i < 30; i++) { header = document.querySelector("header")?.innerText || ""; if (/Tài khoản/.test(header)) break; await sleep(500); }
  if (!/Tài khoản/.test(header)) throw Error("Chưa đăng nhập bachhoaxanh.com");
  const area = (header.match(/Giao đến:\s*\n?([^\n]+)/) || [])[1] || "chưa chọn địa chỉ";
  const { slotNames, items } = await scan();
  const order = { "SỮA": 0, "NƯỚC GIẢI KHÁT": 1, "BIA": 2 };
  items.forEach(it => it.slotLabel = slotText(it.slots, slotNames));
  items.sort((a, b) => order[a.group] - order[b.group] || ((b.old ? 1 - b.price / b.old : 0) - (a.old ? 1 - a.price / a.old : 0)));
  const now = new Date(), vn = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(now);
  const time = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(now);
  const areaShort = area.split(",").slice(-2).join(",").trim();
  const canvas = draw(items, { date: vn, area: areaShort, slots: slotNames.length, time, footer1: "Giới hạn số lượng mỗi đơn theo từng sản phẩm trên web. Bảng gộp sản phẩm trùng giữa các khung." });
  const dataUrl = canvas.toDataURL("image/png");
  const summary = items.map(it => `${it.group} | ${it.name} | ${it.price} | ${it.old} | ${it.slotLabel}`);
  if (!send) return { area, slots: slotNames, count: items.length, summary, imageBytes: Math.round(dataUrl.length * 0.75) };
  const text = `🛒 FLASH SALE BHX HÔM NAY\nSữa · Bia · Nước giải khát – ${items.length} sản phẩm` + batteryLine(await battery());
  const r = await fetch(BOT + "/api/flash-sale", { method: "POST", headers: { "Content-Type": "application/json", "x-push-key": key }, body: JSON.stringify({ image: dataUrl, text, to }) });
  return { area, slots: slotNames, count: items.length, summary, status: r.status, result: await r.text() };
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
