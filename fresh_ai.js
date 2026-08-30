"use strict";

const fs=require("fs");
const path=require("path");
const XLSX=require("xlsx");

function createFreshAI(options={}){
  const askAI=options.askAI;
  if(typeof askAI!=="function")throw new Error("Cần truyền askAI(question, context)");

  const dataDir=options.dataDir||path.join(process.cwd(),"data","fresh_ai");
  const jsonFile=path.join(dataDir,"fresh_latest.json");
  const xlsxFile=path.join(dataDir,"fresh_latest.xlsx");
  fs.mkdirSync(dataDir,{recursive:true});

  const sessions=new Map();
  const OPEN=new Set(["FRESH","NAP FRESH","NHAP FRESH","NAP DU LIEU FRESH","NAP DATA FRESH","CAP NHAT FRESH"]);
  const VIEW=new Set(["BC FRESH","DATA FRESH","XEM DATA FRESH","XEM LAI DATA FRESH","DOC DATA FRESH","KIEM TRA DATA FRESH"]);
  const ANALYZE=new Set(["PHAN TICH FRESH","PHAN TICH DATA FRESH","DOC FRESH","DOC DATA FRESH","PHAN TICH"]);

  const txt=v=>String(v??"").trim();
  const normalize=v=>txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim();
  const key=v=>normalize(v).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const num=v=>{
    if(typeof v==="number")return Number.isFinite(v)?v:0;
    let s=txt(v).replace(/\s/g,"").replace(/đ|vnd/ig,"");
    if(s.includes(",")&&s.includes("."))s=s.replace(/\./g,"").replace(",",".");
    else if(s.includes(","))s=s.replace(",",".");
    const x=Number(s.replace(/[^0-9.-]/g,""));
    return Number.isFinite(x)?x:0;
  };
  const vnd=x=>Math.round(Number(x||0)).toLocaleString("vi-VN")+"đ";

  function read(){
    try{return fs.existsSync(jsonFile)?JSON.parse(fs.readFileSync(jsonFile,"utf8")):null}
    catch(e){console.error("❌ FRESH READ",e.message);return null}
  }

  function write(data){
    const tmp=jsonFile+".tmp";
    fs.writeFileSync(tmp,JSON.stringify(data,null,2));
    fs.renameSync(tmp,jsonFile);
    console.log("💾 FRESH AI → Đã lưu DATA FRESH");
  }

  function findHeader(rows){
    const hints=["ngay","ma san pham","ma hang","ten san pham","nganh hang","doanh thu","tong sl ban","sl ban","mat mat kiem ke","huy hao hut ncc","huy ton"];
    let best={index:0,score:-1};
    for(let i=0;i<Math.min(rows.length,40);i++){
      const s=(rows[i]||[]).map(key).join(" | ");
      let score=0;
      for(const h of hints)if(s.includes(h))score++;
      if(score>best.score)best={index:i,score};
    }
    return best.index;
  }

  function isFreshCommand(t){return OPEN.has(normalize(t));}

  function headerMap(headers){
    const m={};
    headers.forEach((v,i)=>{
      const k=key(v);
      if(!k)return;
      if(m.date===undefined&&/(^ngay$|ngay giao dich|date)/.test(k))m.date=i;
      if(m.sku===undefined&&/(ma san pham|ma hang|sku|ma sp)/.test(k))m.sku=i;
      if(m.name===undefined&&/(ten san pham|ten hang|ten sp)/.test(k))m.name=i;
      if(m.group===undefined&&/(nganh hang|nhom hang|category|group)/.test(k))m.group=i;
      if(m.revenue===undefined&&/(doanh thu|revenue|thanh tien ban|gia tri ban)/.test(k))m.revenue=i;
      if(m.soldQty===undefined&&/(tong sl thuc xuat|tong sl ban|sl ban|so luong ban)/.test(k))m.soldQty=i;
      if(m.stockLossQty===undefined&&/(sl mat mat kiem ke|mat mat kiem ke)/.test(k))m.stockLossQty=i;
      if(m.vendorLossQty===undefined&&/(sl huy hao hut ncc|huy hao hut ncc|hhncc)/.test(k))m.vendorLossQty=i;
      if(m.destroyQty===undefined&&/(sl huy ton|huy ton)/.test(k))m.destroyQty=i;
    });
    return m;
  }

  function parse(buffer,fileName){
    const wb=XLSX.read(buffer,{type:"buffer",cellDates:true});
    const raw=[];
    for(const sheetName of wb.SheetNames){
      const ws=wb.Sheets[sheetName];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:true});
      if(!rows.length)continue;
      const hi=findHeader(rows);
      const m=headerMap(rows[hi]||[]);
      for(let r=hi+1;r<rows.length;r++){
        const row=rows[r]||[];
        if(!row.some(v=>txt(v)!==""))continue;
        raw.push({
          sheet:sheetName,row:r+1,
          date:m.date===undefined?"":row[m.date],
          sku:m.sku===undefined?"":txt(row[m.sku]),
          name:m.name===undefined?"":txt(row[m.name]),
          group:m.group===undefined?"":txt(row[m.group]),
          revenue:m.revenue===undefined?0:num(row[m.revenue]),
          soldQty:m.soldQty===undefined?0:num(row[m.soldQty]),
          stockLossQty:m.stockLossQty===undefined?0:num(row[m.stockLossQty]),
          vendorLossQty:m.vendorLossQty===undefined?0:num(row[m.vendorLossQty]),
          destroyQty:m.destroyQty===undefined?0:num(row[m.destroyQty])
        });
      }
    }

    const freshGroups=new Set([
      "rau cu cac loai",
      "thit gia cam gia suc cac loai",
      "thuy hai san cac loai",
      "trai cay cac loai"
    ]);

    const fresh=raw.filter(x=>freshGroups.has(key(x.group)));
    const cpRows=fresh.filter(x=>txt(x.name).toUpperCase().includes("C.P"));
    const revenue=fresh.reduce((s,x)=>s+x.revenue,0);
    const soldQty=fresh.reduce((s,x)=>s+x.soldQty,0);

    const priceBySku=new Map();
    for(const x of raw){
      const k=x.sku||x.name;
      if(!k)continue;
      const a=priceBySku.get(k)||{revenue:0,sold:0};
      a.revenue+=x.revenue;
      a.sold+=x.soldQty;
      priceBySku.set(k,a);
    }

    const byProduct=new Map();
    let skippedNoSold=0;
    for(const x of fresh){
      const k=x.sku||x.name||("ROW_"+x.row);
      const a=byProduct.get(k)||{sku:x.sku,name:x.name,group:x.group,stockLossQty:0,vendorLossQty:0,destroyQty:0,estimatedLoss:0,revenue:x.revenue,soldQty:x.soldQty,days:new Set()};
      a.stockLossQty+=x.stockLossQty;
      a.vendorLossQty+=x.vendorLossQty;
      a.destroyQty+=x.destroyQty;
      if(x.date!=="")a.days.add(String(x.date));
      byProduct.set(k,a);
    }

    for(const [k,a] of byProduct){
      if(txt(a.name).toUpperCase().includes("C.P"))continue;
      const p=priceBySku.get(k)||{revenue:0,sold:0};
      const lossQty=a.stockLossQty+a.vendorLossQty+a.destroyQty;
      if(p.sold===0){if(lossQty!==0)skippedNoSold++;continue}
      a.estimatedLoss=lossQty*(p.revenue/p.sold);
    }

    const products=[...byProduct.values()].map(a=>({
      ...a,
      days:[...a.days],
      lossQty:a.stockLossQty+a.vendorLossQty+a.destroyQty
    })).filter(x=>!txt(x.name).toUpperCase().includes("C.P"))
      .sort((a,b)=>Math.abs(b.estimatedLoss)-Math.abs(a.estimatedLoss));

    const totals=products.reduce((o,x)=>{
      o.stockLossQty+=x.stockLossQty;
      o.vendorLossQty+=x.vendorLossQty;
      o.destroyQty+=x.destroyQty;
      o.estimatedLoss+=x.estimatedLoss;
      return o;
    },{stockLossQty:0,vendorLossQty:0,destroyQty:0,estimatedLoss:0});

    totals.lossQty=totals.stockLossQty+totals.vendorLossQty+totals.destroyQty;
    totals.revenue=revenue;
    totals.soldQty=soldQty;
    totals.lossPct=revenue?totals.estimatedLoss/revenue*100:0;

    const groups={};
    for(const x of products){
      const g=x.group||"Không xác định";
      const a=groups[g]||{name:g,estimatedLoss:0,stockLossQty:0,vendorLossQty:0,destroyQty:0};
      a.estimatedLoss+=x.estimatedLoss;
      a.stockLossQty+=x.stockLossQty;
      a.vendorLossQty+=x.vendorLossQty;
      a.destroyQty+=x.destroyQty;
      groups[g]=a;
    }

    return {
      rowCount:raw.length,
      freshRowCount:fresh.length,
      cpRowsExcludedFromLoss:cpRows.length,
      skippedNoSold,
      totals,
      groups:Object.values(groups).sort((a,b)=>b.estimatedLoss-a.estimatedLoss),
      topProducts:products.slice(0,80)
    };
  }

  function overview(data){
    const s=data.summary,t=s.totals;
    return [
      "🌿 DATA FRESH ĐÃ LƯU",
      "📎 File: "+data.fileName,
      "📊 Tổng dòng: "+s.rowCount.toLocaleString("vi-VN"),
      "🥬 Dòng FRESH: "+s.freshRowCount.toLocaleString("vi-VN"),
      "",
      "💰 Doanh thu FRESH: "+vnd(t.revenue),
      "🔴 Hao hụt ước tính: "+vnd(t.estimatedLoss),
      "📉 Tỷ lệ hao hụt: "+Number(t.lossPct||0).toFixed(2)+"%",
      "",
      "💬 Anh có thể hỏi: PHÂN TÍCH FRESH, MÃ NÀO HAO NHIỀU NHẤT, hoặc hỏi trực tiếp về FRESH."
    ].join("\n");
  }

  function context(data){
    return JSON.stringify({
      title:"DATA FRESH MỚI NHẤT - CHỈ PHÂN TÍCH DỰA TRÊN DATA NÀY",
      fileName:data.fileName,
      savedAt:data.savedAt,
      rules:{
        revenue:"Doanh thu FRESH giữ đủ mọi mã, kể cả C.P",
        cp:"Mã có tên chứa C.P chỉ bị loại khỏi phần tính hao hụt",
        lossMoney:"Tiền hao hụt ước tính theo doanh thu / tổng SL thực xuất của từng mã trên toàn file",
        negative:"Số lượng âm được giữ nguyên để bù trừ"
      },
      summary:data.summary
    }).slice(0,28000);
  }

  async function saveFile({buffer,fileName,userId}){
    if(!Buffer.isBuffer(buffer))throw new Error("Buffer file không hợp lệ");
    if(!/\.(xlsx|xls|xlsm|csv)$/i.test(fileName||""))throw new Error("FRESH chỉ nhận file Excel/CSV");
    const summary=parse(buffer,fileName);
    fs.writeFileSync(xlsxFile,buffer);
    const data={version:2,type:"FRESH",fileName:fileName||"fresh_latest.xlsx",savedAt:new Date().toISOString(),savedBy:userId||"",summary};
    write(data);
    return data;
  }

  async function handleFile({buffer,fileName,userId}){
    if(!sessions.has(userId))return {handled:false,messages:[]};
    try{
      const data=await saveFile({buffer,fileName,userId});
      sessions.delete(userId);
      console.log("📊 FRESH AI → Đọc và lưu DATA FRESH:",data.fileName);
      return {handled:true,messages:["🌿 ĐÃ NHẬN VÀ LƯU DATA FRESH\n\n"+overview(data)],data};
    }catch(e){
      sessions.delete(userId);
      return {handled:true,messages:["❌ Không đọc được file FRESH: "+String(e.message||e)]};
    }
  }

  async function analyze(question){
    const data=read();
    if(!data)return "📭 Chưa có DATA FRESH. Anh gõ NẠP FRESH rồi gửi file Excel.";
    const prompt="Anh đang hỏi về DATA FRESH mới nhất. Chỉ dùng dữ liệu trong context được cung cấp. Không bịa số liệu. Nếu dữ liệu chưa đủ để kết luận thì nói rõ. Xưng em, gọi người dùng là anh. Trả lời dễ đọc trên LINE.\n\nCÂU HỎI: "+(txt(question)||"Phân tích tổng quan Fresh.");
    return askAI(prompt,context(data));
  }

  async function handleText({text,userId}){
    const t=normalize(text);
    if(!t)return {handled:false,messages:[]};
    if(isFreshCommand(t)){
      sessions.set(userId,{startedAt:Date.now()});
      return {handled:true,messages:["🌿 ĐÃ MỞ PHIÊN NHẬN DATA FRESH\n\n📎 Anh gửi 1 file Excel FRESH ngay sau tin nhắn này.\n🔒 DATA FRESH cũ chỉ thay khi file mới đọc thành công."]};
    }
    if(VIEW.has(t)){
      const d=read();
      return {handled:true,messages:[d?overview(d):"📭 Chưa có DATA FRESH. Anh gõ NẠP FRESH và gửi file."]};
    }
    if(t.includes("FRESH")||ANALYZE.has(t)){
      return {handled:true,messages:[await analyze(text)]};
    }
    return {handled:false,messages:[]};
  }

  return {handleText,handleFile,analyze,getLatest:read,hasLatest:()=>!!read(),overview,isFreshCommand};
}

module.exports={createFreshAI};
