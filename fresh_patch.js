const fs=require('fs');
const path=require('path');
const target=path.join(__dirname,'server.js');
let s=fs.readFileSync(target,'utf8');
if(!s.includes('/* FRESH_RULES_V5 */')){
const freshFn=`/* FRESH_RULES_V5 */
function fresh(rows){
  const r0=rows[0]||{};
  const kp=key(r0,['Tên sản phẩm','Tên SP','Sản phẩm'])||fuzzy(r0,/tên sản phẩm|sản phẩm|sku/);
  const ks=key(r0,['Tổng SL bán','SL bán'])||fuzzy(r0,/tổng.*sl.*b[aá]n|sl.*b[aá]n|số lượng bán/);
  const km=key(r0,['SL mất mát kiểm kê','SL mất mát','Mất mát'])||fuzzy(r0,/mất mát|mat mat/);
  const kh=key(r0,['SL hủy tồn','SL hủy','Hủy'])||fuzzy(r0,/hủy|huy/);
  const ko=key(r0,['Nguyên giá','Giá nguyên','DT nguyên giá'])||fuzzy(r0,/nguyên giá|gia nguyen|dt nguyên giá/);
  const kd=key(r0,['Doanh thu','DT','Giá trị bán'])||fuzzy(r0,/doanh thu|^dt$|giá trị bán/);
  const ksg=key(r0,['SL bán nguyên giá','SL nguyên giá'])||fuzzy(r0,/sl.*nguyên giá|sl.*nguyen gia/);
  const ksd=key(r0,['SL bán giảm giá','SL giảm giá'])||fuzzy(r0,/sl.*giảm giá|sl.*giam gia/);
  const kcat=key(r0,['Nhóm hàng','Nhóm ngành hàng','Ngành hàng','Category','Nhóm'])||fuzzy(r0,/nhóm.*hàng|ngành hàng|category/);
  const norm=v=>String(v??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();
  const classify=(r,p)=>{const c=norm(kcat?r[kcat]:''); const n=norm(p); const all=c+' '+n;
    if(/c\\.p\\b|\\bc\\s*p\\b/.test(all)) return null;
    if(/bia|sua|thuc uong|nuoc giai khat|nuoc ngot|sua chua|dong lanh|kem/.test(all)) return null;
    if(/trai cay|fruit/.test(c)) return 'TRÁI CÂY';
    if(/thit/.test(c)) return 'THỊT';
    if(/ca|thuy hai san|hai san|seafood/.test(c)) return 'CÁ / THỦY HẢI SẢN';
    if(/rau|cu qua|rau cu/.test(c)) return 'RAU CỦ';
    if(/ca|tom|muc|cua|ghe|bach tuoc/.test(n)) return 'CÁ / THỦY HẢI SẢN';
    if(/thit|heo|bo|ga|suon|xuong|dui|canh ga|ba roi|than heo|thit xay/.test(n)) return 'THỊT';
    if(/tao|nho|chuoi|dua|xoai|thanh long|duoc|le |cam |quyt|man|dao |kiwi|bo |mang cut|sau rieng|mit |mang cau/.test(n)) return 'TRÁI CÂY';
    if(/rau|cai|bap|nam |khoai|ca rot|hanh|toi|bi |dau |ngo |cu |gia |mo |sup lo|cai be|cai ngot|cai thia/.test(n)) return 'RAU CỦ';
    return null;
  };
  const agg={};
  for(const r of rows){const p=String(kp?r[kp]:'').trim();if(!p)continue;const group=classify(r,p);if(!group)continue;
    const id=group+'|'+p;if(!agg[id])agg[id]={san_pham:p,group,sl_ban:0,mat_mat:0,huy:0,doanh_thu:0,nguyen_gia:0,sl_nguyen_gia:0,sl_giam_gia:0,giam_gia:0};
    const x=agg[id];x.sl_ban+=num(ks?r[ks]:0);x.mat_mat+=num(km?r[km]:0);x.huy+=num(kh?r[kh]:0);x.doanh_thu+=num(kd?r[kd]:0);x.nguyen_gia+=num(ko?r[ko]:0);x.sl_nguyen_gia+=num(ksg?r[ksg]:0);x.sl_giam_gia+=num(ksd?r[ksd]:0);
  }
  const out=Object.values(agg);for(const x of out){const t=x.sl_nguyen_gia+x.sl_giam_gia;x.nguyen_gia_pct=t?x.sl_nguyen_gia/t*100:0;x.giam_gia_pct=t?x.sl_giam_gia/t*100:0;}
  return out;
}
`;
s=s.replace(/function fresh\(rows\)\{[\s\S]*?\nfunction load\(/,freshFn+'function load(');
const sectionFn=`function freshSection(rows){
  const data=Array.isArray(rows)?rows:[]; const groups=['RAU CỦ','THỊT','CÁ / THỦY HẢI SẢN','TRÁI CÂY'];
  const groupTitle={'RAU CỦ':'🥬 RAU CỦ','THỊT':'🥩 THỊT','CÁ / THỦY HẢI SẢN':'🐟 CÁ / THỦY HẢI SẢN','TRÁI CÂY':'🍎 TRÁI CÂY'};
  const v=(n)=>new Intl.NumberFormat('vi-VN').format(Math.round(n||0)); const money=(n)=>v(n)+' đ';
  const esc2=x=>String(x??'').replace(/[&<>\\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\':'&#92;','"':'&quot;'}[m]));
  const render=(g)=>{const d=data.filter(x=>x.group===g);const total=d.reduce((s,x)=>s+x.doanh_thu,0);const good=d.slice().sort((a,b)=>b.doanh_thu-a.doanh_thu).slice(0,5);const bad=d.slice().sort((a,b)=>((b.mat_mat+b.huy)-(a.mat_mat+a.huy))||((a.sl_ban||0)-(b.sl_ban||0))||(b.giam_gia_pct-a.giam_gia_pct)).slice(0,5);const goodRows=good.map(x=>'<tr><td>'+esc2(x.san_pham)+'</td><td>'+money(x.doanh_thu)+'</td><td>'+v(x.sl_ban)+'</td><td>'+x.nguyen_gia_pct.toFixed(1)+'%</td><td>'+x.giam_gia_pct.toFixed(1)+'%</td><td>Giữ tồn, ưu tiên trưng bày & duy trì nhập</td></tr>').join('');const badRows=bad.map(x=>'<tr><td>'+esc2(x.san_pham)+'</td><td>'+v(x.mat_mat)+'</td><td>'+v(x.huy)+'</td><td>'+x.giam_gia_pct.toFixed(1)+'%</td><td>Giảm nhập; xử lý tồn; rà soát giá & trưng bày</td></tr>').join('');return '<div class="sub"><h3>'+groupTitle[g]+' <span>DT '+money(total)+'</span></h3><div class="tw"><div><b>🟢 5 SKU bán tốt</b><table><tr><th>SP</th><th>DT</th><th>SL</th><th>NL</th><th>GG</th><th>🎯</th></tr>'+goodRows+'</table></div><div><b>🔴 5 SKU bán kém</b><table><tr><th>SP</th><th>SL MẤT MÁT</th><th>SL HỦY</th><th>GG</th><th>🎯</th></tr>'+badRows+'</table></div></div></div>';};const total=data.reduce((s,x)=>s+x.doanh_thu,0);return '<!--FRESH_REPORT_START--><div id="fresh-report" class="section compact-fresh"><h2>🥬 FRESH — 01–12/08</h2><div class="muted">SL bán đúng từ ngày 01 đến ngày hiện tại · Bán tốt: DT cao · Bán kém: bán ít + mất mát/hủy cao + % giảm giá lớn · Bia/Sữa/C.P loại khỏi FRESH.</div>'+groups.map(render).join('')+'<div class="muted" style="font-weight:900">TỔNG FRESH: '+money(total)+'</div></div><!--FRESH_REPORT_END-->';
}
`;
s=s.replace(/function freshSection\(rows\)\{[\s\S]*?\nconst VND=/,sectionFn+'const VND=');
fs.writeFileSync(target,s);
}
require('./server.js');
