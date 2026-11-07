import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "./PortalShell.jsx";
import { platform } from "./platform.js";
import { useAuthState } from "./useAuth.js";
import { learningPracticeLink } from "./practice-context.js";
const rpc = async (n, a) => {
  const { data, error } = await platform.rpc(n, a);
  if (error) throw error;
  return data;
};
export function LearnView({ lessons = [], progress, onOpen, onRefresh, busy = false, message = "" }) {
  return (
    <section className="wrap section learn-page">
      <span className="eyebrow">LEARN, THEN PRACTISE</span>
      <h1>
        Build the idea.
        <br />
        Then <em>use it.</em>
      </h1>
      <p>Short theory lessons connect directly to topic practice.</p>
      {progress && (
        <div className="learning-progress" aria-label="Learning progress">
          <div>
            <strong>{progress.percent}% complete</strong>
            <span>{progress.completed} of {progress.total} lessons</span>
          </div>
          <progress value={progress.completed} max={Math.max(progress.total, 1)}>
            {progress.percent}%
          </progress>
          {progress.recommendation && (
            <p>
              <b>Recommended next: {progress.recommendation.title}</b><br />
              {progress.recommendation.reason}
            </p>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {onRefresh && <button className="button quiet" disabled={busy} onClick={onRefresh}>Refresh lessons</button>}
      {lessons.length === 0 && !message && <p>No theory lessons have been published yet.</p>}
      <div className="learn-grid">
        {lessons.map((l) => (
          <article key={l.id}>
            <span className="status-pill">
              {l.completed
                ? "completed"
                : l.exam.toUpperCase() + " · " + l.topic}
            </span>
            <h2>{l.title}</h2>
            {progress?.recommendation?.id === l.id && <span className="recommended-label">Recommended next</span>}
            <p>{l.summary}</p>
            <button className="text-button" disabled={busy} onClick={() => onOpen(l)}>
              {l.completed ? "Review lesson" : "Start lesson"} →
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
export function Learn() {
  const { session, loading } = useAuthState();
  if (loading) return <p className="wrap" role="status">Checking your account…</p>;
  if (!session)
    return (
      <section className="wrap section">
        <h1>
          Sign in to <em>learn.</em>
        </h1>
        <Link to="/account">Student sign in</Link>
      </section>
    );
  return <StudentLearn key={session.user.id} />;
}

function StudentLearn() {
  const [catalog, setCatalog] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    const [lessons, progress] = await Promise.all([rpc("learning_catalog"), rpc("learning_progress")]);
    setCatalog({ lessons, progress });
  }, []);
  useEffect(() => { refresh().catch(() => setMessage("Couldn’t load the lesson list.")); }, [refresh]);

  const run = async (action, fallback) => {
    setBusy(true);
    setMessage("");
    try { await action(); }
    catch (failure) {
      if (failure.message === "Lesson not found") {
        setLesson(null);
        setCatalog(null);
        setMessage("This lesson is no longer available.");
        await refresh().catch(() => setMessage("This lesson is no longer available. Refresh the lesson list to try again."));
      } else setMessage(fallback);
    } finally { setBusy(false); }
  };
  const complete = () => run(async () => {
    await rpc("complete_learning_lesson", { p_lesson_id: lesson.id });
    setLesson({ ...lesson, completed: true });
    await refresh().catch(() => setMessage("Lesson complete. Refresh the lesson list to update your progress."));
  }, "Couldn’t mark this lesson complete. Try again.");
  const practice = learningPracticeLink(lesson);

  if (lesson)
    return (
      <PortalShell>
        <section className="wrap section lesson">
          <button className="text-button" disabled={busy} onClick={() => { setMessage(""); setLesson(null); }}>
            ← All lessons
          </button>
          <span className="eyebrow">
            {lesson.exam} · {lesson.topic}
          </span>
          <h1>{lesson.title}</h1>
          <p className="lesson-body">{lesson.body}</p>
          {message && <p role="status">{message}</p>}
          <button className="button" disabled={busy || lesson.completed} onClick={complete}>
            {lesson.completed ? "Lesson complete" : "Mark complete"}
          </button>{" "}
          <Link to={practice.to}>{practice.label} →</Link>
        </section>
      </PortalShell>
    );
  return (
    <PortalShell>
      <LearnView
        lessons={catalog?.lessons}
        progress={catalog?.progress}
        message={message || (!catalog ? "Loading theory lessons…" : "")}
        busy={busy}
        onRefresh={message ? () => run(refresh, "Couldn’t load the lesson list.") : undefined}
        onOpen={(item) => run(async () => {
          setLesson(await rpc("read_learning_lesson", { p_slug: item.slug }));
        }, "Couldn’t open this lesson. Try again.")}
      />
    </PortalShell>
  );
}
export function LearnPreview() {
  const [m, setM] = useState("");
  return (
    <LearnView
      lessons={[
        {
          id: "1",
          exam: "uceed",
          topic: "observation",
          title: "Notice before you decide",
          summary: "Separate what you see from what you assume.",
          completed: false,
        },
        {
          id: "2",
          exam: "uceed",
          topic: "visualisation",
          title: "Turn forms in your mind",
          summary: "Practise rotations before choosing an answer.",
          completed: true,
        },
      ]}
      progress={{
        total: 2,
        completed: 1,
        percent: 50,
        recommendation: {
          id: "1",
          title: "Notice before you decide",
          reason: "Recommended from your 40% accuracy across 5 answered observation questions.",
        },
      }}
      message={m}
      onOpen={(l) => setM(`Preview lesson opened: ${l.title}`)}
    />
  );
}
