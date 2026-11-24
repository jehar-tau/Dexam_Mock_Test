import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { platform } from "./platform.js";
import { PortalShell } from "./PortalShell.jsx";
import { AssessmentCatalogue } from "./AssessmentCatalogue.jsx";
import { allIndiaExamSelection, assessmentExams, validatePublicAllIndiaResults } from "./catalogue-data.js";
import { eventTiming, nextEventBoundary } from "./all-india-timing.js";
import "./practice-events.css";

async function rpc(name, args) {
  const { data, error } = await platform.rpc(name, args);
  if (error) throw error;
  return data;
}

const indianTime = { timeZone: "Asia/Kolkata" };
const when = value => new Date(value).toLocaleString("en-IN", { ...indianTime, dateStyle: "medium", timeStyle: "short" }) + " IST";
const stateLabels = {
  scheduled: "Scheduled", open: "Open for starts", closing: "Starts closed",
  review: "In review", released: "Released", paused: "Paused",
};

function eventDetails(event, now) {
  if (eventTiming(event, now).needsRefresh) return "The event window has changed. Refresh All India mocks to check its current status.";
  if (event.state === "paused") return "New starts are paused for question review. Existing attempts keep their original paper and clock.";
  if (event.state === "scheduled") return `Opens ${when(event.startsAt)}`;
  if (event.state === "open") return `Start before ${when(event.lastStartAt ?? event.endsAt)}`;
  if (event.state === "closing") return `Starts closed. The attempt window ends ${when(event.endsAt)}.`;
  if (event.state === "review") return `Results under review until ${when(event.reviewEndsAt)}`;
  if (!event.result) return "Results released.";
  const { rank, cohortSize, score, total } = event.result;
  return `Rank ${rank}${cohortSize ? ` of ${cohortSize}` : ""} · ${score}/${total} marks`;
}

function AllIndiaHeading({ headingRef, preview }) {
  return <header className="all-india-heading">
    <span className="all-india-kicker">All India mocks</span>
    <h1 ref={headingRef} tabIndex={-1}>One paper. One attempt.</h1>
    <p>{preview ? "Explore a fictional event schedule. Dates, attempts and ranks are examples."
      : "Check upcoming exam windows, open your existing attempt and find your released result."}</p>
  </header>;
}

function EventDate({ event }) {
  const date = { scheduled: event.startsAt, open: event.lastStartAt ?? event.endsAt,
    closing: event.endsAt, review: event.reviewEndsAt }[event.state];
  if (!date) return <span aria-hidden="true" className="all-india-date all-india-date-symbol">
    <svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8">
      {event.state === "released" ? <><path d="M4 26h24M6 24v-7h5v7m3 0V7h5v17m3 0V12h5v12" /></> : <path d="M10 8v16m12-16v16" />}
    </svg>
  </span>;
  const instant = new Date(date);
  return <span aria-hidden="true" className="all-india-date">
    <span>{instant.toLocaleString("en-IN", { ...indianTime, month: "short" })}</span>
    <strong>{instant.toLocaleString("en-IN", { ...indianTime, day: "2-digit" })}</strong>
  </span>;
}

function EventWindow({ event }) {
  const dates = [["Opens", event.startsAt], ["Last start", event.lastStartAt], ["Attempts close", event.endsAt],
    ["Review ends", event.reviewEndsAt]].filter(([, value]) => value);
  if (!dates.length) return null;
  return <details className="all-india-window"><summary>Window details</summary>
    <dl>{dates.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{when(value)}</dd></div>)}</dl>
  </details>;
}

function EventGuide() {
  return <aside className="all-india-guide"><h2>How events work</h2>
    <dl><div><dt>Before the cutoff</dt><dd>Start once per account. Everyone receives the same fixed paper.</dd></div>
      <div><dt>During your attempt</dt><dd>Your timer keeps running if you disconnect. Reopen your attempt to continue.</dd></div>
      <div><dt>After review</dt><dd>Your rank appears once results are released. Eligible students can choose to share their result under an alias. Reviewed questions may then enter exam-wise mocks.</dd></div></dl>
  </aside>;
}

