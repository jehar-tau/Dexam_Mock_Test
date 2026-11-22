import test from 'node:test';
import assert from 'node:assert/strict';
import { publicCatalogueConfiguration } from '../src/public-catalogue-config.mjs';

const target = { enabled: true, deployment: 'production', origin: 'https://dmocks.com',
  productionOrigin: 'https://dmocks.com', productionProvider: 'https://dmocks.supabase.co',
  url: 'https://dmocks.supabase.co', key: 'sb_publishable_fixture' };

test('a public catalogue read can be enabled without portal admission', () => {
  assert.equal(publicCatalogueConfiguration(target), true);
  assert.equal(publicCatalogueConfiguration({ ...target, enabled: false, url: null, key: null }), false);
});

test('the public catalogue rejects server keys and foreign production projects', () => {
  assert.throws(() => publicCatalogueConfiguration({ ...target, key: 'sb_secret_fixture' }), /public browser key/);
  assert.throws(() => publicCatalogueConfiguration({ ...target, url: 'https://other.supabase.co' }), /designated DMocks project/);
  assert.equal(publicCatalogueConfiguration({ ...target, origin: 'https://www.dmocks.com' }), false);
});

test('the public catalogue accepts legacy anon keys and rejects other JWT roles', () => {
  const jwt = role => `header.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;
  assert.equal(publicCatalogueConfiguration({ ...target, key: jwt('anon') }), true);
  assert.throws(() => publicCatalogueConfiguration({ ...target, key: jwt('service_role') }), /public browser key/);
});
