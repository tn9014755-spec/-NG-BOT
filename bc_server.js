const express=require('express');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const bcNgay=require('./bc_ngay');
const bcImage=require('./bc_image');
const app=express();
const PORT=process.env.PORT||10000;
const SECRET=process.env.LINE_CHANNEL_SECRET||process.env.LINE_SECRET||'';
const TOKEN=process.env.LINE_CHANNEL_ACCESS_TOKEN||process.env.LINE_ACCESS_TOKEN||'';
const TARGET=process.env.LINE_TARGET_ID||process.env.LINE_GROUP_ID||'';
const API='https://api.line.me/v2/bot';
const DATA_API='https://api-data.line.me/v2/bot';
const SLOTS=[10,12,14,16,18,20,21];
const STATE=path.join(__dirname,'data','bc_ngay','schedule_state.json');
fs.mkdirSync(path.dirname(STATE),{recursive:true});
let LAST_REPORT='';
function esc(s){return String(s).replace(/[&<>]/g,c=>c==='&'?'&amp;':c==='<'?'&lt;':'>')}
function nowVN(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const o={};for(const x of p)o[x.type]=x.value;return {day:o.year+'-'+o.month+'-'+o.day,hour:+o.hour,min:+o.minute}}
function todayMeta(m,d){if(!m||!m.updatedAt)return false;const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(m.updatedAt));const o={};for(const x of p)o[x.type]=x.value;return (o.year+'-'+o.month+'-'+o.day)===d}
function chunks(t,n=4700){const a=[];let s=String(t||'');while(s.length>n){let p=s.lastIndexOf('\n',n);if(p<100)p=n;a.push(s.slice(0,p));s=s.slice(p).replace(/^\n+/,'')}if(s)a.push(s);return a.slice(0,4)}
function loadState(){try{return JSON.parse(fs.readFileSync(STATE,'utf8'))}catch{return {}}}
function saveState(x){fs.writeFileSync(STATE,JSON.stringify(x,null,2))}
async function line(url,opt={}){return fetch(url,{...opt,headers:{Authorization:'Bearer '+TOKEN,...(opt.headers||{})}})}
async function reply(token,messages){if(!TOKEN||!token)return false;const ms=Array.isArray(messages)?messages:[messages];const r=await line(API+'/message/reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({replyToken:token,messages:ms.slice(0,5)})});console.log('LINE REPLY',r.status);if(!r.ok)console.error(await r.text());return r.ok}
async function push(messages){if(!TOKEN||!TARGET){console.error('LINE PUSH CONFIG MISSING');return false}const ms=Array.isArray(messages)?messages:[messages];const r=await line(API+'/message/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:TARGET,messages:ms.slice(0,5)})});console.log('LINE PUSH',r.status);if(!r.ok)console.error(await r.text());return r.ok}
async function imageMessage(report){try{const url=await bcImage.render(report);return {type:'image',originalContentUrl:url,previewImageUrl:url}}catch(e){console.error('BC IMAGE ERROR',e);return null}}
async function reportMessages(report,withImage=true){const out=[];if(withImage){const img=await imageMessage(report);if(img)out.push(img)}out.push(...chunks(report).map(text=>({type:'text',text})));out.push({type:'text',text:'🔗 LINK BÁO CÁO ĐẦY ĐỦ:\n'+(process.env.RENDER_EXTERNAL_URL||process.env.PUBLIC_BASE_URL||'https://ng-bot-c0im.onrender.com')+'/report'});return out.slice(0,5)}
async function schedule(){try{if(!TOKEN||!TARGET)return;const n=nowVN(),cur=n.hour*60+n.min,st=loadState(),m=bcNgay.meta();for(const h of SLOTS){const start=h*60,key=n.day+'-'+h;if(cur<start||cur>=start+120)continue;const z=st[key]||{};const ready=bcNgay.hasData()&&todayMeta(m,n.day);if(cur===start&&!z.checked){if(ready){await push(await reportMessages(LAST_REPORT||bcNgay.report(),true));z.sent=true}else{await push({type:'text',text:'⏰ BC NGÀY '+String(h).padStart(2,'0')+':00\n📭 CHƯA CÓ DỮ LIỆU\n\nAnh gửi data trong khung 2 tiếng này, bot sẽ tự động BC lên nhóm.'})}z.checked=true;z.meta=m&&m.updatedAt||null;st[key]=z;saveState(st)}else if(ready&&!z.sent&&m&&m.updatedAt&&m.updatedAt!==z.meta){await push(await reportMessages(LAST_REPORT||bcNgay.report(),true));z.sent=true;z.meta=m.updatedAt;st[key]=z;saveState(st)}}}catch(e){console.error('SCHEDULE ERROR',e)}}
app.use((req,res,next)=>{if(req.path==='/webhook'){let b=[];req.on('data',c=>b.push(c));req.on('end',()=>{req.rawBody=Buffer.concat(b);next()})}else next()});
app.get('/',(_,res)=>res.send('BC NGAY BOT READY - EXISTING LINE CHANNEL'));
app.get('/health',(_,res)=>res.json({ok:true,bot:'BC_NGAY',token:!!TOKEN,secret:!!SECRET,target:!!TARGET,data:bcNgay.hasData(),memory:!!LAST_REPORT,image:true}));
app.get('/report',(_,res)=>{if(!bcNgay.hasData()&&!LAST_REPORT)return res.status(404).send('CHUA CO DU LIEU');const text=LAST_REPORT||bcNgay.report();res.type('html').send('<meta name="viewport" content="width=device-width,initial-scale=1"><pre style="white-space:pre-wrap;font:15px system-ui;padding:16px">'+esc(text)+'</pre>')});
bcImage.installRoute(app);
app.post('/webhook',async(req,res)=>{const b=req.rawBody||Buffer.alloc(0);const sig=req.get('x-line-signature')||'';console.log('WEBHOOK RECEIVED bytes='+b.length+' signature='+(sig?'yes':'no'));if(SECRET){const h=crypto.createHmac('sha256',SECRET).update(b).digest('base64');if(!sig||sig.length!==h.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(h)))return res.status(401).send('invalid signature')}res.status(200).send('OK');let p;try{p=JSON.parse(b.toString('utf8'))}catch{return}for(const e of p.events||[]){if(!e.replyToken||e.mode==='standby')continue;const m=e.message||{};if(m.type==='text'){const t=String(m.text||'').trim().toUpperCase().replace(/\s+/g,' ');if(t==='ID'||t==='GROUP ID'||t==='GROUPID'){const s=e.source||{};const id=s.groupId||s.roomId||s.userId||'(không xác định)';const kind=s.groupId?'GROUP':s.roomId?'ROOM':'USER';await reply(e.replyToken,{type:'text',text:'🆔 ID NHÓM\n'+id+'\n\n📌 Loại: '+kind+'\n📋 Copy ID này gửi lại cho em.'});continue}if(t==='BC NGÀY'||t==='BC NGAY'){const report=LAST_REPORT||(bcNgay.hasData()?bcNgay.report():'');if(!report)await reply(e.replyToken,{type:'text',text:'📭 Chưa có data BC NGÀY. Anh gửi file Excel trước nhé.'});else await reply(e.replyToken,await reportMessages(report,true));continue}}
if(m.type==='file'){const name=String(m.fileName||'').toLowerCase();if(!/\.(xlsx|xls|csv)$/.test(name)){await reply(e.replyToken,{type:'text',text:'⚠️ Chỉ nhận file Excel/CSV.'});continue}try{const r=await fetch(DATA_API+'/message/'+encodeURIComponent(m.id)+'/content',{headers:{Authorization:'Bearer '+TOKEN}});if(!r.ok)throw new Error('LINE download '+r.status+' '+await r.text());const buf=Buffer.from(await r.arrayBuffer());bcNgay.saveUpload(buf,m.fileName||('BC_NGAY_'+Date.now()+'.xlsx'));LAST_REPORT=bcNgay.report();console.log('BC NGAY FILE SAVED OK',m.fileName,'report_ready=true');await reply(e.replyToken,await reportMessages(LAST_REPORT,true));await schedule()}catch(err){console.error('FILE ERROR',err);await reply(e.replyToken,{type:'text',text:'❌ File chưa hợp lệ hoặc bot chưa đọc được file. Data cũ vẫn được giữ nguyên.'}).catch(()=>{})}}}});
app.listen(PORT,()=>console.log('BC NGAY BOT READY - EXISTING LINE CHANNEL PORT '+PORT));
setInterval(schedule,30000);setTimeout(schedule,5000);
