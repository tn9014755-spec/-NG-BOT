const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET || '';

app.get('/', (_req, res) => res.status(200).send('NG-BOT READY'));
app.get('/health', (_req, res) => res.status(200).json({ ok: true, bot: 'NG-BOT' }));

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.get('x-line-signature') || '';
  const body = req.body || Buffer.from('');
  if (LINE_SECRET) {
    const expected = crypto.createHmac('sha256', LINE_SECRET).update(body).digest('base64');
    if (signature !== expected) return res.status(401).send('invalid signature');
  }
  // Old commands have been removed. New commands will be added from a clean slate.
  return res.status(200).send('OK');
});

app.listen(PORT, () => console.log(`NG-BOT READY on ${PORT}`));
