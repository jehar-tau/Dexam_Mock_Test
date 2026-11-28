// Operator-only: turn an owner-approved original "AIM" paper into a private
// All India plan, upload its figures and stage it hidden on the backend.
// Question content never enters Git: the source, plan and figures live outside
// the repository and this script refuses to write a plan inside it.
//
//   node scripts/all-india-paper.mjs build  --source <dir with paper.json, fig/> --out <private dir>
//   node scripts/all-india-paper.mjs digest --plan <private dir>/plan.json
//   node scripts/all-india-paper.mjs stage  --plan <private dir>/plan.json --expect <planSha256> [--apply]
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, readdir, realpath, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {sha256, stableJson} from './question-bank-import.mjs';
import {numericKey, RULES_2027} from './question-runtime.mjs';
import {verifyAssetBytes} from './private-bank-media.mjs';
import {openFreeYearPaperProvider} from './private-bank-provider.mjs';
import {freeYearPaperProviderConfiguration} from './prepare-free-year-paper.mjs';

export const PLAN_FORMAT = 'dmocks-all-india-paper-v1';
export const PAPER_KEY = /^(uceed|ceed|nid|nift)(-(bdes|mdes))?-aim-[1-9][0-9]{0,2}$/;
const digest = /^[a-f0-9]{64}$/;
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const fail = message => { throw new Error(message); };

// Owner decision, 27 November 2026: CEED, UCEED and NID papers run on one
// shared clock (objective part plus drawing), then 10 minutes for uploads.
export const PAPER_CLOCKS = Object.freeze({
  uceed: {durationSeconds: 10800, uploadGraceSeconds: 600},
  ceed: {durationSeconds: 10800, uploadGraceSeconds: 600},
  nid: {durationSeconds: 10800, uploadGraceSeconds: 600},
});

function explanationText(question) {
  const value = question.explanation;
  if (typeof value === 'string') return value.trim();
  const parts = [];
  if (value?.keyIdea?.trim()) parts.push(`Key idea: ${value.keyIdea.trim()}`);
  const steps = Array.isArray(value?.steps) ? value.steps.filter(step => typeof step === 'string' && step.trim()) : [];
  if (steps.length) parts.push(steps.map((step, index) => `${index + 1}. ${step.trim()}`).join('\n'));
  if (value?.trap?.trim()) parts.push(`Trap: ${value.trap.trim()}`);
  if (value?.fast?.trim()) parts.push(`Faster route: ${value.fast.trim()}`);
  return parts.join('\n\n');
}

function drawingGuide(question) {
  const criteria = Array.isArray(question.criteria) ? question.criteria : [];
  const lines = criteria.map(([label, marks]) => `${label} (${marks})`);
  const head = `Marked by a teacher out of ${question.marks}${lines.length ? ' on: ' + lines.join('; ') : ''}.`;
  const advice = explanationText(question);
  return advice ? `${head}\n\n${advice}` : head;
}

function choiceKey(type, raw, ids) {
  const selected = String(raw ?? '').split(/[\s,;]+/).filter(Boolean);
  if (!selected.length || new Set(selected).size !== selected.length || selected.some(id => !ids.includes(id))) return null;
  if (type === 'MCQ' && selected.length !== 1) return null;
  return {kind: type.toLowerCase(), correct: selected.sort()};
}

