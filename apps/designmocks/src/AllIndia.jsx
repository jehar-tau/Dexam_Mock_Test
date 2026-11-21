import React,{useEffect,useState} from "react";
import {Link, useSearchParams} from "react-router-dom";
import {platform} from "./platform.js";
import {PortalShell} from "./PortalShell.jsx";
import {AssessmentCatalogue} from "./AssessmentCatalogue.jsx";
import {allIndiaExamSelection, assessmentExams, validatePublicAllIndiaResults} from "./catalogue-data.js";

async function rpc(name,args){const {data,error}=await platform.rpc(name,args);if(error)throw error;return data;}
const when=(value)=>new Date(value).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});

function eventDetails(event) {
  if (event.state === "paused") return "New starts are paused for question review. Existing attempts keep their original paper and clock.";
  if (event.state === "scheduled") return `Opens ${when(event.startsAt)}`;
  if (event.state === "open") return `Start before ${when(event.lastStartAt ?? event.endsAt)}`;
  if (event.state === "closing") return `Starts closed. The attempt window ends ${when(event.endsAt)}.`;
  if (event.state === "review") return `Results under review until ${when(event.reviewEndsAt)}`;
  if (!event.result) return "Results released.";
  const { rank, cohortSize, score, total } = event.result;
  return `Rank ${rank}${cohortSize ? ` of ${cohortSize}` : ""} · ${score}/${total} marks`;
}

function AllIndiaHeading({headingRef}){return<><span className="eyebrow">ALL INDIA MOCKS</span><h1 ref={headingRef} tabIndex={-1}>One paper. One <em>attempt.</em></h1><p>Every candidate receives the same frozen paper. The exam timer continues through disconnects, and ranks stay hidden until results are released.</p></>;}
export function AllIndiaView({ events, onStart, onShare, requestedExam, onSelectExam, attemptHref = id => `/attempt/${id}`, heading=true, embedded=false, blocked=false, sharingBlocked=false }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const { selectedExam, visibleEvents } = allIndiaExamSelection(events, requestedExam);
  const start = async (id) => {
    if(busy||blocked)return;
    setBusy(id);
    setMessage("");
    try { await onStart(id); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(""); }
  };
  return <section className={embedded?"catalogue-content":"section portal-module all-india"}>
    {heading&&<AllIndiaHeading/>}
    {onSelectExam && <label className="all-india-exam-filter">
      Exam
      <select value={selectedExam} onChange={event => onSelectExam(event.target.value)}>
        <option value="">All exams</option>
        {assessmentExams.map(exam => <option key={exam} value={exam}>{exam.toUpperCase()}</option>)}
      </select>
    </label>}
    <div className="all-india-list">
      {visibleEvents.length ? visibleEvents.map((event) => <article key={event.id}>
        <div>
          <span className="eyebrow">{event.exam.toUpperCase()} · {event.state}</span>
          <h2>{event.title}</h2>
          <p>{eventDetails(event)}</p>
          {event.state !== "released" && event.uploadGraceSeconds > 0 && (
            <p>{event.durationSeconds / 60} minutes for the exam, plus {event.uploadGraceSeconds / 60} minutes for drawing uploads.</p>
          )}
          {event.result?.sharing && onShare && (
            <div className="all-india-sharing">
              <p id={`ranking-sharing-${event.id}`}>
                When you share, your generated alias, rank and marks may appear on the public site.
                Your alias for this event is <b>{event.result.sharing.alias}</b>.
              </p>
              <button type="button" className="button quiet" disabled={sharingBlocked}
                aria-describedby={`ranking-sharing-${event.id}`} onClick={() => onShare(event.id)}>
                {event.result.sharing.shared ? "Stop public sharing" : "Share on public results"}
              </button>
            </div>
          )}
        </div>
        {event.attemptId ? <Link className="button quiet" to={attemptHref(event.attemptId)}>
          {event.state === "released" ? "View attempt" : "Open attempt"}
        </Link> : <button type="button" className="button" disabled={event.state !== "open" || Boolean(busy) || blocked}
          onClick={() => start(event.id)}>
          {busy === event.id ? "Opening…" : event.state === "open" ? "Start once" : "Unavailable"}
        </button>}
      </article>) : <div className="notice" role="status">{selectedExam
        ? `No ${selectedExam.toUpperCase()} All India mocks are listed yet.`
        : "No All India mock has been scheduled yet."}</div>}
    </div>
    {message && <p className="error" role="alert">{message}</p>}
  </section>;
}

export function AllIndia() {
  const [params, setParams] = useSearchParams();
  const selectExam = exam => {
    const next = new URLSearchParams(params);
    if (exam) next.set("exam", exam);
    else next.delete("exam");
    setParams(next);
  };
  return <AssessmentCatalogue kind="allIndia" Heading={AllIndiaHeading} View={AllIndiaView}
    viewProps={{ requestedExam: params.get("exam"), onSelectExam: selectExam }} />;
}

export function AllIndiaHighlights({ example = null }) {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    if (example || !platform) return;
    let current = true;
    rpc("public_all_india_top_ten").then(validatePublicAllIndiaResults).then(results => {
      if (current) setEvents(results);
    }).catch(() => {
      if (current) setEvents([]);
    });
    return () => { current = false; };
  }, [example]);
  const rankings = example ?? events;
  if (!rankings.length) return null;
  return <section className="wrap section all-india-highlights">
    <span className="eyebrow">ALL INDIA RESULTS</span>
    <h2>See where practice <em>leads.</em></h2>
    {rankings.map(event => <article key={event.eventId}>
      <h3>{event.exam.toUpperCase()} · {event.title}</h3>
      <ol>{event.topTen.map((result, index) => <li key={index}>
        <b>#{result.rank}</b><span>{result.alias}</span><span>{result.score}/{result.total}</span>
      </li>)}</ol>
    </article>)}
  </section>;
}

export function AllIndiaPreview() {
  const [message, setMessage] = useState("");
  const now = Date.now();
  const events = [
    { id: "scheduled", exam: "nid", title: "NID All India Mock 01", state: "scheduled", startsAt: new Date(now + 86400000) },
    { id: "open", exam: "uceed", title: "UCEED All India Mock 01", state: "open",
      lastStartAt: new Date(now + 9 * 86400000 - 4500000), durationSeconds: 3600, uploadGraceSeconds: 900 },
    { id: "closing", exam: "ceed", title: "CEED All India Mock 01", state: "closing",
      endsAt: new Date(now + 600000), durationSeconds: 3600, uploadGraceSeconds: 600 },
    { id: "released", exam: "nift", title: "Your NIFT cohort", state: "released", attemptId: "preview-result",
      result: { rank: 2, cohortSize: 24, score: 27, total: 30 } },
  ];
  const results = [{ eventId: "released", exam: "nift", title: "NIFT All India Mock 01",
    topTen: [{ rank: 1, alias: "Candidate-A1B2C3", score: 28, total: 30 }, { rank: 2, alias: "Candidate-D4E5F6", score: 27, total: 30 }] }];
  return <><PortalShell>
    <AllIndiaView events={events} onStart={async (id) => setMessage(id)} attemptHref={() => "/portal-preview/report"} />
    {message && <p className="wrap" role="status">Preview attempt created once: {message}</p>}
  </PortalShell><AllIndiaHighlights example={results} /></>;
}
