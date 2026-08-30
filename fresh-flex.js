const XANH = "#14432A";
const XANH_NHAT = "#9FD5B4";
const DO = "#A32D2D";
const XAM = "#667085";
const VANG_NEN = "#FFF6E9";
const VANG_CHU = "#8A5A00";

function tien(v) {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2).replace(".", ",")} tỷ`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace(".", ",")} tr`;
  if (abs >= 1e3) return `${Math.round(n / 1e3)} ng`;
  return `${Math.round(n)}đ`;
}
function so(v) { return Number(v || 0).toLocaleString("vi-VN", { maximumFractionDigits: 0 }); }
function pct(v) { return `${Number(v || 0).toFixed(1).replace(".", ",")}%`; }
function safe(s) { return String(s ?? "").slice(0, 120); }
function dong(nhan,giaTri,phu,mauGiaTri){
  const c=[
    {type:"text",text:safe(nhan),size:"xs",color:XAM,flex:5,gravity:"center"},
    {type:"text",text:safe(giaTri),size:"sm",weight:"bold",align:"end",flex:3,gravity:"center",color:mauGiaTri||"#111111"}
  ];
  if(phu!==null&&phu!==undefined)c.push({type:"text",text:safe(phu),size:"xxs",color:XAM,align:"end",flex:2,gravity:"center"});
  return {type:"box",layout:"horizontal",spacing:"sm",contents:c};
}
function buildFreshFlex(data){
  const base=String(process.env.PUBLIC_BASE_URL||process.env.RENDER_EXTERNAL_URL||"https://ng-bot-c0im.onrender.com").replace(/\/$/,"");
  const ky=data.ky||{},t=data.tong||{},sl=data.sl||{},cb=data.canhBao||{};
  const url=`${base}/fresh/${ky.date||"moi-nhat"}`;
  const khoangNgay=`${ky.tu||""} – ${ky.den||""}`;
  const tong=Number(sl.matMat||0)+Number(sl.hhncc||0)+Number(sl.huyTon||0)||1;
  const nganhRows=(data.nganh||[]).slice(0,4).map(x=>({type:"box",layout:"horizontal",spacing:"sm",contents:[
    {type:"text",text:safe(x.ten),size:"xs",flex:5,gravity:"center"},
    {type:"text",text:tien(x.tien),size:"xs",weight:"bold",align:"end",flex:3,gravity:"center"},
    {type:"text",text:pct(x.p),size:"xxs",color:Number(x.p)>=10?DO:XAM,align:"end",flex:2,gravity:"center"}
  ]}));
  const body=[
    dong("MẤT MÁT KIỂM KÊ",so(sl.matMat),pct(Number(sl.matMat||0)/tong*100)),
    dong("HỦY HAO HỤT NCC",so(sl.hhncc),pct(Number(sl.hhncc||0)/tong*100)),
    dong("HỦY TỒN",so(sl.huyTon),pct(Number(sl.huyTon||0)/tong*100)),
    {type:"separator",margin:"md"},
    {type:"box",layout:"horizontal",spacing:"sm",margin:"md",contents:[
      {type:"text",text:"TỶ LỆ / DOANH THU",size:"sm",weight:"bold",flex:5},
      {type:"text",text:pct(t.tyLe),size:"md",weight:"bold",color:DO,align:"end",flex:3}
    ]},
    dong("Doanh thu FRESH",tien(t.dt),null),
    dong("Trung bình mỗi ngày",tien(t.tbNgay),null),
    {type:"separator",margin:"md"},
    {type:"text",text:"THEO NGÀNH HÀNG",size:"sm",weight:"bold",margin:"md"}
  ].concat(nganhRows);
  if(Number(cb.soMa||0)>0)body.push({type:"box",layout:"vertical",margin:"md",paddingAll:"10px",cornerRadius:"6px",backgroundColor:VANG_NEN,contents:[
    {type:"text",text:`⚠ ${so(cb.soMa)} mã hao nhiều hơn bán — cần kiểm chứng`,size:"xxs",color:VANG_CHU,wrap:true}
  ]});
  return {type:"flex",altText:`BC FRESH ${safe(data.sieuThi||"MỸ QUỚI")} ${khoangNgay} — hao hụt ${tien(t.tien)}`,contents:{
    type:"bubble",size:"mega",
    header:{type:"box",layout:"vertical",backgroundColor:XANH,paddingAll:"18px",contents:[
      {type:"text",text:"BC FRESH",color:XANH_NHAT,size:"xs",weight:"bold"},
      {type:"text",text:safe(data.sieuThi||"MỸ QUỚI"),color:"#FFFFFF",size:"xl",weight:"bold",margin:"sm"},
      {type:"text",text:`${tien(t.tien)} • ${khoangNgay}`,color:"#FFFFFF",size:"lg",weight:"bold",margin:"sm"}
    ]},
    body:{type:"box",layout:"vertical",spacing:"sm",contents:body},
    footer:{type:"box",layout:"vertical",paddingAll:"12px",contents:[
      {type:"button",style:"primary",color:XANH,action:{type:"uri",label:"Xem chi tiết từng ngày",uri:url}}
    ]}
  }};
}
module.exports={buildFreshFlex,tien,so,pct};