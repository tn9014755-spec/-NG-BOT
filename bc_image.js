const fs=require('fs');
const path=require('path');
const HTML_FILE=path.join(__dirname,'data','bc_ngay','latest.html');
const IMAGE_FILE=path.join('/tmp','bc-ngay-report.jpg');
const BASE=String(process.env.RENDER_EXTERNAL_URL||process.env.PUBLIC_BASE_URL||'https://ng-bot-c0im.onrender.com').replace(/\/$/,'');

async function render(report){
  const puppeteer=require('puppeteer');
  if(!fs.existsSync(HTML_FILE)) throw new Error('BC HTML chưa được tạo');
  const html=fs.readFileSync(HTML_FILE,'utf8');
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try{
    const page=await browser.newPage();
    await page.setViewport({width:1000,height:1400,deviceScaleFactor:1});
    await page.setContent(html,{waitUntil:'networkidle0'});
    await page.screenshot({path:IMAGE_FILE,type:'jpeg',quality:88,fullPage:true});
    console.log('BC_NGAY_IMAGE_FROM_HTML_READY bytes='+fs.statSync(IMAGE_FILE).size);
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
