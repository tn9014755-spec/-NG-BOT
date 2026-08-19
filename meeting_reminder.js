const fs=require('fs'),path=require('path');
const TZ='Asia/Ho_Chi_Minh';
const DIR=process.env.BC_DATA_DIR||'/tmp/bc';
const FILE=path.join(DIR,'nhac-lich.json');
fs.mkdirSync(DIR,{recursive:true});
function load(){try{const x=JSON.parse(fs.readFileSync(FILE,'utf8'));return Array.isArray(x)?x:[]}catch{return[]}}
function save(x){fs.mkdirSync(DIR,{recursive:true});fs.writeFileSync(FILE,JSON.stringify(x,null,2),'utf8')}
function nowParts(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date()),o={};for(const x of p)o[x.type]=x.value;return o}
function vnDateString(d){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
function parseMeeting(text){const s=String(text||'').normalize('NFC').trim();const m=s.match(/^(.*?)\s+(\d{1,2})\s*(?:h|:|giờ)\s*(\d{0,2})?(?:\s+@[^\s]+)?$/i);if(!m)return null;const content=m[1].trim(),hour=Number(m[2]),minute=m[3]?Number(m[3]):0;if(!content||hour>23||minute>59)return null;const p=nowParts();let y=Number(p.year),mo=Number(p.month),day=Number(p.day);let dt=new Date(Date.UTC(y,mo-1,day,hour-7,minute,0));if(dt.getTime()<=Date.now())dt.setUTCDate(dt.getUTCDate()+1);return {when:dt.toISOString(),hour,minute,date:vnDateString(dt),content}}
function add(text,target,userId){const m=parseMeeting(text);if(!m)return null;const items=load().filter(x=>x.target!==target||x.when!==m.when||x.userId!==userId);const item={id:Date.now().toString(36),content:m.content,when:m.when,hour:m.hour,minute:m.minute,date:m.date,userId:userId||'',target:target||'',sent:false,createdAt:new Date().toISOString()};items.push(item);save(items);return item}
function list(){return load().filter(x=>new Date(x.when).getTime()>Date.now()&&!x.sent)}
function removeTarget(target){const a=load(),b=a.filter(x=>x.target!==target);save(b);return a.length-b.length}
function due(){const now=Date.now(),a=load(),due=a.filter(x=>!x.sent&&new Date(x.when).getTime()<=now);if(due.length){const ids=new Set(due.map(x=>x.id));save(a.map(x=>ids.has(x.id)?{...x,sent:true,sentAt:new Date().toISOString()}:x))}return due}
function format(item){return `📅 ĐÃ GHI NHẮC LỊCH\n\n📝 ${item.content}\n🕐 ${String(item.hour).padStart(2,'0')}h${String(item.minute).padStart(2,'0')}\n📆 ${item.date}\n\n⏰ Bot sẽ nhắc đúng giờ.`}
module.exports={TZ,parseMeeting,add,list,removeTarget,due,format,FILE};
