import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "./PortalShell.jsx";
import { platform } from "./platform.js";
import { useAuthState } from "./useAuth.js";
const rpc = async (n, a) => {
  const { data, error } = await platform.rpc(n, a);
  if (error) throw error;
  return data;
};
export function LearnView({ lessons = [], progress, onOpen, message = "" }) {
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
            <button className="text-button" onClick={() => onOpen(l)}>
              {l.completed ? "Review lesson" : "Start lesson"} →
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
export function Learn() {
  const { session, loading } = useAuthState(),
    [lessons, setLessons] = useState([]),
    [progress, setProgress] = useState(),
    [lesson, setLesson] = useState(),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (session)
      Promise.all([rpc("learning_catalog"), rpc("learning_progress")])
        .then(([catalog, summary]) => { setLessons(catalog); setProgress(summary); })
        .catch((e) => setMessage(e.message));
  }, [session]);
  if (!session && !loading)
    return (
      <section className="wrap section">
        <h1>
          Sign in to <em>learn.</em>
        </h1>
        <Link to="/account">Student sign in</Link>
      </section>
    );
  if (lesson)
    return (
      <PortalShell>
        <section className="wrap section lesson">
          <button className="text-button" onClick={() => setLesson()}>
            ← All lessons
          </button>
          <span className="eyebrow">
            {lesson.exam} · {lesson.topic}
          </span>
          <h1>{lesson.title}</h1>
          <p className="lesson-body">{lesson.body}</p>
          <button
            className="button"
            onClick={async () => {
              await rpc("complete_learning_lesson", { p_lesson_id: lesson.id });
              setLesson({ ...lesson, completed: true });
              const [catalog, summary] = await Promise.all([rpc("learning_catalog"), rpc("learning_progress")]);
              setLessons(catalog);
              setProgress(summary);
            }}
          >
            Mark complete
          </button>{" "}
          <Link to="/dashboard/practice">Practise this topic →</Link>
        </section>
      </PortalShell>
    );
  return (
    <PortalShell>
      <LearnView
        lessons={lessons}
        progress={progress}
        message={message}
        onOpen={async (l) =>
          setLesson(await rpc("read_learning_lesson", { p_slug: l.slug }))
        }
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
