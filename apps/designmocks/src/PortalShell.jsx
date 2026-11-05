import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuthState } from "./useAuth.js";

const items = [
  ["/dashboard", "Overview", "O", true],
  ["/dashboard/mocks", "Exam-wise mocks", "M"],
  ["/dashboard/all-india", "All India mocks", "A"],
  ["/dashboard/practice", "Topic practice", "P"],
  ["/dashboard/learn", "Learn", "L"],
  ["/dashboard/community", "Community", "C"],
];

export function PortalShell({ children }) {
  const [open, setOpen] = useState(false);
  return <div className="portal-shell">
    <button className="portal-menu-button" aria-expanded={open} aria-controls="student-navigation" onClick={() => setOpen(!open)}>{open ? "Close" : "Student menu"}</button>
    <aside className={open ? "portal-sidebar is-open" : "portal-sidebar"} id="student-navigation">
      <span className="eyebrow">YOUR DMOCKS SPACE</span>
      <nav aria-label="Student workspace">
        {items.map(([to, label, mark, end]) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}><i aria-hidden="true">{mark}</i><span>{label}</span></NavLink>)}
      </nav>
      <NavLink className="portal-account-link" to="/account">Account & sign out</NavLink>
    </aside>
    <div className="portal-content">{children}</div>
  </div>;
}

const copy = {
  mocks: ["Exam-wise mocks", "Choose UCEED, NID, NIFT or CEED. Each released attempt will be assembled from reviewed, hold-free questions and frozen when you begin."],
  "all-india": ["All India mocks", "One fixed paper per exam, one attempt per account, a controlled window and ranks released only after review."],
  practice: ["Topic practice", "Build a 10, 20 or 30-question session by topic, with a 15, 30 or 45-minute timer."],
  learn: ["Learn", "Theory notes and guided learning paths will appear here after the owner content review."],
  community: ["Community", "Discuss questions and solutions in moderated threads. Direct messaging will remain off at launch."],
};

export function PortalModule({ module }) {
  const { session, loading } = useAuthState();
  const [title, description] = copy[module];
  if (loading) return <section className="wrap section"><p role="status">Checking your account…</p></section>;
  if (!session) return <section className="wrap section"><span className="eyebrow">YOUR PRACTICE SPACE</span><h1>Sign in to continue<em>.</em></h1><Link className="button" to="/account">Student sign in</Link></section>;
  return <PortalShell><section className="section portal-module"><span className="eyebrow">STUDENT PORTAL</span><h1>{title}<em>.</em></h1><p>{description}</p><div className="notice"><b>Not released yet.</b><br/>This area stays locked until its server rules, content review and authorization tests pass.</div></section></PortalShell>;
}
