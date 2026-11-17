import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CommunityFrame, communityDate, useCommunityRpc } from "./CommunityFrame.jsx";
import { CommunityLinkPreview } from "./CommunityLinks.jsx";
import { communityFailure, communityNote, validateCommunityLinkQueue, validateCommunityReview, validateCommunityTrustedHosts } from "./community-library.js";

function Suggestion({ item, canTrust, busy, onApprove, onReject }) {
  const reasonId = useId();
  const [trust, setTrust] = useState(false), [rejecting, setRejecting] = useState(false), [reason, setReason] = useState("");
  return <article className="community-review-item" aria-label={`Suggestion from ${item.author}: ${item.link.title ?? item.link.host}`}>
    <span className="eyebrow">{item.exam} · {item.topic} · suggested {communityDate(item.createdAt)}</span>
    <CommunityLinkPreview link={item.link} />
    <p className="muted community-link-address">{item.link.url}</p>
    <p className="community-note"><strong>Why {item.author} suggests it:</strong> <span className="community-comment-body">{item.note}</span></p>
    {item.social && <p className="error">This is a social or messaging site. It cannot go into the feed.</p>}
    {item.isMine ? <p className="muted">Another moderator reviews your own suggestions.</p> : rejecting ? <form className="admin-form" onSubmit={event => { event.preventDefault(); onReject(item, reason); }}>
      <div><label htmlFor={reasonId}>Reason shown to {item.author}</label>
        <textarea id={reasonId} value={reason} rows={2} maxLength={1000} disabled={busy} onChange={event => setReason(event.target.value)} autoFocus /></div>
      <div className="community-editor-actions">
        <button className="button" type="submit" disabled={busy}>Turn down</button>
        <button className="button quiet" type="button" disabled={busy} onClick={() => setRejecting(false)}>Cancel</button>
      </div>
    </form> : <div className="community-actions">
      {!item.social && <button type="button" className="button" disabled={busy} onClick={() => onApprove(item, trust)}>Add to the Links feed</button>}
      {canTrust && !item.social && <label className="community-trust"><input type="checkbox" checked={trust} disabled={busy} onChange={event => setTrust(event.target.checked)} /> Also trust {item.link.host}</label>}
      <button type="button" className="text-button" disabled={busy} onClick={() => setRejecting(true)}>Turn down…</button>
    </div>}
  </article>;
}

function ReviewSession() {
  const rpc = useCommunityRpc(), hostId = useId();
  const [queue, setQueue] = useState(null), [hosts, setHosts] = useState(null), [status, setStatus] = useState(""), [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false), [host, setHost] = useState("");
  const scope = useRef(null), heading = useRef(null);
  const load = useCallback(async signal => {
    const value = validateCommunityLinkQueue(await rpc("community_link_review_queue", {}, signal));
    if (signal.aborted) return;
    setQueue(value);
    if (value.canTrust) { const list = validateCommunityTrustedHosts(await rpc("admin_community_trusted_hosts", {}, signal)); if (!signal.aborted) setHosts(list); }
  }, [rpc]);
  useEffect(() => {
    const controller = new AbortController(); scope.current = controller;
    load(controller.signal).catch(error => {
      if (controller.signal.aborted) return;
      if (error?.details === "community_moderator_required" || error?.code === "42501") setDenied(true);
      else setStatus("Couldn’t load suggestions. Refresh to try again.");
    });
    return () => controller.abort();
  }, [load]);
  async function run(action, fallback) {
    const signal = scope.current?.signal;
    if (busy || !signal || signal.aborted) return;
    setBusy(true); setStatus("");
    try { await action(signal); }
    catch (error) { if (!signal.aborted) setStatus(error?.details || error?.code ? communityFailure(error, fallback) : error instanceof Error ? error.message : fallback); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  const approve = (item, trust) => run(async signal => {
    const result = validateCommunityReview(await rpc("review_community_link_suggestion", { p_id: item.id, p_approve: true, p_reason: null, p_trust: trust }, signal), item.id);
    if (signal.aborted) return;
    await load(signal); setStatus(`Added to the Links feed${trust ? ` and ${item.link.host} is trusted` : ""}.`); heading.current?.focus();
    return result;
  }, "The link wasn’t added. Try again.");
  const reject = (item, reason) => run(async signal => {
    const note = communityNote(reason);
    validateCommunityReview(await rpc("review_community_link_suggestion", { p_id: item.id, p_approve: false, p_reason: note, p_trust: false }, signal), item.id);
    if (signal.aborted) return;
    await load(signal); setStatus("Suggestion turned down. The student sees your reason."); heading.current?.focus();
  }, "That didn’t save. Try again.");
  const setTrusted = (value, trusted) => run(async signal => {
    await rpc("admin_set_community_trusted_host", { p_host: value, p_trusted: trusted }, signal);
    if (signal.aborted) return;
    await load(signal); setHost(""); setStatus(trusted ? `${value.trim().toLowerCase()} is trusted. Suggestions from it go straight into the feed.` : `${value} is no longer trusted.`);
  }, "The site list didn’t change. Try again.");
  if (denied) return <p>Only moderators review suggested links. <Link to="/dashboard/community/links">Back to links</Link></p>;
  return <div className="community-review">
    <h2 ref={heading} tabIndex={-1}>Suggested links</h2>
    {status && <p role="status" className="notice">{status}</p>}
    {queue === null ? !status && <p role="status">Loading suggestions…</p> : queue.items.length === 0 ? <p className="muted">Nothing to review.</p> :
      <div className="community-feed">{queue.items.map(item => <Suggestion key={item.id} item={item} canTrust={queue.canTrust} busy={busy} onApprove={approve} onReject={reject} />)}</div>}
    {queue?.canTrust && <section aria-label="Trusted sites" className="community-trusted">
      <h2>Trusted sites</h2>
      <p className="muted">Suggestions from these sites, and their subdomains, go into the Links feed without review. Social and messaging sites can’t be trusted.</p>
      {hosts && (hosts.length === 0 ? <p className="muted">No trusted sites.</p> : <ul className="community-staff-list">
        {hosts.map(item => <li key={item}><span>{item}</span><button type="button" className="text-button" disabled={busy} onClick={() => setTrusted(item, false)}>Stop trusting {item}</button></li>)}
      </ul>)}
      <form className="admin-form" onSubmit={event => { event.preventDefault(); setTrusted(host, true); }}>
        <div><label htmlFor={hostId}>Site to trust</label><input id={hostId} value={host} maxLength={253} disabled={busy} onChange={event => setHost(event.target.value)} placeholder="example.org" /></div>
        <button className="button quiet" type="submit" disabled={busy || !host.trim()}>Trust site</button>
      </form>
    </section>}
  </div>;
}

export function CommunityLinkReview() {
  return <CommunityFrame title="Check before" accent="it spreads." intro="Links students suggested for the feed. Add the useful ones; turn the rest down with a reason.">
    <ReviewSession />
  </CommunityFrame>;
}
