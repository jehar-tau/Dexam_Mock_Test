import React, { useCallback, useEffect, useRef, useState } from "react";
import { termsVersion } from "./platform.js";

// Owner decision, 28 November 2026: All India mocks run owner-approved
// original papers. The operator stages each paper privately; the admin then
// schedules it here with its window, results date and seat cap.
const indianDate = value => new Date(value).toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
}) + " IST";
const istInput = value => new Date(value + ":00+05:30").toISOString();
const minutes = seconds => Math.round(seconds / 60);

export function AdminAllIndia({ rpc, events, onChanged, reportError, legacy = null }) {
  const [papers, setPapers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const services = useRef({ rpc, reportError });
  services.current = { rpc, reportError };
  const loadPapers = useCallback(async () => {
    try { setPapers(await services.current.rpc("admin_all_india_papers")); }
    catch (error) { services.current.reportError(error); }
  }, []);
  useEffect(() => { void loadPapers(); }, [loadPapers]);
  const unscheduled = papers.filter(paper => !paper.eventId);
  const run = async action => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try { await action(); await Promise.all([onChanged(), loadPapers()]); }
    catch (error) { reportError(error); }
    finally { setBusy(false); }
  };
  const schedule = event => {
    event.preventDefault();
    const element = event.currentTarget, form = new FormData(element);
    const cap = String(form.get("seatCap") ?? "").trim();
    return run(async () => {
      await rpc("admin_schedule_all_india_paper", {
        p_paper_key: form.get("paperKey"), p_title: form.get("title"),
        p_starts_at: istInput(form.get("startsAt")), p_ends_at: istInput(form.get("endsAt")),
        p_results_at: istInput(form.get("resultsAt")),
        p_seat_cap: cap ? Number(cap) : null, p_entry: form.get("entry"),
      });
      element.reset();
      setNotice("Event scheduled. Students see it once the All India release is on.");
    });
  };
  const setSeats = (id, value) => run(async () => {
    const cap = String(value ?? "").trim();
    await rpc("admin_set_all_india_seat_cap", { p_event_id: id, p_seat_cap: cap ? Number(cap) : null });
    setNotice("Seat cap updated.");
  });
  const publishTopTen = (id, form) => run(async () => {
    await rpc("admin_open_all_india_ranking_publication", { p_event_id: id,
      p_policy_version: String(form.get("policyVersion") ?? "").trim(), p_evidence: String(form.get("evidence") ?? "").trim() });
    setNotice("The public top ten is open. Students in the top ten can now choose to show their alias.");
  });
  const release = id => run(async () => {
    await rpc("admin_release_all_india_results", { p_event_id: id });
    setNotice("Results released. Ranks and the top-ten board are now visible.");
  });
  return <section aria-labelledby="admin-all-india-title" className="admin-all-india">
    <h2 id="admin-all-india-title">All India mock events</h2>
    <p>Each event runs one owner-approved paper with its own timer. Every student sits once, at any time in the window.
      Results can be released after the results date, once every drawing has a teacher&apos;s mark.</p>
    <button type="button" onClick={() => run(async () => {})} disabled={busy}>Refresh event status</button>
    {notice && <p role="status">{notice}</p>}
    <h3>Staged papers</h3>
    {papers.length ? <ul className="admin-list">{papers.map(paper => <li key={paper.paperKey}>
      <b>{paper.paperKey}</b> · {paper.title} · {paper.objectiveCount} objective, {paper.drawingCount} drawing ·{" "}
      {paper.totalMarks} marks · {minutes(paper.durationSeconds)} minutes
      {paper.uploadGraceSeconds > 0 ? ` + ${minutes(paper.uploadGraceSeconds)} for uploads` : ""}
      {paper.eventId ? " · scheduled" : " · not scheduled"}
    </li>)}</ul> : <p>No paper is staged yet. The operator stages each approved paper with scripts/all-india-paper.mjs.</p>}
    {unscheduled.length > 0 && <form className="admin-form" onSubmit={schedule} aria-label="Schedule an All India paper">
      <label>Paper
        <select name="paperKey" required>{unscheduled.map(paper =>
          <option key={paper.paperKey} value={paper.paperKey}>{paper.paperKey}</option>)}</select>
      </label>
      <label>Event title<input name="title" required minLength="5" maxLength="140" /></label>
      <label>Window opens (IST)<input name="startsAt" type="datetime-local" required /></label>
      <label>Window closes (IST)<input name="endsAt" type="datetime-local" required /></label>
      <label>Results date (IST)<input name="resultsAt" type="datetime-local" required /></label>
      <label>Seat cap (empty for no cap)<input name="seatCap" type="number" min="1" max="100000" /></label>
      <label>Who can sit it
        <select name="entry" defaultValue="free">
          <option value="free">Any signed-in student (free account)</option>
          <option value="pass">Pass holders only</option>
        </select>
      </label>
      <button className="button" disabled={busy}>Schedule event</button>
    </form>}
    <h3>Events</h3>
    <div className="admin-list">
      {events.map(event => <article key={event.id}>
        <b>{event.exam.toUpperCase()} · {event.title}</b>
        <span className="status-pill">{event.resultsReleasedAt ? "released" : `${event.attempts} started`}</span>
        <p>Window: {indianDate(event.startsAt)} – {indianDate(event.endsAt)}. Results date: {indianDate(event.reviewEndsAt)}.</p>
        {event.paperKey && <p>
          Paper {event.paperKey} · {event.entry === "free" ? "free entry" : "pass holders"} ·{" "}
          {event.seatCap ? `${event.seatsTaken} of ${event.seatCap} seats taken` : `${event.seatsTaken} registered, no cap`} ·{" "}
          {event.submitted} submitted{event.paperReady === false ? " · paper not ready: check private figures" : ""}
        </p>}
        {!event.resultsReleasedAt && <>
          <p>{event.pendingDrawingReviews} drawing reviews remaining.</p>
          {event.paperKey && <form className="admin-inline" onSubmit={submit => {
            submit.preventDefault();
            void setSeats(event.id, new FormData(submit.currentTarget).get("seatCap"));
          }}>
            <label>Seat cap<input name="seatCap" type="number" min="1" max="100000" defaultValue={event.seatCap ?? ""} /></label>
            <button type="submit" disabled={busy}>Save seats</button>
          </form>}
          <button type="button" disabled={!event.canRelease || busy} onClick={() => release(event.id)}>
            Release reviewed results
          </button>
        </>}
        {event.resultsReleasedAt && <form className="admin-inline" aria-label={`Open the public top ten for ${event.title}`} onSubmit={submit => {
          submit.preventDefault();
          void publishTopTen(event.id, new FormData(submit.currentTarget));
        }}>
          <label>Policy version<input name="policyVersion" required defaultValue={termsVersion ?? ""} /></label>
          <label>Approval reference<input name="evidence" required minLength="8" maxLength="2000"
            placeholder="Owner approval, date" /></label>
          <button type="submit" disabled={busy}>Open public top ten</button>
        </form>}
      </article>)}
    </div>
    {legacy}
  </section>;
}
