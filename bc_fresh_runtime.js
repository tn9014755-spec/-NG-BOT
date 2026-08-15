// Runtime compatibility wrapper for BC FRESH.
// Repairs the generated module before Node compiles it and keeps BC NGAY routing intact.
const fs=require('fs');
const path=require('path');
const Module=require('module');
const sourceFile=path.join(__dirname,'bc_fresh_bot.js');
let src=fs.readFileSync(sourceFile,'utf8');

// The generated module had a missing closing brace in the fetch() headers object.
// Repair the complete function declaration by regex so minor formatting changes do not break the patch.
src=src.replace(/async function line\(u,o=\{\}\)\{[\s\S]*?\}async function reply/, "async function line(u,o={}){return fetch(u,{...o,headers:{Authorization:'Bearer '+TOKEN,...(o.headers||{})}})}async function reply");

// BC FRESH is selected only after the user explicitly sends BC FRESH.
src=src.replace(
  "if(m.type==='file'&&/\\.(xlsx|xls|csv)$/i.test(String(m.fileName||'')))",
  "if(m.type==='file'&&/\\.(xlsx|xls|csv)$/i.test(String(m.fileName||''))&&global.__BC_FRESH_WAITING===true)"
);

// Explicit command arms the next Excel upload for BC FRESH.
src=src.replace(
  "if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;",
  "if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;global.__BC_FRESH_WAITING=true;"
);

// After consuming a Fresh Excel, return to normal BC NGAY mode.
src=src.replace(
  "const im=await process(Buffer.from(await r.arrayBuffer()),m.fileName);await reply(e.replyToken,{type:'image',originalContentUrl:im.full,previewImageUrl:im.preview})",
  "const im=await process(Buffer.from(await r.arrayBuffer()),m.fileName);global.__BC_FRESH_WAITING=false;await reply(e.replyToken,{type:'image',originalContentUrl:im.full,previewImageUrl:im.preview})"
);

const runtime=new Module(path.join(__dirname,'bc_fresh_runtime_compiled.js'),module);
runtime.filename=path.join(__dirname,'bc_fresh_runtime_compiled.js');
runtime.paths=module.paths;
runtime._compile(src,runtime.filename);
module.exports=runtime.exports;
