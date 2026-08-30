"use strict";

const XLSX=require("xlsx");

const FRESH_GROUPS=[
  "Rau Củ Các Loại",
  "Trái Cây Các Loại",
  "Thịt gia cầm gia súc các loại",
  "Thủy Hải Sản Các Loại"
];

const SHORT_GROUP={
  "Rau Củ Các Loại":"Rau Củ",
  "Trái Cây Các Loại":"Trái Cây",
  "Thịt gia cầm gia súc các loại":"Thịt gia cầm gia súc",
  "Thủy Hải Sản Các Loại":"Thủy Hải Sản"
};

function norm(v){
  return String(v??"").trim().normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g," ")
    .toLowerCase();
}

function num(v){
  if(typeof v==="number")return Number.isFinite(v)?v:0;
  const s=String(v??"").trim();
  if(!s)return 0;
  let x=s.replace(/\s/g,"").replace(/đ|vnd/ig,"");
  if(x.includes(",")&&x.includes(".")){
    x=x.replace(/\./g,"").replace(",",".");
  }else if(x.includes(",")){
    const a=x.split(",");
    if(a.length===2&&a[1].length<=3)x=x.replace(",",".");
    else x=x.replace(/,/g,"");
  }
  const n=Number(x.replace(/[^0-9.+-]/g,""));
  return Number.isFinite(n)?n:0;
}

function dayKey(v){
  if(v instanceof Date&&!isNaN(v)){
    return v.toISOString().slice(0,10);
  }
  if(typeof v==="number"&&v>20000&&v<80000){
    const d=XLSX.SSF.parse_date_code(v);
    if(d)return String(d.y).padStart(4,"0")+"-"+String(d.m).padStart(2,"0")+"-"+String(d.d).padStart(2,"0");
  }
  const s=String(v??"").trim();
  if(!s)return "";
  let m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if(m){
    const y=m[3].length===2?2000+Number(m[3]):Number(m[3]);
    return String(y).padStart(4,"0")+"-"+String(m[2]).padStart(2,"0")+"-"+String(m[1]).padStart(2,"0");
  }
  m=s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if(m)return m[1]+"-"+String(m[2]).padStart(2,"0")+"-"+String(m[3]).padStart(2,"0");
  const d=new Date(s);
  return isNaN(d)?"":d.toISOString().slice(0,10);
}

function displayDay(k){
  const m=String(k||"").match(/(\d{4})-(\d{2})-(\d{2})/);
  return m?m[3]+"/"+m[2]:"";
}

function findHeader(rows){
  const need=[
    "sl mat mat kiem ke",
    "sl huy hao hut ncc",
    "sl huy ton",
    "ma san pham",
    "ten san pham",
    "nganh hang"
  ];
  let best={row:-1,score:-1};
  for(let i=0;i<Math.min(rows.length,20);i++){
    const keys=(rows[i]||[]).map(norm);
    let score=0;
    for(const n of need)if(keys.includes(n))score++;
    if(score>best.score)best={row:i,score};
  }
  return best.score>=3?best.row:-1;
}

function mapHeaders(headers){
  const m={};
  (headers||[]).forEach((h,i)=>{
    const k=norm(h);
    if(k==="ngay xuat")m.date=i;
    else if(k==="ma sieu thi")m.storeCode=i;
    else if(k==="ten sieu thi")m.storeName=i;
    else if(k==="ma san pham")m.sku=i;
    else if(k==="ten san pham")m.name=i;
    else if(k==="nganh hang")m.group=i;
    else if(k==="don vi")m.unit=i;
    else if(k==="sl thuc xuat")m.sold=i;
    else if(k==="doanh thu")m.revenue=i;
    else if(k==="sl huy ton")m.huyTon=i;
    else if(k==="sl huy hao hut ncc")m.hhncc=i;
    else if(k==="sl mat mat kiem ke")m.matMat=i;
  });
  return m;
}

function laFileFresh(buf){
  try{
    const wb=XLSX.read(buf,{type:"buffer",cellDates:false});
    const ws=wb.Sheets[wb.SheetNames[0]];
    if(!ws)return false;
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});
    const hi=findHeader(rows);
    if(hi<0)return false;
    const h=(rows[hi]||[]).map(norm);
    return ["sl mat mat kiem ke","sl huy hao hut ncc","sl huy ton"].every(x=>h.includes(x));
  }catch(e){
    console.warn("⚠️ Không kiểm tra được loại file FRESH:",e.message);
    return false;
  }
}