export function AllIndiaView({ events, onStart, onShare, requestedExam, onSelectExam, heading = true, embedded = false,
  blocked = false, sharingBlocked = false, previewStarted, exampleResults, attemptHref = id => `/attempt/${id}` }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [readyId, setReadyId] = useState("");
  const readyDialog = useRef(null);
  const readyOpener = useRef(null);
  const starting = useRef(false);
  const [stateFilter, setStateFilter] = useState("");
  const preview = Boolean(exampleResults);
  const [now, setNow] = useState(() => preview ? Date.parse("2027-01-09T09:15:00+05:30") : Date.now());
  const { selectedExam, visibleEvents } = allIndiaExamSelection(events, requestedExam);
  const filteredEvents = visibleEvents.filter(event => !stateFilter || event.state === stateFilter);
  const readyEvent = events.find(event => event.id === readyId);
  useEffect(() => {
    if (!readyEvent || !readyDialog.current) return;
    const dialog = readyDialog.current;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [readyEvent]);
  useEffect(() => {
    if (preview) return;
    const boundary = nextEventBoundary(events, now);
    const timer = boundary == null ? null : window.setTimeout(() => setNow(Date.now()), Math.min(2_147_483_647, Math.max(0, boundary - Date.now() + 1)));
    const updateClock = () => setNow(Date.now());
    window.addEventListener("focus", updateClock);
    document.addEventListener("visibilitychange", updateClock);
    return () => {
      if (timer != null) window.clearTimeout(timer);
      window.removeEventListener("focus", updateClock);
      document.removeEventListener("visibilitychange", updateClock);
    };
  }, [events, now, preview]);
  const start = async id => {
    const event = events.find(item => item.id === id);
    if (starting.current || busy || blocked || !event || event.state !== "open" || event.attemptId) return;
    if (!preview && eventTiming(event, Date.now()).needsRefresh) {
      setReadyId("");
      setNow(Date.now());
      setMessage("The start cutoff has passed. Refresh All India mocks to check the event status.");
      return;
    }
    starting.current = true;
    setReadyId("");
    setBusy(id);
    setMessage("");
    try { await onStart(id); }
    catch (error) { setMessage(error.message); }
    finally { starting.current = false; setBusy(""); }
  };
  const closeReady = () => {
    setReadyId("");
    window.requestAnimationFrame(() => { if (readyOpener.current?.isConnected && !readyOpener.current.disabled) readyOpener.current.focus(); });
  };
  return <section className={embedded ? "catalogue-content all-india-content" : "section portal-module all-india"}>
    {heading && <AllIndiaHeading preview={preview} />}
    <div className="all-india-layout">
      <section className="all-india-agenda" aria-labelledby="all-india-agenda-title">
        <div className="all-india-toolbar"><h2 id="all-india-agenda-title">Event schedule</h2>
          <div className="all-india-filters">
          {onSelectExam && <label className="all-india-filter">Exam
            <select value={selectedExam} onChange={event => onSelectExam(event.target.value)}>
              <option value="">All exams</option>
              {assessmentExams.map(exam => <option key={exam} value={exam}>{exam.toUpperCase()}</option>)}
            </select></label>}
          <label className="all-india-filter">Status
            <select value={stateFilter} onChange={event => setStateFilter(event.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(stateLabels).map(([state, label]) => <option key={state} value={state}>{label}</option>)}
            </select></label>
          </div>
        </div>
        <div className="all-india-events all-india-list">
          {filteredEvents.length ? filteredEvents.map(event => <article key={event.id} className="all-india-event">
            <EventDate event={event} />
            <div className="all-india-event-body">
              <div className="all-india-event-meta"><span>{event.exam.toUpperCase()}</span>
                <span className={'all-india-state all-india-state-' + event.state}>{eventTiming(event, now).needsRefresh ? "Refresh status" : stateLabels[event.state]}</span></div>
              <h3>{event.title}</h3><p>{eventDetails(event, now)}</p>
              {event.state !== "released" && event.durationSeconds > 0 && <p>
                {event.durationSeconds / 60} minutes for the exam{event.uploadGraceSeconds > 0 ? `, plus ${event.uploadGraceSeconds / 60} minutes for drawing uploads.` : "."}
              </p>}
              {event.state !== "released" && <EventWindow event={event} />}
              {event.result?.sharing && onShare && <div className="all-india-sharing">
                <p id={`ranking-sharing-${event.id}`}>When you share, your generated alias, rank and marks may appear on the public site.
                  Your alias for this event is <b>{event.result.sharing.alias}</b>.</p>
                <button type="button" className="button quiet" disabled={sharingBlocked}
                  aria-describedby={`ranking-sharing-${event.id}`} onClick={() => onShare(event.id)}>
                  {event.result.sharing.shared ? "Stop public sharing" : "Share on public results"}
                </button>
              </div>}
              {event.attemptId ? (preview
                ? <><Link className="button quiet" to={attemptHref(event.attemptId)}>View attempt</Link><a className="all-india-result-link" href="#all-india-example-ranks">See example rankings →</a>
                  {event.state === "released" && <Link className="all-india-result-link" to="/exam-mocks-preview">See exam-wise mock example →</Link>}</>
                : <Link className="button quiet" to={attemptHref(event.attemptId)}>
                  {event.state === "released" ? "View attempt" : "Open attempt"}</Link>)
                : <button type="button" className={event.state === "open" ? "button" : "all-india-unavailable"}
                  disabled={event.state !== "open" || eventTiming(event, now).needsRefresh || Boolean(busy) || blocked || previewStarted === event.id}
                  onClick={click => { readyOpener.current = click.currentTarget; setMessage(""); setReadyId(event.id); }}>
                  {previewStarted === event.id ? "Preview started" : busy === event.id ? "Opening…" : eventTiming(event, now).needsRefresh ? "Refresh event status" : event.state === "open" ? "Start once" : "Unavailable"}
                </button>}
              {previewStarted === event.id && <p className="all-india-receipt" role="status">Preview attempt created once: {event.id}</p>}
            </div>
          </article>) : <p className="all-india-empty" role="status">{stateFilter ? "No events match these filters." : selectedExam
            ? `No ${selectedExam.toUpperCase()} All India mock is scheduled yet. Fresh questions will appear here after review.` : "No All India mock is scheduled yet. Fresh, reviewed questions will form one common paper for everyone."}</p>}
        </div>
        {message && <p className="error" role="alert">{message}</p>}
      </section>
      <div className="all-india-rail"><EventGuide />
        {exampleResults && <AllIndiaHighlights example={exampleResults.filter(item => !selectedExam || item.exam === selectedExam)} />}
      </div>
    </div>
    {readyEvent && <dialog ref={readyDialog} className="all-india-start-dialog" aria-labelledby="all-india-start-title"
      onCancel={cancel => { cancel.preventDefault(); closeReady(); }}>
      <h2 id="all-india-start-title">Ready to begin {readyEvent.title}?</h2>
      <p>You have one attempt for this event. The exam timer starts when you begin and keeps running if you disconnect.</p>
      <p>{readyEvent.durationSeconds / 60} minutes for the exam{readyEvent.uploadGraceSeconds > 0
        ? `, plus ${readyEvent.uploadGraceSeconds / 60} minutes for drawing uploads.` : "."}</p>
      <div className="all-india-start-actions">
        <button type="button" className="button quiet" onClick={closeReady}>Cancel</button>
        <button type="button" className="button" disabled={Boolean(busy) || blocked || (!preview && eventTiming(readyEvent, now).needsRefresh)}
          onClick={() => start(readyEvent.id)}>Begin timed attempt</button>
      </div>
    </dialog>}
  </section>;
}

function useExamFilter() {
  const [params, setParams] = useSearchParams();
  const selectExam = exam => {
    const next = new URLSearchParams(params);
    if (exam) next.set("exam", exam);
    else next.delete("exam");
    setParams(next);
  };
  return { requestedExam: params.get("exam"), onSelectExam: selectExam };
}

export function AllIndia() {
  const filter = useExamFilter();
  return <AssessmentCatalogue kind="allIndia" Heading={AllIndiaHeading} View={AllIndiaView} viewProps={filter} />;
}

export function AllIndiaHighlights({ example = null }) {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    if (example || !platform) return;
    let current = true;
    rpc("public_all_india_top_ten").then(validatePublicAllIndiaResults).then(results => {
      if (current) setEvents(results);
    }).catch(() => { if (current) setEvents([]); });
    return () => { current = false; };
  }, [example]);
  const rankings = example ?? events;
  if (!rankings.length) return null;
  return <section id={example ? "all-india-example-ranks" : undefined} tabIndex={example ? -1 : undefined}
    className={example ? "all-india-example-ranks" : "wrap section all-india-highlights"}>
    {example ? <h2>Example rankings</h2> : <><span className="eyebrow">ALL INDIA RESULTS</span>
      <h2>See where practice <em>leads.</em></h2></>}
    {rankings.map(event => <article key={event.eventId}><h3>{event.exam.toUpperCase()} · {event.title}</h3>
      <ol>{event.topTen.map(result => <li key={result.alias}>
        <b>#{result.rank}</b><span>{result.alias}</span><span>{result.score}/{result.total}</span>
      </li>)}</ol>
    </article>)}
  </section>;
}

