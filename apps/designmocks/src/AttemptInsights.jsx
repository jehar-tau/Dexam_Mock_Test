import React, { useState } from "react";
import { Link } from "react-router-dom";
import { buildAttemptInsights, outcomeLabels, roundMarks, releasedOutcome, responseSummary, reviewMarks } from "./attempt-insights.mjs";
import { answerAlternativesLabel, releasedKeyLabel } from "./answer-key.js";
import { DrawingReviewStatus } from "./DrawingReviewQueue.jsx";
import { DrawingTaskReview } from "./DrawingTask.jsx";
import { SolutionPanel } from "./WorkedSolution.jsx";
import { readWorkedExplanation, workedFigureIndex } from "./worked-solution.js";
import "./paper-workspace.css";

const topicName = value => value?.replaceAll("-", " ") || "Unclassified";
const formatMarks = value => { const marks = roundMarks(value); return marks < 0 ? "−" + Math.abs(marks) : String(marks); };
export function AttemptInsights({ questions, practicePath = "/dashboard/practice", onReviewOutcome }) {
  const { topics, sections, recommended } = buildAttemptInsights(questions);
  const summary = responseSummary(questions);
  if (!summary.total) return null;
  const outcomes = Object.entries(summary.counts).filter(([, count]) => count > 0);
  return <section className="analysis-insights" aria-label="Attempt insights">
    <div className="analysis-stats">
      <div><span>Answered</span><strong>{summary.answered}<small> / {summary.total}</small></strong></div>
      <div><span>Skipped</span><strong>{summary.total - summary.answered}</strong></div>
      <div><span>Accuracy on answered</span><strong>{summary.accuracy == null ? "—" : summary.accuracy + "%"}</strong></div>
    </div>
    <section className="analysis-panel analysis-outcomes"><h2>Response breakdown</h2>
      <div className="analysis-stack" aria-hidden="true">{outcomes.map(([key,count]) => <i key={key} data-outcome={key} style={{flexGrow: count}}/>)}</div>
      <ul>{outcomes.map(([key,count]) => <li key={key}>{onReviewOutcome ? <button type="button" aria-label={"Review " + outcomeLabels[key].toLowerCase() + " questions (" + count + ")"} onClick={() => onReviewOutcome(key)}><i data-outcome={key}/>{outcomeLabels[key]} <b>{count}</b></button> : <><i data-outcome={key}/>{outcomeLabels[key]} <b>{count}</b></>}</li>)}</ul>
    </section>
    <div className="analysis-columns">
      <section className="analysis-panel"><h2>By section</h2><table><thead><tr><th>Section</th><th>Answered</th><th>Correct</th><th>Accuracy</th><th>Marks</th></tr></thead>
        <tbody>{sections.map(row => <tr key={row.key}><th scope="row">{row.key}</th><td>{row.answered}/{row.total}</td><td>{row.correct}</td><td>{row.accuracy == null ? "—" : row.accuracy + "%"}</td>
          <td className="analysis-marks">{row.marks !== null ? <><b>{formatMarks(row.marks)}</b><small> / {row.available}</small></>
            : <><b>{formatMarks(row.marksExcludingPartial)}</b><small> + partial</small></>}</td></tr>)}</tbody></table>
        {sections.some(row => row.partialPending) && <p className="analysis-note">“+ partial” adds partial-credit marks, which are included in your total score above.</p>}
      </section>
      <section className="analysis-panel"><h2>Topic accuracy</h2>
        <ul className="analysis-bars">{topics.map(row => <li key={row.key}><span>{topicName(row.key)}</span><b>{row.accuracy == null ? "—" : row.accuracy + "%"}</b>
          <div aria-hidden="true"><i style={{width: (row.accuracy || 0) + "%"}}/></div><small>{row.correct} correct / {row.answered} answered</small></li>)}</ul>
      </section>
    </div>
    {recommended && practicePath && <section className="analysis-next"><div><span className="eyebrow">NEXT PRACTICE</span><h2>{topicName(recommended.key)}</h2><p>{recommended.correct} correct from {recommended.answered} answered in this topic.</p></div>
      <Link className="button quiet" to={practicePath + "?topic=" + encodeURIComponent(recommended.key)}>Build this practice session</Link></section>}
  </section>;
}

