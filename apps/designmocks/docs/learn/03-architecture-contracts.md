# 3. Architecture and contracts

The exact shapes a builder must produce. "Now" describes the code as it
stands on 13 November 2026. "v2" is the target after the foundation work
packages; build new work to v2 once the relevant package is marked done.

All paths are relative to `apps/designmocks/`.

## 3.1 Code map (now)

```
src/learn/
  random.js              seededRandom(seed), pick(rng, list), shuffle(rng, list)
  cube-net.js            engine: nets, folding, rotations, views, cube questions
  paper-fold.js          engine: folds as reflections, punches, unfold questions
  mirror.js              engine: patterns, words, six transforms, image questions
  cube-count.js          engine: height maps, totals, hidden, box gap
  colour.js              engine: 12-step wheel, complements, mixes, value
  questions.js           registry: generateQuestion(kind, seed), checkAnswer(q, r), questionKinds
  figures.jsx            <Figure spec/> and the renderers it dispatches to
  CubeNetTool.jsx        NetDiagram, CubeView, FoldExplorer, OppositeExplorer, NetBuilder, IconButton
  tools.jsx              <LearnTool tool props/> and the other tools
  Question.jsx           <Question/>: prompt, figures, choices, revealed state
  LessonPlayer.jsx       <LessonPlayer/>, <ChallengePlayer/>
  LearnProgramme.jsx     overview, routing, <LearnProgrammePage/>, <LearnProgrammePreview/>
  programme-model.js     validateProgramme, progress helpers
  programme-storage.js   loadProgress, saveProgress (local storage)
  programmes/*.js        content
  programmes/index.js    registry: programmes[], findProgramme(slug)
tests/
  cube-net.test.mjs  learn-topics.test.mjs  learn-programme.test.mjs
  e2e/learn-programme.spec.js
```

Wiring outside `src/learn/`: routes in `src/App.jsx`
(`/dashboard/learn/programme/:slug`, dev `/learn-programme-preview/:slug?`),
the programme list in `src/Learn.jsx` (`ProgrammeList`), the preview path in
`src/PortalShell.jsx`, and styles at the end of `src/styles.css`.

## 3.2 Engine module

One file per topic: `src/learn/<topic>.js`. Pure ES module, no DOM, no
React, no `Math.random`, no `Date`. Imports only `./random.js` and other
engines.

It exports:

- Model functions: build, transform and measure the topic's objects.
- One generator per question kind:
  `function <name>Question(seed, level)` returning a question object.
- Named constants a tool or figure needs.

Rules:

- All randomness comes from `seededRandom(seed)`. Same seed and level, same
  question, byte for byte.
- The generator computes the answer from the model, never from a table.
- Every distractor is checked against the truth before it is accepted. If it
  could also be correct, discard it and draw another. Loops that search for
  distractors have a guard counter and a deterministic fallback.
- Generators never throw for any integer seed from 1 to 10,000.

## 3.3 Question object

Now (v1):

```js
{
  kind: 'which-cube', seed: 41,
  prompt: 'Which cube can be made by folding this net?',
  figures: [ FigureSpec, ... ],          // shown above the choices
  options: [ { id, label, figure | text, reason, correct } ],
  answer: 'correct',                      // id of the right option
  explanation: 'All three faces …',       // the rule, one or two sentences
  interactive: undefined | 'build-net'    // special full-screen task
}
```

v2 adds (package F1, F3, F4, F9):

```js
{
  level: 3,                               // 1–5
  answerMode: 'single' | 'multi' | 'numeric',
  // single:  answer is one option id
  // multi:   answer is an array of option ids, 1–3 of them, sorted
  // numeric: answer is { value: 14 } or { min: 2.4, max: 2.6 }; no options
  unit: 'cubes',                          // numeric only, shown after the input
  hints: ['Find the opposite pairs first.'],          // 0–2, L3 upward
  solution: [ { text: 'B and E are opposite …', figure?: FigureSpec } ],  // 3–6 steps, L3 upward
  targetSeconds: 120
}
```

`checkAnswer(question, response)` returns
`{ correct, feedback, partial? }`. For multi, `partial` is
`{ rightChosen, wrongChosen, missed }`. Feedback for a wrong answer is the
chosen option's `reason` (or, for numeric, the commonest-mistake reason when
the response matches a known mistake value) followed by `explanation`.

`markFor(question, response, scheme)` returns marks under `plain`, `uceed`,
`ceed` or `nift` (see the ladder, section 2.5).

## 3.4 Registry

`src/learn/questions.js` maps each kind to its generator and adapts engine
output to the question shape.

Now: `generators[kind] = seed => question`.

v2: `kinds[kind] = { generate(seed, level), levels: [1, 2, 3], answerMode, topic }`
and `generateQuestion(kind, seed, level)`. `levels` lists the levels the kind
supports; asking for another level throws.

Kind names are lower-case words joined by hyphens, unique across all topics,
and never renamed once a programme uses them (stored progress refers to
step ids, and tests refer to kinds).

## 3.5 Figure spec

A plain object with a `type`. `<Figure spec compact/>` in `figures.jsx`
renders it. Add a renderer and a `case` for each new type.

