const fs = require('fs');
const path = require('path');
const file = path.join(__dirname,'server_fixed.js');
try {
  let s = fs.readFileSync(file,'utf8');
  const old = "async function reply(token,text){const r=await fetch('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+TOKEN},body:JSON.stringify({replyToken:token,messages:[{type:'text',text}]})});if(!r.ok)console.error('LINE_REPLY',await r.text())}";
  const neu = "async function reply(token,text){const messages=[{type:'text',text}];if(/BC SỨC KHỎE/i.test(text||'')){const host=process.env.RENDER_EXTERNAL_URL||'https://ng-bot-c0im.onrender.com';const imageUrl=host+'/bc-image.png?t='+Date.now();messages.unshift({type:'image',originalContentUrl:imageUrl,previewImageUrl:imageUrl});console.log('LINE_IMAGE: '+imageUrl)}const r=await fetch('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+TOKEN},body:JSON.stringify({replyToken:token,messages})});if(!r.ok)console.error('LINE_REPLY',await r.text())}";
  if(s.includes(neu)){console.log('LINE_IMAGE_PATCH: already applied');process.exit(0)}
  if(!s.includes(old)) throw new Error('reply function pattern not found');
  s=s.replace(old,neu);
  fs.writeFileSync(file,s);
  console.log('LINE_IMAGE_PATCH: reply now sends BC image');
} catch(e){console.error('LINE_IMAGE_PATCH ERROR',e);process.exitCode=1}
