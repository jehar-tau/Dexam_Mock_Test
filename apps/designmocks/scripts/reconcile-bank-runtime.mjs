import { compileRuntimeManifest } from "./materialize-bank-runtime.mjs";

const digestSql = payload => `encode(sha256(convert_to((${payload})::text, 'UTF8')), 'hex')`;
const digest = /^[a-f0-9]{64}$/;

// Output is deliberately limited to identifiers, fingerprints and decision flags.
export const BANK_RUNTIME_SNAPSHOT_SQL = `
  with runtimes as (
    select q.external_key, q.runtime_payload, q.objective_ready, q.exam,
      case when q.exam = 'nid' then
        dm_private.nid_practice_runtime(q, dm_private.nid_binding_state(q))
      end as authored
    from dm_private.bank_questions q
    where q.active and q.payload->'holds' = '[]'::jsonb
      and not exists (
        select 1 from dm_private.bank_local_holds h where h.external_key = q.external_key
      )
      and not exists (
        select 1 from dm_private.reported_question_queue r
        where r.source_external_key = q.external_key and r.quarantines_bank
          and r.status in ('pending', 'retired')
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'externalKey', external_key, 'exam', exam,
    'runtimeSha256', ${digestSql("runtime_payload")},
    'objectiveReady', objective_ready,
    'authoredStatus', case when exam = 'nid' then
      case
        when authored is null and runtime_payload is null then 'unbound'
        when authored is null then 'unexpected'
        when runtime_payload is null then 'missing'
        when runtime_payload is distinct from authored then 'mismatch'
        when objective_ready is distinct from (authored->>'kind' <> 'drawing') then 'mismatch'
        else 'matched'
      end
    end
  ) order by external_key), '[]'::jsonb) from runtimes
`;

// Calculate comparable JSONB fingerprints on loopback PostgreSQL. The hosted
// connection never receives compiled payloads (including prompts and keys).
export async function expectedRuntimeFingerprints(manifest, assets, localConnection) {
  const media = assets.map(asset => ({ ...asset, path: asset.storagePath }));
  const { records } = compileRuntimeManifest(manifest, media);
  const fingerprints = new Map();
  for (let offset = 0; offset < records.length; offset += 100) {
    const batch = records.slice(offset, offset + 100).filter(record => record.exam !== "nid");
    if (batch.length === 0) continue;
    const data = JSON.stringify(batch.map(record => [record.externalKey, record.runtime]));
    const literal = "E'" + data.replaceAll("\\", "\\\\").replaceAll("'", "''") + "'";
    const rows = JSON.parse(await localConnection.query(`
      select jsonb_object_agg(item->>0, ${digestSql("nullif(item->1, 'null'::jsonb)")})
      from jsonb_array_elements(${literal}::jsonb) item
    `));
    for (const record of batch) {
      fingerprints.set(record.externalKey, {
        sha256: rows[record.externalKey],
        objectiveReady: record.runtime !== null && record.runtime.kind !== "drawing",
      });
    }
  }
  return fingerprints;
}

export function reconcileBankRuntime(manifest, targetRecords, expectedFingerprints, snapshot) {
  if (!Array.isArray(snapshot)) throw new Error("Invalid DMocks runtime snapshot");
  const targetByKey = new Map(targetRecords.map(row => [row.externalKey, row]));
  const manifestByKey = new Map(manifest.records.map(row => [row.externalKey, row]));
  const observed = new Set();
  const issues = { missingEvidence: [], missing: [], unexpected: [], mismatch: [] };
  const counts = { matched: 0, unavailable: 0, unbound: 0 };
  for (const row of snapshot) {
    if (typeof row?.externalKey !== "string" || observed.has(row.externalKey) ||
        !(row.runtimeSha256 === null || typeof row.runtimeSha256 === "string" && digest.test(row.runtimeSha256)) ||
        typeof row.objectiveReady !== "boolean") {
      throw new Error("Invalid DMocks runtime snapshot");
    }
    observed.add(row.externalKey);
    const canonical = manifestByKey.get(row.externalKey);
    if (!canonical) continue; // The canonical audit separately rejects active out-of-bank records.
    if (row.exam !== canonical.exam) {
      issues.mismatch.push(row.externalKey);
      continue;
    }
    let outcome;
    if (row.exam === "nid") {
      if (!["matched", "unbound", "unexpected", "missing", "mismatch"].includes(row.authoredStatus)) {
        throw new Error("Invalid DMocks authored runtime status");
      }
      outcome = row.authoredStatus;
      if (outcome === "unbound" && row.objectiveReady) outcome = "mismatch";
    } else {
      const expected = expectedFingerprints.get(row.externalKey);
      if (!expected) throw new Error("Incomplete local runtime fingerprints");
      if (expected.sha256 === null && row.runtimeSha256 !== null) outcome = "unexpected";
      else if (expected.sha256 !== null && row.runtimeSha256 === null) outcome = "missing";
      else if (expected.sha256 !== row.runtimeSha256 || expected.objectiveReady !== row.objectiveReady) outcome = "mismatch";
      else outcome = expected.sha256 === null ? "unavailable" : "matched";
    }
    if (Object.hasOwn(counts, outcome)) counts[outcome]++;
    else if (Object.hasOwn(issues, outcome)) issues[outcome].push(row.externalKey);
    else throw new Error("Invalid DMocks runtime status");
  }
  for (const record of manifest.records) {
    const row = targetByKey.get(record.externalKey);
    if (row?.active && row.state !== "quarantined" && !observed.has(record.externalKey)) {
      issues.missingEvidence.push(record.externalKey);
    }
  }
  for (const keys of Object.values(issues)) keys.sort();
  const issueCounts = Object.fromEntries(Object.entries(issues).map(([name, keys]) => [name, keys.length]));
  return { counts, issueCounts, issues, passed: Object.values(issueCounts).every(count => count === 0) };
}
