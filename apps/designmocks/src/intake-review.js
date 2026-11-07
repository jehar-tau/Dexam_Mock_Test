// Private authoring helpers. Source questions and figures stay outside public assets.
const reviewText = value => typeof value === "string" ? value : "";

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
