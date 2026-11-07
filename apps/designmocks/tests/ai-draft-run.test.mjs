import assert from "node:assert/strict";
import test from "node:test";
import { runAiDraft } from "../supabase/functions/_shared/ai-draft-run.mjs";

const input = { exam: "uceed", topic: "observation", questionType: "MCQ", instruction: "Create an original fixture", basisExternalKeys: ["fixture-basis"] };
const payload = { prompt: "Fictional draft for human review", holds: ["ai-generated-human-review"] };
const response = () => Response.json({ id: "fixture-response", status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(payload) }] }] });

function setup() {
  const calls = [];
  const caller = { rpc: async (name, args) => {
    calls.push([name, args]);
    return { data: name === "admin_create_ai_draft_request" ? "fixture-request" : { ...input, basis: [{ externalKey: "fixture-basis", prompt: "Approved fictional reference" }] } };
  } };
  const worker = { rpc: async (name, args) => {
    calls.push([name, args]);
    return { data: name === "claim_ai_draft_request" ? { token: "fixture-run" } : "fixture-draft" };
  } };
  return { calls, caller, worker, actorId: "fixture-editor", input, model: "fictional-model", apiKey: "fictional-key" };
}

test("new AI drafting claims a processing token and saves only against that token", async () => {
  const config = setup();
  const result = await runAiDraft({ ...config, fetcher: async (url, request) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.ok(request.signal instanceof AbortSignal);
    return response();
  } });
  assert.equal(result.status, 200);
  assert.deepEqual(config.calls.find(([name]) => name === "claim_ai_draft_request")[1], { p_request_id: "fixture-request", p_actor_id: "fixture-editor", p_retry: false });
  assert.equal(config.calls.find(([name]) => name === "complete_ai_draft_request")[1].p_token, "fixture-run");
  assert.equal(config.calls.some(([name]) => name === "fail_ai_draft_request"), false);
});

test("retrying a failed draft uses its original request without creating another request", async () => {
  const config = setup();
  const result = await runAiDraft({ ...config, input: { requestId: "original-request" }, fetcher: async () => response() });
  assert.equal(result.body.requestId, "original-request");
  assert.equal(config.calls.some(([name]) => name === "admin_create_ai_draft_request"), false);
  assert.deepEqual(config.calls.find(([name]) => name === "claim_ai_draft_request")[1], { p_request_id: "original-request", p_actor_id: "fixture-editor", p_retry: true });
});

test("rejected claims cannot contact the model or fail another active run", async () => {
  const config = setup();
  let sent = false;
  config.worker.rpc = async () => ({ error: { code: "42501", message: "AI draft request unavailable" } });
  const result = await runAiDraft({ ...config, input: { requestId: "other-request" }, fetcher: async () => { sent = true; return response(); } });
  assert.equal(result.status, 403);
  assert.equal(sent, false);
  assert.deepEqual(config.calls, []);
});

test("incomplete or failed model responses mark only their own run failed and omit provider diagnostics", async () => {
  for (const incomplete of [true, false]) {
    const config = setup();
    const result = await runAiDraft({ ...config, fetcher: async () => {
      if (!incomplete) throw new Error("Sensitive provider diagnostic");
      return Response.json({ status: "incomplete", output: [] });
    } });
    assert.equal(result.status, 400);
    assert.doesNotMatch(JSON.stringify(result), /Sensitive/);
    assert.equal(config.calls.find(([name]) => name === "fail_ai_draft_request")[1].p_token, "fixture-run");
    assert.equal(config.calls.some(([name]) => name === "complete_ai_draft_request"), false);
  }
});

test("an old worker carries its original token even when a retry has already succeeded", async () => {
  const config = setup();
  let activeToken = "old-run", completed;
  let releaseOld;
  let oldStarted;
  const ready = new Promise(resolve => { oldStarted = resolve; });
  const pending = new Promise(resolve => { releaseOld = resolve; });
  config.worker.rpc = async (name, args) => {
    config.calls.push([name, args]);
    if (name === "claim_ai_draft_request") return { data: { token: activeToken } };
    if (args.p_token !== activeToken) return { error: { message: "Stale token" } };
    if (name === "complete_ai_draft_request") completed = "new-draft";
    return { data: completed };
  };
  const old = runAiDraft({ ...config, fetcher: async () => { oldStarted(); await pending; return response(); } });
  await ready;
  activeToken = "new-run";
  const retried = await runAiDraft({ ...config, input: { requestId: "fixture-request" }, fetcher: async () => response() });
  assert.equal(retried.status, 200);
  releaseOld();
  assert.equal((await old).status, 400);
  assert.equal(completed, "new-draft");
  assert.deepEqual(config.calls.filter(([name]) => name === "fail_ai_draft_request").map(([, args]) => args.p_token), ["old-run"]);
});
