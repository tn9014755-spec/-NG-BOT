const fs=require('fs');
const path=require('path');
const target=path.join(__dirname,'server.js');
let s=fs.readFileSync(target,'utf8');
const start=s.indexOf('function freshSection(rows){');
const end=s.indexOf('\nconst VND=',start);
if(start<0||end<0)throw Error('Không tìm thấy freshSection');
const fn=`function freshSection(rows){
  const data=Array.isArray(rows)?rows:[];
  const groups=[['RAU CỦ','🥬'],['THỊT','🥩'],['CÁ / THỦY HẢI SẢN','🐟'],['TRÁI CÂY','🍎']];
  const isCP=x=>{const p=String(x?.san_pham??x?.product??x?.['Tên sản phẩm']??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();const compact=p.replace(/[^a-z0-9]/g,'');return /(^|[^a-z])c\\.?\\s*p\\.?([^a-z]|$)/i.test(p)||/(^|[^a-z])cp([^a-z]|$)/i.test(p)||compact.includes('cp');};
  const renderGroup=(g,icon)=>{
    const a=data.filter(x=>x.group===g);
    const total=a.reduce((s,x)=>s+x.doanh_thu,0);
    const list=a.filter(x=>!isCP(x));
    const good=list.slice().sort((x,y)=>y.doanh_thu-x.doanh_thu).slice(0,5);
    const bad=list.slice().sort((x,y)=>((y.mat_mat+y.huy)-(x.mat_mat+x.huy))||((x.sl_ban||0)-(y.sl_ban||0))||(y.giam_gia_pct-x.giam_gia_pct)).slice(0,5);
    const goodRows=good.map(x=>\`<tr><td>\${esc(x.san_pham)}</td><td>\${VND(x.doanh_thu)}</td><td>\${NUM(x.sl_ban)}</td><td>\${x.nguyen_gia_pct.toFixed(1)}%</td><td>\${x.giam_gia_pct.toFixed(1)}%</td><td>Giữ tồn, ưu tiên trưng bày & duy trì nhập</td></tr>\`).join('')||'<tr><td colspan="6">Chưa có dữ liệu.</td></tr>';
    const badRows=bad.map(x=>\`<tr><td>\${esc(x.san_pham)}</td><td>\${NUM(x.sl_ban)}</td><td>\${NUM(x.mat_mat+x.huy)}</td><td>\${x.giam_gia_pct.toFixed(1)}%</td><td>Giảm nhập; xử lý tồn; rà soát giá & trưng bày</td></tr>\`).join('')||'<tr><td colspan="5">Chưa có dữ liệu.</td></tr>';
    return \`<div class="sub"><h3>\${icon} \${g} <span>DT \${VND(total)}</span></h3><div class="tw"><div><b>🟢 5 SKU bán tốt</b><table><tr><th>SP</th><th>DT</th><th>SL</th><th>NL</th><th>GG</th><th>🎯</th></tr>\${goodRows}</table></div><div><b>🔴 5 SKU bán kém</b><table><tr><th>SP</th><th>SL</th><th>M+H</th><th>GG</th><th>🎯</th></tr>\${badRows}</table></div></div></div>\`;
  };
  return \`<!--FRESH_REPORT_START--><div id="fresh-report" class="section fresh"><h2>🥬 FRESH</h2><div class="muted">Chỉ gồm 4 nhóm: Rau củ · Thịt · Cá / Thủy hải sản · Trái cây. C.P không hiển thị trong danh sách SP bán tốt / bán kém.</div>\${groups.map(x=>renderGroup(x[0],x[1])).join('')}</div><!--FRESH_REPORT_END-->\`;
}
`;
s=s.slice(0,start)+fn+s.slice(end);
fs.writeFileSync(target,s);
