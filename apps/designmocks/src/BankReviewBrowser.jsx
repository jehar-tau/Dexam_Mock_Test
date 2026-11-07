import React, { useEffect, useState } from "react";
import { platform } from "./platform.js";
import { bankReviewImages, bankSearchInput, deliveryAnswerLabel, initialBankFilters, sourceAnswerLabel } from "./bank-review.js";

async function loadBankFigures(question) {
  const { data, error } = await platform.functions.invoke("bank-review-media", {
    body: { externalKey: question.externalKey, reviewVersion: question.reviewVersion },
  });
  if (error) throw new Error("Question figures could not be opened. Refresh the bank and try again.");
  if (data?.error) throw new Error(data.error);
  return data.images;
}

function BankQuestionReview({ selected, rpc, onClose, onReviewed, loadMedia }) {
  const [question, setQuestion] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState(null);
  const [loadedImages, setLoadedImages] = useState({});
  const [rights, setRights] = useState(false);
  useEffect(() => {
    let current = true;
    rpc("admin_bank_question", { p_external_key: selected.externalKey, p_expected_version: selected.reviewVersion })
      .then(data => { if (current) setQuestion(data); })
      .catch(failure => { if (current) setError(failure.message); });
    return () => { current = false; };
  }, [rpc, selected.externalKey, selected.reviewVersion]);
  const openImages = async () => {
    setError("");
    setBusy(true);
    setImages(null);
    setLoadedImages({});
    try { setImages(bankReviewImages(await loadMedia(question), question.media)); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const review = async event => {
    event.preventDefault();
    const decision = event.nativeEvent.submitter?.value;
    if (!["approve", "reject"].includes(decision)) { setError("Choose a review decision."); return; }
    const note = String(new FormData(event.currentTarget).get("note")).trim();
    setBusy(true);
    setError("");
    try {
      await rpc("admin_review_bank_question", {
        p_external_key: question.externalKey, p_approved: decision === "approve",
        p_rights_confirmed: decision === "approve" && rights, p_note: note, p_expected_version: question.reviewVersion,
      });
      await onReviewed();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const figuresReady = question?.media.every(figure => images?.some(image => image.ordinal === figure.ordinal) && loadedImages[figure.ordinal]);
  const canReview = question?.active && !question?.holdReason;
  return <section className="bank-question-review" aria-label="Question review">
    <div className="admin-actions"><h3 className="bank-review-key">{selected.externalKey}</h3><button type="button" onClick={onClose}>Close question</button></div>
    {error && <p role="alert" className="error">{error}</p>}
    {!question && !error && <p role="status">Opening the complete question…</p>}
    {question && <>
      <p>{question.exam.toUpperCase()} · {question.type} · {question.topic} · {question.licence}</p>
      <p className="bank-question-prompt">{question.prompt}</p>
      {Array.isArray(question.options) && question.options.length > 0 && <ul className="bank-question-options">
        {question.options.map((option, index) => <li key={index}><b>{option?.key ?? option?.id}</b> {option?.text || "See the labelled figure"}</li>)}
      </ul>}
      {question.media.length > 0 && <div className="bank-question-media">
        <p>{question.media.length} question figure{question.media.length === 1 ? "" : "s"}.</p>
        {question.media.some(figure => !figure.available) && <p className="error">Some figures need a verified private media import.</p>}
        <button type="button" disabled={busy} onClick={openImages}>{images ? "Refresh private figures" : "Open private figures"}</button>
        {images && <div className="drawing-review-grid">{images.map(image => <figure key={image.ordinal}>
          <img src={image.url} alt={`Question figure ${image.ordinal}`} referrerPolicy="no-referrer"
            onLoad={() => setLoadedImages(current => ({ ...current, [image.ordinal]: true }))}
            onError={() => { setLoadedImages(current => ({ ...current, [image.ordinal]: false })); setError("A question figure could not be displayed. Refresh the figures."); }} />
          <figcaption>Figure {image.ordinal}</figcaption>
        </figure>)}</div>}
      </div>}
      <dl className="bank-answer-review">
        <dt>Source answer</dt><dd>{sourceAnswerLabel(question.answer)}</dd>
        <dt>Delivery answer</dt><dd>{deliveryAnswerLabel(question.runtimeKey)}</dd>
        {question.marking && <><dt>Marking</dt><dd>{question.marking.humanReview ? "Teacher-reviewed drawing" : `Correct ${question.marking.correct} · Wrong ${question.marking.wrong}${question.marking.partial ? " · Partial credit applies" : ""}`}</dd></>}
      </dl>
      {question.explanation && <><h4>Explanation or rubric</h4><p className="bank-question-prompt">{question.explanation}</p></>}
      {question.context && <p>Delivery context {question.context.exam?.toUpperCase()} {question.context.cycle} {question.context.part ?? ""} · {question.context.version}</p>}
      {!question.runtimeReady && <p>This question needs a verified conversion before practice approval.</p>}
      {!canReview && <p>{question.holdReason || "This record is inactive in the current bank."}</p>}
      {canReview && <form className="admin-form" onSubmit={review}>
        <label>Review note<textarea name="note" required minLength="8" maxLength="1000" rows="3" defaultValue={question.reviewNote ?? ""} /></label>
        <label className="profile-check"><input type="checkbox" checked={rights} onChange={event => setRights(event.target.checked)} /> I checked the question and confirm DMocks has the right to use it.</label>
        <div className="admin-actions">
          <button name="decision" value="approve" disabled={busy || !rights || !question.runtimeReady || !figuresReady}>Approve for practice</button>
          <button name="decision" value="reject" disabled={busy}>Request correction</button>
        </div>
      </form>}
      <details><summary>Source record</summary><p>Canonical key {question.externalKey}</p><p>Source commit <code>{question.sourceCommit}</code></p><p>Content digest <code>{question.contentSha256}</code></p></details>
    </>}
  </section>;
}

export function BankReviewBrowser({ rpc, onReviewed = async () => {}, loadMedia = loadBankFigures, refreshToken = 0 }) {
  const [filters, setFilters] = useState(initialBankFilters);
  const [query, setQuery] = useState(() => bankSearchInput(initialBankFilters));
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const topics = result?.topics ?? [];
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    setSelected(null);
    rpc("admin_search_bank_questions", query)
      .then(data => { if (current) setResult(data); })
      .catch(failure => { if (current) { setResult(null); setError(failure.message); } })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [rpc, query, refreshKey, refreshToken]);
  const change = event => {
    const { name, value } = event.target;
    setFilters(current => ({ ...current, [name]: value, ...(name === "exam" ? { topic: "" } : {}) }));
  };
  const reviewed = async () => {
    setSelected(null);
    setRefreshKey(current => current + 1);
    setMessage("Review saved. The question bank has been refreshed.");
    await onReviewed();
  };
  return <section className="bank-review-browser" aria-label="Imported bank review">
    <h2>Imported bank review</h2>
    <p>Open the complete question, figures and answer before recording a decision and its content rights.</p>
    {result?.summary && <p>{result.summary.active} active records · {result.summary.available} converted · {result.summary.approved} approved · {result.summary.inactive} inactive.</p>}
    <form className="admin-form bank-review-filters" onSubmit={event => { event.preventDefault(); setMessage(""); setQuery(bankSearchInput(filters)); }}>
      <label>Bank exam<select name="exam" value={filters.exam} onChange={change}><option value="">All exams</option>{["uceed", "nid", "nift", "ceed"].map(exam => <option key={exam} value={exam}>{exam.toUpperCase()}</option>)}</select></label>
      <label>Bank question type<select name="type" value={filters.type} onChange={change}><option value="">All types</option>{["MCQ", "MSQ", "NAT", "DESCRIPTIVE"].map(type => <option key={type}>{type}</option>)}</select></label>
      <label>Review status<select name="status" value={filters.status} onChange={change}><option value="pending">Ready for review</option><option value="approved">Approved</option><option value="unavailable">Awaiting conversion</option><option value="inactive">Inactive</option><option value="all">All records</option></select></label>
      <label>Bank topic<select name="topic" value={filters.topic} onChange={change}><option value="">All topics</option>{topics.map(topic => <option key={topic}>{topic}</option>)}{filters.topic && !topics.includes(filters.topic) && <option>{filters.topic}</option>}</select></label>
      <label>Find a question<input name="search" value={filters.search} onChange={change} maxLength="200" placeholder="Canonical key, wording or topic" /></label>
      <label>Questions per page<select name="limit" value={filters.limit} onChange={change}>{[25, 50, 100].map(limit => <option key={limit}>{limit}</option>)}</select></label>
      <div className="admin-actions"><button>Search bank</button><button type="button" onClick={() => setRefreshKey(current => current + 1)}>Refresh bank</button></div>
    </form>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {loading && <p role="status">Loading question bank…</p>}
    {selected && <BankQuestionReview key={`${selected.externalKey}-${selected.reviewVersion}`} selected={selected} rpc={rpc} onClose={() => setSelected(null)} onReviewed={reviewed} loadMedia={loadMedia} />}
    {result && !loading && <>
      <p>{result.total ? `${result.offset + 1}–${Math.min(result.offset + result.limit, result.total)} of ${result.total} matching questions` : "No questions match these filters."}</p>
      <div className="admin-list">{result.items.map(question => <article key={question.externalKey}>
        <b className="bank-review-key">{question.externalKey}</b><span className="status-pill">{!question.active ? "inactive" : question.approved && question.rightsConfirmed ? "approved" : question.runtimeReady ? "ready for review" : "awaiting conversion"}</span>
        <p>{question.prompt}</p><small>{question.exam.toUpperCase()} · {question.type} · {question.topic} · {question.licence}</small>
        <button type="button" onClick={() => { setMessage(""); setSelected(question); }}>Open question {question.externalKey}</button>
      </article>)}</div>
      <nav aria-label="Question bank pages" className="admin-actions">
        <button disabled={result.offset === 0} onClick={() => setQuery(current => ({ ...current, p_offset: Math.max(0, result.offset - result.limit) }))}>Previous questions</button>
        <button disabled={result.offset + result.limit >= result.total} onClick={() => setQuery(current => ({ ...current, p_offset: result.offset + result.limit }))}>Next questions</button>
      </nav>
    </>}
  </section>;
}
