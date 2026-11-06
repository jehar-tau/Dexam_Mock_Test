import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "./PortalShell.jsx";
import { platform } from "./platform.js";
import { useAuthState } from "./useAuth.js";
const rpc = async (n, a) => {
  const { data, error } = await platform.rpc(n, a);
  if (error) throw error;
  return data;
};
export function CommunityView({
  posts = [],
  thread = null,
  onSubmit,
  onOpen = () => {},
  onComment = () => {},
  onHelpful = () => {},
  onReport = () => {},
  message = "",
}) {
  const submit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const saved = await onSubmit(Object.fromEntries(f), f.getAll("images").filter((file) => file.size));
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
          <input name="images" type="file" accept="image/png,image/jpeg,image/webp" multiple />
          <small>Use only your own or permitted images. Remove names, faces and other personal details.</small>
        </label>
        <button className="button">Post to community</button>
      </form>
      {message && <p role="status">{message}</p>}
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
          <span className="eyebrow">{thread.exam} · {thread.topic}</span>
          <h2>{thread.title}</h2>
          <p>{thread.body}</p>
          {thread.media?.map((image, index) => <img className="community-image" key={image.id} src={image.url} alt={`Question attachment ${index + 1}`} />)}
          <form
            className="community-reply"
            onSubmit={async (event) => {
              event.preventDefault();
              const element = event.currentTarget;
              const form = new FormData(element);
              const saved = await onComment(thread.id, null, form.get("body"), form.getAll("images").filter((file) => file.size));
              if (saved !== false) element.reset();
            }}
          >
            <label>
              Add a reply
              <textarea name="body" minLength="2" maxLength="3000" required />
            </label>
            <label>
              Solution images (optional, up to 3)
              <input name="images" type="file" accept="image/png,image/jpeg,image/webp" multiple />
            </label>
            <button className="button">Reply</button>
          </form>
          <div className="community-comments">
            {thread.comments.map((comment) => (
              <article key={comment.id}>
                <p>{comment.body}</p>
                {comment.media?.map((image, index) => <img className="community-image" key={image.id} src={image.url} alt={`Solution attachment ${index + 1}`} />)}
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
  const { session, loading } = useAuthState(),
    [posts, setPosts] = useState([]),
    [message, setMessage] = useState(""),
    [thread, setThread] = useState(null);
  const load = () =>
    rpc("community_feed", { p_exam: null, p_topic: null })
      .then(setPosts)
      .catch((e) => setMessage(e.message));
  const uploadMedia = async (targetType, targetId, files = []) => {
    if (files.length > 3) throw new Error("Choose no more than three images.");
    for (const [index, file] of files.entries()) {
      const body = new FormData();
      body.set("targetType", targetType);
      body.set("targetId", targetId);
      body.set("ordinal", String(index + 1));
      body.set("file", file);
      const { error } = await platform.functions.invoke("community-media", { body });
      if (error) throw error;
    }
  };
  const openThread = async (id) => {
    const value = await rpc("community_thread", { p_post_id: id });
    const targets = [{ type: "post", value }, ...value.comments.map((comment) => ({ type: "comment", value: comment }))];
    await Promise.all(targets.map(async ({ type, value: target }) => {
      if (!target.assetCount) return;
      const { data, error } = await platform.functions.invoke("community-media", { body: { targetType: type, targetId: target.id } });
      if (error) throw error;
      target.media = data.media;
    }));
    return value;
  };
  useEffect(() => {
    if (session) load();
  }, [session]);
  if (!session && !loading)
    return (
      <section className="wrap section">
        <h1>
          Sign in to the <em>community.</em>
        </h1>
        <Link to="/account">Student sign in</Link>
      </section>
    );
  return (
    <PortalShell>
      <CommunityView
        posts={posts}
        thread={thread}
        message={message}
        onOpen={async (id) => {
          if (!id) return setThread(null);
          try {
            setThread(await openThread(id));
          } catch (e) { setMessage(e.message); }
        }}
        onComment={async (postId, parentId, body, files) => {
          try {
            if (files.length > 3) throw new Error("Choose no more than three images.");
            const commentId = await rpc("add_community_comment", { p_post_id: postId, p_parent_id: parentId, p_body: body });
            await uploadMedia("comment", commentId, files);
            setThread(await openThread(postId));
            setMessage("Reply added.");
            await load();
            return true;
          } catch (e) { setMessage(e.message); return false; }
        }}
        onHelpful={async (commentId) => {
          try {
            await rpc("mark_community_helpful", { p_comment_id: commentId });
            setThread(await rpc("community_thread", { p_post_id: thread.id }));
          } catch (e) { setMessage(e.message); }
        }}
        onReport={async (postId, commentId) => {
          try {
            await rpc("report_community_content", { p_post_id: postId, p_comment_id: commentId, p_reason: "other", p_details: "Reported from discussion view" });
            setMessage("Report sent for moderator review.");
          } catch (e) { setMessage(e.message); }
        }}
        onSubmit={async (f, files) => {
          try {
            if (files.length > 3) throw new Error("Choose no more than three images.");
            const postId = await rpc("create_community_post", {
              p_exam: f.exam,
              p_topic: f.topic,
              p_title: f.title,
              p_body: f.body,
            });
            await uploadMedia("post", postId, files);
            setMessage("Your post is live.");
            await load();
            return true;
          } catch (e) {
            setMessage(e.message);
            return false;
          }
        }}
      />
    </PortalShell>
  );
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
