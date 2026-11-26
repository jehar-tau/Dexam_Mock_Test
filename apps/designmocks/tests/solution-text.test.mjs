import test from "node:test";
import assert from "node:assert/strict";
import { parseSolutionText } from "../src/solution-text.mjs";

const full = ["Two features change between otherwise identical tiles, so test whether one predicts the other.", "",
  "1. Note which side each tile points to.", "2. Compare that side with the number on the tile.", "continuing the second step.", "",
  "Options:", "A — wrong: It matches the rule.", "B — correct: It breaks the rule.", "",
  "Trap: Looking for digit patterns.", "Faster: Pair the two features first."].join("\n");

test("a plan explanation splits into key idea, steps, options, trap and faster method", () => {
  assert.deepEqual(parseSolutionText(full), {
    keyIdea: "Two features change between otherwise identical tiles, so test whether one predicts the other.",
    steps: ["Note which side each tile points to.", "Compare that side with the number on the tile. continuing the second step."],
    options: [{ option: "A", verdict: "wrong", why: "It matches the rule." }, { option: "B", verdict: "correct", why: "It breaks the rule." }],
    trap: "Looking for digit patterns.", faster: "Pair the two features first.",
  });
});

test("explanations without the structure fall back to plain text", () => {
  assert.equal(parseSolutionText("Read the occupied squares row by row. Their sum is nine."), null);
  assert.equal(parseSolutionText(""), null);
  assert.equal(parseSolutionText("Key idea.\n\nOptions:\nnot an option line"), null);
  assert.equal(parseSolutionText("Key idea only.\n\nTrap: nothing else"), null);
});
