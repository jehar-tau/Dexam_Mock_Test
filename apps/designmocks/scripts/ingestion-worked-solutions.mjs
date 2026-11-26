// Converts the private ingestion solution overlays (<paper>/05-solutions/q*.json,
// drawn on <paper>/03-figures/qN/fig-K.png) into the website's reviewed
// worked-solution format. It reads private files and, with --out, writes a
// private JSON file. Run it again whenever the owner edits a solution.
//   node scripts/ingestion-worked-solutions.mjs --work ~/dmocks-ingestion-work --paper uceed-2026 [--out file]
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { validateWorkedSolution } from '../src/worked-solution.js';

const dropped = new Set(['id']);
const entity = value => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// A small parser for the overlay vocabulary (no comments, CDATA or scripts).
export function parseOverlay(markup) {
  const root = { children: [] }, stack = [root];
  const token = /<\/([a-z]+)\s*>|<([a-z]+)((?:\s+[a-z][a-z0-9-]*\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)|(<)/gi;
  let match;
  while ((match = token.exec(markup))) {
    const [, close, open, attrText, selfClose, text, stray] = match;
    if (stray) throw new Error('Unreadable overlay tag near ' + JSON.stringify(markup.slice(match.index, match.index + 40)));
    const parent = stack.at(-1);
    if (close) { if (stack.length < 2 || parent.tag !== close) throw new Error(`Unbalanced </${close}>`); stack.pop(); continue; }
    if (text !== undefined) { if (text.trim()) { if (parent.tag !== 'text') throw new Error('Loose text in overlay'); parent.text = (parent.text ?? '') + entity(text.trim()); } continue; }
    const attrs = {};
    for (const [, name, value] of attrText.matchAll(/([a-z][a-z0-9-]*)\s*=\s*"([^"]*)"/gi)) if (!dropped.has(name)) attrs[name] = entity(value);
    const node = { tag: open, attrs };
    (parent.children ??= []).push(node);
    if (!selfClose) stack.push(node);
  }
  if (stack.length !== 1) throw new Error('Unclosed overlay element');
  const clean = node => ({ tag: node.tag, attrs: node.attrs, ...(node.text !== undefined ? { text: node.text } : {}),
    ...(node.children?.length ? { children: node.children.map(clean) } : {}) });
  return root.children.map(clean);
}

export function pngInfo(bytes) {
  if (bytes.readUInt32BE(0) !== 0x89504e47 || bytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error('Not a PNG');
  return { sha256: createHash('sha256').update(bytes).digest('hex'), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

// Returns {solution} or {problem} for one solution file.
export function convertSolution(draft, figureBytes) {
  const overlay = draft?.overlay;
  if (!overlay) return { problem: 'no-overlay' };
  const figure = pngInfo(figureBytes);
  const box = String(overlay.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  if (box.length !== 4 || box.some(n => !Number.isFinite(n)) || box[2] <= 0 || box[3] <= 0) return { problem: 'viewbox' };
  const scale = [figure.width / box[2], figure.height / box[3]];
  const steps = draft.steps.map(step => {
    const text = (typeof step === 'string' ? step : step.text ?? '').trim();
    const key = typeof step === 'object' ? step.overlay : undefined;
    let shapes = key && overlay.steps?.[key] ? parseOverlay(overlay.steps[key]) : [];
    if (shapes.length && (box[0] || box[1] || scale[0] !== 1 || scale[1] !== 1))
      shapes = [{ tag: 'g', attrs: { transform: `scale(${+scale[0].toFixed(6)} ${+scale[1].toFixed(6)}) translate(${-box[0]} ${-box[1]})` }, children: shapes }];
    return { text, shapes };
  });
  const candidate = { version: 1, figure, keyIdea: String(draft.keyIdea ?? '').trim(), steps };
  const solution = validateWorkedSolution(candidate, [figure]);
  if (!solution) {
    const count = nodes => nodes.reduce((n, s) => n + 1 + count(s.children ?? []), 0);
    const total = steps.reduce((n, s) => n + count(s.shapes), 0);
    return { problem: steps.length > 8 ? 'too-many-steps' : total > 96 ? `too-many-shapes:${total}` : 'invalid' };
  }
  return { solution };
}

function main() {
  const { values } = parseArgs({ options: { work: { type: 'string' }, paper: { type: 'string' }, out: { type: 'string' } } });
  if (!values.work || !values.paper || !/^[a-z0-9-]+$/.test(values.paper)) throw new Error('Provide --work and --paper');
  const dir = join(values.work, values.paper), solutions = join(dir, '05-solutions'), results = {}, problems = {};
  for (const file of readdirSync(solutions).filter(name => /^q\d+\.json$/.test(name)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))) {
    const draft = JSON.parse(readFileSync(join(solutions, file), 'utf8'));
    if (!draft.overlay) continue;
    const q = file.replace('.json', ''), [, n] = String(draft.overlay.figure ?? '').match(/-fig-(\d+)$/) ?? [];
    const figurePath = n && join(dir, '03-figures', q, `fig-${n}.png`);
    if (!figurePath || !existsSync(figurePath)) { problems[q] = 'figure-missing'; continue; }
    let result;
    try { result = convertSolution(draft, readFileSync(figurePath)); }
    catch (error) { result = { problem: 'parse:' + error.message }; }
    if (result.problem) problems[q] = result.problem;
    else results[`${values.paper}-${q}`] = { figureFile: `03-figures/${q}/fig-${n}.png`, solution: result.solution };
  }
  const summary = { paper: values.paper, converted: Object.keys(results).length, problems };
  if (values.out) writeFileSync(values.out, JSON.stringify({ format: 'dmocks-worked-solutions-v1', ...summary, solutions: results }, null, 1), { mode: 0o600 });
  console.log(JSON.stringify(summary));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
