// Operator-only conversion. Exam facts are versioned; no scoring defaults are inferred.
function freeze(value){for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);return Object.freeze(value);}
export const RULES_2027=freeze({
 uceed:{version:'iitb-2027-v1',exam:'uceed',cycle:2027,source:'https://www.uceed.iitb.ac.in/2027/assets/downloads/docs/UCEED2027_Information_Brochure.pdf',pages:'29–31',durationSeconds:7200,sections:{NAT:{count:14,correct:4,wrong:0},MSQ:{count:15,correct:4,wrong:-1,partial:true},MCQ:{count:28,correct:3,wrong:-0.71}}},
 ceed:{version:'iitb-2027-v1',exam:'ceed',cycle:2027,source:'https://www.ceed.iitb.ac.in/2027/downloads/CEED2027_Brochure.pdf',pages:'2–3',durationSeconds:3600,sections:{NAT:{count:8,correct:4,wrong:0},MSQ:{count:10,correct:4,wrong:-1,partial:true},MCQ:{count:26,correct:3,wrong:-0.5}}},
});
const number='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const numeric=new RegExp(`^${number}$`);
const range=new RegExp(`^(${number})\\s*(?:to|–|-)\\s*(${number})$`,'i');
function decimalAtMost(left,right){
 const parts=value=>{const negative=value[0]==='-';const [whole,fraction='']=value.replace(/^[+-]/,'').split('.');return{negative,whole:whole||'0',fraction};};
 const a=parts(left),b=parts(right),places=Math.max(a.fraction.length,b.fraction.length);
 const integer=p=>BigInt(p.whole+p.fraction.padEnd(places,'0'))*(p.negative?-1n:1n);
 return integer(a)<=integer(b);
}
function numericKey(raw){
 if(raw.length>200)return null;
 // Preserve decimal precision for PostgreSQL numeric. Never invent a tolerance.
 if(numeric.test(raw)&&Number.isFinite(Number(raw)))return{kind:'nat',accepted:[{exact:raw}]};
 const match=raw.match(range);
 if(match&&Number.isFinite(Number(match[1]))&&Number.isFinite(Number(match[2]))&&decimalAtMost(match[1],match[2]))return{kind:'nat',accepted:[{range:[match[1],match[2]]}]};
 return null;
}
export function runtimeQuestion(question,{rule,mediaCatalog=[]}={}){
 if(!rule||rule!==RULES_2027[String(question.provenance?.exam).toLowerCase()])return null;
 const scheme=rule.sections?.[question.type];
 if(!scheme||!Array.isArray(question.holds)||question.holds.length||typeof question.prompt!=='string'||!question.prompt.trim()||!question.answer||question.answer.status==='pending')return null;
 const raw=String(question.answer.raw??'').trim();if(!raw)return null;
 const assets=question.assets??[];
 if(!Array.isArray(assets)||(question.visualDependency&&!assets.length))return null;
 const catalogue=new Map(mediaCatalog.map(a=>[a.sha256,a]));const media=[];
 for(const asset of assets){
  const stored=catalogue.get(asset.sha256);
  if(!/^[a-f0-9]{64}$/.test(asset.sha256)||!stored||stored.path!==`papers/canonical/${asset.sha256}.png`||stored.width!==asset.width||stored.height!==asset.height||!Number.isInteger(stored.byteSize)||stored.byteSize<45||stored.byteSize>10485760)return null;
  media.push({path:stored.path,alt:`Question figure ${media.length+1}`,sha256:asset.sha256,width:asset.width,height:asset.height});
 }
 let key;let options=[];
 if(question.type==='NAT')key=numericKey(raw);
 else{
  if(!Array.isArray(question.options)||question.options.length!==4||question.options.some(o=>!o||typeof o.key!=='string'||!o.key.trim()||o.asset))return null;
  options=question.options.map(o=>({id:o.key,label:String(o.text?.trim()||o.key)}));
  const ids=options.map(o=>o.id);if(new Set(ids).size!==4)return null;
  if(!assets.length&&question.options.some(o=>!o.text?.trim()))return null;
  if(question.type==='MCQ'){if(ids.includes(raw))key={kind:'mcq',correct:[raw]};}
  else{
   // Tokenize only supported complete notation; never filter unknown text into a valid key.
   const selected=ids.includes(raw)?[raw]:/^[A-Za-z]+$/.test(raw)&&ids.every(id=>/^[A-Za-z]$/.test(id))?raw.split(''):raw.split(/[\s,;&/]+/);
   if(selected.length&&selected.every(id=>ids.includes(id))&&new Set(selected).size===selected.length)key={kind:'msq',correct:[...selected].sort()};
  }
 }
 if(!key)return null;
 key.sourceExternalKey=question.externalKey;
 const marking={correct:scheme.correct,wrong:scheme.wrong,...(scheme.partial?{partial:true}:{})};
 return{prompt:question.prompt,options,kind:question.type.toLowerCase(),marking,media,points:scheme.correct,negativePoints:Math.abs(scheme.wrong),topic:question.topic||'unclassified',key,explanation:question.explanation||`Answer key: ${raw}`,context:{version:rule.version,exam:rule.exam,cycle:rule.cycle,source:rule.source}};
}
