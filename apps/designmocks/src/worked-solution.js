// Structured annotations share the already private, frozen explanation channel.
const prefix = "dmocks:worked-solution-v1\n";
const shapes = new Set(["circle", "ellipse", "rect", "line", "polyline", "polygon", "path", "text", "g"]);
const attributes = new Set([
  "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "width", "height",
  "points", "d", "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray",
  "stroke-linecap", "stroke-linejoin", "opacity", "font-size", "font-weight", "text-anchor", "transform",
]);
const svgValue = /^[-#%.,()0-9A-Za-z \t]{1,1200}$/;
const digest = /^[0-9a-f]{64}$/;
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value, max) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const dimension = (n) => Number.isSafeInteger(n) && n >= 1 && n <= 8192;

export function workedFigureIndex(media, figure) {
  if (!Array.isArray(media)) return -1;
  return media.findIndex((item) => item?.sha256 === figure.sha256
    && item.width === figure.width && item.height === figure.height);
}

export function validateWorkedSolution(value, media) {
  if (!record(value) || value.version !== 1 || !text(value.keyIdea, 8000) || !record(value.figure)
    || typeof value.figure.sha256 !== "string" || !digest.test(value.figure.sha256)
    || !dimension(value.figure.width) || !dimension(value.figure.height)
    || workedFigureIndex(media, value.figure) < 0
    || !Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 8) return null;
  let remaining = 96;
  function shape(annotation, depth) {
    if (!record(annotation) || !shapes.has(annotation.tag) || !record(annotation.attrs)
      || --remaining < 0 || depth > 4) return null;
    const attrs = Object.entries(annotation.attrs);
    if (attrs.some(([name, attr]) => !attributes.has(name) || typeof attr !== "string"
      || !svgValue.test(attr) || /url/i.test(attr))) return null;
    const parsed = { tag: annotation.tag, attrs: Object.fromEntries(attrs) };
    if (annotation.text !== undefined) {
      if (annotation.tag !== "text" || !text(annotation.text, 160)) return null;
      parsed.text = annotation.text;
    }
    if (annotation.children !== undefined) {
      if (annotation.tag !== "g" || !Array.isArray(annotation.children) || annotation.children.length > remaining) return null;
      const children = annotation.children.map((child) => shape(child, depth + 1));
      if (children.includes(null)) return null;
      parsed.children = children;
    }
    return parsed;
  }
  const steps = [];
  for (const step of value.steps) {
    if (!record(step) || !text(step.text, 8000) || !Array.isArray(step.shapes) || step.shapes.length > remaining) return null;
    const annotations = step.shapes.map((annotation) => shape(annotation, 1));
    if (annotations.includes(null)) return null;
    steps.push({ text: step.text, shapes: annotations });
  }
  if (!steps.some((step) => step.shapes.length)) return null;
  const { sha256, width, height } = value.figure;
  const solution = { version: 1, figure: { sha256, width, height }, keyIdea: value.keyIdea, steps };
  return JSON.stringify(solution).length <= 32000 ? solution : null;
}

export function encodeWorkedExplanation(explanation, solution) {
  return prefix + JSON.stringify({ explanation, solution });
}

export function hasWorkedExplanation(value) {
  return typeof value === "string" && value.startsWith(prefix);
}

export function readWorkedExplanation(attempt, item) {
  const hidden = { explanation: "", solution: null };
  if (attempt?.status !== "submitted" || attempt.resultsPending || attempt.examResultsPending) return hidden;
  const stored = item?.explanation ?? "";
  if (!hasWorkedExplanation(stored)) return { explanation: typeof stored === "string" ? stored : "", solution: null };
  if (stored.length > 52000) return hidden;
  try {
    const { explanation, solution } = JSON.parse(stored.slice(prefix.length));
    if (!text(explanation, 8000)) return hidden;
    return { explanation, solution: validateWorkedSolution(solution, item.media) };
  } catch {
    return hidden;
  }
}