export function AllIndiaPreview() {
  const [started, setStarted] = useState("");
  const filter = useExamFilter();
  const events = [
    { id: "open", exam: "uceed", title: "UCEED Part A All India Mock 01", state: "open",
      startsAt: "2027-01-01T10:00:00+05:30", lastStartAt: "2027-01-11T08:00:00+05:30",
      endsAt: "2027-01-11T10:00:00+05:30", reviewEndsAt: "2027-01-21T10:00:00+05:30", durationSeconds: 7200, uploadGraceSeconds: 0 },
    { id: "scheduled", exam: "nift", title: "NIFT GAT All India Mock 02", state: "scheduled",
      startsAt: "2027-01-16T10:00:00+05:30", lastStartAt: "2027-01-26T08:00:00+05:30",
      endsAt: "2027-01-26T10:00:00+05:30", reviewEndsAt: "2027-02-05T10:00:00+05:30", durationSeconds: 7200, uploadGraceSeconds: 0 },
    { id: "closing", exam: "ceed", title: "CEED Part A All India Mock 01", state: "closing",
      startsAt: "2026-12-30T10:00:00+05:30", lastStartAt: "2027-01-09T09:00:00+05:30",
      endsAt: "2027-01-09T10:00:00+05:30", reviewEndsAt: "2027-01-19T10:00:00+05:30", durationSeconds: 3600, uploadGraceSeconds: 0 },
    { id: "released", exam: "nift", title: "NIFT GAT All India Mock 01", state: "released", attemptId: "preview-result",
      result: { rank: 2, cohortSize: 24, score: 78, total: 100 } },
  ];
  const results = [{ eventId: "released", exam: "nift", title: "GAT Mock 01",
    topTen: [{ rank: 1, alias: "Candidate-A1B2C3", score: 86, total: 100 }, { rank: 2, alias: "Candidate-D4E5F6", score: 78, total: 100 }] }];
  return <PortalShell><AllIndiaView events={events} {...filter} previewStarted={started} onStart={setStarted} exampleResults={results} attemptHref={() => "/portal-preview/report"} /></PortalShell>;
}
