const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const count=value=>Number.isSafeInteger(value)&&value>=0;
const number=value=>typeof value==='number'&&Number.isFinite(value);
const text=(value,maximum=1000)=>typeof value==='string'&&value.trim().length>0&&Array.from(value).length<=maximum;
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const instant=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)&&Number.isFinite(Date.parse(value));
const exam=value=>['uceed','ceed','nid','nift'].includes(value);
const percent=value=>number(value)&&value>=0&&value<=100;
const reject=()=>{throw new Error('The saved workspace response could not be verified.');};
export function overviewStartId(value){if(!uuid(value))reject();return value;}
export function overviewSnapshot(history,access,analytics,papers){
 if(!Array.isArray(history)||!object(access)||typeof access.active!=='boolean'||(access.active?!instant(access.expiresAt):access.expiresAt!==null&&!instant(access.expiresAt))||!object(analytics)||!Array.isArray(papers))reject();
 const attempts=history.map(item=>{
  if(!object(item)||!uuid(item.id)||!text(item.title)||!['active','submitted'].includes(item.status)||typeof item.resultsPending!=='boolean'||(item.score!==null&&!number(item.score))||(item.total!==null&&(!number(item.total)||item.total<0))||(item.cohortRank!=null&&(!count(item.cohortRank)||item.cohortRank===0))||item.resultsPending&&(item.score!==null||item.cohortRank!=null))reject();
  return{id:item.id,title:item.title,status:item.status,resultsPending:item.resultsPending,score:item.score,total:item.total,cohortRank:item.cohortRank??null};
 });
 if(new Set(attempts.map(item=>item.id)).size!==attempts.length||!count(analytics.completed)||!count(analytics.waitingForResults)||analytics.waitingForResults>analytics.completed||!count(analytics.objectiveAnswered)||(analytics.objectiveAccuracy!==null&&!percent(analytics.objectiveAccuracy))||!Array.isArray(analytics.topics)||!Array.isArray(analytics.exams)||!object(analytics.drawingReviews)||!count(analytics.drawingReviews.pending)||!count(analytics.drawingReviews.released))reject();
 const topics=analytics.topics.map(item=>{if(!object(item)||!text(item.topic)||!count(item.answered)||item.answered===0||!count(item.correct)||item.correct>item.answered||!percent(item.accuracy))reject();return{topic:item.topic,answered:item.answered,correct:item.correct,accuracy:item.accuracy};});
 const exams=analytics.exams.map(item=>{if(!object(item)||!exam(item.exam)||!count(item.attempts)||item.attempts===0||!number(item.averagePercent)||!number(item.bestPercent))reject();return{exam:item.exam,attempts:item.attempts,averagePercent:item.averagePercent,bestPercent:item.bestPercent};});
 if(new Set(topics.map(item=>item.topic)).size!==topics.length||new Set(exams.map(item=>item.exam)).size!==exams.length)reject();
 let activeAttempt=null,recommendedTopic=null;
 if(analytics.activeAttempt!=null){const item=analytics.activeAttempt;if(!object(item)||!uuid(item.id)||!text(item.title)||!instant(item.deadline))reject();activeAttempt={id:item.id,title:item.title,deadline:item.deadline};}
 if(analytics.recommendedTopic!=null){const item=analytics.recommendedTopic;if(!object(item)||!text(item.topic)||!count(item.answered)||item.answered===0||!percent(item.accuracy))reject();recommendedTopic={topic:item.topic,answered:item.answered,accuracy:item.accuracy};}
 const catalog=papers.map(item=>{if(!object(item)||!uuid(item.id)||!text(item.title)||!exam(item.exam)||!Number.isSafeInteger(item.durationSeconds)||item.durationSeconds<1||typeof item.qualityHeld!=='boolean')reject();return{id:item.id,title:item.title,exam:item.exam,durationSeconds:item.durationSeconds,qualityHeld:item.qualityHeld};});
 if(new Set(catalog.map(item=>item.id)).size!==catalog.length)reject();
 return{data:{attempts,access:{active:access.active,expiresAt:access.expiresAt},analytics:{completed:analytics.completed,waitingForResults:analytics.waitingForResults,objectiveAnswered:analytics.objectiveAnswered,objectiveAccuracy:analytics.objectiveAccuracy,topics,exams,activeAttempt,recommendedTopic,drawingReviews:{pending:analytics.drawingReviews.pending,released:analytics.drawingReviews.released}}},papers:catalog};
}
export async function loadOverview(services,signal){
 signal.throwIfAborted();const finalized=await services.rpc('finalize_my_expired_attempts',undefined,signal);signal.throwIfAborted();if(!count(finalized))reject();
 const values=await Promise.all(['my_attempt_history','my_pass','my_overview_analytics','available_papers'].map(name=>services.rpc(name,undefined,signal)));signal.throwIfAborted();return overviewSnapshot(...values);
}
