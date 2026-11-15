import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthState } from "./useAuth.js";
import { DrawingReviewQueue } from "./DrawingReviewQueue.jsx";
import { DrawingReviewerRoster } from "./DrawingReviewerRoster.jsx";
import { drawingReviewActions } from "./drawing-review.js";
import { LearningLessonEditor } from "./LearningLessonEditor.jsx";
import { CommunityModerationQueue } from "./CommunityModeration.jsx";
import { CommunityContentModeration } from "./CommunityContentModeration.jsx";
import { AiQuestionDrafting } from "./AiQuestionDrafting.jsx";
import { OperationalHealth } from "./OperationalHealth.jsx";
import { QuestionDraftExport } from "./QuestionDraftExport.jsx";
import { verifyQuestionExportPacket } from "./question-export-packet.mjs";
import { withAccountDeadline } from "./account-request.js";
import { LaunchReadiness } from "./LaunchReadiness.jsx";
import { IntakeDraftFigures, IntakeExtractionQueue } from "./IntakeExtractionQueue.jsx";
import { BankReviewBrowser } from "./BankReviewBrowser.jsx";
import { NidPracticeBlueprints } from "./NidPracticeBlueprints.jsx";
import { ReportedQuestionQueue } from "./ReportedQuestionQueue.jsx";
import { AdminSupportReports } from "./AdminSupportReports.jsx";
import { AdminPrivacyRequests } from "./AdminPrivacyRequests.jsx";
import { readSupportPage, supportPageLimit } from "./admin-support.js";
import { readPrivacyQueue, privacyQueueLimit } from "./admin-privacy.js";
import { AdminAccessBoundary, useAdminServices } from "./AdminAccess.jsx";
import { adminRequestMessage } from "./admin-access.js";
import {postLaunchPreview}from'./launch-scope.js';
const mvpDeskReads=new Set(['admin_bug_report_page','admin_reported_questions','admin_operational_health','admin_privacy_request_page','admin_launch_readiness']);

