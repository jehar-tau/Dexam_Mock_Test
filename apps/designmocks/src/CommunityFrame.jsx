import React, { useCallback, useLayoutEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { PortalShell } from "./PortalShell.jsx";
import { AccountAccessBoundary, useAccountServices } from "./AccountAccess.jsx";
import { withAccountDeadline } from "./account-request.js";
import { useAuthState } from "./useAuth.js";

export function CommunityNav() {
  const item = (to, label, end = false) => <NavLink to={to} end={end} className={({ isActive }) => isActive ? "active" : undefined}>{label}</NavLink>;
  return <nav className="community-nav" aria-label="Community sections">
    {item("/dashboard/community/articles", "Articles")}
    {item("/dashboard/community", "Discussions", true)}
    {item("/dashboard/community/saved", "Saved")}
    {item("/dashboard/community/write", "Write")}
  </nav>;
}

// Account-bound, deadline-limited calls. Only valid inside CommunityFrame.
export function useCommunityRpc() {
  const services = useAccountServices();
  return useCallback((name, input, signal) => withAccountDeadline(active => services.rpc(name, input, active), signal), [services]);
}

export function communityDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export const CommunityRules = () => <details className="community-rules">
  <summary>Community rules</summary>
  <ol>
    <li>Be kind and specific. Critique the work, not the person.</li>
    <li>Never share a phone number, email, social handle, address or school.</li>
    <li>Post only your own work, or say whose it is.</li>
    <li>No questions or answers from a test that is still open.</li>
    <li>Report anything that worries you. Reports are private.</li>
  </ol>
</details>;

export function CommunityFrame({ title, accent, intro, children }) {
  const { session, loading } = useAuthState();
  const location = useLocation(), heading = useRef(null), scopeKey = (session?.user.id ?? "signed-out") + ":" + location.key, previous = useRef(scopeKey);
  useLayoutEffect(() => {
    if (previous.current !== scopeKey && (document.activeElement === document.body || heading.current?.parentElement.contains(document.activeElement))) heading.current?.focus();
    previous.current = scopeKey;
  }, [scopeKey]);
  if (loading) return <section className="wrap section"><p role="status">Checking your account…</p></section>;
  if (!session) return <section className="wrap section"><h1>Sign in to the <em>community.</em></h1><Link to="/account">Student sign in</Link></section>;
  return <PortalShell><section className="wrap section community-page">
    <span className="eyebrow">COMMUNITY</span>
    <h1 ref={heading} tabIndex={-1}>{title} <em>{accent}</em></h1>
    {intro && <p>{intro}</p>}
    <CommunityNav />
    <AccountAccessBoundary key={scopeKey} kind="community" actorId={session.user.id} headingRef={heading}>{children}</AccountAccessBoundary>
  </section></PortalShell>;
}
