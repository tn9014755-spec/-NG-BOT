const express = require('express');
const originalExpress = express;
const fs = require('fs');
const path = require('path');

const DT_FILE = path.join('/tmp','bc-image.jpg');
const FRESH_FILE = path.join('/tmp','fresh-image.jpg');

async function openHealthPage(){
  const puppeteer=require('puppeteer');
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:900,height:1800,deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:${process.env.PORT||3000}/suc-khoe`,{waitUntil:'domcontentloaded',timeout:30000});
  await new Promise(r=>setTimeout(r,1200));
  return {browser,page};
}

async function renderDTImage(){
  const {browser,page}=await openHealthPage();
  try{
    const buf=await page.screenshot({type:'jpeg',quality:45,clip:{x:0,y:0,width:900,height:1800}});
    fs.writeFileSync(DT_FILE,buf);
    console.log('LINE_DT_IMAGE_READY bytes='+buf.length);
    return buf;
  }finally{await browser.close();}
}

async function renderFreshImage(){
  const {browser,page}=await openHealthPage();
  try{
    const el=await page.$('#fresh-report');
    if(!el) throw new Error('FRESH_REPORT_NOT_FOUND');
    const buf=await el.screenshot({type:'jpeg',quality:45});
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
  app.get('/bc-image.jpg',async(req,res)=>{
    try{
      if(fs.existsSync(DT_FILE)) return res.set({'Cache-Control':'no-store','Content-Type':'image/jpeg'}).send(fs.readFileSync(DT_FILE));
      const buf=await renderDTImage();
      return res.set({'Cache-Control':'no-store','Content-Type':'image/jpeg'}).send(buf);
    }catch(e){console.error('LINE_DT_IMAGE_ROUTE_ERROR',e);return res.status(500).type('text').send('image error');}
  });
  app.get('/fresh-image.jpg',async(req,res)=>{
    try{
      if(fs.existsSync(FRESH_FILE)) return res.set({'Cache-Control':'no-store','Content-Type':'image/jpeg'}).send(fs.readFileSync(FRESH_FILE));
      const buf=await renderFreshImage();
      return res.set({'Cache-Control':'no-store','Content-Type':'image/jpeg'}).send(buf);
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
        if(typeof global.__renderBCImage==='function') await global.__renderBCImage();
        if(typeof global.__renderFreshImage==='function') await global.__renderFreshImage();
        const base=process.env.RENDER_EXTERNAL_URL||'https://ng-bot-c0im.onrender.com';
        const dtUrl=base+'/bc-image.jpg?t='+Date.now();
        const freshUrl=base+'/fresh-image.jpg?t='+Date.now();
        const hasImage=m=>m?.type==='image';
        if(!payload.messages.some(m=>hasImage(m)&&String(m.originalContentUrl||'').includes('/bc-image.jpg'))){
          payload.messages.push({type:'image',originalContentUrl:dtUrl,previewImageUrl:dtUrl});
        }
        if(!payload.messages.some(m=>hasImage(m)&&String(m.originalContentUrl||'').includes('/fresh-image.jpg'))){
          payload.messages.push({type:'image',originalContentUrl:freshUrl,previewImageUrl:freshUrl});
        }
        options.body=JSON.stringify(payload);
        console.log('LINE_IMAGES_SEND DT='+dtUrl+' FRESH='+freshUrl);
      }
    }catch(e){console.error('LINE_IMAGE_PATCH_ERROR',e);}
  }
  return originalFetch(...args);
};
