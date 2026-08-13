const fs=require('fs');
const path=require('path');
const target=path.join(__dirname,'server.js');
let s=fs.readFileSync(target,'utf8');
const marker='/* CP_FRESH_ONLY_V4 */';
if(!s.includes(marker)){
  const old='function freshSection(rows){const data=Array.isArray(rows)?rows:[];';
  const neu=`function freshSection(rows){${marker}const data=(Array.isArray(rows)?rows:[]).filter(x=>{const p=String(x?.san_pham??x?.product??x?.['Tên sản phẩm']??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim();return !/(^|\\s)c\\.?\\s*p\\.?($|\\s|-|_)/i.test(p);});`;
  if(!s.includes(old)) throw new Error('freshSection target not found');
  s=s.replace(old,neu);
  fs.writeFileSync(target,s);
}
require('./server.js');
