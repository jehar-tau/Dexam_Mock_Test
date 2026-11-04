const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REVIEW_STATE_FILE = path.join(ROOT, 'server', 'review-state.json');
const BANK_FILE = path.join(ROOT, 'dexam-bank-machine-readable.json');
const OVERLAY_FILE = path.join(ROOT, 'server', 'data', 'nift-ocr-overlay.json');

const BLUEPRINT_FILE = path.join(ROOT, 'docs', 'blueprints-2026.draft.json');

const STUDENT_EXAMS = ['UCEED', 'CEED', 'NID', 'NIFT'];
// UCEED and CEED Part A test the same aptitude, so their mocks draw from one shared pool
const POOLED_EXAMS = ['UCEED', 'CEED'];
const MOCKS_PER_EXAM = 10;
const MIN_QUESTIONS = 10;
const MAX_DRAWING_TASKS_PER_PAPER = 12;
const MINUTES_PER_DRAWING_TASK = 30;
const SECTION_TITLES = { NAT: 'Numerical Answer', MSQ: 'Multiple Select', MCQ: 'Multiple Choice' };
const MARKING = { NAT: { marks: 4, negative: 0 }, MSQ: { marks: 4, negative: 1 }, MCQ: { marks: 3, negative: 0 }, DESCRIPTIVE: { marks: 0, negative: 0 } };

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { return fallback; }
}

// Bank with the OCR-recovered NIFT options/context applied and numeric MCQ keys (1-4) turned into letters
function loadBank() {
  const bank = readJson(BANK_FILE, { questions: [] });
  const overlay = readJson(OVERLAY_FILE, {});
  bank.questions.forEach((q) => {
    const o = overlay[q.id];
    if (o) {
      if (o.options && (!q.options || q.options.length === 0)) {
        q.options = o.options.map((x, i) => ({ position: String.fromCharCode(65 + i), text: x.text }));
        q.options_source = 'ocr';
      }
      if (o.context) q.context_text = o.context.split(/\s\d{1,3}\.\s/)[0].trim();
    }
    if (q.type === 'MCQ' && /^[1-4]$/.test(String(q.answer_key)) && q.options && q.options.length) {
      q.answer_key_original = q.answer_key;
      q.answer_key = 'ABCD'[Number(q.answer_key) - 1];
    }
  });
  return bank;
}

const mediaUrl = (p) => {
  const marker = 'server/data/media/';
  const i = String(p || '').indexOf(marker);
  return i >= 0 ? '/media/' + String(p).slice(i + marker.length) : '';
};

// A student may only see questions that were reviewed, not flagged, and can be scored
function isPublishable(q, state) {
  const r = state[q.id];
  if (!r || !r.marked || r.flagged) return false;
  if (!STUDENT_EXAMS.includes(q.exam)) return false;
  if (!['NAT', 'MSQ', 'MCQ'].includes(q.type)) return false;
  const key = String(q.answer_key || '').trim();
  if (!key || q.answer_status === 'pending') return false;
  if (q.type === 'NAT' && Number.isNaN(Number(key))) return false;
  return true;
}

// Drawing and written tasks are answered on paper, so they need a review but no answer key
function isDrawingReady(q, state) {
  const r = state[q.id];
  return !!(r && r.marked && !r.flagged && STUDENT_EXAMS.includes(q.exam) && q.type === 'DESCRIPTIVE');
}

