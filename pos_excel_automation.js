// FULL LOCAL POS -> EXCEL automation for ST 28717.
// 1) Reuse Chrome via CDP when available.
// 2) Otherwise launch a dedicated local Chrome profile with Puppeteer.
// 3) Navigate POS report 336, set 1st-of-month -> today, store 28717,
//    request Excel export, open export history, wait for "Đã xuất", download.
// 4) The existing bc_local_excel_worker.js picks up the downloaded workbook and sends BC NGÀY to LINE.
const fs = require('fs');
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer');

const POS_URL = process.env.POS_REPORT_URL || 'https://pos.bachhoaxanh.com/reports/home/dashboard/336';
const CDP_URL = process.env.POS_CDP_URL || 'http://127.0.0.1:9222';
const STORE = process.env.POS_STORE || '28717';
const DOWNLOAD_DIR = process.env.POS_DOWNLOAD_DIR || path.join(os.homedir(), 'Downloads');
const PROFILE = process.env.POS_PROFILE_DIR || path.join(__dirname, 'data', 'pos-chrome-profile');
const INTERVAL = Number(process.env.POS_AUTOMATION_INTERVAL_MS || 15 * 60 * 1000);
const ENABLED = process.env.POS_AUTOMATION_ENABLED !== '0';
let running = false;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const pad = n => String(n).padStart(2, '0');
function localDateText(d) { return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; }
function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

async function connectOrLaunch() {
  try {
    const browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });
    return { browser, owned: false };
  } catch (_) {}

  fs.mkdirSync(PROFILE, { recursive: true });
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: PROFILE,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  console.log('POS AUTO: launched dedicated Chrome profile; first run may require POS login once.');
  return { browser, owned: true };
}

async function getPage(browser) {
  const pages = await browser.pages();
  let page = pages.find(p => /pos\.bachhoaxanh\.com/i.test(p.url()));
  if (!page) page = pages[0] || await browser.newPage();
  await page.bringToFront();
  return page;
}

async function clickByText(page, texts, timeout = 8000) {
  const wanted = (Array.isArray(texts) ? texts : [texts]).map(norm);
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const ok = await page.evaluate(wanted => {
      const n = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const els = [...document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"],label')]
        .filter(e => e.offsetParent !== null);
      const el = els.find(e => wanted.some(w => n(e.innerText || e.value || e.getAttribute('aria-label')).includes(w)));
      if (!el) return false;
      el.scrollIntoView({block:'center'}); el.click(); return true;
    }, wanted);
    if (ok) { await sleep(700); return true; }
    await sleep(300);
  }
  return false;
}

async function fillDate(page, kind, value) {
  return page.evaluate(({kind, value}) => {
    const n = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const inputs = [...document.querySelectorAll('input')].filter(e => e.offsetParent !== null);
    const keys = kind === 'from'
      ? ['từ ngày','from','start','ngày bắt đầu']
      : ['đến ngày','to','end','ngày kết thúc'];
    let el = inputs.find(e => keys.some(k => n(`${e.placeholder} ${e.name} ${e.id} ${e.getAttribute('aria-label')}`).includes(k)));
    if (!el) {
      const dates = inputs.filter(e => /date|ngày/i.test(`${e.type} ${e.placeholder} ${e.name} ${e.id} ${e.getAttribute('aria-label')}`));
      el = dates[kind === 'from' ? 0 : 1];
    }
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', {bubbles:true}));
    el.dispatchEvent(new Event('change', {bubbles:true}));
    el.blur();
    return true;
  }, {kind, value});
}

async function selectStore(page) {
  const direct = await clickByText(page, [STORE, `st ${STORE}`, `siêu thị ${STORE}`], 3000);
  if (direct) return true;
  return page.evaluate(store => {
    const n = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const inputs = [...document.querySelectorAll('input')].filter(e => e.offsetParent !== null);
    const el = inputs.find(e => /siêu thị|store|cửa hàng/i.test(`${e.placeholder} ${e.name} ${e.id} ${e.getAttribute('aria-label')}`));
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, store); el.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  }, STORE);
}

