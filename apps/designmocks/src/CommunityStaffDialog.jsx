import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { communityFailure, communityNote, communitySanctionInput, validateCommunityRevisions } from "./community-library.js";
import { communityDate } from "./CommunityFrame.jsx";

// One modal for the staff actions on a post or reply. `action` is
// { kind: "hold" | "sanction" | "history", targetType, targetId, label }.
// onClose(true) after a saved change, onClose(false) when dismissed.
export function CommunityStaffDialog({ action, rpc, onClose }) {
  const titleId = useId(), noteId = useId(), daysId = useId();
  const [note, setNote] = useState(""), [kind, setKind] = useState("mute"), [days, setDays] = useState("7");
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [history, setHistory] = useState(null);
  const dialog = useRef(null), scope = useRef(null), closed = useRef(false), first = useRef(null);
  useLayoutEffect(() => { if (!dialog.current.open) dialog.current.showModal(); first.current?.focus(); }, []);
  useEffect(() => {
    const controller = new AbortController(); scope.current = controller;
    if (action.kind === "history") (async () => {
      try { const value = validateCommunityRevisions(await rpc("admin_community_post_revisions", { p_post_id: action.targetId }, controller.signal), action.targetId); if (!controller.signal.aborted) setHistory(value); }
      catch (error) { if (!controller.signal.aborted) setMessage(communityFailure(error, "Couldn’t load the edit history. Close and try again.")); }
    })();
    return () => controller.abort();
  }, [action, rpc]);
  const close = saved => {
    if (closed.current) return;
    closed.current = true; scope.current?.abort();
    if (dialog.current?.open) dialog.current.close();
    onClose(Boolean(saved));
  };
  async function submit(event) {
    event.preventDefault();
    const signal = scope.current?.signal;
    if (busy || !signal || signal.aborted) return;
    let name, input;
    try {
      if (action.kind === "hold") { name = "moderator_hold_community"; input = { p_target_type: action.targetType, p_target_id: action.targetId, p_note: communityNote(note) }; }
      else { name = "admin_community_sanction"; input = communitySanctionInput(action.targetType, action.targetId, kind, days, note); }
    } catch (error) { setMessage(error.message); return; }
    setBusy(true); setMessage("");
    try { await rpc(name, input, signal); if (!signal.aborted) close(true); }
    catch (error) { if (!signal.aborted) { setMessage(communityFailure(error, "That didn’t save. Try again.")); setBusy(false); } }
  }
  const heading = action.kind === "hold" ? "Hold for review" : action.kind === "sanction" ? "Pause this author" : "Edit history";
  return <dialog ref={dialog} className="submit-dialog community-staff-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close(false); }} onClose={() => close(false)}>
    <h2 id={titleId}>{heading}</h2>
    {action.label && <p className="bank-question-prompt">{action.label}</p>}
    {message && <p role="alert" className="error">{message}</p>}
    {action.kind === "history" ? (history === null ? !message && <p role="status">Loading the edit history…</p> : <div className="community-history">
      <h3>Now</h3><p><strong>{history.current.title}</strong></p><p className="community-comment-body">{history.current.body}</p>
      {history.revisions.length === 0 ? <p className="muted">No earlier versions.</p> : history.revisions.map((item, index) => <section key={index} aria-label={`Version replaced ${communityDate(item.replacedAt)}`}>
        <h3>Replaced {communityDate(item.replacedAt)}</h3><p><strong>{item.title}</strong> · {item.topic}</p><p className="community-comment-body">{item.body}</p>
      </section>)}
    </div>) : <form className="admin-form" onSubmit={submit} noValidate>
      {action.kind === "hold"
        ? <p>This hides it from everyone now. An administrator reviews it and decides whether to restore it.</p>
        : <>
          <p>The author can still read, like and save, but cannot post, reply or edit. They see the reason you write here.</p>
          <fieldset className="community-folder-choices" disabled={busy}><legend>Pause</legend>
            <label><input ref={first} type="radio" name="kind" checked={kind === "mute"} onChange={() => setKind("mute")} /> For a number of days</label>
            <label><input type="radio" name="kind" checked={kind === "ban"} onChange={() => setKind("ban")} /> Until an administrator lifts it</label>
          </fieldset>
          {kind === "mute" && <div><label htmlFor={daysId}>Days (1 to 365)</label>
            <input id={daysId} type="number" inputMode="numeric" min={1} max={365} value={days} disabled={busy} onChange={event => setDays(event.target.value)} /></div>}
        </>}
      <div><label htmlFor={noteId}>{action.kind === "hold" ? "Note for the administrator" : "Reason shown to the author"}</label>
        <textarea ref={action.kind === "hold" ? first : undefined} id={noteId} value={note} maxLength={1000} rows={3} disabled={busy} onChange={event => setNote(event.target.value)} /></div>
      <button className="button" type="submit" disabled={busy}>{busy ? "Saving…" : action.kind === "hold" ? "Hold for review" : "Pause author"}</button>
    </form>}
    <button type="button" className="button quiet" ref={action.kind === "history" ? first : undefined} onClick={() => close(false)}>Close</button>
  </dialog>;
}
