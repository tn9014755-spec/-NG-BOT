const fs=require('fs'),path=require('path');
const DIR=process.env.BC_DATA_DIR||'/tmp/bc',FILE=path.join(DIR,'lich-ca.json');fs.mkdirSync(DIR,{recursive:true});
const CA={1:{gio:'6h-8h',dai:2,buoi:'SÁNG'},2:{gio:'8h-12h',dai:4,buoi:'SÁNG'},3:{gio:'12h-14h',dai:2,buoi:'SÁNG'},4:{gio:'14h-16h',dai:2,buoi:'CHIỀU'},5:{gio:'16h-18h',dai:2,buoi:'CHIỀU'},6:{gio:'18h-21h',dai:3,buoi:'CHIỀU'}};
const hai=n=>String(n).padStart(2,'0');
const text=o=>String(o??'').trim();
const laNgay=o=>/\(\s*\d{1,2}\s*\/\s*\d{1,2}\s*\)/.test(text(o));
const laCa=o=>/^ca\s*[1-6]$/i.test(text(o));
const coCa=v=>{if(v===null||v===undefined)return false;if(typeof v==='number')return Number.isFinite(v)&&v>0;const s=text(v).toLowerCase();if(!s||s==='0'||s==='-'||s==='—'||s==='–')return false;const n=Number(s.replace(',','.'));return Number.isFinite(n)?n>0:true};
const giaTri=v=>{if(typeof v==='number'&&Number.isFinite(v)&&v>0)return v;const n=Number(text(v).replace(',','.'));return Number.isFinite(n)&&n>0?n:1};

function docLichCa(rows,nam){
  const year=nam||new Date().getFullYear();
  let dongNgay=-1,max=0;
  for(let r=0;r<Math.min(rows.length,25);r++){const n=(rows[r]||[]).filter(laNgay).length;if(n>max){max=n;dongNgay=r}}
  if(dongNgay<0)throw Error('Không tìm thấy dòng ngày lịch ca');
  let dongCa=-1;
  for(let r=dongNgay;r<=Math.min(dongNgay+5,rows.length-1);r++){if((rows[r]||[]).filter(laCa).length>=3){dongCa=r;break}}
  if(dongCa<0)throw Error('Không tìm thấy dòng Ca 1..Ca 6');
  const hd=rows[dongNgay]||[],hc=rows[dongCa]||[];
  let cotTen=hc.findIndex(x=>/^h[ọo]\s*t[êe]n$/i.test(text(x)));
  if(cotTen<0)cotTen=hd.findIndex(x=>/^h[ọo]\s*t[êe]n$/i.test(text(x)));
  if(cotTen<0)cotTen=hc.findIndex(x=>text(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'').toLowerCase()==='hoten');
  if(cotTen<0)cotTen=1;
  const moc=[];
  for(let c=0;c<hd.length;c++){const m=text(hd[c]).match(/\(\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\)/);if(m)moc.push({cot:c,ngay:+m[1],thang:+m[2]})}
  if(!moc.length)throw Error('Không đọc được ngày');
  const out={};
  for(let i=0;i<moc.length;i++){
    const m=moc[i],den=i+1<moc.length?moc[i+1].cot:Math.max(hd.length,hc.length,...rows.map(r=>(r||[]).length));
    const cols={};
    for(let c=m.cot;c<den;c++){const g=text(hc[c]).match(/^ca\s*([1-6])$/i);if(g)cols[+g[1]]=c}
    let y=year;if(i>0&&m.thang<moc[i-1].thang)y++;
    const key=`${y}-${hai(m.thang)}-${hai(m.ngay)}`;
    for(let r=dongCa+1;r<rows.length;r++){
      const row=rows[r]||[],name=text(row[cotTen]);
      if(!name||/^h[ọo]\s*t[êe]n$/i.test(name))continue;
      const shifts={};
      for(let ca=1;ca<=6;ca++){const c=cols[ca];if(c!==undefined&&coCa(row[c]))shifts[ca]=giaTri(row[c])}
      if(Object.keys(shifts).length)(out[key]||(out[key]={}))[name]=shifts;
    }
  }
  if(!Object.keys(out).length)throw Error('Không có dữ liệu nhân viên');
  return out;
}
function docLich(){try{const x=JSON.parse(fs.readFileSync(FILE,'utf8'));return x&&typeof x==='object'?x:{}}catch{return{}}}
function luuLich(n){if(!n||typeof n!=='object'||!Object.keys(n).length)throw Error('Lịch mới rỗng');const old=docLich(),merged={...old,...n};for(const [ngay,ds] of Object.entries(n))if(!ds||typeof ds!=='object'||!Object.keys(ds).length)throw Error(`Dữ liệu lịch ngày ${ngay} rỗng`);fs.mkdirSync(DIR,{recursive:true});const tmp=FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(merged,null,2),'utf8');fs.renameSync(tmp,FILE);const ds=Object.keys(n).sort();return{soNgayMoi:ds.length,tuNgay:ds[0],denNgay:ds[ds.length-1],soNgayTong:Object.keys(merged).length}}
function theCaNgay(lich,ngay){
  const d=ngay instanceof Date?ngay:new Date(ngay),k=`${d.getFullYear()}-${hai(d.getMonth()+1)}-${hai(d.getDate())}`,day=lich?.[k];
  if(!day)return{type:'flex',altText:`Chưa có lịch ${k}`,contents:{type:'bubble',body:{type:'box',layout:'vertical',contents:[{type:'text',text:'CA LÀM VIỆC',weight:'bold',size:'lg'},{type:'text',text:k,weight:'bold',size:'xl'},{type:'text',text:'Chưa có lịch cho ngày này.',size:'sm',color:'#7b8798',margin:'md'}]}}};
  const groups=[['🌅 CA SÁNG',[1,2,3],'#1d4ed8','#eff5ff'],['🌆 CA CHIỀU',[4,5,6],'#0f9d58','#f0fdf4']];
  const blocks=[];
  for(const [title,cas,color,bg] of groups){
    const people=Object.entries(day).map(([name,shifts])=>({name,ca:cas.filter(c=>shifts&&Object.prototype.hasOwnProperty.call(shifts,c))})).filter(x=>x.ca.length);
    const rows=people.map(x=>({type:'text',text:`${x.name} — CA ${x.ca.join('')}`,size:'sm',wrap:true,color:'#334155',margin:'sm'}));
    blocks.push({type:'box',layout:'vertical',backgroundColor:bg,cornerRadius:'10px',paddingAll:'12px',margin:'md',contents:[{type:'text',text:title,weight:'bold',size:'md',color},...(rows.length?rows:[{type:'text',text:'Chưa có nhân viên',size:'sm',color:'#94a3b8',margin:'sm'}])]});
  }
  return{type:'flex',altText:`Ca làm việc ${k}`,contents:{type:'bubble',size:'kilo',body:{type:'box',layout:'vertical',paddingAll:'16px',contents:[{type:'text',text:'CA LÀM VIỆC',size:'xs',weight:'bold',color:'#7b8798'},{type:'text',text:k,size:'xl',weight:'bold',color:'#0b2452',margin:'xs'},...blocks]}}};
}
module.exports={docLichCa,luuLich,docLich,theCaNgay,CA};