import React, { useId, useLayoutEffect, useRef, useState } from "react";
import { CommunityController } from "./CommunityController.jsx";
import { CommunityThread } from "./CommunityThread.jsx";
import { CommunityReporting } from "./CommunityReporting.jsx";
import { communityFeedFilters } from "./community-feed.js";
import { PortalShell } from "./PortalShell.jsx";

function PendingImages({ job, busy, onRetry, onSkip, onOpen }) {
  if (!job) return null;
  const kind = job.targetType === "post" ? "post" : "reply";
  return <section className="notice community-upload-recovery" aria-label={`Saved ${kind} images`}>
    <p>{job.followUp?`Adding images to your saved ${kind}.`:`Your ${kind} is saved.`} {job.next} of {job.files.length} images confirmed.</p>
    <button type="button" disabled={busy} onClick={onRetry}>Retry {kind} images</button>
    <button type="button" disabled={busy} onClick={() => onOpen(job.postId,job.targetType==="comment"?{anchorId:job.targetId}:{})}>Open saved discussion</button>
    <button type="button" disabled={busy} onClick={onSkip}>Finish {kind} without remaining images</button>
  </section>;
}

function PendingText({ job, busy, onRetry, onStop, onReload }) {
  if (!job) return null;
  const kind=job.kind==="post" ? "post" : "reply";
  return <section className="notice community-upload-recovery" aria-label={`Unconfirmed ${kind} text`}>
    <p>Your {kind} hasn’t confirmed. Retrying checks the same request.</p>
    <small>Keep this page open to retry the selected text and files. Check discussions before posting again.</small>
    <button type="button" disabled={busy} onClick={onRetry}>Retry {kind} text</button>
    <button type="button" disabled={busy} onClick={onReload}>Check discussions</button>
    <button type="button" disabled={busy} onClick={onStop}>Stop retrying this {kind}</button>
  </section>;
}

