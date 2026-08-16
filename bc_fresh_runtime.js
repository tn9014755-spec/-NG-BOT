// BC FRESH runtime wrapper.
// Keep the runtime transform deliberately simple so generated JS cannot be corrupted.
const fs = require('fs');
const path = require('path');
const Module = require('module');

const PUPPETEER_CACHE_DIR = path.join(__dirname, '.cache', 'puppeteer');
process.env.PUPPETEER_CACHE_DIR = PUPPETEER_CACHE_DIR;
delete process.env.PUPPETEER_EXECUTABLE_PATH;

const sourceFile = path.join(__dirname, 'bc_fresh_bot.js');
const TARGET_DIR = path.join(__dirname, 'data', 'bc_fresh');
const TARGET_FILE = path.join(TARGET_DIR, 'target.json');
fs.mkdirSync(TARGET_DIR, {recursive:true});
function loadFreshTarget(){try{return JSON.parse(fs.readFileSync(TARGET_FILE,'utf8')).to||''}catch(e){return ''}}
function saveFreshTarget(to){if(!to)return;try{fs.writeFileSync(TARGET_FILE,JSON.stringify({to,updatedAt:new Date().toISOString()}))}catch(e){console.error('BC FRESH TARGET SAVE',e)}}

let src = fs.readFileSync(sourceFile, 'utf8');

src = src.replace(/process\.env\.LINE_CHANNEL_ACCESS_TOKEN/g, "globalThis.process?.env?.LINE_CHANNEL_ACCESS_TOKEN");
src = src.replace(/process\.env\.LINE_ACCESS_TOKEN/g, "globalThis.process?.env?.LINE_ACCESS_TOKEN");
src = src.replace(/process\.env\.RENDER_EXTERNAL_URL/g, "globalThis.process?.env?.RENDER_EXTERNAL_URL");
src = src.replace(/process\.env\.PUBLIC_BASE_URL/g, "globalThis.process?.env?.PUBLIC_BASE_URL");
src = src.replace("for(const ws of wb.Sheets)", "for(const ws of Object.values(wb.Sheets || {}))");
src = src.replace("for (const ws of wb.Sheets)", "for (const ws of Object.values(wb.Sheets || {}))");

// Keep destination in scope.
src = src.replace("const m=e.message||{};", "const m=e.message||{};let to=e.source?.userId||e.source?.groupId||e.source?.roomId;");

// FRESH: in a group/room, use that same destination; in private chat, use the saved group/room.
src = src.replace("if(m.type==='text'&&/^FRESH$/i.test(String(m.text||'').trim())){", "if(m.type==='text'&&/^FRESH$/i.test(String(m.text||'').trim())){used=true;globalThis.__BC_FRESH_WAITING=false;const dest=(e.source?.type==='group'||e.source?.type==='room')?(saveFreshTarget(to),to):loadFreshTarget();if(fs.existsSync(IMG)&&dest){if(e.replyToken&&e.source?.type!=='group'&&e.source?.type!=='room')await reply(e.replyToken,{type:'text',text:'📊 Đã nhận FRESH. Em gửi BC FRESH gần nhất vào nhóm đã cài.'});await pushMessage(dest,{type:'image',originalContentUrl:BASE+'/bc-fresh.png?'+Date.now(),previewImageUrl:BASE+'/bc-fresh-preview.png?'+Date.now()})}else if(fs.existsSync(IMG)&&e.replyToken){await reply(e.replyToken,{type:'image',originalContentUrl:BASE+'/bc-fresh.png?'+Date.now(),previewImageUrl:BASE+'/bc-fresh-preview.png?'+Date.now()})}else if(e.replyToken)await reply(e.replyToken,{type:'text',text:'⚠️ Chưa có BC FRESH được lưu.'})}else if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){");

// BC FRESH in GROUP/ROOM registers that destination; private chat does not overwrite it.
src = src.replace("if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;globalThis.__BC_FRESH_TARGET=to;globalThis.__BC_FRESH_WAITING=true;", "if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;globalThis.__BC_FRESH_TARGET=to;globalThis.__BC_FRESH_WAITING=true;if(e.source?.type==='group'||e.source?.type==='room')saveFreshTarget(to);");

// Excel result prefers the saved group/room.
src = src.replace("const to=e.source?.userId||e.source?.groupId||e.source?.roomId;", "const to=loadFreshTarget()||e.source?.userId||e.source?.groupId||e.source?.roomId;");

// @sparticuz/chromium v149 is ESM-first.
src = src.replace("const chromium=require('@sparticuz/chromium');", "const chromium=(require('@sparticuz/chromium').default||require('@sparticuz/chromium'));");
src = src.replace("executablePath:globalThis.process.env.PUPPETEER_EXECUTABLE_PATH||undefined", "executablePath:p.executablePath()");

const runtime = new Module(path.join(__dirname, 'bc_fresh_runtime_compiled.js'), module);
runtime.filename = path.join(__dirname, 'bc_fresh_runtime_compiled.js');
runtime.paths = module.paths;
runtime._compile(src, runtime.filename);
module.exports = runtime.exports;