function toAppQuestion(q, marking) {
  const figure = mediaUrl(q.figure_image);
  const m = marking || MARKING[q.type];
  if (q.type === 'DESCRIPTIVE') {
    return {
      id: q.id,
      type: 'DESCRIPTIVE',
      topic: paperTitle(q.paper_id),
      difficulty: 'Part B',
      prompt: q.question_text || '',
      figurePaths: figure ? [figure] : [],
      marks: 0,
      negative: 0,
      solution: 'Part B is not auto-scored. Check your sheet against every instruction in the brief.'
    };
  }
  const hasOptions = Array.isArray(q.options) && q.options.length > 0;
  const options = q.type === 'NAT' ? undefined
    : hasOptions ? q.options.map((o) => ({ id: o.position, text: o.text }))
    : ['A', 'B', 'C', 'D'].map((id) => ({ id, text: 'Choose from the figure' }));
  const key = String(q.answer_key).trim();
  const correctAnswer = q.type === 'NAT' ? Number(key)
    : q.type === 'MSQ' ? key.split(/[,;&/\s]+/).map((v) => v.trim().toUpperCase()).filter(Boolean)
    : key.toUpperCase();
  return {
    id: q.id,
    type: q.type,
    topic: q.source_paper || q.paper_id,
    difficulty: 'Official',
    prompt: (q.context_text ? q.context_text + '\n\n' : '') + (q.question_text || ''),
    options,
    figurePaths: figure ? [figure] : [],
    correctAnswer,
    tolerance: q.type === 'NAT' ? 0.01 : undefined,
    marks: m.marks,
    negative: m.negative,
    solution: 'Answer key status: ' + (q.answer_status || 'unknown') + '.'
  };
}

const UPPER = new Set(['uceed', 'ceed', 'nid', 'nift', 'bdes', 'mdes', 'bft', 'mfm', 'cat', 'dat']);
function paperTitle(paperId) {
  return paperId.split('-').map((t) => UPPER.has(t) ? t.toUpperCase() : t.replace(/^set(\d+)$/, 'Set $1').replace(/^./, (c) => c.toUpperCase())).join(' ');
}

const INSTRUCTIONS = { NAT: 'Enter a number.', MSQ: 'Select all correct options.', MCQ: 'Select one option.' };

function objectiveSection(id, type, questions, marking, titlePrefix) {
  return { id, title: (titlePrefix || '') + SECTION_TITLES[type], label: type, type, marks: marking.marks, negative: marking.negative,
    instructions: INSTRUCTIONS[type], questions: questions.map((q) => toAppQuestion(q, marking)) };
}

function drawingSection(id, questions) {
  return { id, title: 'Part B · Drawing', label: 'Part B', type: 'DESCRIPTIVE', marks: 0, negative: 0,
    instructions: 'Work on paper, then tick the task as done. Part B is not auto-scored.', questions: questions.map((q) => toAppQuestion(q)) };
}

// Stable order that does not follow source paper or year, so mocks stay the same between requests
function stableShuffle(items) {
  const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  return items.slice().sort((a, b) => hash(a.id) - hash(b.id) || a.id.localeCompare(b.id));
}

function buildMixedMocks(objective, drawings) {
  const blueprints = readJson(BLUEPRINT_FILE, { exams: {} }).exams;
  const queues = { NAT: [], MSQ: [], MCQ: [] };
  stableShuffle(objective.filter((q) => POOLED_EXAMS.includes(q.exam))).forEach((q) => queues[q.type].push(q));
  const drawingQueue = stableShuffle(drawings);
  const plans = POOLED_EXAMS.map((exam) => {
    const bp = blueprints[exam.toLowerCase()];
    const partA = bp.parts.find((p) => p.id === 'A');
    const partB = bp.parts.find((p) => p.id === 'B');
    return { exam, bp, partA, partB, tasks: partB.tasks.reduce((n, t) => n + t.count, 0) };
  });
  const take = (queue, n) => (queue.length >= n ? queue.splice(0, n) : null);
  const mocks = [];
  // Interleave the exams so every mock of either exam gets fresh questions; no question repeats across any mock
  for (let i = 1; i <= MOCKS_PER_EXAM; i += 1) {
    plans.forEach(({ exam, bp, partA, partB, tasks }) => {
      if (!partA.sections.every((s) => queues[s.type].length >= s.count) || drawingQueue.length < tasks) return;
      const id = 'mock-' + exam.toLowerCase() + '-' + String(i).padStart(2, '0');
      const sections = partA.sections.map((s) => {
        const marking = s.type === 'MSQ' ? MARKING.MSQ : { marks: s.marksCorrect, negative: Math.abs(s.marksWrong || 0) };
        return objectiveSection(id + '-' + s.type.toLowerCase(), s.type, take(queues[s.type], s.count), marking, 'Part A · ');
      });
      sections.push(drawingSection(id + '-partb', take(drawingQueue, tasks)));
      mocks.push({
        id,
        examId: exam.toLowerCase(),
        examName: exam,
        year: '2026',
        mode: 'mixed-mock',
        title: exam + ' Mock ' + i,
        subtitle: '2026 pattern · reviewed UCEED + CEED questions',
        description: 'Part A follows the ' + bp.label + ' pattern with reviewed questions mixed from UCEED and CEED past papers. Part B has ' + tasks +
          ' drawing task' + (tasks === 1 ? '' : 's') + ' to do on paper (not auto-scored). Part A and Part B share one ' + bp.durationMin + '-minute clock.',
        durationMinutes: partA.durationMin + partB.durationMin,
        totalMarks: sections.reduce((s, sec) => s + sec.questions.length * sec.marks, 0),
        sections
      });
    });
  }
  return mocks;
}

