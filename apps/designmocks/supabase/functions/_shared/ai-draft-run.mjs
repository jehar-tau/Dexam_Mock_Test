import { buildAiDraftRequest, parseAiDraftResponse } from "./ai-draft.mjs";

export async function runAiDraft({ caller, worker, actorId, input, model, apiKey, fetcher = fetch }) {
  if (typeof actorId !== "string") return { status: 403, body: { error: "Admin identity is required for drafting" } };
  const retry = input?.requestId != null;
  if (retry && typeof input.requestId !== "string") return { status: 400, body: { error: "A draft request id is required" } };
  let requestId = input?.requestId;
  if (!retry) {
    const created = await caller.rpc("admin_create_ai_draft_request", {
      p_exam: input?.exam, p_topic: input?.topic, p_question_type: input?.questionType,
      p_instruction: input?.instruction, p_basis_external_keys: input?.basisExternalKeys,
    });
    if (created.error) return { status: created.error.code === "42501" ? 403 : 400, body: { error: created.error.message } };
    requestId = created.data;
  }
  const claimed = await worker.rpc("claim_ai_draft_request", { p_request_id: requestId, p_actor_id: actorId, p_retry: retry });
  if (claimed.error) return { status: claimed.error.code === "42501" ? 403 : 409, body: { error: claimed.error.message } };
  const token = claimed.data?.token;
  if (typeof token !== "string") return { status: 503, body: { error: "Question processing is temporarily unavailable. Contact the operator before retrying." } };
  try {
    const basis = await caller.rpc("admin_ai_draft_basis", { p_request_id: requestId });
    if (basis.error) throw new Error("Draft references are unavailable");
    const generated = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(buildAiDraftRequest({ ...basis.data, model })), signal: AbortSignal.timeout(60000),
    });
    if (!generated.ok) throw new Error("Draft provider request failed");
    const response = await generated.json();
    if (response.error || response.status && response.status !== "completed") throw new Error("Incomplete draft response");
    const completed = await worker.rpc("complete_ai_draft_request", {
      p_request_id: requestId, p_model: model, p_response_id: response.id, p_payload: parseAiDraftResponse(response), p_token: token,
    });
    if (completed.error) throw new Error("Draft failed review validation");
    return { status: 200, body: { requestId, draftId: completed.data, status: "succeeded" } };
  } catch {
    const error = "Draft processing failed. Check the reference approvals and configured provider before retrying.";
    await worker.rpc("fail_ai_draft_request", { p_request_id: requestId, p_model: model, p_error: error, p_token: token });
    return { status: 400, body: { requestId, error } };
  }
}
