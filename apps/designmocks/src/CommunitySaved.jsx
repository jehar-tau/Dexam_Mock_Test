import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CommunityFrame, communityDate, useCommunityPreview, useCommunityRpc } from "./CommunityFrame.jsx";
import { CommunitySaveLink, CommunitySavedLink } from "./CommunityLinks.jsx";
import { CommunityExtension } from "./CommunityExtension.jsx";
import { COMMUNITY_FOLDER_LIMIT, communityFailure, communityFolderName, communitySavedInput, validateCommunityBlocked, validateCommunityFolder,
  validateCommunityFolders, validateCommunitySaved } from "./community-library.js";

function SavedSession() {
  const rpc = useCommunityRpc(), preview = useCommunityPreview(), newId = useId(), renameId = useId();
  const [folders, setFolders] = useState(null), [selected, setSelected] = useState(null), [page, setPage] = useState(null), [pageLoading, setPageLoading] = useState(false);
  const [blocked, setBlocked] = useState(null), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState(""), [renaming, setRenaming] = useState(null), [confirmDelete, setConfirmDelete] = useState(false);
  const scope = useRef(null), pageRequest = useRef(null), folderHeading = useRef(null);

  async function loadFolders(signal, keep = null) {
    const value = validateCommunityFolders(await rpc("community_folders", {}, signal));
    if (signal.aborted) return;
    setFolders(value);
    setSelected(current => value.some(folder => folder.id === (keep ?? current)) ? keep ?? current : value[0]?.id ?? null);
  }
  useEffect(() => {
    const controller = new AbortController(); scope.current = controller;
    loadFolders(controller.signal).catch(() => { if (!controller.signal.aborted) { setFolders([]); setStatus("Couldn’t load your folders. Refresh to try again."); } });
    (async () => {
      try { const value = validateCommunityBlocked(await rpc("community_blocked", {}, controller.signal)); if (!controller.signal.aborted) setBlocked(value); }
      catch { if (!controller.signal.aborted) setBlocked([]); }
    })();
    return () => { controller.abort(); pageRequest.current?.abort(); };
  }, [rpc]);
  async function loadPage(folderId, previous = null) {
    const session = scope.current?.signal; if (!session || session.aborted) return;
    pageRequest.current?.abort();
    const controller = new AbortController(); pageRequest.current = controller;
    const signal = AbortSignal.any([session, controller.signal]);
    setPageLoading(true);
    try {
      const value = validateCommunitySaved(await rpc("community_saved", communitySavedInput(folderId, previous?.nextCursor ?? null), signal), folderId);
      if (signal.aborted) return;
      setPage(previous ? { ...value, items: [...previous.items, ...value.items.filter(item => !previous.items.some(old => old.postId === item.postId))] } : value);
    } catch (error) {
      if (signal.aborted) return;
      if (!previous) setPage(null);
      setStatus(communityFailure(error, "Couldn’t load this folder. Try again."));
    } finally { if (pageRequest.current === controller) setPageLoading(false); }
  }
  useEffect(() => { setPage(null); setRenaming(null); setConfirmDelete(false); if (selected) loadPage(selected); }, [selected]);

  async function run(action, fallback) {
    const signal = scope.current?.signal;
    if (busy || !signal || signal.aborted) return;
    setBusy(true); setStatus("");
    try { await action(signal); }
    catch (error) { if (!signal.aborted) setStatus(error?.details || error?.status ? communityFailure(error, fallback) : error instanceof Error ? error.message : fallback); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  const create = event => { event.preventDefault(); return run(async signal => {
    const folder = validateCommunityFolder(await rpc("save_community_folder", { p_folder_id: null, p_name: communityFolderName(newName) }, signal));
    if (signal.aborted) return;
    setNewName(""); await loadFolders(signal, folder.id); setStatus(`Folder “${folder.name}” created.`);
  }, "Folder not created. Try again."); };
  const rename = event => { event.preventDefault(); return run(async signal => {
    const folder = validateCommunityFolder(await rpc("save_community_folder", { p_folder_id: selected, p_name: communityFolderName(renaming) }, signal));
    if (signal.aborted) return;
    setRenaming(null); await loadFolders(signal, folder.id); setPage(current => current && { ...current, folder: { id: folder.id, name: folder.name } });
    setStatus(`Folder renamed to “${folder.name}”.`); folderHeading.current?.focus();
  }, "Folder not renamed. Try again."); };
  const remove = () => run(async signal => {
    const name = current?.name;
    await rpc("delete_community_folder", { p_folder_id: selected }, signal);
    if (signal.aborted) return;
    await loadFolders(signal); setStatus(`Folder “${name}” deleted. The posts themselves are untouched.`);
  }, "Folder not deleted. Try again.");
  const unsave = item => run(async signal => {
    await rpc("remove_community_save", { p_post_id: item.postId, p_folder_id: selected }, signal);
    if (signal.aborted) return;
    setPage(value => value && { ...value, items: value.items.filter(other => other.postId !== item.postId) });
    await loadFolders(signal, selected); setStatus("Removed from this folder."); folderHeading.current?.focus();
  }, "Not removed. Try again.");
  const unsaveLink = item => run(async signal => {
    await rpc("remove_community_link_save", { p_link_id: item.id, p_folder_id: selected }, signal);
    if (signal.aborted) return;
    setPage(value => value && { ...value, items: value.items.filter(other => !(other.type === "link" && other.id === item.id)) });
    await loadFolders(signal, selected); setStatus("Link removed from this folder."); folderHeading.current?.focus();
  }, "Not removed. Try again.");
  async function linkSaved(folderId, message) {
    const signal = scope.current?.signal; if (!signal || signal.aborted) return;
    setStatus(message);
    try { await loadFolders(signal, folderId); if (folderId === selected) await loadPage(folderId); } catch { /* The folder list keeps its last good state. */ }
  }
  const refreshPreview = item => run(async signal => {
    const link = await preview(item.link.url, signal);
    if (signal.aborted) return;
    setPage(value => value && { ...value, items: value.items.map(other => other.type === "link" && other.id === item.id && link.id === item.id ? { ...other, link } : other) });
    setStatus(link.status === "fetched" ? "Preview added." : "No preview is available for this page.");
  }, "Link previews are unavailable right now. Try again.");
  function suggested(item, result) {
    setPage(value => value && { ...value, items: value.items.map(other => other.type === "link" && other.id === item.id
      ? { ...other, suggestion: { status: result.status, postId: result.postId, reason: null } } : other) });
    setStatus(result.status === "approved" ? "Your link is in the Links feed." : "Suggestion sent. A moderator will review it.");
  }
  const unblock = item => run(async signal => {
    await rpc("remove_community_block", { p_handle: item.handle }, signal);
    if (signal.aborted) return;
    setBlocked(list => list.filter(other => other.handle !== item.handle)); setStatus(`${item.author} is unblocked.`);
  }, "Not unblocked. Try again.");

  const current = folders?.find(folder => folder.id === selected) ?? null;
  if (folders === null) return <p role="status">Loading your folders…</p>;
  return <div className="community-saved">
    {status && <p role="status" className="notice">{status}</p>}
    <CommunitySaveLink folders={folders} rpc={rpc} preview={preview} onSaved={linkSaved} />
    <div className="community-saved-layout">
      <section aria-label="Your folders" className="community-folders">
        <h2>Folders</h2>
        {folders.length === 0 ? <p className="muted">No folders yet. Open any article and choose Save, or create a folder here.</p> : <ul>
          {folders.map(folder => <li key={folder.id}><button type="button" aria-pressed={folder.id === selected} onClick={() => setSelected(folder.id)}>{folder.name} <span className="muted">({folder.count})</span></button></li>)}
        </ul>}
        {folders.length < COMMUNITY_FOLDER_LIMIT && <form className="admin-form" onSubmit={create}>
          <label htmlFor={newId}>New folder</label>
          <input id={newId} value={newName} maxLength={60} disabled={busy} onChange={event => setNewName(event.target.value)} />
          <button className="button quiet" type="submit" disabled={busy}>Create folder</button>
        </form>}
      </section>
      {current && <section aria-label={`Folder ${current.name}`} className="community-folder" aria-busy={pageLoading}>
        <h2 ref={folderHeading} tabIndex={-1}>{current.name}</h2>
        <div className="community-actions">
          {renaming === null ? <button type="button" className="text-button" disabled={busy} onClick={() => setRenaming(current.name)}>Rename folder</button>
            : <form className="admin-form" onSubmit={rename}><label htmlFor={renameId}>Folder name</label>
              <input id={renameId} value={renaming} maxLength={60} disabled={busy} autoFocus onChange={event => setRenaming(event.target.value)} />
              <button className="button quiet" type="submit" disabled={busy}>Save name</button>
              <button type="button" className="text-button" onClick={() => setRenaming(null)}>Cancel rename</button></form>}
          {confirmDelete ? <span className="community-confirm">Delete this folder and its {current.count} saved {current.count === 1 ? "entry" : "entries"}? <button type="button" className="text-button" disabled={busy} onClick={remove}>Yes, delete folder</button> <button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>Keep folder</button></span>
            : <button type="button" className="text-button" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete folder</button>}
        </div>
        {!page && pageLoading && <p role="status">Loading saved posts…</p>}
        {page && page.items.length === 0 && <p className="muted">Nothing saved here yet.</p>}
        <div className="community-feed">
          {page?.items.map(item => item.type === "link"
            ? <CommunitySavedLink key={`link:${item.id}`} item={item} rpc={rpc} busy={busy} onRemove={unsaveLink} onSuggested={suggested} onRefresh={refreshPreview} />
            : <article key={`post:${item.id}`}>
            {item.available ? <>
              <span className="eyebrow">{{ article: "Article", work: "Work for feedback", link: "Link", discussion: "Discussion" }[item.kind]} · {item.exam} · {item.topic}</span>
              <h3><Link to={`/dashboard/community/post/${item.postId}`}>{item.title}</Link></h3>
              <p>{item.excerpt}</p>
              <small>By {item.author} · saved {communityDate(item.savedAt)}</small>
            </> : <p className="muted">This post is no longer available. Saved {communityDate(item.savedAt)}.</p>}
            <button type="button" className="text-button" disabled={busy} aria-label={item.available ? `Remove from folder: ${item.title}` : "Remove from folder: unavailable post"} onClick={() => unsave(item)}>Remove from folder</button>
          </article>)}
        </div>
        {page?.nextCursor && <button type="button" className="button quiet" aria-disabled={pageLoading} onClick={() => { if (!pageLoading) loadPage(selected, page); }}>{pageLoading ? "Loading…" : "Load more saved items"}</button>}
      </section>}
    </div>
    <CommunityExtension rpc={rpc} />
    <section aria-label="Blocked authors" className="community-blocked">
      <h2>Blocked authors</h2>
      {blocked === null ? <p role="status">Loading…</p> : blocked.length === 0 ? <p className="muted">You haven’t blocked anyone. Blocking hides an author’s posts and replies from you; they are not told.</p> : <ul>
        {blocked.map(item => <li key={item.handle}><span>{item.author} · blocked {communityDate(item.createdAt)}</span>
          <button type="button" className="text-button" disabled={busy} onClick={() => unblock(item)}>Unblock {item.author}</button></li>)}
      </ul>}
    </section>
  </div>;
}

export function CommunitySaved() {
  return <CommunityFrame title="Your prep" accent="library." intro="Everything you saved, in folders only you can see.">
    <SavedSession />
  </CommunityFrame>;
}
