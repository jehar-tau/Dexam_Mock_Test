import React,{useCallback,useEffect,useId,useLayoutEffect,useRef,useState} from "react";
import {useLocation} from "react-router-dom";
import {CommunityContentReview} from "./CommunityContentReview.jsx";
import {communityModerationFailure,communityModerationFilters,communityModerationPageInput,readCommunityModerationPage} from "./community-content-moderation.js";

function ModerationBrowser({rpc,actorId}){
 const initial=communityModerationFilters();
 const [filters,setFilters]=useState(initial),[page,setPage]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [selection,setSelection]=useState(null),[parentLabel,setParentLabel]=useState("");
 const lifetime=useRef(null),pageRequest=useRef(null),pageBusy=useRef(false),intent=useRef(0),selectionKey=useRef(null),sequence=useRef(0);
 const pages=useRef(null),activeFilters=useRef(initial),postFilters=useRef(initial),opener=useRef(null),heading=useRef(null),rowRefs=useRef(new Map()),focusRequest=useRef(null);
 const examId=useId(),topicId=useId(),statusId=useId();
 const alive=()=>lifetime.current&&!lifetime.current.controller.signal.aborted&&window.location.href===lifetime.current.href&&window.history.state?.key===lifetime.current.historyKey;
 const isActive=useCallback(key=>Boolean(alive()&&selectionKey.current===key),[]);
 const drop=(message)=>{
  intent.current++;pageRequest.current?.abort();pageRequest.current=null;pageBusy.current=false;setLoading(false);
  selectionKey.current=null;setSelection(null);pages.current=null;setPage(null);setError(message);setNotice("");
  focusRequest.current={opener:document.activeElement,more:false,ids:new Set()};
 };

 async function read(wanted,next=null,prior=null,token=intent.current){
  if(!alive())return;
  const context=lifetime.current;
  pageRequest.current?.abort();
  const request=new AbortController();pageRequest.current=request;
  const abort=()=>request.abort();context.controller.signal.addEventListener("abort",abort,{once:true});
  pageBusy.current=true;setLoading(true);setError("");
  if(next===null){pages.current=null;setPage(null);}
  const current=()=>alive()&&lifetime.current===context&&!request.signal.aborted&&pageRequest.current===request&&intent.current===token;
  try{
   const result=await rpc("admin_community_content_page",communityModerationPageInput(wanted,next),request.signal);
   const value=readCommunityModerationPage(result,wanted,prior);
   if(!current())return;
   pages.current=value;setPage(value);
   if(next!==null)setNotice(`${value.items.length-prior.items.length} more ${wanted.targetType==="post"?"discussions":"replies"} loaded.`);
  }catch(failure){
   const safe=await communityModerationFailure(failure);
   if(!current())return;
   if(["stale","unavailable"].includes(safe.kind))drop(safe.message);else setError(safe.message);
  }finally{
   context.controller.signal.removeEventListener("abort",abort);
   if(current()){pageBusy.current=false;setLoading(false);}
  }
 }

 function browse(value,button=null){
  let wanted;
  try{wanted=communityModerationFilters(value);}catch{setError("Check the exact exam, topic and status filters.");return;}
  if(!alive())return;
  const token=++intent.current;
  selectionKey.current=null;setSelection(null);activeFilters.current=wanted;setFilters(wanted);setNotice("");
  focusRequest.current={opener:button??document.activeElement,more:false,ids:new Set()};
  return read(wanted,null,null,token);
 }

 useEffect(()=>{
  const context={controller:new AbortController(),href:window.location.href,historyKey:window.history.state?.key};lifetime.current=context;
  read(activeFilters.current);
  return()=>{context.controller.abort();pageRequest.current?.abort();selectionKey.current=null;};
 },[rpc,actorId]);
 useLayoutEffect(()=>{
  const target=focusRequest.current;
  if(!target||loading)return;
  focusRequest.current=null;
  if(document.activeElement!==document.body&&document.activeElement!==target.opener)return;
  const item=target.more?page?.items.find(item=>!target.ids.has(item.id)):null;
  (item?rowRefs.current.get(item.id):heading.current)?.focus();
 },[page,loading,error]);

 const choose=useCallback((kind,id,button)=>{
  if(!alive())return;
  const key=++sequence.current;selectionKey.current=key;opener.current=button;setSelection({kind,id,key});setNotice("");
 },[]);
 const closeReview=useCallback((message="")=>{
  selectionKey.current=null;setSelection(null);setNotice(message);
  requestAnimationFrame(()=>{if(alive()&&selectionKey.current===null&&document.activeElement===document.body&&!document.querySelector("dialog[open]")){
   (opener.current?.isConnected?opener.current:heading.current)?.focus();
  }});
 },[]);
 const unavailable=useCallback(message=>drop(message),[]);
 const changed=useCallback(()=>{
  if(!alive())return;
  return read(activeFilters.current,null,null,intent.current);
 },[]);
 function more(event){
  if(pageBusy.current||!pages.current?.nextCursor)return;
  const current=pages.current;
  focusRequest.current={opener:event.currentTarget,more:true,ids:new Set(current.items.map(item=>item.id))};
  read(activeFilters.current,current.nextCursor,current,intent.current);
 }
 const isPost=filters.targetType==="post",noun=isPost?"discussions":"replies";
 return <section aria-label="Community content browser" className="community-content-browser" style={{minWidth:0,overflowWrap:"anywhere"}}>
  <h3 ref={heading} tabIndex={-1}>Community content</h3>
  <p>{isPost?"Browse discussions, including hidden content.":`Replies to ${parentLabel||"the selected discussion"}.`} Newest content appears first, in pages of up to 25.</p>
  {!isPost&&<button type="button" className="button quiet" onClick={event=>{setParentLabel("");browse(postFilters.current,event.currentTarget);}}>Back to discussions</button>}
  <form className="admin-form" aria-label="Community moderation filters" key={JSON.stringify(filters)} onSubmit={event=>{
   event.preventDefault();const form=new FormData(event.currentTarget);
   browse({targetType:filters.targetType,postId:filters.postId,exam:form.get("exam"),topic:form.get("topic"),status:form.get("status")},event.nativeEvent.submitter);
  }}>
   {isPost&&<><div><label htmlFor={examId}>Moderation exam filter</label><select id={examId} name="exam" defaultValue={filters.exam??""}><option value="">All exams</option>{["uceed","ceed","nid","nift"].map(exam=><option key={exam} value={exam}>{exam.toUpperCase()}</option>)}</select></div>
    <div><label htmlFor={topicId}>Moderation topic filter</label><input id={topicId} name="topic" maxLength={100} defaultValue={filters.topic??""} placeholder="Exact topic (optional)"/></div></>}
   <div><label htmlFor={statusId}>Moderation status filter</label><select id={statusId} name="status" defaultValue={filters.status??""}><option value="">All statuses</option><option value="visible">Visible</option><option value="hidden">Hidden</option>{isPost&&<option value="locked">Locked</option>}</select></div>
   <div className="admin-actions"><button className="button">Apply moderation filters</button><button type="button" className="button quiet" onClick={event=>browse({targetType:filters.targetType,postId:filters.postId},event.currentTarget)}>Clear moderation filters</button></div>
  </form>
  <p className="muted">Topics match exactly, including case. Open a review to inspect complete text and private images.</p>
  <button type="button" className="text-button" onClick={event=>browse(activeFilters.current,event.currentTarget)}>Reload moderation content</button>
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}
  {selection&&<CommunityContentReview key={selection.key} target={selection} actorId={actorId} rpc={rpc} isActive={isActive} onClose={closeReview} onChanged={changed} onUnavailable={unavailable} onChoose={choose}/>}
  <section aria-label="Moderation content list" aria-busy={loading}>
   {loading&&<p role="status">Loading moderation {noun}…</p>}
   {!loading&&page?.items.length===0&&<p>No {noun} match these filters.</p>}
   <div className="admin-list">{page?.items.map((item,index)=><article key={item.id} aria-label={`Community ${isPost?"discussion":"reply"} ${index+1}`} tabIndex={-1}
    ref={node=>{if(node)rowRefs.current.set(item.id,node);else rowRefs.current.delete(item.id);}} style={{minWidth:0}}>
    <span className="eyebrow">{item.exam.toUpperCase()} · {item.topic}</span><span className="status-pill">{item.status}</span>
    {item.title&&<h4>{item.title}</h4>}<p className="bank-question-prompt">{item.body.length>240?item.body.slice(0,240)+"…":item.body}</p>
    <p className="muted">{item.assetCount} {item.assetCount===1?"image":"images"}{isPost?` · ${item.comments} ${item.comments===1?"reply":"replies"}`:""}</p>
    <div className="admin-actions"><button type="button" className="button quiet" onClick={event=>choose(item.kind,item.id,event.currentTarget)}>Review {isPost?"discussion":"reply"}</button>
     {isPost&&<button type="button" className="text-button" onClick={event=>{postFilters.current=activeFilters.current;setParentLabel(item.title);browse({targetType:"comment",postId:item.id},event.currentTarget);}}>Browse replies</button>}</div>
   </article>)}</div>
   {page?.nextCursor&&<button type="button" className="button quiet" aria-disabled={loading} onClick={more}>Load more moderation {noun}</button>}
  </section>
 </section>;
}

function WorkspaceSession({rpc,actorId}){
 const [open,setOpen]=useState(false);
 return <section aria-label="Community content moderation" style={{minWidth:0}}>
  <button type="button" className="button quiet" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{open?"Close content browser":"Browse Community content"}</button>
  {open&&<ModerationBrowser rpc={rpc} actorId={actorId}/>}
 </section>;
}
export function CommunityContentModeration({rpc,scopeKey}){
 const location=useLocation();
 return <WorkspaceSession key={`${scopeKey}:${location.key}`} rpc={rpc} actorId={scopeKey}/>;
}
