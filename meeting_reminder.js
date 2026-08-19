const fs=require('fs'),path=require('path');
const FILE=path.join(__dirname,'data','meetings.json');
fs.mkdirSync(path.dirname(FILE),{recursive:true});
const TZ='Asia/Ho_Chi_Minh';
function load(){try{return JSON.parse(fs.readFileSync(FILE,'utf8'))}catch{return[]}}
function save(x){fs.writeFileSync(FILE,JSON.stringify(x,null,2))}
function nowParts(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const o={};for(const x of p)o[x.type]=x.value;return o}
function vnDateString(d){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
function parseMeeting(text){const s=String(text||'').normalize('NFC');if(!/lịch\s*họp/i.test(s))return null;const m=s.match(/(?:lúc\s*)?(\d{1,2})\s*(?:h|:|giờ)\s*(\d{0,2})?/i);if(!m)return null;const hour=Number(m[1]),minute=m[2]?Number(m[2]):0;if(hour>23||minute>59)return null;const p=nowParts();let y=Number(p.year),mo=Number(p.month),day=Number(p.day);let dt=new Date(Date.UTC(y,mo-1,day,hour-7,minute,0));if(dt.getTime()<=Date.now())dt.setUTCDate(dt.getUTCDate()+1);return {when:dt.toISOString(),hour,minute,date:vnDateString(dt),text:s.trim()}}
function add(text,target){const m=parseMeeting(text);if(!m)return null;const items=load().filter(x=>x.target!==target||x.when!==m.when);const item={id:Date.now().toString(36),...m,target,reminded:false,createdAt:new Date().toISOString()};items.push(item);save(items);return item}
function list(){return load()}
function removeTarget(target){const a=load(),b=a.filter(x=>x.target!==target);save(b);return a.length-b.length}
function due(){const now=Date.now();const a=load(),due=a.filter(x=>!x.reminded&&new Date(x.when).getTime()-now<=30*60000&&new Date(x.when).getTime()-now>0);if(due.length){const ids=new Set(due.map(x=>x.id));save(a.map(x=>ids.has(x.id)?{...x,reminded:true}:x))}return due}
function format(item){return `📅 LỊCH HỌP ĐÃ GHI\n\n🕐 ${String(item.hour).padStart(2,'0')}h${String(item.minute).padStart(2,'0')}\n📆 ${item.date}\n\n⏰ Bot sẽ nhắc anh trước 30 phút.`}
module.exports={TZ,parseMeeting,add,list,removeTarget,due,format};
