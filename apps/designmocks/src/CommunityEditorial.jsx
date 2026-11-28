import React, { useEffect, useId, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PortalShell } from "./PortalShell.jsx";
import { useAuthState } from "./useAuth.js";
import { CommunityNav } from "./CommunityFrame.jsx";
import { CommunityArticle } from "./CommunityArticle.jsx";
import { ArticleCover } from "./ArticleCover.jsx";
import { ARTICLE_EXAMS } from "./community-article.mjs";
import { EDITORIAL_AUTHOR, EDITORIAL_DATE, EDITORIAL_THEMES, editorialExamLabel, editorialPhoto, filterEditorial, relatedEditorial } from "./community-editorial.mjs";
import { editorialArticles, findEditorial } from "./community-editorial.js";
import "./community-editorial.css";

const examName = exam => exam === "nid" ? "NID" : exam.toUpperCase();
const published = new Date(`${EDITORIAL_DATE}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const editorialPath = slug => `/dashboard/community/read/${slug}`;

function Byline({ minutes }) {
  return <p className="editorial-byline">
    <span className="editorial-avatar" aria-hidden="true">{EDITORIAL_AUTHOR.initials}</span>
    <span><b>{EDITORIAL_AUTHOR.name}</b><span className="editorial-meta">{EDITORIAL_AUTHOR.credential} · {published} · {minutes} min read</span></span>
  </p>;
}

export function EditorialCard({ article, featured = false, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`;
  return <li className={`editorial-card${featured ? " is-featured" : ""}`}>
    <Link to={editorialPath(article.slug)} tabIndex={-1} aria-hidden="true"><ArticleCover cover={article.cover} theme={article.theme} seed={article.slug} photo={editorialPhoto(article)} /></Link>
    <div className="editorial-card-text">
      <span className="eyebrow">{EDITORIAL_THEMES[article.theme]} · {editorialExamLabel(article)}</span>
      <Heading><Link to={editorialPath(article.slug)}>{article.title}</Link></Heading>
      <p>{article.dek}</p>
      <p className="editorial-meta">{EDITORIAL_AUTHOR.name}, {EDITORIAL_AUTHOR.credential} · {article.minutes} min read</p>
    </div>
  </li>;
}

// The reading-first top of Community → Articles.
export function EditorialFeed({ articles = editorialArticles }) {
  const examId = useId();
  const [theme, setTheme] = useState(null), [exam, setExam] = useState("");
  const shown = filterEditorial(articles, { theme, exam: exam || null });
  const filtered = Boolean(theme || exam);
  if (!articles.length) return null;
  return <section aria-labelledby="editorial-heading">
    <h2 id="editorial-heading" className="sr-only">Guides from DMocks</h2>
    <div className="editorial-filters">
      <div role="group" aria-label="Article theme" className="editorial-chips">
        <button type="button" aria-pressed={!theme} onClick={() => setTheme(null)}>All</button>
        {Object.entries(EDITORIAL_THEMES).map(([value, label]) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}>{label}</button>)}
      </div>
      <label htmlFor={examId}>Exam
        <select id={examId} value={exam} onChange={event => setExam(event.target.value)}>
          <option value="">All exams</option>{ARTICLE_EXAMS.map(value => <option key={value} value={value}>{examName(value)}</option>)}
        </select>
      </label>
      <Link className="button editorial-write" to="/dashboard/community/write">Write an article</Link>
    </div>
    <p className="sr-only" role="status">{filtered ? `${shown.length} ${shown.length === 1 ? "article" : "articles"} shown.` : ""}</p>
    {shown.length === 0 ? <p>No guides match these filters yet.</p>
      : <ul className="editorial-feed">{shown.map((article, index) => <EditorialCard key={article.slug} article={article} featured={index === 0 && !filtered} />)}</ul>}
  </section>;
}

// A photo carries its Wikimedia Commons credit; otherwise the drawn cover.
function ReaderCover({ article }) {
  const photo = editorialPhoto(article);
  if (!photo) return <ArticleCover cover={article.cover} theme={article.theme} seed={article.slug} />;
  return <figure className="editorial-figure">
    <ArticleCover cover={article.cover} theme={article.theme} seed={article.slug} photo={photo} />
    <figcaption>Photo: <a href={photo.source} target="_blank" rel="noreferrer">{photo.author}</a>, {photo.licenseUrl ? <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a> : photo.license}, via Wikimedia Commons.</figcaption>
  </figure>;
}

export function WriteArticleCta() {
  return <aside className="community-write-cta" aria-label="Write for the community">
    <p><b>Cleared an exam, or learning something that works?</b> Write it up for the next student. Every article is open to the whole community.</p>
    <Link className="button" to="/dashboard/community/write">Write an article</Link>
  </aside>;
}

export function CommunityEditorialReader() {
  const { slug } = useParams(), { session, loading } = useAuthState(), heading = useRef(null);
  const article = findEditorial(slug);
  const ready = Boolean(article && session && !loading);
  useEffect(() => { if (ready) { heading.current?.focus(); window.scrollTo?.(0, 0); } }, [slug, ready]);
  if (loading) return <section className="wrap section"><p role="status">Checking your account…</p></section>;
  if (!session) return <section className="wrap section"><h1>Sign in to the <em>community.</em></h1><Link to="/account">Student sign in</Link></section>;
  return <PortalShell><section className="wrap section community-page">
    <span className="eyebrow">COMMUNITY</span>
    <CommunityNav />
    {!article ? <p role="alert">This article is not available. <Link to="/dashboard/community">Back to articles</Link></p>
      : <article className="editorial-reader" aria-labelledby="editorial-title">
        <p><Link to="/dashboard/community">← All articles</Link></p>
        <span className="eyebrow">{EDITORIAL_THEMES[article.theme]} · {editorialExamLabel(article)}</span>
        <h1 id="editorial-title" ref={heading} tabIndex={-1}>{article.title}</h1>
        <p className="editorial-dek">{article.dek}</p>
        <Byline minutes={article.minutes} />
        <ReaderCover article={article} />
        <CommunityArticle source={article.body} />
        <aside className="editorial-author" aria-label="About the author">
          <span className="editorial-avatar" aria-hidden="true">{EDITORIAL_AUTHOR.initials}</span>
          <p><b>{EDITORIAL_AUTHOR.name}</b> {EDITORIAL_AUTHOR.bio.replace(EDITORIAL_AUTHOR.name + " ", "")}</p>
        </aside>
        <WriteArticleCta />
        <p><Link to="/dashboard/community/discussions">Have a question about this? Ask in Discussions →</Link></p>
        <section className="editorial-next" aria-labelledby="editorial-next-heading">
          <h2 id="editorial-next-heading">Keep reading</h2>
          <ul className="editorial-feed">{relatedEditorial(article, editorialArticles).map(other => <EditorialCard key={other.slug} article={other} />)}</ul>
        </section>
      </article>}
  </section></PortalShell>;
}
