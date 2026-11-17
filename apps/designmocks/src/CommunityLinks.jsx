import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { communityDate } from "./CommunityFrame.jsx";
import { ARTICLE_EXAMS } from "./community-article.mjs";
import { isSocialHost, normalizeLinkUrl } from "../supabase/functions/_shared/community-link.mjs";
import { COMMUNITY_FOLDER_LIMIT, communityFailure, communityFolderName, communityLinkFailure, communityLinkNeedsPreview, communitySuggestionInput, validateCommunityFolder,
  validateCommunityLinkSave, validateCommunitySuggestion } from "./community-library.js";

// A link preview. The address opens outside DMocks, in a new tab, without
// sending who referred the reader. Nothing from the page is embedded.
export function CommunityLinkPreview({ link, heading: Heading = "h3" }) {
  const title = link.title ?? link.url;
  return <div className="community-link-preview">
    <span className="eyebrow">{link.site && link.site !== link.host ? `${link.site} · ${link.host}` : link.host}</span>
    <Heading className="community-link-title">{title}</Heading>
    {link.description && <p>{link.description}</p>}
    {link.status !== "fetched" && <p className="muted">{link.status === "skipped" ? "Social and messaging pages are not previewed."
      : Date.parse(link.fetchedAt) < Date.now() - 7 * 86400000 ? "Saved from the browser extension. No preview yet." : "No preview is available for this page."}</p>}
    <a className="community-external" href={link.url} target="_blank" rel="noopener noreferrer nofollow ugc">Open on {link.host}<span className="visually-hidden"> (opens outside DMocks in a new tab)</span></a>
  </div>;
}

// Paste an address, see its preview, choose folders and add a private note.
export function CommunitySaveLink({ folders, rpc, preview, onSaved }) {
  const urlId = useId(), noteId = useId(), folderId = useId();
  const [address, setAddress] = useState(""), [link, setLink] = useState(null), [checked, setChecked] = useState(() => new Set());
  const [note, setNote] = useState(""), [newFolder, setNewFolder] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const scope = useRef(null), previewHeading = useRef(null), input = useRef(null), refocus = useRef(false);
  useEffect(() => { const controller = new AbortController(); scope.current = controller; return () => controller.abort(); }, []);
  // The field is disabled while saving; return focus once it is usable again.
  useEffect(() => { if (!busy && refocus.current) { refocus.current = false; input.current?.focus(); } }, [busy]);
  useEffect(() => { if (link) previewHeading.current?.focus(); }, [link?.id]);
  async function run(action) {
    const signal = scope.current?.signal;
    if (busy || !signal || signal.aborted) return;
    setBusy(true); setMessage("");
    try { await action(signal); } finally { if (!signal.aborted) setBusy(false); }
  }
  const fetchPreview = event => { event.preventDefault(); return run(async signal => {
    try { normalizeLinkUrl(address); } catch (error) { setMessage(error.message); return; }
    try {
      const value = await preview(address, signal);
      if (signal.aborted) return;
      setLink(value); setChecked(new Set(folders.length ? [folders[0].id] : [])); setNewFolder(folders.length ? "" : "Links");
    } catch (error) { if (!signal.aborted) setMessage(await communityLinkFailure(error)); }
  }); };
  const save = event => { event.preventDefault(); return run(async signal => {
    const ids = new Set(checked);
    try {
      if (newFolder.trim()) {
        const created = validateCommunityFolder(await rpc("save_community_folder", { p_folder_id: null, p_name: communityFolderName(newFolder) }, signal));
        ids.add(created.id);
      }
      if (!ids.size) { setMessage("Choose a folder, or name a new one."); return; }
      const saved = validateCommunityLinkSave(await rpc("save_community_link", { p_link_id: link.id, p_folder_ids: [...ids], p_note: note.trim() }, signal), link.id);
      if (signal.aborted) return;
      const into = saved.folderIds[0];
      setLink(null); setAddress(""); setNote(""); setNewFolder(""); setChecked(new Set());
      refocus.current = true;
      onSaved(into, `Link saved to ${saved.folderIds.length === 1 ? "1 folder" : `${saved.folderIds.length} folders`}.`);
    } catch (error) { if (!signal.aborted) setMessage(error?.details || error?.code ? communityFailure(error, "The link didn’t save. Try again.") : error.message); }
  }); };
  return <section className="community-save-link" aria-label="Save a link">
    <h2>Save a link</h2>
    <p className="muted">Keep articles, videos and posts from anywhere in your folders, with your own note. Only you see them unless you suggest one for the Links feed.</p>
    <form className="admin-form community-link-form" onSubmit={fetchPreview} noValidate>
      <div><label htmlFor={urlId}>Web address</label>
        <input ref={input} id={urlId} type="url" inputMode="url" autoComplete="off" value={address} maxLength={2000} disabled={busy}
          onChange={event => { setAddress(event.target.value); setLink(null); setMessage(""); }} placeholder="https://" /></div>
      <button className="button quiet" type="submit" disabled={busy}>{busy && !link ? "Getting preview…" : "Get preview"}</button>
    </form>
    {message && <p role="alert" className="error">{message}</p>}
    {link && <form className="admin-form community-link-save" onSubmit={save} aria-label="Choose folders for this link">
      <div tabIndex={-1} ref={previewHeading} className="community-link-preview-frame" aria-label="Link preview"><CommunityLinkPreview link={link} /></div>
      {folders.length > 0 && <fieldset className="community-folder-choices" disabled={busy}><legend>Save into</legend>
        {folders.map(folder => <label key={folder.id}><input type="checkbox" checked={checked.has(folder.id)} onChange={event => setChecked(current => {
          const next = new Set(current); if (event.target.checked) next.add(folder.id); else next.delete(folder.id); return next;
        })} /> {folder.name}</label>)}
      </fieldset>}
      {folders.length < COMMUNITY_FOLDER_LIMIT && <div><label htmlFor={folderId}>{folders.length ? "Or a new folder" : "New folder"}</label>
        <input id={folderId} value={newFolder} maxLength={60} disabled={busy} onChange={event => setNewFolder(event.target.value)} /></div>}
      <div><label htmlFor={noteId}>Your note (private, optional)</label>
        <textarea id={noteId} value={note} maxLength={2000} rows={3} disabled={busy} onChange={event => setNote(event.target.value)} placeholder="Why you saved it, what to try" /></div>
      <div className="community-editor-actions">
        <button className="button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save link"}</button>
        <button className="button quiet" type="button" disabled={busy} onClick={() => { setLink(null); setTimeout(() => input.current?.focus()); }}>Cancel</button>
      </div>
    </form>}
  </section>;
}

