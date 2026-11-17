import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PortalShell } from '../PortalShell.jsx';
import { ImageCredits } from './photo-figures.jsx';
import { StageMotif, TopicMotif } from '../TopicMotion.jsx';
import { postLaunchPreview } from '../launch-scope.js';
import { useAuthState } from '../useAuth.js';
import { learningPracticeLink } from '../practice-context.js';
import { findProgramme } from './programmes/index.js';
import { findLesson, formatMarks, formatSeconds, programmeSummary, quizLength, tiersOf } from './programme-model.js';
import { loadProgress, saveProgress } from './programme-storage.js';
import { LessonPlayer, QuizPlayer } from './LessonPlayer.jsx';
// Preview only: keep a programme in the Community prep space. Loaded on demand so
// released Learn pages carry no Community code.
const LearnSaveToPrep = React.lazy(() => import('../CommunityLearnSave.jsx').then(module => ({ default: module.LearnSaveToPrep })));

function Ring({ percent }) {
  const r = 16, c = 2 * Math.PI * r;
  return <svg className="ring" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
    <circle cx="20" cy="20" r={r} className="ring-track" />
    <circle cx="20" cy="20" r={r} className="ring-fill" strokeDasharray={`${c * percent / 100} ${c}`} transform="rotate(-90 20 20)" />
  </svg>;
}
const levelLabel = (tier, previous) => (previous && previous.level + 1 < tier.level ? `Levels ${previous.level + 1}–${tier.level}` : tier.level <= 2 && !previous ? `Levels 1–${tier.level}` : `Level ${tier.level}`);

export function ProgrammeOverview({ programme, progress, open, notice, message, unlockAll = false }) {
  const summary = programmeSummary(programme, progress, { unlockAll });
  const practice = learningPracticeLink({ exam: programme.exams[0], topic: programme.topic });
  const tiered = summary.tiers.length > 1;
  return <section className="programme" aria-label={programme.title}>
    <div className="programme-head">
      <div className="programme-head-art"><TopicMotif topic={programme.slug} label={`${programme.title} illustration`} /></div>
      <Ring percent={summary.percent} />
      <div>
        <span className="eyebrow">{programme.exams.map(e => e.toUpperCase()).join(' · ')}</span>
        <h2>{programme.title}</h2>
        <p className="programme-summary">{programme.summary}</p>
        <p className="programme-meta" aria-label="Programme progress">{summary.completed} of {summary.total} lessons · about {programme.minutes} min{summary.checks.answered > 0 ? ` · ${summary.checks.correct} of ${summary.checks.answered} checks right first time` : ''}</p>
      </div>
    </div>
    {message && <p className="programme-message" role="status">{message}</p>}
    {summary.tiers.map((state, t) => {
      const { tier } = state, quiz = tier.quiz, last = t === summary.tiers.length - 1;
      return <section key={tier.id} className={`tier${state.open ? '' : ' is-locked'}`} aria-label={tier.title}>
        {tiered && <header className="tier-head">
          <span className="tier-art"><StageMotif stage={tier.id} /></span>
          <h3>{tier.title}</h3>
          <span className="status-pill">{levelLabel(tier, summary.tiers[t - 1]?.tier)}</span>
          {!state.open && <p className="programme-meta">Locked. Pass the {summary.tiers[t - 1].tier.title} quiz to open it, or pass this tier’s quiz to skip ahead.</p>}
        </header>}
        <ol className="path">
          {state.lessons.map((entry, i) => {
            const next = summary.next?.id === entry.lesson.id;
            return <li key={entry.lesson.id} className={`path-item is-${entry.status}${next ? ' is-next' : ''}`}>
              <span className="path-marker" aria-hidden="true">{entry.status === 'complete' ? '✓' : i + 1}</span>
              <div className="path-body">
                <h4>{entry.lesson.title}</h4>
                <p>{entry.lesson.summary}</p>
                <p className="programme-meta">{entry.lesson.minutes} min{entry.total ? ` · ${entry.total} check${entry.total === 1 ? '' : 's'}` : ''}{entry.answered ? ` · ${entry.correct} of ${entry.answered} right` : ''}</p>
              </div>
              <button type="button" className={next ? 'pill primary' : 'pill quiet'} disabled={!state.open} onClick={() => open(entry.lesson.id)}>
                {entry.status === 'complete' ? 'Review' : entry.status === 'started' ? 'Continue' : 'Start'}
              </button>
            </li>;
          })}
          <li className={`path-item is-quiz${state.quiz.passed ? ' is-complete' : ''}`}>
            <span className="path-marker" aria-hidden="true">{state.quiz.passed ? '✓' : '★'}</span>
            <div className="path-body">
              <h4>{quiz.title}</h4>
              <p>{quizLength(quiz)} questions in {quiz.minutes} minutes{(quiz.marking ?? 'plain') === 'plain' ? '' : `, marked like ${quiz.marking.toUpperCase()}`}. {last ? `Aim for ${quiz.pass} fully correct.` : `${quiz.pass} right ${tiered ? 'opens the next tier' : 'is a pass'}.`}</p>
              <p className="programme-meta">{state.quiz.best ? `Best so far: ${formatMarks(state.quiz.best.marks)} of ${formatMarks(state.quiz.best.maxMarks)} in ${formatSeconds(state.quiz.best.seconds)} · ${state.quiz.attempts} attempt${state.quiz.attempts === 1 ? '' : 's'}${state.quiz.passed ? ' · passed' : ''}` : 'Not taken yet'}</p>
            </div>
            <button type="button" className="pill quiet" onClick={() => open(`quiz-${tier.id}`)}>{state.quiz.best ? 'Try again' : state.open ? 'Take quiz' : 'Skip ahead'}</button>
          </li>
        </ol>
      </section>;
    })}
    {/* Topic practice is still deferred on the released site. */}
    {(import.meta.env.DEV || postLaunchPreview) && <p className="programme-meta"><Link to={practice.to}>{practice.label} →</Link></p>}
    {notice && <p className="programme-notice">{notice}</p>}
    <ImageCredits credits={programme.credits} />
  </section>;
}

