const fs=require("fs"),path=require("path"),XLSX=require("xlsx");
const DIR=path.join(__dirname,"data","fresh");fs.mkdirSync(DIR,{recursive:true});
const XLS=path.join(DIR,"latest.xlsx"),HTML=path.join(DIR,"latest.html"),META=path.join(DIR,"latest.json"),PENDING=path.join(DIR,"pending.json");
const num=v=>{const x=Number(String(v??"").replace(/[^0-9.-]/g,""));return Number.isFinite(x)?x:0};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money=v=>Math.round(v||0).toLocaleString("vi-VN")+"đ";
const compact=v=>{v=Math.abs(v||0);return v>=1e9?(v/1e9).toFixed(1).replace(".",",")+" tỷ":(v/1e6).toFixed(1).replace(".",",")+" tr"};
function find(o,keys){for(const k of keys){const x=Object.keys(o).find(a=>String(a).toLowerCase().includes(k.toLowerCase()));if(x)return o[x]}return ""}
function category(x){
 const v=String(x||"").trim().toLowerCase();
 if(v==="rau củ các loại")return"Rau Củ Các Loại";
 if(v==="trái cây các loại")return"Trái Cây Các Loại";
 if(v==="thịt gia cầm gia súc các loại")return"Thịt gia cầm gia súc các loại";
 if(v==="thủy hải sản các loại")return"Thủy Hải Sản Các Loại";
 if(v==="sản phẩm từ sữa - bảo quản mát")return"Sản Phẩm Từ Sữa - Bảo Quản Mát";
 if(v==="thực phẩm đông lạnh - hàng mát các loại")return"Thực phẩm đông lạnh - Hàng mát các loại";
 if(v==="kem các loại")return"Kem các loại";
 return"";
}
function bucket(c){return c==="Sản Phẩm Từ Sữa - Bảo Quản Mát"||c==="Thực phẩm đông lạnh - Hàng mát các loại"||c==="Kem các loại"?"ĐÔNG MÁT":"FRESH"}
function parse(buf){
 const wb=XLSX.read(buf,{type:"buffer"}),rows=[];
 for(const ws of Object.values(wb.Sheets))rows.push(...XLSX.utils.sheet_to_json(ws,{defval:""}));
 const out=[];
 for(const r of rows){
  const c=category(find(r,["ngành hàng"]));if(!c)continue;
  const name=String(find(r,["tên sản phẩm"])).trim();
  const code=String(find(r,["mã sản phẩm"])).trim();
  const brand=String(find(r,["tên hãng","ten hang"])).trim();
  if(!name)continue;
  if(/(^|[^a-z])c\.?\s*p\.?([^a-z]|$)/i.test(name+" "+code+" "+brand))continue;
  const sale=num(find(r,["doanh thu"]))+num(find(r,["dt bán giảm giá","doanh thu bán giảm giá"]));
  const sold=num(find(r,["sl thực xuất","sl thuc xuat","tổng sl bán","tong sl ban"]));
  const mm=num(find(r,["sl mất mát kiểm kê","sl mat mat kiem ke"]));
  const ncc=num(find(r,["sl hủy hao hụt ncc","sl huy hao hut ncc"]));
  const ht=num(find(r,["sl hủy tồn","sl huy ton"]));
  const date=find(r,["ngày xuất","ngay xuat"]);
  out.push({c,name,code,brand,sale,sold,mm,ncc,ht,date});
 }
 return out;
}
function sum(a,key){return a.reduce((s,x)=>s+Number(x[key]||0),0)}
function pct(a,b){return b?a/b*100:0}
function period(file){const m=String(file||"").match(/(\d{1,2}[\/_-]\d{1,2}[\/_-]\d{2,4})/g);return m&&m.length?m.join(" – "):"FILE THÔ MỚI NHẤT"}
function bar(w){return Math.max(1,Math.min(100,w||0)).toFixed(1)+"%"}
function build(rows,file){
 // QUAN TRỌNG: phải gộp từng mã trong TOÀN KỲ trước rồi mới tính đơn giá bình quân.
 // Công thức: đơn giá = tổng doanh thu / tổng SL thực xuất; hao hụt = tổng SL hao hụt * đơn giá.
 const products=new Map();
 for(const r of rows){
  const key=[r.c,r.code||r.name,r.name].join("|");
  let p=products.get(key);
  if(!p){p={c:r.c,name:r.name,code:r.code,unitName:"",sale:0,sold:0,mm:0,ncc:0,ht:0,days:new Map()};products.set(key,p)}
  p.sale+=Number(r.sale||0);p.sold+=Number(r.sold||0);p.mm+=Number(r.mm||0);p.ncc+=Number(r.ncc||0);p.ht+=Number(r.ht||0);
  const d=r.date instanceof Date?r.date.toISOString().slice(0,10):String(r.date||"").slice(0,10);
  if(d){const z=p.days.get(d)||{mm:0,ncc:0,ht:0};z.mm+=Number(r.mm||0);z.ncc+=Number(r.ncc||0);z.ht+=Number(r.ht||0);p.days.set(d,z)}
 }
 rows=[...products.values()].map(p=>{p.unit=p.sold?p.sale/p.sold:0;p.loss=(p.mm+p.ncc+p.ht)*p.unit;return p});
 const dayMap=new Map();
 for(const p of rows)for(const [d,z] of p.days){dayMap.set(d,(dayMap.get(d)||0)+(z.mm+z.ncc+z.ht)*p.unit)}
 const dayValues=[...dayMap.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,v])=>({date,d:Number(String(date).slice(-2))||0,v}));
 const sale=sum(rows,"sale"),loss=sum(rows,"loss"),mm=sum(rows,"mm"),ncc=sum(rows,"ncc"),ht=sum(rows,"ht");
 const groups=["FRESH","ĐÔNG MÁT"].map(g=>({g,rows:rows.filter(x=>bucket(x.c)===g)}));
 const maxCat=Math.max(1,...groups.flatMap(z=>z.rows.map(x=>x.loss)));
 const catBlock=groups.map(({g,rows:a})=>{
  const cats=[...new Set(a.map(x=>x.c))].map(c=>{const z=a.filter(x=>x.c===c),l=sum(z,"loss"),q=sum(z,"mm")+sum(z,"ncc")+sum(z,"ht"),s=sum(z,"sale");return{c,l,q,p:pct(l,s)}}).sort((a,b)=>b.l-a.l);
  const gl=sum(a,"loss"),gs=sum(a,"sale");
  return `<section class="khoi ${g==="FRESH"?"f":"m"}"><div class="khoi-dau"><h2>${g}</h2><div class="khoi-so"><b>${money(gl)}</b><span>hao hụt ước tính · ${pct(gl,gs).toFixed(2)}% doanh thu</span></div></div>${cats.map(x=>`<div class="nh"><div class="nh-ten">${esc(x.c)}<em>${Math.round(x.q*10)/10} đv · ${x.p.toFixed(2)}%</em></div><div class="nh-tien">${money(x.l)}</div><div class="nh-thanh"><i style="width:${bar(x.l/maxCat*100)}"></i></div></div>`).join("")||`<div class="nh"><div class="nh-ten">Chưa có dữ liệu phù hợp</div><div class="nh-tien">0đ</div></div>`}</section>`;
 }).join("");
 const top=[...rows].sort((a,b)=>b.loss-a.loss).slice(0,15),maxTop=Math.max(1,...top.map(x=>x.loss));
 const topHtml=top.map((x,i)=>`<li><span class="stt">${i+1}</span><div class="sp-ten">${esc(x.name)}<em>${Math.round((x.mm+x.ncc+x.ht)*10)/10} đv · mất mát ${Math.round(x.mm*10)/10} · hao hụt NCC ${Math.round(x.ncc*10)/10} · hủy tồn ${Math.round(x.ht*10)/10}</em></div><div class="sp-tien">${money(x.loss)}</div></li>`).join("")||`<li><span class="sp-ten">Không có dữ liệu phù hợp</span></li>`;
 const days=dayValues.length?dayValues:Array.from({length:29},(_,i)=>({d:i+1,v:0}));
 const maxDay=Math.max(1,...days.map(x=>Math.abs(x.v)));
 const chart=days.map(x=>`<div class="cot${Math.abs(x.v)/maxDay>=.65?" cao":""}" title="Ngày ${x.d}: ${money(x.v)}"><i style="height:${Math.max(2,Math.abs(x.v)/maxDay*100)}%"></i><span>${x.d}</span></div>`).join("");
 return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hao hụt Fresh & Đông mát — ${esc(period(file))}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;800&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet"><style>
