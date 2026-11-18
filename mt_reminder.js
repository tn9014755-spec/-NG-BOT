// Nhắc MT (mục tiêu) hằng ngày vào nhóm LINE: 6h, 12h, 18h, 21h giờ Việt Nam.
// Nhóm nhận nhắc: biến môi trường MT_GROUP_IDS (cách nhau dấu phẩy) + nhóm bật bằng lệnh "BẬT NHẮC MT".
const fs = require("fs"), path = require("path");
const FILE = path.join(__dirname, "data", "mt_reminder.json");

const SCHEDULE = [
  { hour: 6, text: "☀️ HI TEAM! Chúc cả team một buổi sáng làm việc thật hiệu quả 💪\n\n🎯 Các bạn đã sẵn sàng với MT hôm nay chưa !!" },
  { hour: 12, text: "🕛 12H RỒI TEAM ƠI!\n\n🎯 MT hôm nay các bạn đã hoàn tất đến đâu rồi ?" },
  { hour: 18, text: "🕕 18H - VỀ ĐÍCH THÔI!\n\n🎯 MT còn lại phải hoàn tất nhé !!" },
  { hour: 21, text: "🌙 21H - TỔNG KẾT NGÀY\n\n📋 Nhờ QL tổng kết MT hôm nay nhé !" },
];

function load() { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return { groups: [], sent: {} }; } }
function save(s) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s, null, 2)); } catch (e) { console.warn("⚠️ NHẮC MT → không lưu được:", e.message); } }
function envGroups() { return String(process.env.MT_GROUP_IDS || "").split(/[;,\s]+/).map(x => x.trim()).filter(Boolean); }
function targets() { const s = load(); const off = new Set(s.off || []); return [...new Set([...envGroups(), ...(s.groups || [])])].filter(g => !off.has(g)); }

function vnNow() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const o = Object.fromEntries(p.map(x => [x.type, x.value]));
  return { day: `${o.year}-${o.month}-${o.day}`, hour: +o.hour, minute: +o.minute };
}

function enable(groupId) { const s = load(); s.groups = [...new Set([...(s.groups || []), groupId])]; s.off = (s.off || []).filter(g => g !== groupId); save(s); console.log("🎯 NHẮC MT → BẬT cho nhóm", groupId); }
function disable(groupId) { const s = load(); s.groups = (s.groups || []).filter(g => g !== groupId); s.off = [...new Set([...(s.off || []), groupId])]; save(s); console.log("🎯 NHẮC MT → TẮT cho nhóm", groupId); }
function isOn(groupId) { return targets().includes(groupId); }
function scheduleText() { return SCHEDULE.map(x => `⏰ ${String(x.hour).padStart(2, "0")}h: ${x.text.split("\n").pop()}`).join("\n"); }

function allMessage(text) {
  const safe = String(text).replace(/[{}]/g, c => c + c); // textV2: dấu { } phải nhân đôi
  return { type: "textV2", text: "{all} " + safe, substitution: { all: { type: "mention", mentionee: { type: "all" } } } };
}

async function tick(push) {
  const now = vnNow();
  const slot = SCHEDULE.find(x => x.hour === now.hour && now.minute < 10); // gửi trong 10 phút đầu của khung giờ
  if (!slot) return;
  const s = load(); s.sent = s.sent || {};
  for (const g of targets()) {
    const key = `${now.day}|${slot.hour}|${g}`;
    if (s.sent[key]) continue;
    s.sent[key] = Date.now(); save(s); // đánh dấu trước để không gửi trùng
    // @All cả nhóm (textV2); nếu LINE từ chối thì gửi lại dạng chữ thường để không mất nhắc
    let ok = await push(g, [allMessage(slot.text)]), mode = "@All";
    if (!ok) { ok = await push(g, [{ type: "text", text: slot.text }]); mode = "chữ thường"; }
    console.log(`🎯 NHẮC MT → ${slot.hour}h → ${g}: ${ok ? "OK" : "LỖI"} (${mode})`);
  }
  // dọn dấu cũ
  for (const k of Object.keys(s.sent)) if (!k.startsWith(now.day)) delete s.sent[k];
  save(s);
}

function start(push) {
  console.log("🎯 NHẮC MT → nhóm đang bật:", targets().join(", ") || "(chưa có)");
  setInterval(() => tick(push).catch(e => console.error("❌ NHẮC MT", e)), 60000);
  tick(push).catch(e => console.error("❌ NHẮC MT", e));
}

module.exports = { start, enable, disable, isOn, scheduleText };