// figures: Map<file name, {sha256,width,height,byteSize}> produced by renderFigures.
export function buildAllIndiaPlan(paper, figures, clock = PAPER_CLOCKS[paper?.exam]) {
  if (!paper || typeof paper !== 'object' || !PAPER_KEY.test(paper.paperId ?? '') || !paper.paperId.startsWith(paper.exam + '-'))
    fail('The source paper needs an <exam>-aim-<n> paperId');
  if (!clock || !Number.isInteger(clock.durationSeconds) || !Number.isInteger(clock.uploadGraceSeconds))
    fail(`No owner-approved clock for ${paper.exam}`);
  if (typeof paper.title !== 'string' || paper.title.trim().length < 5 || !Array.isArray(paper.questions) || !paper.questions.length)
    fail('The source paper is incomplete');
  const rule = RULES_2027[paper.exam];
  const questions = [];
  let drawings = 0, totalMarks = 0;
  for (const source of paper.questions) {
    const type = source.type;
    const drawing = type === 'DESCRIPTIVE';
    const number = drawing ? ++drawings : source.n;
    if (!Number.isInteger(number) || number < 1) fail(`${source.key}: invalid question number`);
    const externalKey = `${paper.paperId}-${drawing ? 'b' : 'q'}${number}`;
    const media = (source.figs ?? []).map((name, index) => {
      const figure = figures.get(name) ?? fail(`${source.key}: figure ${name} was not rendered`);
      return {path: `papers/canonical/${figure.sha256}.png`, alt: `Question figure ${index + 1}`,
        sha256: figure.sha256, width: figure.width, height: figure.height};
    });
    let runtime;
    if (drawing) {
      if (!Number.isFinite(source.marks) || source.marks <= 0) fail(`${source.key}: a drawing task needs its marks`);
      runtime = {kind: 'drawing', prompt: source.prompt, options: [], marking: {correct: source.marks, wrong: 0, humanReview: true},
        media, points: source.marks, negativePoints: 0, key: {kind: 'drawing', sourceExternalKey: externalKey,
          criteria: (source.criteria ?? []).map(([label, marks]) => ({label, marks}))}, explanation: drawingGuide(source)};
    } else {
      const scheme = rule?.sections?.[type] ?? fail(`${source.key}: no verified ${paper.exam} marking for ${type}`);
      const options = (source.options ?? []).map(option => ({id: option.key, label: option.text?.trim() || option.key}));
      let key;
      if (type === 'NAT') key = options.length ? null : numericKey(String(source.answer ?? '').trim());
      else key = options.length >= 2 ? choiceKey(type, source.answer, options.map(option => option.id)) : null;
      if (!key) fail(`${source.key}: the answer does not match its options`);
      key.sourceExternalKey = externalKey;
      runtime = {kind: type.toLowerCase(), prompt: source.prompt, options,
        marking: {correct: scheme.correct, wrong: scheme.wrong, ...(scheme.partial ? {partial: true} : {})},
        media, points: scheme.correct, negativePoints: Math.abs(scheme.wrong), key, explanation: explanationText(source)};
    }
    if (typeof runtime.prompt !== 'string' || runtime.prompt.trim().length < 5) fail(`${source.key}: prompt missing`);
    if (runtime.explanation.length < 20) fail(`${source.key}: worked explanation missing`);
    const payload = {
      holds: [], sourceKind: 'original', licence: 'dmocks-original',
      provenance: {kind: 'all-india-mock', paperId: paper.paperId, part: source.part ?? null, label: source.label ?? null,
        ...(source.parallelOf ? {parallelOf: source.parallelOf} : {}), ...(source.modelledOn ? {modelledOn: source.modelledOn} : {})},
      externalKey, type, prompt: source.prompt, options: source.options ?? [], answer: {raw: source.answer ?? null},
      explanation: source.explanation ?? null, topic: source.topic, subtopic: source.subtopic ?? null,
      difficulty: source.difficulty ?? null, seconds: source.seconds ?? null, marks: source.marks ?? null,
      criteria: source.criteria ?? null, imageSources: source.imageSources ?? [],
      assets: media.map(figure => ({path: `${figure.sha256}.png`, sha256: figure.sha256, width: figure.width, height: figure.height})),
    };
    totalMarks += runtime.points;
    questions.push({externalKey, number, contentSha256: sha256(stableJson(payload)), questionType: type,
      topic: source.topic || (drawing ? 'drawing' : 'unclassified'), payload, runtime});
  }
  const plan = {format: PLAN_FORMAT, paperKey: paper.paperId, exam: paper.exam, title: paper.title.trim(),
    durationSeconds: clock.durationSeconds, uploadGraceSeconds: drawings ? clock.uploadGraceSeconds : 0,
    totalMarks: Math.round(totalMarks * 100) / 100, markingReference: String(paper.pattern ?? '').trim(), questions};
  return {plan, summary: validateAllIndiaPlan(plan)};
}

