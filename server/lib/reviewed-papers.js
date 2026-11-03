const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REVIEW_STATE_FILE = path.join(ROOT, 'server', 'review-state.json');
const BANK_FILE = path.join(ROOT, 'dexam-bank-machine-readable.json');
const OVERLAY_FILE = path.join(ROOT, 'server', 'data', 'nift-ocr-overlay.json');

const STUDENT_EXAMS = ['UCEED', 'NID', 'NIFT'];
const MIN_QUESTIONS = 10;
const SECTION_TITLES = { NAT: 'Numerical Answer', MSQ: 'Multiple Select', MCQ: 'Multiple Choice' };
const MARKING = { NAT: { marks: 4, negative: 0 }, MSQ: { marks: 4, negative: 1 }, MCQ: { marks: 3, negative: 0 } };

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

function toAppQuestion(q) {
  const figure = mediaUrl(q.figure_image);
  const hasOptions = Array.isArray(q.options) && q.options.length > 0;
  const options = q.type === 'NAT' ? undefined
    : hasOptions ? q.options.map((o) => ({ id: o.position, text: o.text }))
    : ['A', 'B', 'C', 'D'].map((id) => ({ id, text: 'Choose from the figure' }));
  const key = String(q.answer_key).trim();
  const correctAnswer = q.type === 'NAT' ? Number(key)
    : q.type === 'MSQ' ? key.split(/[,;&/\s]+/).map((v) => v.trim().toUpperCase()).filter(Boolean)
    : key.toUpperCase();
  const m = MARKING[q.type];
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

const UPPER = new Set(['uceed', 'nid', 'nift', 'bdes', 'mdes', 'bft', 'mfm', 'cat', 'dat']);
function paperTitle(paperId) {
  return paperId.split('-').map((t) => UPPER.has(t) ? t.toUpperCase() : t.replace(/^set(\d+)$/, 'Set $1').replace(/^./, (c) => c.toUpperCase())).join(' ');
}

function build() {
  const bank = loadBank();
  const state = readJson(REVIEW_STATE_FILE, {});
  const byPaper = new Map();
  const pending = [];
  bank.questions.forEach((q) => {
    if (isPublishable(q, state)) {
      if (!byPaper.has(q.paper_id)) byPaper.set(q.paper_id, []);
      byPaper.get(q.paper_id).push(q);
    } else {
      pending.push(q.id);
    }
  });
  const papers = [];
  byPaper.forEach((qs, paperId) => {
    if (qs.length < MIN_QUESTIONS) return;
    qs.sort((a, b) => Number(a.question_no) - Number(b.question_no));
    const exam = qs[0].exam;
    const sections = ['NAT', 'MSQ', 'MCQ'].map((type) => {
      const items = qs.filter((q) => q.type === type).map(toAppQuestion);
      if (!items.length) return null;
      const m = MARKING[type];
      return { id: paperId + '-' + type.toLowerCase(), title: SECTION_TITLES[type], label: type, type, marks: m.marks, negative: m.negative,
        instructions: type === 'NAT' ? 'Enter a number.' : type === 'MSQ' ? 'Select all correct options.' : 'Select one option.', questions: items };
    }).filter(Boolean);
    const total = sections.reduce((s, sec) => s + sec.questions.length * sec.marks, 0);
    papers.push({
      id: 'official-' + paperId,
      examId: exam.toLowerCase(),
      examName: exam,
      year: (paperId.match(/(20\d\d)/) || [''])[0],
      mode: 'official-paper',
      title: paperTitle(paperId),
      subtitle: 'Official past paper · reviewed questions only',
      description: qs.length + ' reviewed questions from this paper. Scoring is a practice model (+4/0 NAT, +4/-1 MSQ, +3/0 MCQ), not the official marking scheme.',
      durationMinutes: Math.max(20, Math.ceil(qs.length * 1.5)),
      totalMarks: total,
      sections
    });
  });
  papers.sort((a, b) => a.examName.localeCompare(b.examName) || a.title.localeCompare(b.title));
  return { papers, publishable: papers.reduce((n, p) => n + p.sections.reduce((s, x) => s + x.questions.length, 0), 0), pendingIds: pending };
}

module.exports = { build, loadBank, isPublishable, readJson, REVIEW_STATE_FILE };
