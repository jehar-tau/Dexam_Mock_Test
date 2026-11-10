import assert from "node:assert/strict";
import test from "node:test";
import { buildIntakeExtractionRequest, extractIntakeAsset, parseIntakeExtractionResponse } from "../supabase/functions/_shared/intake-extract.mjs";
import { intakeFileMatches } from "../supabase/functions/_shared/intake-file.mjs";

const question = { pageNumber: 2, confidence: 0.8, type: "MCQ", prompt: "A fictional observation question",
  options: [], answer: null, explanation: "", topic: "", visualDependency: null };
const response = questions => ({ id: "fictional-response", output: [{ content: [{ type: "output_text", text: JSON.stringify({ questions }) }] }] });
const pdf = new Blob(["%PDF-1.7\nFictional byte-signature fixture"], { type: "application/pdf" });

test("PDF and image extraction preserve unknown source facts in a bounded structured schema", () => {
  const request = buildIntakeExtractionRequest({ model: "configured", name: "paper.pdf", mimeType: "application/pdf", dataUrl: "data:application/pdf;base64,AA==" });
  const image = buildIntakeExtractionRequest({ model: "configured", name: "photo.png", mimeType: "image/png", dataUrl: "data:image/png;base64,AA==" });
  assert.equal(request.input[0].content[1].type, "input_file");
  assert.equal(image.input[0].content[1].type, "input_image");
  assert.equal(request.text.format.strict, true);
  assert.equal(request.text.format.schema.properties.questions.maxItems, 100);
  assert.deepEqual(parseIntakeExtractionResponse(response([question])), [question]);
  assert.deepEqual(parseIntakeExtractionResponse(response([{ ...question, pageNumber: null, confidence: null }])), [{ ...question, pageNumber: null, confidence: null }]);
  assert.throws(() => parseIntakeExtractionResponse(response([])), /question count/);
  for (const changes of [{ pageNumber: -1 }, { confidence: 2 }, { answer: {} }, { options: null }, { visualDependency: undefined }, { prompt: "x" }]) {
    assert.throws(() => parseIntakeExtractionResponse(response([{ ...question, ...changes }])), /invalid question candidate/);
  }
  assert.throws(() => parseIntakeExtractionResponse({ output: [] }), /structured output/);
  assert.throws(() => parseIntakeExtractionResponse({ ...response([question]), status: "incomplete" }), /not complete/);
});

test("private intake checks declared file types before an upload or extraction", async () => {
  assert.equal(intakeFileMatches(new Uint8Array(await pdf.arrayBuffer()), "application/pdf"), true);
  assert.equal(intakeFileMatches(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"), true);
  assert.equal(intakeFileMatches(new Uint8Array(await pdf.arrayBuffer()), "image/png"), false);
  assert.equal(intakeFileMatches(new TextEncoder().encode("<svg/>"), "application/pdf"), false);
});

test("a duplicate extraction cannot fail the active worker or send the source twice", async () => {
  const calls = [];
  let claimed = false;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const admin = {
    rpc: async (name, input) => {
      calls.push([name, input]);
      if (name === "claim_question_intake_asset") {
        if (claimed) return { error: { message: "Busy" } };
        claimed = true;
        return { data: { token: "run-1", name: "fixture.pdf", storagePath: "private/fixture.pdf", mimeType: "application/pdf", byteSize: pdf.size } };
      }
      return { data: name === "complete_question_intake_asset" ? 1 : null };
    },
    storage: { from: () => ({ download: async () => ({ data: pdf }) }) },
  };
  let providerCalls = 0;
  const run = () => extractIntakeAsset({ admin, actorId: "fixture-admin", assetId: "fixture", model: "fictional-model", apiKey: "fictional-key",
    fetcher: async (url, request) => {
      providerCalls++;
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(JSON.parse(request.body).input[0].content[1].filename, "fixture.pdf");
      assert.ok(request.signal instanceof AbortSignal);
      await pending;
      return Response.json(response([question]));
    },
  });
  const first = run();
  await Promise.resolve();
  assert.equal((await run()).status, 409);
  assert.equal(calls.some(([name]) => name === "fail_question_intake_asset"), false);
  release();
  assert.equal((await first).status, 200);
  assert.equal(providerCalls, 1);
  assert.equal(calls.filter(([name]) => name === "complete_question_intake_asset").length, 1);
  assert.equal(calls.find(([name]) => name === "complete_question_intake_asset")[1].p_token, "run-1");
});

test("failed extraction does not send mismatched source bytes or expose provider messages", async () => {
  for (const mismatch of [true, false]) {
    const calls = [];
    let sent = false;
    const admin = {
      rpc: async (name, input) => {
        calls.push([name, input]);
        return { data: name === "claim_question_intake_asset"
          ? { token: "run-1", storagePath: "private/fixture.pdf", mimeType: "application/pdf", byteSize: pdf.size + Number(mismatch) } : null };
      },
      storage: { from: () => ({ download: async () => ({ data: pdf }) }) },
    };
    const result = await extractIntakeAsset({ admin, actorId: "fixture-admin", assetId: "fixture", model: "fictional-model", apiKey: "fictional-key",
      fetcher: async () => { sent = true; throw new Error("Sensitive provider diagnostic"); },
    });
    assert.equal(result.status, 400);
    assert.equal(sent, !mismatch);
    assert.doesNotMatch(JSON.stringify(result), /Sensitive/);
    assert.equal(calls.filter(([name]) => name === "fail_question_intake_asset").length, 1);
    assert.equal(calls.some(([name]) => name === "complete_question_intake_asset"), false);
  }
});

test("extraction requires the caller identity and a token-aware backend before sending source content", async () => {
  let claimed = false, sent = false;
  const admin = { rpc: async () => { claimed = true; return { data: {} }; } };
  const config = { admin, assetId: "fixture", model: "fixture-model", apiKey: "fictional", fetcher: async () => { sent = true; } };
  assert.equal((await extractIntakeAsset(config)).status, 403);
  assert.equal(claimed, false);
  assert.equal((await extractIntakeAsset({ ...config, actorId: "fixture-editor" })).status, 503);
  assert.equal(sent, false);
});

test("extraction refuses a same-length private source whose registered digest differs", async () => {
  const calls = [];
  const admin = {
    async rpc(method) {
      calls.push(method);
      if (method === "claim_question_intake_asset") return { data: {
        token: "fixture-token", name: "fixture.pdf", storagePath: "private/fixture.pdf", mimeType: "application/pdf",
        byteSize: pdf.size, sourceSha256: "a".repeat(64),
      } };
      return { data: null };
    },
    storage: { from: () => ({ download: async () => ({ data: pdf }) }) },
  };
  let sent = false;
  const result = await extractIntakeAsset({ admin, actorId: "fixture-admin", assetId: "fixture", model: "fixture-model",
    apiKey: "fictional-key", fetcher: async () => { sent = true; } });
  assert.equal(result.status, 400);
  assert.equal(sent, false);
  assert.deepEqual(calls, ["claim_question_intake_asset", "fail_question_intake_asset"]);
});
