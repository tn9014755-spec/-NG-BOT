const fs=require('fs');
const path=require('path');
const DATA=path.join(__dirname,'data');
const STATE=path.join(DATA,'health_locked.json');
const SRC=path.join(DATA,'category_detail_567.json');
const HEALTH=path.join(__dirname,'health.html');
function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function load(p,f){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return f}}
function repair(){
  if(!fs.existsSync(SRC)||!fs.existsSync(HEALTH))return;
  const saved=load(SRC,{}), old=load(STATE,{});
  const comp={};
  for(const m of [5,6,7]){
    for(const [name,val] of Object.entries(saved[String(m)]||{})){
      if(!comp[name])comp[name]={name,5:0,6:0,7:0,8:0};
      comp[name][m]=num(val);
    }
  }
  const catComp=Object.values(comp);
  const catMonth={...(old.catMonth||{})};
  for(const m of [5,6,7])catMonth[m]=Object.entries(saved[String(m)]||{}).map(([name,val])=>({name,dt:num(val)}));
  const state={...old,locked:true,months_locked:[5,6,7],catMonth,catComp};
  fs.writeFileSync(STATE,JSON.stringify(state));
  let h=fs.readFileSync(HEALTH,'utf8');
  h=h.replace(/const catMonth=\s*.*?;const catComp=\s*.*?;const sameCat=/s,`const catMonth=${JSON.stringify(catMonth)};const catComp=${JSON.stringify(catComp)};const sameCat=`);
  h=h.replace(/const daysInMonth=31;/g,'const daysInMonth=30;');
  fs.writeFileSync(HEALTH,h);
  console.log('RUNTIME REPAIR: T5-T7 restored; T8 forecast=30 days');
}
try{repair()}catch(e){console.error('RUNTIME_REPAIR',e)}
