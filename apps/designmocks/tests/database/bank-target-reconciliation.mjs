import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BANK_TARGET_SNAPSHOT_SQL } from '../../scripts/reconcile-bank-target.mjs';
import { BANK_RUNTIME_SNAPSHOT_SQL } from '../../scripts/reconcile-bank-runtime.mjs';
import { compileRuntimeManifest } from '../../scripts/materialize-bank-runtime.mjs';
import { buildManifest, SOURCE_PATH } from '../../scripts/question-bank-import.mjs';

const url = process.env.DESIGNMOCKS_TEST_DATABASE_URL;
const address = new URL(url ?? 'invalid:');
assert.ok(
  ['postgres:', 'postgresql:'].includes(address.protocol)
    && ['localhost', '127.0.0.1', '[::1]'].includes(address.hostname)
    && !address.search && !address.hash && address.pathname.length > 1,
  'Bank reconciliation fixture requires a disposable loopback database URL',
);

const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')));
const connection = {
  ...environment,
  PGHOST: address.hostname.replace(/^\[|\]$/g, ''),
  PGPORT: address.port || '5432',
  PGDATABASE: decodeURIComponent(address.pathname.slice(1)),
  PGUSER: decodeURIComponent(address.username) || process.env.USER,
  PGPASSWORD: decodeURIComponent(address.password),
  PGCONNECT_TIMEOUT: '5',
};
// Recovery's CLI requires explicit credentials even when local PostgreSQL uses trust.
const auditAddress = new URL(address);
auditAddress.username ||= connection.PGUSER;
auditAddress.password ||= 'fixture-trust';
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => quote(JSON.stringify(value)) + '::jsonb';
const runSql = input => spawnSync('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate'], {
  input, env: connection, encoding: 'utf8', timeout: 20_000,
});
function sql(input) {
  const result = runSql(input);
  assert.equal(result.status, 0, 'Disposable bank fixture SQL failed: ' + (result.stderr.match(/ERROR:\s+([A-Z0-9]{5})/)?.[1] ?? 'unknown'));
  return result.stdout.trim();
}
const fingerprint = () => sql(`
  select md5(jsonb_build_object(
    'runs', (select jsonb_agg(to_jsonb(r) order by id) from dm_private.bank_import_runs r),
    'items', (select jsonb_agg(to_jsonb(i) order by run_id, external_key) from dm_private.bank_import_run_items i),
    'questions', (select jsonb_agg(to_jsonb(q) order by external_key) from dm_private.bank_questions q),
    'holds', (select jsonb_agg(to_jsonb(h) order by external_key) from dm_private.bank_local_holds h),
    'reports', (select jsonb_agg(to_jsonb(r) order by target_key) from dm_private.reported_question_queue r)
  )::text);
`);

assert.equal(sql(`
  select not exists (select from dm_private.bank_questions)
     and not exists (select from dm_private.bank_import_runs);
`), 't', 'Bank fixture requires an empty, migrated disposable bank');

const cwd = mkdtempSync(join(tmpdir(), 'dmocks-bank-reconciliation-'));
const cli = fileURLToPath(new URL('../../scripts/reconcile-bank-target.mjs', import.meta.url));
const keyPrefix = 'fixture-' + randomUUID();
const actor = randomUUID();
const key = suffix => keyPrefix + '-' + suffix;
const question = (suffix, holds = []) => ({
  externalKey: key(suffix),
  prompt: "Fictional bank fixture's \\ figure: Δ.",
  ...(suffix === 'ready' && {
    answer: { raw: 'B' },
    options: ['A', 'B', 'C', 'D'].map(key => ({ key, text: key })),
  }),
  provenance: { exam: 'uceed' },
  type: 'MCQ',
  holds,
});
const bank = {
  schemaVersion: 1,
  questions: [question('ready'), question('review'), question('quarantine'), question('threshold'), question('held', ['fixture-review'])],
};
const sourceFile = join(cwd, SOURCE_PATH);
const cloudboardFile = join(cwd, 'cloudboard.json');

function git(...args) {
  const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd, encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.status, 0, 'Fictional source Git command failed: ' + args[0]);
  return result.stdout.trim();
}

