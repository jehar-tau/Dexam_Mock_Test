# 5. Build playbook

The procedure for one build session. Follow it in order. It is written for a
model or developer who has not seen the earlier work.

## 5.1 Before you start

1. Read, in this order: `README.md`, `01-experience-standard.md`,
   `02-difficulty-ladder.md`, `03-architecture-contracts.md`, then the spec
   of your topic in `topics/`.
2. Check the foundation status table in `04-foundation-work-packages.md`. If
   your tier needs a package that is not done, build the package first or
   stop and say so.
3. Read one finished example end to end before writing anything:
   - engine: `src/learn/paper-fold.js`
   - registry entry: `unfold` in `src/learn/questions.js`
   - figures: `FoldSequence` and `HoleGrid` in `src/learn/figures.jsx`
   - tool: `FoldPunchExplorer` in `src/learn/tools.jsx`
   - content: `src/learn/programmes/paper-folding.js`
   - tests: the paper-folding blocks in `tests/learn-topics.test.mjs`

## 5.2 Environment

All commands run from `apps/designmocks/`. Node 22.12 or later.

```bash
npm ci
```

Dev server for Learn previews (port 4190 belongs to an owner-run server on
the owner's Mac; use 4193):

```bash
VITE_POST_LAUNCH_PREVIEW=true VITE_DEPLOYMENT_ENV=development npx vite --host 127.0.0.1 --port 4193 --strictPort
```

Pages:

- `http://127.0.0.1:4193/learn-preview` — the programme list.
- `http://127.0.0.1:4193/learn-programme-preview/<slug>` — one programme.
- Add `?lesson=<lessonId>` to open a lesson, `?lesson=challenge&seed=5` for
  a quiz with fixed seeds, and `&audit` for the accessibility panel.

Checks:

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

The `VITE_PORTAL_ENABLED=false` prefix is needed only on the owner's Mac,
whose git-ignored `.env.production` enables the portal. CI has no such file.

## 5.3 The ten steps

### Step 1 — Engine model, test first

Create or extend `src/learn/<topic>.js`. Start with the model functions the
spec lists under "Engine". For each, write the hand-computed test cases from
the spec into the test file first, then make them pass. State the coordinate
conventions in a comment at the top of the file (which way is y, what is
"front"). Most engine bugs here are convention slips.

### Step 2 — Generators, lowest level first

For each kind in the spec, in level order:

1. Write the generator: draw the scenario from the seed, compute the truth
   from the model, build distractors by the spec's rules, verify each
   distractor against the truth, shuffle, label A–D.
2. Add `explanation`, per-option `reason`, and from L3 `hints` and
   `solution` steps computed from the same scenario (so they are always
   true for the seed).
3. Add the 60-seed sweep test from contracts, section 3.9. The test must
   recompute the answer independently of the generator's own path where the
   spec gives a second method (brute force against formula).

Run the sweep after each kind. Do not move on with a failing seed.

### Step 3 — Register the kinds

Add each kind to `src/learn/questions.js` with its figure adaptation. Decide
what goes in `figures` and what goes in each option's `figure`.

### Step 4 — Figures

Add renderers to `src/learn/figures.jsx` and a `case` in `Figure`. Check the
compact size inside an option card and the dark theme.

### Step 5 — Tool

Build or extend the topic's tool in `src/learn/tools.jsx`. One tool per
topic, driven by props, reused across tiers. Add its name to `toolNames` and
to the list in `tests/learn-programme.test.mjs`.

### Step 6 — Content

Write the tier's lessons in `src/learn/programmes/<slug>.js` following the
lesson anatomy for that tier (ladder, section 2.4) and the screen list in
the spec. Choose check seeds deliberately: print candidates and pick a
spread.

```bash
node -e "import('./src/learn/questions.js').then(m=>{for(let s=1;s<=30;s++){const q=m.generateQuestion('KIND',s,LEVEL);console.log(s,JSON.stringify(q.answer),q.prompt.slice(0,60))}})"
```

Register a new programme in `src/learn/programmes/index.js` and add its slug
to the expected list in `tests/learn-programme.test.mjs`.

### Step 7 — Tests and build

Run the three Learn test files, then `npm test`, then the build and
isolation check. Add or extend the programme's browser journey and run the
spec.

### Step 8 — Look at it

Start the dev server and go through every new screen yourself:

- Desktop width, then 375 px, then dark theme.
- Keyboard only: Tab to every control, Enter to continue, Escape to leave.
- Run the audit (`&audit`, open the panel, run) on one slide with the tool,
  one check of each answer mode, and the quiz result. Zero violations.
- Read every sentence aloud once. Cut anything a student would skip.

### Step 9 — Calibrate

Do the calibration in the ladder, section 2.6, and fill in the spec's
"Archetype coverage" table. If a kind is too easy, pull another lever and
repeat from Step 2.

### Step 10 — Record and report

- Update the status board in `README.md` and the tier status in the topic
  spec.
- Add a dated line to the decisions log in `../LEARN_INTERACTIVE_PLAN.md`
  for anything you decided that the spec did not.
- Report: what was built, the test counts, what was verified in the browser,
  and what was not verified. Do not call a tier built if a check was
  skipped.

## 5.4 Definition of done for a tier

- [ ] Every kind in the spec for this tier exists, with reasons, and from
      L3 with hints and solution steps.
- [ ] 60-seed sweeps pass for every kind and level; answers independently
      recomputed in tests.
- [ ] Lessons follow the tier's anatomy; every slide is two sentences or
      fewer; every lesson ends with a take-away.
- [ ] The tier quiz draws the kinds and counts in the spec.
- [ ] `npm test` passes. Build and isolation check pass.
- [ ] Browser journey passes on desktop Chromium and Pixel 7.
- [ ] Audit: zero violations in both themes on the new screens.
- [ ] Calibration recorded. Archetype coverage table complete.
- [ ] Status board updated.

## 5.5 Pitfalls already met in this codebase

Engine and content:

- **Options that look identical.** A mirrored symmetric pattern equals the
  original. Use asymmetric scenarios and compare option signatures; reject
  duplicates.
- **Distractors that are accidentally correct.** Swapping two faces that are
  not visible leaves the view valid. Always verify against the truth.
- **Search loops without a fallback.** Give every loop a guard and a
  deterministic fallback so no seed can hang or throw.
- **Ambiguous definitions.** "Hidden cube" and "surface" have more than one
  reading. State the definition on a slide and use it in the engine.
- **Convention slips.** Screen y runs down; several engines use y up. Write
  the convention at the top of each engine and test one asymmetric case by
  hand.
- **Mirror-image drawings.** The first isometric projection in this
  codebase drew every cube as its mirror image: it put +x on the right for
  a viewer at (+x, +y, +z), where a right-handed world puts it on the left.
  Every option was mirrored the same way, so all tests passed, yet the
  pictures taught the wrong handedness. For any 3D figure, write one test
  from physical reasoning ("east face on the left for a viewer at the
  north-east") as in `tests/cube-net.test.mjs`, and reuse `project` from
  `cube-net.js` instead of writing a new projection.
- **Wording that names the wrong corner or side.** Check every direction
  word against the figure in the browser.

React and player:

- **Stale answer state on a new screen.** Change the screen index and clear
  the answer in the same update. Any new screen kind with its own state
  must reset the same way.
- **Focus must not act.** Focusing a control must never place, punch or
  select. Only click, Enter and Space act.
- **Timers.** Keep interval effects keyed on stable values and read the
  latest state through a ref.

Tests:

- **Several `role="status"` regions on one page.** Scope locators to the
  dialog or to a class.
- **Unnamed option buttons.** Figure options need `aria-label="Option A"`.
- **A `<select>` or input inside its `<label>`** takes the option text into
  its name. Give the control its own `aria-label`.
- **Screenshots taken during the 0.28 s screen transition look blank.**
  Wait before judging.
- **The default browser scope skips Learn.** Use `DMOCKS_E2E_SCOPE=full`.

Repository:

- **zsh.** Quote globs. `echo ===` fails; use `echo "---"`.
- **Port 4190** is taken on the owner's Mac. **`.env.production`** there
  enables the portal; build with `VITE_PORTAL_ENABLED=false`.
- **Dark theme rules can outrank fill classes.** Exclude filled faces from
  any dark override.
- **Adding a migration** changes counts that
  `tests/rollout-doc-constants.test.mjs` checks against
  `docs/PROVIDER_SETUP.md`. Update the quoted counts in the same change.
- **Never put bank questions, figures or student data in the repo.**
- **Preview-only text** must not appear in production bundles in a way that
  trips `scripts/check-preview-isolation.mjs`.

## 5.6 Ready-made briefs

Paste one of these to start a session. Fill the brackets.

### Builder brief

```text
You are building one tier of an interactive Learn programme for DMocks in
apps/designmocks. Read docs/learn/README.md, then 01, 02, 03 and 05, then
docs/learn/topics/[topic].md. Check docs/learn/04-foundation-work-packages.md:
the packages your tier needs must be marked done; if not, stop and report.

Build the [Foundations | Exam standard | Exam hard | Mastery] tier of
[programme] exactly as specified: engine functions and question kinds with
verified distractors, figures, the tool changes, the lessons and the tier
quiz. Follow the ten steps in docs/learn/05-build-playbook.md and meet the
definition of done in section 5.4. Do the calibration in
docs/learn/02-difficulty-ladder.md section 2.6 and fill in the spec's
archetype coverage table.

Work on branch feature/dmocks-learn-[topic]-[tier]. Do not touch files
outside src/learn, tests, src/styles.css (Learn block only) and docs/learn
unless the spec says so. Do not copy any question or figure from the private
bank. Do not change sign-in, sales or release switches. Report test counts,
what you verified in the browser, and anything you could not verify.
```

### Reviewer brief

```text
Review the [tier] tier of the [programme] Learn programme in
apps/designmocks against docs/learn/topics/[topic].md and the definition of
done in docs/learn/05-build-playbook.md section 5.4.

1. For each question kind at this tier, generate seeds 1–10 and solve each
   by hand from the figure. Report any seed whose marked answer is wrong,
   any distractor that is also correct, and any two options that look the
   same.
2. Judge difficulty against docs/learn/02-difficulty-ladder.md section 2.6.
   Name any kind that can be solved by elimination at a glance.
3. Play every lesson in the preview at desktop and 375 px width, in both
   themes, with the keyboard only. Report unclear sentences, slides over two
   sentences, controls without names, and anything in section 1.8 of the
   experience standard.
4. Run the tests, the build, the browser spec and the audit. Report results.
Do not fix anything. Report findings as a numbered list, most serious first.
```

### Foundation brief

```text
Build foundation package [F#] for DMocks Learn in apps/designmocks, exactly
as specified in docs/learn/04-foundation-work-packages.md. Read
docs/learn/README.md, 01 and 03 first. Keep every existing Learn test and
browser journey passing. Add the tests the package lists. Follow section 1.4
of the experience standard for new controls. Mark the package done in the
status table and report what you verified.
```
