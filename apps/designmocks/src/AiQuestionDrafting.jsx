import React, { useState } from "react";

export function AiQuestionDrafting({ requests = [], onGenerate }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generate = async input => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await onGenerate(input);
      setMessage("AI draft created and sent to human review.");
      return true;
    } catch (failure) { setError(failure.message); return false; }
    finally { setBusy(false); }
  };
  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const basisExternalKeys = String(fields.get("basisExternalKeys")).split(",").map((key) => key.trim()).filter(Boolean);
    if (basisExternalKeys.length < 1 || basisExternalKeys.length > 10 ||
        new Set(basisExternalKeys).size !== basisExternalKeys.length) {
      setMessage("");
      setError("Enter 1 to 10 distinct basis keys.");
      return;
    }
    const saved = await generate({
      exam: fields.get("exam"),
      topic: String(fields.get("topic")).trim(),
      questionType: fields.get("questionType"),
      instruction: String(fields.get("instruction")).trim(),
      basisExternalKeys,
    });
    if (saved) form.reset();
  };

  return <section className="ai-drafting" aria-labelledby="ai-draft-heading">
    <h2 id="ai-draft-heading">Generate an AI-assisted question draft</h2>
    <p>References calibrate skill and difficulty. The draft needs human review and a rights record before export.</p>
    <form className="admin-form" onSubmit={submit}>
      <label>Exam<select name="exam">{["uceed", "nid", "nift", "ceed"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Topic<input name="topic" required minLength={2} maxLength={120} /></label>
      <label>Question type<select name="questionType">
        {["MCQ", "MSQ", "NAT", "DESCRIPTIVE"].map((value) => <option key={value}>{value}</option>)}
      </select></label>
      <label>Rights-approved basis keys<input name="basisExternalKeys" required placeholder="uceed-2024-q1, uceed-2023-q5" /></label>
      <label>Generation brief<textarea name="instruction" required minLength={10} maxLength={2000}
        placeholder="Create an original question testing…" /></label>
      <button className="button" disabled={busy}>{busy ? "Generating…" : "Generate review draft"}</button>
    </form>
    {message && <p role="status">{message}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="admin-list">
      {requests.map((request) => <article key={request.id}>
        <b>{request.exam.toUpperCase()} · {request.topic} · {request.questionType}</b>
        <span className="status-pill">{request.status}</span>
        <p>References {request.basisExternalKeys.join(", ")}</p>
        {request.error && <p className="error">{request.error}</p>}
        {request.attemptCount > 0 && <p>Processing attempt {request.attemptCount}</p>}
        {request.retryAvailable && <button type="button" disabled={busy} onClick={() => generate({ requestId: request.id })}>{busy ? "Retrying…" : "Retry draft"}</button>}
      </article>)}
    </div>
  </section>;
}

export function AiQuestionDraftingPreview() {
  const [requests, setRequests] = useState([]);
  return <section className="wrap section admin-page">
    <h1>AI-assisted <em>drafting.</em></h1>
    <AiQuestionDrafting requests={requests} onGenerate={async (input) => setRequests([{ id: "preview", ...input, status: "succeeded" }])} />
  </section>;
}
