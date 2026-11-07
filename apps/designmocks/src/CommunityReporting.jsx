import React, { useId, useLayoutEffect, useRef, useState } from "react";
import { communityReportAcknowledged, communityReportFailure, communityReportInput, communityReportReasons, communityReportTarget } from "./community-report.js";

function CommunityReportingSession({ target, onSubmit, onClose, valid }) {
  const reasonId = useId(), detailsId = useId(), titleId = useId(), helpId = useId();
  const [reason, setReason] = useState("other"), [details, setDetails] = useState("");
  const [phase, setPhase] = useState("editing"), [message, setMessage] = useState(valid ? "" : "Choose one discussion or reply to report.");
  const pending = useRef(null), dialog = useRef(null), reasonInput = useRef(null), acknowledgement = useRef(null);
  const scope = useRef(null), closed = useRef(false), inFlight = useRef(false), sequence = useRef(0);
  useLayoutEffect(() => {
    const controller = new AbortController(); scope.current = controller; closed.current = false;
    if (!dialog.current.open) dialog.current.showModal();
    reasonInput.current?.focus();
    return () => { closed.current = true; controller.abort(); sequence.current++; };
  }, []);
  useLayoutEffect(() => { if (phase === "saved" || phase === "exists") acknowledgement.current?.focus(); }, [phase]);
  const current = (controller, request) => !closed.current && !controller.signal.aborted && scope.current === controller && sequence.current === request;
  const close = () => {
    if (closed.current) return;
    closed.current = true; sequence.current++; scope.current?.abort();
    if (dialog.current?.open) dialog.current.close();
    onClose();
  };
  const send = async event => {
    event.preventDefault();
    const controller = scope.current;
    if (!valid || !controller || closed.current || controller.signal.aborted || inFlight.current || phase === "saved" || phase === "exists") return;
    let payload = pending.current;
    if (!payload) {
      const validationSequence = sequence.current;
      try { payload = communityReportInput(target, reason, details); }
      catch (failure) {
        const safe = await communityReportFailure(failure);
        if (current(controller, validationSequence)) setMessage(safe.message);
        return;
      }
    }
    pending.current = payload;
    const request = ++sequence.current;
    inFlight.current = true; setPhase("sending"); setMessage("");
    try {
      const result = await onSubmit(payload, controller.signal);
      if (!current(controller, request)) return;
      if (communityReportAcknowledged(result)) {
        setPhase("saved"); setMessage("Report sent for moderator review.");
      } else {
        const safe = await communityReportFailure();
        if (current(controller, request)) { setPhase("unconfirmed"); setMessage(safe.message); }
      }
    } catch (failure) {
      const safe = await communityReportFailure(failure);
      if (!current(controller, request)) return;
      setMessage(safe.message);
      if (safe.kind === "exists") setPhase("exists");
      else if (safe.kind === "rejected") { pending.current = null; setPhase("editing"); }
      else setPhase("unconfirmed");
    } finally { if (current(controller, request)) inFlight.current = false; }
  };
  const received = phase === "saved" || phase === "exists";
  const frozen = phase === "sending" || phase === "unconfirmed";
  function containTab(event) {
    if (event.key !== "Tab") return;
    const controls = [...dialog.current.querySelectorAll("button,select,textarea,input,[tabindex]")]
      .filter(element => !element.matches(":disabled") && element.tabIndex >= 0 && element.getClientRects().length);
    const first = controls[0], last = controls.at(-1), active = document.activeElement;
    if (!first) return;
    if (!controls.includes(active) || (event.shiftKey ? active === first : active === last)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    }
  }
  return <dialog ref={dialog} className="submit-dialog community-report-dialog" aria-labelledby={titleId} aria-describedby={helpId}
    onCancel={event => { event.preventDefault(); close(); }} onClose={close} onKeyDown={containTab}
    style={{ maxHeight: "calc(100dvh - 2rem)", overflow: "auto", overflowWrap: "anywhere" }}>
    <h2 id={titleId}>Report community content</h2>
    <p id={helpId}>A moderator will review this discussion or reply.</p>
    {typeof target?.label === "string" && target.label && <p className="bank-question-prompt">Reporting: {target.label}</p>}
    {message && <p ref={acknowledgement} role={received || phase === "unconfirmed" ? "status" : "alert"} tabIndex={received ? -1 : undefined}
      className={received || phase === "unconfirmed" ? "notice" : "error"}>{message}</p>}
    {!received && <form className="admin-form" onSubmit={send} noValidate style={{ gridTemplateColumns: "minmax(0, 1fr)", marginBottom: "1.5rem" }}>
      <fieldset disabled={frozen || !valid} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: ".75rem" }}>
        <label htmlFor={reasonId}>Report reason</label>
        <select ref={reasonInput} id={reasonId} value={reason} onChange={event => setReason(event.target.value)} style={{ minWidth: 0 }}>
          {communityReportReasons.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <label htmlFor={detailsId}>Details (optional)</label>
        <textarea id={detailsId} value={details} maxLength={1000} rows={4} onChange={event => setDetails(event.target.value)} style={{ minWidth: 0 }} />
      </fieldset>
      <button type="submit" className="button" disabled={!valid || phase === "sending"}>
        {phase === "sending" ? "Sending report…" : phase === "unconfirmed" ? "Retry report" : "Send report"}</button>
    </form>}
    {phase === "unconfirmed" && <p>Retry keeps the same reason and details. Closing does not undo a report that was already saved.</p>}
    <button type="button" className="button quiet" onClick={close}>Close</button>
  </dialog>;
}

export function CommunityReporting({ target, onSubmit, onClose }) {
  let key = "invalid", valid = false;
  try { key = JSON.stringify(communityReportTarget(target)); valid = true; } catch { /* Invalid targets remain closed to writes. */ }
  return <CommunityReportingSession key={key} target={target} onSubmit={onSubmit} onClose={onClose} valid={valid} />;
}
