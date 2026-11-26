import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { pageHead } from '../src/search-pages.mjs';

const app = fileURLToPath(new URL('../', import.meta.url));
const headings = new Map([
  ['/', /next attempt/i], ['/tests', /mock tests/i], ['/tests/uceed', /UCEED Part A/],
  ['/plans', /annual pass/i], ['/sample', /practice sample/i], ['/practice/visual-hierarchy', /visual hierarchy/i],
]);
const indexedPaths = [...headings.keys()];

test('built search documents contain one canonical, real public text, and no personal results', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dmocks-search-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  // Build the same informational profile used on the public Site, independent of provider credentials.
  const env = { ...process.env, VITE_DEPLOYMENT_ENV: 'production', VITE_PORTAL_ENABLED: 'false',
    VITE_CHECKOUT_ENABLED: 'false', VITE_TEST_LOGIN_ENABLED: 'false', VITE_STAGING_PORTAL_ENABLED: 'false', DMOCKS_PUBLISHED_NOTICES_FILE: '' };
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'production', '--outDir', dir], {cwd: app, env, stdio: 'pipe'});
  const read = relative => readFile(join(dir, relative), 'utf8');
  const sitemap = await read('sitemap.xml');
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(locations.sort(), indexedPaths.map(path => 'https://dmocks.com' + path).sort());
  assert.equal(await read('robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://dmocks.com/sitemap.xml\n');
  const titles = new Set();
  for (const path of indexedPaths) {
    const html = await read(path === '/' ? 'index.html' : path.slice(1) + '.html');
    assert.equal([...html.matchAll(/rel="canonical" href="(.*?)"/g)].map(match => match[1]).join(), 'https://dmocks.com' + path);
    assert.match(html, /<meta [^>]*name="robots" content="index, follow"/);
    const heading = html.match(/<main[^>]*>[\s\S]+?<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1];
    assert.match(heading?.replace(/<[^>]*>/g, ' ') ?? '', headings.get(path));
    assert.match(html, /<a[^>]+href="\/sample"/);
    assert.doesNotMatch(html, /href="(?:mailto:|\/(?:admin|dashboard)(?:\/|"))/);
    assert.doesNotMatch(html, /<div id="root"><\/div>|name="robots" content="noindex/);
    titles.add(html.match(/<title[^>]*>([^<]+)<\/title>/)[1]);
    const schema = html.match(/<script[^>]+type="application\/ld\+json">(.*?)<\/script>/);
    if (path === '/') {
      assert.deepEqual(JSON.parse(schema[1]), {'@context':'https://schema.org','@type':'WebSite',name:'DMocks',url:'https://dmocks.com/'});
      assert.match(html, /Read your five-question report/);
      assert.match(html, /then open a worked solution for every question/);
      assert.doesNotMatch(html, /Opening soon|top ten|All India mocks|Community|Reviewed questions|reviewer feedback|interactive programmes|Illustrative preview/i);
    } else assert.equal(schema, null);
  }
  assert.equal(titles.size, indexedPaths.length);
  for (const path of ['account', 'account/callback', 'sample/result', 'admin', 'dashboard', 'papers', 'contact', 'terms', 'privacy', 'refunds', 'tests/nid', 'tests/nift', 'tests/ceed', '404']) {
    const html = await read(path + '.html');
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.doesNotMatch(html, /rel="canonical"|property="og:url"|application\/ld\+json/);
    if (!path.startsWith('tests/') && path !== '404') assert.match(html, /<div id="root"><\/div>/);
  }
  assert.match(pageHead('/attempt/testing', true), /noindex/);
  assert.equal(pageHead('/sample/', true), pageHead('/sample', true));
});

test('private build emits no public sitemap or indexed document', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dmocks-private-search-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const env = {...process.env, VITE_DEPLOYMENT_ENV:'staging', VITE_PORTAL_ENABLED:'false', VITE_CHECKOUT_ENABLED:'false', VITE_TEST_LOGIN_ENABLED:'false', VITE_STAGING_PORTAL_ENABLED:'false', DMOCKS_PUBLISHED_NOTICES_FILE:''};
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'staging', '--outDir', dir], {cwd: app, env, stdio: 'pipe'});
  assert.equal(await readFile(join(dir, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
  await assert.rejects(stat(join(dir, 'sitemap.xml')), {code: 'ENOENT'});
  assert.match(await readFile(join(dir, 'index.html'), 'utf8'), /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(pageHead('/sample', false), /rel="canonical"|content="index, follow"/);
});
