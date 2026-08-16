// BC FRESH runtime wrapper.
// Keep the runtime transform deliberately simple so generated JS cannot be corrupted.
const fs = require('fs');
const path = require('path');
const Module = require('module');

// Render may retain an old Puppeteer cache/executable environment. Force BC FRESH
// to use one project-local cache for both installation and runtime.
const PUPPETEER_CACHE_DIR = path.join(__dirname, '.cache', 'puppeteer');
process.env.PUPPETEER_CACHE_DIR = PUPPETEER_CACHE_DIR;
delete process.env.PUPPETEER_EXECUTABLE_PATH;

const sourceFile = path.join(__dirname, 'bc_fresh_bot.js');
let src = fs.readFileSync(sourceFile, 'utf8');

// Safe environment access inside the compiled runtime.
src = src.replace(/process\.env\.LINE_CHANNEL_ACCESS_TOKEN/g, "globalThis.process?.env?.LINE_CHANNEL_ACCESS_TOKEN");
src = src.replace(/process\.env\.LINE_ACCESS_TOKEN/g, "globalThis.process?.env?.LINE_ACCESS_TOKEN");
src = src.replace(/process\.env\.RENDER_EXTERNAL_URL/g, "globalThis.process?.env?.RENDER_EXTERNAL_URL");
src = src.replace(/process\.env\.PUBLIC_BASE_URL/g, "globalThis.process?.env?.PUBLIC_BASE_URL");

// SheetJS exposes workbook.Sheets as an object keyed by sheet name.
src = src.replace("for(const ws of wb.Sheets)", "for(const ws of Object.values(wb.Sheets || {}))");
src = src.replace("for (const ws of wb.Sheets)", "for (const ws of Object.values(wb.Sheets || {}))");

// Keep the LINE destination in scope for the file-processing catch block.
src = src.replace("const m=e.message||{};", "const m=e.message||{};let to=e.source?.userId||e.source?.groupId||e.source?.roomId;");
src = src.replace("const to=e.source?.userId||e.source?.groupId||e.source?.roomId;", "to=e.source?.userId||e.source?.groupId||e.source?.roomId;");

// Save the group/user that issued BC FRESH as the active report destination.
// The next Excel upload, even if it arrives after a separate message, will send
// the finished report back to this destination. FRESH also uses this destination.
src = src.replace("if(m.type==='text'&&/^FRESH\\$/i.test(String(m.text||'').trim())){", "if(m.type==='text'&&/^FRESH$/i.test(String(m.text||'').trim())){globalThis.__BC_FRESH_TARGET=to;used=true;globalThis.__BC_FRESH_WAITING=false;if(fs.existsSync(IMG)){if(e.replyToken)await reply(e.replyToken,{type:'text',text:'📊 Đang gửi lại BC FRESH gần nhất...'});const dest=globalThis.__BC_FRESH_TARGET;if(dest)await pushMessage(dest,{type:'image',originalContentUrl:BASE+'/bc-fresh.png?'+Date.now(),previewImageUrl:BASE+'/bc-fresh-preview.png?'+Date.now()})}else if(e.replyToken)await reply(e.replyToken,{type:'text',text:'⚠️ Chưa có BC FRESH nào được lưu. Anh gửi BC FRESH + FILE EXCEL trước nhé.'})}else if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){");
src = src.replace("if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;globalThis.__BC_FRESH_WAITING=true;", "if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;globalThis.__BC_FRESH_TARGET=to;globalThis.__BC_FRESH_WAITING=true;");

// For the Excel event, prefer the destination captured by the BC FRESH command.
src = src.replace("to=e.source?.userId||e.source?.groupId||e.source?.roomId;", "to=globalThis.__BC_FRESH_TARGET||e.source?.userId||e.source?.groupId||e.source?.roomId;");

// @sparticuz/chromium v149 is ESM-first; require() returns a namespace with
// the Chromium object under .default in CommonJS runtime.
src = src.replace("const chromium=require('@sparticuz/chromium');", "const chromium=(require('@sparticuz/chromium').default||require('@sparticuz/chromium'));");

// Puppeteer on Render uses the browser from the same project-local cache when available.
src = src.replace("executablePath:globalThis.process.env.PUPPETEER_EXECUTABLE_PATH||undefined", "executablePath:p.executablePath()");

const runtime = new Module(path.join(__dirname, 'bc_fresh_runtime_compiled.js'), module);
runtime.filename = path.join(__dirname, 'bc_fresh_runtime_compiled.js');
runtime.paths = module.paths;
runtime._compile(src, runtime.filename);
module.exports = runtime.exports;
