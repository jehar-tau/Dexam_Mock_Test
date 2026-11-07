import React, { useMemo, useRef, useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { platform } from "./platform.js";
import { useAuthState } from "./useAuth.js";
import { PortalShell } from "./PortalShell.jsx";
import { practicePools, practiceSelection } from "./practice-context.js";

async function rpc(name, args, signal) {
  signal.throwIfAborted();
  const { data, error } = await platform.rpc(name, args).abortSignal(signal);
  signal.throwIfAborted();
  if (error) throw error;
  return data;
}

export function TopicPracticeView({ catalog, onStart, initialExam = "", initialTopic = "" }) {
  const [initial] = useState(() => practiceSelection(catalog, { exam: initialExam, topic: initialTopic }));
  const [exam, setExam] = useState(initial.exam), [topic, setTopic] = useState(initial.topic);
  const [count, setCount] = useState(10), [duration, setDuration] = useState(900);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [notice, setNotice] = useState(initial.notice);
  const exams = useMemo(() => [...new Set(practicePools(catalog).map(item => item.exam))], [catalog]);
  const pools = useMemo(() => practicePools(catalog, count), [catalog, count]);
  const topics = useMemo(() => pools.filter(item => item.exam === exam), [pools, exam]);
  const ready = topics.some(item => item.topic === topic);
  useEffect(() => { if (topic && !ready) setTopic(""); }, [ready, topic]);

  const changeExam = value => {
    setExam(value);
    const requestedTopic = typeof initialTopic === "string" ? initialTopic.trim() : "";
    const matching = pools.find(item => item.exam === value && item.topic === (topic || requestedTopic));
    setTopic(matching?.topic || pools.find(item => item.exam === value)?.topic || "");
    setNotice("");
    setMessage("");
  };
  const submit = async event => {
    event.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setMessage("");
    try { await onStart({ exam, topic, count, duration }); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return <section className="section portal-module topic-practice">
    <span className="eyebrow">FOCUSED PRACTICE</span>
    <h1>Build a topic <em>session.</em></h1>
    <p>Choose a reviewed topic and a time limit. New questions come first when available; review questions fill the rest. Your questions stay the same when you reconnect.</p>
    {notice && <p className="notice" role="status">{notice}</p>}
    {exams.length ? <form className="practice-builder" aria-busy={busy} onSubmit={submit}>
      <label>Exam<select value={exam} required disabled={busy} onChange={event => changeExam(event.target.value)}>
        {!exam && <option value="">Choose an exam</option>}
        {exams.map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}
      </select></label>
      <label>Questions<select value={count} disabled={busy} onChange={event => setCount(Number(event.target.value))}>
        {[10, 20, 30].map(value => <option key={value}>{value}</option>)}
      </select></label>
      <label>Time<select value={duration} disabled={busy} onChange={event => setDuration(Number(event.target.value))}>
        {[[900, "15 minutes"], [1800, "30 minutes"], [2700, "45 minutes"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Topic<select value={ready ? topic : ""} required disabled={busy} onChange={event => { setTopic(event.target.value); setNotice(""); setMessage(""); }}>
        {!ready && <option value="">{topics.length ? "Choose a topic" : "No ready topics for this selection"}</option>}
        {topics.map(item => <option key={item.topic} value={item.topic}>{item.topic.replaceAll("-", " ")} · {item.questions} ready</option>)}
      </select></label>
      <button className="button" disabled={busy || !ready}>{busy ? "Creating…" : "Start practice"}</button>
    </form> : <div className="notice">No topic pools have completed bank import, rights review and owner approval yet.</div>}
    {message && <p className="error" role="alert">{message}</p>}
  </section>;
}

function TopicPracticeSession({ initialExam, initialTopic }) {
  const navigate = useNavigate(), scope = useRef(null);
  const [catalog, setCatalog] = useState(null), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    scope.current = controller;
    rpc("topic_catalog", undefined, controller.signal).then(setCatalog).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, []);
  const start = async ({ exam, topic, count, duration }) => {
    const signal = scope.current.signal;
    const id = await rpc("start_topic_practice", { p_exam: exam, p_topic: topic, p_count: count, p_duration_seconds: duration }, signal);
    if (!signal.aborted) navigate(`/attempt/${id}`);
  };
  return <PortalShell>{error ? <section className="section portal-module"><p className="error">{error}</p></section> : catalog &&
    <TopicPracticeView catalog={catalog} initialExam={initialExam} initialTopic={initialTopic} onStart={start} />}</PortalShell>;
}

export function TopicPractice() {
  const { session, loading } = useAuthState(), [params] = useSearchParams();
  if (loading) return <section className="wrap section"><p role="status">Checking your account…</p></section>;
  if (!session) return <section className="wrap section"><h1>Sign in to practise<em>.</em></h1><Link className="button" to="/account">Student sign in</Link></section>;
  const initialExam = params.get("exam") || "", initialTopic = params.get("topic") || "";
  return <TopicPracticeSession key={JSON.stringify([session.user.id, initialExam, initialTopic])}
    initialExam={initialExam} initialTopic={initialTopic} />;
}

export function TopicPracticePreview() {
  const [message, setMessage] = useState(""), [params] = useSearchParams();
  const catalog = [{ exam: "uceed", topic: "observation", questions: 32 }, { exam: "uceed", topic: "spatial-reasoning", questions: 18 },
    { exam: "nift", topic: "general-aptitude", questions: 71 }];
  const initialExam = params.get("exam") || "", initialTopic = params.get("topic") || "";
  return <PortalShell><TopicPracticeView key={JSON.stringify([initialExam, initialTopic])} catalog={catalog}
    initialExam={initialExam} initialTopic={initialTopic}
    onStart={async value => setMessage(`${value.count} ${value.topic} questions · ${value.duration / 60} minutes`)} />
    {message && <p className="wrap" role="status">Preview created: {message}</p>}</PortalShell>;
}
