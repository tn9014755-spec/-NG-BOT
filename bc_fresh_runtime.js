// BC FRESH runtime wrapper.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const PUPPETEER_CACHE_DIR = path.join(__dirname, '.cache', 'puppeteer');
process.env.PUPPETEER_CACHE_DIR = PUPPETEER_CACHE_DIR;
delete process.env.PUPPETEER_EXECUTABLE_PATH;
const sourceFile = path.join(__dirname, 'bc_fresh_bot.js');
const TARGET_DIR = path.join(__dirname, 'data', 'bc_fresh');
const TARGET_FILE = path.join(TARGET_DIR, 'target.json');
fs.mkdirSync(TARGET_DIR, {recursive:true});
function loadFreshTarget(){try{return JSON.parse(fs.readFileSync(TARGET_FILE,'utf8')).to||''}catch(e){return ''}}
function saveFreshTarget(to){if(!to)return;try{fs.writeFileSync(TARGET_FILE,JSON.stringify({to,updatedAt:new Date().toISOString()}))}catch(e){console.error('BC FRESH TARGET SAVE',e)}}
let src = fs.readFileSync(sourceFile, 'utf8');
src = src.replace(/process\.env\.LINE_CHANNEL_ACCESS_TOKEN/g, "globalThis.process?.env?.LINE_CHANNEL_ACCESS_TOKEN");
src = src.replace(/process\.env\.LINE_ACCESS_TOKEN/g, "globalThis.process?.env?.LINE_ACCESS_TOKEN");
src = src.replace(/process\.env\.RENDER_EXTERNAL_URL/g, "globalThis.process?.env?.RENDER_EXTERNAL_URL");
src = src.replace(/process\.env\.PUBLIC_BASE_URL/g, "globalThis.process?.env?.PUBLIC_BASE_URL");
src = src.replace("for(const ws of wb.Sheets)", "for(const ws of Object.values(wb.Sheets || {}))");
src = src.replace("for (const ws of wb.Sheets)", "for(const ws of Object.values(wb.Sheets || {}))");
src = src.replace("const b=req.rawBody||req.body||Buffer.alloc(0),p=JSON.parse(b.toString('utf8'));", "const raw=req.rawBody??req.body??Buffer.alloc(0);const p=typeof raw==='object'&&!Buffer.isBuffer(raw)?raw:JSON.parse(Buffer.from(raw).toString('utf8'));");
src = src.replace("const raw=req.rawBody??req.body??Buffer.alloc(0);const p=typeof raw==='object'&&!Buffer.isBuffer(raw)?raw:JSON.parse(Buffer.from(raw).toString('utf8'));", "const b0=req.rawBody??req.body;const b=b0??await new Promise((resolve,reject)=>{const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject)});const p=typeof b==='object'&&!Buffer.isBuffer(b)?b:JSON.parse(Buffer.from(b).toString('utf8'));");
src = src.replace("const chromium=require('@sparticuz/chromium');", "const chromium=(require('@sparticuz/chromium').default||require('@sparticuz/chromium'));");
src = src.replace("executablePath:globalThis.process.env.PUPPETEER_EXECUTABLE_PATH||undefined", "executablePath:await chromium.executablePath()");
const runtime = new Module(path.join(__dirname, 'bc_fresh_runtime_compiled.js'), module);
runtime.filename = path.join(__dirname, 'bc_fresh_runtime_compiled.js');
runtime.paths = module.paths;
runtime._compile(src, runtime.filename);
globalThis.__BC_FRESH_PROCESS = runtime.exports.process;
const express = require('express');
if(!express.application.__bcFreshHardGate){
  const originalPost = express.application.post;
  const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || process.env.LINE_ACCESS_TOKEN || '';
  const API = 'https://api.line.me/v2/bot';
  const DATA_API = 'https://api-data.line.me/v2/bot';
  const BASE = String(process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_BASE_URL || 'https://ng-bot-c0im.onrender.com').replace(/\/$/,'');
  const IMG='/tmp/bc-fresh.png';
  const PRE='/tmp/bc-fresh-preview.png';
  const TARGET=path.join(__dirname,'data','bc_fresh','target.json');
  const getTarget=()=>{try{return JSON.parse(fs.readFileSync(TARGET,'utf8')).to||''}catch(_){return ''}};
  const setTarget=(to)=>{if(to)fs.writeFileSync(TARGET,JSON.stringify({to,updatedAt:new Date().toISOString()}))};
  const api=(u,o={})=>fetch(u,{...o,headers:{Authorization:'Bearer '+TOKEN,...(o.headers||{})}});
  const reply=async(t,m)=>{if(!TOKEN||!t)return;await api(API+'/message/reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({replyToken:t,messages:[m]})})};
  const push=async(to,m)=>{if(!TOKEN||!to)return;await api(API+'/message/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,messages:[m]})})};
  express.application.post=function(route,...handlers){
    if(route==='/webhook'&&handlers.length){
      const hardGate=async(req,res,next)=>{
        try{
          const raw=req.rawBody??req.body;
          const body=raw??await new Promise((resolve,reject)=>{const c=[];req.on('data',x=>c.push(x));req.on('end',()=>resolve(Buffer.concat(c)));req.on('error',reject)});
          const p=typeof body==='object'&&!Buffer.isBuffer(body)?body:JSON.parse(Buffer.from(body).toString('utf8'));
          let handled=false;
          for(const e of p.events||[]){
            if(e.mode==='standby')continue;
            const m=e.message||{},s=e.source||{},chat=s.groupId||s.roomId||s.userId;
            if(m.type==='text'&&/^BC\s+FRESH$/i.test(String(m.text||'').trim())){handled=true;if(s.type==='group'||s.type==='room')setTarget(chat);globalThis.__BC_FRESH_WAITING=true;await reply(e.replyToken,{type:'text',text:'✅ Đã nhận lệnh BC FRESH.\n📎 Anh gửi FILE EXCEL tiếp theo, em sẽ trả 1 ảnh FULL báo cáo.'});continue;}
            if(m.type==='text'&&/^FRESH$/i.test(String(m.text||'').trim())){handled=true;globalThis.__BC_FRESH_WAITING=false;if(fs.existsSync(IMG))await reply(e.replyToken,{type:'image',originalContentUrl:BASE+'/bc-fresh.png?'+Date.now(),previewImageUrl:BASE+'/bc-fresh-preview.png?'+Date.now()});else await reply(e.replyToken,{type:'text',text:'⚠️ Chưa có BC FRESH gần nhất. Anh gửi BC FRESH + file Excel trước nhé.'});continue;}
            if(m.type==='file'&&/\.(xlsx|xls|csv)$/i.test(String(m.fileName||''))&&globalThis.__BC_FRESH_WAITING===true){handled=true;await reply(e.replyToken,{type:'text',text:'⏳ Đã nhận file Excel. Em đang dựng ảnh FULL BC FRESH...'});try{const r=await api(DATA_API+'/message/'+encodeURIComponent(m.id)+'/content');if(!r.ok)throw Error('LINE tải file lỗi '+r.status);const im=await globalThis.__BC_FRESH_PROCESS(Buffer.from(await r.arrayBuffer()),m.fileName||'latest.xlsx');globalThis.__BC_FRESH_WAITING=false;const dest=getTarget()||chat;if(dest)await push(dest,{type:'image',originalContentUrl:im.full+'?'+Date.now(),previewImageUrl:im.preview+'?'+Date.now()});}catch(err){globalThis.__BC_FRESH_WAITING=false;console.error('BC FRESH HARD GATE',err);const dest=getTarget()||chat;if(dest)await push(dest,{type:'text',text:'❌ BC FRESH lỗi: '+String(err.message||err).slice(0,220)});}continue;}
          }
          if(handled)return res.status(200).send('OK');
          next();
        }catch(err){console.error('BC FRESH HARD GATE ERROR',err);next();}
      };
      return originalPost.call(this,route,hardGate,...handlers);
    }
    return originalPost.call(this,route,...handlers);
  };
  express.application.__bcFreshHardGate=true;
}
module.exports = runtime.exports;