function runCli(source, args = [], databaseUrl = auditAddress.href) {
  return spawnSync(process.execPath, [cli, '--expect-source', source, ...args], {
    cwd,
    env: { ...environment, DMOCKS_BANK_AUDIT_DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    timeout: 25_000,
  });
}
function report(source, status, args = []) {
  const result = runCli(source, args);
  assert.equal(result.status, status, 'Bank reconciliation CLI returned an unexpected status');
  assert.equal(result.stdout.includes(bank.questions[0].prompt), false, 'Report exposed fixture payload');
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.passed, status === 0);
  return parsed;
}

const emptyFingerprint = fingerprint();
let fixtureSource;
let fixtureOtherSource;
try {
  mkdirSync(dirname(sourceFile), { recursive: true });
  writeFileSync(sourceFile, JSON.stringify(bank));
  git('init', '--quiet');
  git('add', SOURCE_PATH);
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgSign=false', 'commit', '--quiet', '-m', 'Fictional bank source');
  const source = git('rev-parse', 'HEAD');
  fixtureSource = source;
  git('update-ref', 'refs/remotes/origin/main', source);
  const manifest = buildManifest(bank, source);
  const otherCommit = source[0] === 'a' ? 'b'.repeat(40) : 'a'.repeat(40);
  fixtureOtherSource = otherCommit;
  const otherSha = manifest.sourceSha256[0] === 'a' ? 'b'.repeat(64) : 'a'.repeat(64);

  assert.equal(runCli(otherCommit, [], 'invalid:').status, 1, 'Source mismatch must precede database access');
  assert.equal(runCli('invalid', [], 'invalid:').status, 1);
  const empty = report(source, 2);
  assert.ok(empty.importIssues.includes('no-completed-import'));
  assert.equal(fingerprint(), emptyFingerprint);

  sql(`
    begin;
    set local role service_role;
    select set_config('request.jwt.claim.role','service_role',true);
    select public.begin_question_bank_import(
      ${quote(source)}, ${quote(SOURCE_PATH)}, ${quote(manifest.sourceSha256)}, 1, 5, 4, 1
    ) as fixture_run \\gset
    select public.import_question_bank_batch(:'fixture_run', ${json(manifest.records)});
    select public.finish_question_bank_import(:'fixture_run');
    commit;
  `);
  const runtime = compileRuntimeManifest(manifest, []).records.find(record => record.externalKey === key('ready')).runtime;
  assert.equal(runtime?.kind, 'mcq');
  sql(`
    begin;
    insert into auth.users(id) values (${quote(actor)});
    insert into dm_private.bank_local_holds(external_key, reason, created_by)
      values (${quote(key('quarantine'))}, 'Fictional quality hold', ${quote(actor)});
    insert into dm_private.reported_question_queue(
      target_key, source_external_key, representative_question_id, report_count,
      identity_key, quarantines_bank, source_content_sha256
    ) values (
      ${quote(key('report'))}, ${quote(key('threshold'))}, gen_random_uuid(), 3,
      ${quote(key('threshold'))}, true, ${quote(manifest.records[3].contentSha256)}
    );
    update dm_private.bank_questions set active=false
      where external_key in (${quote(key('quarantine'))}, ${quote(key('threshold'))});
    update dm_private.bank_questions set runtime_payload=${json(runtime)}, objective_ready=true where external_key=${quote(key('ready'))};
    update dm_private.bank_questions set owner_approved=true, rights_confirmed=true where external_key=${quote(key('ready'))};
    commit;
  `);

  const before = fingerprint();
  const sourceBytes = readFileSync(sourceFile);
  const ready = manifest.records[0];
  writeFileSync(cloudboardFile, JSON.stringify({
    schemaVersion: 1,
    records: [{ sourceId: 'fixture-manual-1', externalKey: ready.externalKey, contentSha256: ready.contentSha256 }],
  }));
  const clean = report(source, 0, ['--cloudboard', cloudboardFile]);
  assert.equal(clean.schemaVersion, 1);
  assert.equal(clean.sourceCommit, source);
  assert.equal(clean.sourceSha256, manifest.sourceSha256);
  assert.equal(clean.cloudboardTotal, 1);
  assert.equal(clean.latestCompletedRun.sourceCommit, source);
  assert.equal(clean.latestCompletedRun.sourceSha256, manifest.sourceSha256);
  assert.equal(clean.latestCompletedRun.itemsTotal, manifest.eligibleTotal);
  assert.deepEqual(clean.stateCounts, { ready: 1, review: 1, quarantined: 2, retired: 0 });
  assert.deepEqual(clean.importIssues, []);
  assert.equal(fingerprint(), before);
  assert.deepEqual(readFileSync(sourceFile), sourceBytes);
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
  assert.equal(git('rev-parse', 'refs/remotes/origin/main'), source);

  const runtimeArgs = ['--runtime-media-root', cwd];
  const runtimeCheck = report(source, 0, runtimeArgs);
  assert.deepEqual(runtimeCheck.runtime.counts, { matched: 1, unavailable: 1, unbound: 0 });
  assert.equal(runtimeCheck.runtime.passed, true);
  assert.equal(fingerprint(), before);
  sql(`
    update dm_private.bank_questions
    set runtime_payload=jsonb_set(runtime_payload, '{key,correct}', '["A"]')
    where external_key=${quote(key('ready'))};
  `);
  const runtimeDrift = report(source, 2, runtimeArgs);
  assert.deepEqual(runtimeDrift.runtime.issues.mismatch, [key('ready')]);
  assert.deepEqual(runtimeDrift.importIssues, []);

  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const snapshotSql of [BANK_TARGET_SNAPSHOT_SQL, BANK_RUNTIME_SNAPSHOT_SQL]) {
      const denied = runSql(`set role ${role};\n${snapshotSql}`);
      assert.notEqual(denied.status, 0, role + ' could read the private snapshot');
      assert.match(denied.stderr, /42501/, role + ' must receive a permission error');
      assert.equal(denied.stdout.trim(), '');
    }
  }

  sql(`
    insert into dm_private.bank_import_runs(
      source_commit, source_path, source_sha256, schema_version, source_total, eligible_total, held_total
    ) values (${quote(otherCommit)}, ${quote(SOURCE_PATH)}, ${quote(otherSha)}, 1, 0, 0, 0);
  `);
  const duringImport = report(source, 2);
  assert.ok(duringImport.importIssues.includes('import-in-progress'), 'An ongoing import must invalidate reconciliation');

  sql(`
    update dm_private.bank_import_runs set status='completed', completed_at=now()
      where source_commit=${quote(otherCommit)};
  `);
  const mismatch = report(source, 2);
  assert.ok(mismatch.importIssues.includes('completed-source-mismatch'), 'The latest completed import must match the source');
  assert.ok(mismatch.importIssues.includes('completed-counts-mismatch'));
  assert.deepEqual(mismatch.issues.outsideCompletedImport, manifest.records.map(record => record.externalKey).sort());

  sql(`
    delete from dm_private.bank_import_runs where source_commit=${quote(otherCommit)};
    update dm_private.bank_questions set active=false where external_key=${quote(key('review'))};
    insert into dm_private.bank_questions(external_key, content_sha256, exam, question_type, topic, licence, payload, source_commit)
      values (${quote(key('outside'))}, repeat('c',64), 'uceed', 'MCQ', 'fixture', 'fixture', '{"holds":[]}', ${quote(source)});
  `);
  const driftBefore = fingerprint();
  const drift = report(source, 2);
  assert.deepEqual(drift.issues.missing, [key('review')]);
  assert.deepEqual(drift.issues.outsideCanonicalActive, [key('outside')]);
  assert.equal(drift.stateCounts.retired, 1);
  assert.equal(fingerprint(), driftBefore);
} finally {
  try {
    sql(`
      begin;
      delete from dm_private.bank_import_runs where source_commit in (${quote(fixtureSource)}, ${quote(fixtureOtherSource)});
      delete from dm_private.reported_question_queue where target_key=${quote(key('report'))};
      delete from dm_private.bank_questions where external_key like ${quote(keyPrefix + '-%')};
      delete from auth.users where id=${quote(actor)};
      commit;
    `);
    assert.equal(fingerprint(), emptyFingerprint);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

console.log('PASS: read-only bank target reconciliation against a disposable PostgreSQL database.');
