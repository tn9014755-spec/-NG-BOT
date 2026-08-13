const express = require('express');
const originalExpress = express;
const fs = require('fs');
const path = require('path');

const IMAGE_FILE = path.join('/tmp', 'bc-image.jpg');

async function renderBCImage() {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage({viewport:{width:900,height:1800},deviceScaleFactor:1});
    await page.goto(`http://127.0.0.1:${process.env.PORT||3000}/suc-khoe`, {waitUntil:'networkidle0', timeout:30000});
    const buf = await page.screenshot({type:'jpeg',quality:55,fullPage:true});
    fs.writeFileSync(IMAGE_FILE, buf);
    return buf;
  } finally {
    await browser.close();
  }
}

global.__renderBCImage = renderBCImage;

global.__bcImageFile = IMAGE_FILE;

function wrappedExpress(...args) {
  const app = originalExpress(...args);
  app.get('/bc-image.jpg', async (req, res) => {
    try {
      // LINE phải nhận ảnh ngay; ưu tiên ảnh đã được tạo trước khi reply.
      if (fs.existsSync(IMAGE_FILE)) {
        return res.set('Cache-Control','no-store').type('jpg').send(fs.readFileSync(IMAGE_FILE));
      }
      const buf = await renderBCImage();
      return res.set('Cache-Control','no-store').type('jpg').send(buf);
    } catch (e) {
      console.error('LINE_IMAGE_ROUTE',e);
      res.status(500).send('image error');
    }
  });
  return app;
}

Object.assign(wrappedExpress, originalExpress);
require.cache[require.resolve('express')].exports = wrappedExpress;

// Fallback: nếu reply chưa được runtime patch, tự chèn ảnh vào BC SỨC KHỎE.
const originalFetch = global.fetch;
global.fetch = async (...args) => {
  const [url, options] = args;
  if (String(url).includes('api.line.me/v2/bot/message/reply') && options?.body) {
    try {
      const payload = JSON.parse(options.body);
      const text = payload?.messages?.find(m => m?.type === 'text')?.text || '';
      if (/BC SỨC KHỎE|BC SUC KHOE/i.test(text) && !payload.messages.some(m => m?.type === 'image')) {
        if (typeof global.__renderBCImage === 'function') await global.__renderBCImage();
        const base = process.env.RENDER_EXTERNAL_URL || 'https://ng-bot-c0im.onrender.com';
        const imageUrl = base + '/bc-image.jpg?t=' + Date.now();
        payload.messages.push({type:'image',originalContentUrl:imageUrl,previewImageUrl:imageUrl});
        options.body = JSON.stringify(payload);
      }
    } catch (e) { console.error('LINE_IMAGE_PATCH',e); }
  }
  return originalFetch(...args);
};
