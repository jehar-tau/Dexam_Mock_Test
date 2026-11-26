import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { paperLabel, paperLevel, paperSubtitle } from './paper-years.mjs';
import { loadReleasedYearPapers, releasedYearPaperMap, releasedYearPaperGroups } from './free-year-papers.mjs';
import { platform, cataloguePlatform } from './platform.js';
import { useAuthState } from './useAuth.js';
import { AccountAccessBoundary, useAccountServices } from './AccountAccess.jsx';
import { withAccountDeadline } from './account-request.js';
import { overviewStartId } from './overview-data.js';
import { catalogueStartFailure, savedCatalogueAttempts } from './catalogue-data.js';
import { ownedYearPaperAttempts } from './year-paper-attempts.mjs';
import './papers.css';

const examNames = { uceed: 'UCEED', ceed: 'CEED', nift: 'NIFT', nid: 'NID' };
const examDetails = {
  uceed: { body: 'IIT Bombay', level: 'B.Des. entrance' },
  ceed: { body: 'IIT Bombay', level: 'M.Des. entrance' },
  nift: { body: 'NIFT', level: 'B.Des. and M.Des. entrance' },
  nid: { body: 'NID', level: 'B.Des. and M.Des. DAT' },
};
const exams = Object.keys(examNames);
const catalogueRefreshMs = 10000;

