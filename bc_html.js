const fs=require('fs');
const path=require('path');
const DIR=path.join(__dirname,'data','bc_ngay');
const HTML=path.join(DIR,'latest.html');
fs.mkdirSync(DIR,{recursive:true});
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function build(report){
 const lines=String(report||'').split(/\r?\n/);
 const body=lines.map(l=>{const x=esc(l);if(/^📊|^BC NGÀY|^BC NGAY/.test(l))return `<div class="title">${x}</div>`;if(/^📅|^💰|^🛒|^🟢|^🔵|^📈|^ℹ️|^📁/.test(l))return `<div class="section">${x}</div>`;if(/^━/.test(l))return '<div class="rule"></div>';if(!l.trim())return '<div class="space"></div>';return `<div class="line">${x}</div>`}).join('');
 return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BC NGÀY ST 28717 - MỸ QUỚI</title><style>*{box-sizing:border-box}body{margin:0;background:#eef3f8;font-family:Arial,sans-serif;color:#17212b}.sheet{max-width:1000px;margin:auto;background:#fff;min-height:100vh;padding:24px 30px 40px}.top{background:linear-gradient(135deg,#0876d1,#07885f);color:#fff;border-radius:20px;padding:24px;margin-bottom:20px}.brand{font-size:30px;font-weight:800}.sub{margin-top:7px;font-size:15px;opacity:.9}.title{font-size:25px;font-weight:800;color:#0876d1;margin:22px 0 10px}.section{font-size:20px;font-weight:800;color:#087653;margin:15px 0 7px}.line{font-size:16px;line-height:1.5;padding:6px 4px;border-bottom:1px solid #e8edf2;white-space:pre-wrap}.rule{height:2px;background:#dce4eb;margin:12px 0}.space{height:6px}.footer{text-align:center;color:#667085;font-size:12px;margin-top:24px}@media(max-width:600px){.sheet{padding:12px}.brand{font-size:21px}.title{font-size:20px}.section{font-size:17px}.line{font-size:14px}}</style></head><body><main class="sheet"><div class="top"><div class="brand">📊 BC NGÀY ST 28717 - MỸ QUỚI</div><div class="sub">Báo cáo doanh thu ngành hàng • Dữ liệu mới nhất</div></div>${body}<div class="footer">🤖 BC NGÀY • ST 28717 - MỸ QUỚI</div></main></body></html>`;
}
function save(report){const html=build(report);fs.writeFileSync(HTML,html,'utf8');return HTML}
function read(){return fs.existsSync(HTML)?fs.readFileSync(HTML,'utf8'):''}
module.exports={save,read,HTML};