| type | fields | renderer |
|---|---|---|
| `net` | `cells`, `states?`, `badCells?`, `compact?` | `NetDiagram` |
| `cube` | `view`, `large?` | `CubeView` |
| `fold-sequence` | `folds`, `punched?` | `FoldSequence` |
| `holes` | `holes` | `HoleGrid` |
| `image` | `figure`, `transform`, `line?` | `ImageFigure` |
| `stack` | `heights`, `large?` | `StackFigure` |
| `swatch` | `colour`, `name?` | `Swatch` |

Renderer rules:

- Inline SVG (or an HTML grid for nets). `role="img"` and an `aria-label`
  that states what is shown in words a student could use.
- Takes `compact` for use inside an option card (about 60% size).
- Uses theme tokens through CSS classes, not inline colours, except where
  the colour is the content (swatches).
- Deterministic: same spec, same markup.

## 3.6 Tool

A React component in `tools.jsx` (or its own file when large), registered by
name in `LearnTool`. Props come from the slide's `props`.

- State is local. Changing `props` identity must not be required to reset;
  the player remounts the screen per step.
- Renders inside `<div className="tool">` with a `.tool-stage`, an optional
  `.tool-row` of controls and a `.tool-status` line.
- Calls engine functions for every computed value. No geometry in JSX.
- Add the tool's name to `toolNames` in `tools.jsx` and to the list in
  `tests/learn-programme.test.mjs`.

## 3.7 Programme content

Now (v1), `src/learn/programmes/<slug>.js`:

```js
export const fooProgramme = Object.freeze({
  slug: 'foo', title, summary, topic, exams: ['uceed', …], minutes,
  lessons: [ { id, title, summary, minutes, steps: [ Step, … ] } ],
  challenge: { title, minutes, description, questions: [ { kind, count } ] },
});
```

Step (v1): `slide` `{ id, kind, title?, text | [text], tool?, props?, figure?, hint? }`,
`check` `{ id, kind, question: { kind, seed } }`,
`takeaway` `{ id, kind, body }`.

v2 (package F2):

```js
{
  slug, title, summary, topic, exams, minutes,
  status: 'preview' | 'released',
  tiers: [
    {
      id: 'foundations' | 'exam-standard' | 'exam-hard' | 'mastery',
      title, level,                       // the highest level in the tier
      lessons: [ { id, title, summary, minutes, level, steps: [ Step, … ] } ],
      quiz: { minutes, pass, marking: 'plain' | 'uceed' | 'ceed' | 'nift',
              questions: [ { kind, level, count } ] },
    },
  ],
}
```

Steps (v2) add `hook` `{ id, kind, text, question: { kind, seed, level } }`,
`worked` `{ id, kind, question: { kind, seed, level } }`,
`practice` `{ id, kind, question: { kind, level }, streak: 3 }`, and `level`
inside every `question`.

A v1 programme (with `lessons` and `challenge`) is read as one Foundations
tier whose quiz is the challenge. Lesson ids are unique across the whole
programme, not per tier, because progress is keyed by lesson id.

`validateProgramme` enforces all of the above. Never weaken it to make
content pass; fix the content.

## 3.8 Progress

Now (v1), in local storage under `dmocks:learn:<slug>:<actorId>`:

```js
{ version: 1,
  lessons: { [lessonId]: { steps: { [stepId]: { correct } }, completedAt } },
  challenge: { score, total, seconds, at, attempts } | null }
```

v2 (packages F2, F4, F5, F7) adds `steps[stepId].hinted`,
`quizzes: { [tierId]: { best: { score, total, marks, seconds, at }, attempts, passedAt } }`
and `practice: { [stepId]: { bestStreak } }`. `readProgress` upgrades v1 in
place: the v1 `challenge` becomes `quizzes.foundations`.

Rules that hold in every version: the first recorded result of a check
stands; a lesson completes once; a best result only improves.

## 3.9 Tests every topic must add

In `tests/<topic>.test.mjs` (or `learn-topics.test.mjs` for small engines):

1. Model invariants with hand-computed cases (at least five).
2. For every kind and supported level, seeds 1–60: deterministic, right
   option count, unique option ids, exactly the declared answer shape,
   answer verified by an independent calculation inside the test, every
   distractor verified wrong.
3. Distribution: over 40 seeds the correct option position and, for yes/no
   or multi kinds, the answer itself vary.
4. Solution and hint presence from L3.

`tests/learn-programme.test.mjs` already validates every registered
programme and each lesson seed. Add the new slug to its expected list.

In `tests/e2e/learn-programme.spec.js` add one journey per programme: open a
lesson, use the tool, answer a check of each answer mode the topic uses,
finish the lesson, see progress.

## 3.10 Naming

- Engine files and slugs: kebab-case topic names (`paper-fold.js`,
  `paper-folding`).
- Lesson ids and step ids: kebab-case, stable. Checks are `check-1`,
  `check-2`… within a lesson; hooks `hook`; worked examples `worked-1`.
- CSS classes: prefixed by the figure or tool (`.stack-figure`,
  `.fold-step`). No generic names.