function SuggestForm({ item, rpc, onDone, onCancel }) {
  const examId = useId(), topicId = useId(), noteId = useId();
  const [exam, setExam] = useState(""), [topic, setTopic] = useState(""), [note, setNote] = useState(item.note ?? ""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const scope = useRef(null), first = useRef(null);
  useEffect(() => { const controller = new AbortController(); scope.current = controller; first.current?.focus(); return () => controller.abort(); }, []);
  async function submit(event) {
    event.preventDefault();
    const signal = scope.current?.signal;
    if (busy || !signal || signal.aborted) return;
    let input; try { input = communitySuggestionInput(item.id, exam, topic, note); } catch (error) { setMessage(error.message); return; }
    setBusy(true); setMessage("");
    try {
      const result = validateCommunitySuggestion(await rpc("suggest_community_link", input, signal));
      if (!signal.aborted) onDone(result);
    } catch (error) { if (!signal.aborted) { setMessage(communityFailure(error, "The suggestion didn’t send. Try again.")); setBusy(false); } }
  }
  return <form className="admin-form community-suggest" onSubmit={submit} noValidate aria-label="Suggest for the Links feed">
    <p>A moderator checks every suggestion. Your reason becomes the post’s text, under your first name.</p>
    <div><label htmlFor={examId}>Exam</label>
      <select ref={first} id={examId} value={exam} disabled={busy} onChange={event => setExam(event.target.value)}>
        <option value="">Choose an exam</option>{ARTICLE_EXAMS.map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}
      </select></div>
    <div><label htmlFor={topicId}>Topic</label><input id={topicId} value={topic} maxLength={100} disabled={busy} onChange={event => setTopic(event.target.value)} /></div>
    <div><label htmlFor={noteId}>Why it helps</label><textarea id={noteId} value={note} maxLength={2000} rows={3} disabled={busy} onChange={event => setNote(event.target.value)} /></div>
    {message && <p role="alert" className="error">{message}</p>}
    <div className="community-editor-actions">
      <button className="button" type="submit" disabled={busy}>{busy ? "Sending…" : "Send suggestion"}</button>
      <button className="button quiet" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}

const suggestionText = { pending: "Suggested for the Links feed. Waiting for a moderator.", approved: "In the Links feed.", rejected: "Not added to the Links feed." };

// A saved link inside a folder.
export function CommunitySavedLink({ item, rpc, busy, onRemove, onSuggested, onRefresh }) {
  const [suggesting, setSuggesting] = useState(false), opener = useRef(null);
  const social = isSocialHost(item.link.host), feedPost = item.postId ?? item.suggestion?.postId ?? null;
  const name = item.link.title ?? item.link.host;
  return <article className="community-saved-link" aria-label={`Saved link: ${name}`}>
    <CommunityLinkPreview link={item.link} />
    {item.note && <p className="community-note"><strong>Your note:</strong> <span className="community-comment-body">{item.note}</span></p>}
    <small>Saved {communityDate(item.savedAt)}</small>
    {item.suggestion && <p className={item.suggestion.status === "rejected" ? "muted" : "notice"}>{suggestionText[item.suggestion.status]}
      {item.suggestion.status === "rejected" && item.suggestion.reason ? ` Reason: ${item.suggestion.reason}` : ""}</p>}
    {feedPost && <p><Link to={`/dashboard/community/post/${feedPost}`}>Open the post in the Links feed</Link></p>}
    {suggesting ? <SuggestForm item={item} rpc={rpc} onCancel={() => { setSuggesting(false); opener.current?.focus(); }}
      onDone={result => { setSuggesting(false); onSuggested(item, result); }} /> : <div className="community-actions">
      {!social && !feedPost && item.suggestion?.status !== "pending" && <button ref={opener} type="button" className="text-button" disabled={busy} aria-label={`Suggest for the Links feed: ${name}`} onClick={() => setSuggesting(true)}>Suggest for the Links feed</button>}
      {onRefresh && communityLinkNeedsPreview(item.link) && <button type="button" className="text-button" disabled={busy} aria-label={`Get preview: ${name}`} onClick={() => onRefresh(item)}>Get preview</button>}
      <button type="button" className="text-button" disabled={busy} aria-label={`Remove from folder: ${name}`} onClick={() => onRemove(item)}>Remove from folder</button>
    </div>}
    {social && <small className="muted">Social and messaging links stay in your private folders.</small>}
  </article>;
}
