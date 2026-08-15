// BC FRESH runtime wrapper.
// Keep the runtime transform deliberately simple so generated JS cannot be corrupted.
const fs = require('fs');
const path = require('path');
const Module = require('module');

// Render may retain an old Puppeteer cache/executable environment. Force BC FRESH
// to use one project-local cache for both installation and runtime.
const PUPPETEER_CACHE_DIR = path.join(__dirname, '.cache', 'puppeteer');
process.env.PUPPETEER_CACHE_DIR = PUPPETEER_CACHE_DIR;
delete process.env.PUPPETEER_EXECUTABLE_PATH;

const sourceFile = path.join(__dirname, 'bc_fresh_bot.js');
let src = fs.readFileSync(sourceFile, 'utf8');

// Safe environment access inside the compiled runtime.
src = src.replace(/process\.env\.LINE_CHANNEL_ACCESS_TOKEN/g, "globalThis.process?.env?.LINE_CHANNEL_ACCESS_TOKEN");
src = src.replace(/process\.env\.LINE_ACCESS_TOKEN/g, "globalThis.process?.env?.LINE_ACCESS_TOKEN");
src = src.replace(/process\.env\.RENDER_EXTERNAL_URL/g, "globalThis.process?.env?.RENDER_EXTERNAL_URL");
src = src.replace(/process\.env\.PUBLIC_BASE_URL/g, "globalThis.process?.env?.PUBLIC_BASE_URL");

// SheetJS exposes workbook.Sheets as an object keyed by sheet name.
src = src.replace("for(const ws of wb.Sheets)", "for(const ws of Object.values(wb.Sheets || {}))");
src = src.replace("for (const ws of wb.Sheets)", "for (const ws of Object.values(wb.Sheets || {}))");

// Keep the LINE destination in scope for the file-processing catch block.
src = src.replace("const m=e.message||{};", "const m=e.message||{};let to=e.source?.userId||e.source?.groupId||e.source?.roomId;");
src = src.replace("const to=e.source?.userId||e.source?.groupId||e.source?.roomId;", "to=e.source?.userId||e.source?.groupId||e.source?.roomId;");

// Puppeteer on Render uses the browser from the same project-local cache.
src = src.replace("executablePath:globalThis.process.env.PUPPETEER_EXECUTABLE_PATH||undefined", "executablePath:globalThis.process.env.PUPPETEER_EXECUTABLE_PATH||p.executablePath()");

const runtime = new Module(path.join(__dirname, 'bc_fresh_runtime_compiled.js'), module);
runtime.filename = path.join(__dirname, 'bc_fresh_runtime_compiled.js');
runtime.paths = module.paths;
runtime._compile(src, runtime.filename);
module.exports = runtime.exports;
