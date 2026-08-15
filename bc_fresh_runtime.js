// Runtime compatibility wrapper for BC FRESH.
// The original module registered its handler before express.raw(), so LINE files/text were consumed too early.
// Load the same module after moving its handler behind the raw-body parser.
const fs=require('fs');
const path=require('path');
const Module=require('module');
const sourceFile=path.join(__dirname,'bc_fresh_bot.js');
let src=fs.readFileSync(sourceFile,'utf8');
const oldText='return op.call(this,route,fresh,...handlers)';
const newText='return op.call(this,route,handlers[0],fresh,...handlers.slice(1))';
if(!src.includes(oldText)) throw new Error('BC FRESH runtime patch target not found');
src=src.replace(oldText,newText);
const runtime=new Module(path.join(__dirname,'bc_fresh_runtime_compiled.js'),module);
runtime.filename=path.join(__dirname,'bc_fresh_runtime_compiled.js');
runtime.paths=module.paths;
runtime._compile(src,runtime.filename);
module.exports=runtime.exports;
