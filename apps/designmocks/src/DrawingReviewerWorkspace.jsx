import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DrawingReviewQueue } from "./DrawingReviewQueue.jsx";
import { drawingReviewActions } from "./drawing-review.js";
import { platform } from "./platform.js";
import { useAuthState } from "./useAuth.js";

const actionMessages = {
  admin_claim_drawing_review: "Review claimed.",
  admin_return_drawing_review: "Review returned to the queue.",
  admin_review_drawing: "Grade and feedback saved.",
  admin_release_drawing_review: "Grade finalized.",
};

function ReviewerQueuePage({ scope, cursor, pageNumber, onPrevious, onNext, onChanged }) {
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);
  const refresh = () => setReload((current) => current + 1);

  useEffect(() => {
    const controller = new AbortController();
    const update = (value) => {
      if (!controller.signal.aborted) setResult(value);
    };
    platform.rpc("my_drawing_review_page", { p_scope: scope, p_after: cursor })
      .abortSignal(controller.signal)
      .then(update, (error) => update({ error }));
    return () => controller.abort();
  }, [scope, cursor, reload]);

  const actions = drawingReviewActions(async (procedure, input) => {
    const { error } = await platform.rpc(procedure, input);
    if (error?.code === "42501") setResult({ error });
    if (error) throw error;
  }, (procedure) => {
    onChanged(procedure);
    if (procedure !== "admin_claim_drawing_review") refresh();
  });

  if (!result) return <p role="status">Loading drawing reviews…</p>;
  if (result.error?.code === "42501") return <p className="notice" role="status">Drawing reviewer access required.</p>;
  if (result.error) return <div>
    <p role="alert">Couldn’t load drawing reviews.</p>
    <button type="button" className="button quiet" onClick={refresh}>Try again</button>
  </div>;

  return <>
    <DrawingReviewQueue drawings={result.data.items} onRefresh={refresh} {...actions} />
    {(pageNumber > 1 || result.data.nextCursor) && <nav className="admin-actions drawing-reviewer-nav" aria-label="Drawing review pages">
      <button type="button" className="button quiet" disabled={pageNumber === 1} onClick={onPrevious}>Previous page</button>
      <span>Page {pageNumber}</span>
      <button type="button" className="button quiet" disabled={!result.data.nextCursor} onClick={() => onNext(result.data.nextCursor)}>Next page</button>
    </nav>}
  </>;
}

function ReviewerDesk() {
  const [scope, setScope] = useState("available");
  const [cursors, setCursors] = useState([null]);
  const [message, setMessage] = useState("");
  const cursor = cursors.at(-1);
  const show = (nextScope) => {
    setScope(nextScope);
    setCursors([null]);
    setMessage("");
  };
  return <>
    <div className="admin-actions drawing-reviewer-nav" role="group" aria-label="Drawing review views">
      <button type="button" className={scope === "available" ? "button" : "button quiet"}
        aria-pressed={scope === "available"} onClick={() => show("available")}>Available drawings</button>
      <button type="button" className={scope === "mine" ? "button" : "button quiet"}
        aria-pressed={scope === "mine"} onClick={() => show("mine")}>My reviews</button>
    </div>
    <p role="status">{message}</p>
    <ReviewerQueuePage key={`${scope}:${cursor ?? "first"}`} scope={scope} cursor={cursor}
      pageNumber={cursors.length} onPrevious={() => setCursors(cursors.slice(0, -1))}
      onNext={(nextCursor) => setCursors([...cursors, nextCursor])} onChanged={(procedure) => {
        if (procedure === "admin_claim_drawing_review") show("mine");
        setMessage(actionMessages[procedure]);
      }} />
  </>;
}

export function DrawingReviewerWorkspace() {
  const { session, loading } = useAuthState();
  return <section className="wrap section admin-page">
    <span className="eyebrow">DMOCKS TEACHER WORKSPACE</span>
    <h1>Drawing <em>reviews.</em></h1>
    <p>Claim an anonymous submission after its upload window closes, then score the drawings and give feedback.</p>
    {loading ? <p role="status">Checking your account…</p> : session
      ? <ReviewerDesk key={session.user.id} />
      : <p>Please <Link to="/account">sign in</Link> with a reviewer account to continue.</p>}
  </section>;
}
