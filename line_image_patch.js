const express = require('express');
const originalExpress = express;
const fs = require('fs');
const path = require('path');

const IMAGE_FILE = path.join('/tmp','bc-image.jpg');

async function renderBCImage(){
  const puppeteer=require('puppeteer');
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try{
    const page=await browser.newPage();
    await page.setViewport({width:900,height:1800,deviceScaleFactor:1});
    await page.goto(`http://127.0.0.1:${process.env.PORT||3000}/suc-khoe`,{waitUntil:'domcontentloaded',timeout:30000});
    await new Promise(r=>setTimeout(r,1200));
    // Không fullPage: tránh ảnh quá cao khiến LINE từ chối ảnh.
    const buf=await page.screenshot({type:'jpeg',quality:45,clip:{x:0,y:0,width:900,height:1800}});
    fs.writeFileSync(IMAGE_FILE,buf);
    console.log('LINE_IMAGE_READY bytes='+buf.length);
    return buf;
  }finally{await browser.close();}
}

global.__renderBCImage=renderBCImage;
global.__bcImageFile=IMAGE_FILE;

function wrappedExpress(...args){
  const app=originalExpress(...args);
  app.get('/bc-image.jpg',async(req,res)=>{
    try{
      if(fs.existsSync(IMAGE_FILE)) return res.set({'Cache-Control':'no-store','Content-Type':'image/jpeg'}).send(fs.readFileSync(IMAGE_FILE));
      const buf=await renderBCImage();
      return res.set({'Cache-Control':'no-store','Content-Type':'image/jpeg'}).send(buf);
    }catch(e){console.error('LINE_IMAGE_ROUTE_ERROR',e);return res.status(500).type('text').send('image error');}
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
      if(/^\s*BC SỨC KHỎE\s*$|^\s*BC SUC KHOE\s*$/i.test(text)&&!payload.messages.some(m=>m?.type==='image')){
        // Tạo ảnh TRƯỚC khi LINE nhận URL, tránh lần đầu LINE tải phải ảnh chưa tồn tại.
        if(typeof global.__renderBCImage==='function') await global.__renderBCImage();
        const base=process.env.RENDER_EXTERNAL_URL||'https://ng-bot-c0im.onrender.com';
        const imageUrl=base+'/bc-image.jpg?t='+Date.now();
        payload.messages.push({type:'image',originalContentUrl:imageUrl,previewImageUrl:imageUrl});
        options.body=JSON.stringify(payload);
        console.log('LINE_IMAGE_SEND '+imageUrl);
      }
    }catch(e){console.error('LINE_IMAGE_PATCH_ERROR',e);}
  }
  return originalFetch(...args);
};
