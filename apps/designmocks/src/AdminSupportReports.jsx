import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAdminServices } from "./AdminAccess.jsx";
import { adminRequestMessage, isAdminAccessFailure } from "./admin-access.js";
import { matchesSupportReplyReceipt, supportReplyRequest, supportStatuses } from "./admin-support.js";

function ReportReply({ report, claim, release, blocked, refresh }) {
  const { rpc, isCurrent } = useAdminServices();
  const life = useRef(null), writing = useRef(false);
  const [draft, setDraft] = useState(null), [request, setRequest] = useState(null);
  const [busy, setBusy] = useState(false), [refreshRequired, setRefreshRequired] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const displayed = draft ?? { status: report.status, reply: report.adminReply ?? "", revision: report.replyRevision };
  const stale = displayed.revision !== report.replyRevision;
  const frozen = busy || request !== null || refreshRequired || stale;

  useEffect(() => {
    const controller = new AbortController();
    life.current = controller;
    return () => { controller.abort(); release(report.id); };
  }, [release, report.id]);

  function change(field, value) {
    if (writing.current || frozen) return;
    setDraft({ ...displayed, [field]: value });
    setError("");
    setMessage("");
  }

  async function save(command) {
    const controller = life.current;
    if (writing.current || !isCurrent() || !controller || controller.signal.aborted || !claim(report.id)) return;
    const current = () => isCurrent() && !controller.signal.aborted;
    writing.current = true;
    setBusy(true);
    setRequest(command);
    setError("");
    setMessage("");
    try {
      const receipt = await rpc("admin_reply_bug_report", command, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      if (!current()) return;
      if (!matchesSupportReplyReceipt(command, receipt)) throw new Error("Incomplete support reply receipt");
      setRequest(null);
      setDraft(null);
      const refreshed = await refresh().catch(() => false);
      if (!current()) return;
      setRefreshRequired(!refreshed);
      setMessage(refreshed ? "Reply saved." : "Reply saved. Refresh the report before replying again.");
      release(report.id);
    } catch (failure) {
      if (!current()) return;
      if (["40001", "22023"].includes(failure?.code) || isAdminAccessFailure(failure)) {
        setRequest(null);
        release(report.id);
        if (failure.code === "40001") {
          setRefreshRequired(true);
          setError("This report changed. Refresh it and review the current response before replying.");
        } else setError(adminRequestMessage(failure));
      } else {
        setError("The reply could not be confirmed. Retry the same reply to check its receipt.");
      }
    } finally {
      writing.current = false;
      if (current()) setBusy(false);
    }
  }

  async function refreshReport() {
    const controller = life.current;
    if (writing.current || !isCurrent() || !controller || controller.signal.aborted) return;
    writing.current = true;
    setBusy(true);
    try {
      if (await refresh() && isCurrent() && !controller.signal.aborted) {
        setDraft(null);
        setRefreshRequired(false);
        setError("");
        setMessage("Current report loaded.");
      }
    } finally {
      writing.current = false;
      if (isCurrent() && !controller.signal.aborted) setBusy(false);
    }
  }

  return <article className="bug-report-card">
    <b>{report.title}</b>
    <p>{report.description}</p>
    <form className="admin-reply" aria-label={"Reply to report " + report.title} onSubmit={event => {
      event.preventDefault();
      if (!frozen && !blocked && !writing.current) void save(supportReplyRequest(report.id, displayed, crypto.randomUUID()));
    }}>
      <select aria-label="Report status" value={displayed.status} disabled={frozen}
        onChange={event => change("status", event.target.value)}>
        {supportStatuses.map(status => <option key={status}>{status}</option>)}
      </select>
      <input aria-label="Reply to reporter" placeholder="Reply to reporter" value={displayed.reply}
        disabled={frozen} onChange={event => change("reply", event.target.value)} />
      <button disabled={frozen || blocked}>{busy ? "Saving…" : "Save"}</button>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {request && !busy && <button type="button" className="button quiet" onClick={() => void save(request)}>Retry same reply</button>}
    {(stale || refreshRequired) && !request && <button type="button" className="button quiet" disabled={busy || blocked}
      onClick={() => void refreshReport()}>Refresh report</button>}
  </article>;
}

export function AdminSupportReports({ page, navigate, refresh }) {
  const { isCurrent } = useAdminServices();
  const pending = useRef(null), paging = useRef(false), heading = useRef(null);
  const [pendingId, setPendingId] = useState(null), [pageBusy, setPageBusy] = useState(false);
  const claim = useCallback(id => {
    if (paging.current || pending.current && pending.current !== id) return false;
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
    if (paging.current || pending.current) return;
    paging.current = true;
    setPageBusy(true);
    try {
      if (await navigate(position) && isCurrent()) heading.current?.focus();
    }
    finally { paging.current = false; if (isCurrent()) setPageBusy(false); }
  }
  const { cursor, previous } = page?.position ?? { cursor: null, previous: [] };
  return <section aria-label="Bug reports">
    <h2 ref={heading} tabIndex={-1}>Bug reports</h2>
    <div className="admin-list">
      {page?.items.map(report => <ReportReply key={report.id} report={report} claim={claim} release={release}
        refresh={refresh} blocked={pageBusy || pendingId !== null && pendingId !== report.id} />)}
      {page && page.items.length === 0 && <p>No bug reports on this page.</p>}
    </div>
    {(previous.length > 0 || page?.nextCursor) && <nav className="admin-actions" aria-label="Bug report pages">
      {previous.length > 0 && <button type="button" className="button quiet" disabled={pageBusy || pendingId !== null}
        onClick={() => void move({ cursor: previous.at(-1), previous: previous.slice(0, -1) })}>Previous reports</button>}
      <span>Page {previous.length + 1}</span>
      {page?.nextCursor && <button type="button" className="button quiet" disabled={pageBusy || pendingId !== null}
        onClick={() => void move({ cursor: page.nextCursor, previous: [...previous, cursor] })}>Next reports</button>}
    </nav>}
  </section>;
}
