import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CommunityFrame, communityDate, useCommunityRpc, useCommunityStanding } from "./CommunityFrame.jsx";
import { communityArticleQuery, communityCardsInput, mergeCommunityCards, validateCommunityCards } from "./community-library.js";
import { ARTICLE_EXAMS } from "./community-article.mjs";

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
const responses = (count, kind) => kind === "work" ? `${count} ${count === 1 ? "piece" : "pieces"} of feedback` : `${count} ${count === 1 ? "reply" : "replies"}`;
const kindLabel = { article: "Article", work: "Work for feedback", discussion: "Question", link: "Link" };

// One card for work, unanswered questions and the featured shelf.
export function CommunityCard({ card, heading: Heading = "h2" }) {
  return <article id={`community-card-${card.id}`}>
    <span className="eyebrow">{kindLabel[card.kind]} · {card.exam} · {card.topic}{card.status === "locked" ? " · Locked" : ""}</span>
    <Heading><Link to={`/dashboard/community/post/${card.id}`}>{card.title}</Link></Heading>
    <p>{card.excerpt}</p>
    {card.kind === "link" && card.link && <p className="community-link-host">From {card.link.site && card.link.site !== card.link.host ? `${card.link.site} (${card.link.host})` : card.link.host}</p>}
    <small>{card.kind === "link" ? "Shared by" : "By"} {card.author}{card.teacher ? " · Teacher" : ""}{card.isMine ? " (you)" : ""} · {communityDate(card.createdAt)}
      {card.kind === "work" ? ` · ${plural(card.assetCount, "image")}` : ""} · {plural(card.likes, "like")} · {responses(card.comments, card.kind)}{card.answered ? " · Answered" : ""}
      {card.saved ? " · Saved" : ""}</small>
  </article>;
}

function CardsSession({ view }) {
  const rpc = useCommunityRpc(), location = useLocation(), examId = useId(), standing = useCommunityStanding(rpc);
  const [exam, setExam] = useState(null), [data, setData] = useState(null), [loading, setLoading] = useState(true), [notice, setNotice] = useState(""), [added, setAdded] = useState("");
  const request = useRef(null);
  const load = useCallback(async (selected, previous = null) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setNotice(""); setAdded("");
    try {
      const value = validateCommunityCards(await rpc("community_cards", communityCardsInput(view, selected, previous?.nextCursor ?? null), controller.signal), view, selected);
      if (controller.signal.aborted) return;
      const next = previous ? mergeCommunityCards(previous, value) : value;
      setData(next);
      if (previous) setAdded(`${plural(next.cards.length - previous.cards.length, "more post")} loaded.`);
    } catch {
      if (controller.signal.aborted) return;
      if (!previous) setData(null);
      setNotice(`Couldn’t load ${{ work: "work", unanswered: "questions", links: "links" }[view]}. Try again.`);
    } finally { if (request.current === controller) setLoading(false); }
  }, [rpc, view]);
  useEffect(() => { load(exam); return () => request.current?.abort(); }, [exam, load]);
  const cards = data?.cards ?? [], label = { work: "Work for feedback", unanswered: "Unanswered questions", links: "Links from the internet" }[view];
  return <section aria-label={label} aria-busy={loading}>
    {typeof location.state?.notice === "string" && <p role="status" className="notice">{location.state.notice}</p>}
    <div className="community-toolbar">
      <div><label htmlFor={examId}>Exam</label>
        <select id={examId} value={exam ?? ""} onChange={event => setExam(communityArticleQuery(event.target.value, "latest").exam)}>
          <option value="">All exams</option>{ARTICLE_EXAMS.map(item => <option key={item} value={item}>{item.toUpperCase()}</option>)}
        </select></div>
      {view === "work" ? <Link className="button" to="/dashboard/community/work/new">Share work for feedback</Link>
        : view === "links" ? <Link className="button" to="/dashboard/community/saved">Save a link</Link>
        : <Link className="button" to="/dashboard/community">Ask a question</Link>}
      {view === "links" && (standing?.moderator || standing?.admin) && <Link className="button quiet" to="/dashboard/community/review">Review suggested links</Link>}
    </div>
    <p className="muted">{{ work: "Drawings and portfolio pieces from other students. Say what works, what to improve and how.",
      unanswered: "Questions with no accepted answer yet, newest first. The person who asked marks the answer that helped.",
      links: "Articles and videos from around the web that students found useful. A moderator checks each one. Save a link, then suggest it from your folder." }[view]}</p>
    {(notice || (loading && !data)) && <p role="status">{notice || "Loading…"}</p>}
    {notice && <button type="button" className="text-button" onClick={() => load(exam)}>Try again</button>}
    {data && !loading && cards.length === 0 && <p>{{ work: "No work shared yet", unanswered: "Every question has an accepted answer", links: "No links in the feed yet" }[view]}{exam ? " for this exam" : ""}.</p>}
    <div className="community-feed community-article-feed">{cards.map(card => <CommunityCard key={card.id} card={card} />)}</div>
    {added && <p role="status">{added}</p>}
    {data?.nextCursor && <button type="button" className="button quiet" aria-disabled={loading} onClick={() => { if (!loading) load(exam, data); }}>{loading ? "Loading…" : "Load more"}</button>}
  </section>;
}

export function CommunityWork() {
  return <CommunityFrame title="Show it," accent="get better." intro="Post a drawing or portfolio piece and ask exactly what you want feedback on.">
    <CardsSession view="work" />
  </CommunityFrame>;
}
export function CommunityUnanswered() {
  return <CommunityFrame title="Help someone" accent="today." intro="Questions still waiting for an answer that works.">
    <CardsSession view="unanswered" />
  </CommunityFrame>;
}
export function CommunityLinksFeed() {
  return <CommunityFrame title="Worth" accent="reading." intro="Useful pages from the internet, shared by students and checked by a moderator.">
    <CardsSession view="links" />
  </CommunityFrame>;
}
