import { releasedYearPaperGroups, releasedYearPaperMap } from './free-year-papers.mjs';

const exams = ['uceed', 'ceed', 'nift', 'nid'];
const time = value => Date.parse(value ?? '') || 0;

// Summarises released free year papers and the student's own attempts for the
// Overview. Only released catalogue rows and owned attempts are used.
export function overviewPaperProgress(releases, attempts = new Map()) {
  const parts = releasedYearPaperMap(releases);
  const groups = releasedYearPaperGroups(releases);
  const rows = groups.flatMap(group => parts.get(group.id).map(part => ({
    sourceId: group.id, exam: group.exam, year: group.year, paperId: group.paperId,
    part, own: attempts.get(part.paperId) ?? null,
  })));
  const inProgress = rows.filter(row => row.own?.active).map(row => ({ ...row, attempt: row.own.active }))
    .sort((a, b) => time(b.attempt.startedAt) - time(a.attempt.startedAt));
  const results = rows.filter(row => row.own?.submitted).map(row => ({ ...row, attempt: row.own.submitted }))
    .sort((a, b) => time(b.attempt.startedAt) - time(a.attempt.startedAt));
  const attempted = new Set(rows.filter(row => row.own).map(row => row.sourceId));
  const recentExam = [...inProgress, ...results].sort((a, b) => time(b.attempt.startedAt) - time(a.attempt.startedAt))[0]?.exam;
  const order = recentExam ? [recentExam, ...exams.filter(exam => exam !== recentExam)] : exams;
  const nextGroup = order.map(exam => groups.find(group => group.exam === exam && !attempted.has(group.id))).find(Boolean);
  const next = nextGroup ? { exam: nextGroup.exam, year: nextGroup.year, paperId: nextGroup.paperId,
    questionCount: nextGroup.questionCount, minutes: Math.round(parts.get(nextGroup.id).reduce((sum, part) => sum + part.durationSeconds, 0) / 60) } : null;
  return { total: groups.length, attempted: attempted.size, inProgress, results, next };
}
