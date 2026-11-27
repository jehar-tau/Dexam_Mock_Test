import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { freeAllowance, money, passPlans } from "./config.js";
import { Arrow } from "./Art.jsx";
import { platform } from "./platform.js";
import { useAuthState } from "./useAuth.js";
import { duoClaimMessage, duoInviteLink, duoTokenPattern } from "./pass-access.js";
import { rememberReturn } from "./return-path.js";

// What a free account gets and what the pass adds. Each free limit is enforced
// on the server; this list only describes them.
export const freeVsPass = Object.freeze([
  ["Year-wise papers", "Every released paper, timed, with the answer key", "The same papers"],
  ["Worked solutions", `The first ${freeAllowance.workedSolutionsPerPaper} questions of each paper`, "Every question"],
  ["Topic practice", `One ${freeAllowance.topicSessionQuestions}-question session a day`, "Unlimited sessions of 10, 20 or 30 questions"],
  ["Learn", "The Foundations level and the first theory lesson of each topic", "Exam standard, Exam hard and Mastery, and every theory lesson"],
  ["Teacher drawing marking", "Not included", `${freeAllowance.drawingMarkingPerMonth} drawings a month`],
]);

export function FreeVsPass() {
  return <section className="wrap free-vs-pass" aria-labelledby="free-vs-pass-heading">
    <span className="eyebrow">START FREE</span>
    <h2 id="free-vs-pass-heading">A taste of everything. <em>The pass opens the rest.</em></h2>
    <table>
      <thead><tr><th scope="col"><span className="sr-only">Part of DMocks</span></th><th scope="col">Free account</th><th scope="col">With a pass</th></tr></thead>
      <tbody>{freeVsPass.map(([part, free, paid]) => <tr key={part}><th scope="row">{part}</th><td>{free}</td><td>{paid}</td></tr>)}</tbody>
    </table>
  </section>;
}

// The two passes as one choice. `onChange` receives the plan id.
export function PlanChoice({ value, onChange, disabled = false }) {
  return <fieldset className="plan-choice" disabled={disabled}>
    <legend>Choose your pass</legend>
    {Object.values(passPlans).map(plan => <label key={plan.id} className={value === plan.id ? "is-selected" : ""}>
      <input type="radio" name="pass-plan" value={plan.id} checked={value === plan.id} onChange={() => onChange(plan.id)} />
      <span className="plan-choice-name">{plan.name}</span>
      <span className="plan-choice-price">{money(plan.price)}</span>
      <span className="plan-choice-detail">{plan.seats === 1 ? "One student, 12 months"
        : `Two students, 12 months each · ${money(plan.price / plan.seats)} per student`}</span>
    </label>)}
  </fieldset>;
}

export const duoExplanation = "You pay once and your pass starts straight away. You also get a one-time link for one friend. When they sign in with Google through the link, they get their own 12-month pass. The link works once, for 30 days.";

// Shown to the payer after a Duo purchase. Reads the invite from the server.
export function DuoInvitePanel({ rpc, origin = window.location.origin }) {
  const [invite, setInvite] = useState(null), [copied, setCopied] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    rpc("my_duo_invite", undefined, controller.signal).then(value => {
      if (!controller.signal.aborted && value && typeof value.status === "string") setInvite(value);
    }, () => {});
    return () => controller.abort();
  }, [rpc]);
  if (!invite || invite.status === "none") return null;
  const date = value => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const link = invite.status === "open" && duoTokenPattern.test(invite.token ?? "") ? duoInviteLink(origin, invite.token) : null;
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); } };
  return <section className="duo-invite" aria-label="Duo invite">
    <span className="eyebrow">YOUR DUO INVITE</span>
    {link ? <>
      <p>Send this link to one friend. It works once, until {date(invite.expiresAt)}.</p>
      <div className="duo-invite-link">
        <input readOnly value={link} aria-label="Duo invite link" onFocus={event => event.target.select()} />
        <button type="button" className="button quiet" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
      </div>
    </> : invite.status === "redeemed" ? <p>Your friend claimed their pass on {date(invite.redeemedAt)}.</p>
      : invite.status === "expired" ? <p>This invite expired on {date(invite.expiresAt)}. <Link to="/contact">Contact support</Link> if your friend could not use it.</p>
      : <p>This invite is no longer available. <Link to="/contact">Contact support</Link> with questions.</p>}
  </section>;
}

// /duo/:token — a friend claims the second seat of a Duo pass.
export function DuoClaim() {
  const { token = "" } = useParams();
  const { session, loading } = useAuthState();
  const navigate = useNavigate();
  const heading = useRef(null);
  const [state, setState] = useState({ status: "ready", message: "" });
  const valid = duoTokenPattern.test(token);
  useEffect(() => { heading.current?.focus(); }, []);
  const signIn = () => { rememberReturn(`/duo/${token}`); navigate("/account"); };
  const claim = async () => {
    if (!platform || state.status === "claiming") return;
    setState({ status: "claiming", message: "" });
    try {
      const { data, error } = await platform.rpc("redeem_duo_invite", { p_token: token });
      if (error) throw error;
      if (data?.active !== true) throw new Error("Unconfirmed");
      setState({ status: "claimed", message: "" });
    } catch (error) {
      setState({ status: "failed", message: duoClaimMessage(error) });
    }
  };
  return <section className="wrap page-intro centered duo-claim">
    <span className="eyebrow">A DUO PASS INVITE</span>
    <h1 ref={heading} tabIndex={-1}>Your friend got you <em>a pass.</em></h1>
    {!valid ? <p role="alert">This invite link is not valid. Ask your friend to copy it again from their DMocks account.</p>
      : loading ? <p role="status">Checking your account…</p>
      : state.status === "claimed" ? <>
        <p className="success" role="status">Your 12-month pass is active.</p>
        <Link className="button" to="/dashboard">Open your workspace <Arrow size={18} /></Link>
      </> : !session ? <>
        <p>Sign in with Google to claim your own 12-month DMocks pass. The invite works once.</p>
        <button type="button" className="button" onClick={signIn}>Continue with Google <Arrow size={18} /></button>
      </> : <>
        <p>Signed in as {session.user.email}. Claim the pass for this account. It cannot be moved to another account later.</p>
        <button type="button" className="button" disabled={state.status === "claiming"} onClick={() => void claim()}>
          {state.status === "claiming" ? "Claiming…" : "Claim my pass"} <Arrow size={18} />
        </button>
        {state.message && <p className="error" role="alert">{state.message}</p>}
      </>}
  </section>;
}
