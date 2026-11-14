# Learn handoff: where the work stands right now

This file is the live state of the Learn build. Whoever is building updates
it at every checkpoint, so that work can pass to another model or developer
at any moment, including in the middle of a task. Read it first, before the
kit's README.

**Last updated:** 13 November 2026, after Nets of solids was built to the owner's reference standard.

## How to take over

1. Read this file top to bottom.
2. Read [README.md](README.md) and the documents it lists, in order.
3. Run the checks in section "Verify the current state" below. If they do
   not pass, fix that before anything else; do not build on a red state.
4. Continue from "In progress" if it is not empty, otherwise take the first
   item of "Next".
5. Update this file whenever you finish a step, start a step, or learn
   something the next person needs.

## Verify the current state

From `apps/designmocks/`:

```bash
node --test tests/cube-net.test.mjs tests/learn-topics.test.mjs tests/learn-programme.test.mjs
```

```bash
npm test
```

```bash
VITE_PORTAL_ENABLED=false npm run build && node scripts/check-preview-isolation.mjs
```

```bash
DMOCKS_E2E_SCOPE=full npx playwright test tests/e2e/learn-programme.spec.js --reporter=line
```

Expected at the last update: 574 unit tests pass (32 of them in the four
Learn files; add `tests/solid-net.test.mjs` to the first command), build
and isolation check pass, 16 browser journeys pass.

Preview (port 4190 is taken on the owner's Mac):

```bash
VITE_POST_LAUNCH_PREVIEW=true VITE_DEPLOYMENT_ENV=development npx vite --host 127.0.0.1 --port 4193 --strictPort
```

Then open `http://127.0.0.1:4193/learn-preview`.

## Git state

- Branch `feature/dmocks-learn-interactive-cube-nets`, based on `main`.
- **Nothing is committed.** All Learn work is in the working tree. The
  owner reviews before committing; do not commit or push unless asked.
- Untracked folder `tools/dmocks-execution-dashboard/` belongs to the owner.
  Leave it alone.

## Done

- Step-by-step player, programme overview, question registry, figure and
  tool layers.
- Five programmes at Foundations: cube nets, paper folding, mirror images,
  counting cubes, colour.
- The build kit (this folder) and eleven topic specifications.
- Isometric projection corrected (it used to draw mirror images).
- **Foundation packages F6, F1, F3, F4, F5, F2 and F9.** Levels in the
  registry; single, multiple-select and numerical answers; exam marking;
  hook, worked, practice screens; hints; "See the working"; tiers with
  quizzes, unlocking and skip-ahead; progress version 2.
- **Counting cubes through all four tiers.** This is the reference
  programme. Ten lessons, three tier quizzes and a timed set marked like
  UCEED.
- **Nets of solids through all four tiers** (`src/learn/solid-net.js`,
  `programmes/nets-of-solids.js`, the `unfolder` tool). Solids with 5 to 16
  faces: prisms, pyramids, stepped and sloped blocks, rounded ends, solids
  built from cubes. The fold test is checked against the cube engine on all
  216 six-square shapes. First real use of select-all answers.

## In progress

Nothing. The tree is in a clean, passing state.

## Next

In this order. Each item is one build session followed by one review
session (briefs in [05-build-playbook.md](05-build-playbook.md), section
5.6).

**Read [08-owner-reference-standard.md](08-owner-reference-standard.md)
first.** The owner has shown what the hardest questions look like, and
the current programmes do not reach it for folding, surfaces or views.

1. Owner review of counting cubes on a phone: wording, pacing, difficulty.
   It stays the reference for structure, not for peak difficulty.
2. **Owner review of Nets of solids** against the four anchor questions.
   Then close the gaps listed in sections 9 and 9a of
   [topics/nets-of-solids.md](topics/nets-of-solids.md): four-ended joined
   solids, merged-face drawing for cube-built solids, patterned cuboids,
   nets on a grid with diagonal folds, and a true folding animation.
3. Read pages 30–77 of the owner's bank (paper folding, solid generation
   and shadows, assembly and mechanism) and extend section 8.4 of the
   reference standard and the matching specifications.
