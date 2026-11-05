import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuthState } from "./useAuth.js";
import { portalItems, portalModules } from "./portalModel.mjs";

export function PortalShell({ children }) {
  const [open, setOpen] = useState(false);
  return <div className="portal-shell">
    <button className="portal-menu-button" aria-expanded={open} aria-controls="student-navigation" onClick={() => setOpen(!open)}>{open ? "Close" : "Student menu"}</button>
    <aside className={open ? "portal-sidebar is-open" : "portal-sidebar"} id="student-navigation">
      <span className="eyebrow">YOUR DMOCKS SPACE</span>
      <nav aria-label="Student workspace">
        {portalItems.map(({to, label, mark, end}) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}><i aria-hidden="true">{mark}</i><span>{label}</span></NavLink>)}
      </nav>
      <NavLink className="portal-account-link" to="/account">Account & sign out</NavLink>
    </aside>
    <div className="portal-content">{children}</div>
  </div>;
}

export function PortalModule({ module }) {
  const { session, loading } = useAuthState();
  const [title, description] = portalModules[module];
  if (loading) return <section className="wrap section"><p role="status">Checking your account…</p></section>;
  if (!session) return <section className="wrap section"><span className="eyebrow">YOUR PRACTICE SPACE</span><h1>Sign in to continue<em>.</em></h1><Link className="button" to="/account">Student sign in</Link></section>;
  return <PortalShell><section className="section portal-module"><span className="eyebrow">STUDENT PORTAL</span><h1>{title}<em>.</em></h1><p>{description}</p><div className="notice"><b>Not released yet.</b><br/>This area stays locked until its server rules, content review and authorization tests pass.</div></section></PortalShell>;
}
