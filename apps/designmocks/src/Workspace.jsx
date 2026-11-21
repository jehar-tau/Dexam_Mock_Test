import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Art, Arrow } from "./Art.jsx";
import {postLaunchPreview} from "./launch-scope.js";
import { AccountAccessBoundary, useAccountServices } from "./AccountAccess.jsx";
import { withAccountDeadline } from "./account-request.js";
import { loadOverview, overviewStartId } from "./overview-data.js";
import { useAuthState } from "./useAuth.js";
import { PortalShell } from "./PortalShell.jsx";
import { QuestionReport } from "./QuestionReport.jsx";
import { DrawingUploads, DrawingUploadWindow } from "./DrawingUploads.jsx";
import { AttemptAccessBoundary } from "./AttemptAccess.jsx";
import { drawingMediaError } from "./drawing-upload.js";
import { createAnswerSyncQueue, validAttemptAnswer } from "./attempt-sync.js";
import { createAttemptAnswerJournal, pruneDeviceAnswers } from "./attempt-answer-journal.js";
import { AttemptInsights, AnswerReview } from "./AttemptInsights.jsx";
import { ExamPartTransition, ExamSessionReport } from "./ExamPartTransition.jsx";
import { PaperFigures, PaperNavigation, paperSections } from "./PaperNavigation.jsx";

function SignInGate() {
  return (
    <section className="wrap page-intro">
      <span className="eyebrow">YOUR PRACTICE SPACE</span>
      <h1>
        One account.
        <br /> Your own <em>progress.</em>
      </h1>
      <p>Sign in to open your papers and saved attempts.</p>
      <Link className="button" to="/account">
        Student sign in <Arrow />
      </Link>
    </section>
  );
}
function WorkspaceSession({headingRef,catalogueOnly=false}) {
  const services=useAccountServices(),scope=useRef(null),read=useRef(null),mutationBusy=useRef(false);
  const navigate = useNavigate();
  const [data, setData] = useState(null),
    [papers, setPapers] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),[loading,setLoading]=useState(true),[unconfirmed,setUnconfirmed]=useState(false);
  const current=()=>Boolean(scope.current&&!scope.current.signal.aborted&&services.isCurrent());
  async function load(){
    if(!current()||mutationBusy.current)return;
    read.current?.abort();const request=new AbortController();read.current=request;const signal=AbortSignal.any([scope.current.signal,request.signal]);
    const active=()=>current()&&!request.signal.aborted&&read.current===request;
    setData(null);setPapers([]);setError("");setLoading(true);
    try{const value=await withAccountDeadline(active=>loadOverview(services,active),signal);if(active()){setData(value.data);setPapers(value.papers);setUnconfirmed(false);}}
    catch{if(active())setError("Couldn’t load your workspace. Refresh it to try again.");}
    finally{if(active())setLoading(false);}
  }
  useEffect(() => {
    const controller=new AbortController();scope.current=controller;void load();
    return()=>{controller.abort();read.current?.abort();};
  }, []);
  const start = async (id) => {
    const paper=papers.find(item=>item.id===id);
    if(!current()||mutationBusy.current||loading||unconfirmed||!data?.access.active||!paper||paper.qualityHeld)return;
    mutationBusy.current=true;const signal=scope.current.signal,address=window.location.href,historyKey=window.history.state?.key;
    setBusy(id);
    setError("");
    try {
      const attempt=await withAccountDeadline(async active=>{const value=overviewStartId(await services.rpc("start_attempt",{p_paper_id:id},active));await services.checkIdentity(active);return value;},signal);
      if(current()&&window.location.href===address&&window.history.state?.key===historyKey)navigate("/attempt/"+attempt);
    } catch {
      if(current()){setUnconfirmed(true);setError("Couldn’t confirm this start. Refresh your workspace to check for a saved attempt before starting again.");}
    } finally {
      mutationBusy.current=false;if(current())setBusy("");
    }
  };
  return <WorkspaceView heading={false} embedded catalogueOnly={catalogueOnly} data={data} papers={papers} error={error} busy={busy} loading={loading} unconfirmed={unconfirmed} onStart={start}
    onRefresh={()=>{headingRef.current?.focus();void load();}}/>;
}
export function WorkspaceHeading({headingRef,catalogueOnly=false}){return<><span className="eyebrow">YOUR PRACTICE SPACE</span><h1 ref={headingRef} tabIndex={-1}>{catalogueOnly?<>Choose your<br/><em>released paper.</em></>:<>Welcome to your<br/> next <em>attempt.</em></>}</h1></>;}
export function Workspace({catalogueOnly=false}){
  const{session,loading}=useAuthState(),location=useLocation(),heading=useRef(null),scopeKey=(session?.user.id??'signed-out')+':'+location.key,previous=useRef(scopeKey);
  useLayoutEffect(()=>{if(previous.current!==scopeKey&&(document.activeElement===document.body||heading.current?.parentElement.contains(document.activeElement)))heading.current?.focus();previous.current=scopeKey;},[scopeKey]);
  if (!session && !loading) return <SignInGate />;
  if(loading)return<section className="wrap section"><p role="status">Checking your account…</p></section>;
  return (
    <PortalShell><section className="wrap section workspace"><WorkspaceHeading headingRef={heading} catalogueOnly={catalogueOnly}/><AccountAccessBoundary key={scopeKey} kind="overview" actorId={session.user.id} headingRef={heading}><WorkspaceSession headingRef={heading} catalogueOnly={catalogueOnly}/></AccountAccessBoundary></section></PortalShell>
  );
}

