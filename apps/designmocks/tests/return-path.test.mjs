import test from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnPath } from '../src/return-path.js';

test('only Papers and workspace paths are returned to after sign-in', () => {
  for (const path of ['/papers', '/papers/uceed', '/papers/nift', '/papers?exam=ceed', '/papers/nid?programme=mdes', '/papers?exam=nift&programme=mdes', '/dashboard', '/dashboard/practice'])
    assert.equal(safeReturnPath(path), path);
  for (const path of ['https://evil.example/papers', '//evil.example', '/papers/../admin', '/admin', '/papers/uceed?x=1', '/papers?programme=x', '/papers?programme=mdes&exam=nid', '/dashboard/admin', '', null, '/papers/UCEED'])
    assert.equal(safeReturnPath(path), null);
});
