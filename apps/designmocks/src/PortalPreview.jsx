// Development-only visual preview. No provider calls, sessions or entitlements.
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { WorkspaceView } from "./Workspace.jsx";
import { Arrow } from "./Art.jsx";
import { PortalShell } from "./PortalShell.jsx";

const example = {
  access: { active: true, expiresAt: "2027-11-05T00:00:00+05:30" },
  attempts: [
    { id: "example-result", title: "Visual thinking · example result", status: "submitted", score: 80, total: 100 },
    { id: "original-sample", title: "Your five-question experience sample", status: "active" },
  ],
};
const papers = [
  { id: "illustrative-uceed", exam: "uceed", title: "See the problem differently.", durationSeconds: 360 },
  { id: "illustrative-nid", exam: "nid", title: "Notice the little things.", durationSeconds: 360 },
  { id: "illustrative-nift", exam: "nift", title: "Give your eye a workout.", durationSeconds: 360 },
  { id: "illustrative-ceed", exam: "ceed", title: "Find another way through.", durationSeconds: 360 },
];
const topics = [
  { name: "Observation", score: 9, total: 10, note: "You noticed small differences reliably. Keep a daily sketch of one ordinary object, including three details you would usually overlook." },
  { name: "Spatial thinking", score: 8, total: 10, note: "Rotation was more consistent than folding. Draw a simple box from three viewpoints, then check the hidden edges with a real object." },
  { name: "Visual hierarchy", score: 7, total: 10, note: "Busy compositions were harder to prioritise. Pick one poster each day, mark what you see first, then redesign it with three levels of emphasis." },
];

export default function PortalPreview() {
  const location = useLocation();
  const navigate = useNavigate();
  const report = location.pathname.endsWith("/report");
  return <>
    <section className="wrap portal-preview-note" aria-label="Preview information">
      <span className="eyebrow">STUDENT PORTAL PREVIEW</span>
      <p>Welcome, Sample Student. This is a fictional account for exploring the interface. The pass, papers and marks below are examples.</p>
      <div className="portal-preview-links">
        <Link to="/portal-preview" aria-current={!report ? "page" : undefined}>Your workspace</Link>
        <Link to="/sample">Try the original sample</Link>
        <Link to="/portal-preview/report" aria-current={report ? "page" : undefined}>Example report</Link>
      </div>
    </section>
    {report ? <section className="wrap section sample-result">
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
    </section> : <PortalShell><WorkspaceView data={example} papers={papers} passLabel="EXAMPLE PASS" startLabel="Try the 5-question sample" onStart={() => navigate("/sample")} attemptHref={id => id === "example-result" ? "/portal-preview/report" : "/sample"} /></PortalShell>}
  </>;
}
