import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AssessmentCatalogue } from './AssessmentCatalogue.jsx';
import { ExamStudyArt } from './ExamStudyArt.jsx';
import { examGuides, initialCatalogueExam } from './exam-guides.js';
import { PortalShell } from './PortalShell.jsx';
import './exam-mocks.css';

function ExamMocksHeading({ headingRef, preview }) {
  return <header className="exam-desk-head">
    <h1 ref={headingRef} tabIndex={-1}>Exam-wise mocks</h1>
    {preview && <span className="exam-preview-label">Student preview</span>}
    <p>Take a paper, review your answers and explore the format for your exam.</p>
  </header>;
}

function ExamSelector({ selected, onSelect, blocked }) {
  return <fieldset className="exam-select" disabled={blocked}>
    <legend>Choose your exam</legend>
    <div>{Object.entries(examGuides).map(([exam, guide]) =>
      <label key={exam} className={'exam-choice exam-' + exam}>
        <input type="radio" name="exam-guide" value={exam} checked={selected === exam} onChange={() => onSelect(exam)}/>
        <span className="exam-mark" aria-hidden="true"/>
        <span><strong>{guide.title}</strong><small>{guide.programme}</small></span>
        <span className="exam-choice-dot" aria-hidden="true"/>
      </label>)}</div>
  </fieldset>;
}

function FormatGuide({ guide }) {
  return <section className="exam-desk-card exam-format" aria-label="Paper format">
    <h3>2027 paper format</h3>
    <p>{guide.introduction}</p>
    {guide.sections.map(([label, title, duration, explanation]) =>
      <details key={label}>
        <summary>
          <span className="exam-format-part">{label}</span>
          <span>{title}<small>{duration}</small></span>
          <span className="exam-expand" aria-hidden="true"/>
        </summary>
        <p>{explanation}</p>
      </details>)}
    <a className="exam-text-link" href={guide.source}>Official exam guide <span aria-hidden="true">↗</span></a>
  </section>;
}

function OriginalSample({ guide }) {
  const [response, setResponse] = useState('');
  const [result, setResult] = useState('');
  const sample = guide.sample;
  function check(event) {
    event.preventDefault();
    if (!response.trim()) return;
    setResult(Number(response) === sample.answer ? 'Correct.' : 'Try again.');
  }
  function choose(value) {
    setResponse(value);
    setResult('');
  }
  return <details className="exam-sample exam-desk-card">
    <summary><span className="exam-sample-icon" aria-hidden="true">✎</span>
      <span><small>Original untimed sample</small><strong>{sample.title}</strong></span>
      <span className="exam-expand" aria-hidden="true"/>
    </summary>
    <p>{sample.prompt}</p>
    {sample.answer === undefined
      ? <details className="exam-self-check"><summary>Review your sketch</summary><p>{sample.explanation}</p></details>
      : <form onSubmit={check}>
        {sample.options
          ? <fieldset><legend>Your answer (cm)</legend><div className="exam-options">{sample.options.map(option =>
            <label key={option}><input type="radio" required name="sample-answer" value={option} checked={response === String(option)} onChange={event => choose(event.target.value)}/>{option}</label>)}</div></fieldset>
          : <label className="exam-answer">Your numerical answer<input type="number" required step="any" value={response} onChange={event => choose(event.target.value)}/></label>}
        <button type="submit" className="exam-action">Check answer</button>
        {result && <p role="status"><strong>{result}</strong> {result === 'Correct.' ? sample.explanation : 'Look at the quantities in the prompt and give it another go.'}</p>}
      </form>}
  </details>;
}

function PaperCatalogue({ guide, paper, preview, busy, blocked, onStart, message }) {
  const ready = paper?.enabled && paper.ready;
  const freeLeft = ready ? Math.max(0, paper.freeAttemptLimit - paper.freeAttemptsUsed) : 0;
  return <section className="exam-desk-card exam-catalogue" aria-label="Mock catalogue">
    <h3>Mock catalogue</h3>
    {ready && !preview ? <>
      <h4>{guide.title} {paper.sectionLabel || 'practice paper'}</h4>
      <p>{paper.questionCount} questions per paper · {Math.round(paper.durationSeconds / 60)} min</p>
      {paper.sectionCounts && <p>{['nat','msq','mcq'].filter(key => paper.sectionCounts[key]).map(key => `${key.toUpperCase()} ${paper.sectionCounts[key]}`).join(' · ')}</p>}
      <p>{freeLeft ? `${freeLeft} free attempt${freeLeft === 1 ? '' : 's'} left` : 'Annual pass'}</p>
      <button type="button" className="exam-action" disabled={busy || blocked} onClick={event => onStart(paper.exam, event.currentTarget)}>{busy ? 'Creating…' : 'Start mock'}</button>
    </> : <div className="exam-release-state">
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M5 9h9l3 3h10v14H5z"/><path d="M8 8V5h13l4 4v3M10 17h12m-12 4h8"/>
      </svg>
      <div><h4>{preview ? 'Preview only' : 'No paper available'}</h4>
        <p>{preview ? `Released ${guide.title} papers and start options appear in your signed-in catalogue.` : `A start option will appear here when a ${guide.title} paper is ready.`}</p></div>
    </div>}
    {message && <p className="error" role="alert">{message}</p>}
  </section>;
}

