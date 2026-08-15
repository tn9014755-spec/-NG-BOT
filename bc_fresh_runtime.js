// BC FRESH runtime wrapper.
// Keep the runtime transform deliberately simple so generated JS cannot be corrupted.
const fs = require('fs');
const path = require('path');
const Module = require('module');

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

const runtime = new Module(path.join(__dirname, 'bc_fresh_runtime_compiled.js'), module);
runtime.filename = path.join(__dirname, 'bc_fresh_runtime_compiled.js');
runtime.paths = module.paths;
runtime._compile(src, runtime.filename);
module.exports = runtime.exports;
