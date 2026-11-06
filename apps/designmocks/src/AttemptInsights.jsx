import React from "react";
import { Link } from "react-router-dom";
import { buildAttemptInsights } from "./attempt-insights.mjs";

export function AttemptInsights({ questions, practicePath = "/dashboard/practice" }) {
  const insights = buildAttemptInsights(questions);
  if (!insights.topics.length) return null;
  return <section className="attempt-insights" aria-label="Attempt insights">
    <div className="result-grid">
      <article><span className="eyebrow">QUESTION TYPE BREAKDOWN</span><h2>How each section went.</h2>{insights.sections.map(section=><div className="result-topic" key={section.key}><span>{section.key}</span><b>{section.correct}/{section.total} correct{section.accuracy == null ? "" : ` · ${section.accuracy}% of answered`}</b></div>)}</article>
      <article><span className="eyebrow">RECOMMENDED NEXT SESSION</span><h2>{insights.recommended ? insights.recommended.key.replaceAll("-", " ") : "Review before retrying."}</h2>{insights.recommended ? <><p>{insights.recommended.correct} correct from {insights.recommended.answered} answered. Practise this topic while the mistakes are still fresh.</p><Link className="button quiet" to={`${practicePath}?topic=${encodeURIComponent(insights.recommended.key)}`}>Build this practice session</Link></> : <p>Answer at least one objective question to receive a focused recommendation.</p>}<p><small>Performance guidance only—not an admission prediction.</small></p></article>
    </div>
  </section>;
}

export function AttemptInsightsPreview(){const questions=[{kind:"mcq",topic:"observation",answer:"B",outcome:"incorrect"},{kind:"mcq",topic:"observation",answer:"A",outcome:"correct"},{kind:"nat",topic:"spatial-reasoning",answer:"12",outcome:"correct"},{kind:"drawing",topic:"drawing",answer:null,outcome:null}];return <section className="wrap section sample-result"><span className="eyebrow">RELEASED RESULT PREVIEW</span><h1>Turn results into a <em>next step.</em></h1><AttemptInsights questions={questions} practicePath="/topic-practice-preview"/></section>}