export function ExamMocksView({ catalog = [], onStart, heading = true, embedded = false, blocked = false, preview = false }) {
  const [selected, setSelected] = useState(() => initialCatalogueExam(catalog));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const starting = useRef(false);
  const guide = examGuides[selected];
  const paper = catalog.find(item => item.exam === selected);
  useEffect(() => {
    if (!reviewing || !dialogRef.current) return;
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [reviewing]);
  function closeReview() {
    setReviewing(false);
    window.requestAnimationFrame(() => {
      if (openerRef.current?.isConnected && !openerRef.current.disabled) openerRef.current.focus();
    });
  }
  async function start(exam) {
    if (starting.current || preview || busy || blocked || !paper?.ready || !paper.enabled) return;
    starting.current = true;
    setReviewing(false);
    setBusy(true);
    setMessage('');
    try { await onStart(exam); }
    catch (error) { setMessage(error.message); }
    finally { starting.current = false; setBusy(false); }
  }
  return <section className={embedded ? 'exam-desk' : 'section portal-module exam-mocks exam-desk'}>
    {heading && <ExamMocksHeading preview={preview}/>}
    {preview && (import.meta.env.DEV || __DMOCKS_STAGING_REVIEW_PREVIEW__) && <section className="exam-guide-banner exam-demo-banner" aria-label="Paper demo">
      <div className="exam-guide-intro">
        <span className="exam-kicker">Original DMocks demo · 6 questions · 12 min</span>
        <h2>Inside the exam room</h2>
        <p>Work through three question types on the clock, then see how you scored, answer by answer.</p>
        <Link className="exam-demo-link" to="/portal-preview/paper">Try a complete paper demo <span aria-hidden="true">→</span></Link>
      </div>
      <div className="exam-guide-illustration"><ExamStudyArt exam={selected}/></div>
    </section>}
    <ExamSelector selected={selected} blocked={busy} onSelect={exam => { setSelected(exam); setMessage(''); }}/>
    <section className={'exam-guide exam-' + selected} key={selected} aria-label={guide.title + ' guide'}>
      <h2 className="exam-current-heading">{guide.title}<span>{guide.programme}</span></h2>
      <div className="exam-guide-grid">
        <div className="exam-practice-column">
          <PaperCatalogue guide={guide} paper={paper} preview={preview} busy={busy} blocked={blocked} onStart={(_exam, opener) => { openerRef.current = opener; setMessage(''); setReviewing(true); }} message={message}/>
          <OriginalSample guide={guide}/>
        </div>
        <FormatGuide guide={guide}/>
      </div>
      <details className="exam-attempt-note"><summary>How are mock papers assembled?</summary><p>For a released exam-wise mock, the generator draws from the eligible, reviewed questions for each section. Starting an attempt fixes its questions and starts the timer. The paper and clock stay the same when you return.</p></details>
    </section>
    {reviewing && paper && <dialog ref={dialogRef} className="exam-start-dialog" aria-labelledby="exam-start-title"
      onCancel={event => { event.preventDefault(); closeReview(); }}>
      <h2 id="exam-start-title">Ready to begin {guide.title} {paper.sectionLabel || 'practice paper'}?</h2>
      <p>{paper.questionCount} questions · {Math.round(paper.durationSeconds / 60)} minutes</p>
      <p>Beginning fixes your questions and starts the timer. The clock keeps running when you leave; return to the same saved attempt.</p>
      {paper.freeAttemptLimit > paper.freeAttemptsUsed && <p>{paper.freeAttemptLimit - paper.freeAttemptsUsed} free attempt{paper.freeAttemptLimit - paper.freeAttemptsUsed === 1 ? '' : 's'} remaining. Beginning uses one.</p>}
      <div className="exam-start-actions">
        <button type="button" className="button quiet" autoFocus onClick={closeReview}>Cancel</button>
        <button type="button" className="exam-action" disabled={busy || blocked || !paper.ready || !paper.enabled}
          onClick={() => start(paper.exam)}>Begin timed mock</button>
      </div>
    </dialog>}
  </section>;
}

export function ExamMocks() {
  return <AssessmentCatalogue kind="exam" Heading={ExamMocksHeading} View={ExamMocksView}/>;
}

export function ExamMocksPreview() {
  return <PortalShell><ExamMocksView preview/></PortalShell>;
}
