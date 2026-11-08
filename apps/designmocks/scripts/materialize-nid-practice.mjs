import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { loadFromGit, sha256, stableJson } from './question-bank-import.mjs';
import { nidPracticeRuntime } from './nid-practice-runtime.mjs';

export function compileNidPracticePlan(manifest, bindings, mediaCatalog) {
  assert.ok(Array.isArray(bindings) && Array.isArray(mediaCatalog), 'Private binding and verified media catalogues required');
  assert.equal(new Set(bindings.map(row => row.externalKey)).size, bindings.length, 'Duplicate practice binding key');
  assert.equal(new Set(mediaCatalog.map(row => row.sha256)).size, mediaCatalog.length, 'Duplicate private media digest');
  const source = new Map(manifest.records.filter(row => row.exam === 'nid').map(row => [row.externalKey, row]));
  const records = [], unavailable = [], outsideCanonical = [];
  for (const row of bindings) {
    const question = source.get(row.externalKey);
    if (!question) { outsideCanonical.push(row.externalKey); continue; }
    assert.equal(question.contentSha256, row.contentSha256, 'Canonical source changed; reconcile before practice conversion');
    assert.equal(row.binding?.externalKey, row.externalKey, 'Practice binding target mismatch');
    const result = nidPracticeRuntime(question.payload, row.binding, mediaCatalog);
    assert.equal(stableJson(result.runtime), stableJson(row.runtime), 'Private practice compiler decisions disagree; inspect the source/context/media');
    records.push({ externalKey: row.externalKey, contentSha256: row.contentSha256, bindingId: row.binding.id, runtime: result.runtime });
    if (!result.runtime) unavailable.push({ externalKey: row.externalKey, codes: result.issues });
  }
  return { sourceCommit: manifest.sourceCommit, sourceSha256: manifest.sourceSha256, version: 'nid-authored-practice-v1',
    totalCanonicalNid: source.size, bound: records.length, ready: records.filter(row => row.runtime).length,
    withoutBinding: source.size - records.length, outsideCanonical: outsideCanonical.length, unavailable,
    planSha256: sha256(stableJson(records)), records };
}

export async function nidPracticeOperator({ url, serviceRoleKey }) {
  const project = JSON.parse(await readFile(new URL('../supabase/project.json', import.meta.url), 'utf8'));
  assert.equal(project.project_ref, 'tiodqzvvujxvxssvjdis');
  assert.equal(url, `https://${project.project_ref}.supabase.co`, 'Only the standalone DMocks target is permitted');
  const claims = JSON.parse(Buffer.from(serviceRoleKey?.split('.')[1] || '', 'base64url'));
  assert.equal(claims.role, 'service_role'); assert.equal(claims.ref, project.project_ref);
  async function rpc(name, body = {}) {
    const response = await fetch(url + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: serviceRoleKey, authorization: 'Bearer ' + serviceRoleKey, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
    if (!response.ok) { const error = new Error('Private practice provider request rejected'); error.operation = name; error.httpStatus = response.status; throw error; }
    return response.json();
  }
  return {
    media: () => rpc('canonical_bank_media_manifest'),
    async bindings() {
      const rows = [], seen = new Set(); let cursor = null;
      do {
        const page = await rpc('nid_practice_runtime_plan', { p_after_key: cursor, p_limit: 100 });
        assert.ok(Array.isArray(page?.items) && page.items.length <= 100, 'Invalid practice plan page');
        for (const row of page.items) { assert.equal(typeof row.externalKey, 'string'); assert.ok(!seen.has(row.externalKey), 'Duplicate practice page'); seen.add(row.externalKey); rows.push(row); }
        if (page.nextKey != null) { assert.equal(page.nextKey, page.items.at(-1)?.externalKey); assert.notEqual(page.nextKey, cursor, 'Practice cursor did not advance'); }
        cursor = page.nextKey;
      } while (cursor != null);
      return rows;
    },
    async apply(plan) {
      assert.equal(plan.planSha256, sha256(stableJson(plan.records)), 'Practice plan changed');
      let recorded = 0;
      for (let start = 0; start < plan.records.length; start += 100) {
        const batch = plan.records.slice(start, start + 100), count = await rpc('upsert_nid_practice_runtime_batch', { p_records: batch });
        assert.equal(count, batch.length, 'Practice registration count mismatch'); recorded += count;
      }
      return recorded;
    },
  };
}
async function main() {
  const index = process.argv.indexOf('--ref'), manifest = loadFromGit(index < 0 ? 'origin/main' : process.argv[index + 1]);
  const operator = await nidPracticeOperator({ url: process.env.DMOCKS_SUPABASE_URL, serviceRoleKey: process.env.DMOCKS_SUPABASE_SERVICE_ROLE_KEY });
  const [bindings, media] = await Promise.all([operator.bindings(), operator.media()]);
  const plan = compileNidPracticePlan(manifest, bindings, media), { records, unavailable, ...summary } = plan;
  if (process.argv.includes('--apply')) summary.recorded = await operator.apply(plan);
  // No prompt, figure, answer, rubric, request ID or provider response is printed.
  console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'private-nid-practice-materialization' : 'dry-run', ...summary }, null, 2));
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(() => { console.error('NID_PRACTICE_MATERIALIZATION_FAILED'); process.exitCode = 1; });
