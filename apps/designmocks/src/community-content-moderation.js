import { communityReviewMedia, validateCommunityReviewContent, validateCommunityReviewHistory } from "./community-moderation.js";

const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const version=/^[0-9a-f]{64}$/;
const exams=new Set(["uceed","ceed","nid","nift"]);
const text=(value,max)=>typeof value==="string"&&value.length<=max;
const integer=(value,min=0)=>Number.isSafeInteger(value)&&value>=min;
const responseFailure=()=>Object.assign(new Error("The content response could not be verified. Refresh and try again."),{code:"community_moderation_response"});
const inputFailure=()=>Object.assign(new Error("Check the content filters and try again."),{code:"community_moderation_invalid"});
function dateMicros(value){
 if(typeof value!=="string")throw responseFailure();
 const match=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/.exec(value),milliseconds=Date.parse(value);
 if(!match||!Number.isSafeInteger(milliseconds)||new Date(milliseconds).toISOString().slice(0,19)!==match[1])throw responseFailure();
 return BigInt(milliseconds)*1000n+BigInt((match[2]??"").padEnd(6,"0").slice(3));
}
const sameFilters=(a,b)=>a.targetType===b.targetType&&a.postId===b.postId&&a.exam===b.exam&&a.topic===b.topic&&a.status===b.status;
const older=(a,b)=>dateMicros(a.createdAt)<dateMicros(b.createdAt)||dateMicros(a.createdAt)===dateMicros(b.createdAt)&&a.id<b.id;

export function communityModerationFilters(value={}){
 const targetType=value.targetType??"post",postId=value.postId??null;
 const exam=typeof value.exam==="string"?value.exam.trim().toLowerCase()||null:value.exam??null;
 const topic=typeof value.topic==="string"?value.topic.trim()||null:value.topic??null;
 const status=typeof value.status==="string"?value.status.trim()||null:value.status??null;
 if(!["post","comment"].includes(targetType)||(exam!==null&&!exams.has(exam))||(topic!==null&&(!text(topic,100)||!topic))||
  (status!==null&&!["visible","hidden","locked"].includes(status))||
  (targetType==="post"?postId!==null:!uuid.test(postId)||exam!==null||topic!==null||status==="locked"))throw inputFailure();
 return Object.freeze({targetType,postId,exam,topic,status});
}

function cursor(value,filters){
 if(!value||Array.isArray(value)||typeof value!=="object"||Object.keys(value).length!==9||
  !["createdAt","id","snapshotAt","version","targetType","postId","exam","topic","status"].every(key=>Object.hasOwn(value,key))||
  !uuid.test(value.id)||!integer(value.version,1)||!sameFilters(value,filters)||dateMicros(value.createdAt)>dateMicros(value.snapshotAt))throw responseFailure();
 return Object.freeze({createdAt:value.createdAt,id:value.id,snapshotAt:value.snapshotAt,version:value.version,...filters});
}

export function communityModerationPageInput(filters,next=null){
 const normalized=communityModerationFilters(filters);
 const continuation=next===null?null:cursor(next,normalized);
 return {p_target_type:normalized.targetType,p_post_id:normalized.postId,p_exam:normalized.exam,p_topic:normalized.topic,p_status:normalized.status,p_cursor:continuation,p_limit:25};
}

export function readCommunityModerationPage(value,filters,prior=null){
 const wanted=communityModerationFilters(filters);
 if(!value||!Array.isArray(value.items)||value.items.length>25||!integer(value.version,1)||!value.filters||
  Object.keys(value.filters).length!==5||!sameFilters(value.filters,wanted))throw responseFailure();
 const snapshot=dateMicros(value.snapshotAt);
 if(prior&&(!sameFilters(prior.filters,wanted)||!prior.nextCursor||value.version!==prior.version||value.snapshotAt!==prior.snapshotAt))throw responseFailure();
 const items=value.items.map(item=>{
  if(!item||!uuid.test(item.id)||item.kind!==wanted.targetType||!uuid.test(item.postId)||
   !(item.parentId===null||uuid.test(item.parentId))||!exams.has(item.exam)||!text(item.topic,100)||!text(item.body,5000)||
   !(item.kind==="post"?["visible","hidden","locked"]:["visible","hidden"]).includes(item.status)||
   !integer(item.assetCount)||item.assetCount>3||dateMicros(item.createdAt)>snapshot||
   (wanted.exam!==null&&item.exam!==wanted.exam)||(wanted.topic!==null&&item.topic!==wanted.topic)||(wanted.status!==null&&item.status!==wanted.status)||
   (item.kind==="post"?item.postId!==item.id||item.parentId!==null||!text(item.title,160)||!integer(item.comments):item.postId!==wanted.postId||item.title!==null||item.comments!==null))throw responseFailure();
  return {id:item.id,kind:item.kind,postId:item.postId,parentId:item.parentId,title:item.title,body:item.body,exam:item.exam,topic:item.topic,status:item.status,
   createdAt:item.createdAt,assetCount:item.assetCount,comments:item.comments};
 });
 for(let n=1;n<items.length;n++)if(!older(items[n],items[n-1]))throw responseFailure();
 const all=prior?[...prior.items,...items]:items;
 if(new Set(all.map(item=>item.id)).size!==all.length||prior&&items.length&&!older(items[0],prior.nextCursor))throw responseFailure();
 let next=null;
 if(value.nextCursor!==null){
  next=cursor(value.nextCursor,wanted);
  const last=items.at(-1);
  if(items.length!==25||next.version!==value.version||next.snapshotAt!==value.snapshotAt||next.id!==last.id||next.createdAt!==last.createdAt)throw responseFailure();
 }
 return {items:all,nextCursor:next,version:value.version,snapshotAt:value.snapshotAt,filters:wanted};
}

