import React, { useState } from "react";
import { INTAKE_EXTRACTION_MAX_BYTES, INTAKE_FIGURE_MAX_BYTES } from "../supabase/functions/_shared/intake-limits.mjs";
import { intakeFigureDescriptor, intakeReviewPayload, intakeReviewValues } from "./intake-review.js";

function IntakeQuestionEditor({ payload, pageNumber, manual, onSubmit, onPrepareFigures }) {
  const [values, setValues] = useState(() => intakeReviewValues(payload));
  const [figures, setFigures] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const change = event => setValues(current => ({ ...current, [event.target.name]: event.target.value }));
  const updateOption = (index, field, value) => setValues(current => ({
    ...current, options: current.options.map((option, at) => at === index ? { ...option, [field]: value } : option),
  }));
  const choice = ["MCQ", "MSQ"].includes(values.type);
  const prepareFigures = async event => {
    const input = event.currentTarget;
    const files = [...input.files];
    setMessage("");
    setBusy(true);
    try {
      if (files.length > 8) throw new Error("Choose up to eight reviewed figures.");
      if (files.some(file => file.size > INTAKE_FIGURE_MAX_BYTES)) throw new Error("Use a complete PNG figure up to 10 MB.");
      const prepared = [];
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const asset = await intakeFigureDescriptor(bytes, (...args) => crypto.subtle.digest(...args));
        if (prepared.some(figure => figure.asset.sha256 === asset.sha256)) throw new Error("Choose each figure once.");
        prepared.push({ file, asset });
      }
      if (onPrepareFigures) await onPrepareFigures(prepared);
      setFigures(prepared);
      setValues(current => ({ ...current, assets: prepared.map(figure => figure.asset) }));
    } catch (error) {
      input.value = "";
      setFigures([]);
      setValues(current => ({ ...current, assets: [] }));
      setMessage(error.message);
    } finally { setBusy(false); }
  };
  const downloadFigure = figure => {
    const url = URL.createObjectURL(figure.file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${figure.asset.sha256}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const submit = async event => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setMessage("");
    if (values.visualDependency === "true" && !values.assets.length) {
      setMessage("Attach the reviewed figures required to understand this question.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ ...intakeReviewPayload(values), ...(manual ? { pageNumber: form.get("pageNumber") || null } : {}) });
      if (manual) {
        element.reset();
        setValues(intakeReviewValues());
        setFigures([]);
      }
      setMessage("Question saved in the human review queue.");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return <form className="admin-form intake-editor" onSubmit={submit}>
    <fieldset disabled={busy}>
      <legend>{manual ? "Transcribe a source question" : "Correct the extracted question"}</legend>
      <label>Exam<select name="exam" value={values.exam} onChange={change} required>
        <option value="">Select the confirmed exam</option>
        {["uceed", "nid", "nift", "ceed"].map(exam => <option key={exam} value={exam}>{exam.toUpperCase()}</option>)}
      </select></label>
      {manual && <label>Source page, when known<input name="pageNumber" type="number" min="1" max="10000" defaultValue={pageNumber ?? ""} /></label>}
      <label>Question type<select name="type" value={values.type} onChange={change}>
        <option value="MCQ">Single choice</option><option value="MSQ">Multiple choice</option>
        <option value="NAT">Numerical answer</option><option value="DESCRIPTIVE">Drawing or written response</option>
      </select></label>
      <label>Question wording<textarea name="prompt" value={values.prompt} onChange={change} required minLength="3" maxLength="8000" rows="4" /></label>
      <label>Topic, when known<input name="topic" value={values.topic} onChange={change} maxLength="120" /></label>
      {choice && <fieldset><legend>Answer options</legend>
        {values.options.map((option, index) => <div className="intake-option" key={index}>
          <label>Option {index + 1} key<input required maxLength="32" pattern="[A-Za-z0-9_-]+" value={option.key} onChange={event => updateOption(index, "key", event.target.value)} /></label>
          <label>Option {index + 1} text<textarea required maxLength="2000" rows="2" value={option.text} onChange={event => updateOption(index, "text", event.target.value)} /></label>
          <button type="button" disabled={values.options.length <= 2} onClick={() => setValues(current => ({ ...current, options: current.options.filter((_, at) => at !== index) }))}>Remove option {index + 1}</button>
        </div>)}
        <button type="button" disabled={values.options.length >= 8} onClick={() => setValues(current => ({ ...current, options: [...current.options, { key: "", text: "" }] }))}>Add option</button>
      </fieldset>}
      {values.type !== "DESCRIPTIVE" && <label>Verified answer<input name="answer" value={values.answer} onChange={change} required maxLength="200" /><small>{values.type === "MSQ" ? "Enter the exact correct option keys, separated by commas." : values.type === "NAT" ? "Preserve the exact decimal or published range, such as -.50 to +.75." : "Enter the exact correct option key."}</small></label>}
      <label>{values.type === "DESCRIPTIVE" ? "Review rubric" : "Explanation, when known"}<textarea name="explanation" value={values.explanation} onChange={change} required={values.type === "DESCRIPTIVE"} minLength={values.type === "DESCRIPTIVE" ? 5 : undefined} maxLength="8000" rows="3" /></label>
      <label>Does the question require figures?<select name="visualDependency" value={values.visualDependency} onChange={change} required>
        <option value="">Check the source and choose</option><option value="false">The wording and options are complete without figures</option><option value="true">Figures are needed to answer the question</option>
      </select></label>
      {values.visualDependency === "true" && <div className="intake-figures">
        <label>Reviewed question figures (PNG)<input type="file" accept="image/png" multiple onChange={prepareFigures} /></label>
        <p>Attach question-only crops in reading order. Preserve option labels and exclude the answer key. {onPrepareFigures ? "Figures are retained privately with this source. The operator downloads them under the displayed paths for the reviewed bank import." : "This development preview prepares local figure metadata."}</p>
        {values.assets.map((asset, index) => <div key={asset.sha256}><code>{asset.path}</code><span>{asset.width} × {asset.height}</span>{figures[index] && <button type="button" onClick={() => downloadFigure(figures[index])}>Download prepared figure {index + 1}</button>}</div>)}
      </div>}
      <label className="profile-check"><input type="checkbox" required /> I checked the wording, figures and {values.type === "DESCRIPTIVE" ? "rubric" : "answer"} against the source.</label>
      <button>{busy ? "Saving…" : "Send to human review"}</button>
    </fieldset>
    {message && <p role={message.startsWith("Question saved") ? "status" : "alert"}>{message}</p>}
  </form>;
}

function IntakeAsset({ asset, onExtract, onPromote, onReject, onTranscribe, onDownload, onPrepareFigures }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const act = async action => {
    setMessage("");
    setBusy(true);
    try { await action(); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return <article>
    <b>{asset.name}</b><span className="status-pill">{asset.status}</span>
    {asset.error && <p className="error">{asset.error}</p>}
    <div className="admin-actions">
      {onDownload && <button disabled={busy} onClick={() => act(() => onDownload(asset))}>Download private source</button>}
      {(["uploaded", "failed"].includes(asset.status) || asset.retryAvailable) && <button disabled={busy || asset.byteSize > INTAKE_EXTRACTION_MAX_BYTES} onClick={() => act(() => onExtract(asset.id))}>{asset.retryAvailable ? "Retry extraction" : "Extract with configured model"}</button>}
    </div>
    {asset.byteSize > INTAKE_EXTRACTION_MAX_BYTES && <p>Model extraction accepts files up to 10 MB. Split the source or transcribe its questions below.</p>}
    {asset.status === "extracting" && <p role="status">{asset.retryAvailable ? "Extraction timed out. Retry when ready." : "Extraction in progress…"}</p>}
    {asset.attemptCount > 0 && <p>Processing attempt {asset.attemptCount}</p>}
    {message && <p role="alert">{message}</p>}
    {onTranscribe && asset.status !== "extracting" && <details><summary>Transcribe a question from this source</summary><IntakeQuestionEditor manual onSubmit={payload => onTranscribe(asset.id, payload)} onPrepareFigures={onPrepareFigures && (figures => onPrepareFigures(asset.id, figures))} /></details>}
    {(asset.candidates ?? []).map(candidate => <section key={candidate.id} aria-label={`Candidate ${candidate.ordinal}`}>
      <span className="eyebrow">CANDIDATE {candidate.ordinal}{candidate.pageNumber ? ` · PAGE ${candidate.pageNumber}` : ""}{candidate.confidence != null ? ` · ${Math.round(candidate.confidence * 100)}%` : ""}</span>
      {candidate.status === "pending" ? <>
        <p>This candidate carries an intake-human-review hold until it passes review and a rights-confirmed Git export.</p>
        <IntakeQuestionEditor payload={candidate.payload} onSubmit={payload => onPromote(candidate.id, payload)} onPrepareFigures={onPrepareFigures && (figures => onPrepareFigures(asset.id, figures))} />
        <button disabled={busy} onClick={() => act(() => onReject(candidate.id))}>Reject extraction</button>
      </> : <span className="status-pill">{candidate.status}</span>}
    </section>)}
  </article>;
}

export function IntakeExtractionQueue({ assets = [], ...actions }) {
  return <div className="admin-list intake-queue">{assets.length === 0 ? <p>No private source files uploaded.</p>
    : assets.map(asset => <IntakeAsset key={asset.id} asset={asset} {...actions} />)}</div>;
}

export function IntakeDraftFigures({ draft, onDownload }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const payload = draft.export?.payload ?? draft.payload;
  const assetId = payload?.provenance?.intake?.assetId;
  const figures = Array.isArray(payload?.assets) ? payload.assets.filter(figure => typeof figure?.sha256 === "string" && typeof figure?.path === "string") : [];
  if (!assetId || !figures.length) return null;
  const download = async figure => {
    setBusy(true);
    setMessage("");
    try { await onDownload({ id: assetId }, figure); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return <div className="intake-figures">
    <p>Retained question figures for the reviewed private-media import.</p>
    {figures.map((figure, index) => <div key={figure.sha256}>
      <code>{figure.path}</code><button disabled={busy} onClick={() => download(figure)}>Download retained figure {index + 1}</button>
    </div>)}
    {message && <p role="alert">{message}</p>}
  </div>;
}
