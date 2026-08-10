const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

const BASE_URL =
  process.env.RENDER_EXTERNAL_URL ||
  "https://ng-bot-c0im.onrender.com";

// Báo cáo cũ anh đã gửi — giữ nguyên dữ liệu/mẫu.
const REPORT_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Báo cáo doanh thu T8/2026 — BHX Mỹ Qưới</title>
<style>
  :root{
    --bg:#F2F5F9; --card:#FFFFFF; --ink:#111827; --muted:#64748B; --line:#E2E8F0;
    --blue:#2A78D6; --blue-bg:#E7F0FB; --blue-ink:#134C8F;
    --orange:#EB6834; --orange-bg:#FDEDE6; --orange-ink:#9C3D14;
    --green:#1BAF7A; --green-bg:#E4F6EF; --green-ink:#0F6E56;
    --amber:#EDA100; --amber-bg:#FCF2DD; --amber-ink:#855009;
    --violet:#4A3AA7; --violet-bg:#ECEAFB; --violet-ink:#372B7D;
    --red:#E24B4A; --red-bg:#FCEBEB; --red-ink:#A32D2D;
    --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  }
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  body{margin:0;background:var(--bg);color:var(--ink);
    font-family:"Segoe UI","Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;
    line-height:1.45;padding:16px 14px 40px;font-size:15px}
  .wrap{max-width:520px;margin:0 auto}

  .tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
  .tag{font-size:11.5px;padding:4px 10px;border-radius:999px}
  .tag.b{background:var(--blue-bg);color:var(--blue-ink)}
  .tag.g{background:var(--green-bg);color:var(--green-ink)}
  .tag.a{background:var(--amber-bg);color:var(--amber-ink)}
  h1{margin:0;font-size:20px;font-weight:700;letter-spacing:-.02em}
  h2{margin:26px 0 10px;font-size:13px;font-weight:700;letter-spacing:.06em;color:var(--muted)}
  .meta{margin:4px 0 16px;font-size:12px;color:var(--muted)}

  .hero{background:var(--blue-bg);border:1px solid #CFE0F5;border-radius:16px;padding:16px 18px}
  .hero .lb{margin:0;font-size:12.5px;color:var(--blue-ink)}
  .hero .num{margin:5px 0 0;font-family:var(--mono);font-size:29px;font-weight:700;
    letter-spacing:-.04em;color:var(--blue-ink)}
  .hero .sub{margin:6px 0 0;font-size:12px;color:var(--blue-ink);opacity:.85}
  .hero.gr{background:var(--green-bg);border-color:#BFE6D6}
  .hero.gr .lb,.hero.gr .num,.hero.gr .sub{color:var(--green-ink)}
  .prog{display:flex;height:14px;border-radius:6px;overflow:hidden;background:#CDE8DC;margin-top:12px}
  .prog span{background:var(--green)}

  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
  .kpi{border-radius:14px;padding:12px 14px}
  .kpi .lb{margin:0;font-size:12px;font-weight:600;line-height:1.3}
  .kpi .num{margin:5px 0 0;font-family:var(--mono);font-size:18px;font-weight:700;letter-spacing:-.03em}
  .kpi .sub{margin:3px 0 0;font-size:11px;opacity:.85;line-height:1.35}
  .kpi.green{background:var(--green-bg);color:var(--green-ink)}
  .kpi.amber{background:var(--amber-bg);color:var(--amber-ink)}
  .kpi.violet{background:var(--violet-bg);color:var(--violet-ink)}
  .kpi.orange{background:var(--orange-bg);color:var(--orange-ink)}
  .kpi.blue{background:var(--blue-bg);color:var(--blue-ink)}

  .picker{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px}
  .days{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch}
  .day{flex:0 0 auto;min-width:52px;padding:9px 4px;border:1px solid var(--line);border-radius:12px;
    background:#F8FAFC;text-align:center;cursor:pointer}
  .day b{display:block;font-size:15px;font-weight:700}
  .day i{display:block;font-style:normal;font-size:10.5px;color:var(--muted);margin-top:2px}
  .day.on{background:var(--blue);border-color:var(--blue)}
  .day.on b,.day.on i{color:#fff}
  .panel{margin-top:14px;border-top:1px solid var(--line);padding-top:14px}
  .panel .dt{margin:0;font-size:12.5px;color:var(--muted)}
  .panel .big{margin:4px 0 0;font-family:var(--mono);font-size:26px;font-weight:700;letter-spacing:-.04em}
  .delta{display:inline-block;font-size:12px;padding:3px 9px;border-radius:999px;margin-top:8px}
  .delta.up{background:var(--green-bg);color:var(--green-ink)}
  .delta.down{background:var(--red-bg);color:var(--red-ink)}
  .rows{margin-top:12px}
  .r{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--line);font-size:13.5px}
  .r span:first-child{color:var(--muted)}
  .r span:last-child{font-family:var(--mono);font-weight:600;text-align:right}

  .bars{display:flex;align-items:flex-end;gap:4px;height:110px;margin-top:4px}
  .col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;cursor:pointer}
  .col .b{background:#BBD3EE;border-radius:3px 3px 0 0}
  .col.on .b{background:var(--blue)}
  .xaxis{display:flex;gap:4px;margin-top:5px}
  .xaxis span{flex:1;text-align:center;font-size:10px;color:var(--muted)}

  .chan{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--blue);padding:12px 14px}
  .chan.on{border-left-color:var(--orange)}
  .chan .lb{margin:0;font-size:12.5px;color:var(--muted)}
  .chan .num{margin:4px 0 0;font-family:var(--mono);font-size:17px;font-weight:700}
  .chan .sub{margin:3px 0 0;font-size:11.5px;color:var(--muted)}
  .stack{display:grid;gap:10px;margin-top:10px}

  table{width:100%;border-collapse:collapse;margin-top:10px;background:var(--card);
    border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:13px}
  th{background:#EDF2F8;text-align:right;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;
    color:var(--muted);padding:9px 10px;font-weight:600}
  th:first-child,td:first-child{text-align:left}
  td{padding:9px 10px;border-top:1px solid var(--line);text-align:right;
    font-variant-numeric:tabular-nums;font-family:var(--mono)}
  td:first-child{font-family:inherit}
  tr.total td{background:#EDF2F8;font-weight:700;border-top:2px solid var(--blue)}

  .todo{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--amber);
    padding:14px;font-size:12.5px;color:var(--muted);margin-top:10px}
  .todo b{color:var(--ink)}
  .todo ul{margin:8px 0 0;padding-left:18px}.todo li{margin-bottom:5px}
  code{background:#EDF2F8;padding:1px 5px;border-radius:4px;font-family:var(--mono);font-size:11.5px;color:var(--ink)}
  footer{margin-top:22px;font-size:11px;color:var(--muted)}
</style>
</head>
<body>
<div class="wrap">

  <div class="tags">
    <span class="tag b">Doanh thu · 01–10/08/2026</span>
    <span class="tag g">Đạt 42,1% base</span>
    <span class="tag a">10/08 chưa chốt sổ</span>
  </div>
  <h1>BHX Mỹ Qưới · 28717</h1>
  <p class="meta">Size chuẩn · loại kho 1,2 – &lt;2 tỷ · Thành phố Cần Thơ</p>

  <div class="hero">
    <p class="lb">Doanh thu lũy kế tháng 8</p>
    <p class="num">384.017.441 đ</p>
    <p class="sub">2.685 bill · giá trị bill BQ 143.023 đ</p>
  </div>

  <div class="grid">
    <div class="kpi green">
      <p class="lb">Trung bình ngày</p>
      <p class="num">39.161.353</p>
      <p class="sub">9 ngày đã chốt</p>
    </div>
    <div class="kpi violet">
      <p class="lb">Dự kiến tháng 8</p>
      <p class="num">1.214.002.000</p>
      <p class="sub">≈ 1,21 tỷ · 133% base</p>
    </div>
  </div>

  <h2>CHỌN NGÀY ĐỂ XEM CHI TIẾT</h2>
  <div class="picker">
    <div class="days" id="days"></div>
    <div class="bars" id="bars"></div>
    <div class="xaxis" id="xaxis"></div>
    <div class="panel">
      <p class="dt" id="p-date">—</p>
      <p class="big" id="p-total">—</p>
      <span class="delta" id="p-delta">—</span>
      <div class="rows" id="p-rows"></div>
    </div>
  </div>

  <h2>MỤC TIÊU BASE THÁNG 8</h2>
  <div class="hero gr">
    <p class="lb">Tiến độ base · 10/31 ngày (32,3% thời gian)</p>
    <p class="num">42,1%</p>
    <p class="sub">384.017.441 / 912.700.000 đ</p>
    <div class="prog"><span style="flex:0 0 42.1%"></span><span style="flex:1;background:transparent"></span></div>
  </div>
  <div class="grid">
    <div class="kpi blue">
      <p class="lb">Cần bán mỗi ngày còn lại</p>
      <p class="num">25.175.360</p>
      <p class="sub">21 ngày · đang chạy 39,16 tr</p>
    </div>
    <div class="kpi amber">
      <p class="lb">Vượt base dự kiến</p>
      <p class="num">+301.301.957</p>
      <p class="sub">Nếu giữ nhịp hiện tại</p>
    </div>
  </div>
  <table>
    <tr><th>Base</th><th>MT tháng</th><th>BQ ngày</th><th>Cơ cấu</th></tr>
    <tr><td>FMCG</td><td>755.500.000</td><td>24.370.968</td><td>82,8%</td></tr>
    <tr><td>Fresh</td><td>157.200.000</td><td>5.070.968</td><td>17,2%</td></tr>
    <tr class="total"><td>Tổng</td><td>912.700.000</td><td>29.441.935</td><td>100%</td></tr>
  </table>

  <h2>TỶ TRỌNG KÊNH BÁN</h2>
  <div class="stack">
    <div class="chan">
      <p class="lb">Offline</p>
      <p class="num">348.290.960 đ</p>
      <p class="sub">90,7% · 2.640 bill</p>
    </div>
    <div class="chan on">
      <p class="lb">Online</p>
      <p class="num">35.726.481 đ</p>
      <p class="sub">9,3% · 45 bill · dồn vào 01–02/08</p>
    </div>
  </div>

  <h2>PHÂN TÍCH NHÓM HÀNG — CHỜ SỐ THỰC HIỆN</h2>
  <div class="todo">
    <b>Đã có base, còn thiếu doanh thu thực hiện theo nhóm</b>
    <p style="margin:8px 0 0">Anh bổ sung vào file “Dữ liệu Nhóm hàng”:</p>
    <ul>
      <li><code>Ngày</code> · <code>Nhóm hàng</code> (FMCG, Fresh và ngành con)</li>
      <li><code>Doanh thu thực hiện</code> (đã VAT) · <code>Mục tiêu base</code></li>
      <li><code>Giá vốn</code> · <code>Hủy hỏng</code> cho nhóm Fresh</li>
    </ul>
  </div>

  <footer>Nguồn: Google Sheet “Dữ liệu Báo cáo Doanh thu” · lập 10/08/2026</footer>
</div>

<script>
var D=[
 {d:"01/08",off:28591438.83,on:11176401.91,bo:244,bn:7},
 {d:"02/08",off:28963394.89,on:12360800.07,bo:247,bn:7},
 {d:"03/08",off:34262441.01,on:1322998.62,bo:282,bn:4},
 {d:"04/08",off:29985559.34,on:3948999.48,bo:276,bn:4},
 {d:"05/08",off:41457346.38,on:1601000.64,bo:296,bn:5},
 {d:"06/08",off:38546907.09,on:1872000.24,bo:285,bn:8},
 {d:"07/08",off:36264997.69,on:1998340.02,bo:253,bn:5},
 {d:"08/08",off:36365942.18,on:1153799.40,bo:265,bn:4},
 {d:"09/08",off:42579813.22,on:0,bo:268,bn:0},
 {d:"10/08",off:31273119.65,on:292140.12,bo:224,bn:1}
];
var TB=39161353;
D.forEach(function(x){x.tot=x.off+x.on;x.bill=x.bo+x.bn;});
var MAX=Math.max.apply(null,D.map(function(x){return x.tot;}));
function f(n){return Math.round(n).toLocaleString('vi-VN');}
function pct(a,b){return (Math.round((a/b-1)*1000)/10);}

var days=document.getElementById('days'),bars=document.getElementById('bars'),xa=document.getElementById('xaxis');
D.forEach(function(x,i){
  var e=document.createElement('div');e.className='day';e.dataset.i=i;
  e.innerHTML='<b>'+x.d.slice(0,2)+'</b><i>'+(Math.round(x.tot/1e6*10)/10).toString().replace('.',',')+' tr</i>';
  e.onclick=function(){sel(i);};days.appendChild(e);
  var c=document.createElement('div');c.className='col';c.dataset.i=i;
  c.innerHTML='<div class="b" style="height:'+(x.tot/MAX*100)+'%"></div>';
  c.onclick=function(){sel(i);};bars.appendChild(c);
  var s=document.createElement('span');s.textContent=x.d.slice(0,2);xa.appendChild(s);
});

function sel(i){
  var x=D[i],prev=i>0?D[i-1]:null;
  [].forEach.call(days.children,function(e,k){e.className='day'+(k===i?' on':'');});
  [].forEach.call(bars.children,function(e,k){e.className='col'+(k===i?' on':'');});
  document.getElementById('p-date').textContent='Ngày '+x.d+'/2026';
  document.getElementById('p-total').textContent=f(x.tot)+' đ';
  var dl=document.getElementById('p-delta');
  if(prev){var p=pct(x.tot,prev.tot);dl.className='delta '+(p>=0?'up':'down');
    dl.textContent=(p>=0?'▲ +':'▼ ')+p.toString().replace('.',',')+'% so với '+prev.d;}
  else{dl.className='delta up';dl.textContent='Ngày đầu tháng';}
  var vsTB=pct(x.tot,TB);
  document.getElementById('p-rows').innerHTML=
   '<div class="r"><span>Doanh thu offline</span><span>'+f(x.off)+' đ</span></div>'+
   '<div class="r"><span>Doanh thu online</span><span>'+f(x.on)+' đ</span></div>'+
   '<div class="r"><span>Tổng bill</span><span>'+x.bill+' ('+x.bo+' + '+x.bn+')</span></div>'+
   '<div class="r"><span>Giá trị bill BQ</span><span>'+f(x.tot/x.bill)+' đ</span></div>'+
   '<div class="r"><span>So trung bình ngày</span><span>'+(vsTB>=0?'+':'')+vsTB.toString().replace('.',',')+'%</span></div>';
}
sel(D.length-1);
</script>
</body>
</html>
`;

app.get("/", (req, res) => {
  res.send("LINE Bot is running!");
});

app.get("/report", (req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(REPORT_HTML);
});

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      if (!CHANNEL_SECRET || !ACCESS_TOKEN) {
        console.error("Missing LINE environment variables");
        return res.sendStatus(500);
      }

      const signature = req.headers["x-line-signature"];
      if (!signature || !req.body) {
        return res.sendStatus(400);
      }

      // Xác minh chữ ký bằng đúng raw body LINE gửi lên.
      const expected = crypto
        .createHmac("sha256", CHANNEL_SECRET)
        .update(req.body)
        .digest("base64");

      const a = Buffer.from(expected);
      const b = Buffer.from(signature);

      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.sendStatus(401);
      }

      const data = JSON.parse(req.body.toString("utf8"));

      for (const event of data.events || []) {
        if (
          event.type !== "message" ||
          !event.message ||
          event.message.type !== "text" ||
          !event.replyToken
        ) {
          continue;
        }

        const userMessage = event.message.text || "";
        const normalized = userMessage
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

        let replyText;

        if (normalized.includes("bc sức khỏe")) {
          replyText =
            "📊 BC SỨC KHỎE đã sẵn sàng.\n\n" +
            "BHX Mỹ Qưới · 28717\n" +
            "Doanh thu lũy kế T8: 384.017.441 đ\n" +
            "Offline: 348.290.960 đ (90,7%)\n" +
            "Online: 35.726.481 đ (9,3%)\n\n" +
            "👉 Xem báo cáo chi tiết:\n" +
            BASE_URL +
            "/report";
        } else if (normalized === "hello" || normalized === "hi") {
          replyText = "Xin chào anh 👋";
        } else {
          replyText =
            "Anh vừa nhắn: " +
            userMessage +
            "\n\nGõ “BC SỨC KHỎE” để xem báo cáo.";
        }

        const response = await fetch(
          "https://api.line.me/v2/bot/message/reply",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + ACCESS_TOKEN,
            },
            body: JSON.stringify({
              replyToken: event.replyToken,
              messages: [
                {
                  type: "text",
                  text: replyText,
                },
              ],
            }),
          }
        );

        if (!response.ok) {
          console.error(
            "LINE reply failed:",
            response.status,
            await response.text()
          );
        }
      }

      return res.sendStatus(200);
    } catch (error) {
      console.error("Webhook error:", error);
      return res.sendStatus(500);
    }
  }
);

app.listen(PORT, () => {
  console.log("LINE Bot running on port " + PORT);
  console.log("Report: " + BASE_URL + "/report");
});
