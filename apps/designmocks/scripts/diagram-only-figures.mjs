// Switches UCEED/CEED questions from the whole-question block image (which
// repeats the typed question text) to the diagram-only crops made during
// ingestion, only where nothing outside the crops would be lost. Pure-text
// questions drop the image. Everything else stays as it is and is listed.
// Re-run on the latest main whenever the papers change; it is idempotent.
//   node scripts/diagram-only-figures.mjs --work ~/dmocks-ingestion-work --media <private media root> [--apply]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

const SLACK = 1.5; // PDF points
const exportPath = new URL('../../../server/data/exports/dexam-bank-export.json', import.meta.url);

function overlapsBand(boxes, y) { return boxes.some(b => b[1] - SLACK <= y && y <= b[3] + SLACK); }

// Returns {decision: 'crop'|'text'|'keep', reasons, figures:[{file,id}]}.
export function decide(segment, figureEntry, record) {
  const reasons = [];
  const figures = figureEntry?.figures ?? [];
  const regions = segment.regions ?? [];
  const textOptions = record.type === 'NAT' || (record.options?.length > 0 && record.options.every(o => (o.text ?? '').trim()) && !segment.optionsInFigure);
  if (segment.ocr) reasons.push('scanned-page');
  if (segment.flags?.length) reasons.push('flagged');
  if (segment.vectorDrawings) reasons.push('vector-drawings');
  if (regions.length !== 1) reasons.push('several-regions');
  if (!segment.figures?.length && !figures.length) {
    if (!reasons.length && textOptions) return { decision: 'text', reasons: [], figures: [] };
    return { decision: 'keep', reasons: reasons.length ? reasons : ['no-crop'], figures: [] };
  }
  if (!figures.length) reasons.push('no-crop');
  for (const figure of figures) {
    if (figure.role !== 'figure' || figure.canonical?.source !== 'embedded' || !figure.canonical?.file) reasons.push('crop-not-embedded');
    if (regions[0] && figure.page !== regions[0].page) reasons.push('figure-off-region');
  }
  if (!reasons.length) {
    const region = regions[0].box, boxes = figures.map(f => f.box);
    const top = Math.min(...boxes.map(b => b[1])), bottom = Math.max(...boxes.map(b => b[3]));
    const edges = [...new Set([top, bottom, ...boxes.flatMap(b => [b[1], b[3]])])].sort((a, b) => a - b);
    let gap = 0;
    for (let i = 1; i < edges.length; i++) if (!overlapsBand(boxes, (edges[i - 1] + edges[i]) / 2)) gap += edges[i] - edges[i - 1];
    if (gap > SLACK) reasons.push('gap-between-figures');
    if (region[3] - bottom > SLACK && !textOptions) reasons.push('content-below-figure');
    const rows = new Map();
    for (const b of boxes) { const key = Math.round(b[1] / 10); rows.set(key, (rows.get(key) ?? 0) + 1); }
    if ([...rows.values()].some(n => n > 1)) reasons.push('side-by-side-figures');
  }
  if (reasons.length) return { decision: 'keep', reasons: [...new Set(reasons)], figures: [] };
  return { decision: 'crop', reasons: [], figures: figures.map(f => ({ id: f.id, file: f.canonical.file })) };
}

function png(bytes) {
  if (bytes.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG');
  return { sha256: createHash('sha256').update(bytes).digest('hex'), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function main() {
  const { values } = parseArgs({ options: { work: { type: 'string' }, media: { type: 'string' }, apply: { type: 'boolean' }, report: { type: 'string' } } });
  if (!values.work || !values.media) throw new Error('Provide --work and --media');
  const bank = JSON.parse(readFileSync(exportPath, 'utf8'));
  const papers = [...new Set(bank.questions.map(q => q.provenance?.paperId).filter(id => /^(uceed|ceed)-\d{4}$/.test(id ?? '')))].sort();
  const report = { crop: 0, text: 0, keep: 0, unchanged: 0, kept: {} };
  for (const paper of papers) {
    const segPath = join(values.work, paper, '02-segments/questions.json'), figPath = join(values.work, paper, '03-figures/figures.json');
    if (!existsSync(segPath) || !existsSync(figPath)) { report.kept[paper] = 'no ingestion files'; continue; }
    const segments = new Map(JSON.parse(readFileSync(segPath, 'utf8')).questions.map(q => [q.key, q]));
    const figures = new Map(JSON.parse(readFileSync(figPath, 'utf8')).questions.map(q => [q.key, q]));
    for (const record of bank.questions.filter(q => q.provenance?.paperId === paper)) {
      const key = record.externalKey.slice(paper.length + 1), segment = segments.get(key);
      if (!segment || !record.assets?.length) continue;
      if (record.assets.every(a => a.path.startsWith(`${paper}/figures/`)) || (record.display === 'text' && !record.assets.length)) { report.unchanged++; continue; }
      const result = decide(segment, figures.get(key), record);
      report[result.decision]++;
      if (result.decision === 'keep') { (report.kept[paper] ??= []).push(`${key}:${result.reasons.join('+')}`); continue; }
      if (result.decision === 'text') { record.assets = []; record.visualDependency = false; record.display = 'text'; continue; }
      record.assets = result.figures.map(({ id, file }) => {
        const source = join(values.work, paper, '03-figures', file), bytes = readFileSync(source), info = png(bytes);
        const path = `${paper}/figures/${id.replace(/^q/, `${paper}-q`)}.png`;
        if (values.apply) { const target = join(values.media, path); mkdirSync(dirname(target), { recursive: true }); copyFileSync(source, target); }
        return { role: 'figure', path, sha256: info.sha256, width: info.width, height: info.height, review: 'approved' };
      });
      record.display = 'block';
    }
  }
  if (values.apply) writeFileSync(exportPath, JSON.stringify(bank, null, 1) + '\n');
  if (values.report) writeFileSync(values.report, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ apply: Boolean(values.apply), crop: report.crop, text: report.text, keep: report.keep, unchanged: report.unchanged }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
