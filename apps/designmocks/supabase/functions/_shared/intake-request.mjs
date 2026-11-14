import { readJsonObject } from "./request-json.mjs";
import { drawingRequestBody } from "./drawing-request.mjs";
import { INTAKE_FIGURE_MAX_BYTES } from "./intake-limits.mjs";

const SOURCE_MAX_BYTES = 25 * 1024 * 1024;
const FORM_MAX_BYTES = SOURCE_MAX_BYTES + 64 * 1024;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const isIntakeAssetId = value => typeof value === "string" && uuid.test(value);

export class IntakeRequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function readBounded(request, limit) {
  try {
    return await drawingRequestBody(request, limit);
  } catch (error) {
    if (error?.code === "request_size") throw new IntakeRequestError("The private intake request is too large.", 413);
    throw new IntakeRequestError("Could not read the private intake request.");
  }
}

export function readIntakeJson(request) {
  return readJsonObject(request, 4096, "intake");
}

export async function readIntakeUpload(request) {
  const type = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(type)) {
    throw new IntakeRequestError("Use a PDF, PNG, JPEG or WebP upload.", 415);
  }
  const bytes = await readBounded(request, FORM_MAX_BYTES);
  let form;
  try {
    form = await new Response(bytes, {headers: {"content-type": type}}).formData();
  } catch {
    throw new IntakeRequestError("The private intake upload could not be read.");
  }
  const file = form.get("file");
  const assetId = form.get("assetId");
  const figure = form.get("purpose") === "figure";
  const fields = figure ? ["file", "purpose", "assetId"] : ["file"];
  if ([...form.keys()].length !== fields.length || fields.some(field => form.getAll(field).length !== 1)) {
    throw new IntakeRequestError("Unexpected or repeated private intake upload fields.");
  }
  if (!(file instanceof File) || !file.size ||
      !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new IntakeRequestError("Use a PDF, PNG, JPEG or WebP up to 25 MB.");
  }
  if (figure && (file.type !== "image/png" || !isIntakeAssetId(assetId))) {
    throw new IntakeRequestError("A PNG figure and intake source are required.");
  }
  if (file.size > (figure ? INTAKE_FIGURE_MAX_BYTES : SOURCE_MAX_BYTES)) {
    throw new IntakeRequestError(figure ? "Use a PNG figure up to 10 MB." : "Use a source file up to 25 MB.", 413);
  }
  return {file, assetId: figure ? String(assetId).toLowerCase() : null};
}
