# Learn build kit

Everything a builder needs to add interactive learning to DMocks, topic by
topic, at exam difficulty. Written so that any capable model or developer can
pick up one topic and ship it to the same standard without having seen the
earlier work.

**Taking over the work? Read [HANDOFF.md](HANDOFF.md) first.** It says
exactly where the build stands and what to do next.

Master status and decisions live in
[../LEARN_INTERACTIVE_PLAN.md](../LEARN_INTERACTIVE_PLAN.md). This folder is
the detail.

## Reading order

| # | Document | Read it when |
|---|---|---|
| 1 | [01-experience-standard.md](01-experience-standard.md) | Always, first. What a lesson must feel like. |
| 2 | [02-difficulty-ladder.md](02-difficulty-ladder.md) | Always. How every topic climbs from first idea to exam-hard. |
| 3 | [03-architecture-contracts.md](03-architecture-contracts.md) | Before writing code. The exact shapes of engines, questions, figures, tools and programmes. |
| 4 | [04-foundation-work-packages.md](04-foundation-work-packages.md) | Once. Player features that must exist before exam-level lessons can be built. Check their status first. |
| 5 | [05-build-playbook.md](05-build-playbook.md) | Every build session. The step-by-step procedure, commands, pitfalls, checklists and ready-made briefs. |
| 6 | [06-curriculum.md](06-curriculum.md) | When choosing what to build next. Every topic, its exam weight, wave and status. |
| 7 | [07-portal-rollout.md](07-portal-rollout.md) | When a topic is ready to reach students. Server progress, release switch, gates. |
| 8 | [08-owner-reference-standard.md](08-owner-reference-standard.md) | Before any Exam hard or Mastery tier. The owner's question bank is the difficulty reference; this says what its hardest questions demand. |
| 9 | [topics/](topics/) | The specification for the topic you are building. One file per topic. |

## The one-paragraph version

A **programme** is one topic. It has four **tiers** that climb five
**levels**: Foundations (L1–L2), Exam standard (L3), Exam hard (L4) and
Mastery (L5). Each tier has short **lessons** played one screen at a time:
a hook problem, technique slides with a live tool, a worked solution, checks
with reasoned feedback, endless practice, a take-away. Every question is
**generated from a seed by a pure engine** that computes the answer and
proves every wrong option wrong. Tiers end in a quiz; the last tier is a
timed set marked like the real exam. Nothing reaches students until the
topic passes the release checklist and an administrator releases it.

## Rules that never bend

1. Original content only. Figures are drawn by code. Never copy a question,
   figure or wording from the private bank or any past paper. The bank is
   used only to learn which forms and difficulty the exams use.
2. Every generated question is verified: one computed answer, every
   distractor proven wrong, deterministic for its seed.
3. One idea per screen. Two sentences. A live figure wherever one helps.
4. No topic is "done" at Foundations. Done means all four tiers, with the
   top tier matching the owner's reference standard (document 8).
5. Tests, build, browser journeys and the accessibility audit pass before a
   topic is called built. Say what was not verified.
6. Keep the DMocks rules in `apps/designmocks/AGENTS.md`: separate brand,
   no real student data, no bank content in the repo, sales and sign-up
   switches untouched.

## Status board

Update this table in the same change as the work.

| Programme | Spec | Foundations | Exam standard | Exam hard | Mastery | Portal |
|---|---|---|---|---|---|---|
| Cube nets | [spec](topics/cube-nets.md) | Built | Built | Built | Built | Preview |
| Nets of solids | [spec](topics/nets-of-solids.md) | Built | Built | Built | Built | Preview |
| Dice | [spec](topics/dice.md) | Planned | Planned | Planned | Planned | — |
| Paper folding and cutting | [spec](topics/paper-folding.md) | Built | Planned | Planned | Planned | Preview |
| Mirror and water images | [spec](topics/mirror-images.md) | Built | Planned | Planned | Planned | Preview |
| Counting cubes | [spec](topics/counting-cubes.md) | Built | Built | Built | Built | Preview |
| Views and rotation | [spec](topics/views-and-rotation.md) | Planned | Planned | Planned | Planned | — |
| Surfaces of solids | [spec](topics/solid-surfaces.md) | Planned | Planned | Planned | Planned | — |
| Counting figures | [spec](topics/counting-figures.md) | Planned | Planned | Planned | Planned | — |
| Gears, belts and levers | [spec](topics/mechanisms.md) | Built | Built | Built | Built | `mechanisms` |
| Shadows and light | [spec](topics/shadows-and-light.md) | Planned | Planned | Planned | Planned | — |
| Colour | [spec](topics/colour.md) | Built | Planned | Planned | Planned | Preview |

Foundation work packages: F6, F1, F3, F4, F5, F2 and F9 are done; see the
status table at the top of
[04-foundation-work-packages.md](04-foundation-work-packages.md).
**Counting cubes is the reference programme: copy its structure.**

## Order of work

1. Foundation packages (done) and counting cubes through all tiers (done).
2. Upgrade the other four built programmes through all tiers, one tier per
   session, in this order: paper folding, cube nets, mirror images, colour.
3. Wave 2 programmes: views and rotation, dice, surfaces of solids, counting
   figures, gears and pulleys, shadows and light.
4. Foundation F7–F8 (server progress and the release switch), then release
   topics to the portal one at a time.
5. Waves 3–5 from the curriculum.
