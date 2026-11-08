// Operator-only conversion. Exam facts are versioned; no scoring defaults are inferred.
function freeze(value){for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);return Object.freeze(value);}
export const RULES_2027=freeze({
 uceed:{version:'iitb-2027-v1',exam:'uceed',cycle:2027,source:'https://www.uceed.iitb.ac.in/2027/assets/downloads/docs/UCEED2027_Information_Brochure.pdf',pages:'29–31',durationSeconds:7200,sections:{NAT:{count:14,correct:4,wrong:0},MSQ:{count:15,correct:4,wrong:-1,partial:true},MCQ:{count:28,correct:3,wrong:-0.71}},partB:{durationSeconds:3600,tasks:2,points:50}},
 ceed:{version:'iitb-2027-v1',exam:'ceed',cycle:2027,source:'https://www.ceed.iitb.ac.in/2027/downloads/CEED2027_Brochure.pdf',pages:'2–3',durationSeconds:3600,sections:{NAT:{count:8,correct:4,wrong:0},MSQ:{count:10,correct:4,wrong:-1,partial:true},MCQ:{count:26,correct:3,wrong:-0.5}},partB:{durationSeconds:7200,tasks:5,points:20}},
 nift:{version:'niftee-2027-bdes-v1',exam:'nift',programme:'bdes',cycle:2027,source:'https://nift.ac.in/sites/default/files/2026-10/Information%20Bulletin%20-NIFTEE%202027%20-16.10.2026.pdf',pages:'18–20',durationSeconds:7200,sections:{MCQ:{count:100,correct:1,wrong:-0.25}}},
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
// Structured issues contain locations and stable codes, never source text/keys.
// The legacy materializer and the correction queue use this same evaluation.
export function inspectRuntimeQuestion(question,{rule,mediaCatalog=[]}={}){
 const issues=[];
 const issue=(code,field,extra={})=>issues.push({code,field,...extra});
 const blocked=()=>({runtime:null,issues});
 if(!question||typeof question!=='object'||Array.isArray(question)){issue('invalid-record','question');return blocked();}
 const verified=Boolean(rule&&rule===RULES_2027[String(question.provenance?.exam).toLowerCase()]);
 if(!verified)issue('context-unverified','provenance.exam');
 if(!Array.isArray(question.holds)||question.holds.length)issue('holds-unresolved','holds');
 if(typeof question.prompt!=='string'||!question.prompt.trim())issue('prompt-missing','prompt');
 const assets=Array.isArray(question.assets??[])?question.assets??[]:[];
 if(!Array.isArray(question.assets??[]))issue('assets-invalid','assets');
 if(question.visualDependency&&!assets.length)issue('visual-assets-missing','assets');
 const catalogue=new Map((Array.isArray(mediaCatalog)?mediaCatalog:[]).filter(a=>a&&typeof a==='object').map(a=>[a.sha256,a])),media=[];
 for(const [index,asset]of assets.entries()){
  const stored=asset&&catalogue.get(asset.sha256);
  if(!asset||!/^[a-f0-9]{64}$/.test(asset.sha256)||!stored||stored.path!==`papers/canonical/${asset.sha256}.png`||stored.width!==asset.width||stored.height!==asset.height||!Number.isInteger(stored.byteSize)||stored.byteSize<45||stored.byteSize>10485760){issue('media-unverified','assets',{ordinal:index+1});continue;}
  media.push({path:stored.path,alt:`Question figure ${index+1}`,sha256:asset.sha256,width:asset.width,height:asset.height});
 }
 if(question.type==='DESCRIPTIVE'){
  if(verified&&!rule.partB)issue('section-unmodelled','type');
  if(verified&&rule.partB&&!assets.length)issue('drawing-figure-missing','assets');
  if(issues.length)return blocked();
  return{issues,runtime:{prompt:question.prompt,options:[],kind:'drawing',marking:{correct:rule.partB.points,wrong:0,humanReview:true},media,points:rule.partB.points,negativePoints:0,topic:question.topic||'drawing',key:{kind:'drawing',sourceExternalKey:question.externalKey},explanation:'Human review against the published task rubric.',context:{version:rule.version,exam:rule.exam,cycle:rule.cycle,source:rule.source,part:'B',durationSeconds:rule.partB.durationSeconds}}};
 }
 const scheme=verified?rule.sections?.[question.type]:null;
 if(verified&&!scheme)issue('section-unmodelled','type');
 if(question.answer?.status==='pending')issue('answer-pending','answer.status');
 const raw=String(question.answer?.raw??'').trim();
 if(!raw)issue('answer-missing','answer.raw');
 let key,options=[];
 if(question.type==='NAT'){
  key=numericKey(raw);
  if(raw&&!key)issue('answer-notation','answer.raw');
 }else if(['MCQ','MSQ'].includes(question.type)){
  const source=Array.isArray(question.options)?question.options:[];
  if(verified&&scheme&&source.length!==4)issue('option-count','options');
  else if(source.length<2)issue('choice-options-missing','options');
  const labelsValid=source.length>=2&&source.every(o=>o&&typeof o.key==='string'&&o.key.trim())&&new Set(source.map(o=>o.key)).size===source.length;
  if(source.length>=2&&(source.some(o=>!o||typeof o.key!=='string'||!o.key.trim())||new Set(source.map(o=>o?.key)).size!==source.length))issue('option-labels','options');
  if(source.some(o=>o?.asset))issue('option-asset-unmapped','options');
  if(source.some(o=>o?.text!=null&&typeof o.text!=='string'))issue('option-text-invalid','options');
  else if(!assets.length&&source.some(o=>!o?.text?.trim()))issue('option-text-missing','options');
  if(labelsValid){
   options=source.map(o=>({id:o.key,label:typeof o.text==='string'&&o.text.trim()||o.key}));
   const ids=options.map(o=>o.id);
   if(question.type==='MCQ'){if(ids.includes(raw))key={kind:'mcq',correct:[raw]};}
   else{
    // Tokenize only complete supported notation, preserving the previous rules.
    const selected=ids.includes(raw)?[raw]:/^[A-Za-z]+$/.test(raw)&&ids.every(id=>/^[A-Za-z]$/.test(id))?raw.split(''):raw.split(/[\s,;&/]+/);
    if(selected.length&&selected.every(id=>ids.includes(id))&&new Set(selected).size===selected.length)key={kind:'msq',correct:[...selected].sort()};
   }
   if(raw&&!key)issue('answer-notation','answer.raw');
  }
 }
 if(issues.length)return blocked();
 if(!key){issue('section-unmodelled','type');return blocked();}
 key.sourceExternalKey=question.externalKey;
 const marking={correct:scheme.correct,wrong:scheme.wrong,...(scheme.partial?{partial:true}:{})};
 return{issues,runtime:{prompt:question.prompt,options,kind:question.type.toLowerCase(),marking,media,points:scheme.correct,negativePoints:Math.abs(scheme.wrong),topic:question.topic||'unclassified',key,explanation:question.explanation||`Answer key: ${raw}`,context:{version:rule.version,exam:rule.exam,...(rule.programme?{programme:rule.programme}:{}),cycle:rule.cycle,source:rule.source}}};
}
export function runtimeQuestion(question,options){return inspectRuntimeQuestion(question,options).runtime;}
