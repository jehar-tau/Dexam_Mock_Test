import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { communityDate } from "./CommunityFrame.jsx";
import { communityFailure, communityRoleInput, validateCommunityRoles, validateCommunitySanctions } from "./community-library.js";

// Administrator panel: who is a teacher or moderator, and who is paused.
// Pausing an author is done from the post or reply itself.
function StaffSession({ rpc }) {
  const emailId = useId();
  const [roles, setRoles] = useState(null), [sanctions, setSanctions] = useState(null), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(""), [teacher, setTeacher] = useState(true), [moderator, setModerator] = useState(false);
  const scope = useRef(null), heading = useRef(null);
  const load = useCallback(async signal => {
    const [r, s] = await Promise.all([rpc("admin_community_roles", {}, signal), rpc("admin_community_sanctions", {}, signal)]);
    if (signal.aborted) return;
    setRoles(validateCommunityRoles(r)); setSanctions(validateCommunitySanctions(s));
  }, [rpc]);
  useEffect(() => {
    const controller = new AbortController(); scope.current = controller;
    load(controller.signal).catch(() => { if (!controller.signal.aborted) { setRoles([]); setSanctions([]); setStatus("Couldn’t load Community roles. Refresh to try again."); } });
    return () => controller.abort();
  }, [load]);
  async function run(action, fallback) {
    const signal = scope.current?.signal;
    if (busy || !signal || signal.aborted) return;
    setBusy(true); setStatus("");
    try { await action(signal); }
    catch (error) { if (!signal.aborted) setStatus(error?.details || error?.code ? communityFailure(error, fallback) : error instanceof Error && error.message ? error.message : fallback); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  const saveRole = event => { event.preventDefault(); return run(async signal => {
    const input = communityRoleInput(email, teacher, moderator);
    await rpc("admin_set_community_role", input, signal);
    if (signal.aborted) return;
    await load(signal);
    setEmail(""); setTeacher(true); setModerator(false);
    setStatus(input.p_teacher ? `${input.p_email} is now a teacher${input.p_moderator ? " and moderator" : ""}.` : `${input.p_email} no longer has a Community role.`);
  }, "The role didn’t save. Try again."); };
  const removeRole = role => run(async signal => {
    await rpc("admin_set_community_role", { p_email: role.email, p_teacher: false, p_moderator: false }, signal);
    if (signal.aborted) return;
    await load(signal); setStatus(`${role.email} no longer has a Community role.`); heading.current?.focus();
  }, "The role wasn’t removed. Try again.");
  const lift = sanction => run(async signal => {
    await rpc("admin_lift_community_sanction", { p_sanction_id: sanction.id }, signal);
    if (signal.aborted) return;
    await load(signal); setStatus(`${sanction.email} can post again.`); heading.current?.focus();
  }, "The pause wasn’t lifted. Try again.");
  return <section className="community-staff" aria-label="Community roles and pauses">
    <h3 ref={heading} tabIndex={-1}>Community roles and pauses</h3>
    {status && <p role="status">{status}</p>}
    <form className="admin-form" onSubmit={saveRole} noValidate>
      <div><label htmlFor={emailId}>Account email</label>
        <input id={emailId} type="email" value={email} disabled={busy} autoComplete="off" onChange={event => setEmail(event.target.value)} /></div>
      <fieldset className="community-folder-choices" disabled={busy}><legend>Roles</legend>
        <label><input type="checkbox" checked={teacher} onChange={event => { setTeacher(event.target.checked); if (!event.target.checked) setModerator(false); }} /> Teacher: label on posts, may feature articles and work</label>
        <label><input type="checkbox" checked={moderator} disabled={!teacher} onChange={event => setModerator(event.target.checked)} /> Moderator: may hold content for your review</label>
      </fieldset>
      <button className="button quiet" type="submit" disabled={busy}>Save role</button>
      <small>Untick Teacher to remove every role from that account.</small>
    </form>
    <h4>Teachers and moderators</h4>
    {roles === null ? <p role="status">Loading…</p> : roles.length === 0 ? <p className="muted">No teachers yet.</p> : <ul className="community-staff-list">
      {roles.map(role => <li key={role.email}><span>{role.name ? `${role.name} · ` : ""}{role.email} · {role.moderator ? "Teacher and moderator" : "Teacher"}</span>
        <button type="button" className="text-button" disabled={busy} onClick={() => removeRole(role)}>Remove roles from {role.email}</button></li>)}
    </ul>}
    <h4>Paused authors</h4>
    {sanctions === null ? <p role="status">Loading…</p> : sanctions.length === 0 ? <p className="muted">Nobody is paused. Pause an author from their post or reply.</p> : <ul className="community-staff-list">
      {sanctions.map(item => <li key={item.id}><span>{item.name ? `${item.name} · ` : ""}{item.email} · {item.kind === "ban" ? "until lifted" : `until ${communityDate(item.until)}`} · {item.reason}</span>
        <button type="button" className="text-button" disabled={busy} onClick={() => lift(item)}>Lift pause for {item.email}</button></li>)}
    </ul>}
  </section>;
}

export function CommunityStaff({ rpc, scopeKey }) {
  return <StaffSession key={scopeKey} rpc={rpc} />;
}
