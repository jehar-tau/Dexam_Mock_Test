# 4. Foundation work packages

Player and model features that must exist before exam-level lessons can be
built. Each package is small enough for one session. Build them in the order
given. Mark status here when a package lands.

| Package | What | Needed for | Status |
|---|---|---|---|
| F6 | Levels in the registry, `hook` screens | Everything above Foundations | **Done** 13 Nov |
| F1 | Multiple-select and numerical answers | Exam standard upward | **Done** 13 Nov |
| F3 | Worked solutions, step by step | Exam standard upward | **Done** 13 Nov |
| F4 | Hints | Exam standard upward | **Done** 13 Nov |
| F5 | Practice screens with a streak | Exam standard upward | **Done** 13 Nov |
| F2 | Tiers, tier quizzes, unlocking, placement | All four tiers in one programme | **Done** 13 Nov |
| F9 | Exam marking and pace in the Mastery set | Mastery tier | **Done** 13 Nov |
| F8 | Release switch per programme | Portal release | Not started |
| F7 | Server-side progress | Portal release | Not started |
| F10 | Review queue and next-lesson recommendation | After first release | Not started |
| F11 | Admin view of completion and scores | After first release | Not started |

General rules for every package:

- Keep v1 programmes working unchanged until F2 migrates them. The existing
  ten browser journeys and 20 Learn unit tests must stay green throughout.
- Add unit tests in `tests/learn-programme.test.mjs` (model and registry) and
  a browser journey in `tests/e2e/learn-programme.spec.js`.
- No new dependency.
- Follow section 1.4 of the experience standard for any new control.

---

## F6 — Levels in the registry and `hook` screens

**Why.** Generators need a difficulty input, and Exam standard lessons open
with a hook.

**Change.**

- `src/learn/questions.js`: replace the `generators` map with
  `kinds[kind] = { generate(seed, level), levels, answerMode, topic }`.
  Export `generateQuestion(kind, seed, level)` where `level` defaults to the
  lowest supported level, `questionKinds`, and `kindInfo(kind)`. Throw for an
  unsupported level. Every returned question carries `level` and
  `answerMode`.
- Existing engines: give each generator a `level` parameter. Map current
  behaviour to the level it already is (all existing kinds are L1 or L2; set
  `levels` accordingly, see each topic spec, section "Kinds").
- `src/learn/programme-model.js`: accept `question.level` in `check` steps
  (optional in v1 content, defaults as above) and validate it against
  `kindInfo(kind).levels`. Add step kind `hook`:
  `{ id, kind: 'hook', text, question: { kind, seed, level } }`.
- `src/learn/LessonPlayer.jsx`: render `hook` as the question with its
  choices disabled-looking but selectable, no Check, and the line from
  `text` under it. Continue is always enabled. Nothing is recorded.

**Tests.** Registry returns `level` and `answerMode` for every kind; asking
for an unsupported level throws; a programme with a `hook` validates; a
`hook` with an unknown kind fails validation.

**Done when.** All existing tests pass unchanged apart from the registry
shape, and a temporary programme in the test file with a hook plays in the
browser journey.

---

## F1 — Multiple-select and numerical answers

**Why.** Half of UCEED and CEED questions are multiple select or numerical.

**Change.**

- `src/learn/questions.js`:
  - `checkAnswer` handles three modes.
    - `single`: as now.
    - `multi`: `response` is an array of option ids. Correct only when the
      set equals `question.answer`. Return
      `partial: { rightChosen, wrongChosen, missed }`. Feedback: if any wrong
      option is chosen, that option's reason; else if some are missed, "You
      found n of m." then the reason of the first missed option; then the
      explanation.
    - `numeric`: `response` is a string from the input. Parse with
      `Number`; reject empty and non-finite as "Enter a number." Correct when
      it equals `answer.value` (integers) or lies in
      `[answer.min, answer.max]`. A question may carry
      `mistakes: [{ value, reason }]`; when the response equals one, use its
      reason.
  - `markFor(question, response, scheme)` per the ladder, section 2.5.
- `src/learn/Question.jsx`:
  - `multi`: choices toggle. Each shows a square check mark instead of a
    radio look. A line above the choices reads "Select all that apply."
    After reveal: correct options green, wrongly chosen red, missed options
    outlined green with the label "missed".
  - `numeric`: no choices. A single input, `inputMode="decimal"`, 8
    characters wide, with the unit after it. After reveal the input is
    read-only and the correct value is shown beside it when wrong.
  - `response` shape: id, array of ids, or string.
- `src/learn/LessonPlayer.jsx`: Check is enabled when the response is
  non-empty for its mode. Enter inside the numeric input presses Check.
- Styles: `.choice.is-multi`, `.numeric-answer`.

**Tests.** `checkAnswer` and `markFor` truth tables for all three modes,
including all UCEED partial-credit cases (exact, proper subset, any wrong,
blank) and numeric ranges. A browser journey answers one question of each
mode in a test programme.

**Done when.** The dev audit passes on both new modes in both themes, and
keyboard-only answering works (Space toggles a choice, Enter checks).

---

## F3 — Worked solutions

**Why.** Exam-hard problems are taught by showing the routine on a full
problem.

**Change.**

- Question objects may carry `solution: [{ text, figure? }]`.
- New step kind `worked`: shows the question (figures and, for choice
  modes, the options as plain cards), then the solution steps revealed one
  at a time by a "Next step" pill in the content area. The action bar's
  Continue is enabled once every step is shown. The final step states the
  answer; the correct option highlights.
