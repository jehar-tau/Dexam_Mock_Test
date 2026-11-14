import assert from "node:assert/strict";

const origin = "https://staging.example.invalid";
const provider = "http://127.0.0.1:1";
const actor = "00000000-0000-4000-8000-000000000190";
const endpoints = [
  ["question-intake", { assetId: actor }],
  ["question-intake-extract", { assetId: actor }],
  ["ai-question-draft", { requestId: actor }],
];

Deno.test("intake and draft retries check staging admission before privileged requests", async (test) => {
  const originalServe = Deno.serve;
  const originalFetch = globalThis.fetch;
  const environment = {
    PUBLIC_APP_ORIGIN: origin,
    SUPABASE_URL: provider,
    SUPABASE_ANON_KEY: "fictional-public",
    SUPABASE_SERVICE_ROLE_KEY: "fictional-service",
    OPENAI_API_KEY: "fictional-model-key",
    OPENAI_DRAFT_MODEL: "fictional-draft-model",
    OPENAI_INTAKE_MODEL: "fictional-intake-model",
    DMOCKS_EDGE_REQUIRE_STAGING_TESTER: "true",
  };
  const previous = Object.fromEntries(Object.keys(environment).map(name => [name, Deno.env.get(name)]));
  for (const [name, value] of Object.entries(environment)) Deno.env.set(name, value);

  try {
    for (const [endpoint, body] of endpoints) {
      await test.step(endpoint, async () => {
        let handler;
        Deno.serve = handle => { handler = handle; };
        const calls = [];
        let admitted = false;
        globalThis.fetch = async (input, init) => {
          const request = new Request(input, init);
          const url = new URL(request.url);
          assert.equal(url.origin, provider);
          assert.equal(request.headers.get("authorization"), "Bearer fictional-tester");
          calls.push(url.pathname);
          if (url.pathname === "/auth/v1/user") return Response.json({ id: actor });
          if (url.pathname === "/rest/v1/rpc/can_enter_staging_portal") return Response.json(admitted);
          if (url.pathname === "/rest/v1/rpc/is_dmocks_admin") return Response.json(true);
          assert.fail("Unexpected privileged request");
        };
        await import(`../../supabase/functions/${endpoint}/index.ts`);
        assert.ok(handler);
        const post = data => handler(new Request(origin, {
          method: "POST",
          headers: { origin, authorization: "Bearer fictional-tester", "content-type": "application/json" },
          body: JSON.stringify(data),
        }));
        const denied = await post(body);
        assert.equal(denied.status, 403);
        assert.deepEqual(await denied.json(), { error: "Private staging requires an approved Google tester" });
        assert.deepEqual(calls, ["/auth/v1/user", "/rest/v1/rpc/can_enter_staging_portal"]);

        admitted = true;
        calls.length = 0;
        const invalid = await post(null);
        assert.equal(invalid.status, 400);
        await invalid.body?.cancel();
        assert.deepEqual(calls, ["/auth/v1/user", "/rest/v1/rpc/can_enter_staging_portal",
          ...(endpoint === "ai-question-draft" ? [] : ["/rest/v1/rpc/is_dmocks_admin"])]);
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
