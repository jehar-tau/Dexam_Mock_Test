import React, { useState } from "react";
import { DrawingReviewMedia } from "./DrawingReviewMedia.jsx";

export function DrawingReviewStatus({ review }) {
  if (!review || review.status === "not_submitted") return <div className="notice"><b>No drawing submitted for review.</b></div>;
  if (review.status !== "released") return <div className="notice"><b>Human review pending.</b><br />Your objective score is separate. Feedback appears only after a teacher releases it.</div>;
  return <div className="drawing-feedback"><span className="eyebrow">RELEASED HUMAN REVIEW</span><h4>{review.score}/{review.maxScore} marks</h4><p>{review.comments}</p><dl>{Object.entries(review.criteria ?? {}).map(([name, mark]) => <React.Fragment key={name}><dt>{name}</dt><dd>{mark}</dd></React.Fragment>)}</dl></div>;
}

export function DrawingAiAdvisory({ suggestion }) {
  if (!suggestion) return null;
  return <aside className="notice drawing-ai-advisory" aria-label="AI review advisory">
    <span className="eyebrow">AI ADVISORY — NOT A GRADE</span>
    <p><b>Proposed {suggestion.proposedScore} marks</b> · {Math.round(Number(suggestion.confidence) * 100)}% model confidence</p>
    <p>{suggestion.comments}</p>
    <details><summary>Model provenance and evidence</summary><p>{suggestion.provider} · {suggestion.model} · rubric {suggestion.rubricVersion}</p><ul>{(suggestion.evidence ?? []).map((item, index) => <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>)}</ul></details>
    <small>Review the original pages and rubric independently. This suggestion cannot release or change a student score.</small>
  </aside>;
}

export function DrawingReviewQueue({ drawings = [], onReview, onRelease, mediaLoader }) {
  return <div className="admin-list">{drawings.length === 0 ? <p>No drawing submissions await review.</p> : drawings.map(d => <article key={d.reviewId}>
    <b>Anonymous submission · {d.uploadCount} images</b><span className="status-pill">{d.status}</span>{d.prompt && <p>{d.prompt}</p>}
    <DrawingReviewMedia reviewId={d.reviewId} {...(mediaLoader ? { load: mediaLoader } : {})} />
    <DrawingAiAdvisory suggestion={d.aiSuggestion} />
    {d.status === "reviewed" && <button onClick={() => onRelease(d.reviewId)}>Release feedback to student</button>}
    <form className="admin-form" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); onReview(d.reviewId, { criteria: JSON.parse(f.get("criteria")), comments: f.get("comments"), score: Number(f.get("score")), overrideReason: f.get("overrideReason") || null }); }}>
      <label>Criterion marks JSON<textarea name="criteria" required defaultValue={JSON.stringify(d.criteria ?? { composition: 0, clarity: 0 })} /></label>
      <label>Score out of {d.maxScore}<input name="score" type="number" min="0" max={d.maxScore} step="0.5" required defaultValue={d.score ?? ""} /></label>
      <label>Feedback<textarea name="comments" required minLength="5" defaultValue={d.comments ?? ""} /></label>
      {["reviewed", "released"].includes(d.status) && <label>Override reason<input name="overrideReason" required minLength="5" /></label>}
      <button>{["reviewed", "released"].includes(d.status) ? "Save reviewed override" : "Save human review"}</button>
    </form>
  </article>)}</div>;
}

export function DrawingReviewLifecyclePreview() {
  const [drawings, setDrawings] = useState([{ reviewId: "preview", prompt: "Sketch an original wayfinding solution.", uploadCount: 1, status: "pending", maxScore: 20, aiSuggestion: { provider: "validation fixture", model: "advisory-only", rubricVersion: "wayfinding-v1", proposedScore: 14, confidence: 0.72, comments: "The hierarchy is legible; verify directional contrast against the rubric.", evidence: ["Primary route is visually dominant", "Secondary labels need contrast review"] } }]), review = drawings[0];
  const update = (id, value) => setDrawings(current => current.map(item => item.reviewId === id ? { ...item, ...value } : item));
  return <section className="wrap section admin-page"><h1>Human drawing <em>review.</em></h1><DrawingReviewQueue drawings={drawings} mediaLoader={async () => [{ id: "one", ordinal: 1, url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23f2eadf'/%3E%3Cpath d='M80 240 L250 70 L420 240 Z' fill='none' stroke='%23211d1b' stroke-width='8'/%3E%3C/svg%3E" }]} onReview={(id, value) => update(id, { ...value, status: "reviewed" })} onRelease={id => update(id, { status: "released" })} /><h2>Student result</h2><DrawingReviewStatus review={review?.status === "released" ? { status: "released", score: review.score, maxScore: review.maxScore, comments: review.comments, criteria: review.criteria } : { status: "pending" }} /></section>;
}
