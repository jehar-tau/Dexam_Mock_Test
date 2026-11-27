const exams = Object.freeze(['uceed', 'ceed', 'nift', 'nid']);

export function yearPaperCatalogue(questions) {
  if (!Array.isArray(questions)) throw new TypeError('Question bank must be an array');
  const groups = new Map();
  for (const question of questions) {
    if (!Array.isArray(question?.holds) || question.holds.length !== 0) continue;
    const { exam, year, paperId } = question.provenance ?? {};
    if (!exams.includes(exam) || !Number.isInteger(year) || year < 2000 || year > 2100 ||
        typeof paperId !== 'string' || !/^[a-z0-9-]+$/.test(paperId)) continue;
    const id = `${exam}:${paperId}`;
    const group = groups.get(id) ?? { id, exam, year, paperId, questionCount: 0, objectiveCount: 0, drawingCount: 0, keyedCount: 0 };
    if (group.year !== year) throw new Error(`Conflicting years for ${paperId}`);
    group.questionCount += 1;
    if (question.type === 'DESCRIPTIVE') group.drawingCount += 1;
    else group.objectiveCount += 1;
    if (question.answer !== null && question.answer !== undefined) group.keyedCount += 1;
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => exams.indexOf(a.exam) - exams.indexOf(b.exam) || b.year - a.year || a.paperId.localeCompare(b.paperId));
}

export function paperLabel(paper) {
  const suffix = paper.paperId.replace(new RegExp(`^${paper.exam}-?(?:bdes-|mdes-)?${paper.year}-?`), '');
  if (/sample/.test(paper.paperId)) return `${paper.year} sample paper`;
  if (paper.exam === 'nift' && /-gat$/.test(paper.paperId)) return `${paper.year} GAT paper`;
  if (/mock/.test(paper.paperId)) return `${paper.year} practice mock`;
  const numbered = suffix.match(/paper-?(\d+)/);
  return numbered ? `${paper.year} · Paper ${numbered[1]}` : `${paper.year} paper`;
}

// Visible card title when the year is already shown large beside it.
export function paperLevel(paper) {
  return /-bdes-/.test(paper.paperId) ? 'B.Des. ' : /-mdes-/.test(paper.paperId) ? 'M.Des. ' : '';
}

// The page lists B.Des. and M.Des. papers apart. UCEED is the B.Des. exam and
// CEED the M.Des. exam; NID and NIFT papers carry the programme in their id.
export const programmes = ['B.Des.', 'M.Des.'];
export const programmeExams = { 'B.Des.': ['uceed', 'nid', 'nift'], 'M.Des.': ['ceed', 'nid', 'nift'] };
export function paperProgramme(paper) {
  if (paper.exam === 'uceed') return 'B.Des.';
  if (paper.exam === 'ceed') return 'M.Des.';
  return paperLevel(paper).trim();
}
// ?programme=mdes opens the M.Des. list; anything else follows the exam.
export const programmeFromQuery = query => ({ bdes: 'B.Des.', mdes: 'M.Des.' })[query.get('programme')] ?? '';
// A paper whose programme is unknown stays visible under both.
export function inProgramme(paper, programme) {
  const own = paperProgramme(paper);
  return !own || own === programme;
}

// showLevel is false where the page already separates B.Des. from M.Des.
export function paperSubtitle(paper, showLevel = true) {
  const level = showLevel ? paperLevel(paper) : '';
  const rest = paperLabel(paper).slice(String(paper.year).length).replace(/^\s*·\s*/, '').trim();
  const label = rest === 'paper' ? 'question paper' : rest;
  const text = level + label;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
