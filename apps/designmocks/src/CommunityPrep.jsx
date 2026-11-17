import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CommunityFrame, communityDate, useCommunityRpc } from "./CommunityFrame.jsx";
import { communityFailure, communityPrepQuery, validateCommunityPrep, validateCommunityPrepSearch } from "./community-library.js";

const kindName = { discussion: "Question", article: "Article", work: "Work for feedback", link: "Link" };
const resultName = { "saved-post": "Saved", link: "Saved link", "my-post": "Your post", note: "Your note", draft: "Draft", learn: "Learn" };
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

function Result({ item }) {
  const title = item.title ?? "Untitled draft";
  const target = item.type === "learn" ? `/dashboard/learn/programme/${item.id}` : item.type === "draft" ? "/dashboard/community/write"
    : item.type === "link" ? null : `/dashboard/community/post/${item.id}`;
  return <li className="community-prep-result">
    <span className="eyebrow">{resultName[item.type]}{item.kind ? ` · ${kindName[item.kind]}` : ""}</span>
    <h3>{target ? <Link to={target}>{title}</Link> : <a href={item.url} target="_blank" rel="noopener noreferrer nofollow ugc">{title}<span className="visually-hidden"> (opens outside DMocks in a new tab)</span></a>}</h3>
    {item.snippet && <p>{item.snippet}</p>}
    {item.note && item.type !== "note" && <p className="community-note"><strong>Your note:</strong> <span className="community-comment-body">{item.note}</span></p>}
  </li>;
}

function PrepSession() {
  const rpc = useCommunityRpc(), searchId = useId();
  const [prep, setPrep] = useState(null), [notice, setNotice] = useState(""), [query, setQuery] = useState(""), [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false), [searchMessage, setSearchMessage] = useState("");
  const scope = useRef(null), request = useRef(null), resultsHeading = useRef(null);
  useEffect(() => {
    const controller = new AbortController(); scope.current = controller;
    (async () => {
      try { const value = validateCommunityPrep(await rpc("community_prep", {}, controller.signal)); if (!controller.signal.aborted) setPrep(value); }
      catch { if (!controller.signal.aborted) setNotice("Couldn’t load your prep space. Refresh to try again."); }
    })();
    return () => { controller.abort(); request.current?.abort(); };
  }, [rpc]);
  async function search(event) {
    event.preventDefault();
    let value; try { value = communityPrepQuery(query); } catch (error) { setSearchMessage(error.message); setResults(null); return; }
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const signal = AbortSignal.any([scope.current.signal, controller.signal]);
    setSearching(true); setSearchMessage("");
    try {
      const found = validateCommunityPrepSearch(await rpc("community_prep_search", { p_query: value }, signal), value);
      if (signal.aborted) return;
      setResults({ query: value, items: found });
      setSearchMessage(found.length ? `${plural(found.length, "result")} for “${value}”.` : `Nothing matches “${value}”. Try fewer words.`);
      resultsHeading.current?.focus();
    } catch (error) { if (!signal.aborted) setSearchMessage(communityFailure(error, "Search didn’t work. Try again.")); }
    finally { if (request.current === controller) setSearching(false); }
  }
  if (notice) return <p role="alert" className="error">{notice}</p>;
  if (!prep) return <p role="status">Loading your prep space…</p>;
  const c = prep.counts;
  return <div className="community-prep">
    <section aria-label="Search your prep" className="community-prep-search">
      <form className="admin-form" onSubmit={search} role="search">
        <div><label htmlFor={searchId}>Search everything you kept or wrote</label>
          <input id={searchId} type="search" value={query} maxLength={100} onChange={event => setQuery(event.target.value)} placeholder="For example: perspective, time management" /></div>
        <button className="button" type="submit" aria-disabled={searching}>{searching ? "Searching…" : "Search"}</button>
      </form>
      <p className="muted">Searches your saved posts and links, your notes, your own posts, drafts and saved Learn programmes. Only you see this.</p>
      {searchMessage && <p role="status">{searchMessage}</p>}
      {results && <><h2 ref={resultsHeading} tabIndex={-1} className="visually-hidden">Search results</h2>
        {results.items.length > 0 && <ul className="community-prep-results">{results.items.map(item => <Result key={`${item.type}:${item.id}`} item={item} />)}</ul>}</>}
    </section>
    <ul className="community-prep-counts" aria-label="What you have kept">
      <li><strong>{c.savedPosts + c.savedLinks}</strong> saved in {plural(c.folders, "folder")}</li>
      <li><strong>{c.notes}</strong> {c.notes === 1 ? "note" : "notes"}</li>
      <li><strong>{c.posts}</strong> {c.posts === 1 ? "post" : "posts"} by you</li>
      <li><strong>{c.learn}</strong> Learn {c.learn === 1 ? "programme" : "programmes"}</li>
    </ul>
    <div className="community-prep-grid">
      <section aria-labelledby="prep-learn"><h2 id="prep-learn">Learn programmes</h2>
        {prep.learn.length === 0 ? <p className="muted">Open any Learn programme and choose Save to my prep.</p> : <ul className="community-prep-list">
          {prep.learn.map(item => <li key={item.programme}><Link to={`/dashboard/learn/programme/${item.programme}`}>{item.title}</Link> <small>saved {communityDate(item.savedAt)}</small></li>)}
        </ul>}
      </section>
      <section aria-labelledby="prep-notes"><h2 id="prep-notes">Your notes</h2>
        {prep.notes.length === 0 ? <p className="muted">Add a private note on any post, or when you save a link.</p> : <ul className="community-prep-list">
          {prep.notes.map(item => <li key={`${item.type}:${item.id}`}>
            {item.type === "post" ? <Link to={`/dashboard/community/post/${item.id}`}>{item.title}</Link>
              : <a href={item.url} target="_blank" rel="noopener noreferrer nofollow ugc">{item.title}<span className="visually-hidden"> (opens outside DMocks in a new tab)</span></a>}
            <p className="community-comment-body">{item.note}</p><small>{communityDate(item.updatedAt)}</small></li>)}
        </ul>}
      </section>
      <section aria-labelledby="prep-posts"><h2 id="prep-posts">Your posts</h2>
        {prep.posts.length === 0 ? <p className="muted">Nothing yet. <Link to="/dashboard/community/write">Write an article</Link> or <Link to="/dashboard/community/work/new">share work for feedback</Link>.</p> : <ul className="community-prep-list">
          {prep.posts.map(item => <li key={item.id}><Link to={`/dashboard/community/post/${item.id}`}>{item.title}</Link>
            <small>{kindName[item.kind]} · {communityDate(item.createdAt)} · {plural(item.likes, "like")} · {plural(item.comments, "reply", "replies")}{item.status === "locked" ? " · Locked" : ""}</small></li>)}
        </ul>}
      </section>
      <section aria-labelledby="prep-drafts"><h2 id="prep-drafts">Drafts</h2>
        {prep.drafts.length === 0 ? <p className="muted">No drafts.</p> : <ul className="community-prep-list">
          {prep.drafts.map(item => <li key={item.id}><Link to="/dashboard/community/write">{item.title || "Untitled draft"}</Link> <small>saved {communityDate(item.updatedAt)}</small></li>)}
        </ul>}
      </section>
    </div>
    <p><Link to="/dashboard/community/saved">Open your folders</Link></p>
  </div>;
}

export function CommunityPrep() {
  return <CommunityFrame title="Your prep," accent="in one place." intro="Everything you saved, noted and wrote while preparing, from Community and Learn.">
    <PrepSession />
  </CommunityFrame>;
}
