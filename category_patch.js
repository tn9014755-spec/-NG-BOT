const fs=require('fs');
const path=require('path');
const target=path.join(__dirname,'server.js');
let s=fs.readFileSync(target,'utf8');
if(!s.includes('/* CATEGORY_DETAIL_RULES_V1 */')){
  const old=`const oldCats=old.catMonth||{};const catMonth={};for(const m of [5,6,7])catMonth[m]=Array.isArray(oldCats[m])?oldCats[m]:[];const m8=cats.map(x=>({name:x.name,dt:x[8]||0})).filter(x=>x.dt>0).sort((a,b)=>b.dt-a.dt);const total8=m8.reduce((s,x)=>s+x.dt,0);m8.forEach(x=>x.share=total8?x.dt/total8*100:0);catMonth[8]=m8;`;
  const fresh=`/* CATEGORY_DETAIL_RULES_V1 */const catMonth={};for(const m of [5,6,7,8]){const arr=cats.map(x=>({name:x.name,dt:x[m]||0})).filter(x=>x.dt!==0||x.name).sort((a,b)=>b.dt-a.dt);const total=arr.reduce((sum,x)=>sum+x.dt,0);arr.forEach(x=>x.share=total?x.dt/total*100:0);catMonth[m]=arr;}`;
  if(!s.includes(old)) throw new Error('CATEGORY_OLD_BLOCK_NOT_FOUND');
  s=s.replace(old,fresh);
  fs.writeFileSync(target,s);
  console.log('CATEGORY DETAIL PATCH: T5-T7 rebuilt from category source data');
}
require('./fresh_patch.js');