export function CommunityHeading({headingRef}){return<><span className="eyebrow">COMMUNITY</span><h1 ref={headingRef} tabIndex={-1}>Ask clearly.<br/><em>Build together.</em></h1><p>Discuss methods and solutions without exposing private details or active assessment content.</p></>;}
export function CommunityView({
  posts = [],
  thread = null,
  onSubmit,
  onOpen = () => {},
  onComment = () => {},
  onHelpful = () => {},
  onReport = () => {},
  onAddImages = () => false,
  message = "",
  busy = false, pendingPost = null, pendingReply = null,
  onRetryPost, onRetryReply, onSkipPost, onSkipReply,
  pendingTextPost = null, pendingTextReply = null, onRetryTextPost, onRetryTextReply, onStopTextPost, onStopTextReply,
  postFormVersion = 0, replyFormVersion = 0, threadLoading = false, onMoreComments, onReloadFeed,
  feedFilters = {exam:null,topic:null}, feedLoading = false, feedNotice = "", feedReady = true, feedNextCursor = null,
  onFilter = () => {}, onMorePosts, heading = true, headingRef,
}) {
  const examFilterId=useId(),topicFilterId=useId();
  const openers=useRef(new Map()),localHeading=useRef(null),pageHeading=headingRef??localHeading,reportOpener=useRef(null),returnReportFocus=useRef(false),lastThread=useRef(null);
  const feedHeading=useRef(null),feedFocus=useRef(null),[pageNotice,setPageNotice]=useState("");
  const [reportTarget,setReportTarget]=useState(null);
  useLayoutEffect(()=>{
    if(thread){lastThread.current=thread.id;return;}
    if(threadLoading)return;
    const previous=lastThread.current;lastThread.current=null;
    if(previous&&document.activeElement===document.body)(openers.current.get(previous)??pageHeading.current)?.focus();
  },[thread?.id,threadLoading]);
  useLayoutEffect(()=>{
    const pending=feedFocus.current;
    if(!pending||feedLoading)return;
    const added=posts.filter(post=>!pending.ids.has(post.id)),active=document.activeElement;
    if(added.length)setPageNotice(`${added.length} more ${added.length===1?"discussion":"discussions"} loaded.`);
    if(active===pending.button||(!pending.button.isConnected&&active===document.body)) {
      if(added.length)document.getElementById(`community-post-${added[0].id}`)?.focus();
      else if(!pending.button.isConnected)feedHeading.current?.focus();
    }
    feedFocus.current=null;
  },[posts,feedLoading]);
  useLayoutEffect(()=>{
    if(reportTarget||busy||!returnReportFocus.current)return;
    returnReportFocus.current=false;
    (reportOpener.current?.isConnected?reportOpener.current:pageHeading.current)?.focus();
  },[reportTarget,busy]);
  function reportContent(postId,commentId,opener) {
    reportOpener.current=opener??document.activeElement;
    const comment=thread?.comments.find(item=>item.id===commentId);
    setReportTarget({postId,commentId,label:comment?`Reply by ${comment.author || "Student"}: ${comment.body.slice(0,200)}`:thread?.title});
  }
  function closeReport() {
    returnReportFocus.current=true;
    setReportTarget(null);
  }
  const viewThread=id=>{
    if(id)return onOpen(id);
    const target=openers.current.get(thread?.id);
    onOpen(null);
    (target?.isConnected?target:pageHeading.current)?.focus();
  };
  const submit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const saved = await onSubmit(Object.fromEntries(f), f.getAll("images").filter((file) => file.name));
    if (saved !== false) form.reset();
  };
  return (
    <section className={heading?"wrap section community-page":"community-content"}>
      {heading&&<CommunityHeading headingRef={pageHeading}/>}
      <form className="admin-form" key={postFormVersion} onSubmit={submit}>
        <fieldset className="community-fields" aria-label="New discussion" disabled={busy || Boolean(pendingPost) || Boolean(pendingTextPost)}>
        <label>
          Exam
          <select name="exam">
            {["uceed", "nid", "nift", "ceed"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Topic
          <input name="topic" required maxLength="100" />
        </label>
        <label>
          Question title
          <input name="title" required minLength="8" maxLength="160" />
        </label>
        <label>
          Your approach or question
          <textarea name="body" required minLength="20" maxLength="5000" />
        </label>
        <label>
          Question images (optional, up to 3)
          <input name="images" type="file" accept="image/png,image/jpeg,image/webp" multiple aria-describedby="community-post-image-help" />
        </label>
        <small id="community-post-image-help">Still PNG, JPEG or WebP, up to 5 MB and 24 megapixels each. Use your own or permitted images; remove names, faces and personal details.</small>
        <button className="button">Post to community</button>
        </fieldset>
      </form>
      {(message || (threadLoading && !thread)) && <p role="status">{message || "Loading discussion…"}</p>}
      <PendingText job={pendingTextPost} busy={busy} onRetry={onRetryTextPost} onStop={onStopTextPost} onReload={onReloadFeed} />
      <PendingText job={pendingTextReply} busy={busy} onRetry={onRetryTextReply} onStop={onStopTextReply} onReload={onReloadFeed} />
      <PendingImages job={pendingPost} busy={busy} onRetry={onRetryPost} onSkip={onSkipPost} onOpen={onOpen} />
      <PendingImages job={pendingReply} busy={busy} onRetry={onRetryReply} onSkip={onSkipReply} onOpen={onOpen} />
      <section aria-label="Community discussions" aria-busy={feedLoading}>
      <h2 ref={feedHeading} tabIndex={-1}>Discussions</h2>
      <form className="admin-form community-feed-filters" aria-label="Discussion filters" key={JSON.stringify(feedFilters)} onSubmit={event=>{
        event.preventDefault();const form=new FormData(event.currentTarget);setPageNotice("");onFilter({exam:form.get("exam"),topic:form.get("topic")});
      }}>
        <div><label htmlFor={examFilterId}>Exam filter</label><select id={examFilterId} name="exam" defaultValue={feedFilters.exam??""}>
          <option value="">All exams</option>{["uceed","ceed","nid","nift"].map(exam=><option value={exam} key={exam}>{exam.toUpperCase()}</option>)}
        </select></div>
        <div><label htmlFor={topicFilterId}>Topic filter</label><input id={topicFilterId} name="topic" defaultValue={feedFilters.topic??""} maxLength={100} placeholder="Exact topic (optional)" /></div>
        <button className="button" type="submit">Apply filters</button>
        <button className="button quiet" type="button" onClick={()=>{setPageNotice("");onFilter({exam:null,topic:null});}}>Clear filters</button>
      </form>
      <p className="muted">Topics match exactly, including case. Each page contains up to 25 discussions.</p>
      {(feedNotice||feedLoading) && <p role="status">{feedNotice||"Loading discussions…"}</p>}
      {feedReady&&!feedLoading&&posts.length===0&&<p>No discussions match these filters.</p>}
      {feedNotice && <button type="button" className="text-button" onClick={onReloadFeed}>Refresh discussions</button>}
      <div className="community-feed">
        {posts.map((p) => (
          <article key={p.id} id={`community-post-${p.id}`} tabIndex={-1}>
            <span className="eyebrow">
              {p.exam} · {p.topic}{p.status==="locked"?" · Locked":""}
            </span>
            <h2>{p.title}</h2>
            <p>{p.body}</p>
            <small>
              By {p.author} · {p.comments} replies
            </small>
            <button className="text-button" ref={node=>{if(node)openers.current.set(p.id,node);else openers.current.delete(p.id);}} onClick={() => onOpen(p.id)}>
              Open discussion
            </button>
          </article>
        ))}
      </div>
      {pageNotice && <p role="status">{pageNotice}</p>}
      {feedNextCursor && <button type="button" className="button quiet" aria-disabled={feedLoading} onClick={event=>{
        if(feedLoading)return;feedFocus.current={ids:new Set(posts.map(post=>post.id)),button:event.currentTarget};setPageNotice("");onMorePosts();
      }}>{feedLoading?"Loading discussions…":"Load more discussions"}</button>}
      </section>
      {thread && <CommunityThread key={thread.id} thread={thread} busy={busy} pendingPost={pendingPost} pendingReply={pendingReply} pendingTextPost={pendingTextPost} pendingTextReply={pendingTextReply}
        replyFormVersion={replyFormVersion} loading={threadLoading} onOpen={viewThread} onMore={onMoreComments}
        onComment={onComment} onHelpful={onHelpful} onReport={reportContent} onAddImages={onAddImages} />}
      {reportTarget && <CommunityReporting target={reportTarget} onSubmit={onReport} onClose={closeReport} />}

    </section>
  );
}
export function Community() {
  return <CommunityController View={CommunityView} Heading={CommunityHeading} />;
}
export function CommunityPreview() {
  const [m, setM] = useState(""), [thread, setThread] = useState(null);
  const [filters,setFilters]=useState(()=>communityFeedFilters());
  const previewThread = {
    id: "10000000-0000-4000-8000-000000000001", exam: "uceed", topic: "observation", isMine:true,canAttach:true,assetCount:1,
    title: "How do you separate observation from assumption?",
    body: "I list visible facts first, then write interpretations separately.",
    media: [{ id: "m1", url: "/favicon.svg" }],
    comments: [{ id: "20000000-0000-4000-8000-000000000001", body: "Try labelling each statement fact or inference.", author: "Ravi", helpful: 2, media: [{ id: "m2", url: "/favicon.svg" }] }],
  };
  return (
    <PortalShell><CommunityView
      feedFilters={filters} onFilter={value=>setFilters(communityFeedFilters(value.exam,value.topic))}
      posts={[
        {
          id: "10000000-0000-4000-8000-000000000001",
          exam: "uceed",
          topic: "observation",
          title: "How do you separate observation from assumption?",
          body: "I list visible facts first, then write interpretations separately.",
          author: "Asha",
          comments: 3,
        },
      ].filter(post=>(!filters.exam||post.exam===filters.exam)&&(!filters.topic||post.topic===filters.topic))}
      thread={thread}
      message={m}
      onOpen={(id) => setThread(id ? previewThread : null)}
      onComment={() => setM("Preview reply added.")}
      onHelpful={() => setM("Marked helpful.")}
      onReport={() => undefined}
      onAddImages={(_target,files)=>{setM(`Preview: ${files.length} additional image${files.length===1?"":"s"} selected.`);return true;}}
      onSubmit={(f, files) => setM(`Preview post created: ${f.title} · ${files.length} image${files.length === 1 ? "" : "s"}`)}
    /></PortalShell>
  );
}
