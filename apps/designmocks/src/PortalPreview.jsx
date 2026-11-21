// Fictional student workspace for local development and hosted staging review. No provider calls, sessions or entitlements.
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { WorkspaceView, PendingAttemptResult } from "./Workspace.jsx";
import { PreviewPaper } from "./PreviewPaper.jsx";
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
    { id: "example-result", title: "Visual design paper", status: "submitted", score: 13, total: 24 },
    { id: "example-pending", title: "Example cohort awaiting release", status: "submitted", resultsPending: true },
    { id: "original-sample", title: "Your five-question experience sample", status: "active" },
  ],
};
const papers = [
  { id: "illustrative-uceed", exam: "uceed", title: "See the problem differently.", durationSeconds: 360 },
  { id: "illustrative-nid", exam: "nid", title: "Notice the little things.", durationSeconds: 360 },
  { id: "illustrative-nift", exam: "nift", title: "Give your eye a workout.", durationSeconds: 360 },
  { id: "illustrative-ceed", exam: "ceed", title: "Find another way through.", durationSeconds: 360 },
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
  const paper = location.pathname.endsWith("/paper");
  const report = location.pathname.endsWith("/report");
  const pending = location.pathname.endsWith("/pending");
  const pendingUpload = location.pathname.endsWith("/pending-upload");
  const expandedPreview = postLaunchPreview || hostedStudentPreview;
  if (paper || report) return <>
    <section className="wrap attempt-demo-note" aria-label="Preview information"><strong>{report ? "Example report" : "Paper demo"}</strong>
      <span>{report ? "Illustrative feedback for a fictional attempt." : "Six original questions · 12 minutes · progress saved in this tab."}</span></section>
    <PreviewPaper key={paper ? "paper" : "report"} example={report}/>
  </>;
  return <>
    <section className="wrap portal-preview-note" aria-label="Preview information">
      <span className="eyebrow">STUDENT PORTAL PREVIEW</span>
      <p>Welcome, Sample Student. This is a fictional account for exploring the interface. The pass, papers and marks below are examples.</p>
      <div className="portal-preview-links">
        <Link to="/portal-preview" aria-current={!report ? "page" : undefined}>Your workspace</Link>
        <Link to="/portal-preview/paper">Try the complete paper demo</Link>
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
    {!expandedPreview&&(pending||pendingUpload)?<DeferredModule module="drawings"/>:pendingUpload ? <PendingUploadPreview /> : pending ? <PendingAttemptResult title="Fictional All India mock" reviewEndsAt="2026-12-01T12:30:00Z" allIndiaHref="/all-india-preview" workspaceHref="/portal-preview" /> : <PortalShell><WorkspaceView data={expandedPreview?example:{...example,attempts:example.attempts.filter(item=>!item.resultsPending),analytics:{...example.analytics,waitingForResults:0,drawingReviews:{pending:0,released:0}}}} papers={expandedPreview?papers:papers.slice(0,1)} passLabel="EXAMPLE PASS" startLabel="Try the 5-question sample" practiceHref="/topic-practice-preview" allIndiaHref="/all-india-preview" onStart={() => navigate("/sample")} attemptHref={id => id === "example-result" ? "/portal-preview/report" : id === "example-pending" ? "/portal-preview/pending" : "/sample"} /></PortalShell>}
  </>;
}
