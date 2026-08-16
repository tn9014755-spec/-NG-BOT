// Local POS worker: attaches to a Chrome instance started with CDP on 127.0.0.1:9222.
// IMPORTANT: keep CDP bound to localhost. Do not expose port 9222 to the public internet.
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const CDP = process.env.POS_CDP_URL || 'http://127.0.0.1:9222';
const STORE = process.env.POS_STORE || '28717';
const REPORT = process.env.POS_REPORT || '336';
const DOWNLOAD_DIR = path.resolve(process.env.POS_DOWNLOAD_DIR || './data/pos');
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

async function visibleTextClick(page, text) {
  const ok = await page.evaluate((needle) => {
    const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const n = norm(needle);
    const els = [...document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]')];
    const el = els.find(e => norm(e.innerText || e.value || e.getAttribute('aria-label')).includes(n));
    if (!el) return false;
    el.click();
    return true;
  }, text);
  if (!ok) throw new Error(`Không tìm thấy nút: ${text}`);
}

async function connect() {
  const browser = await puppeteer.connect({ browserURL: CDP, defaultViewport: null });
  const pages = await browser.pages();
  const page = pages.find(p => /pos\.bachhoaxanh\.com/i.test(p.url())) || pages[0];
  if (!page) throw new Error('Không tìm thấy tab Chrome.');
  await page.bringToFront();
  console.log('Attached:', page.url());
  return { browser, page };
}

async function main() {
  const { browser, page } = await connect();
  try {
    if (!/pos\.bachhoaxanh\.com/i.test(page.url())) {
      await page.goto(`https://pos.bachhoaxanh.com/reports/home/dashboard/${REPORT}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }
    await page.screenshot({ path: path.join(DOWNLOAD_DIR, 'pos-before.png'), fullPage: true }).catch(() => {});
    console.log(`Đã mở báo cáo ${REPORT}.`);
    console.log(`Store=${STORE}. Bước chọn lịch/ngày/xuất file cần selector thực tế của POS; worker sẽ không tự click mù.`);
    console.log('Giữ Chrome mở. Khi đã xác định DOM selector của POS, hoàn thiện flow tự động 336/888.');
  } finally {
    await browser.disconnect();
  }
}

main().catch(err => { console.error(err.stack || err); process.exitCode = 1; });
