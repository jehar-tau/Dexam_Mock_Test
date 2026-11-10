import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

const app = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, app), 'utf8');

test('rollout documents quote the current migration count, profile hash and RPC count', async () => {
  const migrations = (await readdir(new URL('supabase/migrations/', app))).filter(file => file.endsWith('.sql'));
  const hash = createHash('sha256').update(await readFile(new URL('supabase/launch/paid-mvp.sql', app))).digest('hex');
  const rpcs = JSON.parse(await read('supabase/launch/paid-mvp-rpcs.json')).length;
  for (const doc of ['PROVIDER_SETUP', 'CHECKOUT_RECOVERY', 'VERIFICATION']) {
    const text = await read(`docs/${doc}.md`);
    const quoted = [...text.matchAll(/Current profile SHA-256:? `([0-9a-f]{64})`|profile SHA-256 is `([0-9a-f]{64})`/g)];
    assert.ok(quoted.length > 0, `${doc} states the current profile hash`);
    for (const match of quoted) assert.equal(match[1] ?? match[2], hash, `${doc} profile hash`);
  }
  const deployment = await read('docs/MVP_DEPLOYMENT.md');
  assert.match(deployment, new RegExp(`\\*\\*${rpcs} authenticated signatures\\*\\*`), 'MVP_DEPLOYMENT RPC count');
  const setup = await read('docs/PROVIDER_SETUP.md');
  assert.match(setup, new RegExp(`${migrations.length} migrations/functions`), 'PROVIDER_SETUP migration count');
  assert.match(setup, new RegExp(`${rpcs} authenticated RPCs`), 'PROVIDER_SETUP RPC count');
});
