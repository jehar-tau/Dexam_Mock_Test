const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const text=(value,min,max)=>typeof value==='string'&&[...value].length>=min&&[...value].length<=max;
const base=value=>object(value)&&uuid(value.id)&&typeof value.slug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)&&['uceed','ceed','nid','nift'].includes(value.exam)&&typeof value.topic==='string'&&text(value.title,5,160)&&text(value.summary,10,500)&&typeof value.completed==='boolean';
// `locked`: the first lesson of each topic is free; the others come with the pass.
const item=value=>({...Object.fromEntries(['id','slug','exam','topic','title','summary','completed'].map(key=>[key,value[key]])),locked:value.locked===true});
const invalid=()=>new Error('Learning data could not be verified. Refresh lessons to try again.');
export const learningListMessage='Couldn’t load the lesson list. Refresh lessons to try again.';
export const learningReadMessage='Couldn’t open this lesson. Reload this lesson to try again.';
export const learningCompletionMessage='Couldn’t confirm lesson completion. Reload this lesson to check its saved progress before trying again.';
export function learningCatalogResponse(lessons,progress){
 const ids=new Set(),slugs=new Set();
 if(!Array.isArray(lessons)||!lessons.every(value=>base(value)&&!ids.has(value.id)&&!slugs.has(value.slug)&&ids.add(value.id)&&slugs.add(value.slug))||!object(progress)||!Number.isSafeInteger(progress.total)||progress.total!==lessons.length||!Number.isSafeInteger(progress.completed)||progress.completed!==lessons.filter(row=>row.completed).length||!Number.isInteger(progress.percent)||progress.percent!==(progress.total?Math.round(progress.completed*100/progress.total):0))throw invalid();
 let recommendation=null;
 if(progress.recommendation!==undefined&&progress.recommendation!==null){
  const value=progress.recommendation,matching=lessons.find(row=>row.id===value?.id);
  if(!object(value)||!matching||matching.completed||!['slug','exam','topic','title'].every(key=>value[key]===matching[key])||!Number.isSafeInteger(value.answered)||value.answered<0||!(value.answered===0?value.accuracy===null:Number.isInteger(value.accuracy)&&value.accuracy>=0&&value.accuracy<=100)||typeof value.reason!=='string'||!value.reason)throw invalid();
  recommendation=Object.fromEntries(['id','slug','exam','topic','title','answered','accuracy','reason'].map(key=>[key,value[key]]));
 }
 return{lessons:lessons.map(item),progress:{total:progress.total,completed:progress.completed,percent:progress.percent,recommendation}};
}
export function learningLessonResponse(value,expected){
 if(!base(value)||!text(value.body,20,50000)||value.id!==expected.id||value.slug!==expected.slug)throw invalid();
 return{...item(value),body:value.body};
}
export function learningCompletionReceipt(value){if(value!==null)throw invalid();}
export function learningUnavailable(error){return error?.code==='P0001'&&error?.message==='Lesson not found';}