function build() {
  const bank = loadBank();
  const state = readJson(REVIEW_STATE_FILE, {});
  const byPaper = new Map();
  const group = (q) => {
    if (!byPaper.has(q.paper_id)) byPaper.set(q.paper_id, { objective: [], drawing: [] });
    return byPaper.get(q.paper_id);
  };
  const objective = [];
  const drawings = [];
  const pending = [];
  bank.questions.forEach((q) => {
    if (isPublishable(q, state)) { group(q).objective.push(q); objective.push(q); }
    else if (isDrawingReady(q, state)) { group(q).drawing.push(q); drawings.push(q); }
    else pending.push(q.id);
  });
  const papers = [];
  byPaper.forEach(({ objective: qs, drawing }, paperId) => {
    // A collection of hundreds of tasks is a pool, not a paper; it only feeds mock Part B
    const partB = drawing.length <= MAX_DRAWING_TASKS_PER_PAPER ? drawing : [];
    if (qs.length < MIN_QUESTIONS && partB.length < 2) return;
    const byNumber = (a, b) => String(a.question_no).localeCompare(String(b.question_no), undefined, { numeric: true });
    qs.sort(byNumber);
    partB.sort(byNumber);
    const exam = (qs[0] || partB[0]).exam;
    const sections = qs.length >= MIN_QUESTIONS
      ? ['NAT', 'MSQ', 'MCQ'].map((type) => {
        const items = qs.filter((q) => q.type === type);
        return items.length ? objectiveSection(paperId + '-' + type.toLowerCase(), type, items, MARKING[type]) : null;
      }).filter(Boolean)
      : [];
    if (partB.length) sections.push(drawingSection(paperId + '-partb', partB));
    const objectiveCount = sections.filter((s) => s.type !== 'DESCRIPTIVE').reduce((n, s) => n + s.questions.length, 0);
    papers.push({
      id: 'official-' + paperId,
      examId: exam.toLowerCase(),
      examName: exam,
      year: (paperId.match(/(20\d\d)/) || [''])[0],
      mode: 'official-paper',
      title: paperTitle(paperId),
      subtitle: 'Official past paper · reviewed questions only',
      description: (objectiveCount ? objectiveCount + ' reviewed questions from this paper. Scoring is a practice model (+4/0 NAT, +4/-1 MSQ, +3/0 MCQ), not the official marking scheme. ' : '') +
        (partB.length ? 'Part B: ' + partB.length + ' drawing task' + (partB.length === 1 ? '' : 's') + ' to do on paper (not auto-scored).' : ''),
      durationMinutes: (objectiveCount ? Math.max(20, Math.ceil(objectiveCount * 1.5)) : 0) + partB.length * MINUTES_PER_DRAWING_TASK,
      totalMarks: sections.reduce((s, sec) => s + sec.questions.length * sec.marks, 0),
      sections
    });
  });
  papers.sort((a, b) => a.examName.localeCompare(b.examName) || a.title.localeCompare(b.title));
  const mocks = buildMixedMocks(objective, drawings);
  return { papers: mocks.concat(papers), publishable: objective.length + drawings.length, pendingIds: pending };
}

module.exports = { build, loadBank, isPublishable, isDrawingReady, readJson, REVIEW_STATE_FILE };
