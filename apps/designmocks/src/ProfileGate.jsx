// Owner's request, 28 Nov 2026: after about 10 minutes of use a signed-in student must
// complete their profile (name, phone, exams, appearing year, city, and where the
// backend supports it, study stage and state) before carrying on. The time counts only
// while a DMocks tab is visible, per account, on this device.
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { controlledPublicPortalMode, platform } from "./platform.js";
import { useAuthState } from "./useAuth.js";
import { verifiedAccountRpc } from "./account-identity.js";
import { candidateProfileResponse, profileDetailsComplete } from "./profileModel.mjs";
import { AccountAccessBoundary } from "./AccountAccess.jsx";
import { ProfileSession } from "./CandidateProfile.jsx";
import { profileGateDue, recordActiveTime } from "./profile-gate.mjs";

// Pages a student can always reach: the account, the profile itself and the notices.
const open = /^\/(account|onboarding|terms|privacy|refunds|contact)(\/|$)/;
const storage = () => { try { return window.localStorage; } catch { return null; } };

function useActiveMinutes(actor) {
  const [due, setDue] = useState(() => profileGateDue(storage(), actor));
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible" && recordActiveTime(storage(), actor, 15000)) setDue(true); };
    const timer = window.setInterval(tick, 15000);
    return () => window.clearInterval(timer);
  }, [actor]);
  return due;
}

function GateDialog({ actor, onDone }) {
  const dialog = useRef(null), heading = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal?.();
    heading.current?.focus();
  }, []);
  return <dialog ref={dialog} className="profile-gate" aria-labelledby="profile-gate-title" onCancel={event => event.preventDefault()}>
    <span className="eyebrow">ONE MORE STEP</span>
    <h2 id="profile-gate-title" ref={heading} tabIndex={-1}>Tell us about <em>your preparation.</em></h2>
    <p>Fill in your details once to keep practising. We use them for your account, your results and to help with your exam.</p>
    <AccountAccessBoundary actorId={actor} headingRef={heading} kind="profile"><ProfileSession required onComplete={onDone} /></AccountAccessBoundary>
    <p className="profile-gate-links"><Link to="/privacy" target="_blank" rel="noreferrer">How we use your details</Link> · <Link to="/account">Account and sign out</Link></p>
  </dialog>;
}

function AccountGate({ actor }) {
  const due = useActiveMinutes(actor), { pathname } = useLocation();
  const [state, setState] = useState("unknown");
  useEffect(() => {
    if (!due || state !== "unknown") return;
    const controller = new AbortController();
    verifiedAccountRpc(platform.auth, platform, actor, "my_candidate_profile", undefined, controller.signal)
      .then(({ data, error }) => {
        if (error) throw error;
        if (!controller.signal.aborted) setState(profileDetailsComplete(candidateProfileResponse(data)) ? "complete" : "needed");
      })
      // A profile that can't be read never locks a student out.
      .catch(() => { if (!controller.signal.aborted) setState("complete"); });
    return () => controller.abort();
  }, [due, state, actor]);
  if (state !== "needed" || open.test(pathname)) return null;
  return <GateDialog actor={actor} onDone={() => setState("complete")} />;
}

export function ProfileGate() {
  const { session } = useAuthState();
  if (!controlledPublicPortalMode || !platform || !session) return null;
  return <AccountGate key={session.user.id} actor={session.user.id} />;
}
