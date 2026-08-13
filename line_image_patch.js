const express=require('express');
const originalExpress=express;
const fs=require('fs');
const path=require('path');

const IMAGE_FILE=path.join('/tmp','bc-image-dt-fresh.jpg');

async function openHealthPage(){
  const puppeteer=require('puppeteer');
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:1000,height:1200,deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:${process.env.PORT||3000}/suc-khoe`,{waitUntil:'networkidle0',timeout:30000});
  await new Promise(r=>setTimeout(r,1200));
  return {browser,page};
}

async function renderDTFreshImage(){
  const {browser,page}=await openHealthPage();
  try{
    await page.evaluate(()=>{document.body.style.zoom='0.55';window.scrollTo(0,0)});
    await new Promise(r=>setTimeout(r,500));
    const height=await page.evaluate(()=>Math.min(Math.max(document.documentElement.scrollHeight,document.body.scrollHeight),7000));
    const buf=await page.screenshot({type:'jpeg',quality:35,clip:{x:0,y:0,width:1000,height:height}});
    fs.writeFileSync(IMAGE_FILE,buf);
    console.log('LINE_DT_FRESH_IMAGE_READY bytes='+buf.length+' height='+height);
    return buf;
  }finally{await browser.close();}
}

global.__renderBCImage=renderDTFreshImage;
global.__bcImageFile=IMAGE_FILE;

function wrappedExpress(...args){
  const app=originalExpress(...args);
  app.get('/bc-image-dt-fresh.jpg',async(req,res)=>{
    try{
      if(fs.existsSync(IMAGE_FILE))return res.set({'Cache-Control':'no-store','Content-Type':'image/jpeg'}).send(fs.readFileSync(IMAGE_FILE));
      return res.status(404).type('text').send('DT+FRESH image not ready');
    }catch(e){console.error('LINE_DT_FRESH_IMAGE_ROUTE_ERROR',e);return res.status(500).type('text').send('image error');}
  });
  return app;
}
Object.assign(wrappedExpress,originalExpress);
require.cache[require.resolve('express')].exports=wrappedExpress;

const originalFetch=global.fetch;
global.fetch=async(...args)=>{
  const [url,options]=args;
  if(String(url).includes('api.line.me/v2/bot/message/reply')&&options?.body){
    try{
      const payload=JSON.parse(options.body);
      const text=payload?.messages?.find(m=>m?.type==='text')?.text||'';
      if(/BC\s*SỨC\s*KHỎE/i.test(text)){
        await global.__renderBCImage();
        const base=process.env.RENDER_EXTERNAL_URL||'https://ng-bot-c0im.onrender.com';
        const stamp=Date.now();
        const imageUrl=base+'/bc-image-dt-fresh.jpg?t='+stamp;
        payload.messages=payload.messages.filter(m=>m?.type!=='image');
        payload.messages.unshift({type:'image',originalContentUrl:imageUrl,previewImageUrl:imageUrl});
        options.body=JSON.stringify(payload);
        console.log('LINE_ONE_IMAGE_SEND DT_FRESH='+imageUrl);
      }
    }catch(e){console.error('LINE_IMAGE_PATCH_ERROR',e);}
  }
  return originalFetch(...args);
};