export function ProgrammeRunner({ programme, actorId, notice = '', seed = null, unlockAll = false }) {
  const [params, setParams] = useSearchParams();
  const [progress, setProgress] = useState(() => loadProgress(programme.slug, actorId));
  const [message, setMessage] = useState('');
  useEffect(() => { setProgress(loadProgress(programme.slug, actorId)); }, [programme.slug, actorId]);
  const update = next => { setProgress(next); if (!saveProgress(programme.slug, actorId, next)) setMessage('Progress could not be saved in this browser.'); };
  const view = params.get('lesson');
  const open = id => { setMessage(''); setParams(id ? { lesson: id } : {}); };
  const tiers = tiersOf(programme);
  // `challenge` is the old name for the first tier's quiz.
  const quizTier = view === 'challenge' ? tiers[0] : view?.startsWith('quiz-') ? tiers.find(tier => `quiz-${tier.id}` === view) : null;
  if (quizTier) return <QuizPlayer key={quizTier.id} tier={quizTier} isLastTier={quizTier === tiers[tiers.length - 1]} progress={progress} onProgress={update} onExit={() => open(null)} seed={seed} />;
  const lesson = view ? findLesson(programme, view) : null;
  if (lesson) return <LessonPlayer key={lesson.id} lesson={lesson} progress={progress} onProgress={update} onExit={() => open(null)} seedBase={seed}
    onComplete={() => { setParams({}); setMessage(`Lesson complete: ${lesson.title}.`); }} />;
  return <ProgrammeOverview programme={programme} progress={progress} open={open} notice={notice} message={message} unlockAll={unlockAll} />;
}

function ProgrammeHeading({ headingRef }) {
  return <><span className="eyebrow">LEARN, THEN PRACTISE</span><h1 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>Learn by <em>doing.</em></h1></>;
}

export function LearnProgrammePage() {
  const { session, loading } = useAuthState();
  const { slug } = useParams();
  const programme = findProgramme(slug);
  const heading = useRef(null);
  if (loading) return <p className="wrap" role="status">Checking your account…</p>;
  if (!session) return <section className="wrap section"><h1>Sign in to <em>learn.</em></h1><Link to="/account">Student sign in</Link></section>;
  return <PortalShell><section className="wrap section learn-page">
    <ProgrammeHeading headingRef={heading} />
    <p><Link to="/dashboard/learn">← All of Learn</Link></p>
    {programme && postLaunchPreview && <React.Suspense fallback={null}><LearnSaveToPrep programme={programme} actorId={session.user.id} headingRef={heading} /></React.Suspense>}
    {programme
      ? <ProgrammeRunner programme={programme} actorId={session.user.id} notice="Progress in interactive programmes is saved in this browser for now. Server-side saving arrives with the next Learn release." />
      : <p role="alert">This programme is not available. <Link to="/dashboard/learn">Back to Learn</Link></p>}
  </section></PortalShell>;
}

const REVIEW_KEY = 'dmocks.learn-preview.unlock-all';
function readReviewUnlock() { try { return window.localStorage.getItem(REVIEW_KEY) === 'on'; } catch { return false; } }
function writeReviewUnlock(on) { try { window.localStorage.setItem(REVIEW_KEY, on ? 'on' : 'off'); } catch { /* the switch still works for this visit */ } }

export function LearnProgrammePreview() {
  const { slug = 'cube-nets' } = useParams();
  const [params] = useSearchParams();
  const programme = findProgramme(slug);
  const seed = params.has('seed') ? Number(params.get('seed')) : null;
  const [unlockAll, setUnlockAll] = useState(readReviewUnlock);
  const toggle = on => { setUnlockAll(on); writeReviewUnlock(on); };
  return <PortalShell><section className="wrap section learn-page">
    <ProgrammeHeading />
    <p><Link to="/learn-preview">← Learn preview</Link></p>
    {!params.get('lesson') && <label className="review-unlock"><input type="checkbox" checked={unlockAll} onChange={e => toggle(e.target.checked)} /> Review mode: unlock every tier (this preview only; students still unlock tiers by passing quizzes)</label>}
    {programme
      ? <ProgrammeRunner programme={programme} actorId="preview" notice="Development preview. Progress is saved only in this browser." seed={seed} unlockAll={unlockAll} />
      : <p role="alert">No programme with that name.</p>}
  </section></PortalShell>;
}
