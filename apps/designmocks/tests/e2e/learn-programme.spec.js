import { expect, test } from "@playwright/test";
import { buildQuiz, generateQuestion } from "../../src/learn/questions.js";
import { countingCubesProgramme } from "../../src/learn/programmes/counting-cubes.js";

// Interactive Learn programmes on the development preview route. Progress
// lives in local storage in Phase 0, so no provider stub is needed.
const programme = "/learn-programme-preview/cube-nets";
const player = page => page.getByRole("dialog");
const feedback = page => player(page).locator(".feedback");

test("the Learn preview lists every programme and opens an overview", async ({ page }) => {
  await page.goto("/learn-preview");
  const list = page.getByLabel("Interactive programmes");
  for (const title of ["Cube nets", "Nets of solids", "Dice", "Paper folding and punching", "Mirror and water images", "Counting cubes", "Views and rotation", "Gears, belts and levers", "Counting figures", "Number and quantity", "Codes and number patterns", "Arrangements and puzzles", "Directions, clocks and calendars", "Visual series and matrices", "Colour", "Shadows and light", "Surfaces of solids", "Sections of solids", "Fit and hidden figures", "Transparent sheets"]) {
    await expect(list.locator("article", { hasText: title })).toBeVisible();
  }
  await list.locator("article", { hasText: "Cube nets" }).getByRole("link", { name: "Start programme" }).click();
  await expect(page).toHaveURL(/\/learn-programme-preview\/cube-nets$/);
  await expect(page.getByRole("heading", { name: "Cube nets", exact: true })).toBeVisible();
  await expect(page.getByLabel("Programme progress")).toContainText("0 of 12 lessons");
  await expect(page.locator(".path-item.is-quiz").getByRole("button", { name: "Take quiz" })).toBeEnabled();
  await expect(page.getByRole("link", { name: /Practise this topic|Browse practice/ })).toHaveAttribute("href", /\/dashboard\/practice\?exam=uceed&topic=visualisation/);
});

