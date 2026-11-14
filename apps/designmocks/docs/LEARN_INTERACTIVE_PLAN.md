# Learn: interactive programme plan

The standing plan for Learn. It stays intact across sessions and across
whoever builds: update the status, phases and decisions log as work lands;
do not rewrite the principles without a dated decision.

Created 12 November 2026. Revised 13 November 2026 twice: after the owner's
first evaluation (step-by-step player, five programmes) and after the
second (exam-level difficulty, and a complete build kit so any model or
developer can continue the work).

Branch of record: `feature/dmocks-learn-interactive-cube-nets`.

## 1. Where everything is

| What | Where |
|---|---|
| This plan: goal, phases, decisions, open questions | this file |
| The build kit: standard, ladder, contracts, playbook, curriculum, rollout | [learn/README.md](learn/README.md) |
| One specification per topic | [learn/topics/](learn/topics/) |
| Code | `src/learn/` |
| Tests | `tests/cube-net.test.mjs`, `tests/learn-topics.test.mjs`, `tests/learn-programme.test.mjs`, `tests/e2e/learn-programme.spec.js` |

A builder starts at [learn/HANDOFF.md](learn/HANDOFF.md), then
[learn/README.md](learn/README.md), not here.

## 2. Goal

Every topic the design entrance exams test becomes an interactive
**programme** a student can work through on a phone: one idea per screen, a
live tool, questions with reasoned feedback, climbing from the first idea
to problems as hard as the hardest the exams set, ending in a timed set
marked like the real paper.

The owner's standard, in the owner's words: the sessions are "good
interactive sessions", but must go "from easier to the most difficult part
of learning" so that students "solve much more complex problems that
actually are asked in exam".

## 3. Principles

1. One idea per screen, a live figure on most screens, a question every two
   or three screens. Full detail:
   [learn/01-experience-standard.md](learn/01-experience-standard.md).
2. Every programme climbs five levels in four tiers, ending at exam
   difficulty with the exam's own answer forms (single choice, multiple
   select, numerical) and marking:
   [learn/02-difficulty-ladder.md](learn/02-difficulty-ladder.md).
3. Every question is generated from a seed by a pure engine that computes
   the answer and proves every wrong option wrong.
4. Original content only. Figures are drawn by code. The private bank is
   used to learn what the exams ask, never copied.
5. Programmes ship as reviewed code with tests. Nothing reaches students
   without the release checklist and an administrator's release.
6. Light controls: sliders, icon buttons, tappable figures, pills.
7. Works at 320 px, by keyboard, in both themes, WCAG 2.1 AA.
8. Learn stays free for signed-in students unless the owner decides
   otherwise.

## 4. State on 13 November 2026

Built and verified (574 unit tests, 16 browser journeys on desktop Chromium
and Pixel 7, build, preview isolation, accessibility audit in both themes):

- The step-by-step player, the programme overview with a lesson path, the
  generic question and figure layers, the question registry.
- **Counting cubes complete through all four tiers**: ten lessons, three
  tier quizzes and a timed set marked like UCEED. It is the reference.
- **Nets of solids complete through all four tiers**: solids with up to
  sixteen faces, nets that differ by one face, select-all answers.
- Four programmes at **Foundations** level only: cube nets (5 lessons),
  paper folding (2), mirror and water images (2), colour (3).
- Player features for exam level: numerical and multiple-select answers,
  hints, worked solutions, practice streaks, tiers, exam marking.
- Progress is saved in the browser only.

Planned and fully specified:

- Foundation work packages F1–F11 (answer modes, tiers, worked solutions,
  hints, practice, exam marking, release switch, server progress).
- Exam standard, Exam hard and Mastery tiers for the five built programmes.
- Six new programmes: views and rotation, dice, surfaces of solids,
  counting figures, gears and pulleys, shadows and light.
- A catalogue of every further topic with scope cards.

Nothing is committed. Nothing is visible to students.

## 5. Phases

- [x] **Phase 0 — first topic end to end.** 12 November.
- [x] **Phase 1 — step-by-step player and five Foundations programmes.**
  13 November.
- [x] **Phase 1c — the build kit.** 13 November. Standard, ladder,
  contracts, foundation packages, playbook, curriculum, rollout and eleven
  topic specifications.
- [x] **Phase 2 — foundation packages F6, F1, F3, F4, F5, F2, F9.** Done 13
  November: levels, three answer modes, exam marking, hook, worked and
  practice screens, hints, tiers with quizzes and unlocking.
- [ ] **Phase 3 — wave 1.** The five built programmes through all four
  tiers. Counting cubes is done (13 November) and is the reference
  programme. Remaining: paper folding, cube nets, mirror images, colour.
- [x] **Phase 3b — Nets of solids, first build.** 13 November. The
  solid-net engine, the unfolder tool and four tiers. Awaiting the owner's
  judgement against the anchors; known gaps are listed in the topic
  specification.
- [ ] **Phase 4 — wave 2.** Views and rotation, dice, surfaces of solids,
  counting figures, gears and pulleys, shadows and light.
- [ ] **Phase 5 — portal.** F8 release switch, F7 server progress, then
  release programmes one at a time by the checklist in
  [learn/07-portal-rollout.md](learn/07-portal-rollout.md).
