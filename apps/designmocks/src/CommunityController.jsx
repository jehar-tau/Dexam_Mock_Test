import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PortalShell } from "./PortalShell.jsx";
import { AccountAccessBoundary, useAccountServices } from "./AccountAccess.jsx";
import { withAccountDeadline } from "./account-request.js";
import { useAuthState } from "./useAuth.js";
import { checkCommunityFiles, communityLinkLifetime, resumeCommunityImages } from "./community-media.js";
import { newCommunityWrite, submitCommunityWrite, mergeCommunityComments, validateCommunityThread } from "./community-write.js";
import { communityFeedFilters, communityFeedInput, validateCommunityFeed, mergeCommunityFeed } from "./community-feed.js";
import { communityAttachmentFiles, communityAttachmentPlan } from "./community-attachments.js";

function withoutImages(value) {
  return {...value,media:[],comments:value.comments.map(comment=>({...comment,media:[]})),mediaExpiresAt:null};
}

function CommunitySession({View,headingRef}) {
  const services=useAccountServices();
  const rpc=(name,input,signal)=>withAccountDeadline(active=>services.rpc(name,input,active),signal);
  const media=async(body,signal)=>{try{return await withAccountDeadline(active=>services.functions.invoke('community-media',{body,signal:active}),signal,body instanceof FormData?60000:20000);}catch(error){return{data:null,error};}};
  const [feed,setFeed]=useState(null),[feedFilters,setFeedFilters]=useState(()=>communityFeedFilters());
  const [feedLoading,setFeedLoading]=useState(false),[feedNotice,setFeedNotice]=useState("");
  const [thread,setThread]=useState(null),[message,setMessage]=useState("");
  const [busy,setBusy]=useState(false),[threadLoading,setThreadLoading]=useState(false);
  const [pendingPost,setPendingPost]=useState(null),[pendingReply,setPendingReply]=useState(null);
  const [pendingTextPost,setPendingTextPost]=useState(null),[pendingTextReply,setPendingTextReply]=useState(null);
  const [postFormVersion,setPostFormVersion]=useState(0),[replyFormVersion,setReplyFormVersion]=useState(0);
  const scope=useRef(null),threadRequest=useRef(null),mutationBusy=useRef(false),threadLive=useRef(null),viewEpoch=useRef(0);
  const feedRequest=useRef(null),feedEpoch=useRef(0),feedLive=useRef(null),filtersLive=useRef(feedFilters),feedPending=useRef(false);
  threadLive.current=thread;
  feedLive.current=feed;filtersLive.current=feedFilters;
  const current=signal=>!signal.aborted&&scope.current?.signal===signal&&services.isCurrent();
  async function load(signal,{intent=feedEpoch.current,append=false,changed=false}={}) {
    if(!current(signal)||intent!==feedEpoch.current)return false;
    const filters=filtersLive.current,previous=feedLive.current,cursor=append?previous?.nextCursor:null;
    if(append&&!cursor)return false;
    feedRequest.current?.abort();
    const request=new AbortController();feedRequest.current=request;feedPending.current=true;setFeedLoading(true);setFeedNotice("");
    const cancel=()=>request.abort();signal.addEventListener("abort",cancel,{once:true});
    const active=()=>current(signal)&&intent===feedEpoch.current&&!request.signal.aborted&&feedRequest.current===request;
    try {
      const result=validateCommunityFeed(await rpc("community_feed",communityFeedInput(filters,cursor),request.signal),filters);
      if(!active())return false;
      const value=append?mergeCommunityFeed(previous,result):result;
      feedLive.current=value;setFeed(value);
      if(changed)setFeedNotice("Discussions changed. The latest discussions are now shown.");
      return true;
    }catch(error){
      if(!active())return false;
      if(append&&error?.details==="community_feed_changed") {
        feedLive.current=null;setFeed(null);
        return await load(signal,{intent,changed:true});
      }
      if(error?.code==="42501"||error?.context?.status===401||error?.context?.status===403){feedLive.current=null;setFeed(null);}
      setFeedNotice(changed?"Discussions changed, but the latest page could not be loaded. Try again.":"Couldn’t load discussions. Try again.");
      return false;
    }finally{
      signal.removeEventListener("abort",cancel);
      if(active()){feedPending.current=false;setFeedLoading(false);}
    }
  }
  function changeFilters(filters) {
    let selected;
    try{selected=communityFeedFilters(filters.exam,filters.topic);}catch{setFeedNotice("Choose an exam and a topic of up to 100 characters.");return;}
    const intent=++feedEpoch.current;
    filtersLive.current=selected;setFeedFilters(selected);feedLive.current=null;setFeed(null);
    if(scope.current)load(scope.current.signal,{intent});
  }
  function reloadFeed() {
    if(scope.current)load(scope.current.signal,{intent:++feedEpoch.current});
  }
  function moreFeed() {
    if(!scope.current||feedPending.current||!feedLive.current?.nextCursor)return;
    load(scope.current.signal,{intent:++feedEpoch.current,append:true});
  }
  async function refreshFeed(job,signal) {
    if(job.feedEpoch===feedEpoch.current)await load(signal,{intent:job.feedEpoch});
  }
  useEffect(()=>{
    const controller=new AbortController();scope.current=controller;load(controller.signal);
    return()=>{controller.abort();threadRequest.current?.abort();feedRequest.current?.abort();};
  },[]);
  useEffect(()=>{
    const id=thread?.id,deadline=thread?.mediaExpiresAt,signal=scope.current?.signal;
    if(!deadline||!signal)return;
    const timer=setTimeout(()=>{
      if(!current(signal)||threadLive.current?.id!==id||threadLive.current.mediaExpiresAt!==deadline)return;
      setThread(value=>value?.id===id?withoutImages(value):value);
      setMessage("Image links expired. Refresh the discussion to view them again.");
    },Math.max(0,deadline-performance.now()));
    return()=>clearTimeout(timer);
  },[thread?.id,thread?.mediaExpiresAt]);

  async function openThread(id,cursor=null,options={}) {
    const intent=options.intent??viewEpoch.current,anchorId=options.anchorId??null,rowOnly=Boolean(options.row),headerOnly=Boolean(options.header);
    const localRefresh=rowOnly||headerOnly;
    const sessionSignal=scope.current?.signal;
    if(!sessionSignal||!current(sessionSignal)||intent!==viewEpoch.current)return;
    const append=Boolean(cursor)&&!anchorId;
    if(append&&(threadLoading||threadLive.current?.id!==id))return;
    threadRequest.current?.abort();
    if(!append&&!localRefresh)setThread(null);
    if(!id){threadRequest.current=null;setThreadLoading(false);return;}
    const request=new AbortController();threadRequest.current=request;setThreadLoading(true);
    const cancel=()=>request.abort();sessionSignal.addEventListener("abort",cancel,{once:true});
    try {
      const value=validateCommunityThread(await rpc(anchorId?"community_reply_context":"community_thread",anchorId?{p_post_id:id,p_anchor_id:anchorId,p_limit:rowOnly?1:25}:append?{p_post_id:id,p_cursor:cursor,p_limit:25}:headerOnly?{p_post_id:id,p_cursor:null,p_limit:1}:{p_post_id:id},request.signal),id),deadlines=[];
      if(value.comments.length>(localRefresh?1:25)||(anchorId&&(value.anchorId!==anchorId||value.comments[0]?.id!==anchorId||typeof value.hasEarlier!=="boolean")))throw new Error("Invalid reply context");
      if(localRefresh&&threadLive.current?.version!==value.version){
        const restored=await openThread(id,null,{intent});if(restored&&current(sessionSignal)&&intent===viewEpoch.current)setMessage("Discussion changed. The latest replies are now shown.");return restored;
      }
      const targets=[...(rowOnly?[]:[{type:"post",item:value}]),...(headerOnly?[]:value.comments.map(item=>({type:"comment",item})))];
      // Bound signing fan-out as the discussion grows.
      for(let start=0;start<targets.length;start+=4){
        const results=await Promise.allSettled(targets.slice(start,start+4).map(async({type,item})=>{
          if(!item.assetCount)return;
          const started=performance.now();
          const {data,error}=await media({targetType:type,targetId:item.id},request.signal);
          if(error)throw error;
          const lifetime=communityLinkLifetime(data,performance.now()-started);
          item.media=data.media.slice().sort((a,b)=>a.ordinal-b.ordinal);
          if(data.media.length)deadlines.push(performance.now()+lifetime);
        }));
        for(const result of results)if(result.status==="rejected")throw result.reason;
      }
      if(!current(sessionSignal)||intent!==viewEpoch.current||request.signal.aborted||threadRequest.current!==request)return;
      const deadline=deadlines.length?Math.min(...deadlines):null;
      setThread(previous=>{
        if(!append&&!localRefresh)return {...value,mediaExpiresAt:deadline};
        if(!previous||previous.id!==id||previous.version!==value.version)return previous;
        const oldDeadline=previous.mediaExpiresAt;
        return {...(rowOnly?previous:{...value,anchorId:previous.anchorId,hasEarlier:previous.hasEarlier,...(headerOnly?{nextCursor:previous.nextCursor}:{})}),comments:headerOnly?previous.comments:mergeCommunityComments(previous.comments,value.comments),mediaExpiresAt:oldDeadline&&deadline?Math.min(oldDeadline,deadline):oldDeadline??deadline};
      });
      return true;
    }catch(error){
      if(!current(sessionSignal)||intent!==viewEpoch.current||request.signal.aborted||threadRequest.current!==request)return;
      if(append&&error?.details==="community_thread_changed"){
        const restored=await openThread(id,null,{intent});if(current(sessionSignal)&&intent===viewEpoch.current&&restored)setMessage("Discussion changed. The latest replies are now shown.");
      }else{
        const denied=error?.code==="42501"||[401,403].includes(error?.context?.status);
        if((!append&&!localRefresh)||denied)setThread(null);
        setMessage(denied?"This discussion or its images are unavailable. Refresh the feed or try again.":options.afterUpload?"Images are saved. Couldn’t refresh the gallery. Refresh this discussion to check it.":rowOnly?"Marked helpful. Couldn’t refresh the count. Refresh this discussion to check it.":append?"Couldn’t load more replies. Try again.":"This discussion or its images are unavailable. Refresh the feed or try again.");
      }
      return false;
    }finally{
      sessionSignal.removeEventListener("abort",cancel);
      if(current(sessionSignal)&&intent===viewEpoch.current&&threadRequest.current===request)setThreadLoading(false);
    }
  }
  function chooseThread(id,options={}) {
    const intent=++viewEpoch.current;
    return openThread(id,null,{...options,intent});
  }
  async function revealWrite(job,signal) {
    if(!current(signal)||job.viewEpoch!==viewEpoch.current||job.feedEpoch!==feedEpoch.current)return;
    if(job.followUp&&threadLive.current?.id===job.postId) {
      await openThread(job.postId,null,{intent:job.viewEpoch,anchorId:job.targetType==="comment"?job.targetId:null,row:job.targetType==="comment",header:job.targetType==="post",afterUpload:true});
    }else await openThread(job.postId,null,{intent:job.viewEpoch,anchorId:job.targetType==="comment"?job.targetId:null});
  }
  async function mutate(action) {
    const signal=scope.current?.signal;
    if(mutationBusy.current||!signal||!current(signal))return false;
    mutationBusy.current=true;setBusy(true);setMessage("");
    try{return await action(signal);}
    catch{if(current(signal))setMessage("Couldn’t save this change. Check the discussion and try again.");return false;}
    finally{mutationBusy.current=false;if(current(signal))setBusy(false);}
  }
  async function reportContent(payload,dialogSignal) {
    const sessionSignal=scope.current?.signal;
    if(mutationBusy.current||!sessionSignal||!current(sessionSignal)||dialogSignal.aborted)return false;
    const signal=AbortSignal.any([sessionSignal,dialogSignal]);
    const location=window.location.href,historyKey=window.history.state?.key;
    mutationBusy.current=true;setBusy(true);
    try {
      await rpc("report_community_content",payload,signal);
      if(!current(sessionSignal)||signal.aborted||window.location.href!==location||window.history.state?.key!==historyKey)return false;
      return null;
    } finally {mutationBusy.current=false;if(current(sessionSignal))setBusy(false);}
  }
  async function finishImages(job,signal) {
    const setPending=job.targetType==="post"?setPendingPost:setPendingReply;
    try {
      await resumeCommunityImages(job,media,signal,
        ()=>{if(current(signal))setPending({...job});});
      if(!current(signal))return false;
      setPending(null);setMessage(job.followUp?"Additional images confirmed.":job.targetType==="post"?"Your post is live. All images confirmed.":"Reply added. All images confirmed.");
      await refreshFeed(job,signal);await revealWrite(job,signal);
      return true;
    }catch(error){if(current(signal)){setPending({...job});setMessage(error.message);await refreshFeed(job,signal);}return false;}
  }
  async function finishWrite(job,signal) {
    const setPending=job.kind==="post"?setPendingTextPost:setPendingTextReply;
    let receipt;
    try {receipt=await submitCommunityWrite(job,rpc,signal);}
    catch(error){
      if(current(signal)){setPending(error.definitive?null:job);setMessage(error.message);}
      return false;
    }
    if(!current(signal))return false;
    setPending(null);(job.kind==="post"?setPostFormVersion:setReplyFormVersion)(version=>version+1);
    if(!receipt.canUpload){
      setMessage("Your text is saved, but this discussion or reply is locked or unavailable. Attachments were not uploaded.");
      await refreshFeed(job,signal);if(current(signal)&&job.viewEpoch===viewEpoch.current&&job.feedEpoch===feedEpoch.current&&receipt.postStatus!=="hidden")await openThread(receipt.postId,null,{intent:job.viewEpoch,anchorId:job.kind==="comment"&&receipt.status!=="hidden"?receipt.id:null});
      return true;
    }
    if(job.files.length){
      const imageJob={targetType:job.kind,targetId:receipt.id,postId:receipt.postId,files:job.files,next:0,viewEpoch:job.viewEpoch,feedEpoch:job.feedEpoch};
      (job.kind==="post"?setPendingPost:setPendingReply)(imageJob);
      await finishImages(imageJob,signal);
    }else{
      setMessage(receipt.replayed?"Your saved text is confirmed.":job.kind==="post"?"Your post is live.":"Reply added.");
      await refreshFeed(job,signal);await revealWrite({targetType:job.kind,targetId:receipt.id,postId:receipt.postId,viewEpoch:job.viewEpoch,feedEpoch:job.feedEpoch},signal);
    }
    return true;
  }
  function skipImages(job) {
    if(mutationBusy.current||!job)return;
    (job.targetType==="post"?setPendingPost:setPendingReply)(null);
    setMessage(`Your ${job.targetType==="post"?"post":"reply"} and ${job.next} confirmed images are saved. Remaining images were not uploaded.`);
  }
  function stopWrite(job) {
    if(mutationBusy.current||!job)return;
    (job.kind==="post"?setPendingTextPost:setPendingTextReply)(null);
    setMessage("This request may already be saved. Check discussions before posting again.");
  }
  return <View heading={false} headingRef={headingRef} posts={feed?.posts??[]} feedFilters={feedFilters} feedLoading={feedLoading} feedNotice={feedNotice} feedReady={Boolean(feed)}
    feedNextCursor={feed?.nextCursor} onFilter={changeFilters} onMorePosts={moreFeed}
    thread={thread} message={message} busy={busy} threadLoading={threadLoading}
    pendingPost={pendingPost} pendingReply={pendingReply} pendingTextPost={pendingTextPost} pendingTextReply={pendingTextReply}
    postFormVersion={postFormVersion} replyFormVersion={replyFormVersion} onOpen={chooseThread}
    onMoreComments={()=>thread?.nextCursor&&openThread(thread.id,thread.nextCursor)} onReloadFeed={reloadFeed}
    onRetryTextPost={()=>mutate(signal=>finishWrite({...pendingTextPost,viewEpoch:viewEpoch.current,feedEpoch:feedEpoch.current},signal))} onStopTextPost={()=>stopWrite(pendingTextPost)}
    onRetryTextReply={()=>mutate(signal=>finishWrite({...pendingTextReply,viewEpoch:viewEpoch.current,feedEpoch:feedEpoch.current},signal))} onStopTextReply={()=>stopWrite(pendingTextReply)}
    onRetryPost={()=>mutate(signal=>finishImages({...pendingPost,viewEpoch:viewEpoch.current,feedEpoch:feedEpoch.current},signal))} onSkipPost={()=>skipImages(pendingPost)}
    onRetryReply={()=>mutate(signal=>finishImages({...pendingReply,viewEpoch:viewEpoch.current,feedEpoch:feedEpoch.current},signal))} onSkipReply={()=>skipImages(pendingReply)}
    onSubmit={(fields,files)=>mutate(async signal=>{
      if(pendingPost||pendingTextPost)return false;
      const invalid=checkCommunityFiles(files);if(invalid){setMessage(invalid);return false;}
      return finishWrite({...newCommunityWrite("post",{p_exam:fields.exam,p_topic:fields.topic,p_title:fields.title,p_body:fields.body},files),viewEpoch:viewEpoch.current,feedEpoch:feedEpoch.current},signal);
    })}
    onComment={(postId,parentId,body,files)=>mutate(async signal=>{
      if(pendingReply||pendingTextReply)return false;
      const invalid=checkCommunityFiles(files);if(invalid){setMessage(invalid);return false;}
      return finishWrite({...newCommunityWrite("comment",{p_post_id:postId,p_parent_id:parentId,p_body:body},files),viewEpoch:viewEpoch.current,feedEpoch:feedEpoch.current},signal);
    })}
    onHelpful={id=>mutate(async signal=>{
      const intent=viewEpoch.current,postId=threadLive.current?.id;
      await rpc("mark_community_helpful",{p_comment_id:id},signal);
      if(!current(signal)||intent!==viewEpoch.current||!postId)return;
      setThread(value=>value?.id===postId?{...value,comments:value.comments.map(comment=>comment.id===id?{...comment,markedHelpful:true}:comment)}:value);
      const refreshed=await openThread(postId,null,{anchorId:id,row:true,intent});
      if(refreshed&&current(signal)&&intent===viewEpoch.current)setMessage("Marked helpful.");
    })}
    onReport={reportContent}
    onAddImages={(target,files)=>mutate(async signal=>{
      if(pendingPost||pendingReply||pendingTextPost||pendingTextReply)return false;
      const invalid=communityAttachmentFiles(files);if(invalid){setMessage(invalid);return false;}
      const intent=viewEpoch.current,feedIntent=feedEpoch.current;
      let slots,job;
      try{slots=await rpc("community_attachment_slots",{p_target_type:target.targetType,p_target_id:target.targetId},signal);}
      catch{if(current(signal))setMessage("This saved discussion or reply could not be checked for uploads. Refresh it and try again.");return false;}
      if(!current(signal))return false;
      try{job={...communityAttachmentPlan(slots,target,files),viewEpoch:intent,feedEpoch:feedIntent};}
      catch(error){setMessage(error.message);return false;}
      (job.targetType==="post"?setPendingPost:setPendingReply)(job);
      await finishImages(job,signal);
      return current(signal);
    })}
  />;
}
export function CommunityController({View,Heading}) {
  const {session,loading}=useAuthState();
  const location=useLocation(),heading=useRef(null),scopeKey=(session?.user.id??'signed-out')+':'+location.key,previous=useRef(scopeKey);
  useLayoutEffect(()=>{if(previous.current!==scopeKey&&(document.activeElement===document.body||heading.current?.parentElement.contains(document.activeElement)))heading.current?.focus();previous.current=scopeKey;},[scopeKey]);
  if(loading)return <section className="wrap section"><p role="status">Checking your account…</p></section>;
  if(!session)return <section className="wrap section"><h1>Sign in to the <em>community.</em></h1><Link to="/account">Student sign in</Link></section>;
  return <PortalShell><section className="wrap section community-page"><Heading headingRef={heading}/><AccountAccessBoundary key={scopeKey} kind="community" actorId={session.user.id} headingRef={heading}><CommunitySession View={View} headingRef={heading}/></AccountAccessBoundary></section></PortalShell>;
}
