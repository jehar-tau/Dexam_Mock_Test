import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import catalogue from './paper-years.generated.json';
import { paperLabel } from './paper-years.mjs';
import { loadReleasedYearPapers, releasedYearPaperMap } from './free-year-papers.mjs';
import { platform, cataloguePlatform } from './platform.js';
import { useAuthState } from './useAuth.js';
import { AccountAccessBoundary, useAccountServices } from './AccountAccess.jsx';
import { withAccountDeadline } from './account-request.js';
import { overviewStartId } from './overview-data.js';
import { catalogueStartFailure, savedCatalogueAttempts } from './catalogue-data.js';
import './papers.css';

const examNames = { uceed: 'UCEED', ceed: 'CEED', nift: 'NIFT', nid: 'NID' };
const exams = Object.keys(examNames);

export function PapersView({ papers = catalogue, releases = [], signedIn = false, onStart,
  busy = '', startError = '', releasesUnavailable = false, releasesLoading = false,
  onRefresh, authChecking = false, startUncertain = false, onCheckAttempts,
  checkingAttempts = false, savedAttempts = [], recoveryError = '', headingRef }) {
  const [selected, setSelected] = useState('uceed');
  const [readyId, setReadyId] = useState('');
  const readyDialog = useRef(null), readyOpener = useRef(null), starting = useRef(false);
  const released = releasedYearPaperMap(releases, papers);
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
  return <section className="wrap section year-papers">
    <span className="eyebrow">PAPERS / YEAR BY YEAR</span>
    <h1 ref={headingRef} tabIndex={-1}>Explore the <em>papers.</em></h1>
    <p className="year-papers-intro">Browse our year-wise question sets. Reviewed papers are free to take. Timed starts open as their questions, figures and worked answers are verified.</p>
    {authChecking && <p role="status">Checking your account…</p>}
    {releasesLoading && <p role="status">Checking released papers…</p>}
    {releasesUnavailable && <p role="alert" className="error">Couldn’t check released papers. Refresh the catalogue before starting one.</p>}
    {releasesUnavailable && onRefresh && <button type="button" className="button quiet" disabled={releasesLoading} onClick={onRefresh}>Refresh papers</button>}
    {startError && <p role="alert" className="error">{startError}</p>}
    {startUncertain && <div className="notice" role="status"><p>This start may already be saved. Check your attempts before starting another paper.</p>
      <button type="button" className="button quiet" disabled={checkingAttempts} onClick={onCheckAttempts}>{checkingAttempts ? 'Checking…' : 'Check saved attempts'}</button>
      <Link to="/dashboard">View all attempts →</Link></div>}
    {recoveryError && <p role="alert" className="error">{recoveryError}</p>}
    {savedAttempts.length > 0 && <section aria-label="Saved active attempts"><h2>Your saved active attempts</h2><ul>{savedAttempts.map(item => <li key={item.id}><Link to={`/attempt/${item.id}`}>{item.title}</Link></li>)}</ul></section>}
    <div className="year-papers-tabs" role="group" aria-label="Choose an exam">
      {exams.map(exam => <button type="button" key={exam} aria-pressed={selected === exam} onClick={() => { closeReady(); setSelected(exam); }}>{examNames[exam]}<span>{papers.filter(paper => paper.exam === exam).length}</span></button>)}
    </div>
    <div className="year-papers-summary"><div><span>SELECTED EXAM</span><h2>{examNames[selected]}</h2></div><p>{visible.length} sets · {questionCount} questions in our collection</p></div>
    <div className="year-papers-grid">
      {visible.map(paper => <article className="year-paper-card" key={paper.id}>
        <div className="year-paper-card-top"><span>{paper.year}</span><span className="year-paper-state">{released.has(paper.id) ? 'Free paper open' : releasesLoading ? 'Checking release' : 'In preparation'}</span></div>
        <h3>{paperLabel(paper)}</h3>
        <p>{paper.questionCount} questions in this set</p>
        <div className="year-paper-types">{paper.objectiveCount > 0 && <span>{paper.objectiveCount} objective</span>}{paper.drawingCount > 0 && <span>{paper.drawingCount} drawing or descriptive</span>}</div>
        {released.has(paper.id) ? released.get(paper.id).map(part =>
          <div className="year-paper-release" key={part.paperId}>
            <p><strong>{part.partLabel}</strong> · {part.questionCount} questions · {Math.round(part.durationSeconds / 60)} min</p>
            {signedIn ? <button type="button" className="button" disabled={!onStart || Boolean(busy) || releasesUnavailable || releasesLoading || startUncertain || checkingAttempts}
              onClick={event => { readyOpener.current = event.currentTarget; setReadyId(part.paperId); }}>{busy === part.paperId ? 'Opening…' : 'Start or resume free paper'}</button>
              : authChecking ? <span role="status">Checking account…</span>
                : <Link className="button" to="/account">Sign in to start free paper</Link>}
          </div>) : <p className="year-paper-note">{releasesLoading ? 'Checking whether this timed paper is open.' : 'The timed paper is being prepared.'}</p>}
      </article>)}
    </div>
    {visible.length === 0 && <p>No year-wise source sets are available for this exam yet.</p>}
    <p className="year-papers-footer">Want to try the exam room now? <Link to="/sample">Take the free sample</Link>.</p>
    {readyPart && readyPaper && <dialog ref={readyDialog} className="year-paper-start-dialog" aria-labelledby="year-paper-start-title"
      onCancel={event => { event.preventDefault(); closeReady(); }}>
      <h2 id="year-paper-start-title">Ready to open {examNames[readyPaper.exam]} {readyPaper.year} {readyPart.partLabel}?</h2>
      <p>{readyPart.questionCount} questions · {Math.round(readyPart.durationSeconds / 60)} minutes</p>
      <p>If this is your first start, the timer begins when you confirm. If you have already started this paper, you will resume the same saved attempt with its original deadline. The clock keeps running while you are away.</p>
      <div className="year-paper-start-actions">
        <button type="button" className="button quiet" autoFocus onClick={closeReady}>Cancel</button>
        <button type="button" className="button" disabled={Boolean(busy) || releasesUnavailable || releasesLoading || startUncertain || checkingAttempts}
          onClick={confirmReady}>Start or resume timed paper</button>
      </div>
    </dialog>}
  </section>;
}

