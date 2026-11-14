import React, { useEffect, useMemo, useRef, useState } from 'react';
import { answerText, buildQuiz, checkAnswer, emptyResponse, generateQuestion, hasResponse, markFor, markingSchemes, maxMarks } from './questions.js';
import { Figure } from './figures.jsx';
import { Question } from './Question.jsx';
import { LearnTool } from './tools.jsx';
import { completeLesson, formatMarks, formatSeconds, practiceResult, quizLength, recordPractice, recordQuiz, recordStep, stepResult } from './programme-model.js';

// A focused, one-idea-per-screen player. Top: close and segmented progress.
// Middle: the current screen. Bottom: one primary action and any feedback.
// Each screen kind is its own component, keyed by step id, so its state can
// never leak into the next screen.

function PlayerFrame({ title, index, count, onClose, timer = null, children, footer }) {
  const footerRef = useRef(null);
  useEffect(() => {
    const onKey = event => {
      if (event.key === 'Escape') { onClose(); return; }
      if (event.key !== 'Enter') return;
      const tag = event.target.tagName;
      const typing = tag === 'INPUT' && event.target.closest('.numeric-answer');
      if (!typing && (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA')) return;
      footerRef.current?.querySelector('[data-primary]:not(:disabled)')?.click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="player" role="dialog" aria-label={title}>
    <header className="player-top">
      <button type="button" className="player-close" aria-label="Leave the lesson" onClick={onClose}>×</button>
      <div className="player-progress" role="progressbar" aria-valuemin={0} aria-valuemax={count} aria-valuenow={index + 1} aria-label={`${title}: screen ${index + 1} of ${count}`}>
        {Array.from({ length: count }, (_, i) => <span key={i} className={i < index ? 'is-done' : i === index ? 'is-current' : ''} />)}
      </div>
      {timer ?? <span className="player-count" aria-hidden="true">{index + 1}/{count}</span>}
    </header>
    <div className="player-body"><div className="player-column">{children}</div></div>
    <footer className="player-actions" ref={footerRef}>{footer}</footer>
  </div>;
}

function Feedback({ result, onShowWorking }) {
  if (!result) return null;
  return <div className={`feedback${result.correct ? ' is-correct' : ' is-wrong'}`} role="status">
    <strong>{result.correct ? 'Correct' : 'Not quite'}</strong>
    <p>{result.feedback}</p>
    {onShowWorking && <button type="button" className="link-button" onClick={onShowWorking}>See the working</button>}
  </div>;
}

// Solution steps, revealed one at a time when `stepwise`, otherwise all shown.
function Working({ steps, stepwise = false, onDone }) {
  const [shown, setShown] = useState(stepwise ? 1 : steps.length);
  useEffect(() => { if (shown >= steps.length) onDone?.(); }, [shown, steps.length]);
  return <div className="working" aria-label="Worked solution">
    <ol>{steps.slice(0, shown).map((step, i) => <li key={i}><span>{step.text}</span>{step.figure && <Figure spec={step.figure} compact />}</li>)}</ol>
    {shown < steps.length && <button type="button" className="pill quiet" onClick={() => setShown(shown + 1)}>Next step</button>}
  </div>;
}

function Buttons({ nav, children }) {
  return <div className="player-buttons">
    {nav.canBack && <button type="button" className="pill quiet" onClick={nav.back}>Back</button>}
    {children}
  </div>;
}
const Primary = ({ children, ...props }) => <button type="button" className="pill primary" data-primary {...props}>{children}</button>;

function SlideScreen({ frame, nav, step }) {
  const paragraphs = Array.isArray(step.text) ? step.text : [step.text];
  return <PlayerFrame {...frame} footer={<Buttons nav={nav}><Primary onClick={nav.next}>Continue</Primary></Buttons>}>
    <div className="slide">
      {step.title && <h2 className="slide-title">{step.title}</h2>}
      {paragraphs.map((p, i) => <p key={i} className="slide-text">{p}</p>)}
      {step.figure && <div className="slide-figure"><Figure spec={step.figure} /></div>}
      {step.tool && <div className="slide-tool"><LearnTool tool={step.tool} props={step.props} /></div>}
      {step.hint && <p className="slide-hint">{step.hint}</p>}
    </div>
  </PlayerFrame>;
}

// An exam-style problem shown before the teaching. Nothing is marked or recorded.
function HookScreen({ frame, nav, step }) {
  const question = useMemo(() => generateQuestion(step.question.kind, step.question.seed, step.question.level), [step]);
  const [response, setResponse] = useState(() => emptyResponse(question));
  return <PlayerFrame {...frame} footer={<Buttons nav={nav}><Primary onClick={nav.next}>Continue</Primary></Buttons>}>
    <span className="slide-kicker">Try this first</span>
    <Question question={question} response={response} onSelect={setResponse} idPrefix={`hook-${step.id}-`} />
    <p className="slide-hint">{step.text}</p>
  </PlayerFrame>;
}

function WorkedScreen({ frame, nav, step }) {
  const question = useMemo(() => generateQuestion(step.question.kind, step.question.seed, step.question.level), [step]);
  const [done, setDone] = useState(false);
  return <PlayerFrame {...frame} footer={<><p className="player-note">{done ? '' : 'Reveal every step to continue.'}</p><Buttons nav={nav}><Primary disabled={!done} onClick={nav.next}>Continue</Primary></Buttons></>}>
    <span className="slide-kicker">Worked example</span>
    <Question question={question} response={done && question.answerMode === 'numeric' ? String(question.answer.value ?? question.answer.min) : done ? question.answer : emptyResponse(question)} revealed={done} readOnly idPrefix={`worked-${step.id}-`} />
    <Working steps={question.solution} stepwise onDone={() => setDone(true)} />
  </PlayerFrame>;
}

function CheckScreen({ frame, nav, lesson, step, progress, onProgress }) {
  const question = useMemo(() => generateQuestion(step.question.kind, step.question.seed, step.question.level), [step]);
  const [response, setResponse] = useState(() => emptyResponse(question));
  const [result, setResult] = useState(null);
  const [hints, setHints] = useState(0);
  const [working, setWorking] = useState(false);
  const previous = stepResult(progress, lesson.id, step.id);
  const record = outcome => onProgress(recordStep(progress, lesson.id, step.id, { correct: outcome.correct, hinted: hints > 0 }));
  const check = () => { const outcome = checkAnswer(question, response); setResult(outcome); record(outcome); };
  const buildResult = (outcome, first) => { if (first) record(outcome); if (outcome.correct) setResult(outcome); };
  const interactive = Boolean(question.interactive);
  const moreHints = !result && !interactive && hints < question.hints.length;
  return <PlayerFrame {...frame} footer={<>
    {!result && hints > 0 && <div className="hint-box" role="status">{question.hints.slice(0, hints).map((hint, i) => <p key={i}><strong>Hint {i + 1}.</strong> {hint}</p>)}</div>}
    <Feedback result={result} onShowWorking={result && question.solution.length && !working ? () => setWorking(true) : null} />
    {!result && previous && !interactive && <p className="player-note">You answered this before. Try it again.</p>}
    <Buttons nav={nav}>
      {moreHints && <button type="button" className="pill quiet" onClick={() => setHints(hints + 1)}>{hints ? 'Another hint' : 'Hint'}</button>}
      {!interactive && !result
        ? <Primary disabled={!hasResponse(question, response)} onClick={check}>Check</Primary>
        : <Primary disabled={!result} onClick={nav.next}>{nav.last ? 'Finish lesson' : 'Continue'}</Primary>}
    </Buttons>
  </>}>
    <Question question={question} response={response} revealed={result !== null} onSelect={setResponse} onBuildResult={buildResult} idPrefix={`${lesson.id}-${step.id}-`} />
    {working && <Working steps={question.solution} />}
  </PlayerFrame>;
}

// Endless questions of one kind. Passed after `streak` correct in a row.
export function PracticeScreen({ frame, nav, lesson, step, progress, onProgress, seedBase = null, ephemeral = false }) {
  const firstSeed = useRef(seedBase ?? (crypto.getRandomValues(new Uint32Array(1))[0] % 2000000000) + 1);
  const [n, setN] = useState(0);
  const question = useMemo(() => generateQuestion(step.question.kind, firstSeed.current + n, step.question.level), [step, n]);
  const [response, setResponse] = useState(() => emptyResponse(question));
  const [result, setResult] = useState(null);
  const [streak, setStreak] = useState(0);
  const [working, setWorking] = useState(false);
  const saved = ephemeral ? null : practiceResult(progress, lesson.id, step.id);
  const passed = streak >= step.streak || Boolean(saved?.passedAt);
  const check = () => {
    const outcome = checkAnswer(question, response);
    const next = outcome.correct ? streak + 1 : 0;
    setResult(outcome); setStreak(next);
    if (!ephemeral) onProgress(recordPractice(progress, lesson.id, step.id, { streak: next, passed: next >= step.streak }));
  };
  const another = () => { setN(n + 1); setResponse(emptyResponse(question)); setResult(null); setWorking(false); };
  return <PlayerFrame {...frame} footer={<>
    <Feedback result={result} onShowWorking={result && question.solution.length && !working ? () => setWorking(true) : null} />
    {passed && <p className="player-note" role="status">{streak >= step.streak ? `${step.streak} in a row. You can move on, or keep practising.` : 'Already passed. Practise as much as you like.'}</p>}
    <Buttons nav={nav}>
      {!result && <Primary disabled={!hasResponse(question, response)} onClick={check}>Check</Primary>}
      {result && <button type="button" className={passed ? 'pill quiet' : 'pill primary'} data-primary={passed ? undefined : true} onClick={another}>Next question</button>}
      {(result || passed) && <button type="button" className={passed ? 'pill primary' : 'pill quiet'} data-primary={passed && result ? true : undefined} disabled={!passed} onClick={nav.next}>{nav.last ? 'Finish lesson' : 'Continue'}</button>}
    </Buttons>
  </>}>
    <div className="practice-head">
      <span className="slide-kicker">Practice · {step.streak} in a row to pass</span>
      <span className="streak" role="img" aria-label={`Streak ${Math.min(streak, step.streak)} of ${step.streak}`}>{Array.from({ length: step.streak }, (_, i) => <i key={i} className={i < streak ? 'is-on' : ''} />)}</span>
    </div>
    <Question key={n} question={question} response={response} revealed={result !== null} onSelect={setResponse} idPrefix={`practice-${n}-`} />
    {working && <Working steps={question.solution} />}
  </PlayerFrame>;
}

function TakeawayScreen({ frame, nav, lesson, step, seedBase }) {
  const [practising, setPractising] = useState(false);
  const main = [...lesson.steps].reverse().find(s => s.kind === 'check' && !generateQuestion(s.question.kind, s.question.seed, s.question.level).interactive);
  if (practising) return <PracticeScreen frame={frame} nav={{ canBack: true, back: () => setPractising(false), next: () => setPractising(false), last: false }} lesson={lesson} seedBase={seedBase} ephemeral
    step={{ id: 'more', kind: 'practice', question: { kind: main.question.kind, level: main.question.level }, streak: 3 }} />;
  return <PlayerFrame {...frame} footer={<Buttons nav={nav}>
    {main && <button type="button" className="pill quiet" onClick={() => setPractising(true)}>Practise more</button>}
    <Primary onClick={nav.next}>Finish lesson</Primary>
  </Buttons>}>
    <div className="slide">
      <span className="slide-kicker">Remember this</span>
      <blockquote className="takeaway">{step.body}</blockquote>
      <p className="slide-text">You finished <strong>{lesson.title}</strong>. Press Finish to save your progress.</p>
    </div>
  </PlayerFrame>;
}

export function LessonPlayer({ lesson, progress, onProgress, onExit, onComplete, seedBase = null }) {
  const [index, setIndex] = useState(0);
  const step = lesson.steps[index];
  const last = index === lesson.steps.length - 1;
  const frame = { title: lesson.title, index, count: lesson.steps.length, onClose: onExit };
  const nav = {
    canBack: index > 0, last, back: () => setIndex(index - 1),
    next: () => { if (last) { onProgress(completeLesson(progress, lesson.id)); onComplete(); } else setIndex(index + 1); },
  };
  const common = { frame, nav, lesson, step, progress, onProgress, seedBase };
  switch (step.kind) {
    case 'hook': return <HookScreen key={step.id} {...common} />;
    case 'worked': return <WorkedScreen key={step.id} {...common} />;
    case 'check': return <CheckScreen key={step.id} {...common} />;
    case 'practice': return <PracticeScreen key={step.id} {...common} />;
    case 'takeaway': return <TakeawayScreen key={step.id} {...common} />;
    default: return <SlideScreen key={step.id} {...common} />;
  }
}

// A tier quiz: timed, no feedback until the end, marked by the tier's scheme.
export function QuizPlayer({ tier, isLastTier, progress, onProgress, onExit, seed = null }) {
  const quiz = tier.quiz, scheme = quiz.marking ?? 'plain';
  const [phase, setPhase] = useState('intro');
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState([]);
  const [spent, setSpent] = useState([]);
  const [startedAt, setStartedAt] = useState(0);
  const [enteredAt, setEnteredAt] = useState(0);
  const [now, setNow] = useState(0);
  const [outcome, setOutcome] = useState(null);
  const limit = quiz.minutes * 60;
  const elapsed = phase === 'running' ? Math.min(limit, Math.floor((now - startedAt) / 1000)) : 0;
  const best = progress.quizzes[tier.id]?.best ?? null;
  const start = () => {
    const list = buildQuiz(quiz, seed ?? (Date.now() % 2147483647));
    setQuestions(list); setResponses(list.map(emptyResponse)); setSpent(list.map(() => 0)); setIndex(0);
    const at = Date.now(); setStartedAt(at); setEnteredAt(at); setNow(at); setPhase('running');
  };
  const timeOn = (list, at) => list.map((t, i) => (i === index ? t + (at - enteredAt) / 1000 : t));
  const finish = (answers, at) => {
    const times = timeOn(spent, at);
    const results = questions.map((q, i) => {
      const answered = hasResponse(q, answers[i]);
      const result = answered ? checkAnswer(q, answers[i]) : { correct: false, feedback: `Not answered. The answer is ${answerText(q)}. ${q.explanation}` };
      return { question: q, response: answers[i], answered, result, marks: markFor(q, answers[i], scheme), max: maxMarks(q, scheme), seconds: Math.round(times[i]) };
    });
    const score = results.filter(r => r.result.correct).length;
    const marks = Math.round(results.reduce((sum, r) => sum + r.marks, 0) * 100) / 100;
    const total = results.reduce((sum, r) => sum + r.max, 0);
    const seconds = Math.min(limit, Math.max(0, Math.round((at - startedAt) / 1000)));
    const passed = score >= quiz.pass;
    setOutcome({ results, score, marks, total, seconds, passed });
    onProgress(recordQuiz(progress, tier.id, { score, total: questions.length, marks, maxMarks: total, seconds, passed }));
    setPhase('done');
  };
  const latest = useRef({ responses, finish });
  latest.current = { responses, finish };
  useEffect(() => {
    if (phase !== 'running') return undefined;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current - startedAt >= limit * 1000) latest.current.finish(latest.current.responses, current);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, startedAt, limit]);
  const answer = value => { const next = [...responses]; next[index] = value; setResponses(next); };
  const move = to => { const at = Date.now(); setSpent(timeOn(spent, at)); setEnteredAt(at); setIndex(to); };
  const advance = () => { if (index + 1 < questions.length) move(index + 1); else finish(responses, Date.now()); };
  const n = quizLength(quiz);

  if (phase === 'intro') return <PlayerFrame title={quiz.title} index={0} count={1} onClose={onExit} footer={<div className="player-buttons"><Primary onClick={start}>Begin</Primary></div>}>
    <div className="slide">
      <span className="slide-kicker">{tier.title} · timed</span>
      <h2 className="slide-title">{quiz.title}</h2>
      <p className="slide-text">{quiz.description ? `${quiz.description} ` : ''}{n} questions, {quiz.minutes} minutes, no feedback until the end.</p>
      <p className="slide-text">{markingSchemes[scheme].label} {isLastTier ? '' : `Get ${quiz.pass} of ${n} right to open the next tier.`}</p>
      {best && <p className="slide-hint">Your best so far: {formatMarks(best.marks)} of {formatMarks(best.maxMarks)} in {formatSeconds(best.seconds)}.</p>}
    </div>
  </PlayerFrame>;

  if (phase === 'done') return <PlayerFrame title="Quiz result" index={0} count={1} onClose={onExit} footer={<div className="player-buttons"><button type="button" className="pill quiet" onClick={start}>Try again</button><Primary onClick={onExit}>Back to programme</Primary></div>}>
    <div className="slide">
      <span className="slide-kicker">{tier.title} · result</span>
      <h2 className="slide-title">{scheme === 'plain' ? `${outcome.score} of ${outcome.results.length} correct` : `${formatMarks(outcome.marks)} of ${formatMarks(outcome.total)} marks`}</h2>
      <p className="slide-text" role="status">{scheme === 'plain' ? '' : `${outcome.score} of ${outcome.results.length} fully correct. `}Finished in {formatSeconds(outcome.seconds)}. {isLastTier ? (outcome.passed ? 'That is exam-ready for this topic.' : `Aim for ${quiz.pass} fully correct.`) : outcome.passed ? 'Passed: the next tier is open.' : `You need ${quiz.pass} to open the next tier.`}</p>
    </div>
    <ol className="review">
      {outcome.results.map((r, i) => <li key={i} className={r.result.correct ? 'is-correct' : 'is-wrong'}>
        <h3>{i + 1}. {r.result.correct ? 'Correct' : r.answered ? 'Wrong' : 'Not answered'}{scheme === 'plain' ? '' : ` · ${r.marks > 0 ? '+' : ''}${formatMarks(r.marks)} of ${r.max}`} · {formatSeconds(r.seconds)}{r.question.targetSeconds && r.seconds > r.question.targetSeconds ? ` (target ${formatSeconds(r.question.targetSeconds)})` : ''}</h3>
        <Question question={r.question} response={r.response} revealed idPrefix={`review-${i}-`} />
        <p className="review-reason">{r.result.feedback}</p>
        {r.question.solution.length > 0 && <details className="review-working"><summary>See the working</summary><Working steps={r.question.solution} /></details>}
      </li>)}
    </ol>
  </PlayerFrame>;

  const timer = <span className={`player-timer${limit - elapsed <= 60 ? ' is-late' : ''}`} role="timer" aria-label="Time left">{formatSeconds(limit - elapsed)}</span>;
  return <PlayerFrame title={quiz.title} index={index} count={questions.length} onClose={onExit} timer={timer}
    footer={<div className="player-buttons">
      {index > 0 && <button type="button" className="pill quiet" onClick={() => move(index - 1)}>Back</button>}
      <button type="button" className="pill quiet" onClick={() => finish(responses, Date.now())}>Submit now</button>
      <Primary onClick={advance}>{index + 1 < questions.length ? 'Next question' : 'Finish quiz'}</Primary>
    </div>}>
    <Question key={index} question={questions[index]} response={responses[index]} onSelect={answer} idPrefix={`quiz-${index}-`} />
  </PlayerFrame>;
}
