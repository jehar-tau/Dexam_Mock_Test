// Private authoring helpers. Source questions and figures stay outside public assets.
import {intakeFileMatches} from "../supabase/functions/_shared/intake-file.mjs";

const reviewText = value => typeof value === "string" ? value : "";

export const isIntakePhoto = mimeType => ["image/png", "image/jpeg", "image/webp"].includes(mimeType);

export async function intakePhotoBlob(blob, {mimeType, byteSize}) {
  const error = "The source photo could not be verified. Download the original to inspect it separately.";
  if (!isIntakePhoto(mimeType) || !(blob instanceof Blob) || !blob.size || blob.size !== byteSize) throw new Error(error);
  const signature = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (!intakeFileMatches(signature, mimeType)) throw new Error(error);
  return blob.slice(0, blob.size, mimeType);
}

export function intakeReviewValues(payload = {}) {
  const supplied = Array.isArray(payload.options) ? payload.options : [];
  return {
    exam: reviewText(payload.provenance?.exam).trim().toLowerCase(),
    type: payload.type ?? "MCQ",
    prompt: reviewText(payload.prompt),
    topic: reviewText(payload.topic),
    explanation: reviewText(payload.explanation),
    options: supplied.length ? supplied.map(option => ({
      key: reviewText(option?.key ?? option?.id), text: reviewText(option?.text),
    })) : ["A", "B", "C", "D"].map(key => ({ key, text: "" })),
    answer: Array.isArray(payload.answer) ? payload.answer.map(reviewText).join(", ") :
      typeof payload.answer === "object" ? reviewText(payload.answer?.raw) : reviewText(payload.answer),
    visualDependency: typeof payload.visualDependency === "boolean" ? String(payload.visualDependency) : "",
    assets: Array.isArray(payload.assets) ? payload.assets : [],
  };
}

export function intakeReviewPayload(values) {
  return {
    type: values.type, prompt: values.prompt.trim(), topic: values.topic.trim(),
    explanation: values.explanation.trim(), provenance: { exam: values.exam },
    options: ["MCQ", "MSQ"].includes(values.type)
      ? values.options.map(option => ({ key: option.key.trim(), text: option.text.trim(), asset: null })) : [],
    answer: values.type === "DESCRIPTIVE" ? null : { raw: values.answer.trim(), status: "pending" },
    visualDependency: values.visualDependency === "true", assets: values.visualDependency === "true" ? values.assets : [],
    holds: ["intake-human-review"],
  };
}

export { intakeFigureDescriptor } from "../supabase/functions/_shared/intake-file.mjs";
