import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CommunityController } from "./CommunityController.jsx";
import { CommunityThread } from "./CommunityThread.jsx";
import { CommunityReporting } from "./CommunityReporting.jsx";
import { CommunityImages } from "./CommunityImages.jsx";
import { CommunityArticle } from "./CommunityArticle.jsx";
import { CommunitySaveDialog } from "./CommunitySaveDialog.jsx";
import { CommunityLinkPreview } from "./CommunityLinks.jsx";
import { CommunityStaffDialog } from "./CommunityStaffDialog.jsx";
import { PendingImages, PendingText } from "./Community.jsx";
import { CommunityStandingNotice, communityDate, useCommunityStanding } from "./CommunityFrame.jsx";
import { ARTICLE_TITLE, ARTICLE_TOPIC_MAX, FEEDBACK_TEMPLATE, articleStats, contactDetails, contactMessages } from "./community-article.mjs";
import { communityFailure, validateCommunityAccept, validateCommunityEdit, validateCommunityFeature, validateCommunityLike, validateCommunityReader } from "./community-library.js";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const kinds = {
  discussion: { back: "/dashboard/community", backLabel: "Back to discussions", images: "Question attachment", attach: "Add discussion images", body: [20, 5000] },
  article: { back: "/dashboard/community/articles", backLabel: "Back to articles", images: "Article image", attach: "Add article images", body: [200, 20000] },
  work: { back: "/dashboard/community/work", backLabel: "Back to work", images: "Work image", attach: "Add images of your work", body: [40, 5000] },
  link: { back: "/dashboard/community/links", backLabel: "Back to links", images: "Image", attach: "Add images", body: [20, 5000] },
};
const length = value => [...value].length;

function ReaderHeading({ headingRef }) {
  return <><span className="eyebrow">COMMUNITY</span><h1 ref={headingRef} tabIndex={-1}>Read, then <em>keep it.</em></h1></>;
}

// Problems that stop an edit, before it is sent. The server checks again.
function editProblems(kind, fields) {
  const [min, max] = kinds[kind].body, problems = [];
  const topic = fields.topic.trim(), title = fields.title.trim(), body = fields.body.trim();
  if (!topic || length(topic) > ARTICLE_TOPIC_MAX) problems.push("Add a topic of up to 100 characters.");
  if (length(title) < ARTICLE_TITLE.min || length(title) > ARTICLE_TITLE.max) problems.push("Write a title of 8 to 160 characters.");
  if (length(body) < min || length(body) > max) problems.push(`Keep the text between ${min.toLocaleString("en-IN")} and ${max.toLocaleString("en-IN")} characters.`);
  const contact = contactDetails(`${topic}\n${title}\n${body}`);
  if (contact) problems.push(contactMessages[contact]);
  return problems;
}

