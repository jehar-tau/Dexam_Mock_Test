const correctOutcomes = new Set(["correct", "full_marks"]);
const releasedOutcomes = new Set([...correctOutcomes, "wrong", "incorrect", "partial", "unanswered"]);

// Marks such as -0.71 add up with binary floating-point error
// (3 + 5 × -0.71 = -0.5499999999999998). Papers mark in at most two decimals.
export function roundMarks(value) {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

// Scores shown beside a total ("61.33 / 100"); leaves missing values alone.
export function displayMarks(value) {
  const number = Number(value);
  return value == null || value === "" || !Number.isFinite(number) ? value : roundMarks(number);
}

function summarize(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key) ?? { key, total: 0, answered: 0, correct: 0 };
    group.total += 1;
    const answered = Array.isArray(item.answer) ? item.answer.length > 0 : item.answer != null && String(item.answer).trim() !== "";
    if (answered) {
      group.answered += 1;
      if (correctOutcomes.has(item.outcome)) group.correct += 1;
    }
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, accuracy: group.answered ? Math.round(group.correct * 100 / group.answered) : null }));
}

// Marks a released question earned: the server's awarded value when present,
// otherwise only what the outcome and the question's marking fix exactly.
export function knownMarks(item) {
  if (Number.isFinite(item?.awarded)) return item.awarded;
  const outcome = releasedOutcome(item), marking = item?.marking ?? {};
  if (outcome === "correct" || outcome === "full_marks") return Number.isFinite(marking.correct) ? marking.correct : Number.isFinite(item.points) ? item.points : null;
  if (outcome === "wrong") return Number.isFinite(marking.wrong) ? marking.wrong : null;
  if (outcome === "unanswered" || outcome === "dropped") return 0;
  return null;
}

function addMarks(rows, items, keyOf) {
  return rows.map(row => {
    const group = items.filter(item => keyOf(item) === row.key);
    const values = group.map(knownMarks);
    const available = group.reduce((sum, item) => sum + (Number.isFinite(item.marking?.correct) ? item.marking.correct : Number.isFinite(item.points) ? item.points : 0), 0);
    return { ...row, marks: values.every(value => value !== null) ? roundMarks(values.reduce((a, b) => a + b, 0)) : null,
      marksExcludingPartial: roundMarks(values.reduce((a, b) => a + (b ?? 0), 0)), partialPending: values.filter(value => value === null).length, available: roundMarks(available) };
  });
}

export function buildAttemptInsights(questions = []) {
  const objective = questions.filter((item) => item.kind !== "drawing" && releasedOutcomes.has(item.outcome));
  const topics = summarize(objective, (item) => item.topic || "unclassified").sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  const sectionKey = (item) => String(item.kind || "other").toUpperCase();
  const sections = addMarks(summarize(objective, sectionKey).sort((a, b) => a.key.localeCompare(b.key)), objective, sectionKey);
  const recommended = topics.filter((item) => item.answered > 0).sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered || a.key.localeCompare(b.key))[0] ?? null;
  return { topics, sections, recommended };
}

export const outcomeLabels = {
  correct: "Correct", wrong: "Incorrect", partial: "Partial credit",
  unanswered: "Unanswered", full_marks: "Full marks awarded", dropped: "Dropped",
};

export function releasedOutcome(item) {
  const key = item.outcome === "incorrect" ? "wrong" : item.outcome;
  return item.kind !== "drawing" && Object.hasOwn(outcomeLabels, key) ? key : null;
}

// Counts are based on the released grading snapshot. A dropped item has no bearing
// on coverage or accuracy, but stays available in the question review.
export function responseSummary(questions) {
  const items = questions.filter(item => releasedOutcome(item) && item.outcome !== "dropped");
  const [summary] = summarize(items, () => "all");
  const counts = Object.fromEntries(Object.keys(outcomeLabels).map(key => [key, 0]));
  for (const item of items) counts[releasedOutcome(item)]++;
  return {total: items.length, answered: summary?.answered ?? 0, accuracy: summary?.accuracy ?? null, counts};
}

const signed = value => value > 0 ? "+" + value : value < 0 ? "−" + Math.abs(value) : "0";
// Marks are shown only where the released outcome fixes them exactly.
export function reviewMarks(item) {
  if (Number.isFinite(item?.awarded) && releasedOutcome(item)) return signed(item.awarded);
  const outcome = releasedOutcome(item), marking = item?.marking ?? {};
  if (outcome === "correct" || outcome === "full_marks") {
    const value = Number.isFinite(marking.correct) ? marking.correct : item.points;
    return Number.isFinite(value) ? signed(value) : null;
  }
  if (outcome === "wrong") return Number.isFinite(marking.wrong) ? signed(marking.wrong) : null;
  if (outcome === "unanswered") return "0";
  return null;
}
