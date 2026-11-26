// Refreshes a private year-paper plan after question records change (for
// example new figures): keeps every explanation and marking exactly, updates
// each question's contentSha256 from the question file at --ref, and, given
// converted worked solutions, packs the animation steps into the explanation
// when the solution's figure is one of that question's own figures.
//   node scripts/refresh-year-paper-plan.mjs --plan <file> --ref origin/main [--worked <file>] [--write]
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { loadFromGit } from './question-bank-import.mjs';
import { validateFreeYearPaperPlan } from './prepare-free-year-paper.mjs';
import { encodeWorkedExplanation, hasWorkedExplanation } from '../src/worked-solution.js';

const prefix = 'dmocks:worked-solution-v1\n';
const plainText = value => hasWorkedExplanation(value) ? JSON.parse(value.slice(prefix.length)).explanation : value;

export function refreshPlan(plan, canonical, worked = {}) {
  const records = new Map(canonical.records.map(record => [record.externalKey, record]));
  let hashes = 0, packed = 0;
  const questions = plan.questions.map(item => {
    const record = records.get(item.externalKey);
    if (!record) throw new Error(`No question record for ${item.externalKey}`);
    const text = plainText(item.explanation);
    const solution = worked[item.externalKey]?.solution;
    const own = solution && (record.payload.assets ?? []).some(a => a.sha256 === solution.figure.sha256
      && a.width === solution.figure.width && a.height === solution.figure.height);
    const explanation = own ? encodeWorkedExplanation(text, solution) : text;
    if (own) packed++;
    if (item.contentSha256 !== record.contentSha256) hashes++;
    return { ...item, contentSha256: record.contentSha256, explanation };
  });
  return { plan: { ...plan, questions }, hashes, packed };
}

function main() {
  const { values } = parseArgs({ options: { plan: { type: 'string' }, ref: { type: 'string' }, worked: { type: 'string' }, write: { type: 'boolean' } } });
  if (!values.plan || !values.ref) throw new Error('Provide --plan and --ref');
  const plan = JSON.parse(readFileSync(values.plan, 'utf8')), canonical = loadFromGit(values.ref);
  const worked = values.worked ? JSON.parse(readFileSync(values.worked, 'utf8')).solutions : {};
  const result = refreshPlan(plan, canonical, worked);
  const summary = validateFreeYearPaperPlan(result.plan, canonical);
  if (values.write) {
    const backup = values.plan + '.before-diagram-only';
    if (!existsSync(backup)) copyFileSync(values.plan, backup);
    writeFileSync(values.plan, JSON.stringify(result.plan, null, 1), { mode: 0o600 });
  }
  console.log(JSON.stringify({ paper: plan.sourcePaperId, hashesUpdated: result.hashes, animated: result.packed, planSha256: summary.planSha256, written: Boolean(values.write) }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
