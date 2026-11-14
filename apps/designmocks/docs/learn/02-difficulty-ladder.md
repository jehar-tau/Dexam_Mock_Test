# 2. Difficulty ladder

Every programme climbs the same five levels, from the first idea to problems
as hard as the hardest the exams set. This document defines the levels, the
levers that raise difficulty, and how to prove a level is truly at exam
standard.

> **The owner's reference standard overrides this document where they
> differ.** See [08-owner-reference-standard.md](08-owner-reference-standard.md).
> Exam hard means the hardest questions in the owner's bank: compound
> solids with many faces, options that differ by one face, and no plain
> cubes where the exam uses complex objects.

## 2.1 What the exams ask

Measured on the private question bank on 13 November 2026 (4,737 questions;
used for analysis only, never copied).

| Exam | Single choice | Multiple select | Numerical answer |
|---|---:|---:|---:|
| UCEED | 418 | 237 | 214 |
| CEED | 481 | 128 | 109 |
| NID | 318 | 3 | 3 |
| NIFT | 2,313 | 0 | 0 |

So for UCEED and CEED, about half of the objective questions are **not**
single choice. A student who has only met four-option questions is not
prepared. Multiple select and numerical answers are required from Exam
standard upward.

What makes the real questions hard, seen across the spatial topics:

- **Compound reasoning.** One question chains two or three ideas: a die
  given as a net, four such dice stacked, find the sum of the faces parallel
  to the ground.
- **Indirect information.** The net is not given; two or three views of the
  solid are. The fold sequence is shown as crease lines only.
- **Numerical answers with no options to eliminate.** Count the surfaces of
  a cube with tunnels cut through it. Count the reflections between two
  mirrors. Find the rpm of the last gear.
- **"Select all that apply".** Which of these can be the side view, given
  the front and top? One to three options are right.
- **Close distractors.** Options differ by one mirrored element or one
  swapped face.
- **Story wrapping and irrelevant detail.** The geometry is hidden inside a
  short scenario.
- **Time.** About two minutes a question in UCEED, about 80 seconds in CEED.

## 2.2 The five levels

| Level | Name | The student can… | Question form | Tool | Target time |
|---|---|---|---|---|---|
| L1 | First idea | Say what the thing is and predict one step. | Single choice, 2–4 options, one inference | On every slide and available during checks | Untimed |
| L2 | Core technique | Apply the standard routine to a clean case. | Single choice, 4 systematic distractors | On slides only | Untimed, shown afterwards |
| L3 | Exam standard | Solve the form the exam sets most often. | Single choice with close distractors, multiple select, simple numerical | Not available in checks; one hint | 120 s |
| L4 | Exam hard | Solve compound and indirect problems. | Numerical and multiple select dominate; story wording | Not available; hints cost a mark flag | 150 s |
| L5 | Mastery | Do all of the above mixed, at exam pace, under exam marking. | The exam's own mix | None | Exam pace |

Tiers group the levels:

| Tier | Levels | Lessons | Ends with |
|---|---|---|---|
| Foundations | L1–L2 | 3–5 | Tier quiz, 8 questions, pass at 6 |
| Exam standard | L3 | 3–4 | Tier quiz, 8 questions, pass at 6 |
| Exam hard | L4 | 3–4 | Tier quiz, 8 questions, pass at 5 |
| Mastery | L5 | 1 mixed review lesson | Timed exam-marked set, 12–15 questions |

A tier unlocks when the previous tier's quiz is passed. A student may sit any
tier's quiz without doing its lessons (placement): passing it unlocks the
next tier and marks the lessons as optional.

## 2.3 Levers that raise difficulty

A level is raised by pulling levers, never by making the figure smaller or
the wording obscure. Every topic spec names the levers it uses per level.

| Lever | L1–L2 | L3 | L4 |
|---|---|---|---|
| Elements | Few, symmetric | Realistic count, asymmetric | Maximum the exam uses |
| Steps of inference | 1 | 2 | 3–4, across two ideas |
| Information | Given directly | One thing must be derived | Given indirectly (views, crease lines, a story) |
| Answer form | Single choice | Single, multiple select, small numerical | Numerical, multiple select |
| Distractors | Clearly different | Differ by one property | Differ by one property, including the mirror image |
| Support | Tool during the check | One hint | Hint flagged as used |
| Orientation | Upright, standard | Turned or flipped | Turned, flipped and combined with another topic |
| Irrelevant detail | None | A little | Story with numbers that do not matter |
| Time | None | Shown | Shown, with pace feedback |

## 2.4 Lesson anatomy by tier

Foundations lesson (8–10 screens):
`slide` with tool ×2–3 → `check` ×2 → `slide` → `check` ×2 → `takeaway`.

Exam standard lesson (10–13 screens):
`hook` → `slide` with tool ×2 → `worked` → `check` with hint ×2 → `slide`
(the trap) → `check` ×2 → `practice` (streak of 3) → the hook again as a
`check` → `takeaway`.

Exam hard lesson (10–14 screens):
`hook` → `slide` (how the compound problem breaks into known parts) →
`worked` → `check` ×2 → `worked` (a second archetype) → `check` ×2 →
`practice` (streak of 3) → the hook again as a `check` → `takeaway`.

Mastery review lesson: no new teaching. One `slide` listing the routines,
then `practice` across every kind in the programme at L3–L4, then the timed
set.

## 2.5 Marking in tier quizzes and the Mastery set

Tier quizzes are marked plainly: one point per fully correct question.

The Mastery set uses the real schemes, from `docs/EXAM_RULES.md`. Do not
change these numbers without updating that document first.

| Scheme | Numerical | Multiple select | Single choice |
|---|---|---|---|
| `uceed` | +4, wrong 0 | +4 exact; +1 per correct option when every selected option is correct and at least one is missing; −1 if any selected option is wrong; 0 if blank | +3, wrong −0.71 |
| `ceed` | +4, wrong 0 | as UCEED | +3, wrong −0.5 |
| `nift` | — | — | +1, wrong −0.25 |

The Mastery result shows marks, accuracy, time per question against the
target, and which kinds lost marks, each linked to its lesson.

## 2.6 Proving a level is at exam standard

Before a tier is called built, the builder completes this calibration and
records it in the topic spec under "Archetype coverage".

1. Read the topic's "Exam evidence" section in its spec. It lists the
   archetypes the exams use, in our own words.
2. Optionally, on the owner's machine only, sample ten questions of the
   topic from the private bank to confirm the archetypes. Read them; do not
   copy text or figures anywhere.
3. For each archetype, name the question kind and level that reproduces its
   reasoning. An archetype with no kind is a gap: add a kind or record why
   it is out of scope.
4. For each L3 and L4 kind, generate seeds 1 to 20 and check by hand that at
   least 16 need the stated number of inference steps and that no option can
   be eliminated at a glance.
5. Solve five L4 questions per kind yourself without the engine. If any
   takes under 30 seconds, the kind is not L4.

A question is at exam standard when all of these hold:

- It needs at least two inferences (L3) or three (L4).
- The answer cannot be reached by eliminating options on appearance alone.
- For numerical kinds, the answer space has at least eight plausible values.
- For multiple select, the number of correct options varies between seeds.
- The solution steps teach a routine that transfers to the next seed.

## 2.7 Seeds and fairness

- Lesson checks use fixed seeds chosen by the builder so that the lesson
  shows a good spread: both answers of a yes/no kind, different correct
  positions, no near-duplicates. Record chosen seeds in the programme file.
- Practice screens and quizzes draw fresh seeds per attempt.
- The same seed and level always produce the same question, on every
  machine. Tests assert this.