- [ ] **Phase 6 — waves 3 to 5** from
  [learn/06-curriculum.md](learn/06-curriculum.md), each topic specified
  before it is built.
- [ ] **Ongoing — F10 review queue, F11 admin view, calibration from real
  student results.**

One build session does one foundation package or one tier of one
programme. A reviewer session checks each tier before the next begins.

## 6. Decisions log

- **2026-11-12 — First topic is cube nets.** Most common spatial question
  across the four exams, clean mechanism, fully generated, no figure rights.
- **2026-11-12 — Programmes ship as code, not database lessons.** The text
  lesson editor stays for prose.
- **2026-11-12 — Local progress for the evaluation phase.**
- **2026-11-12 — Click-to-place, never drag-only.**
- **2026-11-13 — Step-by-step player replaces the long lesson page.** The
  owner found the first build "good, not great" and "very chunky". One
  screen at a time, pinned Continue or Check, feedback with the reason; the
  fold explorer uses a slider, icon buttons and net thumbnails.
- **2026-11-13 — Five programmes in parallel at Foundations** so the owner
  could judge the format across topics.
- **2026-11-13 — "Hidden cube" definition.** Covered above, front-left and
  front-right; the lesson states it.
- **2026-11-13 — Difficulty must reach exam level.** The owner judged the
  built lessons "very easy". Every programme now has four tiers up to
  timed, exam-marked sets. The bank shows about half of UCEED and CEED
  questions are multiple select or numerical, so both answer forms are
  required from Exam standard upward.
- **2026-11-13 — Plan first, then build topic by topic.** The owner asked
  for a plan complete enough that a different model can build each topic to
  the same or a better standard. The build kit in `docs/learn/` is that
  plan; code changes wait for it to be accepted.
- **2026-11-13 — Mirrored projection corrected.** While fixing the view
  conventions for the kit, the isometric projection was found to draw every
  cube and stack as its mirror image. It is corrected in `cube-net.js`
  (the +x face is now on the left for the viewer at (+x, +y, +z)), with a
  test from physical reasoning. The fold explorer now starts from the top
  flap, half a turn round, so side faces read upright.
- **2026-11-13 — Build the reference first, then hand over.** The owner's
  usage of the strongest model is limited, so that model built the player
  upgrades and one complete programme (counting cubes, all four tiers) as
  the pattern. Lower-cost models continue from `docs/learn/HANDOFF.md`,
  which is kept current at every checkpoint.
- **2026-11-13 — The owner's question bank is the difficulty reference.**
  The owner supplied a 146-question spatial bank and named four folding
  questions (UCEED 2015 Q76, 2016 Q27 and Q33, 2023 Q49) as the level the
  hardest practice must reach: compound solids with many faces, not single
  cubes. Recorded in `learn/08-owner-reference-standard.md`. A new
  programme, Nets of solids, is specified and becomes the next build after
  the counting-cubes review. The surfaces, views and dice specifications
  must be extended before they are built.
- **2026-11-13 — Topics that need reviewed facts are "decks", not
  engines.** Crafts, designers, materials and general knowledge cannot be
  generated and proven by code; they wait for a deck tool and sourced,
  owner-reviewed content (wave 5).

## 7. Open questions for the owner

1. Free for all signed-in students, or is the Mastery tier paid?
2. Which practice topic names does the reviewed bank use? Take-away links
   currently target `visualisation`, `design-sensitivity`, `observation` and
   `mechanics`, and fall back to the practice chooser when a pool does not
   exist.
3. Should the player also replace the Learn text-lesson reader so prose
   lessons get the same pacing?
4. Who reviews deck content (facts and sources) before wave 5?
5. May the builder model run on the owner's Mac with access to the private
   bank for calibration, or should calibration use only the archetype
   tables in the specifications?
6. Social "accompanying post" per lesson for the media pipeline: wanted or
   not?

## 8. How to update this plan

- Tick a phase only when its definition of done holds.
- Add a dated line to the decisions log for any change of direction.
- Keep the status board in [learn/README.md](learn/README.md) and the
  foundation table in
  [learn/04-foundation-work-packages.md](learn/04-foundation-work-packages.md)
  current in the same change as the work.
- Keep this file and the kit in the same pull request as the code they
  describe.

- 2026-11-14: Owner supplied a folder of theory documents and question banks for every topic, and standing permission to push, open pull requests and merge Learn work. Topic map, model split and pull-request rules recorded in `docs/learn/09-topic-bank-map.md`. First pull request merged (#186) with checks run by hand because GitHub Actions billing is blocked.
- 2026-11-14: Built `mechanisms` (gears, belts, ropes, levers) through all four tiers. Direction questions carry four options ("cannot turn", "rocks back and forth") to meet the four-option contract. Mixed systems are sized by diameter, as the exam sets them; pure gear trains by teeth. Pulley effort was planned and left for later.
- 2026-11-14: Built `counting-figures` through all four tiers. Counting uses floating point with a tolerance, not exact integers, so that regular polygons (the star in a pentagon) can be drawn; correctness rests on two independent counters agreeing. Area and shaded-region questions from the same bank are left for a later build.
