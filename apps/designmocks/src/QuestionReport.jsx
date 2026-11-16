import React, { useRef, useState } from "react";
import { questionReportConfirmation } from "./question-quality.js";

export function QuestionReport({ disabled = false, onSubmit }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const submit = async (event) => {
    event.preventDefault();
    if (disabled || submitting.current) return;
    const form = new FormData(event.currentTarget);
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await onSubmit({
        reason: form.get("reason"),
        details: form.get("details"),
      });
      setMessage(questionReportConfirmation(result));
      setOpen(false);
    } catch (error) {
      setMessage(error.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="question-report">
      <button
        className="text-button"
        type="button"
        disabled={disabled || busy}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Report question
      </button>
      {open && (
        <form className="question-report-form" onSubmit={submit}>
          <label>
            What is wrong?
            <select name="reason" defaultValue="incorrect">
              <option value="incorrect">Incorrect question or answer</option>
              <option value="incomplete">Incomplete question</option>
              <option value="media">Missing or unclear image</option>
              <option value="duplicate">Duplicate question</option>
              <option value="other">Other issue</option>
            </select>
          </label>
          <label>
            Details (optional)
            <textarea name="details" maxLength="1000" rows="3" />
          </label>
          <div className="admin-actions">
            <button className="button quiet" disabled={disabled || busy}>
              {busy ? "Sending…" : "Send report"}
            </button>
            <button
              className="text-button"
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {message && (
        <p className="save-status" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

export function QuestionReportPreview() {
  return (
    <section className="wrap section">
      <h1>
        Review a <em>question.</em>
      </h1>
      <QuestionReport
        onSubmit={async () => ({ reportCount: 2, threshold: 5, held: false })}
      />
    </section>
  );
}
