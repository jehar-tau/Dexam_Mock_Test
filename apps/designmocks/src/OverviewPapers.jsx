import React from "react";
import { Link } from "react-router-dom";
import { Arrow } from "./Art.jsx";
import { paperLabel, paperLevel } from "./paper-years.mjs";

const examNames = { uceed: "UCEED", ceed: "CEED", nift: "NIFT", nid: "NID" };
export const paperName = row => `${examNames[row.exam]} ${paperLevel(row)}${paperLabel(row)}`;
const partName = row => row.part && row.part.partLabel !== "Full paper" ? ` · ${row.part.partLabel}` : "";

export function OverviewPapers({ progress, loading = false, error = "", onRetry, attemptHref = id => "/attempt/" + id, papersHref = "/papers" }) {
  return <section className="overview-year-papers" aria-labelledby="overview-year-papers-title">
    <div className="overview-section-head"><div><span className="overview-kicker">FREE YEAR-WISE PAPERS</span>
      <h2 id="overview-year-papers-title">Your past-year papers</h2></div>
      <Link to={papersHref}>{progress ? `Browse all ${progress.total} papers →` : "Browse papers →"}</Link></div>
    {loading && <p role="status">Checking your papers…</p>}
    {error && <div className="notice" role="status"><p>{error}</p>{onRetry && <button type="button" className="button quiet" onClick={onRetry}>Retry papers</button>}</div>}
    {progress && <>
      <div className="overview-paper-meter">
        <p><b>{progress.attempted}</b> of {progress.total} released papers attempted</p>
        <div aria-hidden="true"><i style={{ width: progress.total ? `${Math.round(progress.attempted * 100 / progress.total)}%` : 0 }} /></div>
      </div>
      <div className="overview-paper-columns">
        <article className="overview-paper-card" data-kind="active">
          <span className="overview-kicker">IN PROGRESS</span>
          {progress.inProgress.length ? <ul>{progress.inProgress.slice(0, 2).map(row => <li key={row.attempt.id}>
            <b>{paperName(row)}{partName(row)}</b><Link to={attemptHref(row.attempt.id)}>Continue saved attempt →</Link></li>)}</ul>
            : <p>Nothing in progress. A started paper keeps its original deadline.</p>}
        </article>
        <article className="overview-paper-card" data-kind="results">
          <span className="overview-kicker">LATEST RESULTS</span>
          {progress.results.length ? <ul>{progress.results.slice(0, 3).map(row => <li key={row.attempt.id}>
            <b>{paperName(row)}{partName(row)}</b>
            <span>{row.attempt.resultsPending ? "Result under review" : `${row.attempt.score} / ${row.attempt.total}`}</span>
            <Link to={attemptHref(row.attempt.id)}>{row.attempt.resultsPending ? "View status →" : "Review answers →"}</Link></li>)}</ul>
            : <p>Your marks and answer-by-answer review appear here after you submit a paper.</p>}
        </article>
        <article className="overview-paper-card" data-kind="next">
          <span className="overview-kicker">UP NEXT</span>
          {progress.next ? <>
            <h3>{paperName(progress.next)}</h3>
            <p>{progress.next.questionCount} questions · {progress.next.minutes} min · free</p>
            <Link className="button" to={`${papersHref}?exam=${progress.next.exam}`}>Open in Papers <Arrow size={17} /></Link>
          </> : <p>You have attempted every released paper. New papers appear here after review.</p>}
        </article>
      </div>
    </>}
  </section>;
}