4. Paper folding, tiers 2–4 ([topics/paper-folding.md](topics/paper-folding.md)).
5. ~~Cube nets, tiers 2–4.~~ Built 14 November 2026; see the update at the end.
6. Mirror images, tiers 2–4.
7. Colour, tiers 2–4.
8. Wave 2, starting with views and rotation. Extend the views, surfaces
   and dice specifications to the forms in section 8.4 before building.
9. F8 and F7, then portal release one programme at a time.

Small known gaps, none blocking:

- Multiple select is now used by `net-of-solid` and has a browser journey.
- The other four programmes are still in the v1 shape (`lessons` plus
  `challenge`). `tiersOf` reads them as one Foundations tier. Convert each
  to `tiers` when its higher tiers are written, as counting cubes was.
- `stack-builder` has no paint-by-face colouring; paint mode reports counts
  in the status line only.

## How the reference programme is put together

Copy this for every topic.

| Part | File | What to look at |
|---|---|---|
| Engine | `src/learn/cube-count.js` | Conventions in the header. One generator per kind, taking `(rng, seed)`. Numerical kinds return `answerMode: 'numeric'`, `answer: { value }`, `unit`, `mistakes` (wrong values with their reasons), `hints`, `solution` steps. `readableStack` and `stackReadable` show how to guarantee a drawing fixes its own answer. |
| Registry | `src/learn/questions.js` | The `kinds` table: topic, supported levels, generator. `checkAnswer`, `markFor`, `buildQuiz`. |
| Figures | `src/learn/figures.jsx` | `VoxelFigure`, `StackFigure`, `ViewsFigure`, and the `Figure` switch. |
| Tool | `src/learn/tools.jsx` | `StackBuilder`: one tool, props per tier (`size`, `layers`, `showViews`, `paint`). |
| Content | `src/learn/programmes/counting-cubes.js` | Four tiers. Above Foundations every lesson is: hook, slides, worked, checks, practice, the hook again, take-away. |
| Player | `src/learn/LessonPlayer.jsx` | One component per screen kind, keyed by step id. `QuizPlayer` for tier quizzes. |
| Model | `src/learn/programme-model.js` | `validateProgramme`, `tiersOf`, `programmeSummary` (unlocking), progress version 2. |
| Tests | `tests/learn-topics.test.mjs`, `tests/learn-programme.test.mjs`, `tests/e2e/learn-programme.spec.js` | Answers recomputed independently; the three-views formula checked against exhaustive search; a full exam-standard lesson journey; quiz pass and exam marking. |

Preview pages for the reference programme:

- `/learn-programme-preview/counting-cubes`
- `?lesson=layers`, `?lesson=painted-block`, `?lesson=hidden-touching`
- `?lesson=views-most`, `?lesson=views-fewest`, `?lesson=painted-stack`
- `?lesson=review`
- `?lesson=quiz-foundations`, `quiz-exam-standard`, `quiz-exam-hard`,
  `quiz-mastery`. Add `&seed=7` to fix the questions.

## Things the next builder must know

- Use the builder brief in [05-build-playbook.md](05-build-playbook.md),
  section 5.6, and the definition of done in section 5.4.
- Counting cubes is the worked example of a complete programme. Copy its
  structure: engine generators with levels, hints and solution steps;
  figures; one tool reused across tiers with harder props; tiered content.
- Reuse `project` from `src/learn/cube-net.js` for any 3D drawing.
- Never copy text or figures from the private question bank.

## Update, 14 November 2026: Nets of solids gaps closed

State when work stopped (usage limit reached). Nothing is committed.

Built and verified by unit tests (580 pass), build and isolation check pass:

