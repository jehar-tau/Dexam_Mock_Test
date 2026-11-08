import React, { useCallback, useEffect, useState } from "react";
import { useAdminFunctions } from "./AdminAccess.jsx";
import { bankReviewImages, deliveryAnswerLabel } from "./bank-review.js";
import { questionReviewInput } from "./question-quality.js";

async function loadReportedFigures(functions, report) {
  const { data, error } = await functions.invoke("reported-question-media", { body: { targetKey: report.targetKey, revision: report.revision } });
  if (error || data?.error) throw new Error("Private question figures could not be opened. Refresh the case and try again.");
  return data.images;
}

function ReportedQuestionReview({ selected, rpc, onClose, onChanged, loadMedia }) {
  const [report, setReport] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [images, setImages] = useState(null), [displayed, setDisplayed] = useState({}), [checked, setChecked] = useState(false);
  useEffect(() => {
    let current = true;
    rpc("admin_reported_question", { p_target_key: selected.targetKey, p_expected_revision: selected.revision })
      .then(data => { if (current) setReport(data); }).catch(failure => { if (current) setError(failure.message); });
    return () => { current = false; };
  }, [rpc, selected.targetKey, selected.revision]);
  const figures = async () => {
    setBusy(true);setError("");setImages(null);setDisplayed({});
    try { setImages(bankReviewImages(await loadMedia(report), report.media)); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const resolve = async event => {
    event.preventDefault();setError("");setBusy(true);
    try {
      const action = event.nativeEvent.submitter?.value;
      await rpc("admin_resolve_reported_question", questionReviewInput(report, action, String(new FormData(event.currentTarget).get("note"))));
      await onChanged();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const snapshot = report?.snapshot;
  const held = ["pending", "retired"].includes(report?.status);
  const figuresReady = report?.media.every(figure => images?.some(image => image.ordinal === figure.ordinal) && displayed[figure.ordinal]);
  return <section className="bank-question-review" aria-label="Reported version review">
    <div className="admin-actions"><h3 className="bank-review-key">{selected.sourceExternalKey || "Reported question"}</h3><button type="button" disabled={busy} onClick={onClose}>Close reported question</button></div>
    {error && <p role="alert" className="error">{error}</p>}
    {!report && !error && <p role="status">Opening the delivered question…</p>}
    {report && <>
      <p>{report.reportCount} unique students · {report.status} · {held ? report.quarantinesBank ? "Current bank source held" : "Hold applies to this delivered version" : "Report hold resolved; bank approval is separate"}</p>
      {snapshot ? <>
        <p className="bank-question-prompt">{snapshot.prompt}</p>
        {Array.isArray(snapshot.options) && snapshot.options.length > 0 && <ul className="bank-question-options">{snapshot.options.map((option, index) => <li key={index}><b>{option?.id}</b> {option?.label || "This option needs review."}</li>)}</ul>}
        <dl className="bank-answer-review"><dt>Delivered answer</dt><dd>{deliveryAnswerLabel(snapshot.key)}</dd><dt>Marking</dt><dd>{snapshot.marking?.humanReview ? "Human-reviewed drawing" : `Correct ${snapshot.marking?.correct} · Wrong ${snapshot.marking?.wrong}`}</dd></dl>
        {snapshot.explanation && <><h4>Explanation or rubric</h4><p className="bank-question-prompt">{snapshot.explanation}</p></>}
      </> : <p>This legacy case has no complete retained snapshot. It needs operator review before restoration.</p>}
      {report.media.length > 0 && <>
        {report.media.some(figure => !figure.available) && <p className="error">Some private figures need verification before restoration.</p>}
        <button type="button" disabled={busy} onClick={figures}>{images ? "Refresh reported figures" : "Open reported figures"}</button>
        {images && <div className="drawing-review-grid">{images.map(image => <figure key={image.ordinal}><img src={image.url} alt={`Reported question figure ${image.ordinal}`} referrerPolicy="no-referrer"
          onLoad={() => setDisplayed(current => ({ ...current, [image.ordinal]: true }))}
          onError={() => { setDisplayed(current => ({ ...current, [image.ordinal]: false }));setError("A reported figure could not be displayed. Refresh the figures."); }} /><figcaption>Figure {image.ordinal}</figcaption></figure>)}</div>}
      </>}
      <p>Decisions preserve existing attempts, scores and clocks. Restoring a bank source requires a separate content and rights approval before fresh practice can use it.</p>
      {report.sourceChanged && report.quarantinesBank && held && <p>A corrected canonical source has been imported. Releasing it keeps this reported version held and returns the source to fresh bank review.</p>}
      <form className="admin-form" onSubmit={resolve}>
        <label>Question review reason<textarea name="note" required minLength="8" maxLength="1000" rows="3" /></label>
        <label className="profile-check"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} /> I checked the delivered question, figures and answer.</label>
        <div className="admin-actions">
          {report.status !== "retired" && <button value="retire" disabled={busy}>Retire this version</button>}
          {report.status === "pending" && <button value="dismiss" disabled={busy || !snapshot || !checked || !figuresReady}>Dismiss reports</button>}
          {["pending", "retired"].includes(report.status) && <button value="restore" disabled={busy || !snapshot || !checked || !figuresReady}>Restore this version</button>}
          {report.sourceChanged && report.quarantinesBank && held && <button value="fix" disabled={busy}>Release corrected source for review</button>}
          {report.status !== "pending" && <button value="reopen" disabled={busy}>Reopen review hold</button>}
        </div>
      </form>
      <details><summary>Version and review history</summary><p className="bank-review-key">Delivered version <code>{report.contentVersion || "Legacy version unavailable"}</code></p>
        {report.audit.map((event, index) => <p key={index}>{event.action} · {event.reportCount} unique students · {event.note}</p>)}
      </details>
    </>}
  </section>;
}

export function ReportedQuestionQueue({ reports, rpc, onChanged, loadMedia }) {
  const functions = useAdminFunctions();
  const defaultMedia = useCallback(report => loadReportedFigures(functions, report), [functions]);
  const [selected, setSelected] = useState(null), [message, setMessage] = useState(""), [error, setError] = useState("");
  useEffect(() => { setSelected(null); }, [reports]);
  const refresh = async () => { setError("");try { await onChanged(); } catch (failure) { setError(failure.message); } };
  const resolved = async () => { setSelected(null);setMessage("Review recorded. Existing attempts are unchanged; bank approval is separate.");await refresh(); };
  return <section className="reported-question-queue bank-review-browser" aria-label="Reported questions">
    <h2>Reported questions</h2>
    <p>Unique student reports hold a delivered version from new attempts at the configured threshold. Ten reports raise its priority. A human reviews every restore, retirement or corrected-source release.</p>
    <button type="button" onClick={refresh}>Refresh question reports</button>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="error">{error}</p>}
    {selected && <ReportedQuestionReview key={`${selected.targetKey}:${selected.revision}`} selected={selected} rpc={rpc} onClose={() => setSelected(null)} onChanged={resolved} loadMedia={loadMedia??defaultMedia} />}
    <div className="admin-list">{reports.length ? reports.map(report => <article key={report.targetKey}>
      <b className="bank-review-key">{report.sourceExternalKey || report.targetKey}</b><span className="status-pill">{report.status} · {report.reportCount} unique students{report.priority === "high" ? " · High priority" : ""}</span>
      <p>{report.prompt}</p><small>{Object.entries(report.reasons || {}).map(([reason, count]) => `${reason}: ${count}`).join(" · ")}</small>
      <button type="button" onClick={() => { setMessage("");setSelected(report); }}>Review reported version {report.sourceExternalKey || report.targetKey}</button>
    </article>) : <p>No question has reached the report threshold.</p>}</div>
  </section>;
}
