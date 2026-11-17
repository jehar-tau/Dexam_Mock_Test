import React, { useEffect, useId, useRef, useState } from "react";
import { communityDate } from "./CommunityFrame.jsx";
import { communityFailure, validateExtensionTokenCreated, validateExtensionTokens } from "./community-library.js";

// Connect the "Save to DMocks" browser extension. The key is shown once; DMocks
// keeps only its fingerprint. A connection can only list folders and save pages.
export function CommunityExtension({ rpc }) {
  const labelId = useId(), keyId = useId();
  const [tokens, setTokens] = useState(null), [label, setLabel] = useState(""), [created, setCreated] = useState(null);
  const [status, setStatus] = useState(""), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false);
  const scope = useRef(null), keyField = useRef(null), heading = useRef(null);
  async function load(signal) { const value = validateExtensionTokens(await rpc("community_extension_tokens", {}, signal)); if (!signal.aborted) setTokens(value); }
  useEffect(() => {
    const controller = new AbortController(); scope.current = controller;
    load(controller.signal).catch(() => { if (!controller.signal.aborted) { setTokens([]); setStatus("Couldn’t load connected browsers."); } });
    return () => controller.abort();
  }, [rpc]);
  useEffect(() => { if (created) { keyField.current?.focus(); keyField.current?.select(); } }, [created?.id]);
  async function run(action, fallback) {
    const signal = scope.current?.signal;
    if (busy || !signal || signal.aborted) return;
    setBusy(true); setStatus("");
    try { await action(signal); } catch (error) { if (!signal.aborted) setStatus(communityFailure(error, fallback)); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  const connect = event => { event.preventDefault(); return run(async signal => {
    const value = validateExtensionTokenCreated(await rpc("create_community_extension_token", { p_label: label.trim() || "Browser" }, signal));
    if (signal.aborted) return;
    setCreated(value); setCopied(false); setLabel(""); await load(signal);
  }, "The browser wasn’t connected. Try again."); };
  const revoke = item => run(async signal => {
    await rpc("revoke_community_extension_token", { p_id: item.id }, signal);
    if (signal.aborted) return;
    if (created?.id === item.id) setCreated(null);
    await load(signal); setStatus(`${item.label} is disconnected. Its key no longer works.`); heading.current?.focus();
  }, "That browser wasn’t disconnected. Try again.");
  async function copy() {
    try { await navigator.clipboard.writeText(created.token); setCopied(true); }
    catch { keyField.current?.select(); setStatus("Copy the key from the box with your keyboard."); }
  }
  return <section aria-label="Browser extension" className="community-extension">
    <h2 ref={heading} tabIndex={-1}>Browser extension</h2>
    <p className="muted">With the Save to DMocks extension, one click saves the page you’re reading, from any site, into your folders. It can only list your folders and save pages; it can’t read or post anything else.</p>
    {status && <p role="status">{status}</p>}
    {created ? <div className="notice community-extension-key">
      <p><strong>Your connection key for {created.label}.</strong> Paste it into the extension now. It won’t be shown again.</p>
      <label htmlFor={keyId}>Connection key</label>
      <input ref={keyField} id={keyId} readOnly value={created.token} spellCheck={false} />
      <div className="community-editor-actions">
        <button type="button" className="button" onClick={copy}>{copied ? "Copied" : "Copy key"}</button>
        <button type="button" className="button quiet" onClick={() => { setCreated(null); heading.current?.focus(); }}>Done</button>
      </div>
      {copied && <p role="status">Key copied.</p>}
    </div> : (tokens?.length ?? 0) < 5 && <form className="admin-form" onSubmit={connect}>
      <div><label htmlFor={labelId}>Name this browser</label>
        <input id={labelId} value={label} maxLength={60} disabled={busy} onChange={event => setLabel(event.target.value)} placeholder="For example: Chrome on my laptop" /></div>
      <button className="button quiet" type="submit" disabled={busy}>Connect a browser</button>
    </form>}
    {tokens === null ? <p role="status">Loading…</p> : tokens.length === 0 ? <p className="muted">No browsers connected.</p> : <ul className="community-staff-list">
      {tokens.map(item => <li key={item.id}><span>{item.label} · connected {communityDate(item.createdAt)} · {item.lastUsedAt ? `last used ${communityDate(item.lastUsedAt)}` : "not used yet"} · expires {communityDate(item.expiresAt)}</span>
        <button type="button" className="text-button" disabled={busy} onClick={() => revoke(item)}>Disconnect {item.label}</button></li>)}
    </ul>}
  </section>;
}
