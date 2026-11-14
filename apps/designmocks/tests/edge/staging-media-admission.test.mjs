import assert from "node:assert/strict";

const origin = "https://staging.example.invalid";
const checkout = "https://checkout.example.invalid";
const provider = "http://127.0.0.1:1";
const actor = "00000000-0000-4000-8000-000000000190";
const mediaPath = "papers/fixture.png";

const endpoints = [
  ["attempt-media", { attemptId: actor }, "read_attempt"],
  ["drawing-review-media", { reviewId: actor }, "admin_drawing_review_media_paths"],
  ["bank-review-media", { externalKey: "fixture", reviewVersion: "fixture" }, "admin_bank_review_media_paths"],
  ["reported-question-media", { targetKey: "fixture", revision: 1 }, "admin_reported_question_media_paths"],
];


Deno.test("private media checks staging admission before signing and again before returning links", async (test) => {
  const originalServe = Deno.serve;
  const originalFetch = globalThis.fetch;
  const environment = {
    PUBLIC_APP_ORIGIN: origin,
    DMOCKS_CHECKOUT_ORIGIN: checkout,
    SUPABASE_URL: provider,
    SUPABASE_ANON_KEY: "fictional-public",
    SUPABASE_SERVICE_ROLE_KEY: "fictional-service",
    DMOCKS_EDGE_REQUIRE_STAGING_TESTER: "true",
  };
  const previous = Object.fromEntries(Object.keys(environment).map(name => [name, Deno.env.get(name)]));
  for (const [name, value] of Object.entries(environment)) Deno.env.set(name, value);

  try {
    for (const [endpoint, body, authorization] of endpoints) {
      await test.step(endpoint, async () => {
        let handler;
        Deno.serve = handle => { handler = handle; };
        const decisions = [];
        const calls = [];
        globalThis.fetch = async (input, init) => {
          const request = new Request(input, init);
          const url = new URL(request.url);
          assert.equal(url.origin, provider);
          calls.push(url.pathname);
          if (url.pathname === "/auth/v1/user") return Response.json({ id: actor });
          if (url.pathname.endsWith("/can_enter_staging_portal")) {
            assert.equal(request.headers.get("authorization"), "Bearer fictional-tester");
            assert.ok(decisions.length);
            return Response.json(decisions.shift());
          }
          if (url.pathname.endsWith("/" + authorization)) {
            if (authorization === "read_attempt") return Response.json({
              deadline: new Date(Date.now() + 60000).toISOString(),
              questions: [{ id: actor, media: [{ path: mediaPath }] }],
            });
            return Response.json([{ id: actor, ordinal: 1, storagePath: mediaPath, width: 1, height: 1 }]);
          }
          if (url.pathname.includes("/object/sign/")) return Response.json([
            { path: mediaPath, signedURL: "/object/sign/fixture.png?token=fictional-signature" },
          ]);
          assert.fail("Unexpected provider request");
        };
        await import(`../../supabase/functions/${endpoint}/index.ts`);
        assert.ok(handler);
        for (const [from, status] of [[origin, 204], [checkout, endpoint === "attempt-media" ? 204 : 403], [checkout + ".invalid", 403]]) {
          const response = await handler(new Request(origin, {method: "OPTIONS", headers: {origin: from}}));
          assert.equal(response.status, status);
          assert.equal(response.headers.get("access-control-allow-origin") === from, status === 204);
          await response.body?.cancel();
        }
        for (const [stages, status] of [[[false], 403], [[true, false], 403], [[true, true], 200]]) {
          decisions.push(...stages);
          calls.length = 0;
          const response = await handler(new Request(origin, {
            method: "POST",
            headers: { origin, authorization: "Bearer fictional-tester", "content-type": "application/json" },
            body: JSON.stringify(body),
          }));
          assert.equal(response.status, status);
          const text = await response.text();
          assert.equal(text.includes("fictional-signature"), status === 200);
          assert.equal(calls.some(path => path.includes("/object/sign/")), stages.length === 2);
          assert.equal(decisions.length, 0);
        }
      });
    }
  } finally {
    Deno.serve = originalServe;
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
});
