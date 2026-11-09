import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAdminServices } from "./AdminAccess.jsx";
import { AdminQueueNavigation } from "./AdminQueueNavigation.jsx";
import { adminRequestMessage } from "./admin-access.js";
import { activePrivacyReview, matchesPrivacyDecision } from "./admin-privacy.js";

function PrivacyReview({ request, claim, release, blocked, refresh }) {
  const { rpc, isCurrent } = useAdminServices();
  const life = useRef(null), running = useRef(false);
  const [draft, setDraft] = useState(null), [busy, setBusy] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const displayed = draft ?? { revision: request.reviewRevision, status: "in_progress", note: "" };
  const stale = displayed.revision !== request.reviewRevision;
  const frozen = busy || blocked || refreshRequired || stale;

  useEffect(() => {
    const controller = new AbortController();
    life.current = controller;
    return () => { controller.abort(); release(request.id); };
  }, [release, request.id]);

  function change(field, value) {
    if (frozen || running.current) return;
    setDraft({ ...displayed, [field]: value });
    setError("");
    setMessage("");
  }

  async function run(operation) {
    const controller = life.current;
    if (running.current || !isCurrent() || !controller || controller.signal.aborted || !claim(request.id)) return;
    const current = () => isCurrent() && !controller.signal.aborted;
    running.current = true;
    setBusy(true);
    try { await operation(controller.signal, current); }
    finally {
      running.current = false;
      release(request.id);
      if (current()) setBusy(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    if (frozen || !activePrivacyReview(request)) return;
    const note = displayed.note.trim();
    if (note.length < 10 || note.length > 2000) {
      setError("Enter an operator note of 10 to 2,000 characters.");
      return;
    }
    const command = { p_id: request.id, p_expected_revision: displayed.revision, p_status: displayed.status, p_note: note };
    await run(async (signal, current) => {
      setError("");
      setMessage("");
      try {
        const receipt = await rpc("admin_resolve_privacy_request", command, AbortSignal.any([signal, AbortSignal.timeout(15000)]));
        if (!current()) return;
        if (!matchesPrivacyDecision(command, receipt)) throw new Error("Incomplete privacy decision receipt");
        const refreshed = await refresh();
        if (!current()) return;
        setDraft(null);
        setRefreshRequired(!refreshed);
        setMessage(refreshed ? "Privacy decision saved." : "Privacy decision saved. Refresh the request before making another change.");
      } catch (failure) {
        if (!current()) return;
        setRefreshRequired(failure?.code !== "22023");
        if (failure?.code === "40001") setError("This request changed. Refresh it and review the current status.");
        else if (failure?.code === "22023") setError(adminRequestMessage(failure));
        else setError("The decision could not be confirmed. Refresh the request before making another change.");
      }
    });
  }

  function refreshReview() {
    return run(async (_, current) => {
      if (await refresh() && current()) {
        setDraft(null);
        setRefreshRequired(false);
        setError("");
        setMessage("Current privacy request loaded.");
      }
    });
  }

  return <article>
    <b>Account deletion</b>
    <span className="status-pill">{request.status.replaceAll("_", " ")}</span>
    <small>Private account reference {request.userId}</small>
    {request.adminNote && <p>{request.adminNote}</p>}
    {activePrivacyReview(request) && <form className="admin-reply" aria-label="Review privacy request" onSubmit={save}>
      <select aria-label="Privacy request status" value={displayed.status} disabled={frozen}
        onChange={event => change("status", event.target.value)}>
        <option value="in_progress">in progress</option>
        <option value="closed">closed after verified handling</option>
        <option value="declined">declined</option>
      </select>
      <input aria-label="Operator action and retention note" placeholder="Operator action and retention note"
        value={displayed.note} minLength={10} maxLength={2000} required disabled={frozen}
        onChange={event => change("note", event.target.value)} />
      <button disabled={frozen}>{busy ? "Saving…" : "Save privacy status"}</button>
    </form>}
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {(stale || refreshRequired) && <button type="button" className="button quiet" disabled={busy || blocked}
      onClick={() => void refreshReview()}>Refresh request</button>}
  </article>;
}

export function AdminPrivacyRequests({ page, navigate, refresh }) {
  const { isCurrent } = useAdminServices();
  const pending = useRef(null), paging = useRef(false), heading = useRef(null);
  const [pendingId, setPendingId] = useState(null), [pageBusy, setPageBusy] = useState(false);
  const claim = useCallback(id => {
    if (paging.current || pending.current !== null) return false;
    pending.current = id;
    setPendingId(id);
    return true;
  }, []);
  const release = useCallback(id => {
    if (pending.current !== id) return;
    pending.current = null;
    if (isCurrent()) setPendingId(null);
  }, [isCurrent]);
  async function move(position) {
    if (paging.current || pending.current !== null) return;
    paging.current = true;
    setPageBusy(true);
    try {
      if (await navigate(position) && isCurrent()) heading.current?.focus();
    } finally {
      paging.current = false;
      if (isCurrent()) setPageBusy(false);
    }
  }

  return <section aria-label="Account privacy requests">
    <h2 ref={heading} tabIndex={-1}>Account privacy requests</h2>
    <p>Choose <strong>closed after verified handling</strong> once the separate account deletion process is complete.</p>
    <div className="admin-list">
      {page?.items.map(request => <PrivacyReview key={request.id} request={request} claim={claim} release={release}
        blocked={pageBusy || pendingId !== null && pendingId !== request.id} refresh={refresh} />)}
      {page && page.items.length === 0 && <p>No account privacy requests on this page.</p>}
    </div>
    <AdminQueueNavigation page={page} label="Privacy request pages" subject="requests" disabled={pageBusy || pendingId !== null} navigate={move} />
  </section>;
}
