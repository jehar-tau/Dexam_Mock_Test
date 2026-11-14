import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { buildManifest, readBankSource } from "./question-bank-import.mjs";
import { reconcileBankState } from "./reconcile-bank-state.mjs";
import { planCanonicalMedia } from "./private-bank-media.mjs";
import { BANK_RUNTIME_SNAPSHOT_SQL, expectedRuntimeFingerprints, reconcileBankRuntime } from "./reconcile-bank-runtime.mjs";
import { openRecoveryPostgres } from "./recovery-postgres.mjs";

export const BANK_TARGET_SNAPSHOT_SQL = `
  with latest_run as (
    select id, source_commit, source_path, source_sha256, schema_version, source_total,
      eligible_total, held_total, imported_count, completed_at
    from dm_private.bank_import_runs
    where status = 'completed'
    order by completed_at desc nulls last, started_at desc, id desc
    limit 1
  ), current_items as (
    select i.external_key, i.content_sha256
    from latest_run r join dm_private.bank_import_run_items i on i.run_id = r.id
  ), records as (
    select q.external_key, q.content_sha256, q.active, i.external_key is not null as in_completed_run,
      case
        when (q.active or i.external_key is not null) and (
          h.external_key is not null or exists (
            select 1 from dm_private.reported_question_queue report
            where report.source_external_key = q.external_key and report.quarantines_bank
              and report.status in ('pending', 'retired')
          )
        ) then 'quarantined'
        when not q.active then 'retired'
        when q.runtime_payload is not null and q.owner_approved and q.rights_confirmed then 'ready'
        else 'review'
      end as state
    from dm_private.bank_questions q
    left join current_items i on i.external_key = q.external_key and i.content_sha256 = q.content_sha256
    left join dm_private.bank_local_holds h on h.external_key = q.external_key
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'importInProgress', exists (select 1 from dm_private.bank_import_runs where status = 'importing'),
    'latestCompletedRun', (
      select jsonb_build_object('sourceCommit', r.source_commit, 'sourcePath', r.source_path,
        'sourceSha256', r.source_sha256, 'schemaVersion', r.schema_version, 'sourceTotal', r.source_total,
        'eligibleTotal', r.eligible_total, 'heldTotal', r.held_total, 'importedCount', r.imported_count,
        'completedAt', r.completed_at, 'itemsTotal', (select count(*) from current_items))
      from latest_run r
    ),
    'records', (
      select coalesce(jsonb_agg(jsonb_build_object('externalKey', q.external_key,
        'contentSha256', q.content_sha256, 'state', q.state, 'active', q.active,
        'inCompletedRun', q.in_completed_run) order by q.external_key), '[]'::jsonb)
      from records q
    )
  )`;

export function reconcileBankTarget({ canonical, sourceCommit, snapshot, cloudboard = null }) {
  const manifest = buildManifest(canonical, sourceCommit);
  const report = reconcileBankState(canonical, snapshot, cloudboard);
  if (typeof snapshot.importInProgress !== "boolean" ||
      !snapshot.records.every(row => typeof row.active === "boolean" && typeof row.inCompletedRun === "boolean") ||
      !Object.hasOwn(snapshot, "latestCompletedRun")) {
    throw new Error("Invalid DMocks bank target snapshot");
  }

  const eligible = new Set(manifest.records.map(record => record.externalKey));
  const outsideCompletedImport = [];
  const outsideCanonicalActive = [];
  for (const row of snapshot.records) {
    const expected = eligible.has(row.externalKey);
    if (expected && !row.inCompletedRun) outsideCompletedImport.push(row.externalKey);
    if (!expected && row.active) outsideCanonicalActive.push(row.externalKey);
  }
  const run = snapshot.latestCompletedRun;
  const importIssues = [];
  if (snapshot.importInProgress) importIssues.push("import-in-progress");
  if (!run) {
    importIssues.push("no-completed-import");
  } else {
    if (run.sourceSha256 !== manifest.sourceSha256 || run.sourcePath !== manifest.sourcePath ||
        run.schemaVersion !== manifest.schemaVersion || !run.completedAt) importIssues.push("completed-source-mismatch");
    if (run.sourceTotal !== manifest.sourceTotal || run.eligibleTotal !== manifest.eligibleTotal ||
        run.heldTotal !== manifest.heldTotal || run.importedCount !== manifest.eligibleTotal ||
        run.itemsTotal !== manifest.eligibleTotal) importIssues.push("completed-counts-mismatch");
  }
  const issues = { ...report.issues, outsideCompletedImport: outsideCompletedImport.sort(),
    outsideCanonicalActive: outsideCanonicalActive.sort() };
  const issueCounts = Object.fromEntries(Object.entries(issues).map(([key, values]) => [key, values.length]));
  return {
    ...report, scope: "dmocks-canonical-target", sourceCommit, sourceSha256: manifest.sourceSha256,
    latestCompletedRun: run, importInProgress: snapshot.importInProgress, importIssues, issueCounts, issues,
    passed: importIssues.length === 0 && Object.values(issueCounts).every(count => count === 0),
  };
}

async function main() {
  const { values } = parseArgs({ options: {
    "expect-source": { type: "string" },
    "approved-hosted": { type: "boolean" },
    cloudboard: { type: "string" },
    "runtime-media-root": { type: "string" },
  } });
  const expected = values["expect-source"];
  if (!/^[a-f0-9]{40}$/.test(expected ?? "")) throw new Error("Use --expect-source with the reviewed full origin/main commit");
  const { sourceCommit, bank } = readBankSource("origin/main", process.cwd());
  if (sourceCommit !== expected) throw new Error("origin/main does not match the reviewed bank commit");
  const cloudboard = values.cloudboard ? JSON.parse(await readFile(values.cloudboard, "utf8")) : null;
  let runtimeEvidence;
  if (values["runtime-media-root"]) {
    const manifest = buildManifest(bank, sourceCommit);
    const media = await planCanonicalMedia(manifest, values["runtime-media-root"]);
    const local = await openRecoveryPostgres(
      values["approved-hosted"] ? process.env.DMOCKS_BANK_HASH_DATABASE_URL : process.env.DMOCKS_BANK_AUDIT_DATABASE_URL,
      { localOnly: true },
    );
    try {
      runtimeEvidence = { manifest, expected: await expectedRuntimeFingerprints(manifest, media.assets, local) };
    } finally {
      await local.close();
    }
  }
  const connection = await openRecoveryPostgres(process.env.DMOCKS_BANK_AUDIT_DATABASE_URL, {
    localOnly: !values["approved-hosted"],
    databaseCaFile: process.env.DMOCKS_BANK_AUDIT_DATABASE_CA_FILE,
  });
  try {
    const snapshot = JSON.parse(await connection.query(BANK_TARGET_SNAPSHOT_SQL));
    const result = reconcileBankTarget({ canonical: bank, sourceCommit, snapshot, cloudboard });
    if (runtimeEvidence) {
      const runtimeSnapshot = JSON.parse(await connection.query(BANK_RUNTIME_SNAPSHOT_SQL));
      result.runtime = reconcileBankRuntime(runtimeEvidence.manifest, snapshot.records, runtimeEvidence.expected, runtimeSnapshot);
      result.passed = result.passed && result.runtime.passed;
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.passed) process.exitCode = 2;
  } finally {
    await connection.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
