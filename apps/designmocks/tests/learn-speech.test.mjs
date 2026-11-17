import test from "node:test";
import assert from "node:assert/strict";
import { chooseVoice, readSpokenPreference, speechText, SPEECH_MAX, SPOKEN_FEEDBACK_KEY, writeSpokenPreference } from "../src/learn/speech.mjs";

test("notation is spelled out so it reads naturally", () => {
  assert.equal(speechText("Each face is 3 × 3, so 9 squares."), "Each face is 3 times 3, so 9 squares.");
  assert.equal(speechText("Turn it 90° clockwise → the top moves right."), "Turn it 90 degrees clockwise to the top moves right.");
  assert.equal(speechText("Area is πr² and volume is a³."), "Area is pi r squared and volume is a cubed.");
  assert.equal(speechText("12 ÷ 4 = 3 and √16 = 4."), "12 divided by 4 equals 3 and the square root of 16 equals 4.");
  assert.equal(speechText("Between 3–5 cubes; 10 - 4 leaves 6; 1/4 is 25%."), "Between 3 to 5 cubes; 10 minus 4 leaves 6; 1 over 4 is 25 percent.");
  assert.equal(speechText("A two-point grid, not a well-known trick."), "A two-point grid, not a well-known trick.");
});

test("markup is dropped, spaces are tidied and long text stops at a sentence", () => {
  assert.equal(speechText("  **Squares**   A and F   ,  overlap . "), "Squares A and F, overlap.");
  assert.equal(speechText(null), "");
  const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} explains one more step of the method.`).join(" ");
  const spoken = speechText(long);
  assert.ok(spoken.length <= SPEECH_MAX); assert.ok(spoken.endsWith(".")); assert.ok(spoken.startsWith("Sentence number 0"));
});

test("an Indian English voice is preferred, then British, then any English, never another language", () => {
  const voices = [{ name: "Hindi", lang: "hi-IN" }, { name: "US", lang: "en-US", default: true }, { name: "UK", lang: "en_GB" }, { name: "India", lang: "en-IN" }];
  assert.equal(chooseVoice(voices).name, "India");
  assert.equal(chooseVoice(voices.slice(0, 3)).name, "UK");
  assert.equal(chooseVoice(voices.slice(0, 2)).name, "US");
  assert.equal(chooseVoice([{ name: "Hindi", lang: "hi-IN" }]), null);
  assert.equal(chooseVoice(undefined), null);
});

test("the switch is remembered per device and is off unless turned on", () => {
  const store = new Map(), storage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  assert.equal(readSpokenPreference(storage), false);
  writeSpokenPreference(storage, true); assert.equal(store.get(SPOKEN_FEEDBACK_KEY), "on"); assert.equal(readSpokenPreference(storage), true);
  writeSpokenPreference(storage, false); assert.equal(readSpokenPreference(storage), false);
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(readSpokenPreference(broken), false); assert.doesNotThrow(() => writeSpokenPreference(broken, true));
});

import { allowLearnSpokenFeedback } from "../src/launch-scope.mjs";
test("spoken feedback is released only with the post-launch preview", () => {
  assert.equal(allowLearnSpokenFeedback(true), true);
  for (const value of [false, undefined, "true", 1]) assert.equal(allowLearnSpokenFeedback(value), false);
});
