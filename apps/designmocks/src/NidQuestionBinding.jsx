import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAdminServices } from './AdminAccess.jsx';
import { adminRequestMessage } from './admin-access.js';
import { isHumanTask, nidPracticeKinds, validateNidPracticeBlueprint } from './nid-practice-blueprint.js';
const changed = error => error?.code === '40001' ? 'The question or practice revision changed. Refresh the bank and inspect it again.' : adminRequestMessage(error);
const ackFor = (command, ack) => ack?.externalKey === command.p_external_key && ack.status === 'bound' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(ack.bindingId) && /^[a-f0-9]{64}$/.test(ack.reviewVersion);

export function NidQuestionBinding({ question, rpc, figuresReady, onBound, onLockChange }) {
  const { isCurrent } = useAdminServices();
  const lifetime = useRef(null), listing = useRef(0), choosing = useRef(0), sending = useRef(false), command = useRef(null);
  const [page, setPage] = useState(null), [offset, setOffset] = useState(0), [saved, setSaved] = useState(null);
  const [selected, setSelected] = useState(''), [blueprint, setBlueprint] = useState(null), [section, setSection] = useState(''), [note, setNote] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [pending, setPending] = useState(false), [sourceRead, setSourceRead] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const current = useCallback(() => isCurrent() && lifetime.current && !lifetime.current.signal.aborted, [isCurrent]);
  useEffect(() => { const value = new AbortController(); lifetime.current = value; return () => { value.abort(); choosing.current++; listing.current++; }; }, []);
  useEffect(() => { onLockChange(busy || pending); }, [busy, pending, onLockChange]);
  useEffect(() => () => onLockChange(false), [onLockChange]);
  const request = useCallback(async (name, args) => {
    const deadline = new AbortController(), timer = setTimeout(() => deadline.abort(), 15000);
    try { return await rpc(name, args, AbortSignal.any([lifetime.current.signal, deadline.signal])); }
    finally { clearTimeout(timer); }
  }, [rpc]);
  useEffect(() => {
    let alive = true;
    void request('admin_nid_question_binding', { p_external_key: question.externalKey, p_expected_version: question.reviewVersion, p_request_id: null })
      .then(value => { if (alive && current()) {
        if (!value || !Array.isArray(value.history) || typeof value.canConvert !== 'boolean' || typeof value.materialized !== 'boolean') throw new Error('Invalid binding state');
        if (value.binding) validateNidPracticeBlueprint(value.binding.blueprint?.payload);
        setSaved(value); setSourceRead(true);
      } })
      .catch(failure => { if (alive && current()) setError(changed(failure)); });
    return () => { alive = false; };
  }, [request, current, question.externalKey, question.reviewVersion]);
  const loadPage = useCallback(async () => {
    const token = ++listing.current;
    try {
      const value = await request('admin_nid_practice_blueprints', { p_offset: offset, p_limit: 10 });
      if (current() && token === listing.current) {
        if (!Array.isArray(value?.items)) throw new Error('Invalid blueprint page');
        setPage(value);
      }
    } catch (failure) { if (current() && token === listing.current) setError(changed(failure)); }
  }, [request, offset, current]);
  useEffect(() => { void loadPage(); }, [loadPage]);
  const choose = async value => {
    if (pending || sending.current) return;
    const token = ++choosing.current; setSelected(value); setBlueprint(null); setSection(''); setNote(''); setConfirmed(false); setError('');
    if (!value) { setBusy(false); return; }
    setBusy(true);
    try {
      const summary = page.items.find(item => item.id === value), response = await request('admin_nid_practice_blueprint', { p_id: value, p_revision: null, p_request_id: null }), item = response?.item;
      if (!current() || token !== choosing.current) return;
      if (!item || item.status !== 'reviewed' || item.revision !== item.currentRevision || item.revision !== summary.revision || item.sha256 !== summary.sha256)
        throw Object.assign(new Error('Practice revision changed'), { code: '40001' });
      validateNidPracticeBlueprint(item.payload); setBlueprint(item);
    } catch (failure) { if (current() && token === choosing.current) setError(changed(failure)); }
    finally { if (current() && token === choosing.current) setBusy(false); }
  };
  const finish = async ack => {
    if (!ackFor(command.current, ack)) throw new Error('Incomplete practice binding acknowledgement');
    command.current = null; setPending(false); await onBound();
  };
  const send = async input => {
    if (sending.current) return;
    sending.current = true; command.current = input; setBusy(true); setPending(true); setError(''); setMessage('');
    try { const ack = await request('admin_bind_nid_question', input); if (current()) await finish(ack); }
    catch (failure) {
      if (current()) {
        if (['40001', '22023'].includes(failure?.code)) { command.current = null; setPending(false); if (failure.code === '40001') setSourceRead(false); }
        setError(command.current ? 'The binding result is not confirmed. Check the saved binding or retry this identical request before changing it.' : changed(failure));
      }
    } finally { sending.current = false; if (current()) setBusy(false); }
  };
  const recover = async () => {
    if (sending.current || !command.current) return;
    sending.current = true; setBusy(true); setError('');
    try {
      const result = await request('admin_nid_question_binding', { p_external_key: question.externalKey, p_expected_version: null, p_request_id: command.current.p_request_id });
      if (current()) {
        if (result?.requestResult) await finish(result.requestResult);
        else setMessage('This request is not visible as committed yet. Keep this review open or retry the same request.');
      }
    } catch (failure) { if (current()) setError(changed(failure)); }
    finally { sending.current = false; if (current()) setBusy(false); }
  };
  const bind = event => {
    event.preventDefault(); if (sending.current || pending || !sourceRead || !figuresReady || !confirmed || !blueprint || !scheme || !compatible(scheme.kind)) return;
    void send({ p_external_key: question.externalKey, p_expected_version: question.reviewVersion, p_blueprint_id: blueprint.id,
      p_revision: blueprint.revision, p_blueprint_sha256: blueprint.sha256, p_section_ordinal: Number(section), p_note: note.trim(), p_request_id: crypto.randomUUID() });
  };
  const compatible = kind => question.type === 'DESCRIPTIVE' ? isHumanTask(kind) : kind === question.type.toLowerCase();
  const changePage = value => { if (busy || pending) return; void choose(''); setOffset(value); };
  const scheme = blueprint?.payload.sections[Number(section) - 1];
  const currentBinding = saved?.binding ?? question.nidPractice?.binding;
  const boundPayload = currentBinding?.blueprint?.payload, boundSection = boundPayload?.sections?.[currentBinding?.sectionOrdinal - 1];
  return <section className="nid-question-binding" aria-label="NID question practice binding">
    <h4>Choose an authored practice context</h4>
    <p>Bind this exact question to a reviewed DMocks practice revision. This does not convert or approve the question, publish a paper or state official NID rules.</p>
    {boundSection && <section className="nid-binding-scheme" aria-label="Bound practice scheme">
      <p><b>{boundPayload.title} · revision {currentBinding.blueprint.revision}</b><br />{currentBinding.current ? (saved?.materialized ?? question.nidPractice?.materialized) ? 'Converted; separate question review is required.' : 'Bound; guarded conversion is required.' : 'Stale binding; inspect the current source and a newly reviewed practice revision.'}</p>
      <p>{boundSection.label} · {boundSection.points} maximum marks per question · {boundSection.penalty} wrong-answer penalty.<br />{boundPayload.durationMinutes} practice minutes · {boundPayload.uploadGraceMinutes} minutes for completed-page uploads.</p>
      {isHumanTask(boundSection.kind) && <ul>{boundSection.rubric.map(criterion => <li key={criterion.label}><b>{criterion.label} · {criterion.points} marks</b><br />{criterion.guidance}</li>)}</ul>}
    </section>}
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    {busy && <p role="status">Checking or saving the private practice binding…</p>}
    {pending && !busy && <div className="admin-actions"><button type="button" onClick={recover}>Check saved practice binding</button><button type="button" onClick={() => void send(command.current)}>Retry same practice binding</button></div>}
    <form className="admin-form" aria-label="Bind NID question to practice" onSubmit={bind}>
      <fieldset disabled={busy || pending || !sourceRead || !question.active || Boolean(question.holdReason)}>
        <legend>Reviewed practice scheme</legend>
        <label>Reviewed blueprint<select required value={selected} onChange={event => void choose(event.target.value)}><option value="">Choose a reviewed revision</option>{page?.items.map(item => <option key={item.id} value={item.id} disabled={item.status !== 'reviewed'}>{item.title} · revision {item.revision} · {item.status}</option>)}</select></label>
        <div className="admin-actions"><button type="button" onClick={() => { void choose(''); void loadPage(); }}>Refresh reviewed blueprints</button><button type="button" disabled={!page || page.offset === 0} onClick={() => changePage(Math.max(0, page.offset - page.limit))}>Previous practice schemes</button><button type="button" disabled={!page || page.offset + page.limit >= page.total} onClick={() => changePage(page.offset + page.limit)}>Next practice schemes</button></div>
        {page && !page.items.some(item => item.status === 'reviewed') && <p>No reviewed scheme on this page. Create and review one in the NID practice-blueprint editor, or check another page.</p>}
        {blueprint && <>
          <p><b>{blueprint.payload.title} · reviewed revision {blueprint.revision}</b><br />{blueprint.payload.purpose}<br />{blueprint.payload.durationMinutes} practice minutes · {blueprint.payload.uploadGraceMinutes} minutes for completed-page uploads.</p>
          <label>Practice section<select required value={section} onChange={event => { setSection(event.target.value); setConfirmed(false); }}><option value="">Choose a compatible response section</option>{blueprint.payload.sections.map((value, index) => <option key={index} value={index + 1} disabled={!compatible(value.kind)}>{value.label} · {nidPracticeKinds[value.kind]} · {value.points} marks per question</option>)}</select></label>
          {scheme && <div className="nid-binding-scheme"><p>{scheme.count} questions in this practice section · {scheme.points} maximum marks per question · {scheme.penalty} wrong-answer penalty.</p>{isHumanTask(scheme.kind) ? <ul>{scheme.rubric.map(criterion => <li key={criterion.label}><b>{criterion.label} · {criterion.points} marks</b><br />{criterion.guidance}</li>)}</ul> : <p>{scheme.kind === 'msq' ? 'Only the complete correct set earns marks; there is no partial credit in this authored scheme.' : 'The complete canonical answer key must be verified before approval.'}</p>}</div>}
          <label>Question fit review<textarea required minLength="20" maxLength="2000" rows="3" value={note} onChange={event => setNote(event.target.value)} /></label>
          <label className="profile-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> I inspected this question, its required figures and the chosen authored scheme and rubric.</label>
          {!figuresReady && <p>Open and inspect every required private figure before saving this binding.</p>}
          <button disabled={!confirmed || !scheme || !figuresReady}>Save practice binding</button>
        </>}
      </fieldset>
    </form>
    {saved?.history?.length > 0 && <details><summary>Recent binding history</summary><ul>{saved.history.map(value => <li key={value.id}>Practice revision {value.blueprintRevision} · section {value.sectionOrdinal}<br />{value.note}</li>)}</ul></details>}
  </section>;
}
