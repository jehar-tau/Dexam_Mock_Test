// Read-only release check. Inspect the HTML and HTTP responses served to a crawler.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { publicPages, siteOrigin } from '../src/search-pages.mjs';

const origin = new URL(process.argv[2] ?? siteOrigin).origin;
const browser = await chromium.launch();
const page = await browser.newPage({ javaScriptEnabled: false });
page.setDefaultTimeout(3000);
const failures = [];
async function check(path, inspect) {
  try {
    const response = await page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
    assert.ok(response, 'Missing HTTP response');
    await inspect(response);
    console.log('PASS', path);
  } catch (error) {
    failures.push(path);
    console.error('FAIL', path, error.message.split('\n')[0]);
  }
}

try {
  const indexed = [...publicPages].filter(([, spec]) => spec.index !== false);
  await check('/robots.txt', async response => {
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'] ?? '', /text\/plain/i);
    const rules = await response.text();
    assert.ok(rules.split(/\r?\n/).includes('Sitemap: ' + siteOrigin + '/sitemap.xml'));
    assert.doesNotMatch(rules, /^Disallow:\s*\/\s*$/im);
  });
  await check('/sitemap.xml', async response => {
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'] ?? '', /(?:application|text)\/xml/i);
    const locations = await page.locator('urlset > url > loc').allTextContents();
    assert.deepEqual(locations.sort(), indexed.map(([path]) => siteOrigin + path).sort());
  });
  for (const [path, spec] of indexed) {
    await check(path, async response => {
      assert.equal(response.status(), 200);
      assert.equal(new URL(response.url()).pathname, path, 'Canonical path redirects');
      assert.equal(await page.title(), spec.title);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), siteOrigin + path);
      assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), spec.description);
      assert.doesNotMatch(response.headers()['x-robots-tag'] ?? '', /noindex|none/i);
      assert.doesNotMatch(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex|none/i);
      assert.equal(await page.locator('main h1').count(), 1);
      if (path === '/') {
        const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
        assert.equal(schema['@type'], 'WebSite');
        assert.equal(schema.url, siteOrigin + '/');
      }
    });
  }
  for (const path of ['/account', '/sample/result', '/privacy', '/no-such-dmocks-public-page']) {
    await check(path, async response => {
      assert.equal(response.status(), path === '/no-such-dmocks-public-page' ? 404 : 200);
      assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/i);
      assert.equal(await page.locator('link[rel="canonical"]').count(), 0);
    });
  }
} finally {
  await browser.close();
}
if (failures.length) process.exitCode = 1;
