import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CommunityController } from "./CommunityController.jsx";
import { CommunityThread } from "./CommunityThread.jsx";
import { CommunityReporting } from "./CommunityReporting.jsx";
import { CommunityImages } from "./CommunityImages.jsx";
import { CommunityArticle } from "./CommunityArticle.jsx";
import { CommunitySaveDialog } from "./CommunitySaveDialog.jsx";
import { PendingImages, PendingText } from "./Community.jsx";
import { communityDate } from "./CommunityFrame.jsx";
import { articleStats } from "./community-article.mjs";
import { communityFailure, validateCommunityLike, validateCommunityReader } from "./community-library.js";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function ReaderHeading({ headingRef }) {
  return <><span className="eyebrow">COMMUNITY</span><h1 ref={headingRef} tabIndex={-1}>Read, then <em>keep it.</em></h1></>;
}

// A View for CommunityController: the session supplies the verified thread,
// image links, comment writes and reporting; this adds like, save and block.
function ReaderView({ thread, threadLoading, message, busy, rpc, onOpen, onComment, onHelpful, onReport, onAddImages, onMoreComments,
  pendingPost, pendingReply, pendingTextPost, pendingTextReply, replyFormVersion, onRetryPost, onRetryReply, onSkipPost, onSkipReply,
  onRetryTextPost, onRetryTextReply, onStopTextPost, onStopTextReply }) {
  const { id } = useParams(), navigate = useNavigate(), location = useLocation();
  const open = useRef(onOpen); open.current = onOpen;
  const [like, setLike] = useState(null), [folderIds, setFolderIds] = useState(null), [saving, setSaving] = useState(false), [working, setWorking] = useState(false);
  const [notice, setNotice] = useState(typeof location.state?.notice === "string" ? location.state.notice : ""), [confirmBlock, setConfirmBlock] = useState(false);
  const [reportTarget, setReportTarget] = useState(null), title = useRef(null), saveButton = useRef(null), reportOpener = useRef(null), scope = useRef(null), focused = useRef(null);
  const valid = uuid.test(id ?? "");
  useEffect(() => {
    const controller = new AbortController(); scope.current = controller;
    setLike(null); setFolderIds(null); setConfirmBlock(false);
    // The session creates its request scope in its own effect, which runs after this one.
    if (valid) Promise.resolve().then(() => { if (!controller.signal.aborted) open.current(id); });
    return () => controller.abort();
  }, [id, valid]);
  let header = null, broken = false;
  if (thread && thread.id === id) { try { header = validateCommunityReader(thread); } catch { broken = true; } }
  useLayoutEffect(() => { if (header && focused.current !== id) { focused.current = id; title.current?.focus(); } }, [Boolean(header), id]);

  async function act(action, fallback) {
    const signal = scope.current?.signal;
    if (working || busy || !signal || signal.aborted) return;
    setWorking(true); setNotice("");
    try { await action(signal); }
    catch (error) { if (!signal.aborted) setNotice(communityFailure(error, fallback)); }
    finally { if (!signal.aborted) setWorking(false); }
  }
  if (!valid) return <p role="alert" className="error">This link is not a Community post. <Link to="/dashboard/community/articles">Back to articles</Link></p>;
  if (!header) return <div>
    <p><Link to="/dashboard/community/articles">Back to articles</Link></p>
    {broken ? <p role="alert" className="error">This post could not be verified. Refresh and try again.</p>
      : <p role="status">{threadLoading || !message ? "Loading…" : message}</p>}
    {!threadLoading && (message || broken) && <button type="button" className="button quiet" onClick={() => onOpen(id)}>Try again</button>}
  </div>;

  const liked = like?.liked ?? header.liked, likes = like?.likes ?? header.likes, folders = folderIds ?? header.folderIds, isArticle = header.kind === "article";
  const stats = articleStats(header.body), locked = thread.status === "locked";
  const toggleLike = () => act(async signal => {
    const next = !liked, value = validateCommunityLike(await rpc("set_community_like", { p_post_id: id, p_liked: next }, signal), id, next);
    if (!signal.aborted) setLike(value);
  }, "That like didn’t save. Try again.");
  const blockAuthor = () => act(async signal => {
    await rpc("set_community_block", { p_post_id: id, p_comment_id: null }, signal);
    if (!signal.aborted) navigate("/dashboard/community/articles", { state: { notice: `You blocked ${header.author}. Their posts and replies are hidden from you. Unblock from Saved.` } });
  }, "Couldn’t block this author. Try again.");
  const blockReply = commentId => act(async signal => {
    await rpc("set_community_block", { p_post_id: null, p_comment_id: commentId }, signal);
    if (signal.aborted) return;
    setNotice("Author blocked. Their replies are hidden from you. Unblock from Saved."); onOpen(id);
  }, "Couldn’t block this author. Try again.");
  function report(postId, commentId, opener) {
    reportOpener.current = opener ?? document.activeElement;
    const comment = thread.comments.find(item => item.id === commentId);
    setReportTarget({ postId, commentId, label: comment ? `Reply by ${comment.author || "Student"}: ${comment.body.slice(0, 200)}` : thread.title });
  }
  return <div className="community-reader">
    <p><Link to={isArticle ? "/dashboard/community/articles" : "/dashboard/community"}>{isArticle ? "Back to articles" : "Back to discussions"}</Link></p>
    {(notice || message) && <p role="status" className="notice">{notice || message}</p>}
    <article aria-labelledby="community-reader-title">
      <span className="eyebrow">{thread.exam} · {thread.topic}{locked ? " · Locked" : ""}</span>
      <h2 id="community-reader-title" ref={title} tabIndex={-1}>{thread.title}</h2>
      <p className="community-byline">By {header.author}{header.isMine ? " (you)" : ""} · {communityDate(header.createdAt)}{isArticle ? ` · ${stats.minutes} min read` : ""}</p>
      {isArticle ? <CommunityArticle source={header.body} /> : <p>{header.body}</p>}
      <CommunityImages images={thread.media} label={isArticle ? "Article image" : "Question attachment"} expiresAt={thread.mediaExpiresAt} onUnavailableFocus={() => title.current?.focus()} />
    </article>
    <div className="community-reader-actions" role="group" aria-label="Post actions">
      {header.isMine ? <span>{likes} {likes === 1 ? "like" : "likes"}</span>
        : <button type="button" className="button quiet" aria-pressed={liked} aria-disabled={working} onClick={toggleLike}>{liked ? "Liked" : "Like"} · {likes}</button>}
      <button type="button" className="button quiet" ref={saveButton} aria-disabled={working} onClick={() => { if (!working) setSaving(true); }}>{folders.length ? `Saved in ${folders.length} ${folders.length === 1 ? "folder" : "folders"}` : "Save"}</button>
      <button type="button" className="text-button" disabled={busy} onClick={event => report(id, null, event.currentTarget)}>Report</button>
      {!header.isMine && (confirmBlock
        ? <span className="community-confirm">Hide everything from {header.author}? <button type="button" className="text-button" disabled={working} onClick={blockAuthor}>Yes, block</button> <button type="button" className="text-button" onClick={() => setConfirmBlock(false)}>Cancel</button></span>
        : <button type="button" className="text-button" onClick={() => setConfirmBlock(true)}>Block this author</button>)}
    </div>
    <PendingText job={pendingTextReply} busy={busy} onRetry={onRetryTextReply} onStop={onStopTextReply} onReload={() => onOpen(id)} />
    <PendingImages job={pendingPost} busy={busy} onRetry={onRetryPost} onSkip={onSkipPost} onOpen={() => onOpen(id)} />
    <PendingImages job={pendingReply} busy={busy} onRetry={onRetryReply} onSkip={onSkipReply} onOpen={() => onOpen(id)} />
    <CommunityThread key={thread.id} embedded thread={thread} busy={busy || working} pendingPost={pendingPost} pendingReply={pendingReply}
      pendingTextPost={pendingTextPost} pendingTextReply={pendingTextReply} replyFormVersion={replyFormVersion} loading={threadLoading}
      onOpen={() => onOpen(id)} onMore={onMoreComments} onComment={onComment} onHelpful={onHelpful} onReport={report} onAddImages={onAddImages} onBlock={blockReply} />
    {saving && <CommunitySaveDialog postId={id} selected={folders} rpc={rpc} onClose={value => {
      setSaving(false);
      if (value) { setFolderIds(value); setNotice(value.length ? "Saved. Find it under Saved." : "Removed from your folders."); }
      saveButton.current?.focus();
    }} />}
    {reportTarget && <CommunityReporting target={reportTarget} onSubmit={onReport} onClose={() => { setReportTarget(null); if (reportOpener.current?.isConnected) reportOpener.current.focus(); }} />}
  </div>;
}

export function CommunityReader() {
  return <CommunityController View={ReaderView} Heading={ReaderHeading} loadFeed={false} />;
}
