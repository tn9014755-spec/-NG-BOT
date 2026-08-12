const fs=require("fs"),Module=require("module"),path=require("path");
const target=path.join(__dirname,"index.js");
let code=fs.readFileSync(target,"utf8");
const re=/else if\(t==='dt hôm nay'\|\|t==='dt hom nay'\)\{[\s\S]*?\}else if\(t==='nạp dữ liệu sức khỏe'/;
const replacement=`else if(t==='dt hôm nay'||t==='dt hom nay'){if(gid!==g.revenue){await reply(e.replyToken,'⚠️ Lệnh DT HÔM NAY chỉ dùng trong NHÓM DT.');continue}try{const r=ingestRevenue(),total=num(r.doanh_thu_offline)+num(r.doanh_thu_online),avg=r.tong_bill?Math.round(total/r.tong_bill):0;await reply(e.replyToken,\`📊 DT HÔM NAY\\n📅 \${r.ngay}\\n🏪 \${r.ten_sieu_thi}\\n💰 TỔNG DT: \${total.toLocaleString('vi-VN')} đ\\n🏪 Offline: \${num(r.doanh_thu_offline).toLocaleString('vi-VN')} đ\\n📱 Online: \${num(r.doanh_thu_online).toLocaleString('vi-VN')} đ\\n🧾 Tổng bill: \${r.tong_bill}\\n📱 Bill Online: \${r.tong_bill_online}\\n🎯 Bill BQ: \${avg.toLocaleString('vi-VN')} đ\`)}catch(x){await reply(e.replyToken,'⚠️ '+x.message)}}else if(t==='nạp dữ liệu sức khỏe'`;
if(!re.test(code)){console.error("DT patch target not found");process.exit(1)}
code=code.replace(re,replacement);
const m=new Module(target,module);m.filename=target;m.paths=Module._nodeModulePaths(path.dirname(target));m._compile(code,target);