export function validateAllIndiaPlan(plan) {
  if (plan?.format !== PLAN_FORMAT || !PAPER_KEY.test(plan.paperKey ?? '') || !plan.paperKey.startsWith(plan.exam + '-')
    || typeof plan.title !== 'string' || plan.title.length < 5 || plan.title.length > 140
    || !Number.isInteger(plan.durationSeconds) || plan.durationSeconds < 900 || plan.durationSeconds > 21600
    || !Array.isArray(plan.questions) || plan.questions.length < 1 || plan.questions.length > 100)
    fail('Invalid All India plan');
  const keys = new Set();
  let objective = 0, drawing = 0, total = 0;
  const media = new Map();
  for (const item of plan.questions) {
    const runtime = item?.runtime;
    if (!item || keys.has(item.externalKey) || !digest.test(item.contentSha256 ?? '') || item.payload?.provenance?.kind !== 'all-india-mock'
      || item.payload?.sourceKind !== 'original' || item.payload?.licence !== 'dmocks-original'
      || item.payload?.provenance?.paperId !== plan.paperKey || sha256(stableJson(item.payload)) !== item.contentSha256
      || !['mcq', 'msq', 'nat', 'drawing'].includes(runtime?.kind) || runtime.key?.sourceExternalKey !== item.externalKey)
      fail(`Invalid All India question ${item?.externalKey ?? ''}`);
    keys.add(item.externalKey);
    if (runtime.kind === 'drawing') drawing++; else objective++;
    total += runtime.points;
    for (const figure of runtime.media) media.set(figure.sha256, figure);
  }
  const expectedGrace = drawing ? [600, 900] : [0, 0];
  if (plan.uploadGraceSeconds < expectedGrace[0] || plan.uploadGraceSeconds > expectedGrace[1]) fail('Invalid All India upload window');
  if (Math.abs(total - plan.totalMarks) > 1e-9) fail('The plan total does not match its questions');
  return {planSha256: sha256(stableJson(plan)), paperKey: plan.paperKey, exam: plan.exam, title: plan.title,
    durationSeconds: plan.durationSeconds, uploadGraceSeconds: plan.uploadGraceSeconds, objectiveCount: objective,
    drawingCount: drawing, totalMarks: plan.totalMarks, figureCount: media.size};
}

function pngSize(bytes) {
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.subarray(12, 16).toString() !== 'IHDR') fail('Not a PNG figure');
  return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
}

// Rasterise every referenced SVG at 2x in Chromium; PNG figures are kept as they are.
async function renderFigures(sourceDir, names, mediaDir) {
  const figures = new Map();
  const svgs = names.filter(name => name.endsWith('.svg'));
  let browser;
  if (svgs.length) {
    const {chromium} = await import('playwright');
    browser = await chromium.launch();
  }
  try {
    for (const name of names) {
      if (!/^[A-Za-z0-9_.-]+\.(svg|png)$/.test(name)) fail(`Unsafe figure name ${name}`);
      const file = path.join(sourceDir, 'fig', name);
      let bytes;
      if (name.endsWith('.png')) bytes = await readFile(file);
      else {
        const svg = await readFile(file, 'utf8');
        const box = svg.match(/viewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*"/) ?? fail(`${name}: SVG has no viewBox`);
        const width = Math.ceil(Number(box[1])), height = Math.ceil(Number(box[2]));
        const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 2});
        const page = await context.newPage();
        await page.route('**/*', route => route.request().url().startsWith('data:') ? route.continue() : route.abort());
        await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff">${svg.replace(/<svg\b/, `<svg width="${width}" height="${height}"`)}</body></html>`);
        bytes = await page.screenshot({clip: {x: 0, y: 0, width, height}, type: 'png'});
        await context.close();
      }
      const {width, height} = pngSize(bytes);
      const figure = {sha256: sha256(bytes), width, height, byteSize: bytes.length};
      verifyAssetBytes(figure, bytes);
      await writeFile(path.join(mediaDir, `${figure.sha256}.png`), bytes);
      figures.set(name, figure);
    }
  } finally { await browser?.close(); }
  return figures;
}

async function insideGitWorkTree(directory) {
  try {
    execFileSync('git', ['-C', directory, 'rev-parse', '--is-inside-work-tree'], {stdio: ['ignore', 'pipe', 'ignore']});
    return true;
  } catch { return false; }
}

async function readPlan(planPath) {
  const info = await stat(planPath);
  if (!info.isFile() || info.size > 8 * 1024 * 1024) fail('The private plan is unreadable or too large');
  return JSON.parse(await readFile(planPath, 'utf8'));
}

async function storageCall(provider, url, init, okStatuses = [200]) {
  const response = await provider.fetch(url, init);
  if (!okStatuses.includes(response.status)) {
    await response.body?.cancel().catch(() => {});
    fail(`Private storage request failed (HTTP ${response.status})`);
  }
  return response;
}

