import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAdminServices } from "./AdminAccess.jsx";
import { adminRequestMessage } from "./admin-access.js";
import { isHumanTask, newNidBlueprint, newNidSection, nidBlueprintInput, nidPracticeKinds, validateNidPracticeBlueprint } from "./nid-practice-blueprint.js";

const messageFor = error => error?.code === "40001" ? "This blueprint changed. Open its current revision before continuing." : adminRequestMessage(error);
const validAck = (command, value) => value?.id === command.args.p_id && value.revision === command.revision && /^[a-f0-9]{64}$/.test(value.sha256) && value.status === command.status && (!command.args.p_expected_sha256 || value.sha256 === command.args.p_expected_sha256);

export function NidPracticeBlueprints() {
  const { rpc, isCurrent } = useAdminServices();
  const lifetime = useRef(null), listRead = useRef(0), detailRead = useRef(0), writing = useRef(false), commandRef = useRef(null);
  const [page, setPage] = useState(null), [offset, setOffset] = useState(0), [item, setItem] = useState(null), [versions, setVersions] = useState([]);
  const [draft, setDraft] = useState(null), [id, setId] = useState(null), [dirty, setDirty] = useState(false), [viewRevision, setViewRevision] = useState("");
  const [busy, setBusy] = useState(false), [pending, setPending] = useState(null), [conflict, setConflict] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [note, setNote] = useState(""), [confirmed, setConfirmed] = useState(false);
  const current = useCallback(() => isCurrent() && lifetime.current && !lifetime.current.signal.aborted, [isCurrent]);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    return () => { controller.abort(); listRead.current++; detailRead.current++; };
  }, []);
  const request = useCallback(async (name, args) => {
    const deadline = new AbortController(), timer = setTimeout(() => deadline.abort(), 15000);
    try { return await rpc(name, args, AbortSignal.any([lifetime.current.signal, deadline.signal])); }
    finally { clearTimeout(timer); }
  }, [rpc]);
  const loadList = useCallback(async () => {
    const token = ++listRead.current;
    try {
      const value = await request("admin_nid_practice_blueprints", { p_offset: offset, p_limit: 10 });
      if (current() && token === listRead.current) {
        if (!Array.isArray(value?.items) || !Number.isInteger(value.total)) throw new Error("Invalid blueprint page");
        setPage(value);
      }
    } catch (failure) { if (current() && token === listRead.current) throw failure; }
  }, [request, offset, current]);
  useEffect(() => { void loadList().catch(failure => { if (current()) setError(messageFor(failure)); }); }, [loadList, current]);

  const applyDetails = value => {
    setItem(value.item); setVersions(value.versions ?? []); setDraft(value.item?.payload ?? null);
    setDirty(false); setConflict(false); setNote(""); setConfirmed(false); setViewRevision(String(value.item?.revision ?? ""));
  };
  const open = async (blueprintId, revision = null) => {
    const token = ++detailRead.current;
    setBusy(true); setError(""); setMessage(""); setDraft(null); setItem(null); setId(blueprintId);
    try {
      const value = await request("admin_nid_practice_blueprint", { p_id: blueprintId, p_revision: revision, p_request_id: null });
      if (current() && token === detailRead.current) {
        if (!value?.item) throw new Error("Blueprint unavailable");
        applyDetails(value);
      }
    } catch (failure) { if (current() && token === detailRead.current) setError(messageFor(failure)); }
    finally { if (current() && token === detailRead.current) setBusy(false); }
  };
  const create = () => {
    detailRead.current++; setId(crypto.randomUUID()); setItem(null); setVersions([]); setDraft(newNidBlueprint());
    setDirty(true); setNote(""); setConfirmed(false); setConflict(false); setError(""); setMessage("");
  };
  const change = next => { setDraft(next); setDirty(true); setConfirmed(false); setError(""); };
  const sectionChange = (index, key, value) => change({ ...draft, sections: draft.sections.map((section, n) => n === index ? { ...section, [key]: value } : section) });
  const criterionChange = (index, position, key, value) => sectionChange(index, "rubric", draft.sections[index].rubric.map((criterion, n) => n === position ? { ...criterion, [key]: value } : criterion));

  const acknowledged = async (command, value) => {
    if (!validAck(command, value)) throw new Error("Blueprint acknowledgement is incomplete");
    commandRef.current = null; setPending(null); setDraft(null); setItem(null); setConfirmed(false);
    const details = await request("admin_nid_practice_blueprint", { p_id: command.args.p_id, p_revision: null, p_request_id: null });
    if (!current()) return;
    if (!details?.item) throw new Error("Saved blueprint could not be opened");
    applyDetails(details);
    await loadList();
    if (current()) setMessage(command.status === "draft" ? "Practice revision saved. It needs its own review." : "Practice review saved for this exact revision. Questions remain unreleased.");
  };
  const send = async command => {
    if (writing.current) return;
    writing.current = true; commandRef.current = command; setPending(command); setBusy(true); setError(""); setMessage("");
    try {
      const value = await request(command.name, command.args);
      if (current()) await acknowledged(command, value);
    } catch (failure) {
      if (current()) {
        if (commandRef.current && ["22023", "40001"].includes(failure?.code)) {
          commandRef.current = null; setPending(null); setConflict(failure.code === "40001");
        }
        setError(commandRef.current ? "The result is not confirmed. Check the saved state before making another change, or retry this exact request." : messageFor(failure));
      }
    } finally { writing.current = false; if (current()) setBusy(false); }
  };
  const save = event => {
    event.preventDefault(); if (writing.current || pending || conflict) return;
    try {
      const payload = nidBlueprintInput(draft);
      void send({ name: "admin_save_nid_practice_blueprint", args: { p_id: id, p_expected_revision: item?.revision ?? 0, p_payload: payload, p_request_id: crypto.randomUUID() }, revision: (item?.revision ?? 0) + 1, status: "draft" });
    } catch (failure) { setError(failure.message); }
  };
  const review = event => {
    event.preventDefault();
    const decision = event.nativeEvent.submitter?.value;
    if (writing.current || pending || dirty || conflict || !confirmed || !["reviewed", "rejected"].includes(decision)) return;
    void send({ name: "admin_review_nid_practice_blueprint", args: { p_id: id, p_expected_revision: item.revision, p_expected_sha256: item.sha256,
      p_decision: decision, p_note: note.trim(), p_request_id: crypto.randomUUID() }, revision: item.revision, status: decision });
  };
  const checkSaved = async () => {
    if (writing.current || !commandRef.current) return;
    writing.current = true; setBusy(true); setError("");
    const command = commandRef.current;
    try {
      const value = await request("admin_nid_practice_blueprint", { p_id: command.args.p_id, p_revision: null, p_request_id: command.args.p_request_id });
      if (current()) {
        if (value?.requestResult) await acknowledged(command, value.requestResult);
        else setMessage("This request is not visible as committed yet. Keep this draft open or retry the same request; it cannot create a duplicate revision.");
      }
    } catch (failure) { if (current()) setError(messageFor(failure)); }
    finally { writing.current = false; if (current()) setBusy(false); }
  };

  let summary = null;
  try { if (draft) summary = validateNidPracticeBlueprint(nidBlueprintInput(draft)); } catch { /* Incomplete fields are validated on save. */ }
  const historical = item && item.revision !== item.currentRevision;
  const locked = busy || Boolean(pending) || conflict || historical;
  return <section className="nid-practice-blueprints" aria-label="NID practice blueprints">
    <h2>NID practice blueprints</h2>
    <p>Privately author a practice scheme, then review its exact revision. These are DMocks practice choices; they do not state official NID timing, marking or assessment criteria.</p>
    <p>Reviewing a blueprint does not convert or approve bank questions, publish a paper or enable student access.</p>
    <div className="admin-actions"><button type="button" disabled={busy || Boolean(pending)} onClick={create}>New NID practice blueprint</button><button type="button" disabled={busy || Boolean(pending)} onClick={() => { setError(""); void loadList().catch(failure => { if (current()) setError(messageFor(failure)); }); }}>Refresh practice blueprints</button></div>
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {busy && <p role="status">Checking or saving this practice blueprint…</p>}
    {pending && !busy && <div className="admin-actions"><button type="button" onClick={checkSaved}>Check saved blueprint</button><button type="button" onClick={() => void send(commandRef.current)}>Retry same blueprint request</button></div>}
    {conflict && !pending && <button type="button" disabled={busy} onClick={() => void open(id)}>Open current blueprint revision</button>}
    {draft && <section className="nid-blueprint-editor" aria-label="Practice blueprint editor">
      <h3>{item ? `Revision ${item.revision} · ${item.status}` : "New authored practice blueprint"}</h3>
      {historical && <p>Historical revision. Open the current revision to edit or record a review.</p>}
      {summary && <p>{summary.questionCount} questions · {summary.totalPoints} maximum practice marks · {draft.durationMinutes} minutes{summary.humanReview ? ` plus ${draft.uploadGraceMinutes} minutes to upload completed pages` : ""}.</p>}
      <form onSubmit={save} aria-label="Edit NID practice blueprint">
        <fieldset className="admin-form" disabled={locked}>
          <legend>Authored practice settings</legend>
          <label>Practice title<input required minLength="3" maxLength="160" value={draft.title} onChange={e => change({ ...draft, title: e.target.value })} /></label>
          <label>Practice purpose<textarea required minLength="20" maxLength="2000" rows="3" value={draft.purpose} onChange={e => change({ ...draft, purpose: e.target.value })} /></label>
          <label>Practice duration in minutes<input required type="number" min="1" max="360" step="1" value={draft.durationMinutes} onChange={e => change({ ...draft, durationMinutes: e.target.value })} /></label>
          <label>Completed-page upload time<select required value={draft.uploadGraceMinutes} onChange={e => change({ ...draft, uploadGraceMinutes: e.target.value })}><option value="">Choose explicitly</option><option value="0">None · objective-only practice</option><option value="10">10 minutes · uploaded responses</option><option value="15">15 minutes · uploaded responses</option></select></label>
          {draft.sections.map((section, index) => <fieldset className="nid-blueprint-section" key={index}>
            <legend>Practice section {index + 1}</legend>
            <div className="admin-form">
              <label>Section {index + 1} label<input required minLength="3" maxLength="120" value={section.label} onChange={e => sectionChange(index, "label", e.target.value)} /></label>
              <label>Section {index + 1} response<select required value={section.kind} onChange={e => sectionChange(index, "kind", e.target.value)}><option value="">Choose a response type</option>{Object.entries(nidPracticeKinds).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
              <label>Section {index + 1} question count<input required type="number" min="1" max="100" step="1" value={section.count} onChange={e => sectionChange(index, "count", e.target.value)} /></label>
              <label>Section {index + 1} marks per question<input required type="number" min="0.01" max="100" step="0.01" value={section.points} onChange={e => sectionChange(index, "points", e.target.value)} /></label>
              <label>Section {index + 1} wrong-answer penalty<input required type="number" min="0" max="100" step="0.01" value={section.penalty} onChange={e => sectionChange(index, "penalty", e.target.value)} /></label>
            </div>
            {isHumanTask(section.kind) ? <>
              <p>Use zero penalty for an uploaded response. Rubric marks must total the per-question maximum. Guidance applies to each task in this section.</p>
              {section.rubric.map((criterion, position) => <fieldset className="nid-blueprint-criterion admin-form" key={position}>
                <legend>Section {index + 1} criterion {position + 1}</legend>
                <label>Criterion {index + 1}.{position + 1} label<input required minLength="3" maxLength="120" value={criterion.label} onChange={e => criterionChange(index, position, "label", e.target.value)} /></label>
                <label>Criterion {index + 1}.{position + 1} marks<input required type="number" min="0.01" max="100" step="0.01" value={criterion.points} onChange={e => criterionChange(index, position, "points", e.target.value)} /></label>
                <label>Criterion {index + 1}.{position + 1} review guidance<textarea required minLength="10" maxLength="1000" rows="3" value={criterion.guidance} onChange={e => criterionChange(index, position, "guidance", e.target.value)} /></label>
                <button type="button" onClick={() => sectionChange(index, "rubric", section.rubric.filter((_, n) => n !== position))}>Remove criterion {index + 1}.{position + 1}</button>
              </fieldset>)}
              <button type="button" disabled={section.rubric.length >= 12} onClick={() => sectionChange(index, "rubric", [...section.rubric, { label: "", points: "", guidance: "" }])}>Add criterion to section {index + 1}</button>
            </> : section.rubric.length > 0 && <><p>This section still has an upload rubric. Remove it explicitly before saving as objective practice.</p><button type="button" onClick={() => sectionChange(index, "rubric", [])}>Remove rubric from section {index + 1}</button></>}
            <button type="button" disabled={draft.sections.length === 1} onClick={() => change({ ...draft, sections: draft.sections.filter((_, n) => n !== index) })}>Remove section {index + 1}</button>
          </fieldset>)}
          <div className="admin-actions"><button type="button" disabled={draft.sections.length >= 8} onClick={() => change({ ...draft, sections: [...draft.sections, newNidSection()] })}>Add practice section</button><button disabled={!dirty}>Save practice revision</button></div>
        </fieldset>
      </form>
      {item && <>
        <p className="nid-blueprint-digest">Revision digest <code>{item.sha256}</code></p>
        {item.reviewNote && <p><b>Recorded practice review:</b> {item.reviewNote}</p>}
        {item.status === "draft" && !historical && <form className="admin-form" aria-label="Review NID practice revision" onSubmit={review}>
          <fieldset disabled={locked || dirty}>
            <legend>Review this saved revision</legend>
            <label>Practice review note<textarea required minLength="20" maxLength="2000" rows="3" value={note} onChange={e => setNote(e.target.value)} /></label>
            <label className="profile-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I reviewed these authored practice settings and rubrics. They are not official NID assessment criteria.</label>
            <div className="admin-actions"><button name="decision" value="reviewed" disabled={!confirmed}>Record practice review</button><button name="decision" value="rejected" disabled={!confirmed}>Request blueprint correction</button></div>
          </fieldset>
        </form>}
        {dirty && <p>Save your changes as a new revision before reviewing.</p>}
        <div className="nid-blueprint-history admin-actions"><label>Saved practice revision<select value={viewRevision} disabled={busy || Boolean(pending)} onChange={e => setViewRevision(e.target.value)}>{versions.map(version => <option key={version.revision} value={version.revision}>{version.revision} · {version.status}</option>)}</select></label><button type="button" disabled={busy || Boolean(pending)} onClick={() => void open(id, Number(viewRevision))}>Open selected practice revision</button><button type="button" disabled={busy || Boolean(pending)} onClick={() => void open(id)}>Open current practice revision</button></div>
        {item.currentRevision > 30 && <p>Showing the newest 30 revisions. Earlier immutable revisions remain in the private audit history.</p>}
      </>}
    </section>}
    {page && <>
      <p>{page.total ? `${page.offset + 1}–${Math.min(page.offset + page.limit, page.total)} of ${page.total} practice blueprints` : "No NID practice blueprints have been authored yet."}</p>
      <div className="admin-list">{page.items.map(value => <article key={value.id}><b>{value.title}</b><span className="status-pill">Revision {value.revision} · {value.status}</span><button type="button" disabled={busy || Boolean(pending)} onClick={() => void open(value.id)}>Open practice blueprint {value.title}</button></article>)}</div>
      <nav className="admin-actions" aria-label="Practice blueprint pages"><button type="button" disabled={busy || Boolean(pending) || page.offset === 0} onClick={() => setOffset(Math.max(0, page.offset - page.limit))}>Previous blueprints</button><button type="button" disabled={busy || Boolean(pending) || page.offset + page.limit >= page.total} onClick={() => setOffset(page.offset + page.limit)}>Next blueprints</button></nav>
    </>}
  </section>;
}
