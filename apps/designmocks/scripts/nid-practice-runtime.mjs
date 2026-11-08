import { inspectRuntimeQuestion, numericKey } from './question-runtime.mjs';
import { isHumanTask, nidPracticeSchema, validateNidPracticeBlueprint } from '../src/nid-practice-blueprint.js';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const sha = /^[a-f0-9]{64}$/;

// A reviewed authored context is separate from the official RULES_2027 table.
// No caller-supplied rule can make the legacy official compiler accept NID.
export function nidPracticeRuntime(question, binding, mediaCatalog = []) {
  const issues = [];
  const unavailable = code => ({ runtime: null, issues: [...issues, code] });
  if (String(question?.provenance?.exam ?? '').toLowerCase() !== 'nid') return unavailable('nid-source-required');
  const blueprint = binding?.blueprint;
  if (binding?.current !== true || binding.externalKey !== question.externalKey || !uuid.test(binding.id) || !uuid.test(blueprint?.id) || !sha.test(blueprint.sha256 ?? '') ||
      blueprint.status !== 'reviewed' || blueprint.revision !== blueprint.currentRevision || !Number.isInteger(blueprint.revision) || blueprint.revision < 1)
    return unavailable('practice-binding-stale');
  try { validateNidPracticeBlueprint(blueprint.payload); } catch { return unavailable('practice-blueprint-invalid'); }
  const section = blueprint.payload.sections[binding.sectionOrdinal - 1];
  const human = isHumanTask(section?.kind);
  if (!Number.isInteger(binding.sectionOrdinal) || !section || (human ? question.type !== 'DESCRIPTIVE' : question.type?.toLowerCase() !== section.kind))
    return unavailable('practice-section-mismatch');
  if (!Array.isArray(question.assets) || typeof question.prompt !== 'string') return unavailable('practice-source-invalid');
  if (question.visualDependency != null && typeof question.visualDependency !== 'boolean') return unavailable('practice-source-invalid');
  if (!human && Array.isArray(question.options) && question.options.some(option => option?.asset != null)) return unavailable('option-asset-unmapped');
  const inspected = inspectRuntimeQuestion(question, { mediaCatalog });
  issues.push(...inspected.issues.filter(issue => issue.code !== 'context-unverified').map(issue => issue.code));
  if (issues.length) return { runtime: null, issues };
  if (!human && typeof question.answer?.raw !== 'string') return unavailable('practice-answer-invalid');
  const raw = String(question.answer?.raw ?? '').trim();
  let key, options = [];
  if (human) key = { kind: 'drawing' };
  else if (section.kind === 'nat') key = numericKey(raw);
  else {
    options = question.options.map(option => ({ id: option.key, label: typeof option.text === 'string' && option.text.trim() || option.key }));
    const ids = options.map(option => option.id);
    if (section.kind === 'mcq') { if (ids.includes(raw)) key = { kind: 'mcq', correct: [raw] }; }
    else {
      const selected = ids.includes(raw) ? [raw] : /^[A-Za-z]+$/.test(raw) && ids.every(id => /^[A-Za-z]$/.test(id)) ? raw.split('') : raw.split(/[\s,;&/]+/);
      if (selected.length && selected.every(id => ids.includes(id)) && new Set(selected).size === selected.length) key = { kind: 'msq', correct: [...selected].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))) };
    }
  }
  if (!key) return unavailable('answer-notation');
  key.sourceExternalKey = question.externalKey;
  const catalogue = new Map(mediaCatalog.map(asset => [asset.sha256, asset]));
  const media = question.assets.map((asset, index) => ({ path: catalogue.get(asset.sha256).path, alt: `Question figure ${index + 1}`, sha256: asset.sha256, width: asset.width, height: asset.height }));
  const context = { version: nidPracticeSchema, exam: 'nid', scope: 'authored-practice', blueprintId: blueprint.id, blueprintRevision: blueprint.revision,
    blueprintSha256: blueprint.sha256, bindingId: binding.id, sectionOrdinal: binding.sectionOrdinal, sectionLabel: section.label, responseKind: section.kind,
    durationSeconds: blueprint.payload.durationMinutes * 60, uploadGraceSeconds: blueprint.payload.uploadGraceMinutes * 60, rubric: section.rubric.map(criterion => ({ ...criterion })) };
  // Existing paper/attempt writers freeze the key. Carry the authored context
  // through that snapshot path without consulting a mutable bank during review.
  key.practiceContext = context;
  return { issues, runtime: { prompt: question.prompt, options, kind: key.kind,
    marking: { correct: section.points, wrong: -section.penalty || 0, ...(human ? { humanReview: true } : {}) },
    media, points: section.points, negativePoints: section.penalty, topic: question.topic || (human ? 'drawing' : 'unclassified'), key,
    explanation: typeof question.explanation === 'string' && question.explanation.trim() ? question.explanation : human ? 'Human review against the DMocks-authored practice rubric.' : `Answer key: ${raw}`,
    context,
  } };
}
