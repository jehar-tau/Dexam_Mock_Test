// Checks the public routes of a deployed dmocks.com: pages answer 200,
// closed and preview routes answer 404, and no secret key is served.
// Usage: node scripts/check-live-site.mjs https://dmocks.com
const origin = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https:\/\/[a-z0-9.-]+$/.test(origin)) throw new Error("Give the site origin, for example https://dmocks.com");
const expect = {
  "/": 200, "/papers": 200, "/papers/uceed": 200, "/papers/ceed": 200, "/papers/nid": 200, "/papers/nift": 200,
  "/tests/uceed": 200, "/tests/nid": 200, "/sample": 200, "/terms": 200, "/privacy": 200, "/dashboard": 200,
  "/robots.txt": 200, "/sitemap.xml": 200, "/checkout": 404, "/papers-preview": 404, "/portal-preview": 404,
};
let failed = 0;
const fetchWithRetry = async path => {
  for (let attempt = 1; ; attempt++) {
    try { return await fetch(origin + path, { redirect: "manual" }); }
    catch (error) { if (attempt === 3) throw error; await new Promise(done => setTimeout(done, 5000)); }
  }
};
for (const [path, status] of Object.entries(expect)) {
  const response = await fetchWithRetry(path);
  const body = await response.text();
  const ok = response.status === status && !body.includes("sb_secret_");
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${path} ${response.status} (expected ${status})`);
}
const home = await (await fetchWithRetry("/")).text();
for (const asset of home.match(/\/assets\/[\w.-]+\.(?:js|css)/g) ?? []) {
  const response = await fetchWithRetry(asset);
  if (response.status !== 200) { failed++; console.log(`FAIL ${asset} ${response.status}`); }
}
if (failed) { console.error(`${failed} live checks failed`); process.exit(1); }
console.log("Live checks passed");