// Upload each figure once and verify the stored bytes before staging the plan.
async function uploadFigures(provider, plan, mediaDir) {
  const bucket = await (await storageCall(provider, `${provider.origin}/storage/v1/bucket/paper-media`, {method: 'GET'})).json();
  if (bucket?.public !== false) fail('The paper-media bucket must be private');
  const figures = new Map();
  for (const item of plan.questions) for (const figure of item.runtime.media) figures.set(figure.sha256, figure);
  for (const figure of figures.values()) {
    const bytes = await readFile(path.join(mediaDir, `${figure.sha256}.png`));
    verifyAssetBytes(figure, bytes);
    const objectPath = `paper-media/papers/canonical/${figure.sha256}.png`;
    await storageCall(provider, `${provider.origin}/storage/v1/object/${objectPath}`, {method: 'POST',
      headers: {'content-type': 'image/png', 'x-upsert': 'false', 'cache-control': '3600'}, body: bytes}, [200, 400, 409]);
    const stored = Buffer.from(await (await storageCall(provider,
      `${provider.origin}/storage/v1/object/authenticated/${objectPath}`, {method: 'GET'})).arrayBuffer());
    verifyAssetBytes(figure, stored);
  }
  return figures.size;
}

async function main() {
  const [command] = process.argv.slice(2);
  const {values} = parseArgs({args: process.argv.slice(3), options: {
    source: {type: 'string'}, out: {type: 'string'}, plan: {type: 'string'}, expect: {type: 'string'}, apply: {type: 'boolean'}}});
  if (command === 'build') {
    if (!values.source || !values.out) fail('Provide --source and --out');
    const out = path.resolve(values.out);
    await mkdir(path.join(out, 'media'), {recursive: true});
    if (await insideGitWorkTree(await realpath(out))) fail('Refusing to write private question content inside a Git work tree');
    const paper = JSON.parse(await readFile(path.join(values.source, 'paper.json'), 'utf8'));
    const names = [...new Set(paper.questions.flatMap(question => question.figs ?? []))];
    const figures = await renderFigures(values.source, names, path.join(out, 'media'));
    const {plan, summary} = buildAllIndiaPlan(paper, figures);
    await writeFile(path.join(out, 'plan.json'), JSON.stringify(plan, null, 1) + '\n');
    const stale = (await readdir(path.join(out, 'media'))).filter(name => ![...figures.values()].some(f => `${f.sha256}.png` === name));
    console.log(JSON.stringify({mode: 'built-private-plan', ...summary, staleFigures: stale.length}));
    return;
  }
  if (!values.plan) fail('Provide --plan');
  const plan = await readPlan(values.plan);
  const summary = validateAllIndiaPlan(plan);
  if (command === 'digest') { console.log(JSON.stringify({mode: 'review-digest', ...summary})); return; }
  if (command !== 'stage') fail('Use build, digest or stage');
  if (summary.planSha256 !== values.expect) fail('The plan changed after its review SHA-256 was recorded');
  const mediaDir = path.join(path.dirname(path.resolve(values.plan)), 'media');
  for (const item of plan.questions) for (const figure of item.runtime.media)
    verifyAssetBytes(figure, await readFile(path.join(mediaDir, `${figure.sha256}.png`)));
  if (!values.apply) { console.log(JSON.stringify({mode: 'dry-run', ...summary})); return; }
  const provider = await openFreeYearPaperProvider(freeYearPaperProviderConfiguration(process.env),
    {acknowledgement: 'STAGE_ALL_INDIA_PAPER_ON'});
  const figures = await uploadFigures(provider, plan, mediaDir);
  const receipt = await provider.rpc('stage_all_india_paper', {p_plan: plan, p_plan_sha256: summary.planSha256});
  if (receipt?.paperKey !== summary.paperKey || !uuid.test(receipt?.paperId ?? '') || !digest.test(receipt?.manifestSha256 ?? '')
    || receipt.objectiveCount !== summary.objectiveCount || receipt.drawingCount !== summary.drawingCount)
    fail('The private target returned an invalid staging receipt');
  console.log(JSON.stringify({mode: 'staged-hidden', ...summary, figuresRegistered: figures, ...receipt}));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
export const scriptPath = fileURLToPath(import.meta.url);
