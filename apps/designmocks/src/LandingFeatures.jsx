// Public landing sections: what is inside DMocks, and the free way in.
import React from "react";
import { Link } from "react-router-dom";
import { Arrow } from "./Art.jsx";
import { Motif, Reveal } from "./Motion.jsx";
import { postLaunchPreview } from "./launch-scope.js";
import { releasedModules } from "./launch-scope.mjs";
import { portalReady } from "./platform.js";

// `module` names the portal module a feature belongs to. Modules still held
// back by the launch scope (launch-scope.mjs) carry an "Opening soon" label so
// the page never shows something as open before students can use it.
export const features = [
  {
    id: "learn",
    module: "learn",
    motif: "learn",
    tone: "lime",
    wide: true,
    eyebrow: "LEARN",
    title: "See the idea. Then try it.",
    copy: "Twenty-eight interactive programmes that build one idea at a time, from cube nets, paper folding and perspective to colour, art history, posters and product design. Every step asks you to do something, then shows you why.",
    points: ["Step-by-step programmes", "Fresh questions on every try", "From first ideas to exam level"],
    to: "/dashboard/learn",
    link: "Open Learn",
  },
  {
    id: "mocks",
    module: "exam-mocks",
    motif: "mocks",
    tone: "yellow",
    eyebrow: "EXAM-WISE MOCKS",
    title: "Sit the paper before the paper.",
    copy: "Timed mocks shaped like the real exam, with its parts, its clock and its marking rules.",
    points: ["UCEED, CEED, NIFT, NID DAT", "Reviewed questions"],
    to: "/tests",
    link: "See the mock tests",
  },
  {
    id: "practice",
    module: "practice",
    motif: "practice",
    tone: "orange",
    eyebrow: "TOPIC PRACTICE",
    title: "Twenty minutes. One topic.",
    copy: "Pick a topic and build a 10, 20 or 30-question session with a timer to match. For the days a full mock is too much.",
    points: ["Choose the topic", "Choose the length"],
    to: "/dashboard/practice",
    link: "Open Topic practice",
  },
  {
    id: "all-india",
    module: "all-india",
    motif: "allIndia",
    tone: "lime",
    wide: true,
    eyebrow: "ALL INDIA MOCKS",
    title: "One paper. One window. Everyone at once.",
    copy: "Sit the same paper as aspirants across the country inside a fixed window. One attempt each, ranks released after review, and a top ten for every exam.",
    points: ["A fixed paper for each exam", "Your rank in the cohort", "Top ten on the results board"],
    to: "/dashboard/all-india",
    link: "Open All India mocks",
  },
  {
    id: "community",
    module: "community",
    motif: "community",
    tone: "yellow",
    eyebrow: "COMMUNITY",
    title: "Stuck? Ask the room.",
    copy: "Talk through questions and solutions with other aspirants in moderated threads. No direct messages.",
    points: ["Question and solution threads", "Moderated"],
    to: "/dashboard/community",
    link: "Open Community",
  },
  {
    id: "drawing",
    module: "drawings",
    motif: "drawing",
    tone: "orange",
    eyebrow: "DRAWING REVIEW",
    title: "Put your sketch in front of a reviewer.",
    copy: "Upload your drawing answers and get feedback from a reviewer, not just a mark.",
    points: ["Upload from your phone", "Reviewer feedback"],
    to: "/dashboard",
    link: "Open your portal",
  },
  {
    id: "report",
    module: null,
    motif: "report",
    tone: "lime",
    eyebrow: "YOUR REPORT",
    title: "Know what to do next.",
    copy: "After every attempt, see how each section went and which topics deserve your next session.",
    points: ["Section by section", "What to practise next"],
    to: "/#report",
    link: "See a report",
  },
];

function JoinLink() {
  return (
    <Link className="button join-button" to="/account">
      Student account
      <Arrow size={18} />
    </Link>
  );
}

export function FeatureShowcase() {
  return (
    <section className="wrap section features" id="features">
      <div className="section-heading">
        <div>
          <span className="eyebrow">DMocks features</span>
          <h2>
            Learn it. Practise it.
            <br /> <em>Prove it.</em>
          </h2>
        </div>
        <p>
          Explore the free sample and see which features are planned.
        </p>
      </div>
      <div className="feature-grid">
        {features.map((feature) => {
          const soon = Boolean(feature.module) && !(releasedModules[feature.module] && portalReady) && !(postLaunchPreview && portalReady);
          return (
            <Reveal
              as="article"
              key={feature.id}
              className={"feature-card tone-" + feature.tone + (feature.wide ? " wide" : "")}
            >
              <div className="feature-art">
                <Motif kind={feature.motif} />
              </div>
              <div className="feature-copy">
                <span className="eyebrow">
                  {feature.eyebrow}
                  {soon && <span className="badge">Opening soon</span>}
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
                <ul>
                  {feature.points.map((point) => (
                    <li key={point}>
                      <i className="small-dot" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
                {(!soon || feature.module === "exam-mocks") && (
                  <Link className="text-link" to={feature.to}>
                    {soon ? "Explore exam guides" : feature.link} <Arrow />
                  </Link>
                )}
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

export function FreePass() {
  return (
    <section className="wrap section join-section" id="join">
      <Reveal className="join-panel">
        <div className="join-art">
          <Motif kind="pass" label="A DMocks free pass ticket" />
        </div>
        <div className="join-copy">
          <span className="eyebrow">FREE SAMPLE</span>
          <h2>
            Come on in.
            <br /> <em>It’s free.</em>
          </h2>
          <p>
            Try five original practice questions with a timer and answer review.
          </p>
          <div className="join-actions">
            {portalReady && <JoinLink />}
            <Link to="/sample" className={portalReady ? "sample-link" : "button join-button"}>
              Try 5 sample questions <Arrow size={17} />
            </Link>
          </div>
          <div className="join-chips">
            <span>No sign-in needed</span>
            <span>Six minutes</span>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export { JoinLink };
