const fs=require('fs');
const path=require('path');
const DATA=path.join(__dirname,'data');
const STATE=path.join(DATA,'health_locked.json');
const SRC=path.join(DATA,'category_detail_567.json');
const HEALTH=path.join(__dirname,'health.html');
const log=(...x)=>process.stdout.write(x.join(' ')+'\n');
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
function load(p,f){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch(e){log('RUNTIME_REPAIR READ_FAIL',p,e.message);return f}}
function repair(){
  log('RUNTIME_REPAIR START');
  if(!fs.existsSync(SRC))throw Error('Missing data/category_detail_567.json');
  if(!fs.existsSync(HEALTH))throw Error('Missing health.html');
  const saved=load(SRC,{}), old=load(STATE,{}), comp={};
  for(const m of [5,6,7]) for(const [name,val] of Object.entries(saved[String(m)]||{})){
    if(!comp[name])comp[name]={name,5:0,6:0,7:0,8:0}; comp[name][m]=num(val);
  }
  const catComp=Object.values(comp), catMonth={...(old.catMonth||{})};
  for(const m of [5,6,7]) catMonth[m]=Object.entries(saved[String(m)]||{}).map(([name,val])=>({name,dt:num(val)}));
  fs.writeFileSync(STATE,JSON.stringify({...old,locked:true,months_locked:[5,6,7],catMonth,catComp}));
  let h=fs.readFileSync(HEALTH,'utf8');
  const injected=`const catMonth=${JSON.stringify(catMonth)};const catComp=${JSON.stringify(catComp)};const sameCat=`;
  const re=/const catMonth=\s*.*?;const catComp=\s*.*?;const sameCat=/s;
  if(re.test(h))h=h.replace(re,injected); else log('WARN CAT BLOCK NOT FOUND');
  h=h.replace(/const daysInMonth=31;/g,'const daysInMonth=30;');
  const forecastRe=/const daysInMonth=30;const daysWithDT=daily\.length;const forecast=daysWithDT>0\?t8\.dt\/daysWithDT\*daysInMonth:t8\.dt;/;
  const forecastCode='const daysInMonth=30;const daysWithDT=daily.length;const forecast=daysWithDT>0?t8.dt/daysWithDT*daysInMonth:t8.dt;';
  if(forecastRe.test(h))h=h.replace(forecastRe,forecastCode); else log('WARN FORECAST BLOCK NOT FOUND');
  fs.writeFileSync(HEALTH,h);
  log('RUNTIME_REPAIR OK T5=',catMonth[5].reduce((s,x)=>s+num(x.dt),0),'T6=',catMonth[6].reduce((s,x)=>s+num(x.dt),0),'T7=',catMonth[7].reduce((s,x)=>s+num(x.dt),0),'ROWS=',catComp.length,'T8_FORECAST=T8_TOTAL/DAYS_RUN*30');
}
try{repair()}catch(e){console.error('RUNTIME_REPAIR ERROR',e);process.exitCode=1}