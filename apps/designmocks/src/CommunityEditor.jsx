import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CommunityFrame, CommunityRules, communityDate, useCommunityRpc } from "./CommunityFrame.jsx";
import { ARTICLE_BODY, ARTICLE_EXAMS, ARTICLE_TITLE, ARTICLE_TOPIC_MAX, articleProblems, articleStats, normalizeArticle } from "./community-article.mjs";
import { ArticleEditor } from "./ArticleEditor.jsx";
import { communityFailure, validateCommunityDraftReceipt, validateCommunityDrafts } from "./community-library.js";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const empty = { exam: "uceed", topic: "", title: "", body: "" };
const snapshot = fields => JSON.stringify([fields.exam, fields.topic, fields.title, fields.body]);
const clock = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

function EditorSession() {
  const rpc = useCommunityRpc(), navigate = useNavigate(), bodyId = useId(), bodyLabel = useId(), problemsId = useId(), examId = useId();
  const [fields, setFields] = useState(empty), [drafts, setDrafts] = useState(null);
  const [draftId, setDraftId] = useState(null), [status, setStatus] = useState(""), [problems, setProblems] = useState(null), [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const problemList = useRef(null), titleInput = useRef(null);
  const live = useRef({ fields, draftId: null, saved: snapshot(empty), saving: null, requestId: null, published: false }), scope = useRef(null);
  live.current.fields = fields;
  useEffect(() => {
    const controller = new AbortController(); scope.current = controller;
    (async () => {
      try { const value = validateCommunityDrafts(await rpc("community_drafts", {}, controller.signal)); if (!controller.signal.aborted) setDrafts(value); }
      catch { if (!controller.signal.aborted) { setDrafts([]); setStatus("Couldn’t load your drafts. You can still write."); } }
    })();
    return () => controller.abort();
  }, [rpc]);
  useLayoutEffect(() => { if (problems) problemList.current?.focus(); }, [problems]);

  function change(patch) {
    live.current.requestId = null; // new text is a new publishing request
    setProblems(null); setFields(current => ({ ...current, ...patch }));
  }
  async function saveDraft({ quiet = false } = {}) {
    const state = live.current, signal = scope.current?.signal;
    if (!signal || signal.aborted || state.published) return false;
    if (state.saving) { await state.saving.catch(() => {}); }
    const current = state.fields, key = snapshot(current);
    if (key === state.saved) { if (!quiet) setStatus("Draft is up to date."); return true; }
    if (!current.title.trim() && !current.body.trim() && !state.draftId) { if (!quiet) setStatus("Write something before saving a draft."); return false; }
    const work = (async () => {
      const receipt = validateCommunityDraftReceipt(await rpc("save_community_draft",
        { p_draft_id: state.draftId, p_exam: current.exam, p_topic: current.topic.trim(), p_title: current.title.trim(), p_body: current.body }, signal));
      if (signal.aborted) return;
      state.draftId = receipt.id; state.saved = key; setDraftId(receipt.id);
      setDrafts(list => [{ id: receipt.id, ...current, topic: current.topic.trim(), title: current.title.trim(), updatedAt: receipt.updatedAt }, ...(list ?? []).filter(item => item.id !== receipt.id)]);
      setStatus(`Draft saved at ${clock()}.`);
    })();
    state.saving = work;
    try { await work; return true; }
    catch (error) { if (!signal.aborted) setStatus(communityFailure(error, "Draft not saved. Check your connection; your text is still here.")); return false; }
    finally { if (state.saving === work) state.saving = null; }
  }
  // Save quietly a few seconds after typing stops.
  useEffect(() => {
    if (busy || snapshot(fields) === live.current.saved || (!fields.title.trim() && !fields.body.trim())) return;
    const timer = setTimeout(() => { void saveDraft({ quiet: true }); }, 3000);
    return () => clearTimeout(timer);
  }, [fields, busy]);

  async function openDraft(draft) {
    await saveDraft({ quiet: true });
    const next = { exam: draft.exam ?? "uceed", topic: draft.topic, title: draft.title, body: draft.body };
    live.current.draftId = draft.id; live.current.saved = snapshot(next); live.current.requestId = null;
    setDraftId(draft.id); setFields(next); setProblems(null); setStatus(`Opened draft “${draft.title || "Untitled"}”.`);
    titleInput.current?.focus();
  }
  async function deleteDraft(draft) {
    const signal = scope.current?.signal; if (!signal) return;
    try {
      await rpc("delete_community_draft", { p_draft_id: draft.id }, signal);
      if (signal.aborted) return;
      setDrafts(list => list.filter(item => item.id !== draft.id)); setConfirmDelete(null); setStatus("Draft deleted.");
      if (live.current.draftId === draft.id) { live.current.draftId = null; live.current.saved = snapshot(empty); setDraftId(null); setFields(empty); }
    } catch (error) { if (!signal.aborted) setStatus(communityFailure(error, "Draft not deleted. Try again.")); }
  }
  async function publish(event) {
    event.preventDefault();
    const state = live.current, signal = scope.current?.signal;
    if (busy || !signal || signal.aborted) return;
    const found = articleProblems(fields);
    if (Object.keys(found).length) { setProblems(Object.values(found)); return; }
    const article = normalizeArticle(fields);
    setBusy(true); setProblems(null); setStatus("Publishing…");
    if (state.saving) await state.saving.catch(() => {});
    state.requestId ??= crypto.randomUUID();
    try {
      const receipt = await rpc("create_community_article", { p_exam: article.exam, p_topic: article.topic, p_title: article.title, p_body: article.body,
        p_request_id: state.requestId, p_draft_id: state.draftId }, signal);
      if (signal.aborted) return;
      if (!receipt || !uuid.test(receipt.id) || receipt.id !== receipt.postId) throw new Error("Unverified receipt");
      state.published = true;
      navigate(`/dashboard/community/post/${receipt.id}`, { state: { notice: receipt.status === "visible" ? "Your article is published." : "Your article is saved but is not visible right now." } });
    } catch (error) {
      if (signal.aborted) return;
      if (typeof error?.details === "string" && error.details.startsWith("community_")) state.requestId = null;
      setStatus(""); setProblems([communityFailure(error, "Your article did not confirm. Publish again to check whether it was saved; it will not be posted twice.")]);
    } finally { if (!signal.aborted) setBusy(false); }
  }
  const stats = articleStats(fields.body), characters = [...fields.body].length;
  return <div className="community-editor">
    <form className="admin-form" onSubmit={publish} noValidate aria-describedby={problems ? problemsId : undefined}>
      <fieldset className="community-fields story-fields" aria-label="New article" disabled={busy}>
        <div className="story-meta">
          <div className="story-exam"><label htmlFor={examId}>Exam</label>
            <select id={examId} value={fields.exam} onChange={event => change({ exam: event.target.value })}>
              {ARTICLE_EXAMS.map(exam => <option key={exam} value={exam}>{exam.toUpperCase()}</option>)}
            </select></div>
          <label className="story-topic">Topic
            <input value={fields.topic} maxLength={ARTICLE_TOPIC_MAX} onChange={event => change({ topic: event.target.value })} placeholder="For example: Time management" /></label>
        </div>
        <label className="sr-only" htmlFor={bodyId + "-title"}>Title</label>
        <textarea id={bodyId + "-title"} ref={titleInput} className="story-title" rows={1} value={fields.title} maxLength={ARTICLE_TITLE.max} placeholder="Title"
          onChange={event => { change({ title: event.target.value.replace(/\n/g, " ") }); event.target.style.height = "auto"; event.target.style.height = event.target.scrollHeight + "px"; }}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); document.getElementById(bodyId)?.focus(); } }} />
        <span id={bodyLabel} className="sr-only">Article</span>
        <ArticleEditor id={bodyId} labelledBy={bodyLabel} value={fields.body} disabled={busy} placeholder="Tell your story… Start with what you wish someone had told you."
          onChange={body => { if ([...body].length <= ARTICLE_BODY.max) change({ body }); }} />
        <p className="muted">{stats.words} words · {stats.minutes} min read · {characters.toLocaleString("en-IN")} of 20,000 characters</p>
        <CommunityRules />
        {problems && <div id={problemsId} ref={problemList} tabIndex={-1} role="alert" className="error"><p>Before this can be published:</p><ul>{problems.map(problem => <li key={problem}>{problem}</li>)}</ul></div>}
        <div className="community-editor-actions">
          <button className="button" type="submit">{busy ? "Publishing…" : "Publish article"}</button>
          <button className="button quiet" type="button" onClick={() => saveDraft()}>Save draft</button>
        </div>
        <small>Select text for bold, italic, headings and quotes, or type ## for a heading. You can add up to three images from the article’s page after publishing. Published articles can’t be edited yet, so read it through first.</small>
      </fieldset>
    </form>
    {status && <p role="status">{status}</p>}
    <section aria-label="Your drafts" className="community-drafts">
      <h2>Your drafts</h2>
      {drafts === null ? <p role="status">Loading drafts…</p> : drafts.length === 0 ? <p className="muted">No drafts. Your writing is saved to your account as you type.</p> : <ul>
        {drafts.map(draft => <li key={draft.id}>
          <span>{draft.title || "Untitled"}{draft.id === draftId ? " (open)" : ""} · saved {communityDate(draft.updatedAt)}</span>
          {draft.id !== draftId && <button type="button" className="text-button" disabled={busy} onClick={() => openDraft(draft)}>Continue “{draft.title || "Untitled"}”</button>}
          {confirmDelete === draft.id
            ? <><button type="button" className="text-button" disabled={busy} onClick={() => deleteDraft(draft)}>Confirm delete</button><button type="button" className="text-button" onClick={() => setConfirmDelete(null)}>Keep draft</button></>
            : <button type="button" className="text-button" disabled={busy} onClick={() => setConfirmDelete(draft.id)}>Delete “{draft.title || "Untitled"}”</button>}
        </li>)}
      </ul>}
    </section>
  </div>;
}

export function CommunityEditor() {
  return <CommunityFrame title="Write it" accent="down." intro="Share how you prepared, what went wrong and what you would do differently.">
    <EditorSession />
  </CommunityFrame>;
}
