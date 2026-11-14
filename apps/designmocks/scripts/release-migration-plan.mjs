#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runPreflight } from './release-source-preflight.mjs';
import { readPreUpgradeLedger } from './private-recovery.mjs';
import { stableJson } from './question-bank-import.mjs';

const backend = 'apps/designmocks/supabase/';
const migrationDirectory = `${backend}migrations/`;
const sha256 = value => createHash('sha256').update(value).digest('hex');

function reviewedMigrations(files) {
  const migrations = files.filter(file => file.path.startsWith(migrationDirectory)).map(file => {
    const filename = file.path.slice(migrationDirectory.length);
    const match = /^(\d{12})_[a-z0-9_]+\.sql$/.exec(filename);
    if (!match) throw new Error('Invalid filename in the reviewed migration inventory');
    return { version: match[1], filename, sha256: file.sha256 };
  });
  if (new Set(migrations.map(migration => migration.version)).size !== migrations.length) {
    throw new Error('Duplicate migration version in the reviewed source');
  }
  return migrations;
}

function verifiedTarget(target, projectRef, localRehearsal) {
  if (localRehearsal) {
    if (target?.kind !== 'local' || !['127.0.0.1', 'localhost', '::1'].includes(target.host)
      || !Number.isInteger(target.port) || target.port < 1 || target.port > 65_535) {
      throw new Error('Expected a local Supabase rehearsal on loopback');
    }
    return { kind: 'local', host: target.host, port: target.port };
  }
  if (target?.kind !== 'linked' || target.project_ref !== projectRef
    || !['branch', 'production'].includes(target.environment)) {
    throw new Error('Supabase dry run must name the reviewed hosted project and environment');
  }
  return { kind: 'linked', projectRef, environment: target.environment };
}

function readHostedTextDryRun(text) {
  const lines = text.trimEnd().split(/\r?\n/);
  const completion = lines.shift();
  const target = /^Target: project [^\r\n]+ \(([a-z0-9]{20})\) · (production|branch)$/.exec(lines.shift() ?? '');
  if (lines[0] === 'Initialising login role...') lines.shift();
  const banner = lines.shift();
  const listing = lines.shift();
  if (!target || completion !== 'Finished supabase db push.' || banner !== 'DRY RUN: migrations will *not* be pushed to the database.'
    || listing !== 'Would push these migrations:' || !lines.length || !lines.every(line => /^ • \d{12}_[a-z0-9_]+\.sql$/.test(line))) {
    throw new Error('Expected complete hosted Supabase 3.1 dry-run stdout followed by stderr, with migrations only');
  }
  return {dryRun: true, upToDate: false, message: completion, seeds: [], roles: [],
    target: {kind: 'linked', project_ref: target[1], environment: target[2]}, migrations: lines.map(line => line.slice(3))};
}

async function verifyDryRun(logPath, pending, projectRef, localRehearsal, hostedText) {
  const info = await lstat(logPath);
  if (!info.isFile() || info.size > 65_536) throw new Error('Use a complete Supabase dry-run transcript file');
  const transcript = await readFile(logPath);
  let report;
  try {
    report = hostedText ? readHostedTextDryRun(transcript.toString('utf8')) : JSON.parse(transcript.toString('utf8'));
  } catch (error) {
    if (hostedText) throw error;
    throw new Error('Expected JSON stdout from the Supabase dry run');
  }
  const upToDate = pending.length === 0;
  const database = localRehearsal ? 'Local' : 'Remote';
  const message = upToDate ? `${database} database is up to date.` : 'Finished supabase db push.';
  if (report?.dryRun !== true || report.upToDate !== upToDate || report.message !== message
    || !Array.isArray(report.seeds) || report.seeds.length || !Array.isArray(report.roles) || report.roles.length) {
    throw new Error('Expected a completed Supabase dry run without seed or role operations');
  }
  const target = verifiedTarget(report.target, projectRef, localRehearsal);
  const reported = report.migrations;
  if (!Array.isArray(reported) || reported.length !== pending.length
    || !pending.every(({ filename }, index) => reported[index] === filename)) {
    throw new Error('Supabase dry run differs from the reviewed pending migrations');
  }
  return { target, sha256: sha256(transcript) };
}

export async function planMigrationRollout({ cwd = process.cwd(), commit, tree, ledgerPath, dryRunLog, localRehearsal = false, hostedText = false }) {
  if (localRehearsal && !dryRunLog) throw new Error('A local rehearsal requires its dry-run JSON');
  if (hostedText && (!dryRunLog || localRehearsal)) throw new Error('Hosted text requires a hosted dry-run transcript');
  const source = await runPreflight({ cwd, commit, tree });
  const migrations = reviewedMigrations(source.inventory.files);
  const ledger = await readPreUpgradeLedger(ledgerPath, source.head, migrations.map(migration => migration.version));
  const projectFile = await readFile(path.join(cwd, 'supabase/project.json'));
  const reviewedProject = source.inventory.files.find(file => file.path === `${backend}project.json`);
  if (sha256(projectFile) !== reviewedProject.sha256 || JSON.parse(projectFile).project_ref !== ledger.projectRef) {
    throw new Error('Run from the reviewed DMocks app directory with the matching project');
  }
  const installed = new Set(ledger.migrationVersions);
  const pending = migrations.filter(migration => !installed.has(migration.version));
  const verified = dryRunLog ? await verifyDryRun(dryRunLog, pending, ledger.projectRef, localRehearsal, hostedText) : null;

  return {
    passed: true,
    scope: 'migration-plan-only',
    commit: source.head,
    tree: source.tree,
    projectRef: ledger.projectRef,
    backendInventorySha256: source.inventory.sha256,
    reviewedLedgerSha256: sha256(stableJson(ledger)),
    installedVersions: ledger.migrationVersions,
    pendingMigrations: pending,
    dryRunVerified: verified !== null,
    dryRunTarget: verified?.target ?? null,
    dryRunTranscriptSha256: verified?.sha256 ?? null,
    ...(hostedText ? {dryRunTranscriptFormat: 'supabase-3.1-hosted-text'} : {}),
  };
}

function argumentsFor(args) {
  const flags = new Map([
    ['--commit', 'commit'], ['--tree', 'tree'], ['--ledger', 'ledgerPath'], ['--dry-run-log', 'dryRunLog'],
  ]);
  const values = {};
  const usage = 'Usage: node scripts/release-migration-plan.mjs --commit <sha> --tree <sha> --ledger <json> [--dry-run-log <file> [--local-rehearsal | --hosted-text]]';
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--local-rehearsal' && !values.localRehearsal) {
      values.localRehearsal = true;
      continue;
    }
    if (args[index] === '--hosted-text' && !values.hostedText) {
      values.hostedText = true;
      continue;
    }
    const name = flags.get(args[index]);
    const value = args[index + 1];
    if (!name || values[name] || !value || value.startsWith('--')) throw new Error(usage);
    values[name] = value;
    index += 1;
  }
  if (!values.commit || !values.tree || !values.ledgerPath) throw new Error(usage);
  return values;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const plan = await planMigrationRollout(argumentsFor(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`migration plan failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
