import React, { useMemo, useState, useEffect, useRef } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { PortalShell } from "./PortalShell.jsx";
import { practicePools, practiceSelection } from "./practice-context.js";
import { AssessmentCatalogue } from "./AssessmentCatalogue.jsx";
import { examplePools, TopicPracticeExample } from "./TopicPracticeExamples.jsx";
import "./practice-events.css";

const topicName = value => value.replaceAll("-", " ").replace(/^./, letter => letter.toUpperCase());

function TopicPracticeHeading({ headingRef, preview }) {
  return <header className="topic-heading">
    <span className="topic-kicker">Topic practice</span>
    <h1 ref={headingRef} tabIndex={-1}>Build a topic session.</h1>
    <p>{preview ? "Try a worked example and plan a timed session. The topics and session sizes here are fictional examples."
      : "Choose an exam, a topic and a time limit for your next practice session."}</p>
  </header>;
}

export function TopicPracticeView({ catalog, onStart, initialExam = "", initialTopic = "", heading = true, embedded = false, blocked = false, preview = false, Example }) {
  const location = useLocation();
  const topicControl = useRef(null);
  const [initial] = useState(() => practiceSelection(catalog, { exam: initialExam, topic: initialTopic }));
  const [exam, setExam] = useState(initial.exam), [topic, setTopic] = useState(initial.topic);
  const [count, setCount] = useState(10), [duration, setDuration] = useState(900);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [notice, setNotice] = useState(initial.notice);
  const [search, setSearch] = useState("");
  const [previewReceipt, setPreviewReceipt] = useState("");
  const exams = useMemo(() => [...new Set(practicePools(catalog).map(item => item.exam))], [catalog]);
  const pools = useMemo(() => practicePools(catalog, count), [catalog, count]);
  const topics = useMemo(() => pools.filter(item => item.exam === exam), [pools, exam]);
  const availableTopics = useMemo(() => practicePools(catalog), [catalog]);
  const selectedPool = availableTopics.find(item => item.exam === exam && item.topic === topic);
  const ready = Boolean(selectedPool && selectedPool.questions >= count);
  const shorterCount = selectedPool && [30, 20, 10].find(value => value <= selectedPool.questions);
  const topicOptions = selectedPool && !ready ? [selectedPool, ...topics] : topics;
  useEffect(() => { if (topic && !selectedPool) setTopic(""); }, [selectedPool, topic]);
  const words = search.trim().toLowerCase().split(/\s+/);
  const matches = availableTopics.filter(item => {
    const label = `${item.exam} ${topicName(item.topic)}`.toLowerCase();
    return words.every(word => label.includes(word));
  });

  const chooseTopic = item => {
    setExam(item.exam);
    setTopic(item.topic);
    topicControl.current?.focus();
    setNotice("");
    setMessage("");
    setPreviewReceipt("");
  };
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
    if (busy || blocked || !ready) return;
    if (preview) {
      setPreviewReceipt(`Preview created: ${count} ${topic} questions · ${duration / 60} minutes`);
      return;
    }
    setBusy(true);
    setMessage("");
    try { await onStart({ exam, topic, count, duration }); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return <section className={embedded ? "catalogue-content topic-content" : "section portal-module topic-practice"}>
    {heading && <TopicPracticeHeading preview={preview} />}
    {notice && <p className="notice" role="status">{notice}</p>}
    {exams.length ? <div className="topic-layout">
      <form className="topic-builder" aria-busy={busy} onSubmit={submit} onChange={() => setPreviewReceipt("")}>
        <h2>Session settings</h2>
        <div className="topic-fields">
          <label>Exam<select value={exam} required disabled={busy || blocked} onChange={event => changeExam(event.target.value)}>
            {!exam && <option value="">Choose an exam</option>}
            {exams.map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}
          </select></label>
          <label>Topic<select ref={topicControl} value={selectedPool ? topic : ""} required disabled={busy || blocked} onChange={event => { setTopic(event.target.value); setNotice(""); setMessage(""); }}>
            {!selectedPool && <option value="">{topics.length ? "Choose a topic" : "No topics for this size"}</option>}
            {topicOptions.map(item => <option key={item.topic} value={item.topic}>{topicName(item.topic)}{preview ? "" : ` · ${item.questions} ready`}</option>)}
          </select></label>
          <label>Questions<select value={count} disabled={busy || blocked} onChange={event => setCount(Number(event.target.value))}>
            {[10, 20, 30].map(value => <option key={value} value={value}>{value} questions</option>)}
          </select></label>
          <label>Time<select value={duration} disabled={busy || blocked} onChange={event => setDuration(Number(event.target.value))}>
            {[900, 1800, 2700].map(value => <option key={value} value={value}>{value / 60} minutes</option>)}
          </select></label>
        </div>
        {selectedPool && !ready && <div className="notice" role="status">
          <p>{topicName(topic)} supports up to {shorterCount} questions. Choose a shorter session to keep this topic.</p>
          <button className="button quiet" type="button" disabled={busy || blocked}
            onClick={() => { setCount(shorterCount); setMessage(""); }}>Use {shorterCount} questions</button>
        </div>}
        <div className="topic-start">
          <button className="button" disabled={busy || blocked || !ready}>{busy ? "Creating…" : "Start practice"}</button>
          {preview && <span>Preview only · no timer starts</span>}
        </div>
        {previewReceipt && <p className="topic-receipt" role="status">{previewReceipt}</p>}
        {message && <p className="error" role="alert">{message}</p>}
      </form>
      {Example && <Example key={topic} topic={selectedPool ? topic : ""} />}
      {!preview && <aside className="topic-brief"><h2>Your session</h2>
        <dl><div><dt>Focus</dt><dd>{selectedPool ? `${exam.toUpperCase()} · ${topicName(topic)}` : "Choose a topic"}</dd></div>
          <div><dt>Average pace</dt><dd>{Math.round(duration / count)} seconds per question</dd></div></dl>
      </aside>}
    </div> : <div className="notice">There are no practice topics available yet.</div>}
    {availableTopics.length > 1 && <section className="topic-browser" aria-label="Practice catalogue">
      <div className="topic-browser-bar">
        <div><h2 id="topic-browse-heading">Browse topics</h2>
          <p>{preview ? "Example topics across the four exams." : "Choose a topic to use it in your session."}</p></div>
        <label className="topic-search"><span>Search catalogue</span>
          <input type="search" value={search} placeholder="Topic or exam" onChange={event => setSearch(event.target.value)} /></label>
      </div>
      <ul>{matches.map(item => {
        const selected = item.exam === exam && item.topic === topic;
        const tooSmall = item.questions < count;
        const action = tooSmall ? "Shorter set only" : selected ? "Selected" : "Choose";
        return <li key={JSON.stringify([item.exam, item.topic])}>
          <span className="topic-exam-label">{item.exam.toUpperCase()}</span>
          <span className="topic-list-title">{topicName(item.topic)}</span>
          {!preview && <span className="topic-reviewed">{item.questions} ready</span>}
          <button className="topic-choose" type="button" aria-pressed={selected} disabled={busy || blocked || tooSmall}
            aria-label={`${action} · ${item.exam.toUpperCase()} ${topicName(item.topic)}`}
            onClick={() => chooseTopic(item)}>{action}</button>
        </li>;
      })}</ul>
      {!matches.length && <p role="status">No topics match “{search}”. Try another topic or exam.</p>}
    </section>}
    <section className="topic-notes" aria-label="Session guide">
      <div><h2>Question selection</h2><p>New questions come first when available; review questions fill the rest.</p></div>
      <div><h2>Returning to practice</h2><p>Your questions stay the same if you disconnect and reopen your session.</p></div>
    </section>
    <Link className="topic-workspace-link" to={preview ? location.pathname.replace(/topic-practice/, "portal") : "/dashboard"}>View your workspace and attempts →</Link>
  </section>;
}

export function TopicPractice() {
  const [params] = useSearchParams();
  const initialExam = params.get("exam") || "", initialTopic = params.get("topic") || "";
  return <AssessmentCatalogue kind="topic" Heading={TopicPracticeHeading} View={TopicPracticeView} viewProps={{ initialExam, initialTopic }} />;
}

export function TopicPracticePreview() {
  const [params] = useSearchParams();
  const initialExam = params.get("exam") || "", initialTopic = params.get("topic") || "";
  return <PortalShell><TopicPracticeView key={JSON.stringify([initialExam, initialTopic])} preview Example={TopicPracticeExample} catalog={examplePools}
    initialExam={initialExam} initialTopic={initialTopic} /></PortalShell>;
}
