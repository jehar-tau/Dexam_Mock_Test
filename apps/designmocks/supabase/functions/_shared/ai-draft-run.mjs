import { drawingRequestBody } from "./drawing-request.mjs";
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
    if (created.error?.code === "42501") return { status: 403, body: { error: "Admin access required" } };
    if (created.error) return { status: 400, body: { error: created.error.message } };
    requestId = created.data;
  }
  const claimed = await worker.rpc("claim_ai_draft_request", { p_request_id: requestId, p_actor_id: actorId, p_retry: retry });
  if (claimed.error?.code === "42501") return { status: 403, body: { error: "Admin access required" } };
  if (claimed.error) return { status: 409, body: { error: claimed.error.message } };
  const token = claimed.data?.token;
  if (typeof token !== "string") return { status: 503, body: { error: "Question processing is temporarily unavailable. Contact the operator before retrying." } };
  try {
    const basis = await worker.rpc("read_ai_draft_provider_basis", {
      p_request_id: requestId, p_actor_id: actorId, p_token: token,
    });
    if (basis.error) throw basis.error;
    if (basis.data?.requestId !== requestId || !Array.isArray(basis.data.basis) || !basis.data.basis.length) {
      throw new Error("Current draft references are unavailable");
    }
    const generated = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(buildAiDraftRequest({ ...basis.data, model })), signal: AbortSignal.timeout(60000), redirect: "error",
    });
    if (!generated.ok) throw new Error("Draft provider request failed");
    const bytes = await drawingRequestBody(generated, 256 * 1024);
    const response = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes));
    if (response.error || response.status && response.status !== "completed") throw new Error("Incomplete draft response");
    const completed = await worker.rpc("complete_ai_draft_request", {
      p_request_id: requestId, p_model: model, p_response_id: response.id, p_payload: parseAiDraftResponse(response), p_token: token,
    });
    if (completed.error) throw completed.error;
    if (typeof completed.data !== "string" || !completed.data) throw new Error("Draft receipt is incomplete");
    return { status: 200, body: { requestId, draftId: completed.data, status: "succeeded" } };
  } catch (failure) {
    const status = failure?.code === "42501" ? 403 : failure?.code === "40001" ? 409 : 400;
    const error = status === 403 ? "Admin access required" : status === 409
      ? "The draft job or its references changed. Refresh the queue before retrying."
      : "Draft processing failed. Check the reference approvals and configured provider before retrying.";
    try {
      await worker.rpc("fail_ai_draft_request", { p_request_id: requestId, p_model: model, p_error: error, p_token: token });
    } catch {
      // An unconfirmed cleanup can expire without hiding the original denial.
    }
    return { status, body: { requestId, error } };
  }
}
