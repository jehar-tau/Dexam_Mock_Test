import React, { useCallback, useRef, useState } from "react";
import { CommunityReportReview } from "./CommunityReportReview.jsx";
import { communityReviewInput } from "./community-moderation.js";

function CommunityModerationSession({ reports, rpc, onRefresh }) {
  const [selection, setSelection] = useState(null), [message, setMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const sequence = useRef(0), opener = useRef(null), refreshButton = useRef(null), alive = useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const close = () => { setSelection(null); if (opener.current?.isConnected) opener.current.focus(); };
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true); setMessage("");
    try { await onRefresh(); }
    catch { if (alive.current) setMessage("Couldn’t refresh Community reports. Try again."); }
    finally { if (alive.current) setRefreshing(false); }
  };
  const resolved = async () => {
    close(); setMessage("Report review recorded.");
    try { await onRefresh(); }
    catch { if (alive.current) setMessage("Report review recorded. Refresh reports to update the queue."); }
  };
  const selected = selection && reports.some(report => report.id === selection.id) ? selection : null;
  React.useLayoutEffect(() => {
    if (!selected && opener.current && !opener.current.isConnected && document.activeElement === document.body) refreshButton.current?.focus();
  }, [reports, selected]);
  return <section className="community-moderation" aria-label="Community moderation" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
    <button type="button" className="button quiet" ref={refreshButton} aria-disabled={refreshing} onClick={refresh}>{refreshing ? "Refreshing reports…" : "Refresh reports"}</button>
    {message && <p role="status">{message}</p>}
    {selected && <CommunityReportReview key={`${selected.id}:${selected.sequence}`} reportId={selected.id} rpc={rpc}
      onClose={close} onReopen={() => setSelection({ id: selected.id, sequence: ++sequence.current })} onResolved={resolved} />}
    <div className="admin-list">{reports.length === 0 ? <p>No open community reports.</p> : reports.map((report, index) => <article key={report.id} aria-label={`Community report ${index + 1}`} style={{ minWidth: 0 }}>
      <span className="eyebrow">{report.targetType === "comment" ? "Reply" : "Discussion"} · {typeof report.reason === "string" ? report.reason.replaceAll("_", " ") : "other"}</span>
      <span className="status-pill">{report.contentStatus}</span>
      {typeof report.content === "string" && <p className="bank-question-prompt">{report.content}</p>}
      {typeof report.details === "string" && <p className="bank-question-prompt">Reporter note: {report.details}</p>}
      <button type="button" className="button quiet" onClick={event => { opener.current = event.currentTarget; setMessage(""); setSelection({ id: report.id, sequence: ++sequence.current }); }}>Review report</button>
    </article>)}</div>
  </section>;
}

export function CommunityModerationQueue({ reports = [], rpc, onRefresh, scopeKey }) {
  return <CommunityModerationSession key={scopeKey} reports={reports} rpc={rpc} onRefresh={onRefresh} />;
}

const previewId = "80000000-0000-4000-8000-000000000001", previewPost = "81000000-0000-4000-8000-000000000001";
const previewContent = { id: previewPost, kind: "post", title: "A fictional reported discussion", body: "Active-paper answer posted in a discussion.",
  status: "visible", exam: "uceed", topic: "observation", assets: [] };
const previewReport = { id: previewId, targetType: "post", targetId: previewPost, reason: "answer_leak", details: "This appears to disclose a live answer.",
  createdAt: "2026-11-08T10:00:00Z", status: "open", resolution: null, reviewVersion: "a".repeat(64), canDismiss: true,
  target: previewContent, post: previewContent, parent: null, history: [] };
export function CommunityModerationPreview() {
  const [reports, setReports] = useState([{ id: previewId, targetType: "post", reason: "answer_leak", contentStatus: "visible", content: previewContent.body }]);
  const done = useRef(false);
  const rpc = useCallback(async (name, input) => {
    if (name === "admin_community_report" && input.p_report_id === previewId && !done.current) return previewReport;
    if (name === "admin_resolve_community_report" && !done.current) {
      communityReviewInput(previewReport, input.p_resolution, input.p_note);
      if (input.p_expected_version !== previewReport.reviewVersion) throw { details: "community_review_changed" };
      done.current = true;
      return null;
    }
    throw { details: "community_review_unavailable" };
  }, []);
  return <section className="wrap section admin-page"><h1>Community <em>moderation.</em></h1>
    <p>Fictional local preview. Review decisions are simulated here.</p>
    <CommunityModerationQueue reports={reports} rpc={rpc} onRefresh={async () => { if (done.current) setReports([]); }} scopeKey="fictional-community-review" />
  </section>;
}
