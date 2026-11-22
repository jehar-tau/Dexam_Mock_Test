import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import catalogue from './paper-years.generated.json';
import { paperLabel } from './paper-years.mjs';
import { releasedYearPaperMap } from './free-year-papers.mjs';
import { platform, cataloguePlatform } from './platform.js';
import { useAuthState } from './useAuth.js';
import { AccountAccessBoundary, useAccountServices } from './AccountAccess.jsx';
import { withAccountDeadline } from './account-request.js';
import { overviewStartId } from './overview-data.js';
import './papers.css';

const examNames = { uceed: 'UCEED', ceed: 'CEED', nift: 'NIFT', nid: 'NID' };
const exams = Object.keys(examNames);

export function PapersView({ papers = catalogue, releases = [], signedIn = false, onStart,
  busy = '', startError = '', releasesUnavailable = false, headingRef }) {
  const [selected, setSelected] = useState('uceed');
  const released = releasedYearPaperMap(releases, papers);
  const visible = papers.filter(paper => paper.exam === selected);
  const questionCount = visible.reduce((total, paper) => total + paper.questionCount, 0);
  return <section className="wrap section year-papers">
    <span className="eyebrow">PAPERS / YEAR BY YEAR</span>
    <h1 ref={headingRef} tabIndex={-1}>Explore the <em>papers.</em></h1>
    <p className="year-papers-intro">Browse our year-wise question sets. Reviewed papers are free to take. Timed starts open as their questions, figures and worked answers are verified.</p>
    {releasesUnavailable && <p role="alert" className="error">Couldn’t check released papers. Please reload before starting one.</p>}
    {startError && <p role="alert" className="error">{startError}</p>}
    <div className="year-papers-tabs" role="group" aria-label="Choose an exam">
      {exams.map(exam => <button type="button" key={exam} aria-pressed={selected === exam} onClick={() => setSelected(exam)}>{examNames[exam]}<span>{papers.filter(paper => paper.exam === exam).length}</span></button>)}
    </div>
    <div className="year-papers-summary"><div><span>SELECTED EXAM</span><h2>{examNames[selected]}</h2></div><p>{visible.length} sets · {questionCount} questions in our collection</p></div>
    <div className="year-papers-grid">
      {visible.map(paper => <article className="year-paper-card" key={paper.id}>
        <div className="year-paper-card-top"><span>{paper.year}</span><span className="year-paper-state">{released.has(paper.id) ? 'Free paper open' : 'In preparation'}</span></div>
        <h3>{paperLabel(paper)}</h3>
        <p>{paper.questionCount} questions in this set</p>
        <div className="year-paper-types">{paper.objectiveCount > 0 && <span>{paper.objectiveCount} objective</span>}{paper.drawingCount > 0 && <span>{paper.drawingCount} drawing or descriptive</span>}</div>
        {released.has(paper.id) ? released.get(paper.id).map(part =>
          <div className="year-paper-release" key={part.paperId}>
            <p><strong>{part.partLabel}</strong> · {part.questionCount} questions · {Math.round(part.durationSeconds / 60)} min</p>
            {signedIn ? <button type="button" className="button" disabled={!onStart || Boolean(busy) || releasesUnavailable}
              onClick={() => onStart(part.paperId)}>{busy === part.paperId ? 'Opening…' : 'Start or resume free paper'}</button>
              : <Link className="button" to="/account">Sign in to start free paper</Link>}
          </div>) : <p className="year-paper-note">The timed paper is being prepared.</p>}
      </article>)}
    </div>
    {visible.length === 0 && <p>No year-wise source sets are available for this exam yet.</p>}
    <p className="year-papers-footer">Want to try the exam room now? <Link to="/sample">Take the free sample</Link>.</p>
  </section>;
}

function SignedInPapers({ releases, releasesUnavailable, headingRef }) {
  const services = useAccountServices(), navigate = useNavigate(), active = useRef(null), mutationBusy = useRef(false);
  const [busy, setBusy] = useState(''), [startError, setStartError] = useState('');
  useEffect(() => { const controller = new AbortController(); active.current = controller;
    return () => {controller.abort();active.current = null;}; }, []);
  async function start(paperId) {
    if (mutationBusy.current || !active.current || releasesUnavailable) return;
    mutationBusy.current = true;
    const signal = active.current.signal, address = window.location.href, historyKey = window.history.state?.key;
    setBusy(paperId);setStartError('');
    try {
      const id = await withAccountDeadline(async request => {
        const value = overviewStartId(await services.rpc('start_free_year_paper',{p_paper_id:paperId},request));
        await services.checkIdentity(request);
        return value;
      },signal);
      if (!signal.aborted && window.location.href === address && window.history.state?.key === historyKey) navigate(`/attempt/${id}`);
    } catch { if (!signal.aborted) setStartError('Couldn’t confirm this start. Check your saved attempts before trying again.'); }
    finally { mutationBusy.current = false;if (!signal.aborted) setBusy(''); }
  }
  return <PapersView releases={releases} signedIn onStart={start} busy={busy}
    startError={startError} releasesUnavailable={releasesUnavailable} headingRef={headingRef}/>;
}

export default function Papers() {
  const { session } = useAuthState(), heading = useRef(null);
  const [releases, setReleases] = useState([]), [releasesUnavailable, setReleasesUnavailable] = useState(false);
  useEffect(() => {
    if (!cataloguePlatform) return;
    const controller = new AbortController();
    cataloguePlatform.rpc('free_year_paper_catalog').abortSignal(controller.signal).then(({data,error}) => {
      if (controller.signal.aborted) return;
      try { if (error) throw error; releasedYearPaperMap(data,catalogue); setReleases(data); }
      catch { setReleases([]);setReleasesUnavailable(true); }
    }).catch(() => {if (!controller.signal.aborted) setReleasesUnavailable(true);});
    return () => controller.abort();
  }, []);
  if (!session || !platform) return <PapersView releases={releases} releasesUnavailable={releasesUnavailable}/>;
  return <AccountAccessBoundary key={session.user.id} actorId={session.user.id} headingRef={heading} kind="catalogue">
    <SignedInPapers releases={releases} releasesUnavailable={releasesUnavailable} headingRef={heading}/>
  </AccountAccessBoundary>;
}
