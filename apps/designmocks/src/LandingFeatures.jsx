// Public landing sections: what is inside DMocks, and the free way in.
import React from "react";
import { Link } from "react-router-dom";
import { Arrow } from "./Art.jsx";
import { Motif, Reveal } from "./Motion.jsx";
import { studentModuleReleased } from "./launch-scope.js";
import { releasedModules } from "./launch-scope.mjs";
import { portalReady } from "./platform.js";
import { useAuthState } from "./useAuth.js";

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
    id: "practice",
    module: "practice",
    motif: "practice",
    tone: "orange",
    eyebrow: "TOPIC PRACTICE",
    title: "Twenty minutes. One topic.",
    copy: "Pick a topic and build a free 10, 20 or 30-question session from released past papers, with a timer to match. For the days a full paper is too much.",
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

export function PublicPracticeOptions() {
  const options = [
    {
      title: "Free timed sample",
      copy: "Answer five original visual questions in six minutes. You can flag a question and return to it before submitting.",
      to: "/sample", link: "Start the free sample", motif: "mocks", tone: "yellow",
    },
    {
      title: "Visual hierarchy exercise",
      copy: "Compare two museum signs and decide which one helps a visitor find the workshop. Open the worked example when you’re ready.",
      to: "/practice/visual-hierarchy", link: "Compare the museum signs", motif: "learn", tone: "lime",
    },
    {
      title: "Free past-year papers",
      copy: "Take complete UCEED, CEED, NID and NIFT papers with their original timer and marking, then open a worked solution for every question.",
      to: "/papers", link: "Browse free papers", motif: "practice", tone: "orange",
    },
  ];
  return (
    <section className="wrap section features" id="features">
      <div className="section-heading"><h2>Choose your practice.</h2></div>
      <div className="feature-grid">
        {options.map(option => (
          <article key={option.to} className={"feature-card tone-" + option.tone}>
            <div className="feature-art"><Motif kind={option.motif} /></div>
            <div className="feature-copy">
              <h3>{option.title}</h3>
              <p>{option.copy}</p>
              <Link className="text-link" to={option.to}>{option.link} <Arrow /></Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FeatureShowcase() {
  const { session } = useAuthState();
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
          const released = releasedModules[feature.module] || studentModuleReleased(feature.module === "drawings" ? "drawing-review" : feature.module);
          const soon = Boolean(feature.module) && !(released && portalReady);
          const needsSignIn = feature.to.startsWith("/dashboard") && !session;
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
                {feature.id === "learn" && soon && (
                  <Link className="text-link" to="/practice/visual-hierarchy">
                    Try a free visual hierarchy exercise <Arrow />
                  </Link>
                )}
                {!soon && (
                  <Link className="text-link" to={needsSignIn ? "/account" : feature.to}>
                    {needsSignIn ? "Sign in free to start" : feature.link} <Arrow />
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