// A View for CommunityController: the session supplies the verified thread,
// image links, comment writes and reporting; this adds like, save, block,
// accepted answers, editing and the staff actions.
function ReaderView({ thread, threadLoading, message, busy, rpc, onOpen, onComment, onHelpful, onReport, onAddImages, onMoreComments,
  pendingPost, pendingReply, pendingTextPost, pendingTextReply, replyFormVersion, onRetryPost, onRetryReply, onSkipPost, onSkipReply,
  onRetryTextPost, onRetryTextReply, onStopTextPost, onStopTextReply }) {
  const { id } = useParams(), navigate = useNavigate(), location = useLocation(), standing = useCommunityStanding(rpc);
  const open = useRef(onOpen); open.current = onOpen;
  const [like, setLike] = useState(null), [folderIds, setFolderIds] = useState(null), [saving, setSaving] = useState(false), [working, setWorking] = useState(false);
  const [accepted, setAccepted] = useState(undefined), [featured, setFeatured] = useState(null);
  const [notice, setNotice] = useState(typeof location.state?.notice === "string" ? location.state.notice : ""), [confirmBlock, setConfirmBlock] = useState(false);
  const [editing, setEditing] = useState(null), [editProblemsList, setEditProblems] = useState(null), [staff, setStaff] = useState(null);
  const [reportTarget, setReportTarget] = useState(null), title = useRef(null), saveButton = useRef(null), reportOpener = useRef(null), staffOpener = useRef(null);
  const scope = useRef(null), focused = useRef(null), refocus = useRef(false), editProblemsRef = useRef(null);
  const valid = uuid.test(id ?? "");
  useEffect(() => {
    const controller = new AbortController(); scope.current = controller;
    setLike(null); setFolderIds(null); setConfirmBlock(false); setAccepted(undefined); setFeatured(null); setEditing(null); setStaff(null);
    // The session creates its request scope in its own effect, which runs after this one.
    if (valid) Promise.resolve().then(() => { if (!controller.signal.aborted) open.current(id); });
    return () => controller.abort();
  }, [id, valid]);
  let header = null, broken = false;
  if (thread && thread.id === id) { try { header = validateCommunityReader(thread); } catch { broken = true; } }
  useLayoutEffect(() => {
    if (header && (focused.current !== id || refocus.current)) { focused.current = id; refocus.current = false; title.current?.focus(); }
  }, [Boolean(header), id, header?.version]);
  useLayoutEffect(() => { if (editProblemsList) editProblemsRef.current?.focus(); }, [editProblemsList]);
  const acceptedId = accepted !== undefined ? accepted : header?.acceptedCommentId ?? null;
  // Work: a teacher's top-level feedback is listed first. Every post: the accepted flag follows the latest choice.
  const shown = useMemo(() => {
    if (!thread) return thread;
    const comments = thread.comments.map(comment => ({ ...comment, accepted: comment.id === acceptedId }));
    if (header?.kind === "work") comments.sort((a, b) => Number(b.parentId === null && b.teacher === true) - Number(a.parentId === null && a.teacher === true));
    return { ...thread, comments };
  }, [thread, acceptedId, header?.kind]);

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

  const kind = kinds[header.kind], liked = like?.liked ?? header.liked, likes = like?.likes ?? header.likes, folders = folderIds ?? header.folderIds;
  const isFeatured = featured ?? header.featured, locked = thread.status === "locked", formatted = header.kind === "article" || header.kind === "work", stats = articleStats(header.body);
  const toggleLike = () => act(async signal => {
    const next = !liked, value = validateCommunityLike(await rpc("set_community_like", { p_post_id: id, p_liked: next }, signal), id, next);
    if (!signal.aborted) setLike(value);
  }, "That like didn’t save. Try again.");
  const blockAuthor = () => act(async signal => {
    await rpc("set_community_block", { p_post_id: id, p_comment_id: null }, signal);
    if (!signal.aborted) navigate(kind.back, { state: { notice: `You blocked ${header.author}. Their posts and replies are hidden from you. Unblock from Saved.` } });
  }, "Couldn’t block this author. Try again.");
  const blockReply = commentId => act(async signal => {
    await rpc("set_community_block", { p_post_id: null, p_comment_id: commentId }, signal);
    if (signal.aborted) return;
    refocus.current = true; setNotice("Author blocked. Their replies are hidden from you. Unblock from Saved."); onOpen(id);
  }, "Couldn’t block this author. Try again.");
  const accept = comment => act(async signal => {
    const next = acceptedId === comment.id ? null : comment.id;
    const value = validateCommunityAccept(await rpc("accept_community_answer", { p_post_id: id, p_comment_id: next }, signal), id, next);
    if (signal.aborted) return;
    setAccepted(value);
    setNotice(value ? `You accepted ${comment.author}’s reply as the answer.` : "The accepted answer is cleared. The question is back in Unanswered.");
  }, "That choice didn’t save. Try again.");
  const toggleFeatured = () => act(async signal => {
    const value = validateCommunityFeature(await rpc("set_community_featured", { p_post_id: id, p_featured: !isFeatured }, signal), id, !isFeatured);
    if (signal.aborted) return;
    setFeatured(value); setNotice(value ? "Added to the featured shelf on Articles." : "Removed from the featured shelf.");
  }, "The shelf didn’t change. Try again.");
  async function saveEdit(event) {
    event.preventDefault();
    const found = editProblems(header.kind, editing);
    if (found.length) { setEditProblems(found); return; }
    await act(async signal => {
      const value = validateCommunityEdit(await rpc("edit_community_post", { p_post_id: id, p_topic: editing.topic.trim(), p_title: editing.title.trim(),
        p_body: editing.body.trim(), p_version: header.version }, signal), id);
      if (signal.aborted) return;
      setEditing(null); setEditProblems(null);
      if (value.changed) { refocus.current = true; setNotice("Your changes are saved. Earlier versions are kept for moderators."); onOpen(id); }
      else { setNotice("Nothing changed."); title.current?.focus(); }
    }, "Your changes didn’t save. Try again.");
  }
  function openStaff(action, opener) { staffOpener.current = opener; setStaff(action); }
  function closeStaff(saved) {
    const action = staff; setStaff(null);
    if (saved && action.kind === "hold" && action.targetType === "post") { navigate(kind.back, { state: { notice: "Held for review. An administrator will decide whether to restore it." } }); return; }
    if (saved && action.kind === "hold") { refocus.current = true; setNotice("Reply held for review."); onOpen(id); title.current?.focus(); return; }
    if (saved) setNotice("The author is paused. Lift it from the admin page.");
    if (staffOpener.current?.isConnected) staffOpener.current.focus(); else title.current?.focus();
  }
  function report(postId, commentId, opener) {
    reportOpener.current = opener ?? document.activeElement;
    const comment = thread.comments.find(item => item.id === commentId);
    setReportTarget({ postId, commentId, label: comment ? `Reply by ${comment.author || "Student"}: ${comment.body.slice(0, 200)}` : thread.title });
  }
  const replyActions = comment => <>
    {header.canAccept && !comment.isMine && !locked && <button type="button" className="text-button" aria-disabled={working || busy} aria-pressed={comment.id === acceptedId}
      onClick={() => accept(comment)}>{comment.id === acceptedId ? "Clear accepted answer" : "Accept as answer"}</button>}
    {header.canHold && !comment.isMine && <button type="button" className="text-button" onClick={event => openStaff({ kind: "hold", targetType: "comment", targetId: comment.id, label: `Reply by ${comment.author}: ${comment.body.slice(0, 200)}` }, event.currentTarget)}>Hold reply</button>}
    {header.canSanction && !comment.isMine && <button type="button" className="text-button" onClick={event => openStaff({ kind: "sanction", targetType: "comment", targetId: comment.id, label: `Author of: ${comment.body.slice(0, 200)}` }, event.currentTarget)}>Pause author</button>}
  </>;
  const acceptedLoaded = acceptedId && thread.comments.some(comment => comment.id === acceptedId);
  return <div className="community-reader">
    <p><Link to={kind.back}>{kind.backLabel}</Link></p>
    <CommunityStandingNotice standing={standing} />
    {(notice || message) && <p role="status" className="notice">{notice || message}</p>}
    <article aria-labelledby="community-reader-title">
      <span className="eyebrow">{header.kind === "work" ? "Work for feedback · " : header.kind === "link" ? "Link · " : ""}{thread.exam} · {thread.topic}{locked ? " · Locked" : ""}{isFeatured ? " · Featured" : ""}</span>
      <h2 id="community-reader-title" ref={title} tabIndex={-1}>{thread.title}</h2>
      <p className="community-byline">By {header.author}{header.teacher ? " · Teacher" : ""}{header.isMine ? " (you)" : ""} · {communityDate(header.createdAt)}
        {header.kind === "article" ? ` · ${stats.minutes} min read` : ""}{header.editedAt ? ` · Edited ${communityDate(header.editedAt)}` : ""}</p>
      {editing ? <form className="admin-form community-edit" onSubmit={saveEdit} noValidate aria-label="Edit post">
        <fieldset className="community-fields" disabled={working}>
          <label>Topic<input value={editing.topic} maxLength={ARTICLE_TOPIC_MAX} onChange={event => { setEditProblems(null); setEditing({ ...editing, topic: event.target.value }); }} /></label>
          <label>Title<input value={editing.title} maxLength={ARTICLE_TITLE.max} onChange={event => { setEditProblems(null); setEditing({ ...editing, title: event.target.value }); }} /></label>
          <label>Text<textarea value={editing.body} rows={14} maxLength={kind.body[1]} onChange={event => { setEditProblems(null); setEditing({ ...editing, body: event.target.value }); }} /></label>
          {formatted && <small>Formatting works as when writing: ## for a heading, **bold**, *italic*, - for a list.</small>}
          {editProblemsList && <div ref={editProblemsRef} tabIndex={-1} role="alert" className="error"><ul>{editProblemsList.map(item => <li key={item}>{item}</li>)}</ul></div>}
          <div className="community-editor-actions">
            <button className="button" type="submit">{working ? "Saving…" : "Save changes"}</button>
            <button className="button quiet" type="button" onClick={() => { setEditing(null); setEditProblems(null); title.current?.focus(); }}>Cancel</button>
          </div>
          <small>Readers see that the post was edited. Moderators can see earlier versions.</small>
        </fieldset>
      </form> : formatted ? <CommunityArticle source={header.body} /> : header.kind === "link" ? <>
        <div className="community-link-preview-frame"><CommunityLinkPreview link={header.link} /></div>
        <p className="community-note"><strong>Why {header.isMine ? "you" : header.author} shared it:</strong> <span className="community-comment-body">{header.body}</span></p>
      </> : <p className="community-comment-body">{header.body}</p>}
      <CommunityImages images={thread.media} label={kind.images} expiresAt={thread.mediaExpiresAt} onUnavailableFocus={() => title.current?.focus()} />
    </article>
    {header.kind === "discussion" && (acceptedId
      ? <p className="notice community-answered">This question has an accepted answer.{acceptedLoaded && <> <button type="button" className="text-button"
          onClick={() => document.getElementById(`community-comment-${acceptedId}`)?.focus()}>Go to the accepted answer</button></>}</p>
      : header.canAccept && !locked && <p className="muted">When a reply answers your question, choose Accept as answer on it. Others will see it first.</p>)}
    <div className="community-reader-actions" role="group" aria-label="Post actions">
      {header.isMine ? <span>{likes} {likes === 1 ? "like" : "likes"}</span>
        : <button type="button" className="button quiet" aria-pressed={liked} aria-disabled={working} onClick={toggleLike}>{liked ? "Liked" : "Like"} · {likes}</button>}
      <button type="button" className="button quiet" ref={saveButton} aria-disabled={working} onClick={() => { if (!working) setSaving(true); }}>{folders.length ? `Saved in ${folders.length} ${folders.length === 1 ? "folder" : "folders"}` : "Save"}</button>
      {header.canEdit && !editing && !standing?.sanction && <button type="button" className="text-button" onClick={() => setEditing({ topic: thread.topic, title: thread.title, body: header.body })}>Edit</button>}
      {header.canFeature && <button type="button" className="text-button" aria-pressed={isFeatured} aria-disabled={working} onClick={toggleFeatured}>{isFeatured ? "Remove from featured" : "Feature on Articles"}</button>}
      <button type="button" className="text-button" disabled={busy} onClick={event => report(id, null, event.currentTarget)}>Report</button>
      {!header.isMine && (confirmBlock
        ? <span className="community-confirm">Hide everything from {header.author}? <button type="button" className="text-button" disabled={working} onClick={blockAuthor}>Yes, block</button> <button type="button" className="text-button" onClick={() => setConfirmBlock(false)}>Cancel</button></span>
        : <button type="button" className="text-button" onClick={() => setConfirmBlock(true)}>Block this author</button>)}
    </div>
    {(header.canHold || header.canSanction) && <div className="community-reader-actions community-staff-actions" role="group" aria-label="Moderation">
      {header.canHold && !header.isMine && <button type="button" className="text-button" onClick={event => openStaff({ kind: "hold", targetType: "post", targetId: id, label: thread.title }, event.currentTarget)}>Hold for review</button>}
      {header.canSanction && !header.isMine && <button type="button" className="text-button" onClick={event => openStaff({ kind: "sanction", targetType: "post", targetId: id, label: `Author of: ${thread.title}` }, event.currentTarget)}>Pause this author</button>}
      {header.canSanction && header.editedAt && <button type="button" className="text-button" onClick={event => openStaff({ kind: "history", targetType: "post", targetId: id, label: thread.title }, event.currentTarget)}>Edit history</button>}
    </div>}
    <PendingText job={pendingTextReply} busy={busy} onRetry={onRetryTextReply} onStop={onStopTextReply} onReload={() => onOpen(id)} />
    <PendingImages job={pendingPost} busy={busy} onRetry={onRetryPost} onSkip={onSkipPost} onOpen={() => onOpen(id)} />
    <PendingImages job={pendingReply} busy={busy} onRetry={onRetryReply} onSkip={onSkipReply} onOpen={() => onOpen(id)} />
    <CommunityThread key={thread.id} embedded thread={shown} busy={busy || working} pendingPost={pendingPost} pendingReply={pendingReply}
      pendingTextPost={pendingTextPost} pendingTextReply={pendingTextReply} replyFormVersion={replyFormVersion} loading={threadLoading}
      onOpen={() => onOpen(id)} onMore={onMoreComments} onComment={onComment} onHelpful={onHelpful} onReport={report} onAddImages={onAddImages} onBlock={blockReply}
      renderActions={replyActions} replyTemplate={header.kind === "work" ? FEEDBACK_TEMPLATE : undefined} attachLabel={kind.attach} />
    {saving && <CommunitySaveDialog postId={id} selected={folders} rpc={rpc} onClose={value => {
      setSaving(false);
      if (value) { setFolderIds(value); setNotice(value.length ? "Saved. Find it under Saved." : "Removed from your folders."); }
      saveButton.current?.focus();
    }} />}
    {staff && <CommunityStaffDialog action={staff} rpc={rpc} onClose={closeStaff} />}
    {reportTarget && <CommunityReporting target={reportTarget} onSubmit={onReport} onClose={() => { setReportTarget(null); if (reportOpener.current?.isConnected) reportOpener.current.focus(); }} />}
  </div>;
}

export function CommunityReader() {
  return <CommunityController View={ReaderView} Heading={ReaderHeading} loadFeed={false} />;
}
