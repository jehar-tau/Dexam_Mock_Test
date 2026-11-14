import React from 'react';
import { Figure } from './figures.jsx';
import { NetBuilder } from './CubeNetTool.jsx';
import { answerText, checkAnswer, hasResponse } from './questions.js';

// Generic question: figures on top, the answer area below. Three answer
// modes: 'single' (pick one), 'multi' (select all that apply) and 'numeric'
// (type a number). `revealed` shows the marked state; `readOnly` shows the
// question without letting it be answered (worked examples).
export function Question({ question, response = null, revealed = false, readOnly = false, onSelect, onBuildResult, worked = false, idPrefix = '' }) {
  if (question.interactive === 'build-net') {
    return <div className="question">
      <p className="question-prompt">{question.prompt}</p>
      <NetBuilder key={question.seed} question={question} scored={!worked} onResult={onBuildResult} />
    </div>;
  }
  const mode = question.answerMode ?? 'single';
  const done = revealed || worked;
  const locked = done || readOnly;
  const figures = question.figures.map(f => (f.type === 'net' && done ? { ...f, showBad: true } : f));
  return <div className="question">
    <p className="question-prompt">{question.prompt}</p>
    {figures.length > 0 && <div className="question-figure">{figures.map((f, i) => <Figure key={i} spec={f} />)}</div>}
    {mode === 'numeric'
      ? <NumericAnswer question={question} response={response} done={done} locked={locked} onSelect={onSelect} id={`${idPrefix}answer`} />
      : <Choices question={question} mode={mode} response={response} done={done} locked={locked} worked={worked} onSelect={onSelect} idPrefix={idPrefix} />}
  </div>;
}

function NumericAnswer({ question, response, done, locked, onSelect, id }) {
  const answered = done && hasResponse(question, response);
  const correct = answered && checkAnswer(question, response).correct;
  return <div className={`numeric-answer${done ? (correct ? ' is-correct' : ' is-wrong') : ''}`}>
    <label htmlFor={id}>Your answer</label>
    <input id={id} type="text" inputMode="decimal" autoComplete="off" spellCheck="false" maxLength={8} value={response ?? ''} readOnly={locked}
      onChange={event => onSelect?.(event.target.value)} />
    {question.unit && <span className="numeric-unit">{question.unit}</span>}
    {done && !correct && <span className="numeric-truth">Answer: {answerText(question)}</span>}
  </div>;
}

function Choices({ question, mode, response, done, locked, worked, onSelect, idPrefix }) {
  const visual = question.options.some(o => o.figure);
  const multi = mode === 'multi';
  const chosenSet = new Set(multi ? (response ?? []) : response === null ? [] : [response]);
  const answerSet = new Set(multi ? question.answer : [question.answer]);
  const choose = id => {
    if (locked || !onSelect) return;
    if (!multi) return onSelect(id);
    onSelect(chosenSet.has(id) ? [...chosenSet].filter(v => v !== id) : question.options.map(o => o.id).filter(v => chosenSet.has(v) || v === id));
  };
  return <>
    {multi && <p className="choice-instruction">Select all that apply.</p>}
    <div className={`choices${visual ? ' visual' : ''}${question.options.some(o => o.figure?.type === 'solid-net') ? ' wide' : ''}${multi ? ' is-multi' : ''}`} role="group" aria-label="Answer choices">
      {question.options.map(option => {
        const isAnswer = answerSet.has(option.id), chosen = chosenSet.has(option.id);
        const state = done ? (isAnswer ? (multi && !chosen && !worked ? ' is-missed' : ' is-correct') : chosen ? ' is-wrong' : ' is-dim') : chosen ? ' is-chosen' : '';
        return <div key={option.id} className={`choice${state}`}>
          <button type="button" id={`${idPrefix}${option.id}`} disabled={locked} aria-pressed={chosen} aria-label={option.figure ? `Option ${option.label}` : undefined} onClick={() => choose(option.id)}>
            {multi && <span className="choice-tick" aria-hidden="true">{chosen ? '✓' : ''}</span>}
            {option.figure
              ? <><span className="choice-label">{option.label}</span><Figure spec={option.figure} compact /></>
              : <span className="choice-text">{option.text ?? option.label}</span>}
            {done && multi && isAnswer && !chosen && !worked && <span className="choice-note">missed</span>}
          </button>
          {worked && option.reason && <p className="choice-reason">{option.reason}</p>}
        </div>;
      })}
    </div>
  </>;
}
