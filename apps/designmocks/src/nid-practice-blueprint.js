export const nidPracticeSchema = "nid-authored-practice-v1";
export const nidPracticeKinds = Object.freeze({ mcq: "Single-choice", msq: "Multiple-choice set", nat: "Numeric answer", drawing: "Drawing upload", written: "Written pages upload" });
export const isHumanTask = kind => kind === "drawing" || kind === "written";
const fail = message => { throw new Error(message); };
const keys = (value, expected) => value && !Array.isArray(value) && typeof value === "object" && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const text = (value, min, max) => typeof value === "string" && value === value.trim() && value.length >= min && value.length <= max;
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

// Work in hundredths when adding rubric weights; binary floating point must not
// decide whether the authored maximum and its criteria agree.
export function markHundredths(value) {
  const raw = String(value);
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(raw)) fail("Marks need at most two decimal places.");
  const [whole, fraction = ""] = raw.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function validateNidPracticeBlueprint(payload) {
  if (!keys(payload, ["schemaVersion", "title", "purpose", "durationMinutes", "uploadGraceMinutes", "sections"]) || payload.schemaVersion !== nidPracticeSchema)
    fail("Use the authored NID practice blueprint format.");
  if (!text(payload.title, 3, 160) || !text(payload.purpose, 20, 2000)) fail("Add a title and a practice purpose of at least 20 characters.");
  if (!integer(payload.durationMinutes, 1, 360)) fail("Choose a practice duration from 1 to 360 minutes.");
  if (!Array.isArray(payload.sections) || payload.sections.length < 1 || payload.sections.length > 8) fail("Add between one and eight practice sections.");
  const labels = new Set();
  let questionCount = 0, totalHundredths = 0, human = false;
  for (const section of payload.sections) {
    if (!keys(section, ["label", "kind", "count", "points", "penalty", "rubric"]) || !Object.hasOwn(nidPracticeKinds, section.kind) || !text(section.label, 3, 120))
      fail("Each section needs a label and a supported response type.");
    const label = section.label.toLowerCase();
    if (labels.has(label)) fail("Section labels must be unique.");
    labels.add(label);
    if (!integer(section.count, 1, 100)) fail("Each section needs a whole question count from 1 to 100.");
    if (typeof section.points !== "number" || typeof section.penalty !== "number") fail("Enter numeric marks and penalties.");
    const points = markHundredths(section.points), penalty = markHundredths(section.penalty);
    if (points < 1 || points > 10000 || penalty > points) fail("Marks must be above zero and at most 100; the penalty cannot exceed them.");
    if (!Array.isArray(section.rubric)) fail("Each section needs an explicit rubric list.");
    if (isHumanTask(section.kind)) {
      human = true;
      if (penalty !== 0 || section.rubric.length < 1 || section.rubric.length > 12) fail("Upload tasks need zero penalty and one to twelve rubric criteria.");
      let sum = 0;
      const criteria = new Set();
      for (const criterion of section.rubric) {
        if (!keys(criterion, ["label", "points", "guidance"]) || !text(criterion.label, 3, 120) || !text(criterion.guidance, 10, 1000) || typeof criterion.points !== "number")
          fail("Each rubric criterion needs a label, numeric marks and at least ten characters of guidance.");
        const weight = markHundredths(criterion.points), key = criterion.label.toLowerCase();
        if (weight < 1 || weight > 10000 || criteria.has(key)) fail("Rubric labels must be unique and their marks above zero and at most 100.");
        criteria.add(key); sum += weight;
      }
      if (sum !== points) fail(`Rubric marks for ${section.label} must equal its per-question maximum.`);
    } else if (section.rubric.length !== 0) fail("Objective sections cannot carry a human rubric.");
    questionCount += section.count; totalHundredths += section.count * points;
  }
  if (questionCount > 100) fail("A practice blueprint can contain at most 100 questions.");
  if (human ? ![10, 15].includes(payload.uploadGraceMinutes) : payload.uploadGraceMinutes !== 0)
    fail(human ? "Choose ten or fifteen minutes for uploading the completed pages." : "Objective-only practice has no image-upload grace.");
  if (new TextEncoder().encode(JSON.stringify(payload)).length > 64000) fail("This practice blueprint is too large.");
  return { questionCount, totalPoints: totalHundredths / 100, humanReview: human };
}

export const newNidSection = () => ({ label: "", kind: "", count: "", points: "", penalty: "", rubric: [] });
export const newNidBlueprint = () => ({ schemaVersion: nidPracticeSchema, title: "", purpose: "", durationMinutes: "", uploadGraceMinutes: "", sections: [newNidSection()] });
export function nidBlueprintInput(draft) {
  const number = value => typeof value === "number" ? value : /^\d+(?:\.\d{1,2})?$/.test(value) ? Number(value) : NaN;
  const result = { schemaVersion: nidPracticeSchema, title: draft.title.trim(), purpose: draft.purpose.trim(),
    durationMinutes: number(draft.durationMinutes), uploadGraceMinutes: number(draft.uploadGraceMinutes),
    sections: draft.sections.map(section => ({ label: section.label.trim(), kind: section.kind, count: number(section.count), points: number(section.points), penalty: number(section.penalty),
      rubric: section.rubric.map(criterion => ({ label: criterion.label.trim(), points: number(criterion.points), guidance: criterion.guidance.trim() })) })) };
  validateNidPracticeBlueprint(result);
  return result;
}