- **Joined solids** with four end faces: `joined(n, m)` in `src/learn/solid-net.js`; 25% of `net-of-solid` L4.
- **Merged-face drawing** for cube-built solids: `MergedCubes` in `src/learn/figures.jsx`.
- **True folding motion**: `foldedPose` + `FoldingFigure`; the Unfolder tool has a 0–100 fold slider.
- **Patterned cuboids** (archetype S6): new engine `src/learn/solid-pattern.js`, kind `patterned-cuboid` L3,
  lesson `stripes` in Exam standard. Four options share one net; wrong ones are spoiled on faces X, Y, and both.
- **Grid nets with diagonal folds** (archetype S4): `sliced(dims, cuts)` (box with corners cut off),
  kind `grid-net` L4, lesson `diagonals` in Exam hard. Nets carry `grid: true` and are drawn on a unit grid.
- Both new kinds are in the tier quizzes and the timed exam set.

Not done, in this order:

1. Run the browser journeys: `DMOCKS_E2E_SCOPE=full npx playwright test tests/e2e/learn-programme.spec.js --reporter=line`.
   The spec was last run before the `stripes` and `diagonals` lessons were added. Add one journey for each.
2. Run the axe audit (`?audit`) on the two new lessons, light and dark theme, and check them at phone width.
3. Bring `docs/learn/topics/nets-of-solids.md` sections 4, 5, 9 and 9a in line with the list above
   (S4 and S6 are now built; kinds `patterned-cuboid` and `grid-net` exist; lessons `stripes`, `diagonals`).
4. S4 honesty note: the exam anchor (UCEED 2023 Q49) is two box-like pieces joined at an angle. Ours is one
   box with sliced corners. Same skill (diagonal fold = sloping face, on a grid), simpler solid. A closer
   match needs a two-piece solid whose faces all sit on the grid.
5. Then the earlier list: owner bank pages 30–77, other programmes' upper tiers, release switch, server progress.

## Update, 14 November 2026 (later): pushed to GitHub, mechanisms built

