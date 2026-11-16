import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { COMMUNITY_FOLDER_LIMIT, communityFailure, communityFolderName, validateCommunityFolder, validateCommunityFolders, validateCommunitySaves } from "./community-library.js";

// Chooses which of the reader's folders hold a post. onClose receives the new
// folder ids after a save, or null when the dialog was dismissed.
export function CommunitySaveDialog({ postId, selected, rpc, onClose }) {
  const titleId = useId(), nameId = useId();
  const [folders, setFolders] = useState(null), [checked, setChecked] = useState(() => new Set(selected)), [name, setName] = useState("");
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const dialog = useRef(null), scope = useRef(null), closed = useRef(false);
  useLayoutEffect(() => { if (!dialog.current.open) dialog.current.showModal(); }, []);
  useEffect(() => {
    const controller = new AbortController(); scope.current = controller;
    (async () => {
      try {
        const value = validateCommunityFolders(await rpc("community_folders", {}, controller.signal));
        if (controller.signal.aborted) return;
        setFolders(value); if (!value.length) setName("Saved");
      } catch { if (!controller.signal.aborted) { setFolders([]); setMessage("Couldn’t load your folders. Close and try again."); } }
    })();
    return () => controller.abort();
  }, [rpc]);
  const close = value => {
    if (closed.current) return;
    closed.current = true; scope.current?.abort();
    if (dialog.current?.open) dialog.current.close();
    onClose(value ?? null);
  };
  async function createFolder(signal) {
    const created = validateCommunityFolder(await rpc("save_community_folder", { p_folder_id: null, p_name: communityFolderName(name) }, signal));
    setFolders(list => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
    setChecked(current => new Set(current).add(created.id)); setName("");
    return created.id;
  }
  async function run(action) {
    const signal = scope.current?.signal;
    if (busy || !signal || signal.aborted || !folders) return;
    setBusy(true); setMessage("");
    try { await action(signal); }
    catch (error) { if (!signal.aborted) setMessage(error?.details ? communityFailure(error) : error instanceof Error && !error.status ? error.message : communityFailure(error)); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  const save = event => {
    event.preventDefault();
    return run(async signal => {
      const ids = new Set(checked);
      if (name.trim()) ids.add(await createFolder(signal));
      const saved = validateCommunitySaves(await rpc("set_community_saves", { p_post_id: postId, p_folder_ids: [...ids] }, signal), postId);
      if (!signal.aborted) close(saved);
    });
  };
  return <dialog ref={dialog} className="submit-dialog community-save-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }} onClose={() => close()}>
    <h2 id={titleId}>Save to folders</h2>
    <p>Folders are private. Only you can see what you save.</p>
    {message && <p role="alert" className="error">{message}</p>}
    {folders === null ? <p role="status">Loading your folders…</p> : <form className="admin-form" onSubmit={save}>
      {folders.length > 0 && <fieldset disabled={busy} className="community-folder-choices"><legend>Your folders</legend>
        {folders.map(folder => <label key={folder.id}><input type="checkbox" checked={checked.has(folder.id)} onChange={event => setChecked(current => {
          const next = new Set(current); if (event.target.checked) next.add(folder.id); else next.delete(folder.id); return next;
        })} /> {folder.name}</label>)}
      </fieldset>}
      {folders.length < COMMUNITY_FOLDER_LIMIT && <div><label htmlFor={nameId}>New folder (optional)</label>
        <input id={nameId} value={name} maxLength={60} disabled={busy} onChange={event => setName(event.target.value)} placeholder="For example: NID studio test" /></div>}
      <button className="button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
    </form>}
    <button type="button" className="button quiet" onClick={() => close()}>Cancel</button>
  </dialog>;
}
