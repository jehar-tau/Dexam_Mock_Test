import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CommunityFrame, CommunityRules, CommunityStandingNotice, useCommunityRpc, useCommunityStanding } from "./CommunityFrame.jsx";
import { ARTICLE_EXAMS, ARTICLE_TITLE, ARTICLE_TOPIC_MAX, WORK_PROMPT, normalizeWork, workProblems } from "./community-article.mjs";
import { communityFailure } from "./community-library.js";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function WorkSession() {
  const rpc = useCommunityRpc(), navigate = useNavigate(), standing = useCommunityStanding(rpc);
  const examId = useId(), problemsId = useId(), intentHelp = useId(), requestHelp = useId();
  const [fields, setFields] = useState({ exam: "nid", topic: "", title: "", intent: "", request: "" });
  const [problems, setProblems] = useState(null), [busy, setBusy] = useState(false);
  const requestId = useRef(null), problemList = useRef(null), scope = useRef(null);
  useEffect(() => { const controller = new AbortController(); scope.current = controller; return () => controller.abort(); }, []);
  useLayoutEffect(() => { if (problems) problemList.current?.focus(); }, [problems]);
  const change = patch => { requestId.current = null; setProblems(null); setFields(current => ({ ...current, ...patch })); };
  async function submit(event) {
    event.preventDefault();
    const signal = scope.current?.signal;
    if (busy || !signal || signal.aborted) return;
    const found = workProblems(fields);
    if (Object.keys(found).length) { setProblems(Object.values(found)); return; }
    const value = normalizeWork(fields);
    setBusy(true); setProblems(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const receipt = await rpc("create_community_work", { p_exam: value.exam, p_topic: value.topic, p_title: value.title, p_intent: value.intent,
        p_request: value.request, p_request_id: requestId.current }, signal);
      if (signal.aborted) return;
      if (!receipt || !uuid.test(receipt.id) || receipt.id !== receipt.postId) throw new Error("Unverified receipt");
      navigate(`/dashboard/community/post/${receipt.id}`, { state: { notice: receipt.canUpload ? "Your work is posted. Now add up to three images of it below." : "Your work is saved but is not visible right now." } });
    } catch (error) {
      if (signal.aborted) return;
      if (typeof error?.details === "string" && error.details.startsWith("community_")) requestId.current = null;
      setProblems([communityFailure(error, "Your post did not confirm. Post again to check; it will not be posted twice.")]);
      setBusy(false);
    }
  }
  const paused = Boolean(standing?.sanction);
  return <form className="admin-form community-work-form" onSubmit={submit} noValidate aria-describedby={problems ? problemsId : undefined}>
    <CommunityStandingNotice standing={standing} />
    <fieldset className="community-fields" aria-label="Share work for feedback" disabled={busy || paused}>
      <div><label htmlFor={examId}>Exam</label>
        <select id={examId} value={fields.exam} onChange={event => change({ exam: event.target.value })}>
          {ARTICLE_EXAMS.map(exam => <option key={exam} value={exam}>{exam.toUpperCase()}</option>)}
        </select></div>
      <label>Topic<input value={fields.topic} maxLength={ARTICLE_TOPIC_MAX} onChange={event => change({ topic: event.target.value })} placeholder="For example: Poster design" /></label>
      <label>Title<input value={fields.title} maxLength={ARTICLE_TITLE.max} onChange={event => change({ title: event.target.value })} /></label>
      <label>What I was trying to do
        <textarea value={fields.intent} rows={4} maxLength={WORK_PROMPT.max} aria-describedby={intentHelp} onChange={event => change({ intent: event.target.value })} /></label>
      <small id={intentHelp}>The brief, the time you had and the idea behind the piece.</small>
      <label>What I want feedback on
        <textarea value={fields.request} rows={4} maxLength={WORK_PROMPT.max} aria-describedby={requestHelp} onChange={event => change({ request: event.target.value })} /></label>
      <small id={requestHelp}>Ask something specific: composition, proportion, colour, how you used the time.</small>
      <CommunityRules />
      {problems && <div id={problemsId} ref={problemList} tabIndex={-1} role="alert" className="error"><p>Before this can be posted:</p><ul>{problems.map(problem => <li key={problem}>{problem}</li>)}</ul></div>}
      <button className="button" type="submit">{busy ? "Posting…" : "Post and add images"}</button>
      <small>After posting you add up to three images of the piece. Use your own work, and remove names, faces and school details from the images.</small>
    </fieldset>
  </form>;
}

export function CommunityWorkForm() {
  return <CommunityFrame title="Ask for" accent="feedback." intro="Say what you were aiming for and what you want to improve. Specific questions get useful answers.">
    <WorkSession />
  </CommunityFrame>;
}