async function intakeRequest(functions, name, body) {
  const { data, error } = await functions.invoke(name, { body });
  if (error) {
    const detail = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    throw new Error(detail?.error ?? error.message ?? "Private intake request failed.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function downloadPrivateBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

export function IntakeExtractionPreview() {
  const [assets, setAssets] = useState([{ id: "asset", name: "fictional-paper.pdf", status: "extracted", candidates: [{ id: "candidate", ordinal: 1, pageNumber: 2, confidence: 0.84, status: "pending", payload: { type: "MCQ", prompt: "Fictional extracted observation question", options: ["A", "B", "C", "D"].map(id => ({ id, text: `Fictional option ${id}` })), answer: "B", holds: ["intake-human-review"] } }] }]);
  const update = (id, status) => setAssets(current => current.map(asset => ({ ...asset, candidates: asset.candidates?.map(candidate => candidate.id === id ? { ...candidate, status } : candidate) })));
  return <section className="wrap section admin-page"><span className="eyebrow">PRIVATE INTAKE PREVIEW</span><h1>Extract, correct, then <em>review.</em></h1><IntakeExtractionQueue assets={assets} onExtract={() => {}} onPromote={(id) => update(id, "promoted")} onReject={(id) => update(id, "rejected")} /></section>;
}

export function Admin() {
  const { session, loading } = useAuthState();
  const location = useLocation(), heading = useRef(null);
  return <section className="wrap section admin-page">
    <span className="eyebrow">DMOCKS OPERATIONS</span>
    <h1 ref={heading} tabIndex={-1}>Admin <em>review.</em></h1>
    {session && !loading ? <AdminAccessBoundary key={`${session.user.id}:${location.key}`} actorId={session.user.id} headingRef={heading}><AdminDesk session={session} /></AdminAccessBoundary> : <Gate session={session} loading={loading} />}
  </section>;
}

function AdminDesk({ session }) {
  const { rpc, functions, assertCurrent, isCurrent, presentForCurrentStaff } = useAdminServices();
  const batch = useRef(null), sequence = useRef(0);
  const positions = useRef({
    support: { cursor: null, previous: [] }, privacy: { cursor: null, previous: [] },
  });
  const reportError = error => { if (isCurrent()) setMessage(adminRequestMessage(error)); };
  const [drafts, setDrafts] = useState([]),
    [bugPage, setBugPage] = useState(null),
    [blueprints, setBlueprints] = useState([]),
    [allIndia, setAllIndia] = useState([]),
    [lessons, setLessons] = useState(null),
    [drawings, setDrawings] = useState([]),
    [communityReports, setCommunityReports] = useState([]),
    [aiDrafts, setAiDrafts] = useState([]),
    [intake, setIntake] = useState([]),
    [intakeUploading, setIntakeUploading] = useState(false),
    [questionReports, setQuestionReports] = useState([]),
    [bankRefreshToken, setBankRefreshToken] = useState(0),
    [privacyPage, setPrivacyPage] = useState(null),
    [health, setHealth] = useState(),
    [readiness, setReadiness] = useState(),
    [message, setMessage] = useState("");
  const loadDesk = useCallback(async (target) => {
    batch.current?.abort();
    const request = new AbortController(), token = ++sequence.current; batch.current = request;
    const current = () => isCurrent() && !request.signal.aborted && token === sequence.current;
    try {
      assertCurrent();
      const pageArgs = {
        admin_bug_report_page: { p_cursor: target.support.cursor, p_limit: supportPageLimit },
        admin_privacy_request_page: { p_cursor: target.privacy.cursor, p_limit: privacyQueueLimit },
      };
      const [d, b, m, a, r, l, w, i, c, ai, h, privacy, launch] = await Promise.all(
          ["admin_question_drafts", "admin_bug_report_page", "admin_exam_mock_blueprints", "admin_all_india_events",
            "admin_reported_questions", "admin_learning_lessons", "admin_drawing_queue", "admin_question_intake_assets",
            "admin_community_report_queue", "admin_ai_draft_requests", "admin_operational_health", "admin_privacy_request_page",
            "admin_launch_readiness"].map(name => {
              if (!postLaunchPreview && !mvpDeskReads.has(name)) return [];
              return rpc(name, pageArgs[name], request.signal);
            }),
      );
      return await withAccountDeadline(active => presentForCurrentStaff(() => {
        if (!current()) return false;
        const supportPage = readSupportPage(b, session.user.id);
        const reviewPage = readPrivacyQueue(privacy, session.user.id);
        positions.current = target;
        setDrafts(d);
        setBugPage({ ...supportPage, position: target.support });
        setBlueprints(m);
        setAllIndia(a);
        setQuestionReports(r);
        setLessons(l);
        setDrawings(w);
        setIntake(i);
        setCommunityReports(c);
        setAiDrafts(ai);
        setHealth(h);
        setPrivacyPage({ ...reviewPage, position: target.privacy });
        setReadiness(launch);
        return true;
      }, active), request.signal);
    } catch (e) {
      if (current()) { request.abort(); setMessage(adminRequestMessage(e)); }
      return false;
    }
  }, [rpc, assertCurrent, isCurrent, presentForCurrentStaff, session.user.id]);
  const load = useCallback(() => loadDesk(positions.current), [loadDesk]);
  const loadSupportPage = useCallback(support => loadDesk({ ...positions.current, support }), [loadDesk]);
  const loadPrivacyPage = useCallback(privacy => loadDesk({ ...positions.current, privacy }), [loadDesk]);
  useEffect(() => {
    void load();
    return () => { sequence.current++; batch.current?.abort(); };
  }, [load]);
  const addDraft = async (event) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    try {
      const payload = JSON.parse(form.get("payload"));
      await rpc("admin_create_question_draft", {
        p_source_type: form.get("sourceType"),
        p_source_name: form.get("sourceName"),
        p_payload: payload,
      });
      element.reset();
      await load();
    } catch (e) {
      reportError(e);
    }
  };
  const generateAiDraft = async (input) => {
    try {
      const { data, error } = await functions.invoke("ai-question-draft", { body: input });
      if (error) {
        const detail = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
        throw new Error(typeof detail?.error === "string" ? detail.error : "Couldn’t generate a review draft.");
      }
      if (data?.error) throw new Error(data.error);
    } finally { await load(); }
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
      reportError(e);
    }
  };
  const exportDraft = async ({ id, externalKey, rightsConfirmed, rightsNote }) => {
    try {
      await rpc("admin_export_question_draft", { p_draft_id:id, p_external_key:externalKey, p_rights_confirmed:rightsConfirmed, p_rights_note:rightsNote });
      await load();
    } catch (e) { reportError(e); throw e; }
  };
  const downloadQuestionPacket = (artifact, signal) => withAccountDeadline(async active => {
    const response = await rpc("admin_read_question_export", { p_export_id: artifact.id }, active);
    const { packet } = await verifyQuestionExportPacket(response, {
      artifactId: artifact.id, externalKey: artifact.externalKey, contentSha256: artifact.contentSha256,
    });
    await presentForCurrentStaff(() => {
      const json = new Blob([JSON.stringify(packet, null, 2) + "\n"], { type: "application/json" });
      downloadPrivateBlob(json, `dmocks-question-${packet.artifactId}.json`);
    }, active);
  }, signal);
  const downloadBankCorrection = (question, answer, note, signal) => withAccountDeadline(async active => {
    const response = await rpc("admin_prepare_bank_answer_correction", {
      p_external_key: question.externalKey, p_expected_version: question.reviewVersion,
      p_answer: answer, p_review_note: note,
    }, active);
    if (response?.replacesContentSha256 !== question.contentSha256 || response.sourceCommit !== question.sourceCommit) {
      throw new Error("Question changed. Refresh the bank and review it again.");
    }
    const { packet, payload } = await verifyQuestionExportPacket(response.packet, { externalKey: question.externalKey });
    if (payload.answer?.raw !== answer || payload.answer.status !== "human-reviewed" || packet.rightsNote !== note) {
      throw new Error("The correction packet did not match your review.");
    }
    await presentForCurrentStaff(() => {
      const json = new Blob([JSON.stringify({ ...packet, replacesContentSha256: response.replacesContentSha256,
        sourceCommit: response.sourceCommit }, null, 2) + "\n"], { type: "application/json" });
      downloadPrivateBlob(json, `dmocks-correction-${packet.externalKey}.json`);
    }, active);
  }, signal);
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
      reportError(e);
    }
  };
  const createAllIndia = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await rpc("admin_create_all_india_event", {
        p_exam: form.get("exam"),
        p_title: form.get("title"),
        p_starts_at: new Date(form.get("startsAt")).toISOString(),
        p_question_count: Number(form.get("count")),
        p_duration_seconds: Number(form.get("duration")),
        p_drawing_count: Number(form.get("drawingCount")),
        p_upload_grace_seconds: Number(form.get("drawingGrace")),
      });
      formElement.reset();
      await load();
    } catch (e) {
      reportError(e);
    }
  };
  const releaseAllIndia = async (id) => {
    try {
      await rpc("admin_release_all_india_results", { p_event_id: id });
      await load();
    } catch (e) {
      reportError(e);
    }
  };
  const refresh = async () => { if (!await load()) throw new Error("The administrator workspace could not be refreshed. Try again."); };
  const refreshQuestionReviews = async () => { await refresh(); assertCurrent(); setBankRefreshToken(value => value + 1); };
  const refreshLessons = refresh, refreshDrawings = refresh;
  const drawingActions = drawingReviewActions(rpc, refresh);
  const uploadIntake = async (event) => {
    event.preventDefault();
    const element = event.currentTarget;
    const f = new FormData(element),
      body = new FormData();
    body.set("file", f.get("file"));
    setIntakeUploading(true);
    try {
      const data = await intakeRequest(functions, "question-intake", body);
      assertCurrent();
      setMessage(data.reused ? `${data.name} is already in private intake.` : `${data.name} uploaded privately for extraction.`);
      element.reset();
      await load();
    } catch (e) {
      reportError(e);
    } finally { setIntakeUploading(false); }
  };
  const extractIntake = async (id) => {
    try {
      const data = await intakeRequest(functions, "question-intake-extract", { assetId: id });
      assertCurrent();
      setMessage(`${data.questions} question candidate${data.questions === 1 ? "" : "s"} extracted for review.`);
    } finally { await load(); }
  };
  const promoteIntake = async (id, payload) => {
    await rpc("admin_promote_intake_candidate", { p_candidate_id: id, p_payload: payload });
    await load();
  };
  const rejectIntake = async (id) => {
    await rpc("admin_reject_intake_candidate", { p_candidate_id: id });
    await load();
  };
  const transcribeIntake = async (id, payload) => {
    await rpc("admin_promote_intake_asset", { p_asset_id: id, p_payload: payload });
    await load();
  };
  const prepareIntakeFigures = async (id, figures) => {
    for (const { file, asset } of figures) {
      const body = new FormData();
      body.set("file", file);
      body.set("purpose", "figure");
      body.set("assetId", id);
      const saved = await intakeRequest(functions, "question-intake", body);
      assertCurrent();
      if (saved.asset?.sha256 !== asset.sha256 || saved.asset?.width !== asset.width || saved.asset?.height !== asset.height) {
        throw new Error("Retained figure did not match the selected PNG. Try again.");
      }
    }
  };
  const downloadIntake = async (asset, figure) => {
    const blob = await intakeRequest(functions, "question-intake", { assetId: asset.id, ...(figure ? { figureSha: figure.sha256 } : {}) });
    assertCurrent();
    if (!(blob instanceof Blob)) throw new Error("Private source could not be downloaded.");
    downloadPrivateBlob(blob, figure ? `${figure.sha256}.png` : asset.name);
  };
  return (
    <>
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
          <h2>Operational health</h2>
          <OperationalHealth health={health} onRefresh={load} />
          <h2>Launch readiness</h2>
          <LaunchReadiness readiness={readiness} onSetGate={async(gate,approved,evidence)=>{try{await rpc("admin_set_launch_gate",{p_gate:gate,p_approved:approved,p_evidence:evidence});await load()}catch(e){reportError(e)}}}/>
          {postLaunchPreview&&<><h2>PDF and photo question intake</h2>
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
            <button disabled={intakeUploading}>{intakeUploading ? "Uploading…" : "Upload for extraction"}</button>
          </form>
          <IntakeExtractionQueue assets={intake} onExtract={extractIntake} onPromote={promoteIntake} onReject={rejectIntake} onTranscribe={transcribeIntake} onDownload={downloadIntake} onPrepareFigures={prepareIntakeFigures} />
          <h2>Drawing review queue</h2>
          <DrawingReviewQueue drawings={drawings} onRefresh={refreshDrawings} {...drawingActions} />
          <DrawingReviewerRoster rpc={rpc} refreshDrawings={refreshDrawings} />
          <h2>Community moderation</h2>
          <CommunityModerationQueue reports={communityReports} rpc={rpc} onRefresh={load} scopeKey={session.user.id} />
          <CommunityContentModeration rpc={rpc} scopeKey={session.user.id} />
          <LearningLessonEditor lessons={lessons} rpc={rpc} refresh={refreshLessons} />
          </>}
          <ReportedQuestionQueue reports={questionReports} rpc={rpc} onChanged={refreshQuestionReviews} />
          {postLaunchPreview&&<>
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
          <AiQuestionDrafting requests={aiDrafts} onGenerate={generateAiDraft} />
          <h2>All India mock events</h2>
          <p>
            Each event freezes one paper for every candidate, stays open for ten
            days and keeps results in review for ten more days.
          </p>
          <button type="button" onClick={load}>Refresh event status</button>
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
              Objective questions
              <input
                name="count"
                type="number"
                min="0"
                max="100"
                defaultValue="30"
                required
              />
            </label>
            <label>Drawing tasks
              <input name="drawingCount" type="number" min="0" max="5" defaultValue="0" required />
            </label>
            <label>Drawing upload grace
              <select name="drawingGrace" defaultValue="900">
                <option value="600">10 minutes after the exam</option>
                <option value="900">15 minutes after the exam</option>
              </select>
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
                  <>
                    <p>{event.pendingDrawingReviews} drawing reviews remaining. Review closes {new Date(event.reviewEndsAt).toLocaleString("en-IN")}.</p>
                    <button type="button" disabled={!event.canRelease} onClick={() => releaseAllIndia(event.id)}>
                      Release reviewed results
                    </button>
                  </>
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
                {m.sectionLabel && <p><b>{m.structureVersion} · {m.sectionLabel}</b><br />{Object.entries(m.sectionCounts).map(([kind,count]) => `${kind.toUpperCase()} ${count}`).join(" · ")} · fixed server manifest</p>}
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
                    readOnly={Boolean(m.structureVersion)}
                    aria-label={`${m.exam} question count`}
                  />
                  <input
                    name="duration"
                    type="number"
                    min="900"
                    max="21600"
                    defaultValue={m.durationSeconds}
                    readOnly={Boolean(m.structureVersion)}
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
          </>}
          <BankReviewBrowser rpc={rpc} onDownloadCorrection={postLaunchPreview ? downloadBankCorrection : undefined} onReviewed={load} refreshToken={bankRefreshToken} />
          <NidPracticeBlueprints />
          {postLaunchPreview&&<>
          <h2>Question review queue</h2>
          <div className="admin-list">
            {drafts.map((d) => (
              <article key={d.id}>
                <b>{d.sourceName || d.sourceType}</b>
                <span className="status-pill">{d.status}</span>
                <pre>{JSON.stringify(d.payload, null, 2)}</pre>
                <IntakeDraftFigures draft={d} onDownload={downloadIntake} />
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
                <QuestionDraftExport draft={d} onExport={exportDraft} onDownload={downloadQuestionPacket} />
              </article>
            ))}
          </div>
          </>}
          <AdminSupportReports page={bugPage} navigate={loadSupportPage} refresh={load} />
          <AdminPrivacyRequests page={privacyPage} navigate={loadPrivacyPage} refresh={load} />
    </>
  );
}
