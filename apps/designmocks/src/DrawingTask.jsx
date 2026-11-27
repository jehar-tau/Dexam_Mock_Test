import React from "react";
import { DRAWING_FLAG_LABELS, drawingEstimateView, formatMarks, graceClock } from "./drawing-estimate.mjs";
import "./drawing-task.css";

// What the student is marked on. Shown on the task while they draw and again
// beside the estimate, so the two always use the same words.
export function DrawingCriteria({ criteria = [], criteriaSource = "printed", instructions = [] }) {
  if (!criteria.length && !instructions.length) return null;
  return <div className="drawing-criteria">
    {criteria.length > 0 && <>
      <h4>How it’s marked</h4>
      <ul>
        {criteria.map(item => <li key={item.id}><span>{item.label}</span><b>{formatMarks(item.max)}</b></li>)}
      </ul>
      {criteriaSource === "inferred" && <p className="drawing-criteria-note">The paper didn’t print its criteria. DMocks uses these, based on what the exam asks for.</p>}
      {criteriaSource === "printed-equal-split" && <p className="drawing-criteria-note">The paper names these criteria without their marks, so the marks are split equally.</p>}
    </>}
    {instructions.length > 0 && <>
      <h4>Instructions</h4>
      <ul className="drawing-instructions">{instructions.map(text => <li key={text}>{text}</li>)}</ul>
    </>}
  </div>;
}

// After the paper's clock ends, objective answers lock and drawing photos can
// still be added for a short grace period.
export function DrawingGraceBanner({ remainingSeconds, taskCount = 1 }) {
  if (!(remainingSeconds > 0)) return null;
  const urgent = remainingSeconds <= 120;
  return <section className="drawing-grace" data-urgency={urgent ? "critical" : undefined} aria-labelledby="drawing-grace-title">
    <div>
      <h2 id="drawing-grace-title">Time’s up. Upload your drawings.</h2>
      <p>Your answers to the other questions are locked. Photograph your {taskCount === 1 ? "drawing" : `${taskCount} drawings`} and add {taskCount === 1 ? "it" : "them"} below. The paper submits on its own when this ends.</p>
    </div>
    <p className="drawing-grace-clock" role="timer" aria-live="off" aria-label="Upload time remaining"><b>{graceClock(remainingSeconds)}</b><small>left</small></p>
  </section>;
}

