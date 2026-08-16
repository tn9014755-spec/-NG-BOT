const puppeteer = require('puppeteer');

let browser = null;
let page = null;

function cdpUrl() {
  return String(process.env.POS_CDP_URL || process.env.CHROME_CDP_URL || '').trim();
}

async function connectPOS() {
  const endpoint = cdpUrl();
  if (!endpoint) throw new Error('Thiếu POS_CDP_URL/CHROME_CDP_URL');

  if (browser && browser.connected) {
    if (!page || page.isClosed()) page = await browser.newPage();
    return { browser, page };
  }

  browser = await puppeteer.connect({ browserURL: endpoint, defaultViewport: null });
  const pages = await browser.pages();
  page = pages.find(p => /pos\.bachhoaxanh\.com/i.test(p.url())) || pages[0] || await browser.newPage();
  return { browser, page };
}

async function posStatus() {
  try {
    const { page } = await connectPOS();
    return { ok: true, url: page.url(), title: await page.title() };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

module.exports = { connectPOS, posStatus };
