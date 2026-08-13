const express=require('express');
const originalExpress=express;
const fs=require('fs');
const path=require('path');

const DT_FILE=path.join('/tmp','bc-image-dt.jpg');
const FRESH_FILE=path.join('/tmp','bc-image-fresh.jpg');

async function openHealthPage(){
  const puppeteer=require('puppeteer');
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:1000,height:1000,deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:${process.env.PORT||3000}/suc-khoe`,{waitUntil:'domcontentloaded',timeout:30000});
  await new Promise(r=>setTimeout(r,1200));
  return {browser,page};
}

async function renderDTImage(){
  const {browser,page}=await openHealthPage();
  try{
    await page.evaluate(()=>{document.body.style.zoom='0.55';window.scrollTo(0,0)});
    await new Promise(r=>setTimeout(r,300));
    const buf=await page.screenshot({type:'jpeg',quality:35,clip:{x:0,y:0,width:1000,height:1000}});
    fs.writeFileSync(DT_FILE,buf);
    console.log('LINE_DT_IMAGE_READY bytes='+buf.length);
    return buf;
  }finally{await browser.close();}
}

async function renderFreshImage(){
  const {browser,page}=await openHealthPage();
  try{
    const found=await page.$('#fresh-report');
    if(!found)throw new Error('FRESH_REPORT_NOT_FOUND');
    await page.evaluate(()=>{document.body.style.zoom='0.55'});
    await page.evaluate(()=>{const el=document.querySelector('#fresh-report');if(el)el.scrollIntoView({block:'start'})});
    await new Promise(r=>setTimeout(r,300));
    const buf=await page.screenshot({type:'jpeg',quality:35,clip:{x:0,y:0,width:1000,height:1000}});
    fs.writeFileSync(FRESH_FILE,buf);
    console.log('LINE_FRESH_IMAGE_READY bytes='+buf.length);
    return buf;
  }finally{await browser.close();}
}

global.__renderBCImage=renderDTImage;
global.__renderFreshImage=renderFreshImage;
global.__bcImageFile=DT_FILE;
global.__freshImageFile=FRESH_FILE;

function wrappedExpress(...args){
  const app=originalExpress(...args);
  app.get('/bc-image-dt.jpg',async(req,res)=>{
    try{
      if(fs.existsSync(DT_FILE))return res.set({'Cache-Control':'no-store','Content-Type':'image/jpeg'}).send(fs.readFileSync(DT_FILE));
      return res.status(404).type('text').send('DT image not ready');
    }catch(e){console.error('LINE_DT_IMAGE_ROUTE_ERROR',e);return res.status(500).type('text').send('image error');}
  });
  app.get('/bc-image-fresh.jpg',async(req,res)=>{
    try{
      if(fs.existsSync(FRESH_FILE))return res.set({'Cache-Control':'no-store','Content-Type':'image/jpeg'}).send(fs.readFileSync(FRESH_FILE));
      return res.status(404).type('text').send('FRESH image not ready');
    }catch(e){console.error('LINE_FRESH_IMAGE_ROUTE_ERROR',e);return res.status(500).type('text').send('fresh image error');}
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
      if(/^\s*BC SỨC KHỎE\s*$|^\s*BC SUC KHOE\s*$/i.test(text)){
        await global.__renderBCImage();
        await global.__renderFreshImage();
        const base=process.env.RENDER_EXTERNAL_URL||'https://ng-bot-c0im.onrender.com';
        const stamp=Date.now();
        const dtUrl=base+'/bc-image-dt.jpg?t='+stamp;
        const freshUrl=base+'/bc-image-fresh.jpg?t='+stamp;
        payload.messages=payload.messages.filter(m=>m?.type!=='image');
        payload.messages.unshift({type:'image',originalContentUrl:dtUrl,previewImageUrl:dtUrl});
        payload.messages.unshift({type:'image',originalContentUrl:freshUrl,previewImageUrl:freshUrl});
        options.body=JSON.stringify(payload);
        console.log('LINE_IMAGES_SEND DT='+dtUrl+' FRESH='+freshUrl);
      }
    }catch(e){console.error('LINE_IMAGE_PATCH_ERROR',e);}
  }
  return originalFetch(...args);
};
