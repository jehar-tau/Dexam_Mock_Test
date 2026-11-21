import React, { useState } from "react";
import { Arrow } from "./Art.jsx";

export function paperSections(questions) {
  const groups = [];
  questions.forEach((item, index) => {
    const last = groups.at(-1);
    if (last?.kind === item.kind) last.indices.push(index);
    else groups.push({ kind: item.kind, indices: [index] });
  });
  return groups;
}

const filters = {all: "All questions", answered: "Answered", marked: "Marked for review", unanswered: "Visited without answer", fresh: "Not visited"};

export function PaperNavigation({questions, index, answered, waiting, flagged, visited, move, busy, canSubmit, onSubmit}) {
  const [filter, setFilter] = useState("all");
  const status = (i) => answered(questions[i]) ? "answered" : visited.has(i) ? "unanswered" : "fresh";
  const matches = (i, name) => name === "all" || (name === "marked" ? flagged.includes(questions[i].id) : status(i) === name);
  const counts = Object.fromEntries(Object.keys(filters).map(name => [name, questions.filter((_, i) => matches(i, name)).length]));
  return <aside className="attempt-navigation" id="attempt-navigator" aria-label="Question navigator" tabIndex={-1}>
    <div className="attempt-nav-heading"><span className="eyebrow">PAPER PROGRESS</span><h2>Question navigator</h2>
      <p><b>{counts.answered}</b> of {questions.length} answered</p>
      <progress value={counts.answered} max={questions.length || 1} aria-label="Paper answered" />
    </div>
    <label className="attempt-filter">Show questions
      <select value={filter} onChange={event => setFilter(event.target.value)}>
        {Object.entries(filters).map(([key, label]) => <option key={key} value={key}>{label} ({counts[key]})</option>)}
      </select>
    </label>
    <div className="attempt-map">{paperSections(questions).map(({kind, indices}) => {
      const included = indices.filter(i => matches(i, filter));
      return included.length > 0 && <section key={indices[0]}><h3>{kind.toUpperCase()} <small>Q{indices[0] + 1}{indices.length > 1 && "–" + (indices.at(-1) + 1)}</small></h3>
        <div className="attempt-tiles">{included.map(i => {
          const marked = flagged.includes(questions[i].id);
          const description = [filters[status(i)], marked && filters.marked, waiting(questions[i]) && "Waiting to sync"].filter(Boolean).join(" · ");
          return <button type="button" key={i} disabled={busy} aria-label={"Go to question " + (i + 1)} aria-description={description} title={description} aria-current={i === index ? "step" : undefined} data-status={status(i)} onClick={() => move(i)}>
            {i + 1}{marked && <i className="attempt-flag" aria-hidden="true" />}
          </button>;
        })}</div>
      </section>;
    })}
    {!counts[filter] && <p role="status">No questions match this filter.</p>}</div>
    <ul className="attempt-key" aria-label="Question status key">
      <li><i data-status="answered"/>Answered</li><li><i data-status="unanswered"/>Visited</li><li><i data-status="fresh"/>Not visited</li><li><i className="attempt-flag"/>Marked</li>
    </ul>
    <button type="button" className="button" disabled={!canSubmit} onClick={onSubmit}>Submit attempt <Arrow/></button>
  </aside>;
}

export function PaperFigures({question, media, status, broken, onBroken, onRetry}) {
  return question.media?.map((image, i) => {
    const id = question.id + ":" + i;
    const url = media[question.id]?.[i]?.url;
    if (url && !broken[id]) return <figure className="attempt-figure" key={id}>
      <figcaption>Question figure {i + 1}</figcaption><img src={url} alt={image.alt || "Question figure " + (i + 1)} onError={() => onBroken(id)} />
    </figure>;
    return status === "loading" ? <p role="status" key={id}>Loading question figure…</p> : <div key={id}><p role="status">Couldn’t load question figure {i + 1}.</p>
      <button type="button" className="text-button" onClick={onRetry}>Retry figure {i + 1}</button></div>;
  });
}