- After any `check` whose question has a `solution`, the feedback panel has
  a "See the working" link that opens the same step-through in place.
- `src/learn/programme-model.js`: validate `worked` steps; require that the
  kind and level produce a `solution` (call the generator in validation).

**Tests.** Validation rejects a `worked` step whose question has no
solution. Browser journey: reveal all steps, Continue enables.

---

## F4 — Hints

**Change.**

- Questions may carry `hints` (0–2 strings).
- In a `check` at L3 or above with hints, the action bar shows a quiet
  "Hint" pill left of Check. Each press reveals the next hint above the
  action bar. Using a hint sets `hinted: true` on the step result.
- A hinted correct answer counts as answered but not as "right first time"
  in summaries.
- Progress: `steps[stepId] = { correct, hinted }`. `readProgress` defaults
  `hinted` to false.

**Tests.** Model: hinted results are excluded from the first-time count.
Journey: a hint appears and the summary reflects it.

---

## F5 — Practice screens

**Change.**

- New step kind `practice`:
  `{ id, kind: 'practice', question: { kind, level }, streak: 3 }`.
- The player draws a fresh seed for each question from
  `crypto.getRandomValues` (pass the seed into `generateQuestion`; the engine
  stays pure). Flow per question: answer, Check, feedback, "Next question".
- A streak counter of dots sits above the question. A wrong answer resets
  it. When the streak reaches `streak`, Continue enables and the feedback
  panel says so; the student may keep practising.
- Progress: `practice[stepId] = { bestStreak, passedAt }`.
- At the end of every lesson (on the `takeaway` screen) add a quiet
  "Practise more" pill that opens practice for the lesson's main kind at the
  lesson's level.
- For tests, the preview route accepts `?seed=n` to make practice seeds
  deterministic: seed `n`, then `n + 1`, and so on.

**Tests.** Model: streak logic. Journey: three correct answers with
`?seed=` enable Continue.

---

## F2 — Tiers, tier quizzes, unlocking and placement

**Why.** One programme must hold the whole climb.

**Change.**

- `src/learn/programme-model.js`:
  - Accept v2 programmes (`tiers`) as in contracts, section 3.7. Provide
    `tiersOf(programme)` that returns v2 tiers, or for a v1 programme one
    Foundations tier built from `lessons` and `challenge`.
  - Validation: tier ids from the fixed list and in order; lesson ids unique
    across tiers; each lesson's `level` no higher than its tier's; every
    quiz question's level supported by its kind; Mastery quiz has a
    `marking` scheme other than `plain`.
  - Unlock rule: tier *n* is open when *n* is first or the quiz of tier
    *n − 1* is passed. `programmeSummary` returns per-tier state:
    `{ open, lessonsDone, lessonsTotal, quiz: { best, passed } }`.
  - Progress v2 with migration from v1 (contracts, section 3.8).
- `src/learn/LearnProgramme.jsx`: the overview groups the lesson path by
  tier with a heading, the level badge and a lock state. A locked tier shows
  "Pass the <previous tier> quiz to open, or take this tier's quiz to skip
  ahead." Each tier ends with its quiz row.
- `src/learn/LessonPlayer.jsx`: generalise `ChallengePlayer` into
  `QuizPlayer({ tier })`. Route: `?lesson=quiz-<tierId>`. Keep
  `?lesson=challenge` as an alias for the Foundations quiz.
- Migrate the five programme files to v2 with one Foundations tier each.
  Content does not change in this package.

**Tests.** Model: unlock logic, placement (passing tier 3's quiz opens tier
4 without tier 2), migration of stored v1 progress. Journeys: locked tier is
not startable; passing a quiz with `?seed=` opens the next tier.

---

## F9 — Exam marking and pace in the Mastery set

**Change.**

- `QuizPlayer` with `marking` other than `plain` computes marks with
  `markFor`, shows the scheme before starting ("+4 / 0 for numerical…"), and
  records time per question.
- The result screen shows: marks out of the maximum, accuracy, a table of
  questions with marks and time against `targetSeconds`, and for each kind
  that lost marks a link to its lesson.
- Best result is by marks, then by time.

**Tests.** `markFor` already covered in F1. Journey: a Mastery set of three
questions with known seeds yields the expected marks.

---

## F8 — Release switch

**Change.** See [07-portal-rollout.md](07-portal-rollout.md), section 7.3.
In short: `status` on each programme; the signed-in Learn page lists only
programmes that are both `released` in code and released on the server; the
development preview lists everything with a "Preview" pill.

## F7 — Server-side progress

**Change.** See [07-portal-rollout.md](07-portal-rollout.md), section 7.2.
The storage module gains a server adapter behind the same
`loadProgress`/`saveProgress` shape, with local storage as an offline queue.

## F10 — Review queue and recommendation (after first release)

- Keep a per-student list of kinds answered wrong in the last 14 days.
  Offer "Review 5" on the programme overview: five practice questions drawn
  from those kinds at the level missed.
- Extend the server's `learning_progress()` recommendation so the portal
  Overview can point to the next lesson of the programme whose topic the
  student is weakest in.

## F11 — Admin view (after first release)

- In the admin Learn panel: per programme and tier, students started,
  lessons completed, quiz pass rate, median Mastery marks, and the five
  kinds with the lowest first-time accuracy.
