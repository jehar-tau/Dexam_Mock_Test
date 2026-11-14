import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PortalShell } from "./PortalShell.jsx";
import { AccountAccessBoundary, useAccountServices } from "./AccountAccess.jsx";
import { awaitAccountRequest } from "./account-request.js";
import { learningCatalogResponse, learningCompletionMessage, learningCompletionReceipt, learningLessonResponse, learningListMessage, learningReadMessage, learningUnavailable } from "./learning-reader.js";
import { useAuthState } from "./useAuth.js";
import { learningPracticeLink } from "./practice-context.js";
import { programmes } from "./learn/programmes/index.js";
import { loadProgress } from "./learn/programme-storage.js";
import { programmeSummary } from "./learn/programme-model.js";
function LearnHeading({headingRef}){return<><span className="eyebrow">LEARN, THEN PRACTISE</span><h1 ref={headingRef} tabIndex={headingRef?-1:undefined}>Build the idea.<br/>Then <em>use it.</em></h1><p>Short theory lessons connect directly to topic practice.</p></>;}
export function ProgrammeList({ actorId, linkFor }) {
  if (!programmes.length) return null;
  return <div className="programme-list" aria-label="Interactive programmes">
    <h2>Interactive programmes</h2>
    <p>Learn by folding, turning and building, then check yourself with generated questions.</p>
    <div className="learn-grid">
      {programmes.map(programme => {
        const summary = programmeSummary(programme, loadProgress(programme.slug, actorId));
        return <article key={programme.slug}>
          <span className="status-pill">{summary.completed === summary.total ? "completed" : programme.exams.map(e => e.toUpperCase()).join(" · ") + " · " + programme.topic}</span>
          <h3>{programme.title}</h3>
          <p>{programme.summary}</p>
          <p className="programme-meta">{summary.total} lessons · about {programme.minutes} minutes{summary.completed ? ` · ${summary.completed} of ${summary.total} complete` : ""}</p>
          <Link className="text-button" to={linkFor(programme)}>{summary.completed === 0 ? "Start programme" : summary.completed === summary.total ? "Review programme" : "Continue programme"} →</Link>
        </article>;
      })}
    </div>
  </div>;
}
export function LearnView({ lessons = [], progress, onOpen, onRefresh, busy = false, message = "", heading = true, programmeActor = null, programmeLink = null }) {
  return (
    <section className={heading?"wrap section learn-page":"learn-content"}>
      {heading&&<LearnHeading/>}
      {programmeActor && programmeLink && <ProgrammeList actorId={programmeActor} linkFor={programmeLink} />}
      {progress && (
        <div className="learning-progress" aria-label="Learning progress">
          <div>
            <strong>{progress.percent}% complete</strong>
            <span>{progress.completed} of {progress.total} lessons</span>
          </div>
          <progress value={progress.completed} max={Math.max(progress.total, 1)}>
            {progress.percent}%
          </progress>
          {progress.recommendation && (
            <p>
              <b>Recommended next: {progress.recommendation.title}</b><br />
              {progress.recommendation.reason}
            </p>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {onRefresh && <button className="button quiet" disabled={busy} onClick={onRefresh}>Refresh lessons</button>}
      {programmeActor && <h2>Theory lessons</h2>}
      {lessons.length === 0 && !message && <p>No theory lessons have been published yet.</p>}
      <div className="learn-grid">
        {lessons.map((l) => (
          <article key={l.id}>
            <span className="status-pill">
              {l.completed
                ? "completed"
                : l.exam.toUpperCase() + " · " + l.topic}
            </span>
            <h2>{l.title}</h2>
            {progress?.recommendation?.id === l.id && <span className="recommended-label">Recommended next</span>}
            <p>{l.summary}</p>
            <button className="text-button" disabled={busy} onClick={() => onOpen(l)}>
              {l.completed ? "Review lesson" : "Start lesson"} →
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
export function Learn() {
  const { session, loading } = useAuthState();
  const location=useLocation(),heading=useRef(null),scopeKey=(session?.user.id??'signed-out')+':'+location.key,previous=useRef(scopeKey);
  useLayoutEffect(()=>{if(previous.current!==scopeKey&&(document.activeElement===document.body||heading.current?.parentElement.contains(document.activeElement)))heading.current?.focus();previous.current=scopeKey;},[scopeKey]);
  if (loading) return <p className="wrap" role="status">Checking your account…</p>;
  if (!session)
    return (
      <section className="wrap section">
        <h1>
          Sign in to <em>learn.</em>
        </h1>
        <Link to="/account">Student sign in</Link>
      </section>
    );
  return <PortalShell><section className="wrap section learn-page"><LearnHeading headingRef={heading}/><AccountAccessBoundary key={scopeKey} kind="learn" actorId={session.user.id} headingRef={heading}><StudentLearn headingRef={heading} actorId={session.user.id}/></AccountAccessBoundary></section></PortalShell>;
}

function StudentLearn({headingRef,actorId}) {
 const{rpc,isCurrent}=useAccountServices(),[catalog,setCatalog]=useState(null),[lesson,setLesson]=useState(null),[selection,setSelection]=useState(null),[busy,setBusy]=useState(false),[reading,setReading]=useState(false),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const lifetime=useRef(null),catalogRequest=useRef(null),action=useRef(null),lessonHeading=useRef(null),focusLesson=useRef(false),focusCatalog=useRef(false);
 useLayoutEffect(()=>{const controller=new AbortController();lifetime.current=controller;return()=>{controller.abort();catalogRequest.current?.abort();action.current?.abort();};},[]);
 const active=()=>!lifetime.current.signal.aborted&&isCurrent();
 useLayoutEffect(()=>{if(focusLesson.current&&lesson&&!busy){focusLesson.current=false;lessonHeading.current?.focus();}if(focusCatalog.current&&!selection){focusCatalog.current=false;headingRef.current?.focus();}},[lesson,busy,selection,headingRef]);
 const loadCatalog=async(keep='')=>{
  if(!active())return false;catalogRequest.current?.abort();const controller=new AbortController();catalogRequest.current=controller;setCatalog(null);setReading(true);setMessage(keep);
  const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),20000),signal=AbortSignal.any([lifetime.current.signal,controller.signal,timeout.signal]),current=()=>active()&&catalogRequest.current===controller&&!controller.signal.aborted;
  try{const[lessons,progress]=await awaitAccountRequest(()=>Promise.all([rpc('learning_catalog',{},signal),rpc('learning_progress',{},signal)]),signal),next=learningCatalogResponse(lessons,progress);if(current()){setCatalog(next);return true;}return false;}
  catch{if(current())setMessage(keep?'This lesson is no longer available. Refresh lessons to try again.':learningListMessage);return false;}
  finally{clearTimeout(timer);if(current()){catalogRequest.current=null;setReading(false);}}
 };
 useEffect(()=>{void loadCatalog();},[rpc]);
 const unavailable=()=>{setLesson(null);setSelection(null);setUncertain(false);focusCatalog.current=true;void loadCatalog('This lesson is no longer available.');};
 const open=async item=>{
  if(!active()||action.current)return;const snapshot={id:item.id,slug:item.slug},controller=new AbortController();action.current=controller;setSelection(snapshot);setLesson(null);setBusy(true);setMessage('');setUncertain(false);
  const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),20000),signal=AbortSignal.any([lifetime.current.signal,controller.signal,timeout.signal]),current=()=>active()&&action.current===controller&&!controller.signal.aborted;
  try{const value=learningLessonResponse(await awaitAccountRequest(()=>rpc('read_learning_lesson',{p_slug:snapshot.slug},signal),signal),snapshot);if(current()){setLesson(value);focusLesson.current=true;}}
  catch(error){if(current()){if(learningUnavailable(error))unavailable();else setMessage(learningReadMessage);}}
  finally{clearTimeout(timer);if(action.current===controller){action.current=null;if(active())setBusy(false);}}
 };
 const complete=async()=>{
  if(!active()||action.current||!lesson||lesson.completed||uncertain)return;const snapshot={id:lesson.id,slug:lesson.slug},controller=new AbortController();action.current=controller;setBusy(true);setMessage('');
  const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),20000),signal=AbortSignal.any([lifetime.current.signal,controller.signal,timeout.signal]),current=()=>active()&&action.current===controller&&!controller.signal.aborted;
  try{
   learningCompletionReceipt(await awaitAccountRequest(()=>rpc('complete_learning_lesson',{p_lesson_id:snapshot.id},signal),signal));
   const saved=learningLessonResponse(await awaitAccountRequest(()=>rpc('read_learning_lesson',{p_slug:snapshot.slug},signal),signal),snapshot);if(!saved.completed)throw new Error('Unconfirmed progress');
   if(current()){setLesson(saved);setUncertain(false);const refreshed=await loadCatalog();if(current())setMessage(refreshed?'Lesson complete. Your progress is saved.':'Lesson complete. Refresh lessons to update your progress.');}
  }catch(error){if(current()){if(learningUnavailable(error))unavailable();else{setUncertain(true);setMessage(learningCompletionMessage);}}}
  finally{clearTimeout(timer);if(action.current===controller){action.current=null;if(active())setBusy(false);}}
 };
 const back=()=>{if(action.current)return;setSelection(null);setLesson(null);setMessage('');setUncertain(false);focusCatalog.current=true;void loadCatalog();};
 const practice=learningPracticeLink(lesson);
 if(selection)return<section className="lesson" aria-label="Theory lesson">
  <button className="text-button" type="button" disabled={busy} onClick={back}>← All lessons</button>
  {lesson&&<><span className="eyebrow">{lesson.exam} · {lesson.topic}</span><h2 ref={lessonHeading} tabIndex={-1}>{lesson.title}</h2><p className="lesson-body">{lesson.body}</p></>}
  {busy&&!lesson&&<p role="status">Loading this lesson…</p>}{message&&<p role="status">{message}</p>}
  <button className="button quiet" type="button" disabled={busy} onClick={()=>void open(selection)}>Reload lesson</button>{' '}
  {lesson&&<><button className="button" type="button" disabled={busy||uncertain||lesson.completed} onClick={()=>void complete()}>{lesson.completed?'Lesson complete':'Mark complete'}</button>{' '}<Link to={practice.to}>{practice.label} →</Link></>}
 </section>;
 return<LearnView heading={false} lessons={catalog?.lessons} progress={catalog?.progress} message={message||(reading?'Loading theory lessons…':'')} busy={busy||reading} onRefresh={()=>void loadCatalog()} onOpen={item=>void open(item)} programmeActor={actorId} programmeLink={programme=>`/dashboard/learn/programme/${programme.slug}`}/>;
}
export function LearnPreview() {
  const [m, setM] = useState("");
  return (
    <PortalShell><LearnView
      lessons={[
        {
          id: "1",
          exam: "uceed",
          topic: "observation",
          title: "Notice before you decide",
          summary: "Separate what you see from what you assume.",
          completed: false,
        },
        {
          id: "2",
          exam: "uceed",
          topic: "visualisation",
          title: "Turn forms in your mind",
          summary: "Practise rotations before choosing an answer.",
          completed: true,
        },
      ]}
      progress={{
        total: 2,
        completed: 1,
        percent: 50,
        recommendation: {
          id: "1",
          title: "Notice before you decide",
          reason: "Recommended from your 40% accuracy across 5 answered observation questions.",
        },
      }}
      message={m}
      onOpen={(l) => setM(`Preview lesson opened: ${l.title}`)}
      programmeActor="preview"
      programmeLink={(programme) => `/learn-programme-preview/${programme.slug}`}
    /></PortalShell>
  );
}
