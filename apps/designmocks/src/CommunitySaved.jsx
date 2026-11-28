// Community → Saved: one list, no folders. Guides saved on this device come first, then
// student posts saved on the server (every folder an older version created is included).
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CommunityFrame, communityDate, useCommunityRpc } from "./CommunityFrame.jsx";
import { communityFailure, communitySavedInput, validateCommunityBlocked, validateCommunityFolders, validateCommunitySaved } from "./community-library.js";
import { useAuthState } from "./useAuth.js";
import { editorialArticles } from "./community-editorial.js";
import { editorialPath } from "./CommunityEditorial.jsx";
import { EDITORIAL_THEMES, editorialExamLabel } from "./community-editorial.mjs";
import { onSavedGuidesChange, savedGuides, setGuideSaved } from "./saved-guides.js";

function SavedGuides({ actor }) {
  const [items, setItems] = useState(() => savedGuides(actor));
  useEffect(() => onSavedGuidesChange(() => setItems(savedGuides(actor))), [actor]);
  const guides = items.map(item => ({ ...item, article: editorialArticles.find(article => article.slug === item.slug) })).filter(item => item.article);
  return <section aria-labelledby="saved-guides-heading" className="community-saved-section">
    <h2 id="saved-guides-heading">Guides</h2>
    {guides.length === 0 ? <p className="muted">Tap <b>Save</b> on any guide in <Link to="/dashboard/community">Articles</Link> to keep it here.</p>
      : <ul className="saved-list">{guides.map(({ article, savedAt }) => <li key={article.slug}>
        <div>
          <span className="eyebrow">{EDITORIAL_THEMES[article.theme]} · {editorialExamLabel(article)}</span>
          <h3><Link to={editorialPath(article.slug)}>{article.title}</Link></h3>
          <small>{article.minutes} min read · saved {communityDate(savedAt)}</small>
        </div>
        <button type="button" className="text-button" aria-label={`Remove from Saved: ${article.title}`} onClick={() => setGuideSaved(actor, article.slug, false)}>Remove</button>
      </li>)}</ul>}
    <p className="muted saved-note">Saved guides are kept on this device.</p>
  </section>;
}

function SavedPosts() {
  const rpc = useCommunityRpc();
  const [items, setItems] = useState(null), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  const scope = useRef(null), heading = useRef(null);
  useEffect(() => {
    const controller = new AbortController(); scope.current = controller;
    (async () => {
      try {
        const folders = validateCommunityFolders(await rpc("community_folders", {}, controller.signal));
        const all = [];
        for (const folder of folders) {
          let cursor = null;
          do {
            const page = validateCommunitySaved(await rpc("community_saved", communitySavedInput(folder.id, cursor), controller.signal), folder.id);
            all.push(...page.items.map(item => ({ ...item, folderId: folder.id })));
            cursor = page.nextCursor;
          } while (cursor && all.length < 500);
        }
        const unique = [...new Map(all.sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map(item => [item.postId, item])).values()];
        if (!controller.signal.aborted) setItems(unique);
      } catch { if (!controller.signal.aborted) { setItems([]); setStatus("Couldn’t load your saved posts. Refresh to try again."); } }
    })();
    return () => controller.abort();
  }, [rpc]);
  const remove = async item => {
    const signal = scope.current?.signal;
    if (busy || !signal || signal.aborted) return;
    setBusy(true); setStatus("");
    try {
      await rpc("set_community_saves", { p_post_id: item.postId, p_folder_ids: [] }, signal);
      if (!signal.aborted) { setItems(list => list.filter(other => other.postId !== item.postId)); setStatus("Removed from Saved."); heading.current?.focus(); }
    } catch (error) { if (!signal.aborted) setStatus(communityFailure(error, "Not removed. Try again.")); }
    finally { if (!signal.aborted) setBusy(false); }
  };
  return <section aria-labelledby="saved-posts-heading" className="community-saved-section">
    <h2 id="saved-posts-heading" ref={heading} tabIndex={-1}>From students</h2>
    {status && <p role="status" className="notice">{status}</p>}
    {items === null ? <p role="status">Loading saved posts…</p> : items.length === 0
      ? <p className="muted">Tap <b>Save</b> on a student’s article or discussion to keep it here.</p>
      : <ul className="saved-list">{items.map(item => <li key={item.postId}>
        {item.available ? <div>
          <span className="eyebrow">{item.kind === "article" ? "Article" : "Discussion"} · {item.exam.toUpperCase()} · {item.topic}</span>
          <h3><Link to={`/dashboard/community/post/${item.postId}`}>{item.title}</Link></h3>
          <small>By {item.author} · saved {communityDate(item.savedAt)}</small>
        </div> : <div><p className="muted">This post is no longer available. Saved {communityDate(item.savedAt)}.</p></div>}
        <button type="button" className="text-button" disabled={busy} aria-label={item.available ? `Remove from Saved: ${item.title}` : "Remove from Saved: unavailable post"} onClick={() => remove(item)}>Remove</button>
      </li>)}</ul>}
  </section>;
}

function BlockedAuthors() {
  const rpc = useCommunityRpc();
  const [blocked, setBlocked] = useState(null), [status, setStatus] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try { const value = validateCommunityBlocked(await rpc("community_blocked", {}, controller.signal)); if (!controller.signal.aborted) setBlocked(value); }
      catch { if (!controller.signal.aborted) setBlocked([]); }
    })();
    return () => controller.abort();
  }, [rpc]);
  const unblock = async item => {
    try { await rpc("remove_community_block", { p_handle: item.handle }); setBlocked(list => list.filter(other => other.handle !== item.handle)); setStatus(`${item.author} is unblocked.`); }
    catch (error) { setStatus(communityFailure(error, "Not unblocked. Try again.")); }
  };
  if (!blocked?.length && !status) return null;
  return <section aria-label="Blocked authors" className="community-blocked">
    <h2>Blocked authors</h2>
    {status && <p role="status">{status}</p>}
    {blocked?.length > 0 && <ul>{blocked.map(item => <li key={item.handle}><span>{item.author} · blocked {communityDate(item.createdAt)}</span>
      <button type="button" className="text-button" onClick={() => unblock(item)}>Unblock {item.author}</button></li>)}</ul>}
  </section>;
}

function SavedSession() {
  const { session } = useAuthState();
  return <div className="community-saved">
    {session && <SavedGuides actor={session.user.id} />}
    <SavedPosts />
    <BlockedAuthors />
  </div>;
}

export function CommunitySaved() {
  return <CommunityFrame title="Saved" accent="for later." intro="Guides and posts you saved, in one place.">
    <SavedSession />
  </CommunityFrame>;
}
