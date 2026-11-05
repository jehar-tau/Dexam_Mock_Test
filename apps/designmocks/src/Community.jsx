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
export function CommunityView({ posts = [], onSubmit, message = "" }) {
  const submit = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSubmit(Object.fromEntries(f));
    e.currentTarget.reset();
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
          </article>
        ))}
      </div>
    </section>
  );
}
export function Community() {
  const { session, loading } = useAuthState(),
    [posts, setPosts] = useState([]),
    [message, setMessage] = useState("");
  const load = () =>
    rpc("community_feed", { p_exam: null, p_topic: null })
      .then(setPosts)
      .catch((e) => setMessage(e.message));
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
        message={message}
        onSubmit={async (f) => {
          try {
            await rpc("create_community_post", {
              p_exam: f.exam,
              p_topic: f.topic,
              p_title: f.title,
              p_body: f.body,
            });
            setMessage("Your post is live.");
            await load();
          } catch (e) {
            setMessage(e.message);
          }
        }}
      />
    </PortalShell>
  );
}
export function CommunityPreview() {
  const [m, setM] = useState("");
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
      message={m}
      onSubmit={(f) => setM(`Preview post created: ${f.title}`)}
    />
  );
}