export function communityModerationGroups(view){
 const groups=[{context:"target",label:view.targetType==="post"?"Selected discussion":"Selected reply",content:view.target}];
 if(view.targetType==="comment"){
  if(view.parent)groups.push({context:"parent",label:"Parent reply",content:view.parent});
  groups.push({context:"post",label:"Discussion",content:view.post});
 }
 return groups;
}

export function readCommunityModerationView(value,targetType,targetId){
 try{
  if(!value||!["post","comment"].includes(targetType)||!uuid.test(targetId)||value.targetType!==targetType||value.targetId!==targetId||
   !version.test(value.reviewVersion)||typeof value.canRestore!=="boolean")throw responseFailure();
  const target=validateCommunityReviewContent(value.target),post=validateCommunityReviewContent(value.post),parent=value.parent===null?null:validateCommunityReviewContent(value.parent);
  if(target.id!==targetId||target.kind!==targetType||post.kind!=="post"||!text(post.title,160)||target.exam!==post.exam||target.topic!==post.topic||
   (targetType==="post"?JSON.stringify(target)!==JSON.stringify(post)||parent!==null:target.id===post.id)||
   parent&&(parent.kind!=="comment"||parent.id===targetId||parent.id===post.id||parent.exam!==post.exam||parent.topic!==post.topic))throw responseFailure();
  const view={targetType,targetId,reviewVersion:value.reviewVersion,canRestore:value.canRestore,target,post,parent,history:validateCommunityReviewHistory(value.history)};
  view.canRestore=view.canRestore&&target.status==="hidden"&&communityModerationGroups(view).every(group=>group.content.assets.every(asset=>asset.available));
  return view;
 }catch{throw responseFailure();}
}

export function communityModerationActions(view){
 if(!view?.target||!["post","comment"].includes(view.targetType)||!["visible","hidden","locked"].includes(view.target.status))return[];
 return view.target.status==="hidden"?["restore"]:view.targetType==="comment"?["hide"]:view.target.status==="locked"?["hide","unlock"]:["hide","lock"];
}

export function createCommunityModerationJob(view,action,note,requestId,actorId){
 const reason=typeof note==="string"?note.trim():"";
 if(reason.length<8||reason.length>1000)throw Object.assign(new Error("Enter a moderation reason of 8 to 1000 characters."),{code:"community_moderation_note"});
 if(!view||!uuid.test(view.targetId)||!version.test(view.reviewVersion)||!uuid.test(requestId)||!uuid.test(actorId)||!communityModerationActions(view).includes(action))throw inputFailure();
 if(action==="restore"&&!view.canRestore)throw Object.assign(new Error("Some registered images are unavailable. Reopen the content after they are checked."),{code:"community_moderation_incomplete"});
 return Object.freeze({actorId,previousStatus:view.target.status,input:Object.freeze({p_target_type:view.targetType,p_target_id:view.targetId,p_action:action,p_note:reason,p_expected_version:view.reviewVersion,p_request_id:requestId})});
}

export function readCommunityModerationReceipt(value,job,actorId){
 const input=job.input,status=input.p_action==="hide"?"hidden":input.p_action==="lock"?"locked":"visible";
 try{
  if(job.actorId!==actorId||!value||value.requestId!==input.p_request_id||value.targetType!==input.p_target_type||value.targetId!==input.p_target_id||
   value.action!==input.p_action||value.previousStatus!==job.previousStatus||value.status!==status||typeof value.replayed!=="boolean")throw responseFailure();
  dateMicros(value.createdAt);
 }catch{throw Object.assign(new Error("The saved action could not be verified. Retry this same action to confirm it."),{code:"community_moderation_receipt"});}
 return {requestId:value.requestId,targetType:value.targetType,targetId:value.targetId,action:value.action,previousStatus:value.previousStatus,status:value.status,createdAt:value.createdAt,replayed:value.replayed};
}

export function communityModerationMedia(value,group,elapsed){
 try{return communityReviewMedia(value,group,elapsed);}catch{throw responseFailure();}
}

const failures={
 community_moderation_changed:{kind:"stale",message:"This content changed. Reopen it and review the current version."},
 community_moderation_unavailable:{kind:"unavailable",message:"This content is unavailable or your moderation access has ended. Refresh content."},
 community_moderation_incomplete:{kind:"incomplete",message:"Some registered images are unavailable. You can hide or lock content while they are checked."},
 community_moderation_invalid:{kind:"invalid",message:"Check the filters, moderation reason and action."},
 community_moderation_note:{kind:"invalid",message:"Enter a moderation reason of 8 to 1000 characters."},
 community_moderation_required:{kind:"stale",message:"Open the current content before recording an action."},
 community_moderation_conflict:{kind:"stale",message:"This request belongs to another action. Reopen the content before continuing."},
 community_moderation_response:{kind:"unavailable",message:"The content response could not be verified. Refresh and try again."},
 community_moderation_expired:{kind:"expired",message:"Private image links expired. Open the images again to continue."},
 community_moderation_receipt:{kind:"retry",message:"The saved action could not be verified. Retry this same action to confirm it."},
};
export async function communityModerationFailure(error){
 let detail=error?.details,code=error?.code;
 const status=error?.context?.status??error?.status;
 try{const body=await error?.context?.clone().json();detail=body?.details??detail;code=body?.code??code;}catch{}
 if(status===401||status===403||code==="42501")return failures.community_moderation_unavailable;
 if(Object.hasOwn(failures,detail))return failures[detail];
 if(Object.hasOwn(failures,code))return failures[code];
 if(code==="40001")return failures.community_moderation_changed;
 return {kind:"retry",message:"Couldn’t complete this request. Retry it or refresh the current content."};
}
