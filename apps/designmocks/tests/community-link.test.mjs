import test from "node:test";
import assert from "node:assert/strict";
import { blockedHost, extractLinkMetadata, fetchLinkPreview, isSocialHost, normalizeLinkUrl, plainText, privateIPv4, privateIPv6 } from "../supabase/functions/_shared/community-link.mjs";

test("addresses are normalized: scheme added, fragment and tracking removed, host lower-cased", () => {
  assert.deepEqual(normalizeLinkUrl("Example.org/Design?utm_source=x&id=4#top"), { url: "https://example.org/Design?id=4", host: "example.org" });
  assert.deepEqual(normalizeLinkUrl(" http://www.example.org:80/a "), { url: "http://www.example.org/a", host: "www.example.org" });
  assert.equal(normalizeLinkUrl("https://example.org./x?fbclid=1&igshid=2").url, "https://example.org/x");
});

test("only public web addresses are accepted", () => {
  for (const raw of ["", "javascript:alert(1)", "data:text/html,hi", "ftp://example.org/file", "file:///etc/passwd", "https://user:pass@example.org/",
    "https://example.org:8443/", "x".repeat(2001)]) assert.throws(() => normalizeLinkUrl(raw), raw);
  for (const raw of ["http://localhost/", "http://127.0.0.1/", "http://10.0.0.5/", "http://[::1]/", "http://2130706433/", "http://0x7f.1/", "http://intranet/",
    "https://printer.local/", "https://db.internal/", "https://site.test/", "https://example.invalid/", "http://169.254.169.254/latest/meta-data"])
    assert.throws(() => normalizeLinkUrl(raw), { code: "link_blocked" }, raw);
});

test("host and address checks cover private, loopback, link-local and mapped ranges", () => {
  for (const host of ["192.168.1.1", "server", "a.localhost", "metadata.google.internal"]) assert.equal(blockedHost(host), true, host);
  assert.equal(blockedHost("designexam.com"), false);
  for (const parts of [[10, 1, 1, 1], [172, 20, 0, 1], [192, 168, 0, 1], [127, 0, 0, 1], [169, 254, 1, 1], [100, 64, 0, 1], [0, 0, 0, 0], [224, 0, 0, 1]])
    assert.equal(privateIPv4(parts), true, parts.join("."));
  assert.equal(privateIPv4([93, 184, 216, 34]), false);
  for (const address of ["::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "ff02::1"]) assert.equal(privateIPv6(address), true, address);
  assert.equal(privateIPv6("2606:2800:220:1:248:1893:25c8:1946"), false);
});

test("social and messaging sites are recognised, including subdomains", () => {
  for (const host of ["instagram.com", "www.instagram.com", "m.facebook.com", "wa.me", "t.me", "x.com"]) assert.equal(isSocialHost(host), true, host);
  for (const host of ["designexam.com", "notinstagram.com"]) assert.equal(isSocialHost(host), false, host);
});

test("metadata is plain text: tags, scripts and control characters are removed and lengths are capped", () => {
  const html = `<html><head><title>Ignored &amp; title</title>
    <meta property="og:title" content="How to plan &lt;b&gt;two hours&lt;/b&gt; &#8212; a guide">
    <meta name='description' content='A fictional description with a‮hidden turn'>
    <meta property="og:site_name" content=Fictional>
    <script>alert(1)</script></head><body><meta property="og:description" content="from the body"></body></html>`;
  assert.deepEqual(extractLinkMetadata(html, "example.org"), { title: "How to plan two hours — a guide", site: "Fictional", description: "A fictional description with a hidden turn" });
  assert.deepEqual(extractLinkMetadata("<html><head></head></html>", "example.org"), { title: null, site: "example.org", description: null });
  assert.equal([...plainText("word ".repeat(200), 50)].length, 50);
  assert.equal(plainText("&#0;&#x1F600;&bogus;", 50), "😀&bogus;");
});

const page = (body, { status = 200, type = "text/html; charset=utf-8", location = null } = {}) => new Response(body, { status, headers: { "content-type": type, ...(location ? { location } : {}) } });

test("a preview follows a redirect only to another public address", async () => {
  const seen = [];
  const fetch = async url => { seen.push(url); return url === "https://example.org/old" ? page("", { status: 301, location: "/new" }) : page("<title>New page</title>"); };
  const result = await fetchLinkPreview("https://example.org/old", { fetch });
  assert.deepEqual(seen, ["https://example.org/old", "https://example.org/new"]);
  assert.deepEqual(result, { url: "https://example.org/new", host: "example.org", status: "fetched", title: "New page", site: "example.org", description: null });
  const internal = await fetchLinkPreview("https://example.org/old", { fetch: async () => page("", { status: 302, location: "http://169.254.169.254/" }) });
  assert.equal(internal.status, "unavailable");
  let hops = 0;
  const loop = await fetchLinkPreview("https://example.org/", { fetch: async () => { hops++; return page("", { status: 302, location: "/again" }); } });
  assert.equal(loop.status, "unavailable"); assert.equal(hops, 4);
});

test("a preview refuses private DNS answers, non-HTML replies and failures without throwing", async () => {
  let fetched = false;
  const privateDns = await fetchLinkPreview("https://example.org/", { fetch: async () => { fetched = true; return page("<title>x</title>"); }, resolve: async () => ["10.0.0.8"] });
  assert.equal(privateDns.status, "unavailable"); assert.equal(fetched, false);
  assert.equal((await fetchLinkPreview("https://example.org/", { fetch: async () => page("<title>x</title>"), resolve: async () => ["93.184.216.34"] })).status, "fetched");
  assert.equal((await fetchLinkPreview("https://example.org/", { fetch: async () => page("{}", { type: "application/json" }) })).status, "unavailable");
  assert.equal((await fetchLinkPreview("https://example.org/", { fetch: async () => page("<title>x</title>", { status: 404 }) })).status, "unavailable");
  assert.equal((await fetchLinkPreview("https://example.org/", { fetch: async () => { throw new Error("network"); } })).status, "unavailable");
  assert.equal((await fetchLinkPreview("https://example.org/", { fetch: (_url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason))), timeoutMs: 20 })).status, "unavailable");
});

test("social sites are saved without being fetched, and reading stops at the size cap", async () => {
  let fetched = false;
  const social = await fetchLinkPreview("https://www.instagram.com/p/abc/?igshid=1", { fetch: async () => { fetched = true; } });
  assert.deepEqual(social, { url: "https://www.instagram.com/p/abc/", host: "www.instagram.com", status: "skipped", title: null, site: "www.instagram.com", description: null });
  assert.equal(fetched, false);
  const big = "<head><title>Start</title></head>" + "x".repeat(3000);
  assert.equal((await fetchLinkPreview("https://example.org/", { fetch: async () => page(big), maxBytes: 40 })).title, "Start");
});
