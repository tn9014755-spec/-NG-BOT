const fs=require('fs');
const path=require('path');
const IMAGE_FILE=path.join('/tmp','bc-ngay-report.jpg');
const BASE=String(process.env.RENDER_EXTERNAL_URL||process.env.PUBLIC_BASE_URL||'https://ng-bot-c0im.onrender.com').replace(/\/$/,'');

function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function pageHtml(report){
  const lines=String(report||'').split(/\r?\n/);
  const body=lines.map(line=>{
    const x=esc(line);
    if(/^📊|^BC NGÀY|^BC NGAY/i.test(line)) return `<div class="title">${x}</div>`;
    if(/^📅|^💰|^🛒|^🥬|^🧾|^📌|^⏰|^📭|^🔗/.test(line)) return `<div class="section">${x}</div>`;
    if(/^[-=]{3,}$/.test(line.trim())) return '<div class="rule"></div>';
    if(!line.trim()) return '<div class="space"></div>';
    return `<div class="line">${x}</div>`;
  }).join('');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;background:#eef3f8;font-family:Arial,"Noto Sans",sans-serif;color:#17212b}
  .sheet{width:1000px;margin:0 auto;background:#fff;min-height:1200px;padding:34px 42px 46px;border-radius:0}
  .top{background:linear-gradient(135deg,#0876d1,#07885f);color:#fff;border-radius:22px;padding:25px 28px;margin-bottom:22px;box-shadow:0 8px 22px #0002}
  .brand{font-size:31px;font-weight:800;letter-spacing:.2px}.date{font-size:17px;margin-top:8px;opacity:.92}
  .title{font-size:27px;font-weight:800;margin:24px 0 12px;color:#0b6fbd}.section{font-size:22px;font-weight:800;margin:18px 0 9px;color:#117653}
  .line{font-size:17px;line-height:1.5;padding:5px 0;border-bottom:1px solid #edf1f5;white-space:pre-wrap}.rule{height:1px;background:#dfe6ed;margin:10px 0}.space{height:7px}
  .footer{margin-top:28px;font-size:13px;color:#697586;text-align:center}
  </style></head><body><div class="sheet"><div class="top"><div class="brand">📊 BC NGÀY ST 28717 - MỸ QUỚI</div><div class="date">Báo cáo doanh thu ngành hàng • Hình ảnh gửi LINE</div></div>${body}<div class="footer">🤖 BOT DANG • BC NGÀY • Cập nhật từ data mới nhất</div></div></body></html>`;
}

async function render(report){
  const puppeteer=require('puppeteer');
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try{
    const page=await browser.newPage();
    await page.setViewport({width:1000,height:1400,deviceScaleFactor:1});
    await page.setContent(pageHtml(report),{waitUntil:'networkidle0'});
    await page.screenshot({path:IMAGE_FILE,type:'jpeg',quality:86,fullPage:true});
    console.log('BC_NGAY_IMAGE_READY bytes='+fs.statSync(IMAGE_FILE).size);
    return BASE+'/bc-ngay-image.jpg?t='+Date.now();
  }finally{await browser.close();}
}

function installRoute(app){
  app.get('/bc-ngay-image.jpg',(req,res)=>{
    if(!fs.existsSync(IMAGE_FILE))return res.status(404).type('text').send('BC NGAY image not ready');
    res.set({'Cache-Control':'no-store','Content-Type':'image/jpeg'}).send(fs.readFileSync(IMAGE_FILE));
  });
}
module.exports={render,installRoute};
