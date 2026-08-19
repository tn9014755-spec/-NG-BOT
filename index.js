const express=require('express');
const crypto=require('crypto');
const app=express();
const PORT=process.env.PORT||10000;
const SECRET=process.env.LINE_CHANNEL_SECRET||process.env.LINE_SECRET||'';
const TOKEN=process.env.LINE_CHANNEL_ACCESS_TOKEN||process.env.LINE_ACCESS_TOKEN||'';
const API='https://api.line.me/v2/bot';
app.use(express.json({verify:(req,res,buf)=>{req.rawBody=buf}}));
app.get('/',(_,res)=>res.send('NG-BOT READY'));
app.get('/health',(_,res)=>res.json({ok:true,bot:'NG-BOT',token:!!TOKEN,secret:!!SECRET}));
app.post('/webhook',async(req,res)=>{
  const body=req.rawBody||Buffer.from(JSON.stringify(req.body||{}));
  const sig=req.get('x-line-signature')||'';
  if(SECRET){const h=crypto.createHmac('sha256',SECRET).update(body).digest('base64');if(!sig||sig.length!==h.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(h)))return res.status(401).send('invalid signature')}
  res.status(200).send('OK');
  if(!TOKEN)return;
  for(const e of (req.body?.events||[])){
    const m=e.message||{};
    if(m.type!=='text'||!e.replyToken)continue;
    const text=String(m.text||'').trim();
    if(/^ping$/i.test(text)){
      await fetch(API+'/message/reply',{method:'POST',headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'},body:JSON.stringify({replyToken:e.replyToken,messages:[{type:'text',text:'✅ BOT ĐÃ KẾT NỐI'}]})});
    }
  }
});
app.listen(PORT,()=>console.log('NG-BOT READY PORT '+PORT));