export function DrawingEstimate({ estimate, criteria = [], onReevaluate, busy = false }) {
  const view = drawingEstimateView(estimate, criteria);
  if (!view) return null;
  const head = <span className="drawing-estimate-eyebrow">AI estimate · not an official score</span>;
  if (view.status === "awaiting_teacher") return <section className="drawing-estimate" data-state="awaiting-teacher">
    {view.override ? <p role="status"><b>Checked by DMocks: {formatMarks(view.override.score)}/{formatMarks(view.max)}.</b> {view.override.note}</p> :
      <p role="status"><b>Score: awaiting teacher review.</b> Your drawing was uploaded.</p>}
    {view.canReevaluate && onReevaluate && <button type="button" className="button quiet" disabled={busy} onClick={onReevaluate}>{busy ? "Evaluating…" : "Try re-evaluating"}</button>}
  </section>;
  if (view.status === "evaluating") return <section className="drawing-estimate" data-state="evaluating" aria-busy="true">
    {head}
    <p className="drawing-estimate-wait" role="status"><i aria-hidden="true" />Evaluating your drawing… This usually takes a minute or two.</p>
  </section>;
  if (view.status === "not_attempted") return <section className="drawing-estimate" data-state="not-attempted">
    {head}
    <div className="drawing-estimate-total"><b>0</b><span>/{formatMarks(view.max)}</span></div>
    <p><b>Not attempted.</b> No photo was uploaded for this task, so it scores 0.</p>
  </section>;
  if (view.status === "unavailable") return <section className="drawing-estimate" data-state="unavailable">
    {head}
    <p role="status"><b>Score unavailable.</b> We couldn’t read a reliable estimate for this drawing. Your photos are saved.</p>
    {view.canReevaluate && onReevaluate && <button type="button" className="button quiet" disabled={busy} onClick={onReevaluate}>{busy ? "Evaluating…" : "Try re-evaluating"}</button>}
  </section>;
  return <section className="drawing-estimate" data-state="ready" aria-label="AI estimate for this drawing">
    {head}
    <div className="drawing-estimate-top">
      <div className="drawing-estimate-total"><b>{formatMarks(view.override ? view.override.score : view.total)}</b><span>/{formatMarks(view.max)}</span></div>
      {view.summary && <p className="drawing-estimate-summary">{view.summary}</p>}
    </div>
    {view.override && <p className="drawing-estimate-override"><b>Checked by DMocks:</b> the AI estimate was {formatMarks(view.total)}/{formatMarks(view.max)}.{view.override.note ? ` ${view.override.note}` : ""}</p>}
    {view.flags.length > 0 && <ul className="drawing-flags" aria-label="Things the estimate noticed">
      {view.flags.map(flag => <li key={flag}>{DRAWING_FLAG_LABELS[flag]}</li>)}
    </ul>}
    {view.zeroed && <p className="drawing-estimate-note">Because of this, the task scores 0. If the photo is wrong, retake it on your next attempt.</p>}
    {!view.zeroed && <ul className="drawing-scores">
      {view.criteria.map(row => <li key={row.id}>
        <div className="drawing-score-head"><span>{row.label}</span><b>{formatMarks(row.score)}<small>/{formatMarks(row.max)}</small></b></div>
        <span className="drawing-score-bar" aria-hidden="true"><i style={{ width: `${row.max ? (row.score / row.max) * 100 : 0}%` }} /></span>
        {row.reason && <p>{row.reason}</p>}
      </li>)}
    </ul>}
    <p className="drawing-estimate-foot">An AI model marked a photo of your drawing against the criteria above. Use it as practice feedback; real examiners may mark differently.</p>
    {view.canReevaluate && onReevaluate && <button type="button" className="text-button" disabled={busy} onClick={onReevaluate}>{busy ? "Evaluating…" : "Re-evaluate once"}</button>}
  </section>;
}

// One drawing task in the answer review: the task, the student's photos, the
// estimate, and the model notes.
export function DrawingTaskReview({ label, prompt, figureUrl, figureAlt = "Figure for this drawing task", marks, criteria = [], criteriaSource, instructions = [], photos = [], estimate, notes, onReevaluate, busy }) {
  return <article className="drawing-task-review">
    <header>
      <span className="eyebrow">{label} · DRAWING · {formatMarks(marks)} MARKS</span>
      <p className="drawing-task-prompt">{prompt}</p>
    </header>
    <div className="drawing-task-grid">
      <div className="drawing-task-main">
        {figureUrl && <figure className="drawing-task-figure"><img src={figureUrl} alt={figureAlt} /></figure>}
        <div className="drawing-photos">
          <h4>Your {photos.length === 1 ? "photo" : "photos"}</h4>
          {photos.length ? <ul>{photos.map((photo, index) => <li key={photo.id ?? index}><img src={photo.url} alt={`Your drawing, page ${index + 1}`} /></li>)}</ul>
            : <p className="drawing-photos-empty">No photo uploaded.</p>}
        </div>
        {notes && <details className="drawing-model-notes"><summary>What a strong answer shows</summary><p>{notes}</p></details>}
      </div>
      <aside className="drawing-task-side">
        <DrawingEstimate estimate={estimate} criteria={criteria} onReevaluate={onReevaluate} busy={busy} />
        <DrawingCriteria criteria={estimate?.status === "ready" ? [] : criteria} criteriaSource={criteriaSource} instructions={instructions} />
      </aside>
    </div>
  </article>;
}
