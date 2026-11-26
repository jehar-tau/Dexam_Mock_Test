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

export function TopicPracticeView({ catalog, onStart, initialExam = "", initialTopic = "", heading = true, embedded = false, blocked = false, preview = false, Example, workspaceHref }) {
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
  const examOrder = ["uceed", "ceed", "nift", "nid"];
  const groups = [exam, ...examOrder.filter(value => value !== exam)].filter(value => examOrder.includes(value)).map(value => ({ exam: value, items: matches.filter(item => item.exam === value).sort((a, b) => b.questions - a.questions) }))
    .filter(group => group.items.length);
  const largest = Object.fromEntries(examOrder.map(value => [value, Math.max(1, ...availableTopics.filter(item => item.exam === value).map(item => item.questions))]));
  return <section className={embedded ? "catalogue-content topic-content" : "section portal-module topic-practice"}>
    {heading && <TopicPracticeHeading preview={preview} />}
    {notice && <p className="notice" role="status">{notice}</p>}
    {exams.length ? <div className="topic-layout">
      {availableTopics.length > 1 && <section className="topic-browser" aria-label="Practice catalogue">
        <div className="topic-browser-bar">
          <div><h2 id="topic-browse-heading">Choose a topic</h2>
            <p>{preview ? "Example topics across the four exams." : "Every question comes from a reviewed, released year-wise paper."}</p></div>
          <label className="topic-search"><span>Search catalogue</span>
            <input type="search" value={search} placeholder="Topic or exam" onChange={event => setSearch(event.target.value)} /></label>
        </div>
        {groups.map(group => <div className="topic-group" key={group.exam}>
          <h3>{group.exam.toUpperCase()} <span>{group.items.length} topic{group.items.length === 1 ? "" : "s"}{preview ? "" : ` · ${group.items.reduce((sum, item) => sum + item.questions, 0)} questions`}</span></h3>
          <ul>{group.items.map(item => {
            const selected = item.exam === exam && item.topic === topic;
            const tooSmall = item.questions < count;
            const action = tooSmall ? "Shorter set only" : selected ? "Selected" : "Choose";
            return <li key={JSON.stringify([item.exam, item.topic])} className="topic-card" data-selected={selected || undefined} data-small={tooSmall || undefined}>
              <span className="topic-exam-label">{item.exam.toUpperCase()}</span>
              <span className="topic-list-title">{topicName(item.topic)}</span>
              {!preview && <span className="topic-reviewed">{item.questions} questions</span>}
              {!preview && <span className="topic-size" aria-hidden="true"><i style={{ width: `${Math.max(4, Math.round(item.questions * 100 / largest[item.exam]))}%` }} /></span>}
              <button className="topic-choose" type="button" aria-pressed={selected} disabled={busy || blocked || tooSmall}
                aria-label={`${action} · ${item.exam.toUpperCase()} ${topicName(item.topic)}`}
                onClick={() => chooseTopic(item)}>{action}</button>
            </li>;
          })}</ul>
        </div>)}
        {!matches.length && <p role="status">No topics match “{search}”. Try another topic or exam.</p>}
      </section>}
      <div className="topic-side">
      <form className="topic-builder" aria-busy={busy} onSubmit={submit} onChange={() => setPreviewReceipt("")}>
        <span className="topic-kicker">Your session</span>
        <h2>{selectedPool ? `${exam.toUpperCase()} · ${topicName(topic)}` : "Session settings"}</h2>
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
        <dl className="topic-summary">
          <div><dt>Questions</dt><dd>{count}</dd></div>
          <div><dt>Time</dt><dd>{duration / 60} min</dd></div>
          <div><dt>Pace</dt><dd>{Math.round(duration / count)} s each</dd></div>
        </dl>
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
        {message && <p className="error" role="alert">{message}{message === "Complete your verified profile first" && <> <Link to="/onboarding">Complete your profile →</Link></>}</p>}
      </form>
      {Example && <Example key={topic} topic={selectedPool ? topic : ""} />}
      </div>
    </div> : <div className="notice" role="status">No practice topics are released yet. Topics will appear after a complete year-wise paper has been reviewed and released. <Link to="/papers">Explore Papers →</Link></div>}
    <section className="topic-notes" aria-label="Session guide">
      <div><h2>Question selection</h2><p>Questions come from released year-wise papers. Unseen questions come first when available; previously attempted questions fill the rest.</p></div>
      <div><h2>Returning to practice</h2><p>Your questions stay the same if you disconnect and reopen your session.</p></div>
    </section>
    <Link className="topic-workspace-link" to={workspaceHref ?? (preview ? location.pathname.replace(/topic-practice/, "portal") : "/dashboard")}>View your workspace and attempts →</Link>
  </section>;
}

export function TopicPractice() {
  const [params] = useSearchParams();
  const initialExam = params.get("exam") || "", initialTopic = params.get("topic") || "";
  return <AssessmentCatalogue kind="topic" Heading={TopicPracticeHeading} View={TopicPracticeView} viewProps={{ initialExam, initialTopic }} />;
}

// Question counts per topic in the 17 released UCEED/CEED papers (curated bank, 26 Nov 2026).
const releasedPools = [["uceed","spatial-reasoning",224],["uceed","visual-reasoning",146],["uceed","analytical-reasoning",96],["uceed","numerical-reasoning",83],["uceed","general-aptitude",70],["uceed","materials",47],["uceed","pattern-recognition",23],["uceed","design-awareness",16],["uceed","general-knowledge",14],["uceed","indian-culture",14],["uceed","language",14],["uceed","observation",13],["uceed","colour-theory",10],["uceed","design-history",4],["uceed","typography",2],
  ["ceed","spatial-reasoning",91],["ceed","visual-reasoning",40],["ceed","materials",33],["ceed","general-aptitude",19],["ceed","numerical-reasoning",18],["ceed","analytical-reasoning",10],["ceed","design-awareness",8],["ceed","language",5],["ceed","design-history",4],["ceed","observation",3],["ceed","pattern-recognition",3],["ceed","typography",1],["ceed","indian-culture",1],["ceed","colour-theory",1]]
  .map(([exam, topic, questions]) => ({ exam, topic, questions }));

export function TopicPracticePreview() {
  const location = useLocation(), released = location.pathname.endsWith("/released");
  const [params] = useSearchParams();
  const initialExam = params.get("exam") || "", initialTopic = params.get("topic") || "";
  if (released) return <PortalShell><section className="wrap portal-preview-note" aria-label="Preview information"><span className="eyebrow">PRACTICE PREVIEW</span>
    <p>Topics and question counts come from the 17 released UCEED and CEED papers. Starting is disabled here; a signed-in student with access gets a fresh timed session.</p></section>
    <TopicPracticeView key={JSON.stringify([initialExam, initialTopic])} catalog={releasedPools} workspaceHref={location.pathname.replace(/topic-practice(-\w+)\/released$/, "portal$1")} onStart={async () => { throw new Error("Preview only. Sign in to start a timed session."); }}
      initialExam={initialExam || "uceed"} initialTopic={initialTopic || "spatial-reasoning"} /></PortalShell>;
  return <PortalShell><TopicPracticeView key={JSON.stringify([initialExam, initialTopic])} preview Example={TopicPracticeExample} catalog={examplePools}
    initialExam={initialExam} initialTopic={initialTopic} /></PortalShell>;
}