- The first Learn pull request (six programmes) is **merged into main**
  (jehar-tau/Dexam_Mock_Test#186). GitHub Actions did not start on it (the
  account's Actions billing is blocked), so the checks were run by hand:
  unit tests, build, isolation, and the full browser suite (618 journeys)
  in an isolated copy on spare ports. Do the same until Actions is fixed:
  see "Running the full browser suite when the ports are busy" below.
- **Read `09-topic-bank-map.md` first.** It maps the owner's theory
  documents and question banks to programmes, says which model builds
  which, and records the owner's standing permission to push and merge
  Learn work.
- New programme `mechanisms` (Gears, belts and levers), all four tiers:
  spec `topics/mechanisms.md` section 0. Seven programmes are now live in
  the preview.
- Stripes and diagonals lessons in Nets of solids now have a browser
  journey; the audit is clean on them.

### Running the full browser suite when the ports are busy

Another agent often holds ports 4399–4999. Do not stop it. Make a copy:

```bash
W=/tmp/learn-e2e-copy && git worktree add --detach "$W" HEAD && cd "$W/apps/designmocks" \
  && grep -rlE "4[3-9]99" tests/e2e playwright.config.js package.json | xargs sed -i '' -E 's/4([3-9])99/5\199/g' \
  && npm ci && npm run test:e2e
```

Then `git worktree remove --force "$W"`. The preview server for looking at
your own work is `designmocks-learn-work` on port 4195 (4193 is in use by a
preview of main).

### Next, in order

1. Counting figures (`topics/counting-figures.md`): the engine is Fable
   work; ask the owner before starting it on another model.
2. Opus, from specs, in parallel sessions: cube nets tiers 2–4; paper
   folding and mirror images tiers 2–4; `mechanisms` section 0 list;
   quantitative aptitude; logical reasoning.
3. Patterns F9 (recall) and F10 (method lessons) before art history,
   Indian craft, product design, poster and storyboarding.

### Starting a topic that has no spec yet

Quantitative aptitude and logical reasoning have no spec. Before any code:

1. Read the topic's theory document and question bank in the owner's
   folder (`~/Desktop/untitled folder/`; most are scans, so view the
   pages). List the archetypes, how often each appears, and the hardest
   example of each. Copy nothing into the repository.
2. Write `topics/<slug>.md` from `topics/_TEMPLATE.md`: outcome, exam
   evidence table, techniques, ladder (four tiers), question kinds with
   the rule for the answer and the rules for wrong options, hand-checked
   cases. Use `topics/mechanisms.md` section 0 and `topics/counting-cubes.md`
   as models of the finished thing.
3. Then follow `05-build-playbook.md` from Step 1. For word problems the
   "figure" may be nothing, or a small table: that is fine. The contract
   that matters is that every number is drawn from the seed, the answer is
   computed, and each wrong option is the result of one named mistake.

## Update, 14 November 2026 (evening): cube nets tiers 2–4

Branch `feature/dmocks-learn-cube-nets-tiers`. Cube nets now has all four
tiers (spec `topics/cube-nets.md`, status line and section 11).

- `programmes/cube-nets.js` is in the tiered shape. Foundations is the old
  five lessons with every lesson id and kind unchanged; its quiz is the old
  challenge (10 questions, pass 7), and `?lesson=challenge` still opens it.
  Twelve lessons in all: `turns`, `from-views`, `open-box`;
  `same-cube`, `partial-views`, `lines-across`; `review`.
- Engine (`cube-net.js`): cell turns (`content.turn`, `glyphAxes`),
  `foldCells`, `openBox`, named `pentominoes`, `edgeNeighbours`,
  `mirrorNet`, `unfoldCube`; glyphs `line`, `bend`, `blank`. Level 1–2
  questions are byte-identical to before (checked on 200 seeds per kind).
- Kinds: `which-cube` and `cannot-cube` L3, `which-net` L3–L4,
  `net-from-views` L3–L4, `open-box` L3, `same-cube` L4 (select all),
  `path-cube` L4.
- `tests/cube-net-exam.test.mjs` recomputes every option of every new kind
  over 60 seeds by a second method (frame matching under 24 rotations, not
  view signatures). `tests/learn-programme.test.mjs` no longer uses cube
  nets as its v1 example; it rebuilds a v1 programme from the Foundations
  tier instead. Two new browser journeys in `learn-programme.spec.js`; the
  overview journey now expects "0 of 12 lessons".
- Checked in the browser: every new kind at 375 px in light theme and the
  tools, a select-all quiz and the results screen at desktop in dark theme;
  the audit found zero violations on all of them.
- `npm test` 649 pass; build and isolation check pass.

Browser runs, after merging `origin/main` (counting figures): the Learn
journeys pass on desktop Chromium and Pixel 7 (26 of 26 with counting
figures), and the full suite (`npm run test:e2e:full`) passes: 1046 tests. Both were
run in this branch's own worktree with ports moved to 6x99: 4x99 belong to
Codex and 5x99 were in use by a sibling session; the staging pilot's
server on 4689 (also in Codex's range) must move too (to 6689); and the disk (briefly
under 600 MB free) had no room for a separate copy. Not done: hand-solving
20 seeds per kind and timing five L4 questions (ladder 2.6, steps 4–5) — a
reviewer session should do that.

The preview server for this branch is `designmocks-learn-cube-nets` on port
4187 (added to the session root's `.claude/launch.json`).

## Update, 14 November 2026 (evening): counting figures built

- New programme `counting-figures`, all four tiers: spec
  `topics/counting-figures.md` section 0. Eight programmes are in the
  preview. The engine counts every figure two independent ways and the
  tests require agreement; keep that rule for any new family.
- Work in your own git worktree (`git worktree add`), not the shared
  checkout: several sessions run at once. Pick a free port for your preview
  (`lsof -nP -iTCP -sTCP:LISTEN | grep 41`).
- CSS class names are global. Before adding one, grep `src/styles.css` for
  it: `.net-grid` and `.text-link` have both clashed before.
- Check every new figure in the dark theme. Lines drawn in the ink colour
  vanish on the dark card unless a dark-theme rule is added.
- Next Fable-level work: the recall pattern (F9) and the method-lesson
  pattern (F10) in `09-topic-bank-map.md`.