function HistoricalDrawingReview({ item, index, attemptId, figureUrl, invoke, onReevaluate }) {
  const [photos, setPhotos] = useState(item.drawingPhotos ?? []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  React.useEffect(() => {
    if (!invoke || item.drawingEstimate?.status === "not_attempted") return;
    const controller = new AbortController();
    let refresh;
    const open = async () => {
      try {
        const result = await invoke({action:"open",attemptId,questionId:item.id}, controller.signal);
        if (controller.signal.aborted) return;
        setPhotos(result.images);
        setError("");
        const lifetime = Date.parse(result.expiresAt) - Date.parse(result.serverNow);
        if (result.images.length && lifetime > 0) refresh = setTimeout(open, Math.max(1000, lifetime - 15000));
      } catch { if (!controller.signal.aborted) { setPhotos([]); setError("Couldn’t open your saved drawing photos."); } }
    };
    open();
    return () => { controller.abort(); clearTimeout(refresh); };
  }, [invoke, attemptId, item.id, retry, item.drawingEstimate?.status === "not_attempted"]);
  return <>
    <DrawingTaskReview label={item.label ?? `TASK ${index + 1}`} prompt={item.prompt}
      figureUrl={figureUrl} marks={item.marking?.max ?? 0} criteria={item.drawing?.criteria}
      criteriaSource={item.drawing?.criteriaSource} instructions={item.drawing?.instructions} photos={photos}
      estimate={item.drawingEstimate} notes={item.explanation} busy={busy} subParts={item.drawing?.subParts} selectedAlternative={item.drawingChoice?.alternative} onReevaluate={onReevaluate && (async () => {
        setBusy(true);
        try { await onReevaluate(item.id); setError(""); }
        catch { setError("Couldn’t request re-evaluation. Reopen your result to check its status."); }
        finally { setBusy(false); }
      })} />
    {error && <p role="alert">{error} <button className="text-button" onClick={() => setRetry(n => n+1)}>Reload photos</button></p>}
  </>;
}

export function AnswerReview({attempt, figures, media, mediaStatus, onRetry, invokeDrawing, onReevaluate, initialOutcome = ""}) {
  const { questions } = attempt;
  const [kind, setKind] = useState("");
  const [outcome, setOutcome] = useState(initialOutcome);
  const [selectedId, setSelectedId] = useState("");
  const [solutionOpenFor, setSolutionOpenFor] = useState("");
  const objective = questions.map((item, index) => ({item, index})).filter(({item}) => releasedOutcome(item));
  const drawingItems = questions.filter(item => item.kind === "drawing");
  const drawings = drawingItems.filter(item => !item.drawingChoice?.group || item.drawingChoice.selected);
  const skippedGroups = [...new Set(drawingItems
    .filter(item => item.drawingChoice?.group && !item.drawingChoice.chosenQuestionId)
    .map(item => item.drawingChoice.group))];
  const filtered = objective.filter(({item}) => (!kind || item.kind === kind) && (!outcome || releasedOutcome(item) === outcome));
  const chosen = filtered.find(({item}) => item.id === selectedId) ?? filtered[0];
  const item = chosen?.item;
  const position = chosen ? filtered.indexOf(chosen) : -1;
  const key = releasedKeyLabel(item?.correctKey);
  const answer = Array.isArray(item?.answer) ? item.answer.join(", ") : item?.answer;
  const chosenOptions = [].concat(item?.answer ?? []);
  const { explanation, solution } = readWorkedExplanation(attempt, item);
  const figureIndex = solution ? workedFigureIndex(item.media, solution.figure) : -1;
  const solutionOpen = !!item && solutionOpenFor === item.id;
  // Alternatives are combinations. Only label individual choices as correct
  // when the released key supplies a single combination or an MCQ choice.
  const correctOptions = item?.correctKey?.correct ?? [];
  return <div className="analysis-review answer-review">
    {!!objective.length && <><div className="analysis-review-controls">
      <label>Question type<select value={kind} onChange={e => { setKind(e.target.value); setSolutionOpenFor(""); }}><option value="">All types</option>
        {[...new Set(objective.map(({item}) => item.kind))].map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label>
      <label>Result<select value={outcome} onChange={e => { setOutcome(e.target.value); setSolutionOpenFor(""); }}><option value="">All results</option>
        {Object.entries(outcomeLabels).filter(([key]) => objective.some(({item}) => releasedOutcome(item) === key)).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <span>{filtered.length} of {objective.length} questions</span>
    </div>
    {!item && <p role="status">No questions match these filters.</p>}
    {item && <><nav className="analysis-question-map" aria-label="Review questions">{filtered.map(({item: question,index}) =>
      <button type="button" key={question.id} aria-label={"Review question " + (index+1) + ", " + outcomeLabels[releasedOutcome(question)]} aria-current={question.id === item.id ? "step" : undefined} data-outcome={releasedOutcome(question)} onClick={() => { setSelectedId(question.id); setSolutionOpenFor(""); }}>{index+1}</button>)}</nav>
      <article key={item.id} className="analysis-item" data-result={releasedOutcome(item)}>
        <header><span className="eyebrow">QUESTION {chosen.index+1} · {item.kind.toUpperCase()} · {topicName(item.topic)}</span>
          <b className="analysis-outcome-badge" data-outcome={releasedOutcome(item)}>{outcomeLabels[releasedOutcome(item)]}{reviewMarks(item) && <span>· {reviewMarks(item)} marks</span>}</b></header>
        <h3>{item.prompt}</h3>{figures?.(item)}
        {item.options?.length > 0 && <ul className="analysis-options">{item.options.map(option => <li key={option.id} data-correct={correctOptions.includes(option.id) || undefined}
            data-chosen={chosenOptions.includes(option.id) || undefined}>
            <div><b>{option.id}</b>{option.label}</div>
            {chosenOptions.includes(option.id) && <small>Your choice</small>}
            {correctOptions.includes(option.id) && <small>Correct choice</small>}
          </li>)}</ul>}
        <div className="analysis-response"><p><strong>Your answer:</strong> {answer || "Not answered"}</p>
          {key && <p><strong>{answerAlternativesLabel(item.correctKey) ? "Accepted answers" : "Correct answer"}</strong> {key}</p>}</div>
        {(solution || explanation) && <><button type="button" className="button quiet" aria-expanded={solutionOpen}
          aria-controls="review-worked-solution" onClick={() => setSolutionOpenFor(solutionOpen ? "" : item.id)}>
          {solutionOpen ? "Hide solution" : "View solution"}</button>
          <div id="review-worked-solution" hidden={!solutionOpen}>{solutionOpen &&
            <SolutionPanel solution={solution} explanation={explanation} figureUrl={solution ? media[item.id]?.[figureIndex]?.url : undefined}
              mediaStatus={mediaStatus} onRetry={onRetry}/>}</div></>}
        <nav className="analysis-step" aria-label="Step through answers">
          <button type="button" className="text-button" disabled={position <= 0}
            onClick={() => { setSelectedId(filtered[position - 1].item.id); setSolutionOpenFor(""); }}>← Previous question</button>
          <span>{position + 1} of {filtered.length}</span>
          <button type="button" className="text-button" disabled={position >= filtered.length - 1}
            onClick={() => { setSelectedId(filtered[position + 1].item.id); setSolutionOpenFor(""); }}>Next question →</button>
        </nav>
      </article></>}
    </>}
    {skippedGroups.map(group => <p key={group}><strong>{group}</strong> · No task selected. 0 marks.</p>)}
    {drawings.map((item, index) => item.drawingEstimate !== undefined ? <HistoricalDrawingReview key={item.id} item={item} index={index} attemptId={attempt.id}
      figureUrl={media?.[item.id]?.[0]?.url} invoke={invokeDrawing} onReevaluate={onReevaluate} /> : <article key={item.id}><h3>{item.prompt}</h3>{item.answer && <p>Your notes: {item.answer}</p>}{item.explanation && <p>{item.explanation}</p>}<DrawingReviewStatus review={item.drawingReview}/></article>)}
  </div>;
}

export function AttemptInsightsPreview() {
  const questions=[{kind:"mcq",topic:"observation",answer:"B",outcome:"incorrect"},{kind:"mcq",topic:"observation",answer:"A",outcome:"correct"},{kind:"nat",topic:"spatial-reasoning",answer:"12",outcome:"correct"}];
  return <section className="wrap section sample-result"><span className="eyebrow">RELEASED RESULT PREVIEW</span><h1>Attempt analysis</h1><AttemptInsights questions={questions} practicePath="/topic-practice-preview"/></section>;
}
