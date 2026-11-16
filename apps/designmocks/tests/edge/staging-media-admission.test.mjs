import assert from "node:assert/strict";

const origin = "https://staging.example.invalid";
const checkout = "https://checkout.example.invalid";
const provider = "http://127.0.0.1:1";
const actor = "00000000-0000-4000-8000-000000000190";
const mediaPath = "papers/fixture.png";

const communityPath = "community/fixture.png";
const revision = "a".repeat(64);
const endpoints = [
  ["community-media", {targetType: "post", targetId: actor}, "community_media_paths"],
  ["attempt-media", { attemptId: actor }, "read_attempt"],
  ["drawing-media", {}, null],
  ["drawing-review-media", { reviewId: actor }, "admin_drawing_review_media_paths"],
  ["bank-review-media", { externalKey: "fixture", reviewVersion: "fixture" }, "admin_bank_review_media_paths"],
  ["reported-question-media", { targetKey: "fixture", revision: 1 }, "admin_reported_question_media_paths"],
];
const emptyRequestErrors = {
  "community-media": "Invalid community target",
  "attempt-media": "Invalid attempt",
  "drawing-media": "Invalid drawing action",
  "drawing-review-media": "Invalid review",
  "bank-review-media": "A bank question and review version are required",
  "reported-question-media": "A reported question and current revision are required",
};


Deno.test("private media checks staging admission before handling a request and before returning signed links", async (test) => {
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
        let afterSigning;
        let activeRpc = authorization;
        globalThis.fetch = async (input, init) => {
          const request = new Request(input, init);
          const url = new URL(request.url);
          assert.equal(url.origin, provider);
          calls.push(url.pathname);
          if (url.pathname === "/auth/v1/user") {
            return request.headers.get("authorization") === "Bearer fictional-tester"
              ? Response.json({ id: actor })
              : Response.json({ message: "Fictional session missing" }, { status: 401 });
          }
          if (url.pathname.endsWith("/can_enter_staging_portal")) {
            assert.equal(request.headers.get("authorization"), "Bearer fictional-tester");
            assert.ok(decisions.length);
            return Response.json(decisions.shift());
          }
          if (url.pathname.endsWith("/" + activeRpc)) {
            if (endpoint === "community-media") return Response.json([{
              id: actor, ordinal: 1, path: communityPath, mimeType: "image/png", width: 1, height: 1, orientation: 1,
            }]);
            if (authorization === "read_attempt") return Response.json({
              deadline: new Date(Date.now() + 60000).toISOString(),
              questions: [{ id: actor, media: [{ path: mediaPath }] }],
            });
            if (afterSigning && calls.some(path => path.includes("/object/sign/"))) return afterSigning();
            return Response.json([{ id: actor, ordinal: 1, storagePath: mediaPath, width: 1, height: 1 }]);
          }
          if (url.pathname.includes("/object/sign/")) return Response.json([
            { path: endpoint === "community-media" ? communityPath : mediaPath, signedURL: "/object/sign/fixture.png?token=fictional-signature" },
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
        const admittedOrigins = endpoint === "attempt-media" ? [origin, checkout] : [origin];
        const emptyRequest = () => handler(new Request(origin, {
          method: "POST", headers: {origin, authorization: "Bearer fictional-tester", "content-type": "application/json"},
          body: "{}",
        }));
        decisions.push(true);
        const empty = await emptyRequest();
        assert.equal(empty.status, 400);
        assert.equal(empty.headers.get("access-control-allow-origin"), origin);
        assert.equal((await empty.json()).error, emptyRequestErrors[endpoint]);
        assert.ok(calls.every(path => path.endsWith("/user") || path.endsWith("/can_enter_staging_portal")));
        assert.equal(decisions.length, 0);
        calls.length = 0;
        if (endpoint === "drawing-media") {
          decisions.push(false);
          const denied = await emptyRequest();
          assert.equal(denied.status, 403);
          assert.equal(denied.headers.get("access-control-allow-origin"), origin);
          assert.deepEqual(await denied.json(), {error: "Private staging requires an approved Google tester"});
          assert.deepEqual(calls, ["/auth/v1/user", "/rest/v1/rpc/can_enter_staging_portal"]);
          assert.equal(decisions.length, 0);
          return;
        }
        for (const from of admittedOrigins) {
          const requestBody = JSON.stringify(body);
          if (endpoint === "attempt-media") {
            calls.length = 0;
            const anonymous = await handler(new Request(from, {
              method: "POST", headers: { origin: from, "content-type": "application/json" }, body: requestBody,
            }));
            assert.equal(anonymous.status, 401);
            assert.equal(anonymous.headers.get("access-control-allow-origin"), from);
            await anonymous.body?.cancel();
            assert.equal(calls.some(path => path.includes("/object/sign/")), false);
          }
          for (const [stages, status] of [[[false], 403], [[true, false], 403], [[true, true], 200]]) {
            decisions.push(...stages);
            calls.length = 0;
            const response = await handler(new Request(from, {
              method: "POST",
              headers: { origin: from, authorization: "Bearer fictional-tester", "content-type": "application/json" },
              body: requestBody,
            }));
            assert.equal(response.status, status);
            assert.equal(response.headers.get("access-control-allow-origin"), from);
            const text = await response.text();
            assert.equal(text.includes("fictional-signature"), status === 200);
            assert.equal(calls.some(path => path.includes("/object/sign/")), stages.length === 2);
            assert.equal(decisions.length, 0);
          }
        }
        if (endpoint === "community-media") {
          for (const [requestBody, rpc] of [
            [{action: "review", reportId: actor, reviewVersion: revision, context: "target"}, "admin_community_report_media_paths"],
            [{action: "moderate", ...body, reviewVersion: revision, context: "target"}, "admin_community_moderation_media_paths"],
          ]) {
            activeRpc = rpc;
            for (const allowed of [false, true]) {
              decisions.push(true, allowed);
              calls.length = 0;
              const response = await handler(new Request(origin, {method: "POST",
                headers: {origin, authorization: "Bearer fictional-tester", "content-type": "application/json"},
                body: JSON.stringify(requestBody),
              }));
              assert.equal(response.status, allowed ? 200 : 403);
              assert.equal((await response.text()).includes("fictional-signature"), allowed);
              assert.equal(calls.filter(path => path.endsWith("/" + rpc)).length, 2);
              assert.equal(decisions.length, 0);
            }
          }
        }
        if (endpoint === "bank-review-media" || endpoint === "reported-question-media") {
          for (const [result, status] of [
            [() => Response.json({ code: "42501", message: "Permission denied" }, { status: 403 }), 403],
            [() => Response.json([{ ordinal: 1, storagePath: "papers/changed.png", width: 1, height: 1 }]), 409],
          ]) {
            afterSigning = result;
            decisions.push(true, true);
            calls.length = 0;
            const response = await handler(new Request(origin, {
              method: "POST",
              headers: { origin, authorization: "Bearer fictional-tester", "content-type": "application/json" },
              body: JSON.stringify(body),
            }));
            assert.equal(response.status, status);
            assert.ok(!(await response.text()).includes("fictional-signature"));
            assert.equal(calls.filter(path => path.endsWith("/" + authorization)).length, 2);
            assert.equal(decisions.length, 0);
          }
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
