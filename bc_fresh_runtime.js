// BC FRESH runtime wrapper.
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

// LINE/Express may expose req.body as an object. Also support the case where
// this FRESH route is registered before the existing BC NGAY raw-body middleware.
src = src.replace("const b=req.rawBody||req.body||Buffer.alloc(0),p=JSON.parse(b.toString('utf8'));", "const raw=req.rawBody??req.body??Buffer.alloc(0);const p=typeof raw==='object'&&!Buffer.isBuffer(raw)?raw:JSON.parse(Buffer.from(raw).toString('utf8'));");
src = src.replace("const raw=req.rawBody??req.body??Buffer.alloc(0);const p=typeof raw==='object'&&!Buffer.isBuffer(raw)?raw:JSON.parse(Buffer.from(raw).toString('utf8'));", "const b0=req.rawBody??req.body;const b=b0??await new Promise((resolve,reject)=>{const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject)});const p=typeof b==='object'&&!Buffer.isBuffer(b)?b:JSON.parse(Buffer.from(b).toString('utf8'));");

// FRESH = rebuild the latest saved Excel and reply in the exact chat/group where FRESH was typed.
src = src.replace("const m=e.message||{};let to=e.source?.userId||e.source?.groupId||e.source?.roomId;", "const m=e.message||{};let to=e.source?.userId||e.source?.groupId||e.source?.roomId;if(m.type==='text'&&/^FRESH$/i.test(String(m.text||'').trim())){used=true;globalThis.__BC_FRESH_WAITING=false;try{let im=null;if(fs.existsSync(XLS)&&typeof globalThis.__BC_FRESH_PROCESS==='function'){let meta={};try{meta=JSON.parse(fs.readFileSync(META,'utf8'))}catch(_e){}im=await globalThis.__BC_FRESH_PROCESS(fs.readFileSync(XLS),meta.fileName||'latest.xlsx')}else if(fs.existsSync(IMG)){im={full:BASE+'/bc-fresh.png',preview:BASE+'/bc-fresh-preview.png'}}else if(fs.existsSync(HTML)){im=await render(fs.readFileSync(HTML,'utf8'))}if(im&&e.replyToken){await reply(e.replyToken,{type:'image',originalContentUrl:im.full+'?'+Date.now(),previewImageUrl:im.preview+'?'+Date.now()})}else if(e.replyToken){await reply(e.replyToken,{type:'text',text:'⚠️ Chưa có file FRESH gần nhất để xử lý lại.'})}}catch(err){console.error('BC FRESH RESEND',err);if(e.replyToken)await reply(e.replyToken,{type:'text',text:'❌ Không thể dựng lại BC FRESH: '+String(err.message||err).slice(0,180)})}continue;}");

// BC FRESH registers the current group/room as the destination for later Excel reports.
src = src.replace("if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;globalThis.__BC_FRESH_WAITING=true;", "if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;globalThis.__BC_FRESH_WAITING=true;if(e.source?.type==='group'||e.source?.type==='room')saveFreshTarget(to);");

// New Excel results go to the saved destination; if none exists, reply to the sender's chat.
src = src.replace("const to=e.source?.userId||e.source?.groupId||e.source?.roomId;", "const to=loadFreshTarget()||e.source?.userId||e.source?.groupId||e.source?.roomId;");

// @sparticuz/chromium compatibility across versions.
src = src.replace("const chromium=require('@sparticuz/chromium');", "const chromium=(require('@sparticuz/chromium').default||require('@sparticuz/chromium'));");
src = src.replace("executablePath:globalThis.process.env.PUPPETEER_EXECUTABLE_PATH||undefined", "executablePath:await chromium.executablePath()");

const runtime = new Module(path.join(__dirname, 'bc_fresh_runtime_compiled.js'), module);
runtime.filename = path.join(__dirname, 'bc_fresh_runtime_compiled.js');
runtime.paths = module.paths;
runtime._compile(src, runtime.filename);
// Expose the real Excel-processing function to the FRESH resend handler.
globalThis.__BC_FRESH_PROCESS = runtime.exports.process;
module.exports = runtime.exports;
