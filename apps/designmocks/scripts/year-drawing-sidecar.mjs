import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { loadFromGit, SOURCE_PATH, sha256, stableJson } from './question-bank-import.mjs';
import { recoveryPostgresEnvironment } from './recovery-postgres.mjs';

const fingerprint = /^[a-f0-9]{64}$/;
const positive = value => Number.isFinite(value) && value > 0;

// Claude's Python-authored drawing hash preserves numeric literals (20.0 vs 20).
// Read the same Git blob without a JavaScript JSON round trip, retaining the
// existing JS importer digest separately for checking the private bank row.
export function drawingSourceDigests(commit) {
  const blob = execFileSync('git',['show',commit + ':' + SOURCE_PATH],{maxBuffer:64 * 1024 * 1024});
  const code = [
    'import hashlib,json,sys',
    'records=json.load(sys.stdin)["questions"]',
    'def fingerprint(q): return hashlib.sha256(json.dumps(q, ensure_ascii=False, sort_keys=True, separators=(",",":")).encode()).hexdigest()',
    'print(json.dumps({q["externalKey"]:fingerprint(q) for q in records if q["type"]=="DESCRIPTIVE"}))'
  ].join('\n');
  return JSON.parse(execFileSync('python3',['-c',code],{input:blob,encoding:'utf8'}));
}

export function validateDrawingSidecar(plan, canonical, sourceDigests) {
  assert.equal(plan.format, 'dmocks-year-paper-drawing-v1');
  assert.match(plan.sourcePaperId, /^[a-z0-9-]{4,100}$/);
  assert.equal(plan.objectivePlan, plan.sourcePaperId + '-year-paper.plan.json');
  assert.ok(Array.isArray(plan.tasks) && plan.tasks.length >= 1 && plan.tasks.length <= 40, 'Expected drawing tasks');
  const unique = values => new Set(values).size === values.length;
  assert.ok(unique(plan.tasks.map(t => t.externalKey)), 'Repeated drawing task');
  const group = canonical.records.filter(r => r.payload.provenance.paperId === plan.sourcePaperId && r.type === 'DESCRIPTIVE');
  assert.equal(group.length, plan.tasks.length, 'Drawing tasks must cover the complete eligible source group');
  const items = plan.tasks.map(task => {
    const record = group.find(r => r.externalKey === task.externalKey);
    assert.ok(record && record.exam === plan.exam && Number(record.payload.provenance.year) === plan.year, 'Drawing source changed: ' + task.externalKey);
    assert.equal(task.contentSha256, sourceDigests[task.externalKey], 'Drawing content changed: ' + task.externalKey);
    assert.equal(task.kind, 'drawing');
    assert.equal(task.marking.max, record.payload.taskMarks);
    const d = task.drawing;
    assert.ok(Number.isInteger(d.maxImages) && d.maxImages >= 1 && d.maxImages <= 5);
    assert.ok(['printed','printed-equal-split','inferred'].includes(d.criteriaSource));
    assert.ok(Array.isArray(d.criteria) && d.criteria.length && unique(d.criteria.map(c => c.id)));
    assert.ok(d.criteria.every(c => typeof c.id === 'string' && c.id && typeof c.label === 'string' && c.label && positive(c.max)));
    assert.ok(Math.abs(d.criteria.reduce((sum,c) => sum+c.max,0) - task.marking.max) < 0.001, 'Criterion marks differ from task marks');
    assert.ok(Array.isArray(d.instructions) && d.instructions.every(line => typeof line === 'string'));
    for (const asset of record.payload.assets) assert.match(asset.sha256, fingerprint);
    return { externalKey:task.externalKey, contentSha256:record.contentSha256, drawingSourceSha256:task.contentSha256, prompt:record.payload.prompt, topic:record.topic,
      explanation:record.payload.explanation, assets:record.payload.assets, marking:task.marking, drawing:d };
  });
  const sectionKeys = plan.sections.flatMap(s => s.questionKeys ?? []);
  assert.ok(plan.tasks.every(t => sectionKeys.includes(t.externalKey)) && sectionKeys.every(k => plan.tasks.some(t => t.externalKey === k)), 'Unknown or ungrouped drawing task');
  assert.equal(plan.uploadGraceSeconds, 600);
  const supported = plan.timer === 'shared' && !plan.sections.some(s => s.chooseOne) && !items.some(i=>i.drawing.alternatives?.length);
  if (supported) {
    assert.equal(plan.durationSeconds, 10800);
    assert.equal(items.reduce((sum,i)=>sum+i.marking.max,0),plan.drawingMarksTotal);
  }
  return { digest:sha256(stableJson(plan)), sourcePaperId:plan.sourcePaperId, sourceCommit:canonical.sourceCommit, exam:plan.exam,
    year:plan.year, supported, durationSeconds:plan.durationSeconds, uploadGraceSeconds:plan.uploadGraceSeconds,
    drawingMarksTotal:plan.drawingMarksTotal, sections:plan.sections, items };
}

async function main() {
  const {values} = parseArgs({options:{plan:{type:'string'},expect:{type:'string'},'review-manifest':{type:'string'},apply:{type:'boolean'}}});
  const source=loadFromGit('origin/main');
  const doc=validateDrawingSidecar(JSON.parse(await readFile(values.plan,'utf8')),source,drawingSourceDigests(source.sourceCommit));
  const summary={paper:doc.sourcePaperId, drawingTasks:doc.items.length, digest:doc.digest, supported:doc.supported};
  if (!values.apply) { console.log(JSON.stringify(summary)); return; }
  assert.ok(doc.supported,'Separate-session or choose-one plan requires its dedicated runtime');
  assert.equal(values.expect,doc.digest,'Private drawing plan digest differs');
  assert.match(values['review-manifest'] ?? '',fingerprint,'Released objective manifest required');
  const env=recoveryPostgresEnvironment(process.env.DMOCKS_RECOVERY_DATABASE_URL,{databaseCaFile:process.env.DMOCKS_RECOVERY_DATABASE_CA_FILE});
  // Pass source data through stdin only. The document never enters argv, logs or Git.
  const serialized=JSON.stringify(doc).replaceAll("'","''");
  const input="set standard_conforming_strings=on; select dm_private.install_year_drawing_sidecar('" + serialized + "'::jsonb,'" + values['review-manifest'] + "');";
  try {
    const version=execFileSync('psql',['-XqAt','-v','ON_ERROR_STOP=1'],{input,env,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
    console.log(JSON.stringify({...summary,version}));
  } catch (error) { throw Error(error.stderr?.split('\n').find(line=>line.startsWith('ERROR:')) ?? 'Private drawing installation failed'); }
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(e=>{console.error(e.message);process.exitCode=1;});
