import React, { useCallback, useEffect, useState } from "react";
import { drawingReviewerChange } from "./drawing-review.js";

export function DrawingReviewerRoster({ rpc, refreshDrawings }) {
  const [reviewers, setReviewers] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => rpc("admin_drawing_reviewers"), [rpc]);

  useEffect(() => {
    let alive = true;
    load().then((data) => { if (alive) setReviewers(data); }, (failure) => {
      if (alive) setError(failure.message);
    });
    return () => { alive = false; };
  }, [load, loadAttempt]);

  const update = async (event, enabled) => {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const changed = await rpc("admin_set_drawing_reviewer", drawingReviewerChange(new FormData(form), enabled));
      form.reset();
      setMessage(changed ? (enabled ? "Review access granted." : "Review access revoked.") : "Review access was already up to date.");
      await Promise.all([load().then(setReviewers), enabled ? undefined : refreshDrawings()]);
    } catch (failure) {
      if (failure.code === "42501") setReviewers(null);
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return <section aria-labelledby="drawing-reviewer-roster">
    <h2 id="drawing-reviewer-roster">Drawing reviewer access</h2>
    <p>Use an existing DMocks account ID. Revoking access returns ungraded claims to the queue. Administrators can finish saved reviews.</p>
    <form className="admin-form" onSubmit={(event) => update(event, true)}>
      <label>Reviewer account ID<input name="userId" required /></label>
      <label>Reason for granting access<input name="reason" required minLength={5} maxLength={400} /></label>
      <button type="submit" disabled={busy || reviewers === null}>Grant review access</button>
    </form>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {reviewers === null && (error ? <button type="button" className="button quiet" onClick={() => {
      setError("");
      setLoadAttempt((current) => current + 1);
    }}>Retry reviewer list</button> : <p role="status">Loading reviewer list…</p>)}
    {reviewers?.length === 0 && <p>No separate reviewer accounts have access.</p>}
    <div className="admin-list">
      {reviewers?.map(({ userId }) => <article key={userId}>
        <b className="drawing-reviewer-id">{userId}</b>
        <form className="admin-form" onSubmit={(event) => update(event, false)}>
          <input name="userId" type="hidden" value={userId} />
          <label>Reason for revoking access<input name="reason" required minLength={5} maxLength={400} /></label>
          <button type="submit" disabled={busy}>Revoke review access</button>
        </form>
      </article>)}
    </div>
  </section>;
}
