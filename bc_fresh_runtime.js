// BC FRESH runtime wrapper.
// The FRESH webhook must run BEFORE the legacy BC NGAY webhook so an Excel file
// is routed to FRESH only after the user explicitly sends `BC FRESH`.
const fs=require('fs');
const path=require('path');
const Module=require('module');
const sourceFile=path.join(__dirname,'bc_fresh_bot.js');
let src=fs.readFileSync(sourceFile,'utf8');

// Repair the generated fetch() function before Node compiles the source.
src=src.replace(/async function line\(u,o=\{\}\)\{[\s\S]*?\}async function reply/, "async function line(u,o={}){return fetch(u,{...o,headers:{Authorization:'Bearer '+TOKEN,...(o.headers||{})}})}async function reply");

// IMPORTANT: FRESH must be registered before the legacy BC NGAY handler.
src=src.replace(
  "return op.call(this,route,handlers[0],fresh,...handlers.slice(1))",
  "return op.call(this,route,fresh,...handlers)"
);

// Arm FRESH mode only after the exact command.
src=src.replace(
  "if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;",
  "if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;global.__BC_FRESH_WAITING=true;"
);

// Only the next Excel upload is consumed by FRESH.
src=src.replace(
  "if(m.type==='file'&&/\\.(xlsx|xls|csv)$/i.test(String(m.fileName||'')))",
  "if(m.type==='file'&&/\\.(xlsx|xls|csv)$/i.test(String(m.fileName||''))&&global.__BC_FRESH_WAITING===true)"
);
src=src.replace(
  "else if(m.type==='file'&&/\\.(xlsx|xls|csv)$/i.test(String(m.fileName||'')))",
  "else if(m.type==='file'&&/\\.(xlsx|xls|csv)$/i.test(String(m.fileName||''))&&global.__BC_FRESH_WAITING===true)"
);

// After FRESH processes the file, return to normal BC NGAY mode.
src=src.replace(
  "const im=await process(Buffer.from(await r.arrayBuffer()),m.fileName);await reply(e.replyToken,{type:'image',originalContentUrl:im.full,previewImageUrl:im.preview})",
  "const im=await process(Buffer.from(await r.arrayBuffer()),m.fileName);global.__BC_FRESH_WAITING=false;await reply(e.replyToken,{type:'image',originalContentUrl:im.full,previewImageUrl:im.preview})"
);

const runtime=new Module(path.join(__dirname,'bc_fresh_runtime_compiled.js'),module);
runtime.filename=path.join(__dirname,'bc_fresh_runtime_compiled.js');
runtime.paths=module.paths;
runtime._compile(src,runtime.filename);
module.exports=runtime.exports;
