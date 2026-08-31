const express=require("express"),crypto=require("crypto"),fs=require("fs"),path=require("path");
const report=require("./bc_report"),meeting=require("./meeting_reminder"),ca=require("./ca-hom-nay");
const XLSX=require("xlsx");
const {buildData}=require("./bc_report_adapter");
const {downloadTemplate,applyTemplate,putJson,putLocalJson,readLocalJson,latestLocalJson,readJson,latestJson,hasDriveCredentials}=require("./bc_drive");
const {buildBCFlex}=require("./bc-flex");
const {createFreshAI}=require("./fresh_ai");
const {buildFreshHtml}=require("./fresh_html");
const app=express(),PORT=process.env.PORT||10000;
const SECRET=process.env.LINE_CHANNEL_SECRET||process.env.LINE_SECRET||"",TOKEN=process.env.LINE_CHANNEL_ACCESS_TOKEN||process.env.LINE_ACCESS_TOKEN||"";
const API="https://api.line.me/v2/bot",DATA_API="https://api-data.line.me/v2/bot",STATE=path.join(__dirname,"data","bc_report","session.json");
fs.mkdirSync(path.dirname(STATE),{recursive:true});
function state(){try{return JSON.parse(fs.readFileSync(STATE,"utf8"))}catch{return{active:false}}}
function saveState(x){fs.writeFileSync(STATE,JSON.stringify(x,null,2))}
function line(url,opt={}){return fetch(url,{...opt,headers:{Authorization:"Bearer "+TOKEN,...(opt.headers||{})}})}
function cleanMessages(messages){return(Array.isArray(messages)?messages:[messages]).filter(m=>m&&typeof m==="object"&&typeof m.type==="string"&&m.type.trim()).slice(0,5)}
function tagAnh(text,userId){text=String(text||"");if(!userId)return{type:"text",text};return{type:"text",text:"@Anh "+text,mention:{mentionees:[{index:0,length:4,userId}]}}}
function splitTextForLine(text,userId){
 text=String(text||"").trim(); if(!text)return [];
 const max=4700, parts=[];
 while(text.length>max&&parts.length<4){
  let cut=text.lastIndexOf("\n",max); if(cut<Math.floor(max*0.6))cut=text.lastIndexOf(" ",max); if(cut<1)cut=max;
  parts.push(tagAnh(text.slice(0,cut).trim(),userId)); text=text.slice(cut).trim();
 }
 parts.push(tagAnh(text.slice(0,max),userId)); return parts.slice(0,5);
}
async function reply(token,messages){if(!TOKEN||!token)return false;const ms=cleanMessages(messages);if(!ms.length)return false;const r=await line(API+"/message/reply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({replyToken:token,messages:ms})});console.log("📤 LINE REPLY",r.status);if(!r.ok)console.error(await r.text());return r.ok}
async function push(to,messages){if(!TOKEN||!to)return false;const ms=cleanMessages(messages);if(!ms.length)return false;const r=await line(API+"/message/push",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to,messages:ms})});console.log("📤 LINE PUSH",r.status);if(!r.ok)console.error("LINE PUSH ERROR:",await r.text());return r.ok}
const GEMINI_KEY=process.env.GEMINI_API_KEY||"";
const GEMINI_MODEL=process.env.GEMINI_MODEL||"gemini-3.6-flash";
const GEMINI_SYSTEM="Bạn là NG-BOT, trợ lý AI tiếng Việt đa năng và thân thiện của anh. Em không chỉ làm báo cáo: em có thể hỗ trợ phân tích dữ liệu, bán lẻ, FMCG, FRESH, ngành hàng, doanh thu, hao hụt, tồn kho, vận hành siêu thị, lập kế hoạch, quản lý công việc, Excel, công nghệ, LINE Bot, lập trình, kiến thức phổ thông và giải thích vấn đề theo yêu cầu. Luôn ưu tiên trả lời có chiều sâu khi anh cần, nhưng vẫn đi thẳng vào vấn đề. Khi có nhiều cách xử lý, hãy nêu phương án tốt nhất trước rồi mới nói các lựa chọn khác. Khi phân tích số liệu, phải đọc kỹ dữ liệu được cung cấp, tìm xu hướng, bất thường, nguyên nhân khả dĩ, rủi ro và hành động đề xuất; phân biệt rõ SỐ LIỆU THỰC TẾ với NHẬN ĐỊNH hoặc SUY LUẬN. Không bịa kết quả, không bịa nguồn, không nói đã thực hiện việc khi chưa có dữ liệu hoặc log xác nhận. Khi có dữ liệu báo cáo, phải bám đúng số liệu và không tự thay thế bằng kiến thức chung. Nếu thiếu dữ liệu quan trọng, nói rõ đang thiếu gì. Với kiến thức chung có thể trả lời bằng hiểu biết của mô hình; với thông tin thời sự, giá cả, trạng thái dịch vụ hoặc sự kiện mới nhất mà không có dữ liệu cập nhật, phải nói rõ giới hạn cập nhật thay vì khẳng định chắc chắn. Xưng em và gọi người dùng là anh. Ghi nhớ ngữ cảnh trong nội dung cuộc trò chuyện và dữ liệu được hệ thống cung cấp; không yêu cầu anh gửi lại thứ đã có trong ngữ cảnh hiện tại. QUAN TRỌNG VỀ ĐỊNH DẠNG: trả lời bằng văn bản thuần, TUYỆT ĐỐI không dùng markdown. Không dùng ** để in đậm, không dùng * hoặc - đầu dòng, không dùng # làm tiêu đề, không dùng bảng. LINE hiển thị nguyên các ký tự đó nên rất xấu. Muốn nhấn mạnh thì viết IN HOA hoặc dùng emoji. Danh sách thì mỗi ý một dòng, mở đầu bằng emoji hoặc số thứ tự. Khi câu trả lời dài, chia thành các đoạn ngắn có tiêu đề rõ ràng để không bị rối. QUAN TRỌNG VỀ THỜI GIAN: ngày giờ hiện tại luôn được hệ thống truyền trực tiếp trong từng câu hỏi. Tuyệt đối không dùng ngày tháng từ trí nhớ, dữ liệu huấn luyện hay tự suy đoán. Khi người dùng nói hôm nay, hôm qua, ngày mai, tuần này hoặc năm nay thì phải tính dựa trên THỜI GIAN HỆ THỐNG được cung cấp. Nếu hệ thống không cung cấp thời gian thì phải nói không xác định, không được đoán.";
function latestReportContext(){
 const parts=[];
 try{const s=state();if(s.lastReportData)parts.push("DỮ LIỆU BC SỨC KHỎE MỚI NHẤT:\n"+JSON.stringify(s.lastReportData))}catch(e){console.warn("⚠️ Không đọc được BC đã gửi cho AI:",e.message)}
 try{const local=latestLocalJson();if(local?.data)parts.push("DỮ LIỆU BC LOCAL MỚI NHẤT:\n"+JSON.stringify(local.data))}catch(e){console.warn("⚠️ Không đọc được BC local cho AI:",e.message)}
 return parts.join("\n\n").slice(0,30000);
}
function formatReportForAI(data){try{return "DỮ LIỆU BC NGÀY MỚI NHẤT (JSON GỐC):\n"+JSON.stringify(data||{}).slice(0,30000)}catch{return ""}}
function vietnamNowContext(){
 const now=new Date();
 const parts=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",weekday:"long",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(now);
 const o={}; for(const p of parts)if(p.type!=="literal")o[p.type]=p.value;
 return "THỜI GIAN HỆ THỐNG HIỆN TẠI (MÚI GIỜ VIỆT NAM, Asia/Ho_Chi_Minh): "+(o.weekday||"")+" "+(o.day||"")+"/"+(o.month||"")+"/"+(o.year||"")+" "+(o.hour||"")+":"+(o.minute||"")+":"+(o.second||"")+". ISO: "+(o.year||"")+"-"+(o.month||"")+"-"+(o.day||"")+".";
}
async function askGemini(userText,reportContext=""){
 if(!GEMINI_KEY)throw new Error("Chưa cấu hình GEMINI_API_KEY trên Render");
 const fallbackEnv=String(process.env.GEMINI_FALLBACK_MODELS||"gemini-3.7-flash").split(/[;,]/).map(x=>x.trim()).filter(Boolean);
 const models=[...new Set([GEMINI_MODEL,...fallbackEnv])].slice(0,3);
 const q=String(userText||"");
 const deep=/(phân tích sâu|phân tích đầy đủ|chi tiết toàn bộ|báo cáo đầy đủ|tổng hợp đầy đủ)/i.test(q);
 const fastContext=reportContext?String(reportContext).slice(0,deep?24000:20000):"";
 const timeContext=vietnamNowContext();
 const rules="\n\n"+timeContext+"\nQUY TẮC BẮT BUỘC: Đây là nguồn thời gian duy nhất. Không được thay thế bằng ngày tháng từ trí nhớ. Với câu hỏi về hôm nay/hôm qua/ngày mai phải quy đổi từ thời gian này. Nếu người dùng chỉ hỏi ngày hiện tại, trả lời đúng ngày hệ thống và không phân tích báo cáo không liên quan.";
 const prompt=fastContext
  ?"YÊU CẦU CỦA ANH:\n"+q+"\n\n"+fastContext+rules+"\n\nTrả lời trực tiếp bằng tiếng Việt, bám đúng số liệu. Nếu chỉ hỏi một chỉ số/ngành hàng thì trả lời ngắn gọn. Nếu yêu cầu phân tích thì nêu kết luận trước, sau đó số liệu và hành động. Không bịa số liệu, không kết thúc dang dở."
  :"YÊU CẦU CỦA ANH:\n"+q+rules;
 const outputLimit=deep?8192:4096;
 const perCallMs=Number(process.env.GEMINI_TIMEOUT_MS||12000);
 const deadline=Date.now()+Number(process.env.GEMINI_TOTAL_BUDGET_MS||30000);
 let lastErr;
 for(const model of models){
  for(let attempt=0;attempt<2;attempt++){
   const remain=deadline-Date.now();
   if(remain<=1500){console.warn("⏱️ GEMINI đã hết ngân sách thời gian, dừng thử model");lastErr=lastErr||new Error("Gemini quá hạn thời gian");break}
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),Math.min(perCallMs,remain));
   try{
    const url="https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent?key="+encodeURIComponent(GEMINI_KEY);
    const body={system_instruction:{parts:[{text:GEMINI_SYSTEM}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:outputLimit,temperature:0.3}};
    const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error("Gemini "+r.status+" "+(j.error?.message||"request failed"));e.status=r.status;throw e}
    const cand=(j.candidates||[])[0]||{};
    const out=(cand.content?.parts||[]).map(x=>x.text||"").join("").trim();
    if(!out)throw new Error("Gemini trả lời rỗng");
    return out.slice(0,30000);
   }catch(err){
    lastErr=err;
    console.warn("⚠️ GEMINI",model,"lần",attempt+1,err.message);
    const retryable=[500,502,504].includes(err.status);
    if(retryable&&attempt===0){await new Promise(r=>setTimeout(r,500));continue}
    break;
   }finally{clearTimeout(timer)}
  }
 }
 throw lastErr||new Error("Gemini không trả về nội dung");
}
const freshAI=createFreshAI({askAI:askGemini,dataDir:"/tmp/fresh"});

