import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { platform } from "./platform.js";
import { useAuthState } from "./useAuth.js";

async function rpc(name, args) {
  if (!platform) throw new Error("Student services are not connected yet.");
  const { data, error } = await platform.rpc(name, args);
  if (error) throw error;
  return data;
}

function Gate({ session, loading }) {
  if (loading) return <p role="status">Checking your account…</p>;
  if (!session)
    return (
      <p>
        Please <Link to="/account">sign in</Link> to continue.
      </p>
    );
  return null;
}

export function BugReport() {
  const { session, loading } = useAuthState();
  const [reports, setReports] = useState([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      session &&
      rpc("my_bug_reports")
        .then(setReports)
        .catch((e) => setMessage(e.message)),
    [session],
  );
  useEffect(() => {
    load();
  }, [load]);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await rpc("submit_bug_report", {
        p_title: form.get("title"),
        p_description: form.get("description"),
        p_page_url: window.location.href,
      });
      event.currentTarget.reset();
      setMessage("Thanks — your report is now in the review queue.");
      await load();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="wrap section admin-page">
      <span className="eyebrow">HELP US IMPROVE</span>
      <h1>
        Report a <em>problem.</em>
      </h1>
      <Gate session={session} loading={loading} />
      {session && (
        <>
          <form className="admin-form" onSubmit={submit}>
            <label>
              Short title
              <input name="title" minLength="5" maxLength="140" required />
            </label>
            <label>
              What happened?
              <textarea
                name="description"
                minLength="10"
                maxLength="5000"
                rows="6"
                required
              />
            </label>
            <button className="button" disabled={busy}>
              {busy ? "Sending…" : "Send report"}
            </button>
          </form>
          {message && <p role="status">{message}</p>}
          <h2>Your reports</h2>
          <div className="admin-list">
            {reports.map((r) => (
              <article key={r.id}>
                <b>{r.title}</b>
                <span className="status-pill">{r.status}</span>
                <p>{r.description}</p>
                {r.adminReply && (
                  <p>
                    <strong>Team reply:</strong> {r.adminReply}
                  </p>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function Admin() {
  const { session, loading } = useAuthState();
  const [allowed, setAllowed] = useState(null),
    [drafts, setDrafts] = useState([]),
    [bugs, setBugs] = useState([]),
    [bank, setBank] = useState([]),
    [blueprints, setBlueprints] = useState([]),
    [allIndia, setAllIndia] = useState([]),
    [lessons, setLessons] = useState([]),
    [drawings, setDrawings] = useState([]),
    [intake, setIntake] = useState([]),
    [questionReports, setQuestionReports] = useState([]),
    [bankRights, setBankRights] = useState({}),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    if (!session) return;
    try {
      const ok = await rpc("is_dmocks_admin");
      setAllowed(ok);
      if (ok) {
        const [d, b, q, m, a, r, l, w, i] = await Promise.all([
          rpc("admin_question_drafts"),
          rpc("admin_bug_reports"),
          rpc("admin_bank_questions", { p_limit: 25, p_offset: 0 }),
          rpc("admin_exam_mock_blueprints"),
          rpc("admin_all_india_events"),
          rpc("admin_reported_questions"),
          rpc("admin_learning_lessons"),
          rpc("admin_drawing_queue"),
          rpc("admin_question_intake_assets"),
        ]);
        setDrafts(d);
        setBugs(b);
        setBank(q);
        setBlueprints(m);
        setAllIndia(a);
        setQuestionReports(r);
        setLessons(l);
        setDrawings(w);
        setIntake(i);
      }
    } catch (e) {
      setMessage(e.message);
    }
  }, [session]);
  useEffect(() => {
    load();
  }, [load]);
  const addDraft = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const payload = JSON.parse(form.get("payload"));
      await rpc("admin_create_question_draft", {
        p_source_type: form.get("sourceType"),
        p_source_name: form.get("sourceName"),
        p_payload: payload,
      });
      event.currentTarget.reset();
      await load();
    } catch (e) {
      setMessage(e.message);
    }
  };
  const review = async (id, decision) => {
    try {
      await rpc("admin_review_question_draft", {
        p_id: id,
        p_decision: decision,
        p_note: null,
      });
      await load();
    } catch (e) {
      setMessage(e.message);
    }
  };
  const reply = async (event, id) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await rpc("admin_reply_bug_report", {
        p_id: id,
        p_status: form.get("status"),
        p_reply: form.get("reply"),
      });
      await load();
    } catch (e) {
      setMessage(e.message);
    }
  };
  const reviewBank = async (key, approved) => {
    try {
      await rpc("admin_review_bank_question", {
        p_external_key: key,
        p_approved: approved,
        p_rights_confirmed: approved && Boolean(bankRights[key]),
        p_note: null,
      });
      await load();
    } catch (e) {
      setMessage(e.message);
    }
  };
  const configureMock = async (event, exam) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await rpc("admin_configure_exam_mock", {
        p_exam: exam,
        p_question_count: Number(form.get("count")),
        p_duration_seconds: Number(form.get("duration")),
        p_free_attempt_limit: Number(form.get("free")),
        p_enabled: form.get("enabled") === "on",
      });
      await load();
    } catch (e) {
      setMessage(e.message);
    }
  };
  const createAllIndia = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await rpc("admin_create_all_india_event", {
        p_exam: form.get("exam"),
        p_title: form.get("title"),
        p_starts_at: new Date(form.get("startsAt")).toISOString(),
        p_question_count: Number(form.get("count")),
        p_duration_seconds: Number(form.get("duration")),
      });
      event.currentTarget.reset();
      await load();
    } catch (e) {
      setMessage(e.message);
    }
  };
  const releaseAllIndia = async (id) => {
    try {
      await rpc("admin_release_all_india_results", { p_event_id: id });
      await load();
    } catch (e) {
      setMessage(e.message);
    }
  };
  const resolveQuestionReport = async (key, action) => {
    try {
      await rpc("admin_resolve_reported_question", {
        p_target_key: key,
        p_action: action,
        p_note: null,
      });
      await load();
    } catch (e) {
      setMessage(e.message);
    }
  };
  const addLesson = async (event) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      await rpc("admin_upsert_learning_lesson", {
        p_id: null,
        p_slug: f.get("slug"),
        p_exam: f.get("exam"),
        p_topic: f.get("topic"),
        p_title: f.get("title"),
        p_summary: f.get("summary"),
        p_body: f.get("body"),
        p_ordinal: Number(f.get("ordinal")),
        p_publish: f.get("publish") === "on",
        p_rights_confirmed: f.get("rights") === "on",
      });
      event.currentTarget.reset();
      await load();
    } catch (e) {
      setMessage(e.message);
    }
  };
  const reviewDrawing = async (event, id) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      await rpc("admin_review_drawing", {
        p_review_id: id,
        p_criterion_marks: JSON.parse(f.get("criteria")),
        p_comments: f.get("comments"),
        p_score: Number(f.get("score")),
        p_override_reason: null,
      });
      await load();
    } catch (e) {
      setMessage(e.message);
    }
  };
  const uploadIntake = async (event) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget),
      body = new FormData();
    body.set("file", f.get("file"));
    try {
      const { data, error } = await platform.functions.invoke(
        "question-intake",
        { body },
      );
      if (error) throw error;
      setMessage(`${data.name} uploaded privately for extraction.`);
      event.currentTarget.reset();
      await load();
    } catch (e) {
      setMessage(e.message);
    }
  };
  const promoteIntake = async (event, id) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      await rpc("admin_promote_intake_asset", {
        p_asset_id: id,
        p_payload: JSON.parse(f.get("payload")),
      });
      await load();
    } catch (e) {
      setMessage(e.message);
    }
  };
  return (
    <section className="wrap section admin-page">
      <span className="eyebrow">DMOCKS OPERATIONS</span>
      <h1>
        Admin <em>review.</em>
      </h1>
      <Gate session={session} loading={loading} />
      {session && allowed === false && (
        <p className="error">This account is not an administrator.</p>
      )}
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
      {allowed && (
        <>
          <h2>PDF and photo question intake</h2>
          <form className="admin-form" onSubmit={uploadIntake}>
            <label>
              Private source file
              <input
                name="file"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                required
              />
            </label>
            <button>Upload for extraction</button>
          </form>
          <div className="admin-list">
            {intake.map((x) => (
              <article key={x.id}>
                <b>{x.name}</b>
                <span className="status-pill">{x.status}</span>
                {x.status !== "reviewed" && (
                  <form
                    className="admin-form"
                    onSubmit={(e) => promoteIntake(e, x.id)}
                  >
                    <label>
                      Extracted question JSON
                      <textarea
                        name="payload"
                        required
                        rows="8"
                        placeholder={'{"prompt":"…","holds":[]}'}
                      />
                    </label>
                    <button>Send to human review</button>
                  </form>
                )}
              </article>
            ))}
          </div>
          <h2>Drawing review queue</h2>
          <div className="admin-list">
            {drawings.map((d) => (
              <article key={d.reviewId}>
                <b>Anonymous submission · {d.uploadCount} images</b>
                <span className="status-pill">{d.status}</span>
                {d.status !== "reviewed" && (
                  <form
                    className="admin-form"
                    onSubmit={(e) => reviewDrawing(e, d.reviewId)}
                  >
                    <label>
                      Criterion marks JSON
                      <textarea
                        name="criteria"
                        required
                        defaultValue={'{"composition":0,"clarity":0}'}
                      />
                    </label>
                    <label>
                      Score
                      <input
                        name="score"
                        type="number"
                        min="0"
                        step="0.5"
                        required
                      />
                    </label>
                    <label>
                      Feedback
                      <textarea name="comments" required minLength="5" />
                    </label>
                    <button>Save human review</button>
                  </form>
                )}
              </article>
            ))}
          </div>
          <h2>Publish a theory lesson</h2>
          <form className="admin-form" onSubmit={addLesson}>
            <label>
              Slug
              <input name="slug" pattern="[a-z0-9-]+" required />
            </label>
            <label>
              Exam
              <select name="exam">
                {["uceed", "nid", "nift", "ceed"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Topic
              <input name="topic" required />
            </label>
            <label>
              Title
              <input name="title" minLength="5" required />
            </label>
            <label>
              Summary
              <textarea name="summary" minLength="10" required />
            </label>
            <label>
              Lesson body
              <textarea name="body" minLength="20" rows="10" required />
            </label>
            <label>
              Order
              <input
                name="ordinal"
                type="number"
                min="1"
                defaultValue="1"
                required
              />
            </label>
            <label>
              <input name="rights" type="checkbox" /> Rights confirmed
            </label>
            <label>
              <input name="publish" type="checkbox" /> Publish now
            </label>
            <button>Save lesson</button>
          </form>
          <p>{lessons.length} lessons in the catalogue.</p>
          <h2>Reported questions</h2>
          <p>
            Questions enter this queue only after the report threshold. A human
            administrator decides whether to retire them.
          </p>
          <div className="admin-list">
            {questionReports.map((report) => (
              <article key={report.targetKey}>
                <b>{report.sourceExternalKey || report.targetKey}</b>
                <span className="status-pill">
                  {report.status} · {report.reportCount} reports
                </span>
                <p>{report.prompt}</p>
                <small>
                  {Object.entries(report.reasons || {})
                    .map(([reason, count]) => `${reason}: ${count}`)
                    .join(" · ")}
                </small>
                <div className="admin-actions">
                  <button
                    onClick={() =>
                      resolveQuestionReport(report.targetKey, "retire")
                    }
                  >
                    Retire question
                  </button>
                  <button
                    onClick={() =>
                      resolveQuestionReport(report.targetKey, "dismiss")
                    }
                  >
                    Dismiss
                  </button>
                  {report.status !== "pending" && (
                    <button
                      onClick={() =>
                        resolveQuestionReport(report.targetKey, "reopen")
                      }
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          <h2>Add a question draft</h2>
          <p>
            Manual, extracted, and AI-generated questions all enter the same
            human review queue. Approval does not directly edit the Git question
            bank.
          </p>
          <form className="admin-form" onSubmit={addDraft}>
            <label>
              Source
              <select name="sourceType">
                <option value="manual">Manual</option>
                <option value="pdf">PDF extraction</option>
                <option value="photo">Photo extraction</option>
                <option value="ai">AI draft</option>
              </select>
            </label>
            <label>
              Source name
              <input name="sourceName" />
            </label>
            <label>
              Question JSON
              <textarea
                name="payload"
                rows="10"
                required
                placeholder={'{"prompt":"…","holds":[]}'}
              />
            </label>
            <button className="button">Queue draft</button>
          </form>
          <h2>All India mock events</h2>
          <p>
            Each event freezes one paper for every candidate, stays open for ten
            days and keeps results in review for ten more days.
          </p>
          <form className="admin-form" onSubmit={createAllIndia}>
            <label>
              Exam
              <select name="exam">
                {["uceed", "nid", "nift", "ceed"].map((exam) => (
                  <option key={exam}>{exam}</option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input name="title" required minLength="5" />
            </label>
            <label>
              Starts at
              <input name="startsAt" type="datetime-local" required />
            </label>
            <label>
              Questions
              <input
                name="count"
                type="number"
                min="10"
                max="100"
                defaultValue="30"
                required
              />
            </label>
            <label>
              Exam duration in seconds
              <input
                name="duration"
                type="number"
                min="900"
                max="21600"
                defaultValue="3600"
                required
              />
            </label>
            <button className="button">Freeze and schedule event</button>
          </form>
          <div className="admin-list">
            {allIndia.map((event) => (
              <article key={event.id}>
                <b>
                  {event.exam.toUpperCase()} · {event.title}
                </b>
                <span className="status-pill">
                  {event.resultsReleasedAt
                    ? "released"
                    : `${event.attempts} attempts`}
                </span>
                <p>
                  Attempt window:{" "}
                  {new Date(event.startsAt).toLocaleString("en-IN")} –{" "}
                  {new Date(event.endsAt).toLocaleString("en-IN")}
                </p>
                {!event.resultsReleasedAt && (
                  <button onClick={() => releaseAllIndia(event.id)}>
                    Release reviewed results
                  </button>
                )}
              </article>
            ))}
          </div>
          <h2>Exam-wise mock releases</h2>
          <div className="admin-list">
            {blueprints.map((m) => (
              <article key={m.exam}>
                <b>{m.exam.toUpperCase()}</b>
                <p>
                  {m.reviewedQuestions} reviewed runtime questions available.
                </p>
                <form
                  className="admin-reply"
                  onSubmit={(e) => configureMock(e, m.exam)}
                >
                  <input
                    name="count"
                    type="number"
                    min="10"
                    max="100"
                    defaultValue={m.questionCount}
                    aria-label={`${m.exam} question count`}
                  />
                  <input
                    name="duration"
                    type="number"
                    min="900"
                    max="21600"
                    defaultValue={m.durationSeconds}
                    aria-label={`${m.exam} duration seconds`}
                  />
                  <select
                    name="free"
                    defaultValue={m.freeAttemptLimit}
                    aria-label={`${m.exam} free attempts`}
                  >
                    <option value="0">No free attempt</option>
                    <option value="1">1 free attempt</option>
                    <option value="2">2 free attempts</option>
                  </select>
                  <label>
                    <input
                      name="enabled"
                      type="checkbox"
                      defaultChecked={m.enabled}
                    />{" "}
                    Released
                  </label>
                  <button>Save mock</button>
                </form>
              </article>
            ))}
          </div>
          <h2>Imported bank review</h2>
          <p>
            Approval requires a runtime-safe conversion and your explicit
            confirmation that DMocks may use the content.
          </p>
          <div className="admin-list">
            {bank.map((q) => (
              <article key={q.externalKey}>
                <b>{q.externalKey}</b>
                <span className="status-pill">
                  {q.approved
                    ? "approved"
                    : q.runtimeReady
                      ? "ready for review"
                      : "not runtime ready"}
                </span>
                <p>{q.prompt}</p>
                <small>
                  {q.exam.toUpperCase()} · {q.type} · {q.topic} · {q.licence}
                </small>
                {q.runtimeReady && !q.approved && (
                  <>
                    <label className="profile-check">
                      <input
                        type="checkbox"
                        checked={Boolean(bankRights[q.externalKey])}
                        onChange={(e) =>
                          setBankRights((current) => ({
                            ...current,
                            [q.externalKey]: e.target.checked,
                          }))
                        }
                      />
                      I confirm DMocks has the right to use this question.
                    </label>
                    <div className="admin-actions">
                      <button
                        disabled={!bankRights[q.externalKey]}
                        onClick={() => reviewBank(q.externalKey, true)}
                      >
                        Approve for practice
                      </button>
                      <button onClick={() => reviewBank(q.externalKey, false)}>
                        Reject
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
          <h2>Question review queue</h2>
          <div className="admin-list">
            {drafts.map((d) => (
              <article key={d.id}>
                <b>{d.sourceName || d.sourceType}</b>
                <span className="status-pill">{d.status}</span>
                <pre>{JSON.stringify(d.payload, null, 2)}</pre>
                {d.status === "pending" && (
                  <div className="admin-actions">
                    <button onClick={() => review(d.id, "approved")}>
                      Approve for export
                    </button>
                    <button onClick={() => review(d.id, "rejected")}>
                      Reject
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
          <h2>Bug reports</h2>
          <div className="admin-list">
            {bugs.map((b) => (
              <article key={b.id}>
                <b>{b.title}</b>
                <p>{b.description}</p>
                <form className="admin-reply" onSubmit={(e) => reply(e, b.id)}>
                  <select name="status" defaultValue={b.status}>
                    <option>open</option>
                    <option>investigating</option>
                    <option>fixed</option>
                    <option>closed</option>
                  </select>
                  <input
                    name="reply"
                    defaultValue={b.adminReply || ""}
                    placeholder="Reply to reporter"
                  />
                  <button>Save</button>
                </form>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