export function PapersView({ releases = [], signedIn = false, onStart,
  busy = '', startError = '', releasesUnavailable = false, releasesLoading = false,
  onRefresh, authChecking = false, startUncertain = false, onCheckAttempts,
  checkingAttempts = false, savedAttempts = [], recoveryError = '', headingRef,
  attemptsByPaper = new Map(), attemptsLoading = false, attemptsError = '', onRefreshAttempts,
  initialExam = 'uceed', attemptHref = id => `/attempt/${id}`, attemptsHref = '/dashboard' }) {
  const [selected, setSelected] = useState(initialExam);
  const [readyId, setReadyId] = useState('');
  const readyDialog = useRef(null), readyOpener = useRef(null), starting = useRef(false);
  const released = releasedYearPaperMap(releases);
  const papers = releasedYearPaperGroups(releases);
  const readyPart = [...released.values()].flat().find(part => part.paperId === readyId);
  const readyPaper = readyPart && papers.find(paper => released.get(paper.id)?.some(part => part.paperId === readyId));
  const visible = papers.filter(paper => paper.exam === selected);
  const questionCount = visible.reduce((total, paper) => total + paper.questionCount, 0);
  useEffect(() => {
    if (!readyPart || !readyDialog.current) return;
    const dialog = readyDialog.current;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [readyId]);
  function closeReady() {
    setReadyId('');
    window.requestAnimationFrame(() => {
      if (readyOpener.current?.isConnected && !readyOpener.current.disabled) readyOpener.current.focus();
    });
  }
  async function confirmReady() {
    if (starting.current || !readyPart || !onStart || busy || releasesUnavailable || releasesLoading || startUncertain || checkingAttempts) return;
    starting.current = true;
    const paperId = readyPart.paperId;
    setReadyId('');
    try { await onStart(paperId); }
    finally { starting.current = false; }
  }
  const years = visible.map(paper => paper.year);
  const yearRange = years.length ? (Math.min(...years) === Math.max(...years) ? `${years[0]}` : `${Math.min(...years)}–${Math.max(...years)}`) : '—';
  const exam = examDetails[selected];
  return <section className="wrap section year-papers">
    <span className="eyebrow">PAPERS / YEAR BY YEAR</span>
    <h1 ref={headingRef} tabIndex={-1}>Explore the <em>papers.</em></h1>
    <p className="year-papers-intro">Take a complete, reviewed past-year paper for free. Each paper appears here after its questions, figures, answer key and solutions are checked.</p>
    <ul className="year-papers-promises" aria-label="Every released paper includes">
      <li>Free to attempt</li><li>Original timer</li><li>That year’s marking</li><li>Solution for every question</li>
    </ul>
    {authChecking && <p role="status">Checking your account…</p>}
    {releasesLoading && <p role="status">Checking released papers…</p>}
    {releasesUnavailable && <p role="alert" className="error">Couldn’t check released papers. Refresh the catalogue before starting one.</p>}
    {releasesUnavailable && onRefresh && <button type="button" className="button quiet" disabled={releasesLoading} onClick={onRefresh}>Refresh papers</button>}
    {startError && <p role="alert" className="error">{startError}</p>}
    {startUncertain && <div className="notice" role="status"><p>This start may already be saved. Check your attempts before starting another paper.</p>
      <button type="button" className="button quiet" disabled={checkingAttempts} onClick={onCheckAttempts}>{checkingAttempts ? 'Checking…' : 'Check saved attempts'}</button>
      <Link to={attemptsHref}>View all attempts →</Link></div>}
    {recoveryError && <p role="alert" className="error">{recoveryError}</p>}
    {attemptsLoading && <p role="status">Checking your saved papers…</p>}
    {attemptsError && <div className="notice" role="status"><p>Couldn’t check your saved papers. You can still open a released paper.</p>
      {onRefreshAttempts && <button type="button" className="button quiet" onClick={onRefreshAttempts}>Retry saved papers</button>}</div>}
    {savedAttempts.length > 0 && <section aria-label="Saved active attempts"><h2>Your saved active attempts</h2><ul>{savedAttempts.map(item => <li key={item.id}><Link to={attemptHref(item.id)}>{item.title}</Link></li>)}</ul></section>}
    <div className="year-papers-tabs" role="group" aria-label="Choose an exam">
      {exams.map(exam => <button type="button" key={exam} aria-pressed={selected === exam} onClick={() => { closeReady(); setSelected(exam); }}>{examNames[exam]}<span>{papers.filter(paper => paper.exam === exam).length}</span></button>)}
    </div>
    <div className="year-papers-layout">
      <aside className="year-papers-summary" aria-labelledby="year-papers-exam">
        <span>SELECTED EXAM</span>
        <h2 id="year-papers-exam">{examNames[selected]}</h2>
        <p className="year-papers-exam-line">{exam.body} · {exam.level}</p>
        <dl className="year-papers-stats">
          <div><dt>Papers</dt><dd>{visible.length}</dd></div>
          <div><dt>Questions</dt><dd>{questionCount}</dd></div>
          <div><dt>Years</dt><dd>{yearRange}</dd></div>
        </dl>
        <ol className="year-papers-steps">
          <li><span><strong>Attempt</strong> the full paper against its original clock. Answers save as you go.</span></li>
          <li><span><strong>Submit</strong> to see your marks under that year’s marking scheme.</span></li>
          <li><span><strong>Review</strong> every question with the answer key and a worked explanation.</span></li>
        </ol>
      </aside>
      <div className="year-papers-list">
        {visible.map(paper => <article className="year-paper-card" key={paper.id} aria-labelledby={`paper-${paper.id}`}>
          <div className="year-paper-card-top"><span className="year-paper-year" aria-hidden="true">{paper.year}</span><span className="year-paper-state">Free paper open</span></div>
          <div className="year-paper-card-body">
            <h3 id={`paper-${paper.id}`} className="visually-hidden">{examNames[paper.exam]} {paperLevel(paper)}{paperLabel(paper)}</h3>
            {paperSubtitle(paper) !== 'Question paper' && <p className="year-paper-title" aria-hidden="true">{paperSubtitle(paper)}</p>}
            {released.get(paper.id).length > 1 && <p className="year-paper-meta">{paper.questionCount} questions across {released.get(paper.id).length} parts</p>}
            {released.get(paper.id).map(part => {
              const own = attemptsByPaper.get(part.paperId);
              return <div className="year-paper-release" key={part.paperId}>
                <p className="year-paper-part"><strong>{part.partLabel}</strong><span>{part.questionCount} questions</span><span>{Math.round(part.durationSeconds / 60)} min</span></p>
                <div className="year-paper-progress">
                  {own?.active && <p className="year-paper-own-attempt" data-state="active"><span>In progress</span>
                    <Link to={attemptHref(own.active.id)}>Continue saved attempt →</Link></p>}
                  {own?.submitted && <p className="year-paper-own-attempt" data-state={own.submitted.resultsPending ? 'pending' : 'scored'}><span>{own.submitted.resultsPending
                    ? 'Result under review' : `Latest result ${own.submitted.score} / ${own.submitted.total}`}</span>
                    <Link to={attemptHref(own.submitted.id)}>{own.submitted.resultsPending
                      ? 'View result status →' : 'Review latest attempt →'}</Link></p>}
                  {signedIn && !own?.active && !own?.submitted && !attemptsLoading && <p className="year-paper-own-attempt" data-state="new"><span>Not attempted yet</span></p>}
                </div>
                <div className="year-paper-action">
                  {signedIn && !own?.active ? <button type="button" className={own?.submitted ? 'button quiet' : 'button'} aria-describedby={`paper-${paper.id}`} disabled={!onStart || Boolean(busy) || releasesUnavailable || releasesLoading || startUncertain || checkingAttempts}
                    onClick={event => { readyOpener.current = event.currentTarget; setReadyId(part.paperId); }}>{busy === part.paperId ? 'Opening…' : 'Start or resume free paper'}</button>
                    : signedIn ? null : authChecking ? <span role="status">Checking account…</span>
                      : <Link className="button" to="/account">Sign in to start free paper</Link>}
                </div>
              </div>;
            })}
          </div>
        </article>)}
        {visible.length === 0 && !releasesLoading && !releasesUnavailable && <div className="year-papers-empty" role="status"><h3>No {examNames[selected]} paper released yet</h3><p>Complete papers will appear here after review. You can try the free sample meanwhile.</p></div>}
      </div>
    </div>
    <p className="year-papers-footer">Want to try the exam room now? <Link to="/sample">Take the free sample</Link>.</p>
    {readyPart && readyPaper && <dialog ref={readyDialog} className="year-paper-start-dialog" aria-labelledby="year-paper-start-title"
      onCancel={event => { event.preventDefault(); closeReady(); }}>
      <span className="eyebrow">{examNames[readyPaper.exam]} · {readyPaper.year}</span>
      <h2 id="year-paper-start-title">Ready to open {examNames[readyPaper.exam]} {readyPaper.year} {readyPart.partLabel}?</h2>
      <dl className="year-paper-start-facts">
        <div><dt>Questions</dt><dd>{readyPart.questionCount}</dd></div>
        <div><dt>Time</dt><dd>{Math.round(readyPart.durationSeconds / 60)} min</dd></div>
      </dl>
      <ul className="year-paper-start-rules">
        <li>If this is your first start, the timer begins when you confirm.</li>
        <li>If you have already started this paper, you will resume the same saved attempt with its original deadline.</li>
        <li>The clock keeps running while you are away. Answers save as you go.</li>
      </ul>
      <div className="year-paper-start-actions">
        <button type="button" className="button quiet" autoFocus onClick={closeReady}>Cancel</button>
        <button type="button" className="button" disabled={Boolean(busy) || releasesUnavailable || releasesLoading || startUncertain || checkingAttempts}
          onClick={confirmReady}>Start or resume timed paper</button>
      </div>
    </dialog>}
  </section>;
}

function SignedInPapers({ releases, releasesUnavailable, releasesLoading, onRefresh, headingRef, initialExam }) {
  const services = useAccountServices(), navigate = useNavigate(), active = useRef(null), mutationBusy = useRef(false);
  const [busy, setBusy] = useState(''), [startError, setStartError] = useState('');
  const [startUncertain, setStartUncertain] = useState(false), [checkingAttempts, setCheckingAttempts] = useState(false);
  const [savedAttempts, setSavedAttempts] = useState([]), [recoveryError, setRecoveryError] = useState('');
  const [attemptsByPaper, setAttemptsByPaper] = useState(new Map()), [attemptsLoading, setAttemptsLoading] = useState(true);
  const [attemptsError, setAttemptsError] = useState(''), [attemptRefresh, setAttemptRefresh] = useState(0);
  const current = () => Boolean(active.current && !active.current.signal.aborted && services.isCurrent());
  useEffect(() => { const controller = new AbortController(); active.current = controller;
    return () => {controller.abort();active.current = null;}; }, []);
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([active.current.signal, controller.signal]);
    setAttemptsLoading(true);setAttemptsError('');
    withAccountDeadline(async request => {
      const finalized = await services.rpc('finalize_my_expired_attempts', undefined, request);
      if (!Number.isSafeInteger(finalized) || finalized < 0) throw new Error('Invalid attempt finalization');
      const attempts = ownedYearPaperAttempts(await services.rpc('my_year_paper_attempts', undefined, request));
      await services.checkIdentity(request);
      return attempts;
    }, signal).then(value => { if (current() && !controller.signal.aborted) setAttemptsByPaper(value); })
      .catch(() => { if (current() && !controller.signal.aborted) setAttemptsError('Couldn’t check your saved papers.'); })
      .finally(() => { if (current() && !controller.signal.aborted) setAttemptsLoading(false); });
    return () => controller.abort();
  }, [attemptRefresh]);
  async function start(paperId) {
    if (mutationBusy.current || !current() || releasesUnavailable || releasesLoading || startUncertain) return;
    mutationBusy.current = true;
    const signal = active.current.signal, address = window.location.href, historyKey = window.history.state?.key;
    setBusy(paperId);setStartError('');setSavedAttempts([]);setRecoveryError('');
    try {
      const id = await withAccountDeadline(async request => {
        const value = overviewStartId(await services.rpc('start_free_year_paper',{p_paper_id:paperId},request));
        await services.checkIdentity(request);
        return value;
      },signal);
      if (current() && window.location.href === address && window.history.state?.key === historyKey) navigate(`/attempt/${id}`);
    } catch (error) { if (current()) {
      const failure = catalogueStartFailure(error);
      setStartError(failure.definitive ? failure.message : 'Couldn’t confirm this start. It may already be saved.');
      setStartUncertain(!failure.definitive);
    } }
    finally { mutationBusy.current = false;if (current()) setBusy(''); }
  }
  async function checkAttempts() {
    if (mutationBusy.current || !current() || checkingAttempts) return;
    mutationBusy.current = true;setCheckingAttempts(true);setRecoveryError('');
    try {
      const attempts = await withAccountDeadline(async request => {
        const rows = savedCatalogueAttempts(await services.rpc('my_attempt_history', undefined, request));
        await services.checkIdentity(request);
        return rows;
      }, active.current.signal);
      if (current()) { setSavedAttempts(attempts);setStartUncertain(false);setStartError(''); }
    } catch { if (current()) setRecoveryError('Couldn’t confirm your saved attempts. Try checking again before starting another paper.'); }
    finally { mutationBusy.current = false;if (current()) setCheckingAttempts(false); }
  }
  return <PapersView releases={releases} signedIn onStart={start} busy={busy}
    startError={startError} releasesUnavailable={releasesUnavailable} releasesLoading={releasesLoading}
    onRefresh={onRefresh} startUncertain={startUncertain} onCheckAttempts={checkAttempts}
    checkingAttempts={checkingAttempts} savedAttempts={savedAttempts} recoveryError={recoveryError} headingRef={headingRef}
    attemptsByPaper={attemptsByPaper} attemptsLoading={attemptsLoading} attemptsError={attemptsError}
    onRefreshAttempts={() => setAttemptRefresh(value => value + 1)} initialExam={initialExam}/>;
}

