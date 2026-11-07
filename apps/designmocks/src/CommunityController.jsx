import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "./PortalShell.jsx";
import { platform } from "./platform.js";
import { useAuthState } from "./useAuth.js";
import { checkCommunityFiles, communityLinkLifetime, resumeCommunityImages } from "./community-media.js";
import { newCommunityWrite, submitCommunityWrite, mergeCommunityComments, validateCommunityThread } from "./community-write.js";

async function rpc(name,input,signal) {
  signal.throwIfAborted();
  const {data,error}=await platform.rpc(name,input).abortSignal(signal);
  if(error)throw error;
  return data;
}
function withoutImages(value) {
  return {...value,media:[],comments:value.comments.map(comment=>({...comment,media:[]})),mediaExpiresAt:null};
}

function CommunitySession({View}) {
  const [posts,setPosts]=useState([]),[thread,setThread]=useState(null),[message,setMessage]=useState("");
  const [busy,setBusy]=useState(false),[threadLoading,setThreadLoading]=useState(false);
  const [pendingPost,setPendingPost]=useState(null),[pendingReply,setPendingReply]=useState(null);
  const [pendingTextPost,setPendingTextPost]=useState(null),[pendingTextReply,setPendingTextReply]=useState(null);
  const [postFormVersion,setPostFormVersion]=useState(0),[replyFormVersion,setReplyFormVersion]=useState(0);
  const scope=useRef(null),threadRequest=useRef(null),mutationBusy=useRef(false),threadLive=useRef(null);
  threadLive.current=thread;
  const current=signal=>!signal.aborted&&scope.current?.signal===signal;
  async function load(signal) {
    try {const result=await rpc("community_feed",{p_exam:null,p_topic:null},signal);if(current(signal))setPosts(result);}
    catch {if(current(signal))setMessage("Couldn’t refresh discussions. Try again.");}
  }
  useEffect(()=>{
    const controller=new AbortController();scope.current=controller;load(controller.signal);
    return()=>{controller.abort();threadRequest.current?.abort();};
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

  async function openThread(id,cursor=null) {
    const sessionSignal=scope.current?.signal;
    if(!sessionSignal||!current(sessionSignal))return;
    const append=Boolean(cursor);
    if(append&&(threadLoading||threadLive.current?.id!==id))return;
    threadRequest.current?.abort();
    if(!append)setThread(null);
    if(!id){threadRequest.current=null;setThreadLoading(false);return;}
    const request=new AbortController();threadRequest.current=request;setThreadLoading(true);
    const cancel=()=>request.abort();sessionSignal.addEventListener("abort",cancel,{once:true});
    try {
      const value=validateCommunityThread(await rpc("community_thread",append?{p_post_id:id,p_cursor:cursor,p_limit:25}:{p_post_id:id},request.signal),id),deadlines=[];
      const targets=[{type:"post",item:value},...value.comments.map(item=>({type:"comment",item}))];
      // Bound signing fan-out as the discussion grows.
      for(let start=0;start<targets.length;start+=4){
        const results=await Promise.allSettled(targets.slice(start,start+4).map(async({type,item})=>{
          if(!item.assetCount)return;
          const started=performance.now();
          const {data,error}=await platform.functions.invoke("community-media",{body:{targetType:type,targetId:item.id},signal:request.signal});
          if(error)throw error;
          const lifetime=communityLinkLifetime(data,performance.now()-started);
          item.media=data.media.slice().sort((a,b)=>a.ordinal-b.ordinal);
          if(data.media.length)deadlines.push(performance.now()+lifetime);
        }));
        for(const result of results)if(result.status==="rejected")throw result.reason;
      }
      if(!current(sessionSignal)||request.signal.aborted||threadRequest.current!==request)return;
      const deadline=deadlines.length?Math.min(...deadlines):null;
      setThread(previous=>{
        if(!append)return {...value,mediaExpiresAt:deadline};
        if(!previous||previous.id!==id||previous.version!==value.version)return previous;
        const oldDeadline=previous.mediaExpiresAt;
        return {...value,comments:mergeCommunityComments(previous.comments,value.comments),mediaExpiresAt:oldDeadline&&deadline?Math.min(oldDeadline,deadline):oldDeadline??deadline};
      });
      return true;
    }catch(error){
      if(!current(sessionSignal)||request.signal.aborted||threadRequest.current!==request)return;
      if(append&&error?.details==="community_thread_changed"){
        const restored=await openThread(id);if(current(sessionSignal)&&restored)setMessage("Discussion changed. The latest replies are now shown.");
      }else{
        const denied=error?.code==="42501"||error?.context?.status===403;
        if(!append||denied)setThread(null);
        setMessage(append&&!denied?"Couldn’t load more replies. Try again.":"This discussion or its images are unavailable. Refresh the feed or try again.");
      }
      return false;
    }finally{
      sessionSignal.removeEventListener("abort",cancel);
      if(current(sessionSignal)&&threadRequest.current===request)setThreadLoading(false);
    }
  }
  async function mutate(action) {
    const signal=scope.current?.signal;
    if(mutationBusy.current||!signal||!current(signal))return false;
    mutationBusy.current=true;setBusy(true);setMessage("");
    try{return await action(signal);}
    catch{if(current(signal))setMessage("Couldn’t save this change. Check the discussion and try again.");return false;}
    finally{mutationBusy.current=false;if(current(signal))setBusy(false);}
  }
  async function finishImages(job,signal) {
    const setPending=job.targetType==="post"?setPendingPost:setPendingReply;
    try {
      await resumeCommunityImages(job,(body,requestSignal)=>platform.functions.invoke("community-media",{body,signal:requestSignal}),signal,
        ()=>{if(current(signal))setPending({...job});});
      if(!current(signal))return false;
      setPending(null);setMessage(job.targetType==="post"?"Your post is live. All images confirmed.":"Reply added. All images confirmed.");
      await load(signal);if(current(signal))await openThread(job.postId);
      return true;
    }catch(error){if(current(signal)){setPending({...job});setMessage(error.message);await load(signal);}return false;}
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
      await load(signal);if(current(signal)&&receipt.postStatus!=="hidden")await openThread(receipt.postId);
      return true;
    }
    if(job.files.length){
      const imageJob={targetType:job.kind,targetId:receipt.id,postId:receipt.postId,files:job.files,next:0};
      (job.kind==="post"?setPendingPost:setPendingReply)(imageJob);
      await finishImages(imageJob,signal);
    }else{
      setMessage(receipt.replayed?"Your saved text is confirmed.":job.kind==="post"?"Your post is live.":"Reply added.");
      await load(signal);if(current(signal))await openThread(receipt.postId);
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
  return <PortalShell><View posts={posts} thread={thread} message={message} busy={busy} threadLoading={threadLoading}
    pendingPost={pendingPost} pendingReply={pendingReply} pendingTextPost={pendingTextPost} pendingTextReply={pendingTextReply}
    postFormVersion={postFormVersion} replyFormVersion={replyFormVersion} onOpen={openThread}
    onMoreComments={()=>thread?.nextCursor&&openThread(thread.id,thread.nextCursor)} onReloadFeed={()=>scope.current&&load(scope.current.signal)}
    onRetryTextPost={()=>mutate(signal=>finishWrite(pendingTextPost,signal))} onStopTextPost={()=>stopWrite(pendingTextPost)}
    onRetryTextReply={()=>mutate(signal=>finishWrite(pendingTextReply,signal))} onStopTextReply={()=>stopWrite(pendingTextReply)}
    onRetryPost={()=>mutate(signal=>finishImages(pendingPost,signal))} onSkipPost={()=>skipImages(pendingPost)}
    onRetryReply={()=>mutate(signal=>finishImages(pendingReply,signal))} onSkipReply={()=>skipImages(pendingReply)}
    onSubmit={(fields,files)=>mutate(async signal=>{
      if(pendingPost||pendingTextPost)return false;
      const invalid=checkCommunityFiles(files);if(invalid){setMessage(invalid);return false;}
      return finishWrite(newCommunityWrite("post",{p_exam:fields.exam,p_topic:fields.topic,p_title:fields.title,p_body:fields.body},files),signal);
    })}
    onComment={(postId,parentId,body,files)=>mutate(async signal=>{
      if(pendingReply||pendingTextReply)return false;
      const invalid=checkCommunityFiles(files);if(invalid){setMessage(invalid);return false;}
      return finishWrite(newCommunityWrite("comment",{p_post_id:postId,p_parent_id:parentId,p_body:body},files),signal);
    })}
    onHelpful={id=>mutate(async signal=>{await rpc("mark_community_helpful",{p_comment_id:id},signal);if(current(signal)&&thread){await openThread(thread.id);if(current(signal))setMessage("Marked helpful.");}})}
    onReport={(postId,commentId)=>mutate(async signal=>{await rpc("report_community_content",{p_post_id:postId,p_comment_id:commentId,p_reason:"other",p_details:"Reported from discussion view"},signal);if(current(signal))setMessage("Report sent for moderator review.");})}
  /></PortalShell>;
}
export function CommunityController({View}) {
  const {session,loading}=useAuthState();
  if(loading)return <section className="wrap section"><p role="status">Checking your account…</p></section>;
  if(!session)return <section className="wrap section"><h1>Sign in to the <em>community.</em></h1><Link to="/account">Student sign in</Link></section>;
  return <CommunitySession key={session.user.id} View={View} />;
}
