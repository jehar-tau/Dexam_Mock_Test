import React, { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuthState } from "./useAuth.js";
import { portalItems, portalModules } from "./portalModel.mjs";
import {postLaunchPreview}from'./launch-scope.js';
import { hostedStudentPreview, studentPreview } from "./student-preview.js";
import {launchNavigation,deferredModules}from'./launch-scope.mjs';

export function PortalShell({ children }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const previewRoute = (import.meta.env.DEV || __DMOCKS_STAGING_REVIEW_PREVIEW__) && studentPreview && (
    pathname === "/portal-preview" || pathname.startsWith("/portal-preview/") || pathname.startsWith("/learn-programme-preview") ||
    ["/exam-mocks-preview", "/all-india-preview", "/topic-practice-preview", "/learn-preview", "/community-preview"].includes(pathname)
  );
  const expandedPreview = previewRoute && (postLaunchPreview || hostedStudentPreview);
  const previewNavigation = expandedPreview ? [
    { to: "/portal-preview", label: "Overview", mark: "O", end: true },
    { to: "/exam-mocks-preview", label: "Exam-wise mocks", mark: "M" },
    { to: "/all-india-preview", label: "All India mocks", mark: "A" },
    { to: "/topic-practice-preview", label: "Topic practice", mark: "P" },
    { to: "/learn-preview", label: "Learn", mark: "L" },
    { to: "/community-preview", label: "Community", mark: "C" },
  ] : previewRoute ? [
    { ...launchNavigation[0], to: "/portal-preview" },
    { ...launchNavigation[1], to: "/exam-mocks-preview" },
    { ...launchNavigation[2], to: "/learn-preview" },
  ] : null;
  const navigation = previewNavigation ?? (postLaunchPreview ? portalItems : launchNavigation);
  return <div className="portal-shell">
    <button className="portal-menu-button" aria-expanded={open} aria-controls="student-navigation" onClick={() => setOpen(!open)}>{open ? "Close" : "Student menu"}</button>
    <aside className={open ? "portal-sidebar is-open" : "portal-sidebar"} id="student-navigation">
      <span className="eyebrow">YOUR DMOCKS SPACE</span>
      <nav aria-label="Student workspace">
        {navigation.map(({to, label, mark, end}) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}><i aria-hidden="true">{mark}</i><span>{label}</span></NavLink>)}
      </nav>
      {!previewRoute && <NavLink className="portal-account-link" to="/account">Account & sign out</NavLink>}
    </aside>
    <div className="portal-content">{children}</div>
  </div>;
}

export function DeferredModule({module}){
 return<PortalShell><section className="wrap section"><span className="eyebrow">COMING LATER</span><h1>{deferredModules[module]??'This area'}<em>.</em></h1>
  <p>This area is outside the first paid release. Your annual pass covers only the explicitly released papers in the catalogue.</p>
  <Link className="button" to="/dashboard/mocks">View released papers</Link>
 </section></PortalShell>;
}

export function PortalModule({ module }) {
  const { session, loading } = useAuthState();
  const [title, description] = portalModules[module];
  if (loading) return <section className="wrap section"><p role="status">Checking your account…</p></section>;
  if (!session) return <section className="wrap section"><span className="eyebrow">YOUR PRACTICE SPACE</span><h1>Sign in to continue<em>.</em></h1><Link className="button" to="/account">Student sign in</Link></section>;
  return <PortalShell><section className="section portal-module"><span className="eyebrow">STUDENT PORTAL</span><h1>{title}<em>.</em></h1><p>{description}</p><div className="notice"><b>Not released yet.</b><br/>This area stays locked until its server rules, content review and authorization tests pass.</div></section></PortalShell>;
}