export default function Papers() {
  const { session, loading: authChecking } = useAuthState(), heading = useRef(null);
  const requestedExam = new URLSearchParams(useLocation().search).get('exam');
  const initialExam = exams.includes(requestedExam) ? requestedExam : 'uceed';
  const [releases, setReleases] = useState([]), [releasesUnavailable, setReleasesUnavailable] = useState(false);
  const [releasesLoading, setReleasesLoading] = useState(Boolean(cataloguePlatform)), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!cataloguePlatform) return;
    const controller = new AbortController();
    let inFlight = false;
    const load = async (showLoading = false) => {
      if (controller.signal.aborted || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      if (showLoading) setReleasesLoading(true);
      try {
        const data = await loadReleasedYearPapers(cataloguePlatform,controller.signal);
        if (!controller.signal.aborted) {setReleases(data);setReleasesUnavailable(false);}
      } catch {
        // Keep the last known cards visible while disabling new starts until
        // the catalogue can be checked again.
        if (!controller.signal.aborted) setReleasesUnavailable(true);
      } finally {
        inFlight = false;
        if (!controller.signal.aborted && showLoading) setReleasesLoading(false);
      }
    };
    void load(true);
    const onVisible = () => {if (document.visibilityState === 'visible') void load();};
    const onFocus = () => {void load();};
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('focus',onFocus);
    const timer = window.setInterval(() => {void load();},catalogueRefreshMs);
    return () => {controller.abort();window.clearInterval(timer);
      document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('focus',onFocus);};
  }, [refresh]);
  const onRefresh = cataloguePlatform ? () => setRefresh(value => value + 1) : undefined;
  if (authChecking || !session || !platform) return <PapersView releases={releases} releasesUnavailable={releasesUnavailable}
    releasesLoading={releasesLoading} onRefresh={onRefresh} authChecking={authChecking} initialExam={initialExam}/>;
  return <AccountAccessBoundary key={session.user.id} actorId={session.user.id} headingRef={heading} kind="catalogue">
    <SignedInPapers releases={releases} releasesUnavailable={releasesUnavailable} releasesLoading={releasesLoading}
      onRefresh={onRefresh} headingRef={heading} initialExam={initialExam}/>
  </AccountAccessBoundary>;
}
