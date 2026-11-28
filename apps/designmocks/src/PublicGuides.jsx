// The editorial guides as public pages (/guides), readable without signing in
// and prerendered for search. Signed-in students read the same files inside
// Community (/dashboard/community).
import React from "react";
import { Link, useParams } from "react-router-dom";
import { CommunityArticle } from "./CommunityArticle.jsx";
import { AboutAuthor, Byline, EditorialCard, EditorialFeed, ReaderCover } from "./CommunityEditorial.jsx";
import { EDITORIAL_THEMES, editorialExamLabel, relatedEditorial } from "./community-editorial.mjs";
import { editorialArticles, findEditorial } from "./community-editorial.js";
import { guidePath } from "./guide-pages.mjs";
import "./community-editorial.css";
import { useAuthState } from "./useAuth.js";
import { SaveGuideButton } from "./SaveGuideButton.jsx";

function PractiseCta() {
  return <aside className="community-write-cta guide-cta" aria-label="Practise for free">
    <p><b>Put it into practice.</b> Take a complete past paper for free with the original timer, then read the worked solution for every question.</p>
    <div className="guide-cta-actions">
      <Link className="button" to="/papers">Browse free papers</Link>
      <Link to="/sample">Or try 5 sample questions, no sign-in</Link>
    </div>
  </aside>;
}

export function GuidesIndex() {
  return <section className="wrap section guides-page">
    <span className="eyebrow">GUIDES</span>
    <h1>Read what <em>works.</em></h1>
    <p className="guides-intro">Exam strategy, time management and calm under pressure for NID, UCEED, NIFT and CEED. Written by Snehalkumar Shinde, NID Bengaluru.</p>
    <EditorialFeed pathFor={guidePath} write={false} />
    <PractiseCta />
  </section>;
}

export function GuideReader() {
  const { slug } = useParams(), { session } = useAuthState();
  const article = findEditorial(slug);
  if (!article) return <section className="wrap section guides-page">
    <h1>This guide is not <em>here.</em></h1>
    <p><Link to="/guides">See all guides</Link></p>
  </section>;
  return <section className="wrap section guides-page">
    <article className="editorial-reader" aria-labelledby="editorial-title">
      <p><Link to="/guides">← All guides</Link></p>
      <span className="eyebrow">{EDITORIAL_THEMES[article.theme]} · {editorialExamLabel(article)}</span>
      <h1 id="editorial-title">{article.title}</h1>
      <p className="editorial-dek">{article.dek}</p>
      <div className="editorial-byline-row"><Byline minutes={article.minutes} />{session && <SaveGuideButton actor={session.user.id} slug={article.slug} title={article.title} />}</div>
      <ReaderCover article={article} />
      <CommunityArticle source={article.body} top={2} />
      <AboutAuthor />
      <PractiseCta />
      <p><Link to="/account">Have a question about this? Create a free account and ask in the Community →</Link></p>
      <section className="editorial-next" aria-labelledby="editorial-next-heading">
        <h2 id="editorial-next-heading">Keep reading</h2>
        <ul className="editorial-feed">{relatedEditorial(article, editorialArticles).map(other =>
          <EditorialCard key={other.slug} article={other} pathFor={guidePath} />)}</ul>
      </section>
    </article>
  </section>;
}
