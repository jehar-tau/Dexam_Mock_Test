// Fictional student workspace for local development and hosted staging review. No provider calls, sessions or entitlements.
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { WorkspaceView, PendingAttemptResult } from "./Workspace.jsx";
import { Arrow } from "./Art.jsx";
import { PortalShell, DeferredModule } from "./PortalShell.jsx";
import {postLaunchPreview}from "./launch-scope.js";
import { hostedStudentPreview } from "./student-preview.js";
import { DrawingUploadWindow, previewDrawingMedia } from "./DrawingUploads.jsx";

const example = {
  access: { active: true, expiresAt: "2027-11-05T00:00:00+05:30" },
  analytics: {
    completed: 2,
    waitingForResults: 1,
    objectiveAnswered: 25,
    objectiveAccuracy: 80,
    recommendedTopic: { topic: "Visual hierarchy", answered: 10, accuracy: 70 },
    drawingReviews: { pending: 1, released: 2 },
    exams: [{ exam: "uceed", attempts: 1, averagePercent: 80, bestPercent: 80 }],
    topics: [
      { topic: "Observation", answered: 10, correct: 9, accuracy: 90 },
      { topic: "Spatial thinking", answered: 5, correct: 4, accuracy: 80 },
      { topic: "Visual hierarchy", answered: 10, correct: 7, accuracy: 70 },
    ],
  },
  attempts: [
    { id: "example-result", title: "Visual thinking · example result", status: "submitted", score: 80, total: 100 },
    { id: "example-pending", title: "Example cohort awaiting release", status: "submitted", resultsPending: true },
    { id: "original-sample", title: "Your five-question experience sample", status: "active" },
  ],
};
const topics = [
  { name: "Observation", score: 9, total: 10, note: "You noticed small differences reliably. Keep a daily sketch of one ordinary object, including three details you would usually overlook." },
  { name: "Spatial thinking", score: 8, total: 10, note: "Rotation was more consistent than folding. Draw a simple box from three viewpoints, then check the hidden edges with a real object." },
  { name: "Visual hierarchy", score: 7, total: 10, note: "Busy compositions were harder to prioritise. Pick one poster each day, mark what you see first, then redesign it with three levels of emphasis." },
];

