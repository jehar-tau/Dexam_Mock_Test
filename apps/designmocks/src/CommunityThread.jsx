import React, { useLayoutEffect, useRef, useState } from "react";
import { CommunityImages } from "./CommunityImages.jsx";
import { communityCommentOrder } from "./community-write.js";

export function CommunityThread({ thread, busy, pendingReply, pendingTextReply, replyFormVersion = 0, loading,
  onOpen, onMore, onComment, onHelpful, onReport }) {
  const [replyTo,setReplyTo] = useState(null), textarea = useRef(null), replyButton = useRef(null), heading = useRef(null);
  const comments = communityCommentOrder(thread.comments), byId = new Map(thread.comments.map(item=>[item.id,item]));
  useLayoutEffect(()=>{heading.current?.focus();},[]);
  useLayoutEffect(()=>{setReplyTo(null);},[replyFormVersion,thread.status]);
  useLayoutEffect(()=>{if(replyTo)textarea.current?.focus();},[replyTo?.id]);
  function cancelReply() { setReplyTo(null); if(replyButton.current?.isConnected)replyButton.current.focus(); }
  return <section className="community-thread" aria-label="Discussion thread">
    <button type="button" className="text-button" onClick={()=>onOpen(null)}>Close discussion</button>
    <button type="button" className="text-button" onClick={()=>onOpen(thread.id)}>Refresh discussion</button>
    <button type="button" className="text-button" disabled={busy} onClick={()=>onReport(thread.id,null)}>Report discussion</button>
    <span className="eyebrow">{thread.exam} · {thread.topic}</span><h2 ref={heading} tabIndex={-1}>{thread.title}</h2><p>{thread.body}</p>
    <CommunityImages images={thread.media} label="Question attachment" />
    {thread.status==="locked" && <p role="status">This discussion is locked. Existing images remain viewable.</p>}
    <form className="community-reply" key={replyFormVersion} onSubmit={async event=>{
      event.preventDefault(); const element=event.currentTarget,form=new FormData(element);
      const saved=await onComment(thread.id,replyTo?.id??null,form.get("body"),form.getAll("images").filter(file=>file.name));
      if(saved!==false)element.reset();
    }}>
      {replyTo && <div className="notice community-reply-context"><p>Replying to {replyTo.author || "Student"}: {replyTo.body.slice(0,160)}</p>
        <button type="button" disabled={busy || Boolean(pendingTextReply)} onClick={cancelReply}>Cancel nested reply</button></div>}
      <fieldset className="community-fields" aria-label="New reply" disabled={busy || Boolean(pendingReply) || Boolean(pendingTextReply) || thread.status==="locked"}>
        <label>{replyTo ? "Your reply to comment" : "Add a reply"}<textarea ref={textarea} name="body" minLength="2" maxLength="3000" required /></label>
        <label>Solution images (optional, up to 3)<input name="images" type="file" accept="image/png,image/jpeg,image/webp" multiple aria-describedby="community-reply-image-help" /></label>
        <small id="community-reply-image-help">Up to 5 MB and 24 megapixels each. Remove visible personal details before sharing.</small>
        <button className="button">Reply</button>
      </fieldset>
    </form>
    <ol className="community-comments" id={`community-comments-${thread.id}`}>
      {comments.map(comment=>{
        const parent=comment.parentAvailable===false ? null : byId.get(comment.parentId) ?? comment.parentPreview;
        return <li key={comment.id} style={{marginInlineStart:`${Math.min(comment.depth,2)*.75}rem`}}><article className="community-comment" aria-label={`Comment by ${comment.author || "Student"}`}>
          {comment.parentId && <p className="community-parent-context">{parent ? `Reply to ${parent.author || "Student"}: ${parent.body.slice(0,160)}` : "Reply to a removed or unavailable comment."}</p>}
          <p>{comment.body}</p><CommunityImages images={comment.media} label="Solution attachment" />
          <small>By {comment.author} · {comment.helpful} helpful</small>
          <div className="community-actions">
            {thread.status!=="locked" && comment.canReply!==false && <button type="button" className="text-button" disabled={busy || Boolean(pendingReply) || Boolean(pendingTextReply)}
              aria-label={`Reply to comment by ${comment.author || "Student"}`} onClick={event=>{replyButton.current=event.currentTarget;setReplyTo(comment);}}>Reply to comment</button>}
            {!comment.isMine && <button type="button" className="text-button" disabled={busy || comment.markedHelpful} aria-pressed={Boolean(comment.markedHelpful)} onClick={()=>onHelpful(comment.id)}>{comment.markedHelpful ? "Marked helpful" : "Mark helpful"}</button>}
            <button type="button" className="text-button" disabled={busy} onClick={()=>onReport(null,comment.id)}>Report</button>
          </div>
        </article></li>;
      })}
    </ol>
    {thread.nextCursor && <button type="button" className="button quiet" disabled={busy || loading} aria-controls={`community-comments-${thread.id}`} onClick={onMore}>{loading ? "Loading replies…" : "Load more replies"}</button>}
  </section>;
}