// Shared presentation only. Live identity checks and RPCs stay in Workspace.
export function WorkspaceView({
  data,
  papers = [],
  error = "",
  busy = "",
  loading = false,
  onStart,
  attemptHref = (id) => "/attempt/" + id,
  startLabel = "Start or resume",
  passLabel = "YOUR PASS",
  practiceHref = "/dashboard/practice",
  allIndiaHref = "/dashboard/all-india",
  heading = true,embedded = false,onRefresh,unconfirmed = false,catalogueOnly = false,
}) {
  return (
    <section className={embedded?"workspace-content":"wrap section workspace"}>
      {heading&&<WorkspaceHeading/>}
      {(loading || (!data && !error)) && (
        <p role="status">Loading your workspace…</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {onRefresh&&<button type="button" className="button quiet" disabled={Boolean(busy)||loading} onClick={onRefresh}>{catalogueOnly?"Refresh papers":"Refresh workspace"}</button>}
      {data && (
        <>
          {!catalogueOnly && <>
          <div className="dashboard-stats">
            <article>
              <span>{passLabel}</span>
              <h2>{data.access?.active ? "Active" : "Not active"}</h2>
              {data.access?.active ? (
                <p>
                  Until{" "}
                  {new Date(data.access.expiresAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              ) : (
                <Link to="/plans">View the annual pass →</Link>
              )}
            </article>
            <article>
              <span>COMPLETED ATTEMPTS</span>
              <h2>{data.analytics?.completed ?? 0}</h2>
              <p>Submitted and safely stored.</p>
            </article>
            <article>
              <span>YOUR NEXT STEP</span>
              <h2>{data.analytics?.recommendedTopic?.topic ?? "Begin."}</h2>
              {postLaunchPreview&&data.analytics?.recommendedTopic ? (
                <Link to={practiceHref}>Practise the recommended topic →</Link>
              ) : (
                <a href="#your-papers">Choose a released paper →</a>
              )}
            </article>
          </div>
          </>}
          {data.analytics?.activeAttempt && (
            <div className="notice">
              <b>Continue where you left off.</b>{" "}
              {data.analytics.activeAttempt.title}{" "}
              <Link to={`/attempt/${data.analytics.activeAttempt.id}`}>
                Resume attempt →
              </Link>
            </div>
          )}
          {!catalogueOnly && data.analytics?.waitingForResults > 0 && <p className="notice" role="status">
            {data.analytics.waitingForResults === 1 ? "1 submitted attempt is awaiting results." :
              `${data.analytics.waitingForResults} submitted attempts are awaiting results.`}
          </p>}
          {!catalogueOnly && (data.analytics?.exams?.length > 0 || data.analytics?.objectiveAccuracy != null || data.analytics?.drawingReviews?.pending > 0 ||
            data.analytics?.drawingReviews?.released > 0) && (
            <>
              <h2>Your performance snapshot.</h2>
              <p>{postLaunchPreview?"Exam averages use released whole tests, including drawing marks.":"Averages use your released objective papers."}</p>
              <div className="dashboard-stats analytics-snapshot" aria-label="Performance snapshot">
                {data.analytics.objectiveAccuracy != null && <article>
                  <span>OBJECTIVE ACCURACY</span>
                  <h2>{data.analytics.objectiveAccuracy}%</h2>
                  <p>Across {data.analytics.objectiveAnswered} released answered questions.</p>
                </article>}
                {postLaunchPreview&&<article>
                  <span>DRAWING REVIEWS</span>
                  <h2>{data.analytics.drawingReviews?.released ?? 0} released</h2>
                  <p>{data.analytics.drawingReviews?.pending ?? 0} awaiting teacher release.</p>
                </article>}
                {data.analytics.exams?.slice(0, postLaunchPreview ? 4 : 2).map((exam) => (
                  <article key={exam.exam}>
                    <span>{exam.exam.toUpperCase()} PERFORMANCE</span>
                    <h2>{exam.averagePercent}% average</h2>
                    <p>Best {exam.bestPercent}% across {exam.attempts} released test{exam.attempts === 1 ? "" : "s"}.</p>
                    {postLaunchPreview && <Link to={`${allIndiaHref}?exam=${exam.exam}`}>
                      {exam.exam.toUpperCase()} All India results →
                    </Link>}
                  </article>
                ))}
              </div>
            </>
          )}
          {!catalogueOnly && data.analytics?.topics?.length > 0 && (
            <>
              <h2>Your topic picture.</h2>
              <div className="dashboard-stats">
                {data.analytics.topics.slice(0, 3).map((topic) => (
                  <article key={topic.topic}>
                    <span>{topic.topic}</span>
                    <h2>{topic.accuracy}%</h2>
                    <p>
                      {topic.correct} correct from {topic.answered} answered
                    </p>
                    {postLaunchPreview&&<Link to={practiceHref}>Practise this topic →</Link>}
                  </article>
                ))}
              </div>
            </>
          )}
          {catalogueOnly && !data.access?.active && <p className="notice">An active pass is needed to start a released paper. <Link to="/plans">View the annual pass →</Link></p>}
          <h2 id="your-papers">{catalogueOnly?"Released papers.":"Your papers."}</h2>
          {papers.length ? (
            <div className="paper-list">
              {papers.map((p) => (
                <article key={p.id}>
                  <span className="eyebrow">
                    {p.exam.toUpperCase()} ·{" "}
                    {Math.round(p.durationSeconds / 60)} MINUTES
                  </span>
                  <h3>{p.title}</h3>
                  <button
                    className="button"
                    disabled={p.qualityHeld || !data.access?.active || Boolean(busy) || unconfirmed}
                    onClick={() => onStart(p.id)}
                  >
                    {p.qualityHeld ? "Paused for question review" : busy === p.id ? "Opening…" : startLabel}
                    <Arrow />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="notice">
              No papers have been released yet. They’ll appear here after the
              reviewed bank is imported and published.
            </div>
          )}
          {!catalogueOnly && <><h2>Your recent attempts.</h2>
          {data.attempts.length ? (
            data.attempts.map((a) => (
              <article className="history-row" key={a.id}>
                <Link to={attemptHref(a.id)}>
                  {a.title}
                  <Arrow size={17} />
                </Link>
                <span>
                  {a.status === "active" ? "Continue / submit" : a.resultsPending ? "View status" : "View report"}
                </span>
                <span>
                  {a.resultsPending ? "Awaiting release" : a.status === "submitted"
                    ? `${a.score} / ${a.total}${postLaunchPreview&&a.cohortRank ? ` · Rank ${a.cohortRank}` : ""}`
                    : "In progress"}
                </span>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <Art kind="space" />
              <h3>Every practice starts somewhere.</h3>
              <p>Your attempts will appear here.</p>
            </div>
          )}</>}
        </>
      )}
    </section>
  );
}
const hasAnswer = (answer) =>
  Array.isArray(answer)
    ? answer.length > 0
    : answer !== null && answer !== undefined && answer !== "";
export function PendingAttemptResult({ title, reviewEndsAt, children, allIndiaHref = "/dashboard/all-india", workspaceHref = "/dashboard" }) {
  const releaseDate = reviewEndsAt && !Number.isNaN(Date.parse(reviewEndsAt))
    ? new Date(reviewEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : null;
  return <section className="wrap section sample-result">
    <Link className="back-link" to={allIndiaHref}>← All India mocks</Link>
    <span className="eyebrow">{title} / SUBMITTED</span>
    <h1>Your work is saved.<br />Results come <em>after review.</em></h1>
    <div className="notice" role="status">
      <p>Your answers are locked. Marks, topic feedback, answer keys and ranks stay private until the team releases this event’s results.</p>
      {releaseDate && <p>Review closes on {releaseDate}. The team can publish results after that date.</p>}
    </div>
    {children}
    <p>You can continue with other practice while you wait. Return to All India mocks to check the release status.</p>
    <Link className="button" to={workspaceHref}>Back to your workspace <Arrow /></Link>
  </section>;
}

export function Attempt() {
  const {session,loading}=useAuthState(),{id}=useParams(),location=useLocation();
  if(!session&&!loading)return <SignInGate/>;
  if(loading)return <section className="wrap page-intro"><p role="status">Checking your account…</p></section>;
  return <AttemptAccessBoundary key={`${session.user.id}:${id}:${location.key}:${location.search}`} actorId={session.user.id}>
    {services=><AttemptSession id={id} actorId={session.user.id} services={services}/>}
  </AttemptAccessBoundary>;
}
export function AttemptSession({actorId, services, id, workspaceHref = "/dashboard", practicePath, demo = false, onRestart}) {
  const choiceInstructionId = React.useId();
  const rpc=services.rpc,current=services.isCurrent;
  const drawingInvoke=React.useCallback(async(body,signal)=>{
    const{data,error}=await services.functions.invoke("drawing-media",{body,signal});
    if(error)throw await drawingMediaError(error);return data;
  },[services]);
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null),
    [loadedFor, setLoadedFor] = useState(null),
    [index, setIndex] = useState(0),
    [draft, setDraft] = useState(null),
    [flagged, setFlagged] = useState([]),
    [visited, setVisited] = useState(() => new Set([0])),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [syncState, setSyncState] = useState({ kind: "saved", pending: 0 }),
    [reconnects, setReconnects] = useState(0),
    [now, setNow] = useState(Date.now()),
    [review, setReview] = useState(false),
    [reviewFilter, setReviewFilter] = useState({outcome:"", revision:0}),
    [media, setMedia] = useState({}),
    [mediaStatus, setMediaStatus] = useState("loading"),
    [mediaRetry, setMediaRetry] = useState(0),
    [brokenFigures, setBrokenFigures] = useState({}),
    [examSession, setExamSession] = useState(null),
    [examReport, setExamReport] = useState(null);
  const reviewHeading = useRef(null);
  const dialog = useRef(),
    questionHeading = useRef(null),
    offset = useRef(0),
    autoSubmitted = useRef(false),
    answerSync = useRef(null),
    saveTimer = useRef(null),
    shownQuestion = useRef(null),
    mutationBusy = useRef(false);
  const q = attempt?.questions[index];
  shownQuestion.current = q?.id;
  const userId = actorId;
  const answerFor = (item) => answerSync.current?.hasPending(item.id) ? answerSync.current.pendingAnswer(item.id) : item.answer;
  useEffect(() => {
    let alive = true;const request=new AbortController();
    setAttempt(null);
    setLoadedFor(null);
    setIndex(0);
    setDraft(null);
    setError("");
    setBusy(false);
    setConfirm(false);
    setFlagged([]);
    setMedia({});
    setMediaStatus("loading");
    setBrokenFigures({});
    setExamSession(null);
    setExamReport(null);
    setSyncState({ kind: "saved", pending: 0 });
    autoSubmitted.current = false;
    answerSync.current = null;
    if (userId)
      services.readAttempt(id, request.signal)
        .then(({ data, receivedAt }) => {
          if (!alive || !current()) return;
          if(!data||data.id!==id||!["active","submitted"].includes(data.status)||!Array.isArray(data.questions)||!Number.isFinite(Date.parse(data.serverNow))||!Number.isFinite(Date.parse(data.deadline)))throw new Error("Unconfirmed paper response.");
          if(!postLaunchPreview&&(data.resultsPending||data.examResultsPending||data.drawingUploadTasks?.length||data.questions.some(item=>!["mcq","msq","nat"].includes(item.kind))))throw new Error("This paper is outside the initial release.");
          const serverTime = Date.parse(data.serverNow);
          const deadline = Date.parse(data.deadline);
          const clientTime = Date.now();
          // Count the time spent confirming identity after the server replied.
          offset.current = serverTime - receivedAt;
          const verifiedServerTime = clientTime + offset.current;
          setNow(clientTime);
          pruneDeviceAnswers(userId, verifiedServerTime);
          const journal = createAttemptAnswerJournal({ userId, attemptId: id, deadline });
          const questionsById = new Map(data.questions.map(question => [question.id, question]));
          const queue = createAnswerSyncQueue({
            journal,
            revisionSeed: () => Date.now() + offset.current,
            send: async ({ questionId, answer, revision }) => {
              if (!alive || !navigator.onLine) throw new Error("Connection unavailable.");
              if (Date.now() + offset.current >= deadline) throw new Error("The answer window has closed.");
              const receipt = await rpc("save_answer_revision", { p_attempt_id: id, p_question_id: questionId, p_answer: answer, p_revision: revision },request.signal);
              const question = questionsById.get(questionId);
              if (!question || !validAttemptAnswer(question, receipt?.answer)) throw new Error("Couldn’t confirm the current saved answer.");
              return receipt;
            },
            onSaved: ({ questionId, answer, revision, accepted }) => {
              if (!alive || !current()) return;
              setAttempt((current) => current?.status === "active" ? {
                ...current,
                questions: current.questions.map((item) => item.id === questionId ? { ...item, answer, answerRevision: revision } : item),
              } : current);
              if (!accepted && shownQuestion.current === questionId && !queue.hasPending(questionId)) setDraft(answer);
            },
            onStatus: (state) => { if (alive && current()) setSyncState(state); },
          });
          answerSync.current = queue;
          setLoadedFor(`${userId}:${id}`);
          setAttempt(data);
          if (data.status === "active") {
            queue.restore(data.questions);
            if (queue.pendingCount() && navigator.onLine && verifiedServerTime < deadline) queue.flush();
          } else {
            queue.discard();
          }
if(postLaunchPreview){
          rpc("my_exam_mock_session", { p_attempt_id: id }, request.signal).then((value) => alive && current() && setExamSession(value)).catch(() => {});
          rpc("my_exam_mock_report", { p_attempt_id: id }, request.signal).then((value) => alive && current() && setExamReport(value)).catch(() => {});
}
        })
        .catch(() => {
          if (alive && current())
            setError(
              "This attempt is unavailable. Return to your workspace or try signing in again.",
            );
        });
    return () => {
      alive = false;request.abort();
      clearTimeout(saveTimer.current);
    };
  }, [userId, id, services]);
  useEffect(() => {
    const queued = q && answerSync.current?.hasPending(q.id) ? answerSync.current.pendingAnswer(q.id) : q?.answer;
    setDraft(queued ?? null);
    setSyncState((state) => state.pending ? state : { kind: "saved", pending: 0, error: null });
  }, [q?.id]);
  useEffect(() => {
    if (attempt?.status !== "active") return;
    const retry = () => {
      const clientTime = Date.now();
      setNow(clientTime);
      if (clientTime + offset.current < Date.parse(attempt.deadline)) {
        const queue=answerSync.current;
        // An online event can arrive while the old offline request is still
        // settling. Recheck once after that flight; never start a retry loop.
        void queue?.flush().then(result=>{
          if(!result.saved&&current()&&answerSync.current===queue&&navigator.onLine&&Date.now()+offset.current<Date.parse(attempt.deadline))void queue.flush();
        });
      } else {
        autoSubmitted.current = false;
        setReconnects((count) => count + 1);
      }
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [attempt?.status, attempt?.deadline, id]);
  useEffect(() => {
    if (
      attempt?.status !== "active" &&
      !(attempt?.status === "submitted" && attempt.uploadDeadline) &&
      examSession?.partBState !== "waiting"
    ) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [attempt?.status, attempt?.uploadDeadline, examSession?.partBState]);
  useEffect(() => {
    if (
      examSession?.partBState !== "waiting" ||
      now + offset.current < Date.parse(examSession.partBOpensAt)
    ) return;
    rpc("my_exam_mock_session", { p_attempt_id: id })
      .then(value=>{if(current())setExamSession(value);})
      .catch(() => {});
  }, [examSession?.partBState, examSession?.partBOpensAt, id, now]);
  useEffect(() => {
    if (confirm && !dialog.current?.open) dialog.current?.showModal();
  }, [confirm]);
  useEffect(() => {
    if (!attempt || attempt.resultsPending || attempt.examResultsPending || !attempt.questions.some(item => item.media?.length)) return;
    const request = new AbortController();
    const stillOpen = () => !request.signal.aborted && current();
    const fail = () => { if (stillOpen()) setMediaStatus("failed"); };
    services.functions.invoke("attempt-media", { body: { attemptId: id }, signal: request.signal })
      .then(({ data, error }) => {
        if (!stillOpen()) return;
        if (error || !data?.media) return fail();
        setMedia(data.media);
        setMediaStatus("loaded");
      }, fail);
    return () => request.abort();
  }, [attempt?.id, attempt?.status, attempt?.resultsPending, attempt?.examResultsPending, mediaRetry, services]);
  const retryFigures = () => {
    questionHeading.current?.focus();
    setMedia({});
    setBrokenFigures({});
    setMediaStatus("loading");
    setMediaRetry(value => value + 1);
  };
  const figures = item => <PaperFigures question={item} media={media} status={mediaStatus} broken={brokenFigures}
    onBroken={key => setBrokenFigures(value => ({...value, [key]: true}))} onRetry={retryFigures}/>;
  const previousIndex = useRef(0);
  useLayoutEffect(() => {
    if (index !== previousIndex.current) questionHeading.current?.focus();
    previousIndex.current = index;
  }, [index]);
  const left = attempt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(attempt.deadline).getTime() - now - offset.current) / 1000,
        ),
      )
    : 0;
  const record = (value, defer = false) => {
    if (!current() || !q || busy || Date.now() + offset.current >= Date.parse(attempt.deadline) || !validAttemptAnswer(q, value)) return;
    clearTimeout(saveTimer.current);
    answerSync.current?.enqueue(q.id, value, { defer });
    if (defer) {
      saveTimer.current = setTimeout(() => {
        if (Date.now() + offset.current < Date.parse(attempt.deadline)) answerSync.current?.flush();
      }, 500);
    }
  };
  const pick = (value) => {
    setDraft(value);
    record(value);
  };
  const typeAnswer = (value) => {
    setDraft(value);
    record(value === "" ? null : value, true);
  };
  const submit = async () => {
    if (!current() || mutationBusy.current) return;
    mutationBusy.current=true;
    const queue = answerSync.current;
    clearTimeout(saveTimer.current);
    setBusy(true);
    setError("");
    try {
      if (Date.now() + offset.current < Date.parse(attempt.deadline)) {
        const sync = await queue.flush();
        if (!current() || answerSync.current !== queue) return;
        if (!sync.saved && Date.now() + offset.current < Date.parse(attempt.deadline)) {
          setError("Your attempt is still open. Reconnect and select Submit again to save your waiting answers.");
          return;
        }
      }
      const result = await rpc("submit_attempt", { p_id: id });
      if(!result||result.id!==id||result.status!=="submitted"||!Array.isArray(result.questions)||!Number.isFinite(Date.parse(result.deadline)))throw new Error("Unconfirmed submission response.");
      if (!current() || answerSync.current !== queue) return;
      queue.discard();
      setAttempt(result);
if(postLaunchPreview){
      rpc("my_exam_mock_session",{p_attempt_id:id}).then(value=>{if(current())setExamSession(value);}).catch(()=>{});
      rpc("my_exam_mock_report",{p_attempt_id:id}).then(value=>{if(current())setExamReport(value);}).catch(()=>{});
}
      setConfirm(false);
      dialog.current?.close();
    } catch (e) {
      if (current() && answerSync.current === queue) setError("Couldn’t confirm submission. Reconnect and reopen this attempt to check its saved state before trying again.");
    } finally {
      mutationBusy.current=false;
      if (current() && answerSync.current === queue) setBusy(false);
    }
  };
  useEffect(() => {
    if (
      attempt?.status === "active" &&
      left === 0 &&
      !busy &&
      !autoSubmitted.current
    ) {
      autoSubmitted.current = true;
      submit();
    }
  }, [left, busy, attempt?.status, reconnects]);
  const startPartB=async partA=>{
    if(!current()||mutationBusy.current)return;mutationBusy.current=true;setBusy(true);setError("");
    try{const next=await rpc("start_exam_mock_part_b",{p_part_a_attempt:partA});
      if(typeof next!=="string"||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(next))throw new Error("Unconfirmed Part B response.");
      if(current())navigate(`/attempt/${next}`);
    }catch{if(current())setError("Couldn’t confirm Part B. Reopen this attempt to check the fixed session before trying again.");}
    finally{mutationBusy.current=false;if(current())setBusy(false);}
  };
  const move = (next) => {if(current()){setIndex(next);setVisited((v)=>new Set(v).add(next));}};
  if (!attempt || loadedFor !== `${userId}:${id}`)
    return (
      <section className="wrap page-intro">
        <h1>
          Your practice <em>space.</em>
        </h1>
        <p role={error ? "alert" : "status"}>
          {error || "Loading your attempt…"}
        </p>
        <Link to="/dashboard">← Back to workspace</Link>
      </section>
    );
  if (attempt.status === "submitted") {
    const uploadWindow = <DrawingUploadWindow attempt={attempt} serverTime={now + offset.current} invoke={drawingInvoke} />;
    if (attempt.resultsPending) return <PendingAttemptResult title={attempt.title} reviewEndsAt={attempt.reviewEndsAt}>{uploadWindow}</PendingAttemptResult>;
    if (attempt.examResultsPending && examSession?.partAAttemptId === attempt.id) return <section className="wrap section sample-result"><Link className="back-link" to="/dashboard">← Your workspace</Link><h1>Your Part A is <em>locked.</em></h1>{error&&<p className="error" role="alert">{error}</p>}<ExamPartTransition session={examSession} busy={busy} onStart={startPartB}/></section>;
    const cohort = attempt.cohortResult;
    return (
      <section className="wrap section sample-result analysis-workspace">
        <Link className="back-link" to={workspaceHref}>
          ← {demo ? "Your preview workspace" : "Your workspace"}
        </Link>
        <div className="result-title analysis-hero">
          <div>
            <span className="eyebrow">{attempt.title} / {demo ? "SAMPLE REPORT" : "YOUR REPORT"}</span>
            <h1>Paper analysis</h1>
            {cohort ? <p>All India rank {cohort.rank}. Objective marks {cohort.objectiveScore}/{cohort.objectiveTotal}.
              {cohort.drawingTotal > 0 && ` Drawing marks ${cohort.drawingScore}/${cohort.drawingTotal}.`}
            </p> : attempt.scoreKind === "drawing" ? <p>
              {attempt.examResultsPending ? "Drawing marks appear after the fixed upload window and teacher review." :
                "Your drawing marks include released teacher reviews. Missing submissions receive zero marks."}
            </p> : <p>
              {demo ? "Sample marks follow the original paper’s answer key." : "Objective answers are marked with the paper’s reviewed key."}
              {!demo && (postLaunchPreview?" Drawing is excluded from this score and remains a separate teacher-reviewed submission.":" This report covers the objective paper you submitted.")}
            </p>}
          </div>
          <div className="sample-score" role="group" aria-label={cohort ? "All India result" : attempt.scoreKind === "drawing" ? "Drawing result" : "Objective result"}>
            {attempt.examResultsPending ? <><span>—</span><p>full result pending</p></> : <>
            <span>
              {attempt.score}
              <i>/{attempt.total}</i>
            </span>
            <p>{cohort ? "All India marks" : attempt.scoreKind === "drawing" ? "drawing marks" : "objective marks"}</p>
            </>}
          </div>
        </div>
        {error&&<p className="error" role="alert">{error}</p>}
        {uploadWindow}
        {!attempt.examResultsPending && <>
        <AttemptInsights questions={attempt.questions} practicePath={practicePath} onReviewOutcome={value => {
          setReviewFilter(previous => ({outcome:value, revision:previous.revision + 1}));
          setReview(true);
          reviewHeading.current?.focus();
          reviewHeading.current?.scrollIntoView({block:"start"});
        }} />
        </>}
        <ExamSessionReport report={examReport} />
        <ExamPartTransition session={examSession} busy={busy} onStart={startPartB}/>
        {!attempt.examResultsPending && <div className="review-toggle analysis-review-heading">
          <h2 ref={reviewHeading} tabIndex={-1}>Question review</h2>
          <button
            className="text-button"
            aria-expanded={review}
            onClick={() => setReview(!review)}
          >
            {review ? "Close" : "Open"} answer review
          </button>
        </div>}
        {!attempt.examResultsPending && review && (
          <AnswerReview key={reviewFilter.revision} initialOutcome={reviewFilter.outcome} questions={attempt.questions} figures={figures}/>
        )}
        {onRestart && <button type="button" className="button quiet" onClick={onRestart}>Start a fresh sample paper</button>}
      </section>
    );
  }
  return (
    <section className="wrap sample-run attempt-workspace">
      <Link className="back-link" to={workspaceHref}>
        ← Your workspace
      </Link>
      <div className="runner-top attempt-masthead">
        <div>
          <span className="eyebrow">{demo ? "ORIGINAL DMOCKS SAMPLE" : "TIMED ATTEMPT"}</span>
          <h1>{attempt.title}</h1>
          <p className="attempt-summary">{attempt.questions.length} questions <i>·</i> {paperSections(attempt.questions).length} sections</p>
        </div>

      </div>
      {error && !confirm && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {left === 0 && error && (
        <button className="button" disabled={busy} onClick={submit}>
          Retry submission <Arrow />
        </button>
      )}
      {(() => {
        const sections = paperSections(attempt.questions).map(({kind,indices}) => ({kind, start: indices[0], end: indices.at(-1)}));
        const names = { nat: "Numerical answer (NAT)", msq: "Multiple select (MSQ)", mcq: "Multiple choice (MCQ)", drawing: "Drawing" };
        const here = sections.find((section) => index >= section.start && index <= section.end);
        const sample = attempt.questions[index];
        return (
          <nav className="exam-sections attempt-sections" aria-label="Sections">
            {sections.map((section) => {
              const total = section.end - section.start + 1;
              const done = attempt.questions.slice(section.start, section.end + 1).filter((item) => hasAnswer(answerFor(item))).length;
              return (
                <button key={section.start} type="button" disabled={busy} aria-current={section === here ? "true" : undefined} className={section === here ? "active" : ""} onClick={() => move(section.start)}>
                  <b>{section.kind.toUpperCase()}</b>
                  <small>{done}/{total} answered</small>
                </button>
              );
            })}
            {sample && sample.kind !== "drawing" && sample.marking && (
              <p className="section-rule">{names[sample.kind]} · +{sample.marking.correct} correct · {sample.marking.wrong} wrong{sample.kind === "msq" && sample.marking.partial ? " · partial marks for a correct subset" : ""}</p>
            )}
          </nav>
        );
      })()}
      <div className="attempt-clockbar">
        <b>Question {index + 1}<small> of {attempt.questions.length}</small></b>
        <div
          className="timer"
          role="timer"
          aria-live="off"
          aria-label="Time remaining"
        >
          <span>
            {Math.floor(left / 3600)
              .toString()
              .padStart(2, "0")}
            :{Math.floor(left / 60) % 60 < 10 ? "0" : ""}
            {Math.floor(left / 60) % 60}:
            {(left % 60).toString().padStart(2, "0")}
          </span>
          <small>remaining</small>
        </div>
      <a className="attempt-jump" href="#attempt-navigator" onClick={event => {event.preventDefault(); const nav = document.getElementById("attempt-navigator"); nav?.focus(); nav?.scrollIntoView({block:"start"});}}>Navigator ↓</a>
      </div>
      <div className="runner-layout attempt-layout">
        <article className="question-panel">
          <div className="question-meta">
            <span>
              QUESTION {index + 1} / {attempt.questions.length}
            </span>
            <span>
              {q.kind.toUpperCase()} · {q.topic}
            </span>
          </div>
          <h2 ref={questionHeading} tabIndex={-1}>{q.prompt}</h2>
          {q.kind !== "drawing" && (
            <p>
              +{q.marking.correct} for a correct answer · {q.marking.wrong} for
              a wrong answer
              {q.kind === "msq" && q.marking.partial
                ? " · Partial marks apply to a correct subset."
                : ""}
            </p>
          )}
          {figures(q)}
          {["mcq", "msq"].includes(q.kind) ? (
            <div
              className="live-choices"
              role="group"
              aria-labelledby={choiceInstructionId}
            >
              <p id={choiceInstructionId}>
                {q.kind === "msq" ? "Choose all that apply" : "Choose one answer"}
              </p>
              {q.options.map((option) => (
                <button
                  disabled={busy || left === 0}
                  key={option.id}
                  aria-pressed={
                    q.kind === "msq"
                      ? (draft ?? []).includes(option.id)
                      : draft === option.id
                  }
                  className={
                    (
                      q.kind === "msq"
                        ? (draft ?? []).includes(option.id)
                        : draft === option.id
                    )
                      ? "chosen"
                      : ""
                  }
                  onClick={() =>
                    pick(
                      q.kind === "msq"
                        ? (draft ?? []).includes(option.id)
                          ? draft.filter((value) => value !== option.id)
                          : [...(draft ?? []), option.id]
                        : option.id,
                    )
                  }
                >
                  <span>{option.id}</span>
                  {option.label}
                </button>
              ))}
            </div>
          ) : q.kind === "nat" ? (
            <label className="numeric-answer">
              Your numerical answer
              <input
                inputMode="decimal"
                value={draft ?? ""}
                maxLength={64}
                onChange={(e) => typeAnswer(e.target.value)}
                disabled={busy || left === 0}
              />
            </label>
          ) : (
            <>
              <div className="notice">
                Draw on paper within the time limit and upload clear ordered pages.
                A teacher can review submitted pages separately from the objective score.
              </div>
              <label className="drawing-note">
                Your self-review notes (optional)
                <textarea
                  value={draft ?? ""}
                  maxLength={4000}
                  onChange={(e) => typeAnswer(e.target.value)}
                  disabled={busy || left === 0}
                />
              </label>
              <DrawingUploads key={`${id}:${q.id}`} attemptId={id} questionId={q.id} invoke={drawingInvoke} />
            </>
          )}
          {["nat", "drawing"].includes(q.kind) && (
            <button
              className="button quiet save-answer"
              disabled={busy || left === 0 || !validAttemptAnswer(q, draft === "" ? null : draft)}
              onClick={() => record(draft === "" ? null : draft)}
            >
              Save answer <Arrow />
            </button>
          )}
          {q.kind === "nat" && draft && !validAttemptAnswer(q, draft) &&
            <p>Enter a whole number or decimal to save this answer.</p>}
          <p className="save-status" role="status">
            {syncState.kind === "saving" ? "Saving…" : syncState.pending
              ? syncState.deviceSaved ? "Answers saved on this device. Waiting to sync." : "Answers waiting to sync. Keep this page open."
              : demo ? "Sample answers saved in this tab." : "Answers are saved to your account."}
          </p>
          {syncState.pending > 0 && left > 0 && <button className="text-button" type="button" disabled={busy} onClick={() => answerSync.current.flush()}>Retry waiting answers</button>}
          {!demo && <QuestionReport
            key={q.id}
            disabled={busy}
            onSubmit={async({ reason, details }) => {
              try{return await rpc("report_attempt_question",{p_attempt_id:id,p_question_id:q.id,p_reason:reason,p_details:details});}
              catch(error){
                const message = error?.code === "question_report_limit"
                  ? "You’ve reached the hourly question report limit. Try again later."
                  : "Couldn’t confirm this report. Reconnect and try again.";
                throw new Error(message);
              }
            }}
          />}
          <div className="runner-actions">
            <button
              className="text-button"
              disabled={index === 0 || busy}
              onClick={() => move(index - 1)}
            >
              ← Previous
            </button>
            <button
              className="text-button"
              disabled={busy}
              aria-pressed={flagged.includes(q.id)}
              onClick={() =>
                setFlagged((items) =>
                  items.includes(q.id)
                    ? items.filter((value) => value !== q.id)
                    : [...items, q.id],
                )
              }
            >
              {flagged.includes(q.id) ? "Marked for review" : "Mark for review"}
            </button>
            {index < attempt.questions.length - 1 && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setFlagged((items) => (items.includes(q.id) ? items : [...items, q.id]));
                  move(index + 1);
                }}
              >
                Mark for review &amp; Next
              </button>
            )}
            <button
              className="text-button"
              disabled={busy || left === 0 || !hasAnswer(draft)}
              onClick={() => (["nat", "drawing"].includes(q.kind) ? typeAnswer("") : pick(q.kind === "msq" ? [] : null))}
            >
              Clear response
            </button>
            {index < attempt.questions.length - 1 ? (
              <button
                className="button"
                disabled={busy}
                onClick={() => {
                  if (["nat", "drawing"].includes(q.kind) && draft && validAttemptAnswer(q, draft)) record(draft);
                  move(index + 1);
                }}
              >
                Save &amp; Next <Arrow />
              </button>
            ) : (
              <button
                className="button"
                disabled={busy || left === 0}
                onClick={() => setConfirm(true)}
              >
                Review & submit <Arrow />
              </button>
            )}
          </div>
        </article>
        <PaperNavigation questions={attempt.questions} index={index} answered={item => hasAnswer(answerFor(item))}
          waiting={item => answerSync.current?.hasPending(item.id)} flagged={flagged} visited={visited}
          move={move} busy={busy} canSubmit={!busy && left > 0} onSubmit={() => setConfirm(true)}/>

      </div>
      {confirm && (
        <dialog
          ref={dialog}
          className="submit-dialog"
          onCancel={() => setConfirm(false)}
        >
          <span className="eyebrow">A MOMENT TO CHECK</span>
          <h2>Ready to submit?</h2>
          <p>
            {attempt.questions.filter((item) => hasAnswer(answerFor(item))).length}{" "}
            of {attempt.questions.length} answered. {flagged.length} marked to
            revisit.
          </p>
          <p>{attempt.reviewEndsAt
            ? "Submission locks your answers. Results appear after the cohort is released."
            : "Submission locks your answers."}</p>
          {error && <p className="error" role="alert">{error}</p>}
          <div>
            <button className="button" disabled={busy} onClick={submit}>
              Submit & view report <Arrow />
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                dialog.current.close();
                setConfirm(false);
              }}
            >
              Back to the questions
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}

export function AttemptSyncPreview() {
  const online = useRef(false);
  const queue = useRef(null);
  const [state, setState] = useState({ kind: "saved", pending: 0 });
  const [serverAnswer, setServerAnswer] = useState("—");
  const [serverRevision, setServerRevision] = useState("—");
  useEffect(() => {
    const journal = createAttemptAnswerJournal({ userId: "preview-user", attemptId: "preview-sync", deadline: 4102444800000 });
    queue.current = createAnswerSyncQueue({
      journal,
      revisionSeed: () => 100,
      send: async ({ answer, revision }) => {
        if (!online.current) throw new Error("offline fixture");
        setServerAnswer(answer);
        setServerRevision(revision);
        return { accepted: true, answer, revision };
      },
      onStatus: setState,
    });
    queue.current.restore([{ id: "q1", answerRevision: 0, kind: "mcq", options: [{ id: "B" }] }]);
  }, []);
  return <section className="wrap section admin-page">
    <span className="eyebrow">OFFLINE SYNC PREVIEW</span>
    <h1>Answers survive a <em>reconnect.</em></h1>
    <p role="status">{state.pending ? `${state.pending} answer waiting to sync.` : state.kind === "saving" ? "Saving…" : "All answers saved."}</p>
    <p>Server answer: <b>{serverAnswer}</b></p>
    <p>Server revision: <b>{serverRevision}</b></p>
    <button className="button" type="button" onClick={() => queue.current?.enqueue("q1", "B")}>Choose B while offline</button>
    {state.pending > 0 && <button className="button quiet" type="button" onClick={() => {
      online.current = true;
      queue.current.flush();
    }}>Reconnect and retry</button>}
  </section>;
}
