import React from "react";
import{postLaunchPreview}from'./launch-scope.js';

const labels = {
  staleAttempts: "Stale attempts",
  expiredAttempts: "Expired awaiting sweep",
  openBugs: "Open support bugs",
  pendingQuestionReports: "Question reviews",
  openCommunityReports: "Community reports",
  pendingDrawingReviews: "Drawing reviews",
  failedIntakeAssets: "Failed intake jobs",
  failedAiDrafts: "Failed AI drafts",
  expiredIntakeJobs: "Expired extractions",
  expiredAiDraftJobs: "Expired draft requests",
  stalePendingOrders: "Stale pending orders",
  paymentReviews: "Payments needing review",
};

export function OperationalHealth({ health, onRefresh }) {
  if (!health) return <p role="status">Loading operational health…</p>;
  return <section className="operations-health" aria-label="Operational health">
    <div>
      <span className={`status-pill health-${health.status}`}>{health.status}</span>
      <small>Checked {new Date(health.checkedAt).toLocaleString("en-IN")}</small>
      {onRefresh && <button type="button" onClick={onRefresh}>Refresh queues</button>}
    </div>
    <div className="operations-metrics">
      {Object.entries(labels).filter(([key])=>postLaunchPreview&&health.scope!=='paid-mvp-v1'||['staleAttempts','expiredAttempts','openBugs','pendingQuestionReports','stalePendingOrders','paymentReviews'].includes(key)).map(([key, label]) => <article key={key}>
        <span>{label}</span>
        <b>{health[key] ?? 0}</b>
      </article>)}
    </div>
    <p>Queue counts contain no student identity or answer content. Investigate degraded counters before publication or sales changes.</p>
  </section>;
}

export function OperationalHealthPreview() {
  return <section className="wrap section"><h1>Operational <em>health.</em></h1><OperationalHealth health={{
    status: "degraded", checkedAt: "2026-11-06T08:30:00+05:30", staleAttempts: 2,
    expiredAttempts: 3, openBugs: 4, pendingQuestionReports: 1, openCommunityReports: 2,
    pendingDrawingReviews: 6, failedIntakeAssets: 1, failedAiDrafts: 0, stalePendingOrders: 0,
  }} /></section>;
}
