// Home page proof points (owner's request, 28 Nov 2026): the exams and colleges in the
// hero, who built DMocks, and big numbers for what is here and what is added each month.
import React from "react";
import { Link } from "react-router-dom";
import { EDITORIAL_AUTHOR } from "./editorial-author.mjs";

// The live catalogue on 28 Nov 2026: 49 year-wise papers, 3,200 questions (PORTAL_SOURCE_OF_TRUTH.md).
// Monthly figures: owner's commitment, 28 Nov 2026, to four new mock papers a month (UCEED, CEED,
// NID and NIFT, about 215 questions), which then join topic practice. Keep these true: if fewer
// papers are published, lower the numbers.
export const homeNumbers = Object.freeze([
  { value: "3,200", label: "questions with worked solutions" },
  { value: "49", label: "complete past papers, free" },
  { value: "4", label: "new mock papers every month" },
  { value: "200+", label: "new practice questions every month" },
]);

export const examPaths = Object.freeze([
  { exam: "UCEED", college: "IIT B.Des.", to: "/tests/uceed" },
  { exam: "CEED", college: "IIT M.Des.", to: "/tests/ceed" },
  { exam: "NID DAT", college: "NID", to: "/tests/nid" },
  { exam: "NIFT", college: "NIFT", to: "/tests/nift" },
]);

// Set to the photo's public path (for example "/founder.jpg") once the owner provides it.
const founderPhoto = null;

export function HeroExamPaths() {
  return <ul className="hero-exams" aria-label="Exams and colleges">
    {examPaths.map(path => <li key={path.exam}><Link to={path.to}><b>{path.exam}</b><span>{path.college}</span></Link></li>)}
  </ul>;
}

export function FounderNote() {
  return <figure className="founder-note">
    {founderPhoto ? <img src={founderPhoto} alt="" width="56" height="56" />
      : <span className="founder-avatar" aria-hidden="true">{EDITORIAL_AUTHOR.initials}</span>}
    <figcaption>
      <b>Built by {EDITORIAL_AUTHOR.name}</b>
      <span>Cleared NID DAT and CEED, the IIT M.Des. entrance, and studied at NID Bengaluru. I built DMocks for students taking the same path.</span>
    </figcaption>
  </figure>;
}

export function HomeNumbers() {
  return <section className="wrap home-numbers" aria-label="DMocks in numbers">
    <ul>{homeNumbers.map(item => <li key={item.label}><b>{item.value}</b><span>{item.label}</span></li>)}</ul>
  </section>;
}
