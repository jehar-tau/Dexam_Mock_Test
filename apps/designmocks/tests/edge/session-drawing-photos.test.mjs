import assert from "node:assert/strict";

const portal = "https://fictional-portal.example.invalid";
const backend = "http://127.0.0.1:1";
const attempt = "10000000-0000-4000-8000-000000000987";
const question = "20000000-0000-4000-8000-000000000987";
const page = "30000000-0000-4000-8000-000000000987";
const reviewer = "40000000-0000-4000-8000-000000000987";
const users = {owner: "50000000-0000-4000-8000-000000000987", other: "60000000-0000-4000-8000-000000000987"};
const bytes = Uint8Array.from([137,80,78,71,13,10,26,10]); // Synthetic raster signature, no student data.
Deno.test("student and assigned reviewer photo handlers authorize each manifest and byte delivery", async t => {
  const actualFetch = globalThis.fetch, serve = Deno.serve;
  const settings = {
    PUBLIC_APP_ORIGIN: portal, SUPABASE_URL: backend, SUPABASE_ANON_KEY: "fixture-anon",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service", DMOCKS_EDGE_REQUIRE_STAGING_TESTER: "false",
  };
  const previous = Object.fromEntries(Object.keys(settings).map(key => [key,Deno.env.get(key)]));
  try {
    for (const [key,value] of Object.entries(settings)) Deno.env.set(key,value);
    for (const endpoint of ["drawing-media", "drawing-review-media"]) {
      await t.step(endpoint, async () => {
        let handler, downloads = 0;
        Deno.serve = cb => {handler=cb;};
        const scope = endpoint === "drawing-media" ? {attemptId:attempt, questionId:question} : {reviewId:reviewer};
        const permitted = endpoint === "drawing-media" ? "owner" : "teacher";
        globalThis.fetch = async (input,init) => {
          const request = new Request(input,init), url = new URL(request.url);
          assert.equal(url.origin, backend);
          const auth = request.headers.get("authorization");
          if (url.pathname === "/auth/v1/user") {
            const user = Object.entries(users).find(([role])=>auth === "Bearer fixture-" + role);
            return user ? Response.json({id:user[1]}) : Response.json({message:"Fictional login required"}, {status:401});
          }
          const record = [{id:page,ordinal:1,mimeType:"image/png",storagePath:"fictional-private/1.png"}];
          if (url.pathname.endsWith("/service_student_drawing_media_paths")) {
            assert.equal(auth, "Bearer fixture-service");
            const params = await request.json();
            assert.equal(params.p_attempt_id, attempt);
            assert.equal(params.p_question_id, question);
            return params.p_student_id === users.owner ? Response.json(record) : Response.json({message:"Unavailable"},{status:403});
          }
          if (url.pathname.endsWith("/admin_drawing_review_media_paths")) {
            assert.deepEqual(await request.json(),{p_review_id:reviewer});
            return auth === "Bearer fixture-teacher" ? Response.json(record) : Response.json({message:"Unavailable"},{status:403});
          }
          assert.equal(request.method, "GET");
          assert.equal(url.pathname, "/storage/v1/object/drawing-submissions/fictional-private/1.png");
          assert.equal(auth, "Bearer fixture-service");
          downloads++;
          return new Response(bytes);
        };
        await import(`../../supabase/functions/${endpoint}/index.ts`);
        const request = (role,body) => handler(new Request(portal, {
          method:"POST",headers:{origin:portal,"Content-Type":"application/json",...(role ? {authorization:"Bearer fixture-"+role} : {})},
          body: JSON.stringify(body),
        }));
        const list = await request(permitted, {...scope, action:"pages"});
        assert.equal(list.status, 200);
        assert.deepEqual((await list.json()).images, [{id:page,ordinal:1,mimeType:"image/png",width:null,height:null,orientation:null}]);
        for (const role of [null,"other"]) {
          const result = await request(role,{...scope,action:"page",id:page});
          assert.ok([401,403].includes(result.status));
          await result.body?.cancel();
        }
        assert.equal(downloads, 0);
        const photo = await request(permitted,{...scope,action:"page",id:page});
        assert.equal(photo.status, 200);
        assert.equal(photo.headers.get("cache-control"), "private, no-store");
        assert.deepEqual(new Uint8Array(await photo.arrayBuffer()),bytes);
        assert.equal(downloads, 1);
        const olderTab = await request(permitted, endpoint === "drawing-media" ? {...scope,action:"open"} : scope);
        assert.equal(olderTab.status, 409);
        assert.match((await olderTab.json()).error, /Refresh DMocks/);
        assert.equal(downloads, 1);
      });
    }
  } finally {
    Deno.serve=serve;globalThis.fetch=actualFetch;
    for (const [key,value] of Object.entries(previous)) {
      if (value === undefined) Deno.env.delete(key); else Deno.env.set(key,value);
    }
  }
});
