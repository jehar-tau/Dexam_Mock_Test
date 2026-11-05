import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Art, Arrow } from "./Art.jsx";
import { platform, loadDashboard } from "./platform.js";
import { useAuthState } from "./useAuth.js";
import { PortalShell } from "./PortalShell.jsx";
import { QuestionReport } from "./QuestionReport.jsx";
import { DrawingUploads } from "./DrawingUploads.jsx";

const rpc = async (name, args) => {
  if (!platform) throw new Error("Student services are not connected yet.");
  const { data, error } = await platform.rpc(name, args);
  if (error) throw error;
  return data;
};
function SignInGate() {
  return (
    <section className="wrap page-intro">
      <span className="eyebrow">YOUR PRACTICE SPACE</span>
      <h1>
        One account.
        <br /> Your own <em>progress.</em>
      </h1>
      <p>Sign in to open your papers and saved attempts.</p>
      <Link className="button" to="/account">
        Student sign in <Arrow />
      </Link>
    </section>
  );
}
export function Workspace() {
  const { session, loading } = useAuthState();
  const navigate = useNavigate();
  const [data, setData] = useState(null),
    [papers, setPapers] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  useEffect(() => {
    let alive = true;
    if (session) {
      Promise.all([loadDashboard(), rpc("available_papers")])
        .then(([d, p]) => {
          if (alive) {
            setData(d);
            setPapers(p);
          }
        })
        .catch(() => {
          if (alive)
            setError(
              "Couldn’t load your workspace. Please refresh to try again.",
            );
        });
    }
    return () => {
      alive = false;
    };
  }, [session]);
  const start = async (id) => {
    setBusy(id);
    setError("");
    try {
      const attempt = await rpc("start_attempt", { p_paper_id: id });
      navigate("/attempt/" + attempt);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  if (!session && !loading) return <SignInGate />;
  return (
    <PortalShell>
      <WorkspaceView
        data={data}
        papers={papers}
        error={error}
        busy={busy}
        loading={loading}
        onStart={start}
      />
    </PortalShell>
  );
}

// Shared presentation only. Live identity checks and RPCs stay in Workspace.
export function WorkspaceView({
  data,
  papers = [],
  error = "",
  busy = "",
  loading = false,
  onStart,
  attemptHref = (id) => "/attempt/" + id,
  startLabel = "Start or resume",
  passLabel = "YOUR PASS",
}) {
  return (
    <section className="wrap section workspace">
      <span className="eyebrow">YOUR PRACTICE SPACE</span>
      <h1>
        Welcome to your
        <br /> next <em>attempt.</em>
      </h1>
      {(loading || (!data && !error)) && (
        <p role="status">Loading your workspace…</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <div className="dashboard-stats">
            <article>
              <span>{passLabel}</span>
              <h2>{data.access?.active ? "Active" : "Not active"}</h2>
              {data.access?.active ? (
                <p>
                  Until{" "}
                  {new Date(data.access.expiresAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              ) : (
                <Link to="/plans">View the annual pass →</Link>
              )}
            </article>
            <article>
              <span>ATTEMPTS</span>
              <h2>{data.attempts.length}</h2>
              <p>One at a time.</p>
            </article>
            <article>
              <span>YOUR NEXT STEP</span>
              <h2>Begin.</h2>
              <a href="#your-papers">Choose a released paper →</a>
            </article>
          </div>
          <h2 id="your-papers">Your papers.</h2>
          {papers.length ? (
            <div className="paper-list">
              {papers.map((p) => (
                <article key={p.id}>
                  <span className="eyebrow">
                    {p.exam.toUpperCase()} ·{" "}
                    {Math.round(p.durationSeconds / 60)} MINUTES
                  </span>
                  <h3>{p.title}</h3>
                  <button
                    className="button"
                    disabled={!data.access?.active || Boolean(busy)}
                    onClick={() => onStart(p.id)}
                  >
                    {busy === p.id ? "Opening…" : startLabel}
                    <Arrow />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="notice">
              No papers have been released yet. They’ll appear here after the
              reviewed bank is imported and published.
            </div>
          )}
          <h2>Your recent attempts.</h2>
          {data.attempts.length ? (
            data.attempts.map((a) => (
              <article className="history-row" key={a.id}>
                <Link to={attemptHref(a.id)}>
                  {a.title}
                  <Arrow size={17} />
                </Link>
                <span>
                  {a.status === "active" ? "Continue / submit" : "View report"}
                </span>
                <span>
                  {a.status === "submitted"
                    ? `${a.score} / ${a.total}`
                    : "In progress"}
                </span>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <Art kind="space" />
              <h3>Every practice starts somewhere.</h3>
              <p>Your attempts will appear here.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
const hasAnswer = (answer) =>
  Array.isArray(answer)
    ? answer.length > 0
    : answer !== null && answer !== undefined && answer !== "";
export function Attempt() {
  const { session, loading } = useAuthState();
  const { id } = useParams();
  const [attempt, setAttempt] = useState(null),
    [index, setIndex] = useState(0),
    [draft, setDraft] = useState(null),
    [flagged, setFlagged] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [saved, setSaved] = useState(""),
    [now, setNow] = useState(Date.now()),
    [review, setReview] = useState(false),
    [media, setMedia] = useState({});
  const dialog = useRef(),
    offset = useRef(0),
    autoSubmitted = useRef(false),
    pending = useRef(Promise.resolve());
  const q = attempt?.questions[index];
  useEffect(() => {
    let alive = true;
    setAttempt(null);
    setIndex(0);
    setDraft(null);
    setError("");
    setFlagged([]);
    setMedia({});
    autoSubmitted.current = false;
    pending.current = Promise.resolve();
    if (session)
      rpc("read_attempt", { p_id: id })
        .then((data) => {
          if (alive) {
            offset.current = new Date(data.serverNow).getTime() - Date.now();
            setAttempt(data);
          }
        })
        .catch(() => {
          if (alive)
            setError(
              "This attempt is unavailable. Return to your workspace or try signing in again.",
            );
        });
    return () => {
      alive = false;
    };
  }, [session?.user.id, id]);
  useEffect(() => {
    setDraft(q?.answer ?? null);
    setSaved("");
  }, [q?.id]);
  useEffect(() => {
    if (attempt?.status !== "active") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [attempt?.status]);
  useEffect(() => {
    if (confirm && !dialog.current?.open) dialog.current?.showModal();
  }, [confirm]);
  useEffect(() => {
    let alive = true;
    if (attempt?.questions.some((item) => item.media?.length) && platform) {
      platform.functions
        .invoke("attempt-media", { body: { attemptId: id } })
        .then(({ data, error }) => {
          if (alive) {
            if (error)
              setError(
                "Couldn’t load the question images. Refresh before continuing.",
              );
            else setMedia(data?.media ?? {});
          }
        });
    }
    return () => {
      alive = false;
    };
  }, [attempt?.id]);
  const left = attempt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(attempt.deadline).getTime() - now - offset.current) / 1000,
        ),
      )
    : 0;
  const save = async (value) => {
    if (!q || attempt.status !== "active") return false;
    setBusy(true);
    setError("");
    setSaved("Saving…");
    const work = pending.current
      .catch(() => {})
      .then(() =>
        rpc("save_answer", {
          p_attempt_id: id,
          p_question_id: q.id,
          p_answer: value,
        }),
      );
    pending.current = work;
    try {
      await work;
      setAttempt((a) => ({
        ...a,
        questions: a.questions.map((item) =>
          item.id === q.id ? { ...item, answer: value } : item,
        ),
      }));
      setSaved("Saved");
      return true;
    } catch (e) {
      setError("Your answer was not saved. " + e.message);
      setSaved("Not saved");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const pick = (value) => {
    setDraft(value);
    save(value);
  };
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await pending.current.catch(() => {});
      const result = await rpc("submit_attempt", { p_id: id });
      setAttempt(result);
      setConfirm(false);
      dialog.current?.close();
    } catch (e) {
      setError("Couldn’t submit. " + e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (
      attempt?.status === "active" &&
      left === 0 &&
      !busy &&
      !autoSubmitted.current
    ) {
      autoSubmitted.current = true;
      submit();
    }
  }, [left, busy, attempt?.status]);
  const move = async (next) => {
    if (["nat", "drawing"].includes(q.kind) && draft !== q.answer) {
      if (!(await save(draft === "" ? null : draft))) return;
    }
    setIndex(next);
  };
  if (!session && !loading) return <SignInGate />;
  if (!attempt)
    return (
      <section className="wrap page-intro">
        <h1>
          Your practice <em>space.</em>
        </h1>
        <p role={error ? "alert" : "status"}>
          {error || "Loading your attempt…"}
        </p>
        <Link to="/dashboard">← Back to workspace</Link>
      </section>
    );
  if (attempt.status === "submitted") {
    const topics = [
      ...new Set(
        attempt.questions
          .filter((item) => item.kind !== "drawing")
          .map((item) => item.topic),
      ),
    ];
    return (
      <section className="wrap section sample-result">
        <Link className="back-link" to="/dashboard">
          ← Your workspace
        </Link>
        <div className="result-title">
          <div>
            <span className="eyebrow">{attempt.title} / YOUR REPORT</span>
            <h1>
              Make this attempt
              <br /> your next <em>step.</em>
            </h1>
            <p>
              Objective answers are marked with the paper’s reviewed key.
              Drawing is excluded from this score and remains a separate
              self-review exercise.
            </p>
          </div>
          <div className="sample-score">
            <span>
              {attempt.score}
              <i>/{attempt.total}</i>
            </span>
            <p>objective marks</p>
          </div>
        </div>
        <div className="result-grid">
          <article>
            <span className="eyebrow">A GLIMPSE OF EACH TOPIC</span>
            <h2>What you noticed.</h2>
            {topics.map((topic) => {
              const items = attempt.questions.filter(
                (item) =>
                  item.topic === topic &&
                  item.kind !== "drawing" &&
                  item.outcome !== "dropped",
              );
              return (
                <div className="result-topic" key={topic}>
                  <span>{topic}</span>
                  <b>
                    {
                      items.filter((item) =>
                        ["correct", "full_marks"].includes(item.outcome),
                      ).length
                    }
                    /{items.length} correct
                  </b>
                </div>
              );
            })}
          </article>
          <article>
            <span className="eyebrow">A PURPOSE FOR YOUR NEXT SESSION</span>
            <h2>Look for the pattern.</h2>
            <p>
              Choose one topic you found difficult. Review its explanations,
              solve the questions again without the timer, then compare your
              approach.
            </p>
            <p>
              Keep a short error notebook: what you missed, why you missed it
              and what you’ll check next time.
            </p>
            <p>This is feedback on this paper, not an admission prediction.</p>
          </article>
        </div>
        <div className="review-toggle">
          <h2>Explore the explanations.</h2>
          <button
            className="text-button"
            aria-expanded={review}
            onClick={() => setReview(!review)}
          >
            {review ? "Close" : "Open"} answer review
          </button>
        </div>
        {review && (
          <div className="answer-review">
            {attempt.questions.map((item, i) => (
              <article key={item.id}>
                <span className="eyebrow">
                  QUESTION {i + 1} / {item.topic}
                </span>
                <h3>{item.prompt}</h3>
                <p>
                  {item.kind === "drawing"
                    ? "Drawing · self-review"
                    : item.outcome.replaceAll("_", " ")}
                </p>
                <p>
                  Your answer:{" "}
                  {Array.isArray(item.answer)
                    ? item.answer.join(", ")
                    : (item.answer ?? "Not answered")}
                </p>
                <p>{item.explanation}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }
  return (
    <section className="wrap sample-run">
      <Link className="back-link" to="/dashboard">
        ← Your workspace
      </Link>
      <div className="runner-top">
        <div>
          <span className="eyebrow">YOUR TIMED ATTEMPT</span>
          <h1>{attempt.title}</h1>
        </div>
        <div
          className="timer"
          role="timer"
          aria-live="off"
          aria-label="Time remaining"
        >
          <span>
            {Math.floor(left / 3600)
              .toString()
              .padStart(2, "0")}
            :{Math.floor(left / 60) % 60 < 10 ? "0" : ""}
            {Math.floor(left / 60) % 60}:
            {(left % 60).toString().padStart(2, "0")}
          </span>
          <small>remaining</small>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {left === 0 && error && (
        <button className="button" disabled={busy} onClick={submit}>
          Retry submission <Arrow />
        </button>
      )}
      <div className="runner-layout">
        <article className="question-panel">
          <div className="question-meta">
            <span>
              QUESTION {index + 1} / {attempt.questions.length}
            </span>
            <span>
              {q.kind.toUpperCase()} · {q.topic}
            </span>
          </div>
          <h2>{q.prompt}</h2>
          {q.kind !== "drawing" && (
            <p>
              +{q.marking.correct} for a correct answer · {q.marking.wrong} for
              a wrong answer
              {q.kind === "msq" && q.marking.partial
                ? " · Partial marks apply to a correct subset."
                : ""}
            </p>
          )}
          {q.media?.map((image, i) =>
            media[q.id]?.[i] ? (
              <figure className="paper-media" key={image.path}>
                <img
                  src={media[q.id][i].url}
                  alt={image.alt || "Question figure " + (i + 1)}
                />
              </figure>
            ) : (
              <p role="status" key={image.path}>
                Loading question figure…
              </p>
            ),
          )}
          {["mcq", "msq"].includes(q.kind) ? (
            <div
              className="live-choices"
              role="group"
              aria-label={
                q.kind === "msq" ? "Choose all that apply" : "Choose one answer"
              }
            >
              {q.options.map((option) => (
                <button
                  disabled={busy || left === 0}
                  key={option.id}
                  aria-pressed={
                    q.kind === "msq"
                      ? (draft ?? []).includes(option.id)
                      : draft === option.id
                  }
                  className={
                    (
                      q.kind === "msq"
                        ? (draft ?? []).includes(option.id)
                        : draft === option.id
                    )
                      ? "chosen"
                      : ""
                  }
                  onClick={() =>
                    pick(
                      q.kind === "msq"
                        ? (draft ?? []).includes(option.id)
                          ? draft.filter((value) => value !== option.id)
                          : [...(draft ?? []), option.id]
                        : option.id,
                    )
                  }
                >
                  <span>{option.id}</span>
                  {option.label}
                </button>
              ))}
            </div>
          ) : q.kind === "nat" ? (
            <label className="numeric-answer">
              Your numerical answer
              <input
                inputMode="decimal"
                value={draft ?? ""}
                maxLength={64}
                onChange={(e) => setDraft(e.target.value)}
                disabled={busy || left === 0}
              />
            </label>
          ) : (
            <>
              <div className="notice">
                Draw on paper within the time limit. Compare your work with the
                guidance after submitting. No drawing upload or human evaluation
                is included in this version.
              </div>
              <label className="drawing-note">
                Your self-review notes (optional)
                <textarea
                  value={draft ?? ""}
                  maxLength={4000}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={busy || left === 0}
                />
              </label>
              <DrawingUploads attemptId={id} questionId={q.id} />
            </>
          )}
          {["nat", "drawing"].includes(q.kind) && (
            <button
              className="button quiet save-answer"
              disabled={busy || left === 0}
              onClick={() => save(draft === "" ? null : draft)}
            >
              Save answer <Arrow />
            </button>
          )}
          <p className="save-status" role="status">
            {saved || "Answers are saved to your account."}
          </p>
          <QuestionReport
            disabled={busy}
            onSubmit={({ reason, details }) =>
              rpc("report_attempt_question", {
                p_attempt_id: id,
                p_question_id: q.id,
                p_reason: reason,
                p_details: details,
              })
            }
          />
          <div className="runner-actions">
            <button
              className="text-button"
              disabled={index === 0 || busy}
              onClick={() => move(index - 1)}
            >
              ← Previous
            </button>
            <button
              className="text-button"
              disabled={busy}
              aria-pressed={flagged.includes(q.id)}
              onClick={() =>
                setFlagged((items) =>
                  items.includes(q.id)
                    ? items.filter((value) => value !== q.id)
                    : [...items, q.id],
                )
              }
            >
              {flagged.includes(q.id) ? "Marked to revisit" : "Mark to revisit"}
            </button>
            {index < attempt.questions.length - 1 ? (
              <button
                className="button"
                disabled={busy}
                onClick={() => move(index + 1)}
              >
                Next <Arrow />
              </button>
            ) : (
              <button
                className="button"
                disabled={busy}
                onClick={async () => {
                  if (await save(draft === "" ? null : draft)) setConfirm(true);
                }}
              >
                Review & submit <Arrow />
              </button>
            )}
          </div>
        </article>
        <aside className="question-palette">
          <h2>Your questions.</h2>
          <div>
            {attempt.questions.map((item, i) => (
              <button
                key={item.id}
                disabled={busy}
                aria-current={i === index ? "step" : undefined}
                aria-label={"Go to question " + (i + 1)}
                className={
                  (hasAnswer(item.answer) ? "answered " : "") +
                  (flagged.includes(item.id) ? "flagged" : "")
                }
                onClick={() => move(i)}
              >
                {i + 1}
                {flagged.includes(item.id) && <i aria-hidden="true" />}
              </button>
            ))}
          </div>
          <p>
            {attempt.questions.filter((item) => hasAnswer(item.answer)).length}{" "}
            of {attempt.questions.length} answered
          </p>
          <button
            className="button quiet"
            disabled={busy || left === 0}
            onClick={async () => {
              if (await save(draft === "" ? null : draft)) setConfirm(true);
            }}
          >
            Submit attempt <Arrow />
          </button>
          <small>
            The server enforces the deadline. Use “Save answer” for numerical
            answers and notes before leaving this page.
          </small>
        </aside>
      </div>
      {confirm && (
        <dialog
          ref={dialog}
          className="submit-dialog"
          onCancel={() => setConfirm(false)}
        >
          <span className="eyebrow">A MOMENT TO CHECK</span>
          <h2>Ready to submit?</h2>
          <p>
            {attempt.questions.filter((item) => hasAnswer(item.answer)).length}{" "}
            of {attempt.questions.length} answered. {flagged.length} marked to
            revisit.
          </p>
          <p>Submission locks this attempt and opens your answer review.</p>
          <div>
            <button className="button" disabled={busy} onClick={submit}>
              Submit & view report <Arrow />
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                dialog.current.close();
                setConfirm(false);
              }}
            >
              Back to the questions
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}