test("a lesson runs one screen at a time with Check, feedback and Continue, and keeps progress", async ({ page }) => {
  await page.goto(programme);
  await page.locator(".path-item", { hasText: "From flat to solid" }).getByRole("button", { name: "Start" }).click();
  const dialog = player(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  await expect(dialog.getByRole("heading", { name: "A net is a cube, unfolded" })).toBeVisible();

  // The live figure responds: selecting a square names its face.
  await dialog.getByRole("button", { name: "Square 2, letter B" }).click();
  await expect(dialog.getByRole("status")).toContainText("letter B is the");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("heading", { name: "One square at a time" })).toBeVisible();
  const slider = dialog.getByRole("slider", { name: "Folded squares" });
  await expect(slider).toHaveValue("1");
  await slider.fill("4");
  await expect(dialog.getByRole("status")).toHaveText("4 of 6 squares folded.");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("heading", { name: "Only eleven shapes close" })).toBeVisible();
  await dialog.getByRole("button", { name: "Net 11 of 11, 3-3" }).click();
  await dialog.getByRole("button", { name: "Turn left" }).click();
  await dialog.getByRole("button", { name: "Continue" }).click();

  // A check: Continue is replaced by Check until an answer is chosen.
  await expect(dialog.getByText("Can this shape fold into a closed cube?")).toBeVisible();
  const check = dialog.getByRole("button", { name: "Check" });
  await expect(check).toBeDisabled();
  await dialog.getByRole("button", { name: "No, it cannot close" }).click();
  await check.click();
  await expect(feedback(page)).toContainText("Correct");
  await expect(feedback(page)).toContainText("Squares A and F would land on the same face");
  await expect(dialog.getByRole("button", { name: "Yes, it is a net" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Continue" }).click();

  // Remaining screens: answer every check, read every slide, finish.
  for (let guard = 0; guard < 12; guard++) {
    const finish = dialog.getByRole("button", { name: "Finish lesson" });
    if (await finish.isVisible()) break;
    const pending = dialog.getByRole("button", { name: "Check" });
    if (await pending.isVisible()) {
      await dialog.getByRole("button", { name: "Yes, it is a net" }).click();
      await pending.click();
      await expect(feedback(page)).toContainText(/Correct|Not quite/);
    }
    await dialog.getByRole("button", { name: "Continue" }).click();
  }
  await expect(dialog.locator("blockquote")).toContainText("A 2-by-2 block or a row of five can never close.");
  await dialog.getByRole("button", { name: "Finish lesson" }).click();

  await expect(page.getByRole("status")).toContainText("Lesson complete: From flat to solid.");
  await expect(page.getByLabel("Programme progress")).toContainText("1 of 12 lessons");
  const first = page.locator(".path-item", { hasText: "From flat to solid" });
  await expect(first).toHaveClass(/is-complete/);
  await expect(first).toContainText(/\d of 4 right/);
  await expect(page.locator(".path-item", { hasText: "Opposite faces" }).getByRole("button", { name: "Start" })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Programme progress")).toContainText("1 of 12 lessons");
  await expect(page.locator(".path-item", { hasText: "From flat to solid" }).getByRole("button", { name: "Review" })).toBeVisible();
});

test("the net builder names the wrong pair and the Escape key leaves the lesson", async ({ page }) => {
  await page.goto(`${programme}?lesson=build`);
  const dialog = player(page);
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("heading", { name: "Pairs first, then a corner" })).toBeVisible();
  const colours = ["orange", "green", "yellow", "blue", "plum", "grey"];
  for (const [i, colour] of colours.entries()) {
    await dialog.getByRole("radio", { name: colour }).check();
    await dialog.getByRole("button", { name: `Square ${i + 1}`, exact: true }).click();
  }
  await dialog.getByRole("button", { name: "Check my net" }).click();
  await expect(dialog.getByRole("status").filter({ hasText: /opposite|mirror image|Correct/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Clear" }).click();
  await dialog.getByRole("button", { name: "Check my net" }).click();
  await expect(dialog.getByRole("status").filter({ hasText: "Colour every square" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Cube nets", exact: true })).toBeVisible();
});

test("other topics render their own figures and tools", async ({ page }) => {
  await page.goto("/learn-programme-preview/paper-folding?lesson=layers");
  const dialog = player(page);
  await dialog.getByRole("button", { name: "Fold the right half over to the left" }).click();
  await dialog.getByRole("button", { name: /Punch at column 1, row 1/ }).click();
  await expect(dialog.getByRole("status")).toContainText("2 layers × 1 punch = 2 holes");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByText(/How many holes will the unfolded sheet have/)).toBeVisible();
  await expect(dialog.getByRole("img", { name: /fold/ }).first()).toBeVisible();

  await page.goto("/learn-programme-preview/counting-cubes?lesson=columns");
  await expect(dialog.getByRole("status")).toContainText("11 cubes in total");
  await dialog.getByRole("button", { name: "Column 1, 1: 2 cubes" }).click();
  await expect(dialog.getByRole("status")).toContainText("12 cubes in total");

  await page.goto("/learn-programme-preview/colour-basics?lesson=wheel");
  await dialog.getByRole("button", { name: "orange", exact: true }).click();
  await expect(dialog.getByRole("img", { name: "complement: blue swatch" })).toBeVisible();

  await page.goto("/learn-programme-preview/mirror-images?lesson=mirror");
  await dialog.getByRole("button", { name: "Cell 1, 1" }).click();
  await expect(dialog.getByRole("img", { name: "mirror version of the figure" })).toBeVisible();
});

test("the challenge times a seeded question set, scores it and stores the best result", async ({ page }) => {
  await page.goto(`${programme}?lesson=challenge&seed=5`);
  const dialog = player(page);
  await dialog.getByRole("button", { name: "Begin" }).click();
  await expect(dialog.getByRole("timer")).toHaveText(/^(10:00|9:5\d)$/);
  await expect(dialog.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "10");
  await dialog.getByRole("button", { name: "Option A" }).click();
  await dialog.getByRole("button", { name: "Next question" }).click();
  await expect(dialog.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  await dialog.getByRole("button", { name: "Submit now" }).click();
  await expect(dialog.getByRole("heading", { name: /\d+ of 10 correct/ })).toBeVisible();
  await expect(dialog.getByRole("status")).toContainText("You need 7 to open the next tier.");
  await expect(dialog.locator(".review > li")).toHaveCount(10);
  await expect(dialog.locator(".review > li").nth(1)).toContainText("Not answered");
  await dialog.getByRole("button", { name: "Back to programme" }).click();
  await expect(page.getByText(/Best so far: \d+ of 10/)).toBeVisible();
});

// ---------- the reference programme: tiers, typed answers, hints, worked solutions, practice, exam marking ----------
const cubes = "/learn-programme-preview/counting-cubes";
const answerOf = (kind, seed, level) => String(generateQuestion(kind, seed, level).answer.value);
const typeAnswer = async (dialog, value) => { await dialog.getByRole("textbox", { name: "Your answer" }).fill(value); };

test("an exam-standard lesson runs hook, worked example, hints, typed answers and practice", async ({ page }) => {
  await page.goto(cubes);
  const tier = page.getByRole("region", { name: "Exam standard" });
  await expect(tier).toContainText("Locked. Pass the Foundations quiz to open it");
  await expect(tier.locator(".path-item", { hasText: "Bigger stacks" }).getByRole("button", { name: "Start" })).toBeDisabled();
  await expect(tier.getByRole("button", { name: "Skip ahead" })).toBeEnabled();

  await page.goto(`${cubes}?lesson=layers&seed=40`);
  const dialog = player(page);
  await expect(dialog.getByText("Try this first")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Check" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("heading", { name: "Slice it into layers" })).toBeVisible();
  await dialog.getByRole("slider", { name: "Layers shown" }).fill("2");
  await expect(dialog.getByRole("status")).toContainText("Showing layers 1 to 2");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByRole("button", { name: "Continue" }).click();

  // Worked example: every step must be revealed before moving on.
  await expect(dialog.getByText("Worked example")).toBeVisible();
  const onward = dialog.getByRole("button", { name: "Continue" });
  await expect(onward).toBeDisabled();
  const nextStep = dialog.getByRole("button", { name: "Next step" });
  while (await nextStep.count()) await nextStep.click();
  await expect(dialog.getByLabel("Worked solution").locator("li").last()).toContainText("cubes.");
  await onward.click();
  await dialog.getByRole("button", { name: "Continue" }).click();

  // Check 1: a hint, then a wrong typed answer, then the working.
  const first = answerOf("count-cubes", 1, 3);
  const check = dialog.getByRole("button", { name: "Check" });
  await expect(check).toBeDisabled();
  await dialog.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(dialog.locator(".hint-box")).toContainText("Count one layer at a time");
  await typeAnswer(dialog, "abc");
  await expect(check).toBeDisabled();
  await typeAnswer(dialog, String(Number(first) + 1));
  await check.click();
  await expect(feedback(page)).toContainText("Not quite");
  await expect(feedback(page)).toContainText(`The answer is ${first} cubes.`);
  await expect(dialog.getByText(`Answer: ${first}`)).toBeVisible();
  await feedback(page).getByRole("button", { name: "See the working" }).click();
  await expect(dialog.getByLabel("Worked solution")).toContainText("Layer 1 (on the floor)");
  await dialog.getByRole("button", { name: "Continue" }).click();

  // Checks 2 and 3: correct answers, the second submitted with the Enter key.
  await typeAnswer(dialog, answerOf("count-cubes", 12, 3));
  await dialog.getByRole("textbox", { name: "Your answer" }).press("Enter");
  await expect(feedback(page)).toContainText("Correct");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await typeAnswer(dialog, answerOf("count-cubes", 13, 3));
  await check.click();
  await dialog.getByRole("button", { name: "Continue" }).click();

  // Practice: three in a row, with seeds fixed by ?seed=40. A miss resets the streak.
  await expect(dialog.getByText("Practice · 3 in a row to pass")).toBeVisible();
  await typeAnswer(dialog, "0");
  await check.click();
  await expect(dialog.getByRole("img", { name: "Streak 0 of 3" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue" })).toBeDisabled();
  for (const seed of [41, 42, 43]) {
    await dialog.getByRole("button", { name: "Next question" }).click();
    await typeAnswer(dialog, answerOf("count-cubes", seed, 3));
    await check.click();
    await expect(feedback(page)).toContainText("Correct");
  }
  await expect(dialog.getByRole("img", { name: "Streak 3 of 3" })).toBeVisible();
  await dialog.getByRole("button", { name: "Continue" }).click();

  // The hook returns as the last check.
  await typeAnswer(dialog, answerOf("count-cubes", 3, 3));
  await check.click();
  await expect(feedback(page)).toContainText("Correct");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("button", { name: "Practise more" })).toBeVisible();
  await dialog.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByRole("status")).toContainText("Lesson complete: Bigger stacks, layer by layer.");
  await expect(page.locator(".path-item", { hasText: "Bigger stacks" })).toContainText("3 of 4 right");
});

test("passing a tier quiz opens the next tier, and the mastery set is marked like the exam", async ({ page }) => {
  const [foundations, , , mastery] = countingCubesProgramme.tiers;
  await page.goto(`${cubes}?lesson=quiz-foundations&seed=3`);
  const dialog = player(page);
  await expect(dialog.getByText("Get 6 of 8 right to open the next tier.")).toBeVisible();
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of buildQuiz(foundations.quiz, 3)) {
    const option = question.options.find(o => o.id === question.answer);
    await dialog.getByRole("button", { name: option.text, exact: true }).click();
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: "8 of 8 correct" })).toBeVisible();
  await expect(dialog.getByRole("status")).toContainText("Passed: the next tier is open.");
  await dialog.getByRole("button", { name: "Back to programme" }).click();
  const standard = page.getByRole("region", { name: "Exam standard" });
  await expect(standard.locator(".path-item", { hasText: "Bigger stacks" }).getByRole("button", { name: "Start" })).toBeEnabled();
  await expect(page.getByRole("region", { name: "Exam hard" })).toContainText("Locked.");

  await page.goto(`${cubes}?lesson=quiz-mastery&seed=7`);
  await expect(dialog.getByText(/Numerical \+4, wrong 0/)).toBeVisible();
  await dialog.getByRole("button", { name: "Begin" }).click();
  await expect(dialog.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "12");
  const set = buildQuiz(mastery.quiz, 7);
  await typeAnswer(dialog, String(set[0].answer.value));
  await dialog.getByRole("button", { name: "Next question" }).click();
  await typeAnswer(dialog, String(set[1].answer.value + 1));
  await dialog.getByRole("button", { name: "Next question" }).click();
  await dialog.getByRole("button", { name: "Submit now" }).click();
  await expect(dialog.getByRole("heading", { name: "4 of 48 marks" })).toBeVisible();
  await expect(dialog.getByRole("status")).toContainText("1 of 12 fully correct.");
  await expect(dialog.locator(".review > li")).toHaveCount(12);
  await expect(dialog.locator(".review > li").first()).toContainText("+4 of 4");
  await expect(dialog.locator(".review > li").nth(1)).toContainText("Wrong · 0 of 4");
  await dialog.locator(".review > li").nth(2).getByText("See the working").click();
  await expect(dialog.locator(".review > li").nth(2).getByLabel("Worked solution")).toBeVisible();
});

// ---------- nets of solids: complex solids, select-all answers ----------
test("nets of solids: the unfolder folds a solid face by face and a select-all question is marked", async ({ page }) => {
  const nets = "/learn-programme-preview/nets-of-solids";
  await page.goto(`${nets}?lesson=count-sort`);
  const dialog = player(page);
  await expect(dialog.getByRole("heading", { name: "Not every solid is a cube" })).toBeVisible();
  await dialog.getByRole("button", { name: "L block" }).click();
  await expect(dialog.getByRole("status")).toContainText("Closed: 8 faces.");
  const fold = dialog.getByRole("slider", { name: "How far folded" });
  await fold.fill("40");
  await expect(dialog.getByRole("status")).toHaveText("Folding: 40% closed.");
  await expect(dialog.getByRole("img", { name: "The net 40% folded" })).toBeVisible();
  await fold.fill("0");
  await expect(dialog.getByRole("status")).toHaveText("Opened out flat. This is the net.");
  await dialog.getByRole("button", { name: /^Face 1:/ }).click();
  await expect(dialog.getByRole("status")).toContainText(/This .* is (a side face|an end face)/);
  await dialog.getByRole("button", { name: "Turn left" }).click();

  // An exam-standard select-all question, reached through a fixed quiz seed.
  const { netsOfSolidsProgramme } = await import("../../src/learn/programmes/nets-of-solids.js");
  const quiz = netsOfSolidsProgramme.tiers[1].quiz;
  let seed = 1, set = buildQuiz(quiz, seed);
  while (!set.some(q => q.answerMode === "multi")) set = buildQuiz(quiz, ++seed);
  await page.goto(`${nets}?lesson=quiz-exam-standard&seed=${seed}`);
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of set) {
    if (question.answerMode === "numeric") await dialog.getByRole("textbox", { name: "Your answer" }).fill(String(question.answer.value));
    else if (question.answerMode === "multi") {
      await expect(dialog.getByText("Select all that apply.")).toBeVisible();
      for (const id of question.answer) await dialog.getByRole("button", { name: `Option ${id}`, exact: true }).click();
      await expect(dialog.getByRole("button", { name: `Option ${question.answer[0]}`, exact: true })).toHaveAttribute("aria-pressed", "true");
    } else await dialog.getByRole("button", { name: `Option ${question.answer}`, exact: true }).click();
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
  await expect(dialog.getByRole("status")).toContainText("Passed: the next tier is open.");
});

test("nets of solids: stripes join up across folds and sliced corners sit on a grid", async ({ page }) => {
  const nets = "/learn-programme-preview/nets-of-solids";
  const dialog = player(page);

  // Patterned cuboid: the box and all four nets carry stripes; the computed answer is accepted.
  await page.goto(`${nets}?lesson=stripes`);
  const striped = generateQuestion("patterned-cuboid", 4, 3);
  await expect(dialog.locator(".question-figure .face-mark").first()).toBeAttached();
  for (const id of "ABCD") await expect(dialog.getByRole("button", { name: `Option ${id}`, exact: true }).locator(".face-mark").first()).toBeAttached();
  await dialog.getByRole("button", { name: `Option ${striped.answer}`, exact: true }).click();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("heading", { name: "A stripe goes right round" })).toBeVisible();
  await dialog.getByRole("slider", { name: "How far folded" }).fill("50");
  await expect(dialog.getByRole("img", { name: "The net 50% folded" }).locator(".face-mark").first()).toBeAttached();

  // Grid net: every option is drawn on a unit grid.
  await page.goto(`${nets}?lesson=diagonals`);
  const grid = generateQuestion("grid-net", 15, 4);
  await expect(dialog.getByText("Every corner that is cut is in view.")).toBeVisible();
  for (const id of "ABCD") await expect(dialog.getByRole("button", { name: `Option ${id}`, exact: true }).locator(".net-gridline").first()).toBeAttached();
  await dialog.getByRole("button", { name: `Option ${grid.answer}`, exact: true }).click();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("heading", { name: "Slice a corner, gain a triangle" })).toBeVisible();
  await dialog.getByRole("button", { name: "Two corners cut" }).click();
  await expect(dialog.getByRole("status")).toContainText("Closed: 8 faces.");
});

test("mechanisms: the machine runs, a ring locks, and every exam-hard kind is marked", async ({ page }) => {
  const base = "/learn-programme-preview/mechanisms";
  const dialog = player(page);
  const duplicateKeys = [];
  page.on("console", message => {
    if (message.type() === "error" && message.text().includes("two children with the same key")) {
      duplicateKeys.push(message.text());
    }
  });

  // The gear tool reports true directions and speeds, and reacts to its controls.
  await page.goto(`${base}?lesson=two-gears`);
  await expect(dialog.getByRole("heading", { name: "Touching gears turn opposite ways" })).toBeVisible();
  await expect(dialog.getByRole("status")).toContainText("A clockwise 60 · B anticlockwise 60");
  await dialog.getByRole("button", { name: "Bigger driver" }).click();
  await expect(dialog.getByRole("status")).toContainText("B anticlockwise 100");
  await dialog.getByRole("button", { name: "Pause" }).click();
  await expect(dialog.getByRole("button", { name: "Run" })).toBeVisible();

  // A ring of five gears is locked; four turn.
  await page.goto(`${base}?lesson=locked-and-marks`);
  const move = generateQuestion("will-it-move", 2, 4);
  for (const id of move.answer) await dialog.getByRole("button", { name: `Option ${id}`, exact: true }).click();
  await dialog.getByRole("button", { name: "Continue" }).click();
  const count = dialog.getByRole("slider", { name: "Number of gears" });
  await count.fill("5");
  await expect(dialog.getByRole("status")).toContainText("Locked.");
  await count.fill("4");
  await expect(dialog.getByRole("status")).toContainText("A clockwise");

  // The lever bench balances 2 kg at 3 units against 3 kg at 2 units.
  await page.goto(`${base}?lesson=levers`);
  await dialog.getByRole("textbox", { name: "Your answer" }).fill("1");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("status")).toContainText("Left side: 6. Right side: 0. The left side goes down.");
  const add = dialog.getByRole("button", { name: "Add 1 kilogram 2 units to the right of the pivot" });
  await add.click(); await add.click(); await add.click();
  await expect(dialog.getByRole("status")).toContainText("Balanced.");
  expect(duplicateKeys).toEqual([]);

  // The exam-hard quiz: speeds, rope, ring, marks and mobile, each answered from the engine.
  const { mechanismsProgramme } = await import("../../src/learn/programmes/mechanisms.js");
  const set = buildQuiz(mechanismsProgramme.tiers[2].quiz, 3);
  await page.goto(`${base}?lesson=quiz-exam-hard&seed=3`);
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of set) {
    if (question.answerMode === "numeric") await dialog.getByRole("textbox", { name: "Your answer" }).fill(String(question.answer.value));
    else if (question.answerMode === "multi") for (const id of question.answer) await dialog.getByRole("button", { name: `Option ${id}`, exact: true }).click();
    else await dialog.getByRole("button", { name: `Option ${question.answer}`, exact: true }).click();
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
});

// ---------- cube nets: exam standard, exam hard and the mastery set ----------
const optionButton = (dialog, question, id) => {
  const option = question.options.find(o => o.id === id);
  return dialog.getByRole("button", { name: option.figure ? `Option ${id}` : option.text, exact: true });
};
async function answerQuiz(dialog, set) {
  for (const question of set) {
    if (question.answerMode === "multi") {
      await expect(dialog.getByText("Select all that apply.")).toBeVisible();
      for (const id of question.answer) await optionButton(dialog, question, id).click();
    } else await optionButton(dialog, question, question.answer).click();
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
}

test("cube nets: anchor and walk, open boxes, and an exam-standard lesson with hints and the working", async ({ page }) => {
  await page.goto(`${programme}?lesson=turns&seed=40`);
  const dialog = player(page);
  await expect(dialog.getByText("Try this first")).toBeVisible();
  await expect(dialog.getByRole("img", { name: /^Cube showing/ }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Continue" }).click();

  // The fold explorer names the face across each edge of the chosen symbol.
  await expect(dialog.getByRole("heading", { name: "Anchor and walk" })).toBeVisible();
  await dialog.getByRole("button", { name: /^Square 1,/ }).click();
  await expect(dialog.locator(".edge-walk")).toContainText("Across the top of its symbol:");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByRole("button", { name: "Continue" }).click();

  await expect(dialog.getByText("Worked example")).toBeVisible();
  const nextStep = dialog.getByRole("button", { name: "Next step" });
  while (await nextStep.count()) await nextStep.click();
  await expect(dialog.getByLabel("Worked solution")).toContainText("Anchor on");
  await dialog.getByRole("button", { name: "Continue" }).click();

  // Check 1: a hint, a wrong option, then the working.
  const first = generateQuestion("which-cube", 3, 3);
  await dialog.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(dialog.locator(".hint-box")).toContainText("Every symbol has a direction");
  const wrong = first.options.find(o => o.id !== first.answer).id;
  await dialog.getByRole("button", { name: `Option ${wrong}`, exact: true }).click();
  await dialog.getByRole("button", { name: "Check" }).click();
  await expect(feedback(page)).toContainText("Not quite");
  await feedback(page).getByRole("button", { name: "See the working" }).click();
  await expect(dialog.getByLabel("Worked solution")).toContainText("Opposite pairs on the net");
  await dialog.getByRole("button", { name: "Continue" }).click();

  // Check 2: the right option.
  const second = generateQuestion("which-cube", 4, 3);
  await dialog.getByRole("button", { name: `Option ${second.answer}`, exact: true }).click();
  await dialog.getByRole("button", { name: "Check" }).click();
  await expect(feedback(page)).toContainText("Correct");

  // Open boxes: the tool takes five-square shapes and names the clash in one that cannot fold.
  await page.goto(`${programme}?lesson=open-box`);
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("heading", { name: "Five squares, one face missing" })).toBeVisible();
  await dialog.getByRole("button", { name: "Shape 7 of 12, U shape" }).click();
  await expect(dialog.getByRole("status")).toContainText("cannot make an open box");
  await dialog.getByRole("button", { name: "Shape 10 of 12, X shape" }).click();
  await dialog.getByRole("slider", { name: "Folded squares" }).fill("5");
  await expect(dialog.getByRole("status")).toContainText("the missing face is the open top");
});

test("cube nets: three views, select-all nets and lines across faces, then the exam-hard quiz and the timed set", async ({ page }) => {
  await page.goto(`${programme}?lesson=partial-views`);
  const dialog = player(page);
  for (const n of [1, 2, 3]) await expect(dialog.getByRole("img", { name: new RegExp(`^View ${n}: Cube showing`) })).toBeVisible();
  await page.goto(`${programme}?lesson=lines-across`);
  await expect(dialog.getByRole("img", { name: /with a (straight|bent) line/ }).first()).toBeVisible();

  const { cubeNetsProgramme } = await import("../../src/learn/programmes/cube-nets.js");
  const hard = cubeNetsProgramme.tiers[2].quiz;
  let seed = 1, set = buildQuiz(hard, seed);
  while (!set.some(q => q.answerMode === "multi" && q.answer.length > 1)) set = buildQuiz(hard, ++seed);
  await page.goto(`${programme}?lesson=quiz-exam-hard&seed=${seed}`);
  await dialog.getByRole("button", { name: "Begin" }).click();
  await answerQuiz(dialog, set);
  await expect(dialog.getByRole("heading", { name: "8 of 8 correct" })).toBeVisible();
  await expect(dialog.getByRole("status")).toContainText("Passed: the next tier is open.");
  await dialog.getByRole("button", { name: "Back to programme" }).click();
  await expect(page.getByRole("region", { name: "Mastery" }).getByRole("button", { name: "Take quiz" })).toBeEnabled();

  const mastery = buildQuiz(cubeNetsProgramme.tiers[3].quiz, 3);
  await page.goto(`${programme}?lesson=quiz-mastery&seed=3`);
  await dialog.getByRole("button", { name: "Begin" }).click();
  await expect(dialog.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "12");
  await answerQuiz(dialog, mastery);
  // UCEED marking: ten single-choice questions at +3 and two select-all at +4.
  await expect(dialog.getByRole("heading", { name: "38 of 38 marks" })).toBeVisible();
  await expect(dialog.getByRole("status")).toContainText("12 of 12 fully correct.");
});

test("counting figures: the counter steps through sizes and every exam-hard kind is marked", async ({ page }) => {
  const base = "/learn-programme-preview/counting-figures";
  const dialog = player(page);

  // The counter lights up one shape at a time and keeps a tally by size.
  await page.goto(`${base}?lesson=by-size`);
  await expect(dialog.getByRole("heading", { name: "Smallest first" })).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText("Size 1: squares 1 of 4. All sizes: 4 + 1 = 5 squares.");
  await dialog.getByRole("button", { name: "Next shape" }).click();
  await expect(dialog.getByRole("status")).toContainText("squares 2 of 4");
  await dialog.getByRole("slider", { name: "Size of shape" }).fill("2");
  await expect(dialog.getByRole("status")).toContainText("Size 2: squares 1 of 1");
  await dialog.getByRole("button", { name: "3 × 3 grid" }).click();
  await expect(dialog.getByRole("status")).toContainText("9 + 4 + 1 = 14 squares");
  await expect(dialog.locator(".lines-highlight")).toBeVisible();

  // A reflected figure shows its mirror line; a missing line is drawn dotted.
  await page.goto(`${base}?lesson=reflected`);
  await expect(dialog.locator(".question-figure .lines-mirror").first()).toBeAttached();
  await page.goto(`${base}?lesson=missing-lines`);
  await expect(dialog.locator(".question-figure .lines-ghost").first()).toBeAttached();

  // The exam-hard quiz, answered from the engine.
  const { countingFiguresProgramme } = await import("../../src/learn/programmes/counting-figures.js");
  const set = buildQuiz(countingFiguresProgramme.tiers[2].quiz, 2);
  await page.goto(`${base}?lesson=quiz-exam-hard&seed=2`);
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of set) {
    if (question.answerMode === "numeric") await dialog.getByRole("textbox", { name: "Your answer" }).fill(String(question.answer.value));
    else for (const id of question.answer) await dialog.getByRole("button", { name: `Option ${id}`, exact: true }).click();
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
});

test("paper folding: cuts unfold step by step and every exam-hard kind is marked", async ({ page }) => {
  const base = "/learn-programme-preview/paper-folding";
  const dialog = player(page);

  // The unfolding tool: a cut on the fold opens into one hole; on the outer edge it stays notches.
  await page.goto(`${base}?lesson=notches`);
  const hookQuestion = generateQuestion("unfold-cuts", 2, 3);
  await dialog.getByRole("button", { name: `Option ${hookQuestion.answer}`, exact: true }).click();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("heading", { name: "Which edges are folds?" })).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText("Folded: 2 layers. The right edge is a fold.");
  const unfold = dialog.getByRole("slider", { name: "Folds undone" });
  await unfold.fill("1");
  await expect(dialog.getByRole("status")).toHaveText("Fully open: 1 hole and 0 notches at the edge.");
  await unfold.fill("0");
  await dialog.getByRole("button", { name: "Cut the left edge" }).click();
  await expect(dialog.getByRole("status")).toContainText("the sheet's own edge");
  await unfold.fill("1");
  await expect(dialog.getByRole("status")).toHaveText("Fully open: 0 holes and 2 notches at the edge.");

  // The exam-hard quiz, answered from the engine.
  const { paperFoldingProgramme } = await import("../../src/learn/programmes/paper-folding.js");
  const set = buildQuiz(paperFoldingProgramme.tiers[2].quiz, 4);
  await page.goto(`${base}?lesson=quiz-exam-hard&seed=4`);
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of set) {
    if (question.answerMode === "numeric") await dialog.getByRole("textbox", { name: "Your answer" }).fill(String(question.answer.value));
    else await dialog.getByRole("button", { name: `Option ${question.answer}`, exact: true }).click();
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
});

test("mirror images: the mirror lab and every exam-hard kind are marked", async ({ page }) => {
  const base = "/learn-programme-preview/mirror-images";
  const dialog = player(page);

  // Two mirrors at an angle: the count follows the rule as the angle changes.
  await page.goto(`${base}?lesson=two-mirrors`);
  await dialog.getByRole("textbox", { name: "Your answer" }).fill("1");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("status")).toHaveText("360 ÷ 90 = 4, even. 3 images.");
  const angle = dialog.getByRole("slider", { name: "Angle between the mirrors" });
  await angle.fill("3");
  await expect(dialog.getByRole("status")).toHaveText("360 ÷ 72 = 5, odd. 5 images.");
  await dialog.getByRole("button", { name: "Object half way" }).click();
  await expect(dialog.getByRole("status")).toHaveText("360 ÷ 72 = 5, odd. 4 images.");

  // A chain of two reflections in lines at right angles is a half turn.
  await page.goto(`${base}?lesson=chains`);
  const chain = generateQuestion("reflection-chain", 1, 4);
  await dialog.getByRole("button", { name: `Option ${chain.answer}`, exact: true }).click();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByRole("button", { name: "Then below" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Result: turned half way round.");

  // The exam-hard quiz, answered from the engine.
  const { mirrorImagesProgramme } = await import("../../src/learn/programmes/mirror-images.js");
  const set = buildQuiz(mirrorImagesProgramme.tiers[2].quiz, 6);
  await page.goto(`${base}?lesson=quiz-exam-hard&seed=6`);
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of set) {
    const right = question.options?.find(o => o.id === question.answer);
    if (question.answerMode === "numeric") await dialog.getByRole("textbox", { name: "Your answer" }).fill(String(question.answer.value));
    else await dialog.getByRole("button", { name: right.figure ? `Option ${question.answer}` : right.text, exact: true }).click();
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
});

test("number and quantity: the clock lab and the exam-hard set are marked", async ({ page }) => {
  const base = "/learn-programme-preview/quant";
  const dialog = player(page);
  await page.goto(`${base}?lesson=clocks`);
  await dialog.getByRole("textbox", { name: "Your answer" }).fill("1");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("status")).toHaveText("2:00. Hour hand at 60°, minute hand at 0°: 60° apart.");
  await dialog.getByRole("button", { name: "One minute on" }).click();
  await expect(dialog.getByRole("status")).toHaveText("2:01. Hour hand at 60.5°, minute hand at 6°: 54.5° apart.");

  const { quantProgramme } = await import("../../src/learn/programmes/quant.js");
  const set = buildQuiz(quantProgramme.tiers[2].quiz, 2);
  await page.goto(`${base}?lesson=quiz-exam-hard&seed=2`);
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of set) {
    if (question.answerMode === "numeric") await dialog.getByRole("textbox", { name: "Your answer" }).fill(String(question.answer.value));
    else await dialog.getByRole("button", { name: question.options.find(o => o.id === question.answer).text, exact: true }).click();
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
});

test("reasoning: the logic lab tools work and the exam-hard sets are marked", async ({ page }) => {
  const dialog = player(page);
  await page.goto("/learn-programme-preview/codes-patterns?lesson=letter-codes");
  await expect(dialog.getByRole("status")).toHaveText("CHAIR is written DIBJS: each letter moves 1 forward.");
  await dialog.getByRole("button", { name: "Write it backwards" }).click();
  await expect(dialog.getByRole("status")).toHaveText("CHAIR is written SJBID: each letter moves 1 forward, then the code is reversed.");

  await page.goto("/learn-programme-preview/arrangements?lesson=rows");
  await expect(dialog.getByRole("status")).toContainText("clues hold");
  await dialog.getByRole("button", { name: "Asha", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Now tap the seat to swap Asha with.");
  await dialog.getByRole("button", { name: "Esha", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Esha", exact: true })).toBeVisible();

  await page.goto("/learn-programme-preview/directions?lesson=turns");
  await dialog.getByRole("button", { name: "Walk 1 m" }).click();
  await dialog.getByRole("button", { name: "Turn right" }).click();
  await dialog.getByRole("button", { name: "Walk 1 m" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Facing east. 1 m east and 1 m north of the start: 1.41 m away.");

  for (const slug of ["codes-patterns", "arrangements", "directions"]) {
    const programmes = await import("../../src/learn/programmes/logic.js");
    const programme = Object.values(programmes).find(p => p.slug === slug);
    const set = buildQuiz(programme.tiers[2].quiz, 3);
    await page.goto(`/learn-programme-preview/${slug}?lesson=quiz-exam-hard&seed=3`);
    await dialog.getByRole("button", { name: "Begin" }).click();
    for (const question of set) {
      const right = question.options?.find(o => o.id === question.answer);
      if (question.answerMode === "numeric") await dialog.getByRole("textbox", { name: "Your answer" }).fill(String(question.answer.value));
      else await dialog.getByRole("button", { name: right.figure ? `Option ${question.answer}` : right.text, exact: true }).click();
      await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
    }
    await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
  }
});

test("views and rotation: the solid turner and the exam-hard set", async ({ page }) => {
  const base = "/learn-programme-preview/views-and-rotation";
  const dialog = player(page);
  await page.goto(`${base}?lesson=turning`);
  await expect(dialog.getByRole("status")).toHaveText("Turn the solid and compare it with the start.");
  await dialog.getByRole("button", { name: "Turn right, seen from above" }).click();
  await dialog.getByRole("button", { name: "Tip forward" }).click();
  await expect(dialog.getByRole("status")).toHaveText("2 turns: still the same solid.");
  await dialog.getByRole("button", { name: "Show the mirror image" }).click();
  await expect(dialog.getByRole("status")).toContainText("no amount of turning");

  await page.goto(`${base}?lesson=missing-view`);
  await expect(dialog.getByText("Select all that apply.")).toBeVisible();

  const { viewsRotationProgramme } = await import("../../src/learn/programmes/views-and-rotation.js");
  const set = buildQuiz(viewsRotationProgramme.tiers[2].quiz, 2);
  await page.goto(`${base}?lesson=quiz-exam-hard&seed=2`);
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of set) {
    if (question.answerMode === "numeric") await dialog.getByRole("textbox", { name: "Your answer" }).fill(String(question.answer.value));
    else if (question.answerMode === "multi") for (const id of question.answer) await dialog.getByRole("button", { name: `Option ${id}`, exact: true }).click();
    else await dialog.getByRole("button", { name: `Option ${question.answer}`, exact: true }).click();
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
});

test("dice: the die roller and the exam-hard set", async ({ page }) => {
  const dialog = player(page);
  await page.goto("/learn-programme-preview/dice?lesson=rolling");
  await expect(dialog.getByRole("status")).toHaveText("Top 1, front 2, right 3. Bottom 6, back 5, left 4.");
  await dialog.getByRole("button", { name: "Roll east" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Top 4, front 2, right 1. Bottom 3, back 5, left 6. Rolls: east.");
  await dialog.getByRole("button", { name: "Roll west" }).click();
  await expect(dialog.getByRole("status")).toContainText("Top 1, front 2, right 3.");

  const { diceProgramme } = await import("../../src/learn/programmes/dice.js");
  const set = buildQuiz(diceProgramme.tiers[2].quiz, 2);
  await page.goto("/learn-programme-preview/dice?lesson=quiz-exam-hard&seed=2");
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of set) {
    await dialog.getByRole("textbox", { name: "Your answer" }).fill(String(question.answer.value));
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
});

test("visual patterns: the rule mixer and the exam-hard set", async ({ page }) => {
  const dialog = player(page);
  await page.goto("/learn-programme-preview/visual-patterns?lesson=one-rule");
  await expect(dialog.getByRole("status")).toContainText("Rules: the");
  await dialog.getByRole("button", { name: "Move round" }).click();
  await expect(dialog.getByRole("status")).toContainText("moves");
  const { visualPatternsProgramme } = await import("../../src/learn/programmes/visual-patterns.js");
  const set = buildQuiz(visualPatternsProgramme.tiers[2].quiz, 2);
  await page.goto("/learn-programme-preview/visual-patterns?lesson=quiz-exam-hard&seed=2");
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of set) {
    await dialog.getByRole("button", { name: `Option ${question.answer}`, exact: true }).click();
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
});

test("colour: the mixer and the exam-hard set", async ({ page }) => {
  const dialog = player(page);
  await page.goto("/learn-programme-preview/colour-basics?lesson=light-ink");
  await expect(dialog.getByRole("status")).toContainText("red + green = yellow");
  await dialog.getByRole("button", { name: "blue", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("= white");
  const { colourBasicsProgramme } = await import("../../src/learn/programmes/colour-basics.js");
  const set = buildQuiz(colourBasicsProgramme.tiers[2].quiz, 3);
  await page.goto("/learn-programme-preview/colour-basics?lesson=quiz-exam-hard&seed=3");
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of set) {
    if (question.answerMode === "numeric") await dialog.getByRole("textbox", { name: "Your answer" }).fill(String(question.answer.value));
    else { const right = question.options.find(o => o.id === question.answer); await dialog.getByRole("button", { name: right.figure ? `Option ${question.answer}` : right.text, exact: true }).click(); }
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
});

test("shadows: the sun table and the exam-hard set", async ({ page }) => {
  const dialog = player(page);
  await page.goto("/learn-programme-preview/shadows-and-light?lesson=direction");
  await expect(dialog.getByRole("status")).toContainText("Sun from the east at 45°");
  await dialog.getByRole("button", { name: "south", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("towards the north");
  const { shadowsProgramme } = await import("../../src/learn/programmes/shadows-and-light.js");
  const set = buildQuiz(shadowsProgramme.tiers[2].quiz, 4);
  await page.goto("/learn-programme-preview/shadows-and-light?lesson=quiz-exam-hard&seed=4");
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of set) {
    if (question.answerMode === "numeric") await dialog.getByRole("textbox", { name: "Your answer" }).fill(String(question.answer.value));
    else if (question.answerMode === "multi") for (const id of question.answer) await dialog.getByRole("button", { name: question.options.find(o => o.id === id).text, exact: true }).click();
    else { const right = question.options.find(o => o.id === question.answer); await dialog.getByRole("button", { name: right.figure ? `Option ${question.answer}` : right.text, exact: true }).click(); }
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
});

test("surfaces: the explorer and the exam-hard set", async ({ page }) => {
  const dialog = player(page);
  await page.goto("/learn-programme-preview/solid-surfaces?lesson=what-is-a-surface");
  await expect(dialog.getByRole("status")).toContainText("8 surfaces in all");
  await dialog.getByRole("button", { name: "up", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Facing up: 1 surface.");
  const { surfacesProgramme } = await import("../../src/learn/programmes/solid-surfaces.js");
  const set = buildQuiz(surfacesProgramme.tiers[2].quiz, 2);
  await page.goto("/learn-programme-preview/solid-surfaces?lesson=quiz-exam-hard&seed=2");
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of set) {
    await dialog.getByRole("textbox", { name: "Your answer" }).fill(String(question.answer.value));
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
});

test("sections: the slicer and the exam-hard set", async ({ page }) => {
  const dialog = player(page);
  await page.goto("/learn-programme-preview/sections?lesson=cut-faces");
  await expect(dialog.getByRole("status")).toContainText("The cut face is a square");
  await dialog.getByRole("button", { name: "Edge to edge", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("rectangle");
  const { sectionsProgramme } = await import("../../src/learn/programmes/sections.js");
  const set = buildQuiz(sectionsProgramme.tiers[2].quiz, 5);
  await page.goto("/learn-programme-preview/sections?lesson=quiz-exam-hard&seed=5");
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of set) {
    if (question.answerMode === "numeric") await dialog.getByRole("textbox", { name: "Your answer" }).fill(String(question.answer.value));
    else await dialog.getByRole("button", { name: question.options.find(o => o.id === question.answer).text, exact: true }).click();
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
});

test("fit: the piece fitter and the exam-hard set", async ({ page }) => {
  const dialog = player(page);
  await page.goto("/learn-programme-preview/fit?lesson=gaps");
  await expect(dialog.getByRole("status")).toContainText("Not yet");
  for (let i = 0; i < 3; i++) await dialog.getByRole("button", { name: "Turn a quarter" }).click();
  await expect(dialog.getByRole("status")).toContainText("fits the gap exactly");
  const { fitProgramme } = await import("../../src/learn/programmes/fit.js");
  const set = buildQuiz(fitProgramme.tiers[2].quiz, 3);
  await page.goto("/learn-programme-preview/fit?lesson=quiz-exam-hard&seed=3");
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of set) {
    if (question.answerMode === "numeric") await dialog.getByRole("textbox", { name: "Your answer" }).fill(String(question.answer.value));
    else await dialog.getByRole("button", { name: `Option ${question.answer}`, exact: true }).click();
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
});

test("overlays: the sheet stacker and the exam-hard set", async ({ page }) => {
  const dialog = player(page);
  await page.goto("/learn-programme-preview/overlays?lesson=stack");
  await expect(dialog.getByRole("status")).toContainText("every mark shows through");
  await dialog.getByRole("button", { name: "Turn sheet 2" }).click();
  await expect(dialog.getByRole("status")).toContainText("Sheet 2 turned");
  const { overlaysProgramme } = await import("../../src/learn/programmes/overlays.js");
  const set = buildQuiz(overlaysProgramme.tiers[2].quiz, 2);
  await page.goto("/learn-programme-preview/overlays?lesson=quiz-exam-hard&seed=2");
  await dialog.getByRole("button", { name: "Begin" }).click();
  for (const question of set) {
    if (question.answerMode === "numeric") await dialog.getByRole("textbox", { name: "Your answer" }).fill(String(question.answer.value));
    else await dialog.getByRole("button", { name: `Option ${question.answer}`, exact: true }).click();
    await dialog.getByRole("button", { name: /Next question|Finish quiz/ }).click();
  }
  await expect(dialog.getByRole("heading", { name: `${set.length} of ${set.length} correct` })).toBeVisible();
});
