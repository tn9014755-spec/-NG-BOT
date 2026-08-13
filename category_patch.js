const fs=require('fs');
const path=require('path');
const target=path.join(__dirname,'server.js');
let s=fs.readFileSync(target,'utf8');
// T5-T7: keep locked category detail. T8: rebuild from current category file.
const oldBlock=`const oldCats=old.catMonth||{};const catMonth={};for(const m of [5,6,7])catMonth[m]=Array.isArray(oldCats[m])?oldCats[m]:[];const m8=cats.map(x=>({name:x.name,dt:x[8]||0})).filter(x=>x.dt>0).sort((a,b)=>b.dt-a.dt);const total8=m8.reduce((sum,x)=>sum+x.dt,0);m8.forEach(x=>x.share=total8?x.dt/total8*100:0);catMonth[8]=m8;`;
const oldState=`const state={...old,locked:true,months_locked:[5,6,7],monthly, daily,catMonth,catComp:cats,fresh:freshData`;
const newState=`const oldComp=Array.isArray(old.catComp)?old.catComp:[];const compMap={};for(const x of oldComp){if(x&&x.name)compMap[x.name]={...x}}for(const x of cats){if(!x||!x.name)continue;const y=compMap[x.name]||{name:x.name,5:0,6:0,7:0};y[8]=x[8]||0;compMap[x.name]=y}const catComp=Object.values(compMap);const state={...old,locked:true,months_locked:[5,6,7],monthly, daily,catMonth,catComp,fresh:freshData`;
if(s.includes(oldState)){s=s.replace(oldState,newState);fs.writeFileSync(target,s);}
// General category data: DO NOT remove C.P. here. C.P. is excluded only from FRESH.
const cat=`function categories(rows){const r0=rows[0]||{};const kd=key(r0,['Ngày xuất','Ngày','Date'])||fuzzy(r0,/ngày.*(xuất|xuat)|date/);const kc=key(r0,['Ngành hàng BHX','Ngành hàng'])||fuzzy(r0,/ngành hàng|nganh hang/);const kr=key(r0,['Doanh thu'])||fuzzy(r0,/doanh thu/);const out={};for(const r of rows){const d=kd?date(r[kd]):null;if(!d)continue;const m=d.getMonth()+1;if(m<5||m>8)continue;const n=String(r[kc]||'Chưa phân loại').trim();if(!out[n])out[n]={name:n,5:0,6:0,7:0,8:0};out[n][m]+=num(r[kr])}return Object.values(out)}`;
s=s.replace(/function categories\(rows\)\{[\s\S]*?\nfunction freshGroup/,cat+'\nfunction freshGroup');
// Fresh only: exclude C.P.
const fg=`function freshGroup(row,kp,kc){const p=String(kp?row[kp]:'').trim();const c=String(kc?row[kc]:'').trim();if(!p)return null;const all=(c+' '+p).toLowerCase();if(/c\\.p\\b|c\\s*p\\b/.test(all))return null;const cat=c.toLowerCase();if(cat){if(/bia|sữa|sua|nước|nuoc|kem|trứng|trung|bánh|banh|đông lạnh|dong lanh|hàng mát|hang mat|thức uống|thuc uong|đồ uống|do uong|chăm sóc|cham soc|hóa mỹ phẩm|hoa my pham/.test(cat))return null;if(/rau\\s*củ|rau\\s*cu|rau\\s*củ\\s*quả|rau\\s*cu\\s*qua|rau củ quả cl|rau cu qua cl/.test(cat))return'RAU CỦ';if(/thịt|thit/.test(cat))return'THỊT';if(/cá|ca|hải sản|hai san/.test(cat))return'CÁ / THỦY HẢI SẢN';if(/trái cây|trai cay/.test(cat))return'TRÁI CÂY';return null}return null}`;
s=s.replace(/function freshGroup\(row,kp,kc\)\{[\s\S]*?\nfunction fresh\(/,fg+'\nfunction fresh(');
fs.writeFileSync(target,s);
require('./fresh_patch.js');
require('./forecast_patch.js');
