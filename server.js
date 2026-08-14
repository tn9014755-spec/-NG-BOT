const express = require('express');
const crypto = require('crypto');
const bcNgay = require('./bc_ngay');

const app = express();
const PORT = process.env.PORT || 3000;
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_API = 'https://api.line.me/v2/bot';

app.get('/', (_req, res) => res.status(200).send('BC NGAY BOT READY'));
app.get('/health', (_req, res) => res.status(200).json({ ok: true, bot: 'BC_NGAY', hasData: bcNgay.hasData(), meta: bcNgay.meta() }));

function verify(body, signature) {
  if (!LINE_SECRET) return true;
  const expected = crypto.createHmac('sha256', LINE_SECRET).update(body).digest('base64');
  return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expected));
}
async function lineFetch(url, options = {}) {
  return fetch(url, { ...options, headers: { Authorization: `Bearer ${LINE_TOKEN}`, ...(options.headers || {}) } });
}
async function reply(replyToken, messages) {
  if (!LINE_TOKEN || !replyToken) return;
  const list = Array.isArray(messages) ? messages : [messages];
  const res = await lineFetch(`${LINE_API}/message/reply`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ replyToken, messages:list.slice(0,5) }) });
  if (!res.ok) console.error('LINE REPLY', res.status, await res.text());
}
function chunks(text, max=4700) {
  const out=[]; let rest=String(text||'');
  while(rest.length>max){ let p=rest.lastIndexOf('\n',max); if(p<100)p=max; out.push(rest.slice(0,p)); rest=rest.slice(p).replace(/^\n+/,''); }
  if(rest) out.push(rest); return out.slice(0,5);
}
async function downloadFile(messageId) {
  const res = await lineFetch(`${LINE_API}/message/${encodeURIComponent(messageId)}/content`);
  if (!res.ok) throw new Error(`Không tải được file từ LINE (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const body = req.body || Buffer.from('');
  const signature = req.get('x-line-signature') || '';
  if (!verify(body, signature)) return res.status(401).send('invalid signature');
  res.status(200).send('OK');
  try {
    const payload = JSON.parse(body.toString('utf8'));
    for (const event of payload.events || []) {
      if (!event.replyToken || event.mode === 'standby') continue;
      const msg = event.message || {};
      if (msg.type === 'text') {
        const text = String(msg.text || '').trim().toUpperCase().replace(/\s+/g,' ');
        if (text === 'BC NGÀY' || text === 'BC NGAY') {
          if (!bcNgay.hasData()) {
            await reply(event.replyToken, { type:'text', text:'📭 Chưa có data BC NGÀY. Anh gửi file Excel ngành hàng trước nhé.' });
          } else {
            await reply(event.replyToken, chunks(bcNgay.report()).map(text=>({type:'text',text})));
          }
        }
      } else if (msg.type === 'file') {
        const name = String(msg.fileName || '').toLowerCase();
        if (!/\.(xlsx|xls|csv)$/i.test(name)) {
          await reply(event.replyToken, { type:'text', text:'⚠️ BC NGÀY chỉ nhận file Excel/CSV (.xlsx, .xls, .csv).' });
          continue;
        }
        try {
          const buffer = await downloadFile(msg.id);
          bcNgay.saveUpload(buffer, msg.fileName || `BC_NGAY_${Date.now()}.xlsx`);
          const meta = bcNgay.meta();
          await reply(event.replyToken, { type:'text', text:`✅ Đã nhận data BC NGÀY\n📁 ${meta?.fileName || msg.fileName}\n\nAnh nhắn: BC NGÀY\nBot sẽ lấy đúng data mới nhất để báo cáo.` });
        } catch (e) {
          console.error('BC NGAY FILE', e);
          await reply(event.replyToken, { type:'text', text:`❌ File mới không hợp lệ nên em KHÔNG ghi đè data cũ.\n${e.message}` });
        }
      }
    }
  } catch (e) { console.error('WEBHOOK', e); }
});

app.listen(PORT, () => console.log(`BC NGAY BOT READY on ${PORT}`));
