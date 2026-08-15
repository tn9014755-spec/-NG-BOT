// BC FRESH runtime wrapper.
// Fixes: reply immediately before long Excel/Puppeteer work, use push message for final image,
// and normalize XLSX Sheets because wb.Sheets is an object, not an iterable.
const fs=require('fs');
const path=require('path');
const Module=require('module');
const sourceFile=path.join(__dirname,'bc_fresh_bot.js');
let src=fs.readFileSync(sourceFile,'utf8');

src=src.replace(/process\.env\.LINE_CHANNEL_ACCESS_TOKEN/g,"globalThis.process?.env?.LINE_CHANNEL_ACCESS_TOKEN");
src=src.replace(/process\.env\.LINE_ACCESS_TOKEN/g,"globalThis.process?.env?.LINE_ACCESS_TOKEN");
src=src.replace(/process\.env\.RENDER_EXTERNAL_URL/g,"globalThis.process?.env?.RENDER_EXTERNAL_URL");
src=src.replace(/process\.env\.PUBLIC_BASE_URL/g,"globalThis.process?.env?.PUBLIC_BASE_URL");

// Keep LINE helper safe and add pushMessage for results produced after the reply token expires.
src=src.replace(/async function line\(u,o=\{\}\)\{[\s\S]*?\}async function reply\(t,m\)\{[\s\S]*?\}\nconst val/,
"async function line(u,o={}){return fetch(u,{...o,headers:{Authorization:'Bearer '+TOKEN,...(o.headers||{})}})}async function reply(t,m){if(!TOKEN||!t)return;const a=Array.isArray(m)?m:[m],r=await line(API+'/message/reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({replyToken:t,messages:a.slice(0,5)})});if(!r.ok)console.error('BC FRESH REPLY',r.status,await r.text())}async function pushMessage(to,m){if(!TOKEN||!to)return;const a=Array.isArray(m)?m:[m],r=await line(API+'/message/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,messages:a.slice(0,5)})});if(!r.ok)console.error('BC FRESH PUSH',r.status,await r.text())}
const val");

// SheetJS exposes workbook.Sheets as an object keyed by sheet name.
src=src.replace("for(const ws of wb.Sheets)","for(const ws of Object.values(wb.Sheets||{}))");

// Register FRESH before legacy BC NGAY.
src=src.replace("return op.call(this,route,handlers[0],fresh,...handlers.slice(1))","return op.call(this,route,fresh,...handlers)");

// BC FRESH command is an ARM command only.
src=src.replace(
"if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;if(fs.existsSync(IMG)){await reply(e.replyToken,{type:'image',originalContentUrl:BASE+'/bc-fresh.png?'+Date.now(),previewImageUrl:BASE+'/bc-fresh-preview.png?'+Date.now()})}else if(fs.existsSync(XLS)){const im=await process(fs.readFileSync(XLS),((()=>{try{return JSON.parse(fs.readFileSync(META,'utf8')).fileName}catch{return'Excel cũ'}})()));await reply(e.replyToken,{type:'image',originalContentUrl:im.full,previewImageUrl:im.preview})}else await reply(e.replyToken,{type:'text',text:'📭 Chưa có file BC FRESH.'})}",
"if(m.type==='text'&&/^BC\\s+FRESH$/i.test(String(m.text||'').trim())){used=true;globalThis.__BC_FRESH_WAITING=true;await reply(e.replyToken,{type:'text',text:'✅ Đã nhận lệnh BC FRESH.\\n📎 Anh gửi FILE EXCEL tiếp theo, em sẽ làm BC FRESH bằng HÌNH ẢNH.'})}"
);

// Only the next Excel/CSV upload after BC FRESH is armed belongs to FRESH.
src=src.replace("if(m.type==='file'&&/\\.(xlsx|xls|csv)$/i.test(String(m.fileName||''))){used=true;const r=await line(DATA_API+'/message/'+encodeURIComponent(m.id)+'/content');if(!r.ok)throw Error('LINE tải file lỗi '+r.status);const im=await process(Buffer.from(await r.arrayBuffer()),m.fileName);await reply(e.replyToken,{type:'image',originalContentUrl:im.full,previewImageUrl:im.preview})}",
"if(m.type==='file'&&/\\.(xlsx|xls|csv)$/i.test(String(m.fileName||''))&&globalThis.__BC_FRESH_WAITING===true){used=true;const to=e.source?.userId||e.source?.groupId||e.source?.roomId;await reply(e.replyToken,{type:'text',text:'⏳ Đã nhận file Excel. Em đang xử lý BC FRESH, chờ em một chút...'});try{const r=await line(DATA_API+'/message/'+encodeURIComponent(m.id)+'/content');if(!r.ok)throw Error('LINE tải file lỗi '+r.status);const im=await process(Buffer.from(await r.arrayBuffer()),m.fileName);globalThis.__BC_FRESH_WAITING=false;await pushMessage(to,{type:'image',originalContentUrl:im.full+'?'+Date.now(),previewImageUrl:im.preview+'?'+Date.now()})}catch(err){globalThis.__BC_FRESH_WAITING=false;console.error('BC FRESH PROCESS',err);await pushMessage(to,{type:'text',text:'❌ BC FRESH lỗi: '+String(err.message||err).slice(0,180)})}}"
);

// Prevent the outer catch from trying to reuse an expired reply token.
src=src.replace("}catch(err){console.error('BC FRESH ERROR',err);if(!res.headersSent)res.status(200).send('OK')}","}catch(err){globalThis.__BC_FRESH_WAITING=false;console.error('BC FRESH ERROR',err);if(!res.headersSent)res.status(200).send('OK')}");

const runtime=new Module(path.join(__dirname,'bc_fresh_runtime_compiled.js'),module);
runtime.filename=path.join(__dirname,'bc_fresh_runtime_compiled.js');
runtime.paths=module.paths;
runtime._compile(src,runtime.filename);
module.exports=runtime.exports;
