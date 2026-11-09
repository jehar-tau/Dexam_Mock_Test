import React, { useRef, useState } from "react";
import { DrawingReviewMedia } from "./DrawingReviewMedia.jsx";
import { drawingAdvisoryMarks, MAX_DRAWING_CRITERIA, totalDrawingMarks, validateDrawingReviewInput } from "./drawing-review.js";

export function DrawingReviewStatus({ review }) {
  if (!review || review.status === "not_submitted") return <div className="notice"><b>No drawing submitted for review.</b></div>;
  if (review.status !== "released") return <div className="notice"><b>Human review pending.</b><br />Your objective score is separate. Feedback appears only after a teacher releases it.</div>;
  return <div className="drawing-feedback"><span className="eyebrow">RELEASED HUMAN REVIEW</span><h4>{review.score}/{review.maxScore} marks</h4><p>{review.comments}</p><dl>{Object.entries(review.criteria ?? {}).map(([name, mark]) => <React.Fragment key={name}><dt>{name}</dt><dd>{mark}</dd></React.Fragment>)}</dl></div>;
}

export function DrawingAiAdvisory({ suggestion }) {
  if (!suggestion) return null;
  const marks = drawingAdvisoryMarks(suggestion.criteria);
  return <aside className="notice drawing-ai-advisory" aria-label="AI review advisory">
    <span className="eyebrow">AI ADVISORY — NOT A GRADE</span>
    <p><b>Proposed {suggestion.proposedScore} marks</b> · {Math.round(Number(suggestion.confidence) * 100)}% model confidence</p>
    {marks.length > 0 && <>
      <p><b>Suggested criterion marks</b></p>
      <dl aria-label="Suggested criterion marks">
        {marks.map(([name, mark]) => <React.Fragment key={name}><dt>{name}</dt><dd>{mark}</dd></React.Fragment>)}
      </dl>
    </>}
    <p>{suggestion.comments}</p>
    <details><summary>Model provenance and evidence</summary><p>{suggestion.provider} · {suggestion.model} · rubric {suggestion.rubricVersion}</p><ul>{(suggestion.evidence ?? []).map((item, index) => <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>)}</ul></details>
    <small>Review the original pages and rubric independently. This suggestion cannot release or change a student score.</small>
  </aside>;
}

function DrawingReviewForm({ drawing, onSave, disabled }) {
  const [rows, setRows] = useState(() => Object.entries(drawing.criteria ?? { "": "" })
    .map(([name, mark], id) => ({ id, name, mark: String(mark) })));
  const nextId = useRef(rows.length);
  const requiresOverride = ["reviewed", "released"].includes(drawing.status);
  const setValue = (id, field, value) => setRows((current) => current.map((row) =>
    row.id === id ? { ...row, [field]: value } : row));
  const total = totalDrawingMarks(rows);

  return <form className="admin-form drawing-review-form" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave(() => validateDrawingReviewInput({
      rows, comments: form.get("comments"), overrideReason: form.get("overrideReason"),
      maxScore: drawing.maxScore, requiresOverride,
    }));
  }}>
    <fieldset disabled={disabled}>
      <legend>Criterion marks</legend>
      {rows.map((row, index) => <div className="drawing-criterion" key={row.id}>
        <label>Criterion {index + 1}<input required maxLength={80} value={row.name}
          onChange={(event) => setValue(row.id, "name", event.target.value)} /></label>
        <label>Mark {index + 1}<input type="number" required min="0" max={drawing.maxScore}
          step="0.01" value={row.mark} onChange={(event) => setValue(row.id, "mark", event.target.value)} /></label>
        {rows.length > 1 && <button className="text-button" type="button" aria-label={`Remove criterion ${index + 1}`}
          onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}>Remove</button>}
      </div>)}
      <button type="button" className="text-button" disabled={rows.length >= MAX_DRAWING_CRITERIA} onClick={() => {
        const id = nextId.current++;
        setRows((current) => [...current, { id, name: "", mark: "" }]);
      }}>Add criterion</button>
      <p>Total <output aria-label="Total marks">{Number.isFinite(total) ? total : "—"} / {drawing.maxScore}</output></p>
      <label>Feedback<textarea name="comments" required minLength={5} maxLength={4000} defaultValue={drawing.comments ?? ""} /></label>
      {requiresOverride && <label>Override reason<input name="overrideReason" required minLength={5} maxLength={1000} /></label>}
      <button type="submit">{requiresOverride ? "Save reviewed override" : "Save human review"}</button>
    </fieldset>
  </form>;
}

