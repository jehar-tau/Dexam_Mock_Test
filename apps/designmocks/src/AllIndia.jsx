import React,{useEffect,useState} from "react";
import {Link,useNavigate} from "react-router-dom";
import {platform} from "./platform.js";
import {useAuthState} from "./useAuth.js";
import {PortalShell} from "./PortalShell.jsx";

async function rpc(name,args){const {data,error}=await platform.rpc(name,args);if(error)throw error;return data;}
const when=(value)=>new Date(value).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});

function eventDetails(event) {
  if (event.state === "paused") return "New starts are paused for question review. Existing attempts keep their original paper and clock.";
  if (event.state === "scheduled") return `Opens ${when(event.startsAt)}`;
  if (event.state === "open") return `Start before ${when(event.lastStartAt ?? event.endsAt)}`;
  if (event.state === "closing") return `Starts closed. The attempt window ends ${when(event.endsAt)}.`;
  if (event.state === "review") return `Results under review until ${when(event.reviewEndsAt)}`;
  if (!event.result) return "Results released.";
  const { rank, cohortSize, score, total } = event.result;
  return `Rank ${rank}${cohortSize ? ` of ${cohortSize}` : ""} · ${score}/${total} marks`;
}

export function AllIndiaView({ events, onStart }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const start = async (id) => {
    setBusy(id);
    setMessage("");
    try { await onStart(id); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(""); }
  };
  return <section className="section portal-module all-india">
    <span className="eyebrow">ALL INDIA MOCKS</span>
    <h1>One paper. One <em>attempt.</em></h1>
    <p>Every candidate receives the same frozen paper. The exam timer continues through disconnects, and ranks stay hidden until results are released.</p>
    <div className="all-india-list">
      {events.length ? events.map((event) => <article key={event.id}>
        <div>
          <span className="eyebrow">{event.exam.toUpperCase()} · {event.state}</span>
          <h2>{event.title}</h2>
          <p>{eventDetails(event)}</p>
          {event.state !== "released" && event.uploadGraceSeconds > 0 && (
            <p>{event.durationSeconds / 60} minutes for the exam, plus {event.uploadGraceSeconds / 60} minutes for drawing uploads.</p>
          )}
        </div>
        {event.attemptId ? <Link className="button quiet" to={`/attempt/${event.attemptId}`}>
          {event.state === "released" ? "View attempt" : "Open attempt"}
        </Link> : <button type="button" className="button" disabled={event.state !== "open" || Boolean(busy)}
          onClick={() => start(event.id)}>
          {busy === event.id ? "Opening…" : event.state === "open" ? "Start once" : "Unavailable"}
        </button>}
      </article>) : <div className="notice">No All India mock has been scheduled yet.</div>}
    </div>
    {message && <p className="error" role="alert">{message}</p>}
  </section>;
}

export function AllIndia(){const {session,loading}=useAuthState();const navigate=useNavigate();const [events,setEvents]=useState(null),[error,setError]=useState("");useEffect(()=>{if(session)rpc("all_india_event_catalog").then(setEvents).catch((e)=>setError(e.message));},[session]);if(loading)return <section className="wrap section"><p role="status">Checking your account…</p></section>;if(!session)return <section className="wrap section"><h1>Sign in for All India mocks<em>.</em></h1><Link className="button" to="/account">Student sign in</Link></section>;const start=async(id)=>navigate(`/attempt/${await rpc("start_all_india_attempt",{p_event_id:id})}`);return <PortalShell>{error?<section className="section portal-module"><p className="error">{error}</p></section>:events&&<AllIndiaView events={events} onStart={start}/>}</PortalShell>;}

export function AllIndiaHighlights({example=null}){const [events,setEvents]=useState(example);useEffect(()=>{if(example||!platform)return;rpc("public_all_india_top_ten").then(setEvents).catch(()=>setEvents([]));},[example]);if(!events?.length)return null;return <section className="wrap section all-india-highlights"><span className="eyebrow">ALL INDIA RESULTS</span><h2>See where practice <em>leads.</em></h2>{events.map((event)=><article key={event.eventId}><h3>{event.exam.toUpperCase()} · {event.title}</h3><ol>{event.topTen.map((result)=><li key={`${result.rank}-${result.alias}`}><b>#{result.rank}</b><span>{result.alias}</span><span>{result.score}/{result.total}</span></li>)}</ol></article>)}</section>;}

export function AllIndiaPreview() {
  const [message, setMessage] = useState("");
  const now = Date.now();
  const events = [
    { id: "scheduled", exam: "nid", title: "NID All India Mock 01", state: "scheduled", startsAt: new Date(now + 86400000) },
    { id: "open", exam: "uceed", title: "UCEED All India Mock 01", state: "open",
      lastStartAt: new Date(now + 9 * 86400000 - 4500000), durationSeconds: 3600, uploadGraceSeconds: 900 },
    { id: "closing", exam: "ceed", title: "CEED All India Mock 01", state: "closing",
      endsAt: new Date(now + 600000), durationSeconds: 3600, uploadGraceSeconds: 600 },
    { id: "released", exam: "nift", title: "Your NIFT cohort", state: "released", attemptId: "preview-result",
      result: { rank: 2, cohortSize: 24, score: 27, total: 30 } },
  ];
  const results = [{ eventId: "released", exam: "nift", title: "NIFT All India Mock 01",
    topTen: [{ rank: 1, alias: "Candidate-A1B2C3", score: 28, total: 30 }, { rank: 2, alias: "Candidate-D4E5F6", score: 27, total: 30 }] }];
  return <><PortalShell>
    <AllIndiaView events={events} onStart={async (id) => setMessage(id)} />
    {message && <p className="wrap" role="status">Preview attempt created once: {message}</p>}
  </PortalShell><AllIndiaHighlights example={results} /></>;
}