async function checkMeetingReminders(){for(const m of meeting.due()){console.log(`⏰ MEETING → Gửi nhắc: ${m.content} | ${m.date} ${m.hour}h${String(m.minute).padStart(2,"0")}`);const uid=m.userId||"";const ok=await push(m.target,tagAnh(`⏰ NHẮC LỊCH\n\n📝 ${m.content}\n🕐 ${String(m.hour).padStart(2,"0")}h${String(m.minute).padStart(2,"0")}\n📆 ${m.date}`,uid));if(!ok)console.warn(`⚠️ NHẮC LỊCH → LINE gửi thất bại: ${m.id}`)}}
async function saveBCPersistence(name,data){try{putLocalJson(name,data)}catch(e){console.error(`❌ LOCAL BC WRITE ERROR → ${name}:`,e.message)}if(hasDriveCredentials()){Promise.resolve().then(()=>putJson(name,data)).catch(e=>console.warn(`⚠️ DRIVE BC WRITE FAILED → ${name}: ${e.message}`))}else console.log(`ℹ️ DRIVE BC BACKGROUND SKIP → chưa có Google credentials | ${name}`)}
function bcStep(label,start){console.log(`📊 BC STEP → ${label} | +${Date.now()-start}ms`)}
async function buildAndStore(){
 const start=Date.now();
 bcStep("BẮT ĐẦU buildData",start);
 const data=buildData();
 bcStep("XONG buildData",start);
 const date=String(data.ngay.nhan).split("/").reverse().join("-");
 const name=`bc-${date}.json`;

 // Lưu dữ liệu trước. LINE hoặc template lỗi cũng không làm mất BC đã tính xong.
 bcStep("BẮT ĐẦU lưu JSON",start);
 await saveBCPersistence(name,data);
 bcStep("XONG lưu JSON",start);

 // Không tải template ở luồng gửi LINE.
 // Trang HTML sẽ tải template khi người dùng bấm mở trang, tránh BC bị nghẽn vì mạng/Google Drive.
 const html="";
 bcStep("BỎ QUA template khi gửi BC",start);

 const prev=state();
 saveState({...prev,lastReportData:data,lastReportDate:date,lastReportType:"BC SỨC KHỎE",lastReportSavedAt:new Date().toISOString()});
 bcStep("HOÀN TẤT dựng BC",start);
 return{data,date,html}
}
async function sendBC(target,userId,replyToken=""){
 const start=Date.now();
 const out=await buildAndStore();
 bcStep("BẮT ĐẦU dựng Flex",start);
 const card=buildBCFlex(out.data);

 // Ưu tiên REPLY để không dùng quota Push. Reply token chỉ dùng được một lần,
 // nên luồng gọi hàm này không được gửi tin "đang xử lý" trước đó.
 const useReply=!!replyToken;
 bcStep(useReply?"BẮT ĐẦU REPLY LINE":"BẮT ĐẦU PUSH LINE",start);
 const ok=useReply?await reply(replyToken,card):await push(target,card);
 bcStep(ok?(useReply?"REPLY LINE THÀNH CÔNG":"PUSH LINE THÀNH CÔNG"):(useReply?"REPLY LINE THẤT BẠI":"PUSH LINE THẤT BẠI"),start);
 if(!ok){
  const err=new Error((useReply?"LINE REPLY":"LINE PUSH")+" BC thất bại (BC đã được lưu)");
  err.bcStored=true;
  throw err;
 }
 return out
}
function noReport(res){return res.status(404).type("html").send(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BC SỨC KHỎE</title><body style="font-family:Arial;background:#eef3f8;padding:30px"><div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;padding:24px"><h2>Chưa có báo cáo</h2><p>Chưa có báo cáo cho ngày này.</p></div></body></html>`)}
function validDate(s){return/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(new Date(`${s}T00:00:00`))}
async function serveData(res,data){if(!data)return noReport(res);try{res.type("html").send(applyTemplate(await downloadTemplate(),data))}catch(e){console.error("❌ BC VIEW ERROR",e);res.status(500).send("Không tải được khuôn mẫu báo cáo.")}}
app.use((req,res,next)=>{if(req.path==="/webhook"){let b=[];req.on("data",c=>b.push(c));req.on("end",()=>{req.rawBody=Buffer.concat(b);try{req.body=JSON.parse(req.rawBody.toString("utf8")||"{}")}catch(err){console.error("WEBHOOK JSON ERROR",err);req.body={}}next()})}else next()});
app.get("/",(_,res)=>res.send("NG-BOT READY - NẠP DỮ LIỆU / DATA / LỊCH HỌP / PING"));
app.get("/health",(_,res)=>res.json({ok:true,bot:"NG-BOT",token:!!TOKEN,secret:!!SECRET,timezone:meeting.TZ,meetings:meeting.list().length}));
app.get("/bc/moi-nhat",async(_,res)=>{try{const local=latestLocalJson();if(local)return serveData(res,local.data);const x=await latestJson();await serveData(res,x&&x.data)}catch(e){console.error("❌ BC LATEST ERROR",e);noReport(res)}});
app.get("/bc/:date",async(req,res)=>{const date=req.params.date;if(date==="moi-nhat")return res.redirect("/bc/moi-nhat");if(!validDate(date))return noReport(res);try{const local=readLocalJson(`bc-${date}.json`);if(local)return serveData(res,local);await serveData(res,await readJson(`bc-${date}.json`))}catch(e){console.error(`❌ BC ${date} ERROR`,e);noReport(res)}});
function noFresh(res){
  return res.status(404).type("html").send('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BC FRESH</title><body style="font-family:Arial;background:#eef2ed;padding:30px"><div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;padding:24px"><h2>Chưa có BC FRESH</h2><p>Anh gõ NẠP FRESH và gửi file Excel FRESH.</p></div></body></html>');
}
app.get("/fresh/moi-nhat",async(_,res)=>{
  try{
    const x=freshAI.getLatest();
    if(!x)return noFresh(res);
    res.type("html").send(buildFreshHtml(x.data));
  }catch(e){
    console.error("❌ FRESH LATEST ERROR",e);
    noFresh(res);
  }
});
app.get("/fresh/:date",async(req,res)=>{
  const date=req.params.date;
  if(date==="moi-nhat")return res.redirect("/fresh/moi-nhat");
  if(!validDate(date))return noFresh(res);
  try{
    const x=freshAI.getByDate(date);
    if(!x)return noFresh(res);
    res.type("html").send(buildFreshHtml(x.data));
  }catch(e){
    console.error("❌ FRESH "+date+" ERROR",e);
    noFresh(res);
  }
});
app.get("/report.html",(_,res)=>res.redirect("/bc/moi-nhat"));
function laFileLichCa(buf){try{const wb=XLSX.read(buf,{type:"buffer",cellDates:false});const ws=wb.Sheets[wb.SheetNames[0]];if(!ws)return false;const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});const dayRe=/\(\s*\d{1,2}\s*\/\s*\d{1,2}\s*\)/,caRe=/^ca\s*[1-6]$/i;let coNgay=false,coCa=false;for(let r=0;r<Math.min(rows.length,20);r++){const row=rows[r]||[];if(row.some(x=>dayRe.test(String(x??""))))coNgay=true;if(row.some(x=>caRe.test(String(x??""))))coCa=true;if(coNgay&&coCa)return true}return false}catch(e){console.warn("⚠️ Không kiểm tra được loại file lịch ca:",e.message);return false}}
async function xuLyFileLichCa(buf,fileName,replyToken,userId){try{const wb=XLSX.read(buf,{type:"buffer"});const ws=wb.Sheets[wb.SheetNames[0]];if(!ws)throw new Error("File không có sheet đầu");const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});const lich=ca.docLichCa(rows);const kq=ca.luuLich(lich);console.log(`✅ LỊCH CA → ${fileName}: ${kq.soNgayMoi} ngày ${kq.tuNgay} → ${kq.denNgay}, tổng ${kq.soNgayTong}`);await reply(replyToken,tagAnh(`✅ ĐÃ NHẬN LỊCH CA\n📅 ${kq.soNgayMoi} ngày, từ ${kq.tuNgay} đến ${kq.denNgay}.\n📊 Tổng đang giữ ${kq.soNgayTong} ngày.`,userId));return true}catch(e){console.error("❌ LỊCH CA FILE ERROR",e);await reply(replyToken,tagAnh("❌ File lịch ca lỗi: "+String(e.message||e).slice(0,180),userId));return true}}
function ngayTheoLenhCa(t,d){const now=new Date();if(t==="CA HOM NAY")return new Date(now.getFullYear(),now.getMonth(),now.getDate());if(t==="CA MAI"){const x=new Date(now.getFullYear(),now.getMonth(),now.getDate());x.setDate(x.getDate()+1);return x}const m=t.match(/^CA\s+(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?$/);if(!m)return null;return new Date(Number(m[3]||now.getFullYear()),Number(m[2])-1,Number(m[1]))}
app.post("/webhook",async(req,res)=>{const b=req.rawBody||Buffer.from(JSON.stringify(req.body||{})),sig=req.get("x-line-signature")||"";if(SECRET){const h=crypto.createHmac("sha256",SECRET).update(b).digest("base64");if(!sig||sig.length!==h.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(h)))return res.status(401).send("invalid signature")}res.status(200).send("OK");if(!TOKEN)return;for(const e of req.body?.events||[]){if(!e.replyToken||e.mode==="standby")continue;const target=e.source?.groupId||e.source?.roomId||e.source?.userId||"",userId=e.source?.userId||"",m=e.message||{};if(m.type==="text"){const raw=String(m.text||"").trim();
const isGroup=!!(e.source?.groupId||e.source?.roomId);
const BOT_USER_ID=String(process.env.LINE_BOT_USER_ID||"").trim();
const mentionees=Array.isArray(m.mention?.mentionees)?m.mention.mentionees:[];
// CHỈ coi là gọi bot khi tag đúng NG-BOT. Không còn coi @All hoặc tag người khác là gọi bot.
const hasExactBotMention=!!BOT_USER_ID&&mentionees.some(x=>String(x?.userId||"")===BOT_USER_ID);
const hasBotNameMention=!BOT_USER_ID&&/@\s*TRỢ\s*LÝ\s*-?\s*AI\b/i.test(raw);
const hasBotMention=hasExactBotMention||hasBotNameMention;
if(isGroup&&!hasBotMention)continue;const commandRaw=raw.replace(/@\s*TRỢ\s*LÝ\s*-?\s*AI/ig," ").trim();const t=commandRaw.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");if(hasBotMention){const mt=meeting.add(commandRaw,target,userId);if(mt){console.log(`📅 NHẮC LỊCH → Ghi: ${mt.content} | ${mt.date} ${mt.hour}h${String(mt.minute).padStart(2,"0")} | user=${userId} | group=${target}`);await reply(e.replyToken,tagAnh(meeting.format(mt),userId));continue}}if(t==="LAY LICH CA"){try{const lich=ca.docLich();const days=Object.keys(lich).sort();if(!days.length){await reply(e.replyToken,tagAnh("📋 Chưa có lịch ca đã lưu. Anh gửi file lịch phân ca trước nhé.",userId));continue}const first=days[0],last=days[days.length-1],today=new Date(),todayKey=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`,view=ca.theCaNgay(lich,new Date(todayKey+"T00:00:00"));await reply(e.replyToken,[tagAnh(`📋 LỊCH CA ĐÃ LƯU\n📅 ${first} → ${last}\n📊 ${days.length} ngày\n\nĐang xem lịch hôm nay:`,userId),view])}catch(err){console.error("❌ LẤY LỊCH CA",err);await reply(e.replyToken,tagAnh("❌ Không đọc được lịch ca đã lưu.",userId))}continue}
const ngayCa=ngayTheoLenhCa(t);if(ngayCa){try{const lich=ca.docLich();console.log(`📋 LỆNH CA → ${t} → ${ngayCa.toISOString().slice(0,10)}`);await reply(e.replyToken,ca.theCaNgay(lich,ngayCa))}catch(err){console.error("❌ LỆNH CA",err);await reply(e.replyToken,tagAnh("❌ Không đọc được lịch ca.",userId))}continue}
if(t==="PING"){await reply(e.replyToken,{type:"text",text:"✅ BOT ĐÃ KẾT NỐI"});continue}
// 🌿 Lệnh FRESH phải nhận trực tiếp, không phụ thuộc tag khi chat riêng.
if(freshAI.isFreshCommand(commandRaw)){try{const freshResult=await freshAI.handleText({text:commandRaw,userId});const freshMessages=(freshResult.messages||[]).map(x=>typeof x==="string"?tagAnh(x,userId):x);await reply(e.replyToken,freshMessages);continue}catch(err){console.error("❌ FRESH AI TEXT ERROR",err);await reply(e.replyToken,tagAnh("❌ FRESH AI lỗi: "+String(err.message||err).slice(0,180),userId));continue}}
try{const freshResult=await freshAI.handleText({text:commandRaw,userId});if(freshResult.handled){const freshMessages=(freshResult.messages||[]).map(x=>typeof x==="string"?tagAnh(x,userId):x);await reply(e.replyToken,freshMessages);continue}}catch(err){console.error("❌ FRESH AI TEXT ERROR",err);await reply(e.replyToken,tagAnh("❌ FRESH AI lỗi: "+String(err.message||err).slice(0,180),userId));continue}
if(!["BC","DATA","NAP DU LIEU"].includes(t)){
 if(!hasBotMention)continue;
 try{
  const reportContext=latestReportContext()||"";
  // Không gửi tin "đang phân tích" trước: replyToken chỉ dùng được một lần.
  // Chờ AI xong rồi trả lời trực tiếp bằng REPLY để không phụ thuộc quota PUSH.
  console.log("🤖 AI STEP → BẮT ĐẦU phân tích");
  const ai=await askGemini(commandRaw,reportContext);
  console.log("🤖 AI STEP → XONG, gửi LINE REPLY");
  const sent=await reply(e.replyToken,splitTextForLine(ai,userId));
  if(!sent)console.error("❌ Không reply được kết quả AI");
 }catch(err){
  console.error("❌ GEMINI ERROR",err);
  await reply(e.replyToken,tagAnh("❌ AI chưa trả lời được: "+String(err.message||err).slice(0,180)+"\n\nAnh thử lại sau ít phút hoặc hỏi ngắn hơn nhé.",userId));
 }
 continue
}if(t==="NAP DU LIEU"){report.resetPending();saveState({active:true,startedAt:new Date().toISOString()});console.log("📥 DATA SPECIALIST → Mở phiên NẠP DỮ LIỆU");await reply(e.replyToken,{type:"text",text:"📥 ĐÃ SẴN SÀNG NẠP DỮ LIỆU\n\nAnh gửi 2 file Excel.\nBot sẽ nhận đủ 2 file → kiểm tra số liệu → tạo BC và lưu Drive."});continue}if(t==="DATA"||t==="BC"){try{console.log("📊 DATA SPECIALIST → DATA/BC được yêu cầu");if(typeof report.promote==="function")report.promote();if(!report.hasData()){await reply(e.replyToken,{type:"text",text:"📭 Chưa có BC gần nhất. Anh gõ NẠP DỮ LIỆU và gửi 2 file."});continue}await sendBC(target,userId,e.replyToken)}catch(err){
 console.error("❌ DATA ERROR",err);
 if(err&&err.bcStored){
  console.warn("⚠️ BC ĐÃ LƯU NHƯNG LINE KHÔNG GỬI ĐƯỢC");
 }else{
  // Nếu lỗi trước khi Reply, vẫn ưu tiên dùng replyToken còn lại.
  await reply(e.replyToken,tagAnh("❌ DATA lỗi: "+String(err.message||err).slice(0,180),userId));
 }
}continue}}if(m.type==="file"){const name=String(m.fileName||"").toLowerCase();if(!/\.(xlsx|xls|csv)$/.test(name)){await reply(e.replyToken,tagAnh("⚠️ Chỉ nhận file Excel/CSV.",userId));continue}try{console.log("📎 FILE → Nhận:",m.fileName);const r=await fetch(DATA_API+"/message/"+encodeURIComponent(m.id)+"/content",{headers:{Authorization:"Bearer "+TOKEN}});if(!r.ok)throw new Error("LINE download "+r.status);const buf=Buffer.from(await r.arrayBuffer());if(laFileLichCa(buf)){await xuLyFileLichCa(buf,m.fileName,e.replyToken,userId);continue}const freshFileResult=await freshAI.handleFile({buffer:buf,fileName:m.fileName,userId});if(freshFileResult.handled){const freshMessages=(freshFileResult.messages||[]).map(x=>typeof x==="string"?tagAnh(x,userId):x);await reply(e.replyToken,freshMessages);continue}const st=state();if(!st.active){await reply(e.replyToken,tagAnh("📥 Anh gõ NẠP DỮ LIỆU trước, rồi gửi 2 file Excel nhé.",userId));continue}const got=report.ingest(buf,m.fileName||("DATA_"+Date.now()+".xlsx"));console.log(`🔎 DATA CHECK → ${got.type} | đủ 2 file: ${got.ready}`);if(!got.ready){await reply(e.replyToken,tagAnh(`✅ Đã nhận file ${got.type==="store"?"DOANH THU SIÊU THỊ":"NGÀNH HÀNG"}\n\n📎 Còn thiếu 1 file nữa.`,userId));continue}if(!report.promote())throw new Error("Không lưu được đủ 2 file dữ liệu");await sendBC(target,userId,e.replyToken);const prevState=state();saveState({...prevState,active:false,readyAt:new Date().toISOString()});console.log("✅ VALIDATION → Số liệu + BC đã lưu Drive")}catch(err){
 console.error("❌ FILE ERROR",err);
 if(err&&err.bcStored){
  console.warn("⚠️ FILE → BC ĐÃ LƯU NHƯNG LINE KHÔNG GỬI ĐƯỢC");
 }else{
  // File vẫn còn replyToken nếu chưa gửi được phản hồi trước đó.
  await reply(e.replyToken,tagAnh("❌ Xử lý file lỗi: "+String(err.message||err).slice(0,180),userId));
 }
}}}});
app.listen(PORT,()=>{console.log("NG-BOT READY PORT "+PORT);console.log("⚡ BC HOT PATH: buildData → lưu JSON → Flex → LINE REPLY (ưu tiên không dùng Push quota)");console.log("🎨 BC UI: GOOGLE DRIVE TEMPLATE");console.log("🕐 TIMEZONE:",meeting.TZ);console.log("🤖 GEMINI:",GEMINI_MODEL,"| API KEY:",GEMINI_KEY?"OK":"MISSING");setInterval(checkMeetingReminders,60000);checkMeetingReminders().catch(console.error)});
                                                                                               
