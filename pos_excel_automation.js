// POS -> Excel automation for ST 28717.
// Connects to the user's already-open Chrome through CDP (default http://127.0.0.1:9222).
// It intentionally fails closed: if Chrome/POS is unavailable or a required control cannot
// be found, it logs the reason and retries instead of clicking an unknown control.
const fs = require('fs');
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer');

const POS_URL = process.env.POS_REPORT_URL || 'https://pos.bachhoaxanh.com/reports/home/dashboard/336';
const CDP_URL = process.env.POS_CDP_URL || 'http://127.0.0.1:9222';
const STORE = process.env.POS_STORE || '28717';
const INTERVAL = Number(process.env.POS_AUTOMATION_INTERVAL_MS || 60000);
const DOWNLOAD_DIR = process.env.POS_DOWNLOAD_DIR || path.join(os.homedir(), 'Downloads');
const ENABLED = process.env.POS_AUTOMATION_ENABLED !== '0';
let running = false;

function pad(n) { return String(n).padStart(2, '0'); }
function dateText(d) { return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; }
function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

async function connect() {
  try { return await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null }); }
  catch (e) { return null; }
}

async function visibleText(page, text) {
  return page.evaluate((needle) => {
    const norm = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const n = norm(needle);
    return [...document.querySelectorAll('button,a,[role="button"],label,span,div')]
      .filter(el => el.offsetParent !== null && norm(el.innerText || el.textContent) === n)
      .slice(0, 10).map(el => ({tag: el.tagName, text: (el.innerText || el.textContent || '').trim()}));
  }, text);
}

async function clickText(page, texts, timeout = 5000) {
  const list = Array.isArray(texts) ? texts : [texts];
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const text of list) {
      const ok = await page.evaluate((needle) => {
        const norm = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const n = norm(needle);
        const els = [...document.querySelectorAll('button,a,[role="button"],label,span,div')]
          .filter(el => el.offsetParent !== null && norm(el.innerText || el.textContent) === n);
        const el = els.find(x => ['BUTTON','A'].includes(x.tagName) || x.getAttribute('role') === 'button') || els[0];
        if (!el) return false;
        el.scrollIntoView({block:'center'}); el.click(); return true;
      }, text);
      if (ok) { await new Promise(r => setTimeout(r, 800)); return true; }
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

async function setDateField(page, labels, value) {
  return page.evaluate(({labels, value}) => {
    const norm = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const wanted = labels.map(norm);
    const labelsEls = [...document.querySelectorAll('label')];
    for (const l of labelsEls) {
      if (!wanted.some(x => norm(l.innerText).includes(x))) continue;
      const id = l.htmlFor;
      const input = id ? document.getElementById(id) : l.querySelector('input');
      if (input) { input.focus(); input.value = value; input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); return true; }
    }
    const inputs = [...document.querySelectorAll('input')].filter(x => x.offsetParent !== null);
    const candidates = inputs.filter(x => /date|ngày|from|to/i.test(`${x.placeholder||''} ${x.name||''} ${x.getAttribute('aria-label')||''}`));
    if (candidates.length >= 2) {
      const idx = wanted.some(x => /từ|from/.test(x)) ? 0 : 1;
      const input = candidates[idx]; input.focus(); input.value = value; input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); return true;
    }
    return false;
  }, {labels, value});
}

async function chooseStore(page) {
  const clicked = await clickText(page, [STORE, `ST ${STORE}`, `Siêu thị ${STORE}`], 3000);
  if (clicked) return true;
  return page.evaluate((store) => {
    const inputs = [...document.querySelectorAll('input')].filter(x => x.offsetParent !== null);
    const input = inputs.find(x => /siêu thị|store|cửa hàng/i.test(`${x.placeholder||''} ${x.name||''} ${x.getAttribute('aria-label')||''}`));
    if (!input) return false;
    input.focus(); input.value = store; input.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  }, STORE);
}

async function waitForDownload(page, before) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const files = fs.readdirSync(DOWNLOAD_DIR, {withFileTypes:true}).filter(x => x.isFile() && /\.(xlsx|xls|csv)$/i.test(x.name));
    const fresh = files.map(x => {
      const p = path.join(DOWNLOAD_DIR, x.name); const s = fs.statSync(p); return {p, m:s.mtimeMs};
    }).filter(x => x.m > before).sort((a,b) => b.m-a.m);
    if (fresh[0]) return fresh[0].p;
    await new Promise(r => setTimeout(r, 1000));
  }
  return null;
}

async function runOnce() {
  const browser = await connect();
  if (!browser) return false;
  let page;
  try {
    const pages = await browser.pages();
    page = pages.find(p => (p.url() || '').includes('pos.bachhoaxanh.com')) || pages[0];
    if (!page) throw new Error('Không tìm thấy tab Chrome');
    await page.goto(POS_URL, {waitUntil:'domcontentloaded', timeout:60000}).catch(() => {});
    await page.bringToFront();
    await new Promise(r => setTimeout(r, 1500));

    const now = new Date();
    const from = dateText(firstOfMonth(now));
    const to = dateText(now);
    const fromOK = await setDateField(page, ['từ ngày','from','ngày bắt đầu'], from);
    const toOK = await setDateField(page, ['đến ngày','to','ngày kết thúc'], to);
    if (!fromOK || !toOK) throw new Error(`Không tìm thấy ô ngày (from=${fromOK}, to=${toOK})`);
    if (!await chooseStore(page)) throw new Error(`Không chọn được siêu thị ${STORE}`);

    if (!await clickText(page, ['Xuất Excel','Xuất Excel ','Export Excel'], 8000)) throw new Error('Không tìm thấy nút Xuất Excel');
    await new Promise(r => setTimeout(r, 1200));
    if (!await clickText(page, ['Lịch sử xuất Excel','Lịch sử xuất Excel ','Lịch sử'], 10000)) throw new Error('Không tìm thấy Lịch sử xuất Excel');
    await new Promise(r => setTimeout(r, 1200));
    if (!await clickText(page, ['Xem báo cáo','Xem Báo cáo','Xem'], 10000)) throw new Error('Không tìm thấy Xem báo cáo');

    const deadline = Date.now() + 120000;
    let downloaded = null;
    while (Date.now() < deadline) {
      const status = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g,' ').trim());
      if (/Đã xuất|Da xuat/i.test(status)) {
        const before = Date.now();
        await clickText(page, ['Tải file','Tải xuống','Download','Excel'], 8000).catch(() => false);
        downloaded = await waitForDownload(page, before);
        if (downloaded) break;
      }
      await new Promise(r => setTimeout(r, 1500));
      await page.reload({waitUntil:'domcontentloaded', timeout:30000}).catch(() => {});
    }
    if (!downloaded) throw new Error('Không tải được Excel sau khi trạng thái Đã xuất');
    console.log('POS AUTO EXPORT OK', downloaded);
    return true;
  } finally {
    try { await browser.disconnect(); } catch {}
  }
}

async function tick() {
  if (!ENABLED || running) return;
  running = true;
  try { await runOnce(); }
  catch (e) { console.error('POS AUTO ERROR:', e.message || e); }
  finally { running = false; }
}

if (ENABLED) {
  console.log(`POS AUTO READY -> ${POS_URL} | store ${STORE} | CDP ${CDP_URL}`);
  setTimeout(tick, 5000);
  setInterval(tick, INTERVAL);
} else {
  console.log('POS AUTO DISABLED');
}
