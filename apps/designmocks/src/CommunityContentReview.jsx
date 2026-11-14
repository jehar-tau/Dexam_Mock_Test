import React,{useEffect,useId,useLayoutEffect,useRef,useState} from "react";
import {useAdminFunctions} from "./AdminAccess.jsx";
import {CommunityImages} from "./CommunityImages.jsx";
import {communityModerationActions,communityModerationFailure,communityModerationGroups,communityModerationMedia,
 createCommunityModerationJob,readCommunityModerationReceipt,readCommunityModerationView} from "./community-content-moderation.js";

const names={hide:"Hide",restore:"Restore",lock:"Lock",unlock:"Unlock"};
export function CommunityContentReview({target,actorId,rpc,isActive,onClose,onChanged,onUnavailable,onChoose}){
 const functions=useAdminFunctions();
 const [view,setView]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [note,setNote]=useState(""),[busy,setBusy]=useState(false),[pending,setPending]=useState(null),[mediaBusy,setMediaBusy]=useState(false);
 const [images,setImages]=useState({}),[displayed,setDisplayed]=useState({}),[imageDeadline,setImageDeadline]=useState(null);
 const root=useRef(null),heading=useRef(null),reopen=useRef(null),imagesButton=useRef(null),focusRecovery=useRef(null),reasonId=useId();
 const scope=useRef(null),readRequest=useRef(null),mediaRequest=useRef(null),expiry=useRef(null),mutation=useRef(false),pendingJob=useRef(null),imageEpoch=useRef(0),deadline=useRef(null);
 const callbacks=useRef(null);callbacks.current={onClose,onChanged,onUnavailable,onChoose,isActive};
 const current=context=>context&&scope.current===context&&!context.controller.signal.aborted&&window.location.href===context.href&&window.history.state?.key===context.historyKey&&callbacks.current.isActive(target.key);
 const clearImages=()=>{imageEpoch.current++;clearTimeout(expiry.current);deadline.current=null;setImages({});setDisplayed({});setImageDeadline(null);};
 const clearPending=()=>{pendingJob.current=null;setPending(null);};

 async function failed(failure,context,job=null){
  const safe=await communityModerationFailure(failure);
  if(!current(context))return;
  if(root.current?.contains(document.activeElement))focusRecovery.current=document.activeElement;
  if(safe.kind!=="invalid")clearImages();
  if(safe.kind==="retry"&&job){pendingJob.current=job;setPending(job);}else clearPending();
  setError(safe.message);
  if(safe.kind==="stale"){context.version=null;setView(null);setNote("");}
  if(safe.kind==="incomplete")setView(value=>value?{...value,canRestore:false}:null);
  if(safe.kind==="unavailable"){context.version=null;setView(null);setNote("");callbacks.current.onUnavailable(safe.message);}
 }

 async function load(context,message=""){
  if(!current(context))return;
  readRequest.current?.abort();mediaRequest.current?.abort();mediaRequest.current=null;
  const request=new AbortController();readRequest.current=request;
  const abort=()=>request.abort();context.controller.signal.addEventListener("abort",abort,{once:true});
  context.version=null;setView(null);setLoading(true);setMediaBusy(false);setNote("");setError("");setNotice(message);clearImages();
  try{
   const result=await rpc("admin_review_community_content",{p_target_type:target.kind,p_target_id:target.id},request.signal);
   const value=readCommunityModerationView(result,target.kind,target.id);
   if(!current(context)||request.signal.aborted||readRequest.current!==request)return;
   context.version=value.reviewVersion;setView(value);
  }catch(failure){if(current(context)&&!request.signal.aborted&&readRequest.current===request)await failed(failure,context);}
  finally{context.controller.signal.removeEventListener("abort",abort);if(current(context)&&readRequest.current===request)setLoading(false);}
 }

 useEffect(()=>{
  const context={controller:new AbortController(),href:window.location.href,historyKey:window.history.state?.key,version:null};scope.current=context;
  load(context);
  return()=>{context.controller.abort();readRequest.current?.abort();mediaRequest.current?.abort();clearTimeout(expiry.current);};
 },[target.key,target.kind,target.id,actorId,rpc]);
 useLayoutEffect(()=>{heading.current?.focus();},[]);
 useLayoutEffect(()=>{
  const previous=focusRecovery.current;
  if(!previous||loading)return;
  focusRecovery.current=null;
  if(!previous.isConnected&&document.activeElement===document.body)(view?heading.current:reopen.current)?.focus();
 },[view,error,loading]);

 const groups=view?communityModerationGroups(view):[],withImages=groups.filter(group=>group.content.assets.length),epoch=imageEpoch.current;
 const imagesReady=withImages.every(group=>images[group.context]?.length===group.content.assets.length&&group.content.assets.every(asset=>asset.available)&&
  images[group.context].every(image=>displayed[`${epoch}:${image.id}:${image.url}`]));
 const displayedImage=(event,group,ready)=>{
  const context=scope.current;
  if(!current(context)||epoch!==imageEpoch.current||event.target.tagName!=="IMG"||!event.currentTarget.isConnected)return;
  const image=images[group.context]?.find((item,index)=>event.target.alt===`${group.label} attachment ${index+1}`&&event.target.src===item.url);
  if(!image)return;
  const complete=ready&&event.target.naturalWidth>0&&event.target.naturalHeight>0;
  setDisplayed(value=>({...value,[`${epoch}:${image.id}:${image.url}`]:complete}));
  if(!complete)setError("A private image could not be displayed. Refresh its link before restoring content.");
 };

 async function openImages(){
  const context=scope.current;
  if(!current(context)||!view||mutation.current||pendingJob.current||mediaBusy||withImages.every(group=>group.content.assets.some(item=>!item.available)))return;
  mediaRequest.current?.abort();
  const request=new AbortController();mediaRequest.current=request;
  const abort=()=>request.abort();context.controller.signal.addEventListener("abort",abort,{once:true});
  const inspectedVersion=view.reviewVersion;
  clearImages();setMediaBusy(true);setError("");setNotice("");
  const collected={},deadlines=[];
  try{
   for(const group of withImages){
    if(group.content.assets.some(item=>!item.available))continue;
    request.signal.throwIfAborted();
    const started=performance.now();
    if (!functions) throw new Error("Staff access required.");
    const {data,error:failure}=await functions.invoke("community-media",{body:{action:"moderate",targetType:view.targetType,targetId:view.targetId,reviewVersion:inspectedVersion,context:group.context},signal:request.signal});
    request.signal.throwIfAborted();
    if(failure)throw failure;if(data?.error)throw data;
    const result=communityModerationMedia(data,group,performance.now()-started);
    if(!result.lifetime)throw {code:"community_moderation_expired"};
    collected[group.context]=result.media;deadlines.push(performance.now()+result.lifetime);
   }
   if(!current(context)||request.signal.aborted||mediaRequest.current!==request||context.version!==inspectedVersion)return;
   const limit=Math.min(...deadlines),remaining=limit-performance.now();
   if(!Number.isFinite(limit)||remaining<=0)throw {code:"community_moderation_expired"};
   deadline.current=limit;setImageDeadline(limit);setImages(collected);
   expiry.current=setTimeout(()=>{
    if(!current(context)||mediaRequest.current!==request||context.version!==inspectedVersion)return;
    const inspecting=Boolean(root.current?.querySelector("dialog[open]"));
    clearImages();setNotice("Private image links expired. Open the images again to continue.");
    if(inspecting)requestAnimationFrame(()=>{if(current(context))imagesButton.current?.focus();});
   },remaining);
  }catch(failure){if(current(context)&&!request.signal.aborted&&mediaRequest.current===request)await failed(failure,context);}
  finally{context.controller.signal.removeEventListener("abort",abort);if(current(context)&&mediaRequest.current===request)setMediaBusy(false);}
 }

 async function perform(job,retrying=false){
  const context=scope.current;
  if(!current(context)||mutation.current||job.actorId!==actorId||retrying&&pendingJob.current!==job||!retrying&&context.version!==job.input.p_expected_version)return;
  mutation.current=true;setBusy(true);setError("");setNotice("");
  let confirmed=false;
  try{
   const result=await rpc("admin_moderate_community",job.input,context.controller.signal);
   if(!current(context))return;
   const receipt=readCommunityModerationReceipt(result,job,actorId);
   confirmed=true;
   clearPending();clearImages();
   focusRecovery.current=document.activeElement;
   await load(context,`${receipt.replayed?"Earlier ":""}${receipt.action} action ${receipt.replayed?"confirmed":"recorded"}. Current content is reopened below.`);
   if(current(context))await callbacks.current.onChanged();
  }catch(failure){if(current(context))await failed(failure,context,confirmed?null:job);}
  finally{mutation.current=false;if(current(context))setBusy(false);}
 }

 async function submit(event){
  event.preventDefault();
  const context=scope.current,action=event.nativeEvent.submitter?.value;
  if(!current(context)||mutation.current||pendingJob.current||mediaBusy||!view)return;
  if(action==="restore"&&(!imagesReady||Number.isFinite(deadline.current)&&performance.now()>=deadline.current)){
   if(Number.isFinite(deadline.current)&&performance.now()>=deadline.current)clearImages();
   setError("Open and view every private image before restoring this content.");return;
  }
  let job;
  try{job=createCommunityModerationJob(view,action,note,crypto.randomUUID(),actorId);}
  catch(failure){await failed(failure,context);return;}
  await perform(job);
 }

 async function stopRetrying(){
  const context=scope.current;
  if(!current(context)||mutation.current)return;
  clearPending();
  await load(context,"The earlier action may already be recorded. Check the current status and history.");
  if(current(context))await callbacks.current.onChanged();
 }

 const noun=target.kind==="post"?"discussion":"reply";
 return <section ref={root} className="bank-question-review community-content-review" aria-label="Community content review" style={{minWidth:0,overflowWrap:"anywhere"}}>
  <div className="admin-actions"><h4 ref={heading} tabIndex={-1}>Review Community content</h4><button type="button" className="button quiet" onClick={()=>callbacks.current.onClose(pendingJob.current||mutation.current?"The earlier action may already be saved. Reopen the content to check its history.":"")}>Close content review</button></div>
  {loading&&<p role="status">Opening current content…</p>}
  {error&&<p className="error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {!loading&&!view&&<button type="button" className="button" ref={reopen} onClick={()=>load(scope.current)}>Reopen content</button>}
  {view&&<>
   <p>{pending?"This is the content inspected before the unconfirmed action.":"Review the current content and context before choosing an action."}</p>
   <p>Content moderation and report review are separate. Open reports stay in the report queue until they are reviewed.</p>
   {groups.map(group=><section key={group.context} aria-label={group.label} style={{minWidth:0}}>
    <h5>{group.label}</h5><p>{group.content.exam.toUpperCase()} · {group.content.topic} · {group.content.status}</p>
    {group.content.title&&<p><b>{group.content.title}</b></p>}<p className="bank-question-prompt">{group.content.body}</p>
    {group.content.assets.some(asset=>!asset.available)&&<p className="error">Some registered images are unavailable. Restoration requires complete images.</p>}
    <div onLoadCapture={event=>displayedImage(event,group,true)} onErrorCapture={event=>displayedImage(event,group,false)}>
     <CommunityImages images={images[group.context]??[]} label={`${group.label} attachment`} expiresAt={imageDeadline} onUnavailableFocus={()=>heading.current?.focus()}/>
    </div>
   </section>)}
   {withImages.length>0&&<div className="drawing-review-media">
    <button type="button" className="button quiet" ref={imagesButton} aria-disabled={busy||mediaBusy||Boolean(pending)||withImages.every(group=>group.content.assets.some(asset=>!asset.available))} onClick={openImages}>
     {mediaBusy?"Opening private images…":Object.keys(images).length?"Refresh moderation images":"Open moderation images"}</button>
    {view.target.status==="hidden"&&view.canRestore&&!imagesReady&&<p>Open and view every private image before restoring this content.</p>}
   </div>}
   {pending&&<section className="notice" aria-label="Unconfirmed moderation action"><h5>Confirm the saved action</h5>
    <p>The {pending.input.p_action} action may already be recorded. Retry the same request to confirm it.</p>
    <div className="admin-actions"><button type="button" className="button" aria-disabled={busy} onClick={()=>perform(pending,true)}>Retry moderation action</button>
     <button type="button" className="button quiet" aria-disabled={busy} onClick={stopRetrying}>Stop retrying and refresh</button></div>
   </section>}
   <form className="admin-form" style={{gridTemplateColumns:"minmax(0, 1fr)"}} noValidate onSubmit={submit}>
    <div style={{minWidth:0}}><label htmlFor={reasonId}>Moderation reason</label><textarea id={reasonId} required minLength={8} maxLength={1000} rows={3} value={note} disabled={busy||mediaBusy||Boolean(pending)} onChange={event=>setNote(event.target.value)} style={{width:"100%",minWidth:0}}/></div>
    {view.targetType==="post"&&view.target.status==="hidden"&&<p>Restoring a discussion also makes its visible replies readable again.</p>}
    <div className="admin-actions">{communityModerationActions(view).map(action=><button key={action} className={action==="restore"?"button":"button quiet"} name="action" value={action}
     aria-disabled={busy||mediaBusy||Boolean(pending)||action==="restore"&&(!view.canRestore||!imagesReady)}>{names[action]} {noun}</button>)}</div>
   </form>
   {view.targetType==="comment"&&<div className="admin-actions"><button type="button" className="text-button" disabled={busy||mediaBusy||Boolean(pending)} onClick={event=>callbacks.current.onChoose("post",view.post.id,event.currentTarget)}>Review this discussion</button>
    {view.parent&&<button type="button" className="text-button" disabled={busy||mediaBusy||Boolean(pending)} onClick={event=>callbacks.current.onChoose("comment",view.parent.id,event.currentTarget)}>Review parent reply</button>}</div>}
   <details><summary>Moderation history</summary>{view.history.length?view.history.map(event=><p key={event.id} className="bank-question-prompt">{event.action} · {new Date(event.createdAt).toLocaleString("en-IN")} · {event.note||"No reason recorded."}</p>):<p>No earlier moderation actions.</p>}</details>
  </>}
 </section>;
}
