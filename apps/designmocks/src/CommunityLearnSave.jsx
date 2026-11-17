import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AccountAccessBoundary } from "./AccountAccess.jsx";
import { useCommunityRpc } from "./CommunityFrame.jsx";
import { communityFailure, validateLearnSaved } from "./community-library.js";

function SaveButton({ programme }) {
  const rpc = useCommunityRpc();
  const [saved, setSaved] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const scope = useRef(null);
  useEffect(() => {
    const controller = new AbortController(); scope.current = controller;
    (async () => {
      try { const value = validateLearnSaved(await rpc("learn_programme_saved", { p_programme: programme.slug }, controller.signal), programme.slug); if (!controller.signal.aborted) setSaved(value); }
      catch { if (!controller.signal.aborted) setSaved(false); }
    })();
    return () => controller.abort();
  }, [rpc, programme.slug]);
  async function toggle() {
    const signal = scope.current?.signal;
    if (busy || saved === null || !signal || signal.aborted) return;
    setBusy(true); setMessage("");
    try {
      const value = validateLearnSaved(await rpc("set_learn_programme_saved", { p_programme: programme.slug, p_title: programme.title, p_saved: !saved }, signal), programme.slug);
      if (signal.aborted) return;
      setSaved(value); setMessage(value ? "Saved to your prep space." : "Removed from your prep space.");
    } catch (error) { if (!signal.aborted) setMessage(communityFailure(error, "That didn’t save. Try again.")); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  return <div className="learn-save-prep">
    <button type="button" className="button quiet" aria-pressed={saved === true} aria-disabled={busy || saved === null} onClick={toggle}>
      {saved ? "Saved to my prep" : "Save to my prep"}</button>
    <Link to="/dashboard/community/prep">Open my prep</Link>
    {message && <p role="status">{message}</p>}
  </div>;
}

// Shown on Learn programme pages in the preview only. Learn itself does not
// depend on Community; this keeps a programme next to the student's notes.
export function LearnSaveToPrep({ programme, actorId, headingRef }) {
  return <AccountAccessBoundary kind="community" actorId={actorId} headingRef={headingRef}><SaveButton programme={programme} /></AccountAccessBoundary>;
}