async function chooseExportIfNeeded(page) {
  if (await clickByText(page, ['Xuất Excel','Export Excel'], 10000)) return true;
  return false;
}

async function waitForDownload(before) {
  const end = Date.now() + 180000;
  while (Date.now() < end) {
    let files = [];
    try { files = fs.readdirSync(DOWNLOAD_DIR); } catch {}
    const fresh = files.filter(n => /\.(xlsx|xls|csv)$/i.test(n)).map(n => {
      const p = path.join(DOWNLOAD_DIR,n); let st; try { st=fs.statSync(p); } catch { return null; }
      return st && st.mtimeMs > before ? {p, m:st.mtimeMs} : null;
    }).filter(Boolean).sort((a,b)=>b.m-a.m);
    if (fresh[0]) return fresh[0].p;
    await sleep(1000);
  }
  return null;
}

async function runOnce() {
  const {browser, owned} = await connectOrLaunch();
  try {
    const page = await getPage(browser);
    await page.goto(POS_URL, {waitUntil:'domcontentloaded', timeout:60000}).catch(()=>{});
    await sleep(1500);

    const body = norm(await page.evaluate(() => document.body.innerText || ''));
    if (/đăng nhập|login|tài khoản|mật khẩu/.test(body) && !/dashboard|báo cáo/.test(body)) {
      console.error('POS AUTO: POS is not logged in in the automation Chrome profile; waiting for login.');
      return false;
    }

    const now = new Date();
    const from = localDateText(firstOfMonth(now));
    const to = localDateText(now);
    if (!await fillDate(page,'from',from)) throw new Error('Không tìm thấy ô Từ ngày');
    if (!await fillDate(page,'to',to)) throw new Error('Không tìm thấy ô Đến ngày');
    if (!await selectStore(page)) throw new Error(`Không tìm thấy ô Siêu thị / ${STORE}`);

    // Trigger filter/search if the page has one; harmless if absent.
    await clickByText(page, ['Xem báo cáo','Xem','Tìm kiếm','Tra cứu','Áp dụng','Search'], 2500).catch(()=>false);
    await sleep(1000);
    if (!await chooseExportIfNeeded(page)) throw new Error('Không tìm thấy nút Xuất Excel');

    await sleep(1000);
    await clickByText(page, ['Lịch sử xuất Excel','Lịch sử xuất','Lịch sử'], 12000).catch(()=>false);
    await sleep(1200);

    const historyEnd = Date.now() + 180000;
    let downloaded = null;
    while (Date.now() < historyEnd && !downloaded) {
      const status = norm(await page.evaluate(() => document.body.innerText || ''));
      if (/đã xuất|da xuat/.test(status)) {
        const before = Date.now();
        await clickByText(page, ['Tải file','Tải xuống','Download','Excel'], 8000).catch(()=>false);
        downloaded = await waitForDownload(before);
        if (downloaded) break;
      }
      await sleep(2000);
      await page.reload({waitUntil:'domcontentloaded', timeout:30000}).catch(()=>{});
    }
    if (!downloaded) throw new Error('Không có file mới sau trạng thái Đã xuất');
    console.log('POS AUTO EXPORT OK:', downloaded);
    return true;
  } finally {
    if (owned) { try { await browser.close(); } catch {} }
    else { try { await browser.disconnect(); } catch {} }
  }
}

async function tick() {
  if (!ENABLED || running) return;
  running = true;
  try { await runOnce(); } catch (e) { console.error('POS AUTO ERROR:', e.message || e); }
  finally { running = false; }
}

if (ENABLED) {
  console.log(`POS AUTO READY | store=${STORE} | report=336 | interval=${INTERVAL}ms`);
  setTimeout(tick, 5000);
  setInterval(tick, INTERVAL);
}