function PendingUploadPreview() {
  const [serverTime, setServerTime] = useState(Date.now);
  const [uploadDeadline] = useState(() => new Date(serverTime + 5 * 60 * 1000).toISOString());
  useEffect(() => {
    const timer = setInterval(() => setServerTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <PendingAttemptResult title="Fictional All India mock" reviewEndsAt="2026-12-01T12:30:00Z" allIndiaHref="/all-india-preview" workspaceHref="/portal-preview">
    <DrawingUploadWindow serverTime={serverTime} invoke={previewDrawingMedia} attempt={{
      id: "preview-all-india-drawing", status: "submitted", resultsPending: true, uploadDeadline,
      questions: [], drawingUploadTasks: [{ id: "drawing", prompt: "Sketch a portable reading light." }],
    }} />
  </PendingAttemptResult>;
}

export default function PortalPreview() {
  const location = useLocation();
  const navigate = useNavigate();
  const report = location.pathname.endsWith("/report");
  const pending = location.pathname.endsWith("/pending");
  const pendingUpload = location.pathname.endsWith("/pending-upload");
  const expandedPreview = postLaunchPreview || hostedStudentPreview;
  return <>
    <section className="wrap portal-preview-note" aria-label="Preview information">
      <span className="eyebrow">STUDENT PORTAL PREVIEW</span>
      <p>Welcome, Sample Student. This is a fictional account for exploring the interface. The pass, attempts and marks below are examples. No paper is published in this preview.</p>
      <div className="portal-preview-links">
        <Link to="/portal-preview" aria-current={!report ? "page" : undefined}>Your workspace</Link>
        <Link to="/portal-preview/paper">Try an example paper</Link>
        <Link to="/sample">Try the original sample</Link>
        <Link to="/portal-preview/report" aria-current={report ? "page" : undefined}>Example report</Link>
        {expandedPreview&&<><Link to="/portal-preview/pending" aria-current={pending ? "page" : undefined}>Example pending result</Link>
        <Link to="/portal-preview/pending-upload" aria-current={pendingUpload ? "page" : undefined}>Example drawing upload</Link></>}
      </div>
      <details className="notice">
        <summary>Explore student pages</summary>
        <nav aria-label="Sign-in-free student pages" className="portal-preview-links">
          <Link to="/">Home</Link>
          <Link to="/tests">Exam guides</Link>
          <Link to="/plans">Plans</Link>
          <Link to="/sample">Free sample paper</Link>
          <Link to="/portal-preview">Student overview</Link>
          {hostedStudentPreview && <Link to="/profile-preview">Student profile</Link>}
          <Link to="/exam-mocks-preview">Exam-wise mocks</Link>
          <Link to="/all-india-preview">All India mocks</Link>
          <Link to="/topic-practice-preview">Topic practice</Link>
          <Link to="/learn-preview">Learn</Link>
          <Link to="/community-preview">Community</Link>
          <Link to="/drawing-uploads-preview">Drawing uploads</Link>
          <Link to="/question-report-preview">Question reporting</Link>
        </nav>
      </details>
    </section>
    {!expandedPreview&&(pending||pendingUpload)?<DeferredModule module="drawings"/>:pendingUpload ? <PendingUploadPreview /> : pending ? <PendingAttemptResult title="Fictional All India mock" reviewEndsAt="2026-12-01T12:30:00Z" allIndiaHref="/all-india-preview" workspaceHref="/portal-preview" /> : report ? <section className="wrap section sample-result">
      <Link className="back-link" to="/portal-preview">← Your preview workspace</Link>
      <div className="result-title">
        <div>
          <span className="eyebrow">VISUAL THINKING / EXAMPLE REPORT</span>
          <h1>A little reflection.<br />A clearer <em>next step.</em></h1>
          <p>Illustrative feedback for a fictional attempt. Take the original sample to receive feedback based on your own answers.</p>
        </div>
        <div className="sample-score"><span>80<i>/100</i></span><p>example objective marks</p></div>
      </div>
      <div className="result-grid">
        <article><span className="eyebrow">A GLIMPSE OF YOUR SECTIONS</span><h2>What came naturally.</h2>
          {topics.map(t => <div className="result-topic" key={t.name}><span>{t.name}</span><b>{t.score}/{t.total} correct</b></div>)}
          <p>Example section counts are separate from the weighted overall mark. Drawing is assessed separately and is excluded from objective marks.</p>
        </article>
        <article><span className="eyebrow">YOUR NEXT PRACTICE</span><h2>Make space for hierarchy.</h2><p>In this example, the clearest opportunity is deciding what a viewer should notice first. Start with one focal point before adding detail.</p><p>Try a 20-minute session: observe a poster, simplify it to three shapes, then rebuild the composition with a clear order.</p></article>
      </div>
      <h2>Small observations. Useful habits.</h2>
      <div className="paper-list">{topics.map(t => <article key={t.name}><span className="eyebrow">{t.name}</span><h3>Try this tomorrow.</h3><p>{t.note}</p></article>)}</div>
      <Link className="button" to="/sample">Try it with your own answers <Arrow /></Link>
    </section> : <PortalShell><WorkspaceView data={expandedPreview?example:{...example,attempts:example.attempts.filter(item=>!item.resultsPending),analytics:{...example.analytics,waitingForResults:0,drawingReviews:{pending:0,released:0}}}} papers={[]} preview passLabel="EXAMPLE PASS" practiceHref="/topic-practice-preview" allIndiaHref="/all-india-preview" examHref="/exam-mocks-preview" onStart={() => navigate("/portal-preview/paper")} attemptHref={id => id === "example-result" ? "/portal-preview/report" : id === "example-pending" ? "/portal-preview/pending" : "/portal-preview/paper"} /></PortalShell>}
  </>;
}
