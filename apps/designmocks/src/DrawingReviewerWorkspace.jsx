import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { DrawingReviewQueue } from "./DrawingReviewQueue.jsx";
import { drawingReviewActions } from "./drawing-review.js";
import { useAuthState } from "./useAuth.js";
import { DrawingReviewerAccessBoundary, useStaffServices } from "./AdminAccess.jsx";
import { createDrawingReviewRequests, isDrawingReviewUnavailable } from "./drawing-review-lifecycle.js";

const actionMessages = {
  admin_claim_drawing_review: "Review claimed.",
  admin_return_drawing_review: "Review returned to the queue.",
  admin_review_drawing: "Grade and feedback saved.",
  admin_release_drawing_review: "Grade finalized.",
};

function ReviewerQueuePage({ scope, cursor, pageNumber, onPrevious, onNext, onChanged }) {
  const {rpc,isCurrent}=useStaffServices();
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0),[notice,setNotice]=useState("");
  const requests=useRef(null),heading=useRef(null);
  const refresh = () => setReload((current) => current + 1);
  useLayoutEffect(()=>{
    const value=createDrawingReviewRequests(isCurrent);requests.current=value;
    return()=>value.dispose();
  },[rpc,isCurrent]);

  useEffect(() => {
    const context=requests.current;setNotice("");
    context.read(signal=>rpc("my_drawing_review_page",{p_scope:scope,p_after:cursor},signal)).then(value=>{
      if(value.current())setResult(value.error?{error:value.error}:{data:value.data});
    });
    return()=>context.invalidateReads();
  }, [scope, cursor, reload,rpc]);

  const unavailable=(reviewId,error)=>{
    const context=requests.current;
    if(!context?.isCurrent()||!isDrawingReviewUnavailable(error))return;
    context.invalidateReads();
    setResult(value=>value?.data?{data:{...value.data,items:value.data.items.filter(item=>item.reviewId!==reviewId)}}:value);
    setNotice("That review changed or is no longer available. Refresh your reviews to load current work.");
    requestAnimationFrame(()=>{if(context.isCurrent())heading.current?.focus();});
  };

  const actions = drawingReviewActions(async (procedure, input) => {
    const context=requests.current;context.assertCurrent();
    try{await rpc(procedure,input,context.signal);context.assertCurrent();}
    catch(error){unavailable(input.p_review_id,error);throw new Error(isDrawingReviewUnavailable(error)?"This review changed or is unavailable. Refresh your reviews.":"The action could not be confirmed. It may already be saved. Refresh your reviews before trying again.");}
  }, (procedure) => {
    if(!requests.current?.isCurrent())return;
    onChanged(procedure);
    if (procedure !== "admin_claim_drawing_review") refresh();
  });

  if (!result) return <p role="status">Loading drawing reviews…</p>;
  if (result.error) return <div>
    <p role="alert">Couldn’t load drawing reviews.</p>
    <button type="button" className="button quiet" onClick={refresh}>Try again</button>
  </div>;

  return <section aria-label="Drawing review page">
    <h2 ref={heading} tabIndex={-1}>{scope==="mine"?"My drawing reviews":"Available drawing reviews"}</h2>
    {notice&&<p role="status">{notice}</p>}
    <DrawingReviewQueue drawings={result.data.items} onRefresh={refresh} onMediaUnavailable={unavailable} {...actions} />
    {(pageNumber > 1 || result.data.nextCursor) && <nav className="admin-actions drawing-reviewer-nav" aria-label="Drawing review pages">
      <button type="button" className="button quiet" disabled={pageNumber === 1} onClick={onPrevious}>Previous page</button>
      <span>Page {pageNumber}</span>
      <button type="button" className="button quiet" disabled={!result.data.nextCursor} onClick={() => onNext(result.data.nextCursor)}>Next page</button>
    </nav>}
  </section>;
}

function ReviewerDesk() {
  const [scope, setScope] = useState("available");
  const [viewEpoch,setViewEpoch]=useState(0);
  const [cursors, setCursors] = useState([null]);
  const [message, setMessage] = useState("");
  const cursor = cursors.at(-1);
  const show = (nextScope) => {
    setViewEpoch(value=>value+1);
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
    <ReviewerQueuePage key={`${viewEpoch}:${scope}:${cursor ?? "first"}`} scope={scope} cursor={cursor}
      pageNumber={cursors.length} onPrevious={() => setCursors(cursors.slice(0, -1))}
      onNext={(nextCursor) => setCursors([...cursors, nextCursor])} onChanged={(procedure) => {
        if (procedure === "admin_claim_drawing_review") show("mine");
        setMessage(actionMessages[procedure]);
      }} />
  </>;
}

export function DrawingReviewerWorkspace() {
  const { session, loading } = useAuthState();
  const location=useLocation(),heading=useRef(null);
  return <section className="wrap section admin-page">
    <span className="eyebrow">DMOCKS TEACHER WORKSPACE</span>
    <h1 ref={heading} tabIndex={-1}>Drawing <em>reviews.</em></h1>
    <p>Claim an anonymous submission after its upload window closes, then score the drawings and give feedback.</p>
    {loading ? <p role="status">Checking your account…</p> : session
      ? <DrawingReviewerAccessBoundary key={`${session.user.id}:${location.key}`} actorId={session.user.id} headingRef={heading}><ReviewerDesk /></DrawingReviewerAccessBoundary>
      : <p>Please <Link to="/account">sign in</Link> with a reviewer account to continue.</p>}
  </section>;
}
