// Operator-only conversion. Exam facts are versioned; no scoring defaults are inferred.
import { encodeWorkedExplanation, validateWorkedSolution } from '../src/worked-solution.js';
function freeze(value){for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);return Object.freeze(value);}
export const RULES_2027=freeze({
 uceed:{version:'iitb-2027-v1',exam:'uceed',cycle:2027,source:'https://www.uceed.iitb.ac.in/2027/assets/downloads/docs/UCEED2027_Information_Brochure.pdf',pages:'29–31',durationSeconds:7200,sections:{NAT:{count:14,correct:4,wrong:0},MSQ:{count:15,correct:4,wrong:-1,partial:true},MCQ:{count:28,correct:3,wrong:-0.71}},partB:{durationSeconds:3600,tasks:2,points:50}},
 ceed:{version:'iitb-2027-v1',exam:'ceed',cycle:2027,source:'https://www.ceed.iitb.ac.in/2027/downloads/CEED2027_Brochure.pdf',pages:'2–3',durationSeconds:3600,sections:{NAT:{count:8,correct:4,wrong:0},MSQ:{count:10,correct:4,wrong:-1,partial:true},MCQ:{count:26,correct:3,wrong:-0.5}},partB:{durationSeconds:7200,tasks:5,points:20}},
 nift:{version:'niftee-2027-bdes-v1',exam:'nift',programme:'bdes',cycle:2027,source:'https://nift.ac.in/sites/default/files/2026-10/Information%20Bulletin%20-NIFTEE%202027%20-16.10.2026.pdf',pages:'18–20',durationSeconds:7200,sections:{MCQ:{count:100,correct:1,wrong:-0.25}}},
});
const nidYearRules=new WeakSet();
// A historic NID paper has no general 2027 scoring context. Its private,
// reviewed release plan supplies the clock and marks for each exact question.
export function createNidYearRule(plan){
 if(plan?.format!=='dmocks-free-year-paper-v1'||plan.exam!=='nid'
  ||!Number.isInteger(plan.year)||!Number.isInteger(plan.durationSeconds)
  ||plan.durationSeconds<60||plan.durationSeconds>21600
  ||typeof plan.sourcePaperId!=='string'||!Array.isArray(plan.questions)
  ||new Set(plan.questions.map(item=>item.externalKey)).size!==plan.questions.length)
  throw new Error('Validated NID year-paper plan required');
 const questions=new Map(plan.questions.map(item=>[item.externalKey,{correct:item.marking.correct,wrong:item.marking.wrong}]));
 if([...questions.values()].some(mark=>!Number.isFinite(mark.correct)||mark.correct<=0||mark.correct>100
  ||!Number.isFinite(mark.wrong)||mark.wrong>0||mark.wrong< -100))
  throw new Error('Invalid historical NID marking');
 const rule=Object.freeze({version:'nid-historical-year-v1',exam:'nid',year:plan.year,
  sourcePaperId:plan.sourcePaperId,durationSeconds:plan.durationSeconds,
  markingReference:plan.markingReference,questions});
 nidYearRules.add(rule);
 return rule;
}
const number='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const numeric=new RegExp(`^${number}$`);
const range=new RegExp(`^(${number})\\s*(?:to|–|-)\\s*(${number})$`,'i');
const statedTolerance=new RegExp(`^(${number})\\s*\\(\\s*(${number})\\s*(?:to|–|-|~)\\s*(${number})\\s*\\)$`,'i');
const maxAlternativeNotationLength=200;
const alternativeSeparator=/\s+or\s+/i;
function decimalAtMost(left,right){
 const parts=value=>{const negative=value[0]==='-';const [whole,fraction='']=value.replace(/^[+-]/,'').split('.');return{negative,whole:whole||'0',fraction};};
 const a=parts(left),b=parts(right),places=Math.max(a.fraction.length,b.fraction.length);
 const integer=p=>BigInt(p.whole+p.fraction.padEnd(places,'0'))*(p.negative?-1n:1n);
 return integer(a)<=integer(b);
}
function singleNumericAnswer(raw){
 if(numeric.test(raw)&&Number.isFinite(Number(raw)))return{exact:raw};
 const match=raw.match(range);
 if(match&&Number.isFinite(Number(match[1]))&&Number.isFinite(Number(match[2]))&&decimalAtMost(match[1],match[2]))return{range:[match[1],match[2]]};
 return null;
}
function decimalIdentity(value){
 const [integer,fraction='']=value.replace(/^[+-]/,'').split('.');
 const whole=integer.replace(/^0+/,'')||'0',decimal=fraction.replace(/0+$/,'');
 const sign=value.startsWith('-')&&(whole!=='0'||decimal)?'-':'';
 return `${sign}${whole}.${decimal}`;
}
export function numericKey(raw,{allowRangeAlternatives=false}={}){
 if(raw.length>maxAlternativeNotationLength)return null;
 // Preserve decimal precision for PostgreSQL numeric. Never invent a tolerance.
 const single=singleNumericAnswer(raw);
 if(single)return{kind:'nat',accepted:[single]};
 if(allowRangeAlternatives){
  const stated=raw.match(statedTolerance);
  if(stated&&stated.slice(1).every(value=>Number.isFinite(Number(value)))
   &&decimalAtMost(stated[2],stated[1])&&decimalAtMost(stated[1],stated[3]))
   return{kind:'nat',accepted:[{range:[stated[2],stated[3]]}]};
 }
 const branches=raw.split(alternativeSeparator);
 if(branches.length<2||new Set(branches).size!==branches.length)return null;
 const accepted=branches.map(singleNumericAnswer);
 if(accepted.some(answer=>!answer))return null;
 // Exact-only alternatives retain their existing representation and acceptance.
 if(accepted.some(answer=>answer.range)){
  if(!allowRangeAlternatives)return null;
  const identities=accepted.map(answer=>(answer.range??[answer.exact,answer.exact]).map(decimalIdentity).join(':'));
  if(new Set(identities).size!==identities.length)return null;
 }
 return{kind:'nat',accepted};
}
function selectedOptionIds(type,raw,ids){
 if(ids.includes(raw))return[raw];
 if(type==='MCQ')return null;
 const selected=/^[A-Za-z]+$/.test(raw)&&ids.every(id=>/^[A-Za-z]$/.test(id))?raw.split(''):raw.split(/[\s,;&/]+/);
 if(!selected.every(id=>ids.includes(id))||new Set(selected).size!==selected.length)return null;
 return selected.sort();
}
function choiceKey(type,raw,ids,allowAlternatives){
 const kind=type.toLowerCase();
 // Some printed MSQ keys use "B. D" for the two labelled options. Accept
 // only that complete notation, not a dotted fragment inside an alternative.
 const dotted=type==='MSQ'&&/^[A-Za-z](?:\.\s+[A-Za-z])+$/.test(raw);
 const selected=selectedOptionIds(type,dotted?raw.replaceAll(/\.\s+/g,','):raw,ids);
 if(selected)return{kind,correct:selected};
 if(!allowAlternatives||raw.length>maxAlternativeNotationLength)return null;
 const branches=raw.split(alternativeSeparator);
 if(branches.length<2)return null;
 const alternatives=branches.map(branch=>selectedOptionIds(type,branch,ids));
 if(alternatives.some(answer=>!answer)||new Set(alternatives.map(answer=>JSON.stringify(answer))).size!==alternatives.length)return null;
 return type==='MCQ'?{kind,correct:alternatives.flat()}:{kind,alternatives};
}
// Structured issues contain locations and stable codes, never source text/keys.
// The legacy materializer and the correction queue use this same evaluation.
export function ownerAdjudicationEvidenceReady(question){
 const answer=question?.answer,review=question?.solutionReview;
 const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
 return answer?.status==='owner-adjudicated'
  &&exactKeys(answer,['raw','status'])&&typeof answer.raw==='string'&&answer.raw.trim().length>0
  &&exactKeys(review,['decision','fingerprint','solutionSha256'])
  &&review.decision==='owner-adjudicated'
  &&[review.fingerprint,review.solutionSha256].every(value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value))
  &&question.provenance&&typeof question.provenance==='object'
  &&!Object.hasOwn(question.provenance,'answerKeySource')
  &&typeof question.explanation==='string'&&question.explanation.trim().length>0
  &&!Object.hasOwn(question,'ownerAdjudication')&&!Object.hasOwn(question,'reviewer')
  &&!Object.hasOwn(question,'independentAnswer')&&!Object.hasOwn(question,'reasoning');
}
export function inspectRuntimeQuestion(question,{rule,mediaCatalog=[]}={}){
 const issues=[];
 const issue=(code,field,extra={})=>issues.push({code,field,...extra});
 const blocked=()=>({runtime:null,issues});
 if(!question||typeof question!=='object'||Array.isArray(question)){issue('invalid-record','question');return blocked();}
 const nidYear=rule&&nidYearRules.has(rule)&&String(question.provenance?.exam).toLowerCase()==='nid'
  &&question.provenance?.paperId===rule.sourcePaperId&&question.provenance?.year===rule.year;
 const verified=Boolean(rule&&(rule===RULES_2027[String(question.provenance?.exam).toLowerCase()]||nidYear));
 const allowAlternatives=verified&&(rule===RULES_2027.uceed||rule===RULES_2027.ceed||nidYear)&&typeof question.answer?.raw==='string';
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
  media.push({path:stored.path,alt:`Question figure ${index+1}`,sha256:asset.sha256,width:asset.width,height:asset.height,
   ...(asset.role==='solution'?{role:'solution'}:{})});
 }
 if(question.type==='DESCRIPTIVE'){
  if(verified&&!rule.partB)issue('section-unmodelled','type');
  if(verified&&rule.partB&&!assets.length)issue('drawing-figure-missing','assets');
  if(issues.length)return blocked();
  return{issues,runtime:{prompt:question.prompt,options:[],kind:'drawing',marking:{correct:rule.partB.points,wrong:0,humanReview:true},media,points:rule.partB.points,negativePoints:0,topic:question.topic||'drawing',key:{kind:'drawing',sourceExternalKey:question.externalKey},explanation:'Human review against the published task rubric.',context:{version:rule.version,exam:rule.exam,cycle:rule.cycle,source:rule.source,part:'B',section:'Part B',durationSeconds:rule.partB.durationSeconds}}};
 }
 const scheme=verified?(nidYear?rule.questions.get(question.externalKey):rule.sections?.[question.type]):null;
 if(verified&&!scheme)issue('section-unmodelled','type');
 if(question.answer?.status==='pending')issue('answer-pending','answer.status');
 if(question.answer?.status==='owner-adjudicated'&&!ownerAdjudicationEvidenceReady(question))issue('answer-adjudication','answer');
 const raw=String(question.answer?.raw??'').trim();
 if(!raw)issue('answer-missing','answer.raw');
 let key,options=[];
 // An owner decision (dropped item, an animation the printed paper cannot show, or no correct printed option)
 // awards every candidate full marks; score_response already grades {kind:'full_marks'}.
 const fullMarks=raw.toUpperCase()==='FULL MARKS';
 if(question.type==='NAT'){
  key=fullMarks?{kind:'full_marks'}:numericKey(raw,{allowRangeAlternatives:allowAlternatives});
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
   key=fullMarks?{kind:'full_marks'}:choiceKey(question.type,raw,options.map(o=>o.id),allowAlternatives);
   if(raw&&!key)issue('answer-notation','answer.raw');
  }
 }
 const solution=question.workedSolution===undefined?null:validateWorkedSolution(question.workedSolution,media);
 if(question.workedSolution!==undefined){
  const reviewed=[question.solutionReview?.fingerprint,question.solutionReview?.solutionSha256]
   .every(digest=>typeof digest==='string'&&/^[0-9a-f]{64}$/.test(digest));
  if(!solution||!reviewed||!['official-key','owner-adjudicated'].includes(question.answer?.status)||typeof question.explanation!=='string'
    ||!question.explanation.trim()||question.explanation.length>8000)issue('worked-solution-invalid','workedSolution');
 }
 if(issues.length)return blocked();
 if(!key){issue('section-unmodelled','type');return blocked();}
 key.sourceExternalKey=question.externalKey;
 const marking={correct:scheme.correct,wrong:scheme.wrong,...(scheme.partial?{partial:true}:{})};
 const explanation=solution?encodeWorkedExplanation(question.explanation,solution):question.explanation||`Answer key: ${raw}`;
 const context=nidYear?{version:rule.version,exam:'nid',scope:'historical-year-paper',year:rule.year,
  sourcePaperId:rule.sourcePaperId,durationSeconds:rule.durationSeconds,markingReference:rule.markingReference}
  :{version:rule.version,exam:rule.exam,...(rule.programme?{programme:rule.programme}:{}),cycle:rule.cycle,source:rule.source};
 return{issues,runtime:{prompt:question.prompt,options,kind:question.type.toLowerCase(),marking,media,points:scheme.correct,negativePoints:Math.abs(scheme.wrong),topic:question.topic||'unclassified',key,explanation,context}};
}
export function runtimeQuestion(question,options){return inspectRuntimeQuestion(question,options).runtime;}
