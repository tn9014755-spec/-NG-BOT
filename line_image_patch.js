const express = require('express');
const originalExpress = express;
function wrappedExpress(...args) {
  const app = originalExpress(...args);
  app.get('/bc-image.png', async (req, res) => {
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
      const page = await browser.newPage({viewport:{width:1200,height:2400},deviceScaleFactor:1});
      await page.goto(`http://127.0.0.1:${process.env.PORT||3000}/suc-khoe`, {waitUntil:'networkidle0', timeout:30000});
      const buf = await page.screenshot({type:'png',fullPage:true});
      await browser.close();
      res.set('Cache-Control','no-store').type('png').send(buf);
    } catch (e) { console.error('LINE_IMAGE_ROUTE',e); res.status(500).send('image error'); }
  });
  return app;
}
Object.assign(wrappedExpress, originalExpress);
require.cache[require.resolve('express')].exports = wrappedExpress;
