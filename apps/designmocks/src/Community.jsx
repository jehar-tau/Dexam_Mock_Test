import React, { useState } from "react";
import { CommunityController } from "./CommunityController.jsx";
import { CommunityThread } from "./CommunityThread.jsx";

function PendingImages({ job, busy, onRetry, onSkip, onOpen }) {
  if (!job) return null;
  const kind = job.targetType === "post" ? "post" : "reply";
  return <section className="notice community-upload-recovery" aria-label={`Saved ${kind} images`}>
    <p>Your {kind} is saved. {job.next} of {job.files.length} images confirmed.</p>
    <button type="button" disabled={busy} onClick={onRetry}>Retry {kind} images</button>
    <button type="button" disabled={busy} onClick={() => onOpen(job.postId)}>Open saved discussion</button>
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

export function CommunityView({
  posts = [],
  thread = null,
  onSubmit,
  onOpen = () => {},
  onComment = () => {},
  onHelpful = () => {},
  onReport = () => {},
  message = "",
  busy = false, pendingPost = null, pendingReply = null,
  onRetryPost, onRetryReply, onSkipPost, onSkipReply,
  pendingTextPost = null, pendingTextReply = null, onRetryTextPost, onRetryTextReply, onStopTextPost, onStopTextReply,
  postFormVersion = 0, replyFormVersion = 0, threadLoading = false, onMoreComments, onReloadFeed,
}) {
  const submit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const saved = await onSubmit(Object.fromEntries(f), f.getAll("images").filter((file) => file.name));
    if (saved !== false) form.reset();
  };
  return (
    <section className="wrap section community-page">
      <span className="eyebrow">COMMUNITY</span>
      <h1>
        Ask clearly.
        <br />
        <em>Build together.</em>
      </h1>
      <p>
        Discuss methods and solutions without exposing private details or active
        assessment content.
      </p>
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
      <div className="community-feed">
        {posts.map((p) => (
          <article key={p.id}>
            <span className="eyebrow">
              {p.exam} · {p.topic}
            </span>
            <h2>{p.title}</h2>
            <p>{p.body}</p>
            <small>
              By {p.author} · {p.comments} replies
            </small>
            <button className="text-button" onClick={() => onOpen(p.id)}>
              Open discussion
            </button>
          </article>
        ))}
      </div>
      {thread && <CommunityThread key={thread.id} thread={thread} busy={busy} pendingReply={pendingReply} pendingTextReply={pendingTextReply}
        replyFormVersion={replyFormVersion} loading={threadLoading} onOpen={onOpen} onMore={onMoreComments}
        onComment={onComment} onHelpful={onHelpful} onReport={onReport} />}

    </section>
  );
}
export function Community() {
  return <CommunityController View={CommunityView} />;
}
export function CommunityPreview() {
  const [m, setM] = useState(""), [thread, setThread] = useState(null);
  const previewThread = {
    id: "1", exam: "uceed", topic: "observation",
    title: "How do you separate observation from assumption?",
    body: "I list visible facts first, then write interpretations separately.",
    media: [{ id: "m1", url: "/favicon.svg" }],
    comments: [{ id: "c1", body: "Try labelling each statement fact or inference.", author: "Ravi", helpful: 2, media: [{ id: "m2", url: "/favicon.svg" }] }],
  };
  return (
    <CommunityView
      posts={[
        {
          id: "1",
          exam: "uceed",
          topic: "observation",
          title: "How do you separate observation from assumption?",
          body: "I list visible facts first, then write interpretations separately.",
          author: "Asha",
          comments: 3,
        },
      ]}
      thread={thread}
      message={m}
      onOpen={(id) => setThread(id ? previewThread : null)}
      onComment={() => setM("Preview reply added.")}
      onHelpful={() => setM("Marked helpful.")}
      onReport={() => setM("Report sent for moderator review.")}
      onSubmit={(f, files) => setM(`Preview post created: ${f.title} · ${files.length} image${files.length === 1 ? "" : "s"}`)}
    />
  );
}