:root{--nen:#EEF2ED;--muc:#16201A;--mo:#6A7A6E;--vien:#D6DDD5;--fresh:#14432A;--mat:#1B4B73;--ro:#C62828;--canh:#E58A00;--the:#FFFFFF}*{box-sizing:border-box;margin:0;padding:0}body{background:var(--nen);color:var(--muc);font-family:"Be Vietnam Pro",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:15px;line-height:1.5;-webkit-text-size-adjust:100%}.bao{max-width:660px;margin:0 auto;padding:18px 14px 44px}.num{font-family:"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,monospace;font-variant-numeric:tabular-nums}header{margin-bottom:18px}.eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--mo);font-weight:600}h1{font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1.15;margin:6px 0 10px}.meta{display:flex;flex-wrap:wrap;gap:6px}.tag{font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;background:var(--the);border:1px solid var(--vien)}.tag.bo{background:#FFF3F3;border-color:#F3C9C9;color:var(--ro)}.hero{background:var(--the);border:1px solid var(--vien);border-radius:14px;padding:18px;margin-bottom:14px}.hero .nhan{font-size:12px;font-weight:600;color:var(--mo);text-transform:uppercase;letter-spacing:.1em}.hero .to{font-size:40px;font-weight:800;letter-spacing:-.03em;color:var(--ro);margin:4px 0 2px;line-height:1}.hero .phu{font-size:13px;color:var(--mo);margin-bottom:14px}.ro-thanh{height:34px;border-radius:8px;overflow:hidden;display:flex;border:1px solid var(--vien)}.ro-thanh .giu{background:linear-gradient(180deg,#1B5E3A,#14432A);flex:1}.ro-thanh .mat{background:repeating-linear-gradient(135deg,#C62828,#C62828 6px,#A81F1F 6px,#A81F1F 12px)}.ro-chu{display:flex;justify-content:space-between;font-size:11.5px;color:var(--mo);margin-top:6px;font-weight:600}.chip3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px}.chip{background:var(--the);border:1px solid var(--vien);border-radius:11px;padding:11px 9px;text-align:center}.chip b{display:block;font-size:19px;font-weight:800;letter-spacing:-.02em}.chip span{display:block;font-size:10.5px;color:var(--mo);font-weight:600;line-height:1.25;margin-top:3px}.khoi{border-radius:14px;padding:16px;margin-bottom:14px;border:1px solid var(--vien);background:var(--the)}.khoi.f{border-left:5px solid var(--fresh)}.khoi.m{border-left:5px solid var(--mat)}.khoi-dau{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid var(--vien)}.khoi h2{font-size:17px;font-weight:800;letter-spacing:.04em}.khoi.f h2{color:var(--fresh)}.khoi.m h2{color:var(--mat)}.khoi-so{text-align:right}.khoi-so b{display:block;font-size:17px;font-weight:800;color:var(--ro)}.khoi-so span{font-size:11px;color:var(--mo)}.nh{display:grid;grid-template-columns:1fr auto;gap:3px 10px;padding:9px 0;border-bottom:1px dashed var(--vien)}.nh:last-child{border-bottom:0;padding-bottom:0}.nh-ten{font-size:13.5px;font-weight:600;line-height:1.3}.nh-ten em{display:block;font-style:normal;font-size:11px;color:var(--mo);font-weight:500;margin-top:1px}.nh-tien{font-size:14px;font-weight:700;text-align:right;white-space:nowrap;font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums}.nh-thanh{grid-column:1/-1;height:6px;background:#E9EDE8;border-radius:99px;overflow:hidden}.nh-thanh i{display:block;height:100%;background:var(--ro);border-radius:99px}h3{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--mo);font-weight:700;margin:22px 0 10px}ol{list-style:none;background:var(--the);border:1px solid var(--vien);border-radius:14px;overflow:hidden}ol li{display:grid;grid-template-columns:26px 1fr auto;gap:10px;align-items:center;padding:11px 13px;border-bottom:1px solid var(--vien)}ol li:last-child{border-bottom:0}.stt{font-family:"IBM Plex Mono",monospace;font-size:12px;font-weight:600;color:var(--mo)}.sp-ten{font-size:13px;font-weight:600;line-height:1.3}.sp-ten em{display:block;font-style:normal;font-size:10.5px;color:var(--mo);font-weight:500;margin-top:2px}.sp-tien{font-size:13.5px;font-weight:700;white-space:nowrap;font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums}.lich{background:var(--the);border:1px solid var(--vien);border-radius:14px;padding:14px 12px 10px}.cot-bao{display:flex;align-items:flex-end;gap:2px;height:112px}.cot{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}.cot i{display:block;width:100%;background:#9FB3A4;border-radius:2px 2px 0 0}.cot.cao i{background:var(--ro)}.cot span{font-size:8.5px;color:var(--mo);margin-top:3px;font-family:"IBM Plex Mono",monospace}.ghi{margin-top:22px;background:#FFFDF5;border:1px solid #EBDFB8;border-radius:12px;padding:14px}.ghi b{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#8A6D1F;margin-bottom:8px}.ghi ul{margin-left:16px;font-size:12.5px;color:#5C5636;line-height:1.6}.ghi li{margin-bottom:5px}@media(max-width:360px){.hero .to{font-size:33px}.chip b{font-size:17px}}</style></head><body><div class="bao"><header><div class="eyebrow">Siêu thị — Mỹ Quới</div><h1>Hao hụt hàng Fresh<br>&amp; Đông mát</h1><div class="meta"><span class="tag num">${esc(period(file))}</span><span class="tag bo">Đã bỏ nhóm FMCG</span><span class="tag">Đã loại mã C.P</span></div></header><div class="hero"><div class="nhan">Giá trị hao hụt ước tính</div><div class="to num">${money(loss)}</div><div class="phu">chiếm <b>${pct(loss,sale).toFixed(2)}%</b> doanh thu Fresh + Đông mát (${money(sale)})</div><div class="ro-thanh"><div class="giu"></div><div class="mat" style="width:${Math.min(100,pct(loss,sale)).toFixed(1)}%"></div></div><div class="ro-chu"><span>Doanh thu giữ được</span><span>Rò rỉ ${pct(loss,sale).toFixed(2)}%</span></div></div><div class="chip3"><div class="chip"><b class="num">${(mm/1000).toFixed(1).replace(".",",")}</b><span>MẤT MÁT<br>KIỂM KÊ</span></div><div class="chip"><b class="num">${(ncc/1000).toFixed(1).replace(".",",")}</b><span>HỦY HAO<br>HỤT NCC</span></div><div class="chip"><b class="num">${(ht/1000).toFixed(1).replace(".",",")}</b><span>HỦY<br>TỒN</span></div></div>${catBlock}<h3>15 mặt hàng rò rỉ nhiều nhất</h3><ol>${topHtml}</ol><h3>Nhịp hao hụt theo ngày</h3><div class="lich"><div class="cot-bao">${chart}</div></div><div class="ghi"><b>Cách tính &amp; giả định</b><ul><li><b>File POS không có giá trị tiền.</b> Giá trị trong báo cáo là <b>ước tính</b>, lấy đơn giá bình quân của từng mã (doanh thu ÷ sản lượng bán thực tế trong kỳ) nhân với số lượng hao hụt.</li><li><b>Fresh</b> chỉ gồm hàng tươi sống: Rau Củ, Trái Cây, Thịt gia cầm gia súc, Thủy Hải Sản.</li><li><b>Đông mát</b> gồm: Thực phẩm đông lạnh - Hàng mát, Sản phẩm từ sữa bảo quản mát, Kem.</li><li><b>Đã bỏ toàn bộ FMCG</b> và loại mã/tên C.P khỏi phần hao hụt.</li><li>Đơn vị tính khác nhau giữa các mặt hàng nên số lượng chỉ cộng gộp để tham khảo; hãy so sánh theo tiền.</li><li>Nguồn: file POS do anh gửi cho bot. File đang hiển thị: ${esc(file)}.</li></ul></div></div></body></html>`;
}
function save(buf,file){const rows=parse(buf);if(!rows.length)throw Error("Không nhận diện được dữ liệu FRESH/ĐÔNG MÁT trong file");const html=build(rows,file);const products=new Map();for(const r of rows){const key=[r.c,r.code||r.name,r.name].join("|");const p=products.get(key)||{sale:0,sold:0,mm:0,ncc:0,ht:0};p.sale+=Number(r.sale||0);p.sold+=Number(r.sold||0);p.mm+=Number(r.mm||0);p.ncc+=Number(r.ncc||0);p.ht+=Number(r.ht||0);products.set(key,p)}let sale=0,loss=0;for(const p of products.values()){sale+=p.sale;const unit=p.sold?p.sale/p.sold:0;loss+=(p.mm+p.ncc+p.ht)*unit}const meta={fileName:file,updatedAt:new Date().toISOString(),sale,loss,pct:pct(loss,sale),rows:rows.length};fs.writeFileSync(XLS,buf);fs.writeFileSync(HTML,html);fs.writeFileSync(META,JSON.stringify(meta,null,2));return meta}
function get(){try{return JSON.parse(fs.readFileSync(META,"utf8"))}catch{return null}}
function beginUpload(){fs.writeFileSync(PENDING,JSON.stringify({active:true,startedAt:new Date().toISOString()}))}
function isPending(){try{return JSON.parse(fs.readFileSync(PENDING,"utf8")).active===true}catch{return false}}
function finishUpload(){try{fs.unlinkSync(PENDING)}catch{}}
function exists(){return fs.existsSync(XLS)&&fs.existsSync(HTML)}
function page(){return fs.readFileSync(HTML,"utf8")}
module.exports={save,get,beginUpload,isPending,finishUpload,exists,page};