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
  const scope=useRef(null),threadRequest=useRef(null),mutationBusy=useRef(false),threadLive=useRef(null),viewEpoch=useRef(0);
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

  async function openThread(id,cursor=null,options={}) {
    const intent=options.intent??viewEpoch.current,anchorId=options.anchorId??null,rowOnly=Boolean(options.row);
    const sessionSignal=scope.current?.signal;
    if(!sessionSignal||!current(sessionSignal)||intent!==viewEpoch.current)return;
    const append=Boolean(cursor)&&!anchorId;
    if(append&&(threadLoading||threadLive.current?.id!==id))return;
    threadRequest.current?.abort();
    if(!append&&!rowOnly)setThread(null);
    if(!id){threadRequest.current=null;setThreadLoading(false);return;}
    const request=new AbortController();threadRequest.current=request;setThreadLoading(true);
    const cancel=()=>request.abort();sessionSignal.addEventListener("abort",cancel,{once:true});
    try {
      const value=validateCommunityThread(await rpc(anchorId?"community_reply_context":"community_thread",anchorId?{p_post_id:id,p_anchor_id:anchorId,p_limit:rowOnly?1:25}:append?{p_post_id:id,p_cursor:cursor,p_limit:25}:{p_post_id:id},request.signal),id),deadlines=[];
      if(value.comments.length>(rowOnly?1:25)||(anchorId&&(value.anchorId!==anchorId||value.comments[0]?.id!==anchorId||typeof value.hasEarlier!=="boolean")))throw new Error("Invalid reply context");
      if(rowOnly&&threadLive.current?.version!==value.version){
        const restored=await openThread(id,null,{intent});if(restored&&current(sessionSignal)&&intent===viewEpoch.current)setMessage("Discussion changed. The latest replies are now shown.");return restored;
      }
      const targets=[...(rowOnly?[]:[{type:"post",item:value}]),...value.comments.map(item=>({type:"comment",item}))];
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
      if(!current(sessionSignal)||intent!==viewEpoch.current||request.signal.aborted||threadRequest.current!==request)return;
      const deadline=deadlines.length?Math.min(...deadlines):null;
      setThread(previous=>{
        if(!append&&!rowOnly)return {...value,mediaExpiresAt:deadline};
        if(!previous||previous.id!==id||previous.version!==value.version)return previous;
        const oldDeadline=previous.mediaExpiresAt;
        return {...(rowOnly?previous:{...value,anchorId:previous.anchorId,hasEarlier:previous.hasEarlier}),comments:mergeCommunityComments(previous.comments,value.comments),mediaExpiresAt:oldDeadline&&deadline?Math.min(oldDeadline,deadline):oldDeadline??deadline};
      });
      return true;
    }catch(error){
      if(!current(sessionSignal)||intent!==viewEpoch.current||request.signal.aborted||threadRequest.current!==request)return;
      if(append&&error?.details==="community_thread_changed"){
        const restored=await openThread(id,null,{intent});if(current(sessionSignal)&&intent===viewEpoch.current&&restored)setMessage("Discussion changed. The latest replies are now shown.");
      }else{
        const denied=error?.code==="42501"||error?.context?.status===403;
        if((!append&&!rowOnly)||denied)setThread(null);
        setMessage(denied?"This discussion or its images are unavailable. Refresh the feed or try again.":rowOnly?"Marked helpful. Couldn’t refresh the count. Refresh this discussion to check it.":append?"Couldn’t load more replies. Try again.":"This discussion or its images are unavailable. Refresh the feed or try again.");
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
    if(current(signal)&&job.viewEpoch===viewEpoch.current)await openThread(job.postId,null,{intent:job.viewEpoch,anchorId:job.targetType==="comment"?job.targetId:null});
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
      await load(signal);await revealWrite(job,signal);
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
      await load(signal);if(current(signal)&&job.viewEpoch===viewEpoch.current&&receipt.postStatus!=="hidden")await openThread(receipt.postId,null,{intent:job.viewEpoch,anchorId:job.kind==="comment"&&receipt.status!=="hidden"?receipt.id:null});
      return true;
    }
    if(job.files.length){
      const imageJob={targetType:job.kind,targetId:receipt.id,postId:receipt.postId,files:job.files,next:0,viewEpoch:job.viewEpoch};
      (job.kind==="post"?setPendingPost:setPendingReply)(imageJob);
      await finishImages(imageJob,signal);
    }else{
      setMessage(receipt.replayed?"Your saved text is confirmed.":job.kind==="post"?"Your post is live.":"Reply added.");
      await load(signal);await revealWrite({targetType:job.kind,targetId:receipt.id,postId:receipt.postId,viewEpoch:job.viewEpoch},signal);
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
    postFormVersion={postFormVersion} replyFormVersion={replyFormVersion} onOpen={chooseThread}
    onMoreComments={()=>thread?.nextCursor&&openThread(thread.id,thread.nextCursor)} onReloadFeed={()=>scope.current&&load(scope.current.signal)}
    onRetryTextPost={()=>mutate(signal=>finishWrite({...pendingTextPost,viewEpoch:viewEpoch.current},signal))} onStopTextPost={()=>stopWrite(pendingTextPost)}
    onRetryTextReply={()=>mutate(signal=>finishWrite({...pendingTextReply,viewEpoch:viewEpoch.current},signal))} onStopTextReply={()=>stopWrite(pendingTextReply)}
    onRetryPost={()=>mutate(signal=>finishImages({...pendingPost,viewEpoch:viewEpoch.current},signal))} onSkipPost={()=>skipImages(pendingPost)}
    onRetryReply={()=>mutate(signal=>finishImages({...pendingReply,viewEpoch:viewEpoch.current},signal))} onSkipReply={()=>skipImages(pendingReply)}
    onSubmit={(fields,files)=>mutate(async signal=>{
      if(pendingPost||pendingTextPost)return false;
      const invalid=checkCommunityFiles(files);if(invalid){setMessage(invalid);return false;}
      return finishWrite({...newCommunityWrite("post",{p_exam:fields.exam,p_topic:fields.topic,p_title:fields.title,p_body:fields.body},files),viewEpoch:viewEpoch.current},signal);
    })}
    onComment={(postId,parentId,body,files)=>mutate(async signal=>{
      if(pendingReply||pendingTextReply)return false;
      const invalid=checkCommunityFiles(files);if(invalid){setMessage(invalid);return false;}
      return finishWrite({...newCommunityWrite("comment",{p_post_id:postId,p_parent_id:parentId,p_body:body},files),viewEpoch:viewEpoch.current},signal);
    })}
    onHelpful={id=>mutate(async signal=>{
      const intent=viewEpoch.current,postId=threadLive.current?.id;
      await rpc("mark_community_helpful",{p_comment_id:id},signal);
      if(!current(signal)||intent!==viewEpoch.current||!postId)return;
      setThread(value=>value?.id===postId?{...value,comments:value.comments.map(comment=>comment.id===id?{...comment,markedHelpful:true}:comment)}:value);
      const refreshed=await openThread(postId,null,{anchorId:id,row:true,intent});
      if(refreshed&&current(signal)&&intent===viewEpoch.current)setMessage("Marked helpful.");
    })}
    onReport={(postId,commentId)=>mutate(async signal=>{await rpc("report_community_content",{p_post_id:postId,p_comment_id:commentId,p_reason:"other",p_details:"Reported from discussion view"},signal);if(current(signal))setMessage("Report sent for moderator review.");})}
  /></PortalShell>;
}
export function CommunityController({View}) {
  const {session,loading}=useAuthState();
  if(loading)return <section className="wrap section"><p role="status">Checking your account…</p></section>;
  if(!session)return <section className="wrap section"><h1>Sign in to the <em>community.</em></h1><Link to="/account">Student sign in</Link></section>;
  return <CommunitySession key={session.user.id} View={View} />;
}
