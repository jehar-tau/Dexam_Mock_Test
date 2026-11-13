import { drawingRequestBody } from "./drawing-request.mjs";

export class JsonRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function readJsonObject(request, limit, purpose) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    throw new JsonRequestError(`Use a JSON ${purpose} request.`, 415);
  }
  try {
    const bytes = await drawingRequestBody(request, limit);
    const input = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes));
    if (input && typeof input === "object" && !Array.isArray(input)) return input;
  } catch (error) {
    if (error?.code === "request_size") throw new JsonRequestError(`The private ${purpose} request is too large.`, 413);
  }
  throw new JsonRequestError(`Use a valid JSON ${purpose} request.`, 400);
}