function DrawingReviewCard({ drawing, onClaim, onReturn, onReview, onRelease, mediaLoader, onMediaUnavailable }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mutation=useRef(false);
  const perform = async (action) => {
    if(mutation.current)return;
    mutation.current=true;
    setBusy(true);
    setError("");
    try { await action(); }
    catch (failure) { setError(failure?.message || "Couldn’t update this review."); }
    finally { mutation.current=false;setBusy(false); }
  };
  const { reviewId, version, status } = drawing;
  return <article aria-busy={busy}>
    <b>Anonymous submission · {drawing.uploadCount} images</b><span className="status-pill">{status}</span>
    {drawing.cohortTitle && <p>All India · {drawing.cohortTitle}</p>}
    {drawing.prompt && <p>{drawing.prompt}</p>}
    {status === "pending" && !drawing.canClaim && !drawing.cohortFrozen && <p className="notice">The student upload window is still open. You can claim this review after it closes.</p>}
    {drawing.canClaim && <button type="button" disabled={busy} onClick={() => perform(() => onClaim(reviewId))}>Claim anonymous review</button>}
    {status === "assigned" && !drawing.assignedToMe && <p className="notice">Assigned to another teacher.</p>}
    {drawing.cohortFrozen && <p className="notice">This grade is frozen with the published cohort results.</p>}
    {drawing.canReview && <>
      <DrawingReviewMedia reviewId={reviewId} onUnavailable={onMediaUnavailable} {...(mediaLoader ? { load: mediaLoader } : {})} />
      <DrawingAiAdvisory suggestion={drawing.aiSuggestion} />
      {status === "assigned" && <button type="button" disabled={busy} onClick={() => perform(() => onReturn(reviewId, version))}>Return to review queue</button>}
      {status === "reviewed" && !drawing.cohortFrozen && <button type="button" disabled={busy} onClick={() => perform(() => onRelease(reviewId, version))}>
        {drawing.cohortTitle ? "Finalize grade for cohort release" : "Release feedback to student"}
      </button>}
      {!drawing.cohortFrozen && <DrawingReviewForm key={version} drawing={drawing} disabled={busy}
        onSave={(readForm) => perform(() => onReview(reviewId, version, readForm()))} />}
    </>}
    {error && <p role="alert">{error}</p>}
  </article>;
}

export function DrawingReviewQueue({ drawings = [], onRefresh, onClaim, onReturn, onReview, onRelease, mediaLoader, onMediaUnavailable }) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  return <section className="admin-list" aria-label="Drawing review queue">
    {onRefresh && <div>
      <button type="button" disabled={refreshing} onClick={async () => {
        setRefreshing(true);
        setError("");
        try { await onRefresh(); }
        catch (failure) { setError(failure?.message || "Couldn’t refresh the review queue."); }
        finally { setRefreshing(false); }
      }}>Refresh drawing reviews</button>
      {error && <p role="alert">{error}</p>}
    </div>}
    {drawings.length === 0 && <p>No drawing submissions await review.</p>}
    {drawings.map((drawing) => <DrawingReviewCard key={drawing.reviewId} drawing={drawing}
      onClaim={onClaim} onReturn={onReturn} onReview={onReview} onRelease={onRelease} mediaLoader={mediaLoader} onMediaUnavailable={onMediaUnavailable} />)}
  </section>;
}

export function DrawingReviewLifecyclePreview() {
  const [review, setReview] = useState({
    reviewId: "preview", version: 0, prompt: "Sketch an original wayfinding solution.", uploadCount: 1,
    status: "pending", canClaim: true, canReview: false, assignedToMe: false, maxScore: 20,
    aiSuggestion: {
      provider: "validation fixture", model: "advisory-only", rubricVersion: "wayfinding-v1",
      proposedScore: 14, confidence: 0.72,
      criteria: { Composition: 8.25, Clarity: 5.75 },
      comments: "The hierarchy is legible; verify directional contrast against the rubric.",
      evidence: ["Primary route is visually dominant", "Secondary labels need contrast review"],
    },
  });
  const update = (value) => setReview((current) => ({ ...current, ...value, version: current.version + 1 }));
  return <section className="wrap section admin-page">
    <h1>Human drawing <em>review.</em></h1>
    <DrawingReviewQueue drawings={[
      review,
      { reviewId: "window-open", prompt: "Draw a portable reading light.", uploadCount: 2, status: "pending" },
      { reviewId: "another-teacher", prompt: "Design a reusable container.", uploadCount: 1, status: "assigned" },
    ]}
      mediaLoader={async () => [{ id: "one", ordinal: 1, url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23f2eadf'/%3E%3Cpath d='M80 240 L250 70 L420 240 Z' fill='none' stroke='%23211d1b' stroke-width='8'/%3E%3C/svg%3E" }]}
      onClaim={() => update({ status: "assigned", canClaim: false, canReview: true, assignedToMe: true })}
      onReturn={() => update({ status: "pending", canClaim: true, canReview: false, assignedToMe: false })}
      onReview={(_id, _version, value) => update({ ...value, status: "reviewed" })}
      onRelease={() => update({ status: "released" })} />
    <h2>Student result</h2>
    <DrawingReviewStatus review={review.status === "released" ? review : { status: "pending" }} />
  </section>;
}
