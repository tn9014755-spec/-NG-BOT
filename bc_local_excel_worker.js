// Watch the Windows Downloads folder for the newest BC NGAY Excel export.
// When a new/changed Excel appears: save it as latest.xlsx, build BC NGAY,
// render the standard report image, and push that image to the configured LINE target.
const fs=require('fs');
const path=require('path');
const os=require('os');
const bcNgay=require('./bc_ngay');
const bcHtml=require('./bc_html');
const bcImage=require('./bc_image');
const TOKEN=process.env.LINE_CHANNEL_ACCESS_TOKEN||process.env.LINE_ACCESS_TOKEN||'';
const TARGET=process.env.LINE_TARGET_ID||process.env.LINE_GROUP_ID||'';
const API='https://api.line.me/v2/bot';
const BASE=String(process.env.RENDER_EXTERNAL_URL||process.env.PUBLIC_BASE_URL||'https://ng-bot-c0im.onrender.com').replace(/\/$/,'');
const STATE=path.join(__dirname,'data','bc_ngay','local_excel_state.json');
const dirs=[path.join(os.homedir(),'Downloads'),path.join(os.homedir(),'OneDrive','Downloads')];
let busy=false;
function state(){try{return JSON.parse(fs.readFileSync(STATE,'utf8'))}catch{return {}}}
function saveState(x){fs.mkdirSync(path.dirname(STATE),{recursive:true});fs.writeFileSync(STATE,JSON.stringify(x,null,2))}
async function pushImage(){
  if(!TOKEN||!TARGET)throw new Error('Thiếu LINE target/token');
  bcHtml.save();
  const img=await bcImage.render();
  const r=await fetch(API+'/message/push',{method:'POST',headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'},body:JSON.stringify({to:TARGET,messages:[{type:'image',originalContentUrl:img.full+'?'+Date.now(),previewImageUrl:img.preview+'?'+Date.now()}]})});
  if(!r.ok)throw new Error('LINE PUSH '+r.status+' '+await r.text());
  console.log('BC NGAY LOCAL EXCEL -> LINE OK');
}
function newest(){
  const out=[];
  for(const dir of dirs){try{for(const name of fs.readdirSync(dir)){if(!/\.(xlsx|xls|csv)$/i.test(name))continue;const p=path.join(dir,name);const st=fs.statSync(p);if(st.isFile())out.push({path:p,name,mtime:st.mtimeMs,size:st.size})}}catch{}}
  out.sort((a,b)=>b.mtime-a.mtime);return out[0]||null;
}
async function tick(){
  if(busy)return;
  const f=newest();if(!f)return;
  const s=state(),sig=f.path+'|'+f.mtime+'|'+f.size;
  if(s.sig===sig)return;
  // Only consider a recent download; this prevents an ancient workbook from being sent on startup.
  if(Date.now()-f.mtime>12*60*60*1000)return;
  busy=true;
  try{
    const buf=fs.readFileSync(f.path);
    bcNgay.saveUpload(buf,f.name);
    const report=bcNgay.report();
    console.log('BC NGAY LOCAL EXCEL PROCESSED',f.name,report.split('\n').slice(0,4).join(' | '));
    await pushImage();
    saveState({sig,fileName:f.name,processedAt:new Date().toISOString()});
  }catch(e){console.error('BC NGAY LOCAL EXCEL ERROR',e);saveState({sig,error:String(e.message||e),failedAt:new Date().toISOString()})}
  finally{busy=false}
}
console.log('BC NGAY LOCAL EXCEL WATCHER READY');
setInterval(tick,10000);
setTimeout(tick,3000);
