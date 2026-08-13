const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'health.html');
try{
  let h=fs.readFileSync(file,'utf8');
  const re=/function renderCats\(\)\{[\s\S]*?\}document\.querySelectorAll\("\.tabs button"\)/;
  if(re.test(h)){
    const fn=`function renderCats(){const rows=catMonth[String(selected)]||[];const total=rows.reduce((s,x)=>s+(Number(x.dt)||0),0);const getCat=(m,name)=>{const direct=(catComp.find(r=>r.name===name)||{})[String(m)];if(Number(direct)>0)return Number(direct);const rr=(catMonth[String(m)]||[]).find(x=>x.name===name);return Number(rr?.dt)||0};document.getElementById("topCats").innerHTML=rows.slice(0,8).map(x=>{const share=total?(Number(x.dt)||0)/total*100:0;return \`<div class="barrow"><div>\${x.name}</div><div class="track"><div class="fill" style="width:\${Math.max(2,share)}%"></div></div><div><b>\${VND(x.dt)}</b><br><span class="muted">\${share.toFixed(1)}%</span></div></div>\`}).join("")||"<div class='muted'>Chưa có dữ liệu.</div>";const ch=catComp.map(r=>{const a=getCat(8,r.name),b=getCat(7,r.name);return{name:r.name,a,b,ch:b?((a/b-1)*100):0}}).filter(x=>x.a||x.b).sort((a,b)=>b.ch-a.ch);document.getElementById("changeCats").innerHTML=ch.slice(0,8).map(x=>\`<div class="barrow"><div>\${x.name}</div><div class="\${C(x.ch)}">\${x.ch>=0?"▲":"▼"} \${Math.abs(x.ch).toFixed(1)}%</div><div>\${VND(x.a)}</div></div>\`).join("")||"<div class='muted'>Chưa có dữ liệu.</div>";document.getElementById("catTable").innerHTML=catComp.slice().sort((a,b)=>getCat(8,b.name)-getCat(8,a.name)).map(r=>{const t5=getCat(5,r.name),t6=getCat(6,r.name),t7=getCat(7,r.name),t8=getCat(8,r.name),share=total?t8/total*100:0;return \`<tr><td>\${r.name}</td><td>\${VND(t5)}</td><td>\${VND(t6)}</td><td>\${VND(t7)}</td><td>\${VND(t8)}</td><td>\${share.toFixed(1)}%</td></tr>\`}).join("")}document.querySelectorAll(".tabs button")`;
    h=h.replace(re,fn);
    fs.writeFileSync(file,h);
    console.log('CATEGORY DETAIL FIX OK - T5/T6/T7/T8 values use locked category data');
  }else console.log('CATEGORY DETAIL FIX: target function not found');
}catch(e){console.error('CATEGORY DETAIL FIX ERROR',e)}
