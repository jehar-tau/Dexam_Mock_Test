import assert from "node:assert/strict";

// The link action of community-media: a member's address is checked before
// any database call, a cached preview is returned without fetching, the fetch
// limit is honoured, and only plain metadata is recorded.
const origin = "https://dmocks.example.invalid";
const provider = "http://127.0.0.1:1";
const actor = "00000000-0000-4000-8000-000000000191";
const link = { id: "a0000000-0000-4000-8000-000000000191", url: "https://example.org/plan", host: "example.org", status: "fetched", title: "A fictional plan",
  site: "Fictional", description: null, fetchedAt: "2026-11-17T00:00:00.000000+00:00" };

Deno.test("community-media link previews", async test => {
  const originalServe = Deno.serve, originalFetch = globalThis.fetch, originalResolve = Deno.resolveDns;
  const environment = { PUBLIC_APP_ORIGIN: origin, SUPABASE_URL: provider, SUPABASE_ANON_KEY: "fictional-public", SUPABASE_SERVICE_ROLE_KEY: "fictional-service" };
  const previous = Object.fromEntries(Object.keys(environment).map(name => [name, Deno.env.get(name)]));
  for (const [name, value] of Object.entries(environment)) Deno.env.set(name, value);
  Deno.env.delete("DMOCKS_EDGE_REQUIRE_STAGING_TESTER");
  let handler, calls = [], cached = null, limited = false, recorded = null, pages = [];
  Deno.serve = handle => { handler = handle; };
  Deno.resolveDns = async (_host, type) => type === "A" ? ["93.184.216.34"] : [];
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init), url = new URL(request.url);
    if (url.origin !== provider) {
      pages.push({ url: request.url, redirect: init?.redirect });
      return new Response("<head><title>Fetched &amp; fictional</title><script>alert(1)</script></head>", { headers: { "content-type": "text/html" } });
    }
    calls.push([url.pathname, request.headers.get("authorization")]);
    if (url.pathname === "/auth/v1/user") return request.headers.get("authorization") === "Bearer fictional-member" ? Response.json({ id: actor }) : Response.json({ message: "missing" }, { status: 401 });
    if (url.pathname.endsWith("/community_link_lookup")) return Response.json(cached);
    if (url.pathname.endsWith("/service_begin_community_link_fetch")) return limited ? Response.json({ code: "P0001", details: "community_link_limit", message: "private" }, { status: 400 }) : new Response(null, { status: 204 });
    if (url.pathname.endsWith("/service_record_community_link")) { recorded = await request.json(); return Response.json({ ...link, title: recorded.p_title }); }
    throw new Error("Unexpected provider request " + url.pathname);
  };
  const ask = (body, authorization = "Bearer fictional-member") => handler(new Request(origin, { method: "POST", headers: { origin, authorization, "content-type": "application/json" }, body: JSON.stringify(body) }));
  try {
    // A computed path keeps the handler out of the up-front type check, as in the other Edge tests.
    const endpoint = "community-media";
    await import(`../../supabase/functions/${endpoint}/index.ts`);
    assert.ok(handler);
    await test.step("a signed-out request is refused", async () => {
      const response = await ask({ action: "link", url: "https://example.org/plan" }, "");
      assert.equal(response.status, 401); await response.body?.cancel();
    });
    await test.step("private and local addresses are refused before any database call", async () => {
      for (const url of ["http://127.0.0.1/", "http://169.254.169.254/latest", "https://db.internal/", "javascript:alert(1)"]) {
        calls = [];
        const response = await ask({ action: "link", url });
        assert.equal(response.status, 400, url);
        assert.ok(["link_blocked", "link_invalid"].includes((await response.json()).code), url);
        assert.deepEqual(calls.map(([path]) => path), ["/auth/v1/user"], url);
      }
      assert.deepEqual(pages, []);
    });
    await test.step("a cached preview is returned without fetching or reserving", async () => {
      cached = link; calls = [];
      const response = await ask({ action: "link", url: "example.org/plan?utm_source=x" });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { link });
      assert.deepEqual(calls.map(([path]) => path), ["/auth/v1/user", "/rest/v1/rpc/community_link_lookup"]);
      assert.deepEqual(pages, []);
      cached = null;
    });
    await test.step("the hourly limit stops a fetch", async () => {
      limited = true;
      const response = await ask({ action: "link", url: "https://example.org/plan" });
      assert.equal(response.status, 429);
      assert.equal((await response.json()).code, "link_limit");
      assert.deepEqual(pages, []);
      limited = false;
    });
    await test.step("a fresh preview is fetched without following redirects automatically and recorded as plain text", async () => {
      calls = [];
      const response = await ask({ action: "link", url: "https://example.org/plan" });
      assert.equal(response.status, 200);
      assert.deepEqual(pages, [{ url: "https://example.org/plan", redirect: "manual" }]);
      assert.deepEqual(recorded, { p_url: "https://example.org/plan", p_host: "example.org", p_status: "fetched", p_title: "Fetched & fictional", p_site: "example.org", p_description: null });
      const service = calls.filter(([path]) => path.includes("service_")).map(([, authorization]) => authorization);
      assert.ok(service.every(value => value === "Bearer fictional-service"));
      assert.equal((await response.json()).link.title, "Fetched & fictional");
    });
  } finally {
    Deno.serve = originalServe; globalThis.fetch = originalFetch; Deno.resolveDns = originalResolve;
    for (const [name, value] of Object.entries(previous)) value === undefined ? Deno.env.delete(name) : Deno.env.set(name, value);
  }
});
