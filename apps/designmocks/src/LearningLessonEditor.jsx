import React, { useState } from "react";
import { learningDraftInput, learningPublicationInput } from "./learning-editor.js";

function LessonDraftForm({ lesson, onSave, onCancel, busy }) {
  return <form className="admin-form" onSubmit={(event) => {
    event.preventDefault();
    onSave(event.currentTarget, lesson);
  }}>
    <label>Lesson URL slug<input name="slug" required defaultValue={lesson?.slug} /></label>
    <label>Exam<select name="exam" defaultValue={lesson?.exam ?? "uceed"}>
      {["uceed", "nid", "nift", "ceed"].map((exam) => <option key={exam} value={exam}>{exam.toUpperCase()}</option>)}
    </select></label>
    <label>Topic<input name="topic" required defaultValue={lesson?.topic} /></label>
    <label>Title<input name="title" minLength={5} maxLength={160} required defaultValue={lesson?.title} /></label>
    <label>Summary<textarea name="summary" minLength={10} maxLength={500} required defaultValue={lesson?.summary} /></label>
    <label>Lesson body<textarea name="body" minLength={20} maxLength={50000} rows={8} required defaultValue={lesson?.body} /></label>
    <label>Order<input name="ordinal" type="number" min={1} max={1000} required defaultValue={lesson?.ordinal ?? 1} /></label>
    <div className="admin-actions">
      <button type="submit" disabled={busy}>Save lesson draft</button>
      {onCancel && <button type="button" disabled={busy} onClick={onCancel}>Cancel editing</button>}
    </div>
  </form>;
}

export function LearningLessonEditor({ lessons, rpc, refresh }) {
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const run = async (action) => {
    setBusy(true);
    setError("");
    setMessage("");
    try { await action(); }
    catch (failure) {
      setError(failure.code === "23505" ? "A lesson already uses that URL or position in this topic." : failure.message);
    } finally { setBusy(false); }
  };
  const save = (form, lesson) => run(async () => {
    await rpc("admin_save_learning_draft", learningDraftInput(new FormData(form), lesson));
    form.reset();
    setEditingId(null);
    setMessage("Lesson draft saved.");
    await refresh();
  });
  const setPublication = (event, lesson) => {
    event.preventDefault();
    const form = event.currentTarget;
    return run(async () => {
      const input = learningPublicationInput(lesson, new FormData(form).get("note"));
      const changed = await rpc("admin_set_learning_publication", input);
      form.reset();
      setEditingId(null);
      setMessage(changed ? (input.p_publish ? "Lesson published in Learn." : "Lesson withdrawn from Learn.") : "Publication is already up to date.");
      await refresh();
    });
  };

  return <section aria-labelledby="theory-lesson-editor">
    <h2 id="theory-lesson-editor">Theory lessons</h2>
    <p>Save lesson text as a draft. Record publication rights when you publish it in Learn.</p>
    <button type="button" disabled={busy} onClick={() => run(refresh)}>Refresh lesson list</button>
    <p role="status">{message}</p>
    {error && <p role="alert">{error}</p>}
    {lessons === null ? <p role="status">Loading theory lessons…</p> : <>
      <details>
        <summary>Add a theory lesson</summary>
        <LessonDraftForm onSave={save} busy={busy} />
      </details>
      <div className="admin-list">
        {lessons.length === 0 && <p>No theory lessons yet.</p>}
        {lessons.map((lesson) => <article key={lesson.id} aria-label={lesson.title}>
          <h3>{lesson.title}</h3>
          <span className="status-pill">{lesson.published ? "Published" : "Draft"}</span>
          <p>{lesson.exam.toUpperCase()} · {lesson.topic} · Lesson {lesson.ordinal}</p>
          <p>{lesson.summary}</p>
          {!lesson.published && editingId === lesson.id ?
            <LessonDraftForm key={lesson.version} lesson={lesson} onSave={save} busy={busy} onCancel={() => setEditingId(null)} /> : <>
              {!lesson.published && <button type="button" disabled={busy} onClick={() => setEditingId(lesson.id)}>Edit draft</button>}
              <form className="admin-form lesson-publication-form" onSubmit={(event) => setPublication(event, lesson)}>
                <label>{lesson.published ? "Reason for withdrawing" : "Publication rights evidence"}
                  <input name="note" minLength={5} maxLength={1000} required />
                </label>
                <button type="submit" disabled={busy}>{lesson.published ? "Withdraw lesson" : "Publish lesson"}</button>
              </form>
            </>}
        </article>)}
      </div>
    </>}
  </section>;
}
