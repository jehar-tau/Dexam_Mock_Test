import React, { useState } from "react";
import { Link } from "react-router-dom";
import { buildAttemptInsights, outcomeLabels, releasedOutcome, responseSummary } from "./attempt-insights.mjs";
import { answerAlternativesLabel, releasedKeyLabel } from "./answer-key.js";
import { DrawingReviewStatus } from "./DrawingReviewQueue.jsx";
import { WorkedSolution } from "./WorkedSolution.jsx";
import { readWorkedExplanation, workedFigureIndex } from "./worked-solution.js";
import "./paper-workspace.css";

const topicName = value => value?.replaceAll("-", " ") || "Unclassified";
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
      <section className="analysis-panel"><h2>By question type</h2><table><thead><tr><th>Type</th><th>Answered</th><th>Correct</th><th>Accuracy</th></tr></thead>
        <tbody>{sections.map(row => <tr key={row.key}><th scope="row">{row.key}</th><td>{row.answered}/{row.total}</td><td>{row.correct}</td><td>{row.accuracy == null ? "—" : row.accuracy + "%"}</td></tr>)}</tbody></table>
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

export function AnswerReview({attempt, figures, media, mediaStatus, onRetry, initialOutcome = ""}) {
  const { questions } = attempt;
  const [kind, setKind] = useState("");
  const [outcome, setOutcome] = useState(initialOutcome);
  const [selectedId, setSelectedId] = useState("");
  const [solutionOpenFor, setSolutionOpenFor] = useState("");
  const objective = questions.map((item, index) => ({item, index})).filter(({item}) => releasedOutcome(item));
  const drawings = questions.filter(item => item.kind === "drawing");
  const filtered = objective.filter(({item}) => (!kind || item.kind === kind) && (!outcome || releasedOutcome(item) === outcome));
  const chosen = filtered.find(({item}) => item.id === selectedId) ?? filtered[0];
  const item = chosen?.item;
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
      <article key={item.id} className="analysis-item">
        <header><span className="eyebrow">QUESTION {chosen.index+1} · {item.kind.toUpperCase()} · {topicName(item.topic)}</span><b>{outcomeLabels[releasedOutcome(item)]}</b></header>
        <h3>{item.prompt}</h3>{figures?.(item)}
        {item.options?.length > 0 && <ul className="analysis-options">{item.options.map(option => <li key={option.id} data-correct={correctOptions.includes(option.id) || undefined}>
            <div><b>{option.id}</b>{option.label}</div>
            {chosenOptions.includes(option.id) && <small>Your choice</small>}
            {correctOptions.includes(option.id) && <small>Correct choice</small>}
          </li>)}</ul>}
        <div className="analysis-response"><p><strong>Your answer:</strong> {answer || "Not answered"}</p>
          {key && <p><strong>{answerAlternativesLabel(item.correctKey) ? "Accepted answers" : "Correct answer"}</strong> {key}</p>}</div>
        {(solution || explanation) && <><button type="button" className="button quiet" aria-expanded={solutionOpen}
          aria-controls="review-worked-solution" onClick={() => setSolutionOpenFor(solutionOpen ? "" : item.id)}>
          {solutionOpen ? "Hide solution" : "View solution"}</button>
          <div id="review-worked-solution" hidden={!solutionOpen}>{solutionOpen && (solution
            ? <WorkedSolution solution={solution} explanation={explanation} figureUrl={media[item.id]?.[figureIndex]?.url}
              mediaStatus={mediaStatus} onRetry={onRetry}/>
            : <div className="analysis-explanation"><h4>Explanation</h4><p className="worked-solution-text">{explanation}</p></div>)}</div></>}
      </article></>}
    </>}
    {drawings.map(item => <article key={item.id}><h3>{item.prompt}</h3>{item.answer && <p>Your notes: {item.answer}</p>}{item.explanation && <p>{item.explanation}</p>}<DrawingReviewStatus review={item.drawingReview}/></article>)}
  </div>;
}

export function AttemptInsightsPreview() {
  const questions=[{kind:"mcq",topic:"observation",answer:"B",outcome:"incorrect"},{kind:"mcq",topic:"observation",answer:"A",outcome:"correct"},{kind:"nat",topic:"spatial-reasoning",answer:"12",outcome:"correct"}];
  return <section className="wrap section sample-result"><span className="eyebrow">RELEASED RESULT PREVIEW</span><h1>Attempt analysis</h1><AttemptInsights questions={questions} practicePath="/topic-practice-preview"/></section>;
}
