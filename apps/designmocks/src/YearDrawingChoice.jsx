import React from "react";

export function YearDrawingChoice({ question, busy, choose }) {
  const choice = question.drawingChoice;
  if (!choice) return null;
  const alternatives = question.drawing.alternatives ?? [];
  return <section className="drawing-criteria" aria-label="Drawing task choice">
    {choice.group && <>
      <h4>{choice.group}</h4>
      {!alternatives.length && <button type="button" className="button quiet" disabled={busy || choice.selected}
        onClick={() => choose(question.id, null)}>{choice.selected ? "Your selected task" : "Choose this task"}</button>}
    </>}
    {alternatives.length > 0 && <fieldset disabled={busy}><legend>Choose the option you will draw</legend>
      {alternatives.map(option => <label key={option.id}>
        <input type="radio" name={`alternative-${question.id}`} value={option.id}
          checked={choice.alternative === option.id} onChange={() => choose(question.id, option.id)} />
        {option.id}. {option.label}
      </label>)}
    </fieldset>}
    {!choice.uploadAllowed && <p>Select your task or option before adding photos.</p>}
  </section>;
}

export function DrawingSubParts({parts = []}) {
  if (!parts.length) return null;
  return <div className="drawing-criteria"><h4>Parts of this task</h4>
    <ul>{parts.map(part => <li key={part.id}><span>{part.id}. {part.label}</span>{part.marks != null && <b>{part.marks} marks</b>}</li>)}</ul>
  </div>;
}
