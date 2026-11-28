import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CommunityFrame, communityDate, useCommunityRpc } from "./CommunityFrame.jsx";
import { communityArticleInput, communityArticleQuery, mergeCommunityArticles, validateCommunityArticles } from "./community-library.js";
import { ARTICLE_EXAMS } from "./community-article.mjs";
import { EditorialFeed, WriteArticleCta } from "./CommunityEditorial.jsx";

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

function ArticlesSession() {
  const rpc = useCommunityRpc(), location = useLocation(), examId = useId();
  const [query, setQuery] = useState(() => communityArticleQuery(null, "latest"));
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [notice, setNotice] = useState(""), [added, setAdded] = useState("");
  const request = useRef(null);
  const load = useCallback(async (selected, previous = null) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setNotice(""); setAdded("");
    try {
      const value = validateCommunityArticles(await rpc("community_articles", communityArticleInput(selected, previous?.nextCursor ?? null), controller.signal), selected);
      if (controller.signal.aborted) return;
      const next = previous ? mergeCommunityArticles(previous, value) : value;
      setData(next);
      if (previous) setAdded(`${plural(next.articles.length - previous.articles.length, "more article")} loaded.`);
    } catch {
      if (controller.signal.aborted) return;
      if (!previous) setData(null);
      setNotice("Couldn’t load articles. Try again.");
    } finally { if (request.current === controller) setLoading(false); }
  }, [rpc]);
  useEffect(() => { load(query); return () => request.current?.abort(); }, [query, load]);
  const articles = data?.articles ?? [];
  return <section aria-label="Community articles" aria-busy={loading}>
    {typeof location.state?.notice === "string" && <p role="status" className="notice">{location.state.notice}</p>}
    <h2 id="student-articles-heading" className="student-articles-heading">From students</h2>
    <div className="community-toolbar">
      <div role="group" aria-label="Article order" className="community-segments">
        {[["latest", "Latest"], ["top", "Top"]].map(([value, label]) => <button key={value} type="button" aria-pressed={query.sort === value}
          onClick={() => setQuery(current => communityArticleQuery(current.exam, value))}>{label}</button>)}
      </div>
      <div><label htmlFor={examId}>Exam</label>
        <select id={examId} value={query.exam ?? ""} onChange={event => setQuery(current => communityArticleQuery(event.target.value, current.sort))}>
          <option value="">All exams</option>{ARTICLE_EXAMS.map(exam => <option key={exam} value={exam}>{exam.toUpperCase()}</option>)}
        </select></div>
      <Link className="button" to="/dashboard/community/write">Write an article</Link>
    </div>
    {query.sort === "top" && <p className="muted">Most liked in the last 30 days.</p>}
    {(notice || (loading && !data)) && <p role="status">{notice || "Loading articles…"}</p>}
    {notice && <button type="button" className="text-button" onClick={() => load(query)}>Refresh articles</button>}
    {data && !loading && articles.length === 0 && <p>No articles yet{query.exam ? " for this exam" : ""}. <Link to="/dashboard/community/write">Write the first one.</Link></p>}
    <div className="community-feed community-article-feed">
      {articles.map(article => <article key={article.id} id={`community-article-${article.id}`}>
        <span className="eyebrow">{article.exam} · {article.topic}{article.status === "locked" ? " · Locked" : ""}</span>
        <h2><Link to={`/dashboard/community/post/${article.id}`}>{article.title}</Link></h2>
        <p>{article.excerpt}</p>
        <small>By {article.author}{article.isMine ? " (you)" : ""} · {communityDate(article.createdAt)} · {Math.max(1, Math.round(article.words / 200))} min read · {plural(article.likes, "like")} · {plural(article.comments, "comment")}{article.saved ? " · Saved" : ""}</small>
      </article>)}
    </div>
    {added && <p role="status">{added}</p>}
    {data?.nextCursor && <button type="button" className="button quiet" aria-disabled={loading} onClick={() => { if (!loading) load(query, data); }}>{loading ? "Loading articles…" : "Load more articles"}</button>}
  </section>;
}

export function CommunityArticles() {
  return <CommunityFrame title="Read what" accent="works." intro="Exam strategy, time management and calm under pressure, for NID, UCEED, NIFT and CEED. Read, save, and add what worked for you.">
    <EditorialFeed />
    <WriteArticleCta />
    <ArticlesSession />
  </CommunityFrame>;
}
