// BC FRESH runtime wrapper.
// Exact workflow: user sends BC FRESH, then the NEXT Excel file is routed to FRESH.
const fs=require('fs');
const path=require('path');
const Module=require('module');
const sourceFile=path.join(__dirname,'bc_fresh_bot.js');
let src=fs.readFileSync(sourceFile,'utf8');

// Keep the LINE request helper compatible with Node's global process object.
src=src.replace(/async function line\(u,o=\{\}\)\{[\s\S]*?\}async function reply/,
  "async function line(u,o={}){return fetch(u,{...o,headers:{Authorization:'Bearer '+TOKEN,...(o.headers||{})}})}async function reply");

// Register FRESH before the legacy BC NGAY webhook.
src=src.replace(
  "return op.call(this,route,handlers[0],fresh,...handlers.slice(1))",
  "return op.call(this,route,fresh,...handlers)"
);

// BC FRESH is an ARM command only. Do NOT immediately resend an old/stale FRESH image.
src=src.replace(
  "if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;",
  "if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;globalThis.__BC_FRESH_WAITING=true;await reply(e.replyToken,{type:'text',text:'✅ Đã nhận lệnh BC FRESH.\\n📎 Anh gửi FILE EXCEL tiếp theo, em sẽ làm BC FRESH bằng HÌNH ẢNH.'});"
);

// Only the next Excel/CSV upload after BC FRESH is armed belongs to FRESH.
src=src.replace(
  "if(m.type==='file'&&/\\.(xlsx|xls|csv)$/i.test(String(m.fileName||'')))",
  "if(m.type==='file'&&/\\.(xlsx|xls|csv)$/i.test(String(m.fileName||''))&&globalThis.__BC_FRESH_WAITING===true)"
);
src=src.replace(
  "else if(m.type==='file'&&/\\.(xlsx|xls|csv)$/i.test(String(m.fileName||'')))",
  "else if(m.type==='file'&&/\\.(xlsx|xls|csv)$/i.test(String(m.fileName||''))&&globalThis.__BC_FRESH_WAITING===true)"
);

// Return to normal BC NGAY routing after the FRESH file has been rendered.
src=src.replace(
  "const im=await process(Buffer.from(await r.arrayBuffer()),m.fileName);await reply(e.replyToken,{type:'image',originalContentUrl:im.full,previewImageUrl:im.preview})",
  "const im=await process(Buffer.from(await r.arrayBuffer()),m.fileName);globalThis.__BC_FRESH_WAITING=false;await reply(e.replyToken,{type:'image',originalContentUrl:im.full,previewImageUrl:im.preview})"
);

// If FRESH processing fails, reset the armed state and send a visible error to LINE.
src=src.replace(
  "}catch(err){console.error('BC FRESH ERROR',err);if(!res.headersSent)res.status(200).send('OK')}",
  "}catch(err){globalThis.__BC_FRESH_WAITING=false;console.error('BC FRESH ERROR',err);for(const e of (p&&p.events||[])){if(e.replyToken)await reply(e.replyToken,{type:'text',text:'❌ BC FRESH lỗi: '+String(err.message||err).slice(0,180)})}if(!res.headersSent)res.status(200).send('OK')}"
);

const runtime=new Module(path.join(__dirname,'bc_fresh_runtime_compiled.js'),module);
runtime.filename=path.join(__dirname,'bc_fresh_runtime_compiled.js');
runtime.paths=module.paths;
runtime._compile(src,runtime.filename);
module.exports=runtime.exports;
