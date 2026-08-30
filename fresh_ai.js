"use strict";

const fs=require("fs");
const path=require("path");
const {analyzeFresh,laFileFresh}=require("./fresh_hao_hut");
const {buildFreshFlex}=require("./fresh-flex");

function createFreshAI(options={}){
  const askAI=options.askAI;
  const dataDir=options.dataDir||"/tmp/fresh";
  fs.mkdirSync(dataDir,{recursive:true});

  const latestFile=path.join(dataDir,"latest.json");
  const sessions=new Map();

  function normalize(v){
    return String(v??"").trim().normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .toUpperCase().replace(/\s+/g," ");
  }

  function fileForDate(date){
    return path.join(dataDir,"fresh-"+String(date||"").replace(/[^\d-]/g,"")+".json");
  }

  function atomicWrite(file,data){
    const tmp=file+".tmp";
    fs.writeFileSync(tmp,JSON.stringify(data,null,2));
    fs.renameSync(tmp,file);
  }

  function readFile(file){
    try{return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,"utf8")):null;}
    catch(e){console.error("❌ FRESH READ",e.message);return null;}
  }

  function save(data,fileName,userId){
    const now=new Date().toISOString();
    const date=data?.ky?.date||now.slice(0,10);
    const payload={
      version:3,
      type:"BC FRESH",
      fileName:String(fileName||""),
      savedAt:now,
      savedBy:userId||"",
      data
    };
    atomicWrite(fileForDate(date),payload);
    atomicWrite(latestFile,payload);
    console.log("💾 FRESH → Đã lưu JSON",date);
    return payload;
  }

  function getLatest(){return readFile(latestFile);}
  function getByDate(date){return readFile(fileForDate(date));}
  function hasLatest(){return !!getLatest();}

  function isFreshCommand(text){
    const t=normalize(text);
    return ["NAP FRESH","NHAP FRESH"].includes(t);
  }

  function isFreshView(text){
    return normalize(text)==="BC FRESH";
  }

  async function handleFile({buffer,fileName,userId}){
    const active=sessions.has(userId);
    if(!laFileFresh(buffer)){
      if(active){
        sessions.delete(userId);
        return {handled:true,messages:["❌ File này không đúng cấu trúc FRESH. Cần có đủ 3 cột SL mất mát kiểm kê, SL hủy hao hụt NCC, SL hủy tồn."]};
      }
      return {handled:false,messages:[]};
    }
    try{
      const data=analyzeFresh(buffer);
      const payload=save(data,fileName,userId);
      sessions.delete(userId);
      console.log("📊 FRESH → Phân tích xong",fileName,"| hao",data.tong.tien);
      return {handled:true,messages:[buildFreshFlex(data)],data,payload};
    }catch(e){
      console.error("❌ FRESH FILE ERROR",e);
      sessions.delete(userId);
      return {handled:true,messages:["❌ Xử lý file FRESH lỗi: "+String(e.message||e).slice(0,180)]};
    }
  }

  async function analyze(question){
    const payload=getLatest();
    if(!payload)return "📭 Chưa có BC FRESH. Anh gõ NẠP FRESH và gửi file.";
    if(typeof askAI!=="function")return "📊 BC FRESH đã có. AI phân tích chưa được cấu hình.";
    const context="DỮ LIỆU BC FRESH MỚI NHẤT:\n"+JSON.stringify(payload.data).slice(0,28000);
    return askAI("Anh đang hỏi về BC FRESH. Chỉ dùng dữ liệu trong context, bám đúng số liệu, không bịa. "+String(question||"Phân tích tổng quan FRESH."),context);
  }

  async function handleText({text,userId}){
    const t=normalize(text);
    if(!t)return {handled:false,messages:[]};

    if(["NAP FRESH","NHAP FRESH"].includes(t)){
      sessions.set(userId,{startedAt:Date.now()});
      return {handled:true,messages:["🌿 ĐÃ MỞ PHIÊN NHẬN DATA FRESH\n\n📎 Anh gửi 1 file Excel FRESH ngay sau tin nhắn này.\n🔒 DATA FRESH cũ chỉ thay khi file mới đọc thành công."]};
    }

    if(t==="BC FRESH"){
      const payload=getLatest();
      return {handled:true,messages:[payload?buildFreshFlex(payload.data):"📭 Chưa có BC FRESH. Anh gõ NẠP FRESH và gửi file."]};
    }

    if(t.includes("FRESH")){
      const payload=getLatest();
      if(!payload)return {handled:true,messages:["📭 Chưa có BC FRESH. Anh gõ NẠP FRESH và gửi file."]};
      const answer=await analyze(text);
      return {handled:true,messages:[answer]};
    }

    return {handled:false,messages:[]};
  }

  return {
    handleText,
    handleFile,
    analyze,
    getLatest,
    getByDate,
    hasLatest,
    isFreshCommand,
    isFreshView,
    dataDir
  };
}

module.exports={createFreshAI};