function SignedInPapers({ releases, releasesUnavailable, releasesLoading, onRefresh, headingRef }) {
  const services = useAccountServices(), navigate = useNavigate(), active = useRef(null), mutationBusy = useRef(false);
  const [busy, setBusy] = useState(''), [startError, setStartError] = useState('');
  const [startUncertain, setStartUncertain] = useState(false), [checkingAttempts, setCheckingAttempts] = useState(false);
  const [savedAttempts, setSavedAttempts] = useState([]), [recoveryError, setRecoveryError] = useState('');
  const current = () => Boolean(active.current && !active.current.signal.aborted && services.isCurrent());
  useEffect(() => { const controller = new AbortController(); active.current = controller;
    return () => {controller.abort();active.current = null;}; }, []);
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
    checkingAttempts={checkingAttempts} savedAttempts={savedAttempts} recoveryError={recoveryError} headingRef={headingRef}/>;
}

export default function Papers() {
  const { session, loading: authChecking } = useAuthState(), heading = useRef(null);
  const [releases, setReleases] = useState([]), [releasesUnavailable, setReleasesUnavailable] = useState(false);
  const [releasesLoading, setReleasesLoading] = useState(Boolean(cataloguePlatform)), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!cataloguePlatform) return;
    const controller = new AbortController();
    setReleasesLoading(true);setReleasesUnavailable(false);
    loadReleasedYearPapers(cataloguePlatform,catalogue,controller.signal).then(data => {
      if (!controller.signal.aborted) {setReleases(data);setReleasesUnavailable(false);}
    }).catch(() => {if (!controller.signal.aborted) {setReleases([]);setReleasesUnavailable(true);}})
      .finally(() => {if (!controller.signal.aborted) setReleasesLoading(false);});
    return () => controller.abort();
  }, [refresh]);
  const onRefresh = cataloguePlatform ? () => setRefresh(value => value + 1) : undefined;
  if (authChecking || !session || !platform) return <PapersView releases={releases} releasesUnavailable={releasesUnavailable}
    releasesLoading={releasesLoading} onRefresh={onRefresh} authChecking={authChecking}/>;
  return <AccountAccessBoundary key={session.user.id} actorId={session.user.id} headingRef={heading} kind="catalogue">
    <SignedInPapers releases={releases} releasesUnavailable={releasesUnavailable} releasesLoading={releasesLoading}
      onRefresh={onRefresh} headingRef={heading}/>
  </AccountAccessBoundary>;
}
