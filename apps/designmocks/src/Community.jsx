import React, { useState } from "react";
import { CommunityController } from "./CommunityController.jsx";
import { PrivateRasterImage } from "./DrawingInspection.jsx";

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

function CommunityImages({ images = [], label }) {
  return images.map((image, index) => <div className="community-image-frame" key={`${image.id}:${image.url}`}>
    <PrivateRasterImage image={image} label={`${label} ${index + 1}`} />
  </div>);
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
      <form className="admin-form" onSubmit={submit}>
        <fieldset className="community-fields" aria-label="New discussion" disabled={busy || Boolean(pendingPost)}>
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
      {message && <p role="status">{message}</p>}
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
      {thread && (
        <section className="community-thread" aria-label="Discussion thread">
          <button className="text-button" onClick={() => onOpen(null)}>
            Close discussion
          </button>
          <button type="button" className="text-button" onClick={() => onOpen(thread.id)}>Refresh discussion</button>
          <span className="eyebrow">{thread.exam} · {thread.topic}</span>
          <h2>{thread.title}</h2>
          <p>{thread.body}</p>
          <CommunityImages images={thread.media} label="Question attachment" />
          {thread.status === "locked" && <p role="status">This discussion is locked. Existing images remain viewable.</p>}
          <form
            className="community-reply"
            onSubmit={async (event) => {
              event.preventDefault();
              const element = event.currentTarget;
              const form = new FormData(element);
              const saved = await onComment(thread.id, null, form.get("body"), form.getAll("images").filter((file) => file.name));
              if (saved !== false) element.reset();
            }}
          >
            <fieldset className="community-fields" aria-label="New reply" disabled={busy || Boolean(pendingReply) || thread.status === "locked"}>
            <label>
              Add a reply
              <textarea name="body" minLength="2" maxLength="3000" required />
            </label>
            <label>
              Solution images (optional, up to 3)
              <input name="images" type="file" accept="image/png,image/jpeg,image/webp" multiple aria-describedby="community-reply-image-help" />
            </label>
            <small id="community-reply-image-help">Up to 5 MB and 24 megapixels each. Remove visible personal details before sharing.</small>
            <button className="button">Reply</button>
            </fieldset>
          </form>
          <div className="community-comments">
            {thread.comments.map((comment) => (
              <article key={comment.id}>
                <p>{comment.body}</p>
                <CommunityImages images={comment.media} label="Solution attachment" />
                <small>By {comment.author} · {comment.helpful} helpful</small>
                <div className="community-actions">
                  <button className="text-button" onClick={() => onHelpful(comment.id)}>
                    Mark helpful
                  </button>
                  <button className="text-button" onClick={() => onReport(null, comment.id)}>
                    Report
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
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
