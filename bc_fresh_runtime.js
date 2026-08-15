// Runtime compatibility wrapper for BC FRESH.
// Fixes the generated BC FRESH module before Node compiles it.
const fs=require('fs');
const path=require('path');
const Module=require('module');
const sourceFile=path.join(__dirname,'bc_fresh_bot.js');
let src=fs.readFileSync(sourceFile,'utf8');

// Fix the malformed fetch() line in the generated module.
src=src.replace(
  "return fetch(u,{...o,headers:{Authorization:'Bearer '+TOKEN,...(o.headers||{})})}",
  "return fetch(u,{...o,headers:{Authorization:'Bearer '+TOKEN,...(o.headers||{})}}) }"
);

// Keep BC NGAY's normal file flow intact. BC FRESH is selected only by an explicit
// BC FRESH command; do not let the FRESH handler consume every Excel file.
src=src.replace(
  "if(m.type==='file'&&/\\.(xlsx|xls|csv)$/i.test(String(m.fileName||'')))",
  "if(m.type==='file'&&/\\.(xlsx|xls|csv)$/i.test(String(m.fileName||''))&&global.__BC_FRESH_WAITING===true)"
);

// When BC FRESH is explicitly requested, allow the next Excel upload to be routed
// to FRESH. The command itself still returns the saved BC FRESH image when available.
src=src.replace(
  "if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;",
  "if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;global.__BC_FRESH_WAITING=true;"
);

// Once a Fresh Excel is consumed, return the router to normal BC NGAY mode.
src=src.replace(
  "const im=await process(Buffer.from(await r.arrayBuffer()),m.fileName);await reply(e.replyToken,{type:'image',originalContentUrl:im.full,previewImageUrl:im.preview})",
  "const im=await process(Buffer.from(await r.arrayBuffer()),m.fileName);global.__BC_FRESH_WAITING=false;await reply(e.replyToken,{type:'image',originalContentUrl:im.full,previewImageUrl:im.preview})"
);

const runtime=new Module(path.join(__dirname,'bc_fresh_runtime_compiled.js'),module);
runtime.filename=path.join(__dirname,'bc_fresh_runtime_compiled.js');
runtime.paths=module.paths;
runtime._compile(src,runtime.filename);
module.exports=runtime.exports;
