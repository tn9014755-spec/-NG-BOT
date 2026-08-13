const express = require('express');
const originalExpress = express;

function wrappedExpress(...args) {
  const app = originalExpress(...args);
  app.get('/bc-image.jpg', async (req, res) => {
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
      // Giảm nhẹ kích thước/chất lượng để LINE gửi nhanh hơn nhưng vẫn đọc rõ.
      const page = await browser.newPage({viewport:{width:900,height:1800},deviceScaleFactor:1});
      await page.goto(`http://127.0.0.1:${process.env.PORT||3000}/suc-khoe`, {waitUntil:'networkidle0', timeout:30000});
      const buf = await page.screenshot({type:'jpeg',quality:55,fullPage:true});
      await browser.close();
      res.set('Cache-Control','no-store').type('jpg').send(buf);
    } catch (e) { console.error('LINE_IMAGE_ROUTE',e); res.status(500).send('image error'); }
  });
  return app;
}

Object.assign(wrappedExpress, originalExpress);
require.cache[require.resolve('express')].exports = wrappedExpress;

// Tự chèn ảnh vào tin nhắn BC SỨC KHỎE gửi qua LINE.
const originalFetch = global.fetch;
global.fetch = async (...args) => {
  const [url, options] = args;
  if (String(url).includes('api.line.me/v2/bot/message/reply') && options?.body) {
    try {
      const payload = JSON.parse(options.body);
      const text = payload?.messages?.[0]?.text || '';
      if (/BC SỨC KHỎE|BC SUC KHOE/i.test(text)) {
        const base = process.env.RENDER_EXTERNAL_URL || 'https://ng-bot-c0im.onrender.com';
        payload.messages.push({type:'image',originalContentUrl:base+'/bc-image.jpg',previewImageUrl:base+'/bc-image.jpg'});
        options.body = JSON.stringify(payload);
      }
    } catch (e) { console.error('LINE_IMAGE_PATCH',e); }
  }
  return originalFetch(...args);
};
