import React, { useEffect, useId, useRef, useState } from "react";
import { communityDate } from "./CommunityFrame.jsx";
import { communityFailure, communityNoteLimit, validateCommunityNote } from "./community-library.js";

// A private note on a post. Only its author ever sees it; it appears in Saved
// and in the prep space, and search finds it.
export function CommunityNotePanel({ postId, rpc }) {
  const fieldId = useId(), helpId = useId();
  const [note, setNote] = useState(null), [draft, setDraft] = useState(""), [updatedAt, setUpdatedAt] = useState(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [open, setOpen] = useState(false);
  const scope = useRef(null);
  useEffect(() => {
    const controller = new AbortController(); scope.current = controller;
    setNote(null); setDraft(""); setMessage(""); setOpen(false);
    (async () => {
      try {
        const value = validateCommunityNote(await rpc("community_my_note", { p_post_id: postId }, controller.signal), postId);
        if (controller.signal.aborted) return;
        setNote(value.note ?? ""); setDraft(value.note ?? ""); setUpdatedAt(value.updatedAt); setOpen(Boolean(value.note));
      } catch { if (!controller.signal.aborted) { setNote(""); setMessage("Couldn’t load your note."); } }
    })();
    return () => controller.abort();
  }, [rpc, postId]);
  async function save(event) {
    event.preventDefault();
    const signal = scope.current?.signal;
    if (busy || note === null || !signal || signal.aborted) return;
    setBusy(true); setMessage("");
    try {
      const value = validateCommunityNote(await rpc("set_community_note", { p_post_id: postId, p_body: draft }, signal), postId);
      if (signal.aborted) return;
      setNote(value.note ?? ""); setDraft(value.note ?? ""); setUpdatedAt(value.updatedAt);
      setMessage(value.note ? "Note saved. Only you can see it." : "Note removed.");
    } catch (error) { if (!signal.aborted) setMessage(communityFailure(error, "Your note didn’t save. Try again.")); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  // Opens by itself when a note exists; after that the student decides.
  return <details className="community-note-panel" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>My private note{note ? "" : " (none yet)"}</summary>
    <form className="admin-form" onSubmit={save}>
      <label htmlFor={fieldId}>Note for yourself</label>
      <textarea id={fieldId} value={draft} rows={4} maxLength={communityNoteLimit} disabled={note === null || busy} aria-describedby={helpId}
        onChange={event => setDraft(event.target.value)} placeholder="What to try, what to remember, what to ask a teacher" />
      <small id={helpId}>Only you can see this note.{updatedAt ? ` Last saved ${communityDate(updatedAt)}.` : ""}</small>
      <div className="community-editor-actions">
        <button className="button quiet" type="submit" aria-disabled={busy || note === null || draft.trim() === (note ?? "")}>{busy ? "Saving…" : "Save note"}</button>
        {note && <button className="text-button" type="button" disabled={busy} onClick={() => setDraft("")}>Clear</button>}
      </div>
      {message && <p role="status">{message}</p>}
    </form>
  </details>;
}
