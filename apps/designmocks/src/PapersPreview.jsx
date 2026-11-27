// Sign-in-free review route for the Papers catalogue. Development and hosted
// review builds only. Paper years, question counts and timings mirror the
// public catalogue on 26 November 2026 (NID timings are illustrative); the student,
// attempts and scores are fictional.
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PapersView } from "./Papers.jsx";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rows = [
  ["uceed", 2026, 57, 120, "Part A"], ["uceed", 2025, 57, 120, "Part A"], ["uceed", 2024, 57, 120, "Part A"],
  ["uceed", 2023, 68, 150, "Part A"], ["uceed", 2022, 64, 150, "Part A"], ["uceed", 2021, 64, 150, "Part A"],
  ["uceed", 2020, 66, 150, "Part A"], ["uceed", 2019, 79, 180, "Full paper"], ["uceed", 2018, 83, 180, "Full paper"],
  ["uceed", 2017, 82, 180, "Full paper"], ["uceed", 2015, 99, 180, "Full paper"],
  ["ceed", 2026, 41, 60, "Part A"], ["ceed", 2025, 42, 60, "Part A"], ["ceed", 2024, 41, 60, "Part A"],
  ["ceed", 2023, 39, 60, "Part A"], ["ceed", 2022, 38, 60, "Part A"], ["ceed", 2021, 36, 60, "Part A"],
  ["nid", 2020, 21, 180, "Full paper", "nid-bdes-2020"], ["nid", 2019, 22, 180, "Full paper", "nid-bdes-2019"],
  ["nid", 2018, 64, 180, "Full paper", "nid-bdes-2018"], ["nid", 2018, 59, 180, "Full paper", "nid-mdes-2018"],
  ["nid", 2025, 12, 40, "Sample paper", "nid-bdes-sample-2025"], ["nid", 2025, 18, 30, "Sample paper", "nid-mdes-sample-2025"],
];
export const previewReleases = rows.map(([exam, year, questionCount, minutes, partLabel, sourcePaperId = `${exam}-${year}`], index) => ({
  exam, year, sourcePaperId, paperId: id(index + 1), questionCount,
  durationSeconds: minutes * 60, partLabel,
}));
export const previewProgress = new Map([
  [id(2), { active: { id: id(102), startedAt: "2026-11-26T09:00:00Z", resultsPending: false, score: null, total: null }, submitted: null }],
  [id(3), { active: null, submitted: { id: id(103), startedAt: "2026-11-24T09:00:00Z", resultsPending: false, score: 142, total: 300 } }],
  [id(4), { active: null, submitted: { id: id(104), startedAt: "2026-11-25T09:00:00Z", resultsPending: true, score: null, total: null } }],
  [id(13), { active: null, submitted: { id: id(113), startedAt: "2026-11-22T09:00:00Z", resultsPending: false, score: 61, total: 100 } }],
]);
export const previewAttemptHref = attemptId => attemptId === id(103) || attemptId === id(113) ? "/portal-preview/report"
  : attemptId === id(104) ? "/portal-preview/pending" : "/portal-preview/paper";

export default function PapersPreview() {
  const navigate = useNavigate();
  const exam = new URLSearchParams(useLocation().search).get("exam");
  return <>
    <section className="wrap portal-preview-note" aria-label="Preview information">
      <span className="eyebrow">PAPERS PREVIEW</span>
      <p>Papers, years, question counts and timings match the public catalogue. The signed-in student, saved progress and scores are fictional. Starting a paper here opens the original six-question demo room, not a real year paper.</p>
    </section>
    <PapersView releases={previewReleases} signedIn initialExam={["uceed", "ceed", "nift", "nid"].includes(exam) ? exam : "uceed"} attemptsByPaper={previewProgress}
      attemptHref={previewAttemptHref} attemptsHref="/portal-preview"
      onStart={async () => navigate("/portal-preview/paper")} />
  </>;
}