function analyzeFresh(buf){
  const wb=XLSX.read(buf,{type:"buffer",cellDates:false});
  const ws=wb.Sheets[wb.SheetNames[0]];
  if(!ws)throw new Error("File FRESH không có Sheet1");
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});
  const hi=findHeader(rows);
  if(hi<0)throw new Error("Không tìm thấy dòng tiêu đề FRESH");
  const map=mapHeaders(rows[hi]);
  for(const k of ["sku","name","group","sold","revenue","huyTon","hhncc","matMat"]){
    if(map[k]===undefined)throw new Error("Thiếu cột bắt buộc trong file FRESH: "+k);
  }

  const raw=[];
  const priceBySku=new Map();
  let sieuThi="",storeCode="";
  for(let r=hi+1;r<rows.length;r++){
    const row=rows[r]||[];
    if(!row.some(v=>String(v??"").trim()!==""))continue;
    const x={
      date:map.date===undefined?"":dayKey(row[map.date]),
      sku:String(row[map.sku]??"").trim(),
      name:String(row[map.name]??"").trim(),
      group:String(row[map.group]??"").trim(),
      unit:map.unit===undefined?"":String(row[map.unit]??"").trim(),
      sold:num(row[map.sold]),
      revenue:num(row[map.revenue]),
      huyTon:num(row[map.huyTon]),
      hhncc:num(row[map.hhncc]),
      matMat:num(row[map.matMat])
    };
    if(!x.sku&&!x.name)continue;
    raw.push(x);
    if(!sieuThi&&map.storeName!==undefined)sieuThi=String(row[map.storeName]??"").trim();
    if(!storeCode&&map.storeCode!==undefined)storeCode=String(row[map.storeCode]??"").trim();
    const key=x.sku||x.name;
    const p=priceBySku.get(key)||{revenue:0,sold:0};
    p.revenue+=x.revenue;
    p.sold+=x.sold;
    priceBySku.set(key,p);
  }

  const freshSet=new Set(FRESH_GROUPS.map(norm));
  const products=new Map();
  const days=new Map();
  const groups=new Map();
  let cpRows=0,skippedNoSold=0;

  for(const x of raw){
    if(!freshSet.has(norm(x.group)))continue;

    const g=groups.get(x.group)||{ten:x.group,dt:0,tien:0,matMat:0,hhncc:0,huyTon:0};
    g.dt+=x.revenue;
    groups.set(x.group,g);

    const isCP=x.name.includes("C.P");
    if(isCP){cpRows++;continue;}

    const key=x.sku||x.name;
    const p=priceBySku.get(key)||{revenue:0,sold:0};
    const avg=p.sold!==0?p.revenue/p.sold:0;
    const qty=x.matMat+x.hhncc+x.huyTon;
    if(p.sold===0&&qty!==0)skippedNoSold++;

    const matMoney=x.matMat*avg;
    const nccMoney=x.hhncc*avg;
    const tonMoney=x.huyTon*avg;
    const money=qty*avg;

    const a=products.get(key)||{
      sku:x.sku,name:x.name,unit:x.unit,group:x.group,
      sold:p.sold,revenue:p.revenue,avg,
      matMat:0,hhncc:0,huyTon:0,tien:0
    };
    a.matMat+=x.matMat;
    a.hhncc+=x.hhncc;
    a.huyTon+=x.huyTon;
    a.tien+=money;
    products.set(key,a);

    g.tien+=money;
    g.matMat+=x.matMat;
    g.hhncc+=x.hhncc;
    g.huyTon+=x.huyTon;

    const dk=x.date||"khong-xac-dinh";
    const d=days.get(dk)||{date:dk,tien:0,items:new Map()};
    const di=d.items.get(key)||{
      sku:x.sku,name:x.name,unit:x.unit,group:x.group,
      matMat:0,hhncc:0,huyTon:0,matMoney:0,nccMoney:0,tonMoney:0,tien:0
    };
    di.matMat+=x.matMat;
    di.hhncc+=x.hhncc;
    di.huyTon+=x.huyTon;
    di.matMoney+=matMoney;
    di.nccMoney+=nccMoney;
    di.tonMoney+=tonMoney;
    di.tien+=money;
    d.tien+=money;
    d.items.set(key,di);
    days.set(dk,d);
  }

  const productList=[...products.values()].map(x=>({
    ...x,
    slHao:x.matMat+x.hhncc+x.huyTon
  })).sort((a,b)=>b.tien-a.tien);

  const allFreshRevenue=raw.reduce((s,x)=>freshSet.has(norm(x.group))?s+x.revenue:s,0);
  const allFreshDays=[...new Set(raw.filter(x=>freshSet.has(norm(x.group))&&x.date).map(x=>x.date))].sort();
  const dayList=[...days.values()]
    .filter(x=>x.date!=="khong-xac-dinh")
    .sort((a,b)=>a.date.localeCompare(b.date))
    .map(d=>({
      date:d.date,
      display:displayDay(d.date),
      tien:Math.round(d.tien),
      items:[...d.items.values()].map(x=>({
        ...x,
        slHao:x.matMat+x.hhncc+x.huyTon,
        tien:Math.round(x.tien),
        matMoney:Math.round(x.matMoney),
        nccMoney:Math.round(x.nccMoney),
        tonMoney:Math.round(x.tonMoney)
      })).filter(x=>x.slHao!==0||x.tien!==0)
        .sort((a,b)=>b.tien-a.tien)
    }));

  const total={
    matMat:productList.reduce((s,x)=>s+x.matMat,0),
    hhncc:productList.reduce((s,x)=>s+x.hhncc,0),
    huyTon:productList.reduce((s,x)=>s+x.huyTon,0),
    tien:productList.reduce((s,x)=>s+x.tien,0)
  };
  total.tien=Math.round(total.tien);

  const byGroup=FRESH_GROUPS.map(name=>{
    const g=groups.get(name)||{ten:name,dt:0,tien:0};
    return {ten:SHORT_GROUP[name]||name,tien:Math.round(g.tien),p:g.dt?g.tien/g.dt*100:0,dt:Math.round(g.dt),fullName:name};
  });

  const warning=productList.filter(x=>{
    const p=priceBySku.get(x.sku||x.name)||{sold:0};
    return x.slHao>p.sold&&x.slHao>0;
  });
  const warningMoney=Math.round(warning.reduce((s,x)=>s+x.tien,0));
  const surplus=productList.filter(x=>x.tien<0);

  const maxDay=dayList[dayList.length-1]||null;
  const prev=dayList.slice(0,-1);
  const avgCodes=prev.length?prev.reduce((s,d)=>s+d.items.length,0)/prev.length:0;
  const latestIncomplete=!!(maxDay&&prev.length&&maxDay.items.length<avgCodes*0.5);
  const fullDay=[...dayList].reverse().find(d=>d!==maxDay||!latestIncomplete)||null;

  const first=allFreshDays[0]||"";
  const last=allFreshDays[allFreshDays.length-1]||"";
  const dayCount=allFreshDays.length||dayList.length||1;

  const result={
    sieuThi:sieuThi||"MỸ QUỚI",
    ky:{tu:first?displayDay(first):"",den:last?displayDay(last):"",date:last||"moi-nhat"},
    tong:{
      tien:total.tien,
      dt:Math.round(allFreshRevenue),
      tyLe:allFreshRevenue?total.tien/allFreshRevenue*100:0,
      tbNgay:Math.round(total.tien/dayCount)
    },
    sl:{matMat:total.matMat,hhncc:total.hhncc,huyTon:total.huyTon},
    nganh:byGroup,
    canhBao:{soMa:warning.length,tien:warningMoney},
    meta:{
      totalRows:raw.length,
      freshRows:raw.filter(x=>freshSet.has(norm(x.group))).length,
      cpRowsExcluded:cpRows,
      skippedNoSold,
      storeCode,
      surplus:{soMa:surplus.length,tien:Math.round(surplus.reduce((s,x)=>s+x.tien,0))}
    },
    detail:{
      products:productList.map(x=>({...x,tien:Math.round(x.tien),avg:Math.round(x.avg)})),
      days:dayList,
      latestIncomplete,
      avgCodesPerDay:avgCodes,
      latest:maxDay,
      latestFull:fullDay,
      topProducts:productList.slice(0,14).map(x=>({...x,tien:Math.round(x.tien),avg:Math.round(x.avg)}))
    }
  };

  return result;
}

module.exports={analyzeFresh,laFileFresh,FRESH_GROUPS};
