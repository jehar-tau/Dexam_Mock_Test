export const sampleQuestions = [
  {
    id: "rotation",
    topic: "Spatial thinking",
    title: "Same shape. A quarter-turn clockwise.",
    instruction: "Which option matches the shape after the turn?",
    kind: "rotation",
    answer: 2,
    explanation:
      "Track the long arm and the small square together. A clockwise turn changes their direction, while their connection stays the same.",
    practice:
      "Pick a small object. Sketch it from the front, then imagine it turned 90°. Check by turning the real object.",
  },
  {
    id: "contrast",
    topic: "Light & colour",
    title: "Which pair has the strongest contrast?",
    instruction: "Compare light against dark, rather than the hue.",
    kind: "contrast",
    answer: 1,
    explanation:
      "The darkest ink against the lightest paper creates the largest light–dark separation in these four pairs.",
    practice:
      "Photograph three signs and view them in greyscale. Notice which lettering stays clear when colour disappears.",
  },
  {
    id: "sequence",
    topic: "Pattern recognition",
    title: "What belongs in the empty tile?",
    instruction: "Read the relationship across each row.",
    kind: "sequence",
    answer: 2,
    explanation:
      "Each row adds one item at a time: one, two, then three. The shape changes between rows; the count rule stays the same.",
    practice:
      "Look for a repeating system in tiles, railings or packaging. Describe its rule, then draw the next three steps.",
  },
  {
    id: "hierarchy",
    topic: "Visual hierarchy",
    title: "Title first. Date second. Venue last.",
    instruction: "Which poster follows this order most clearly?",
    kind: "hierarchy",
    answer: 0,
    explanation:
      "The first layout gives the title the largest type, the date the next-largest, and the venue the quietest treatment.",
    practice:
      "Choose a poster. Write down the first three things your eye reads. Rebuild it using only three sizes of type.",
  },
  {
    id: "negative",
    topic: "Observation",
    title: "Count the enclosed white spaces.",
    instruction: "Count only complete spaces inside the dark shape.",
    kind: "negative",
    answer: 3,
    explanation:
      "There are four fully enclosed white spaces. The open notch at the edge does not count as an enclosed space.",
    practice:
      "Study letterforms, a bicycle frame or a chair. Draw the empty spaces first, then add the object around them.",
  },
];
export function sampleReport(answers = {}) {
  const items = sampleQuestions.map((q) => ({
    ...q,
    chosen: answers[q.id] ?? null,
    correct: answers[q.id] === q.answer,
  }));
  return {
    items,
    correct: items.filter((q) => q.correct).length,
    total: items.length,
    answered: items.filter((q) => q.chosen !== null).length,
    focus: items.filter((q) => !q.correct).slice(0, 3),
  };
}
export const SAMPLE_STORAGE = "designmocks-experience-sample-v1";

export function restoreSample(raw) {
  try {
    const state = JSON.parse(raw);
    if (
      !state ||
      !["active", "submitted"].includes(state.status) ||
      !Number.isFinite(state.startedAt) ||
      !Number.isFinite(state.deadline) ||
      state.deadline - state.startedAt !== 360000 ||
      !state.answers ||
      Array.isArray(state.answers) ||
      typeof state.answers !== "object" ||
      !Array.isArray(state.flagged)
    )
      return null;
    const ids = sampleQuestions.map((q) => q.id);
    return {
      ...state,
      answers: Object.fromEntries(
        Object.entries(state.answers).filter(
          ([id, value]) =>
            ids.includes(id) &&
            Number.isInteger(value) &&
            value >= 0 &&
            value < 4,
        ),
      ),
      flagged: [...new Set(state.flagged.filter((id) => ids.includes(id)))],
    };
  } catch {
    return null;
  }
}
