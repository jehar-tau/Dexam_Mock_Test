# Mirror and water images

Slug `mirror-images` · topic `visualisation` · exams uceed, ceed, nid, nift ·
engine `src/learn/mirror.js` · tool `mirror`

Status: Foundations **Built** · Exam standard Planned · Exam hard Planned ·
Mastery Planned

## 1. Outcome

The student can reflect figures, words and clock faces in a mirror placed
on any side or at 45°, chain several reflections, count the images formed
between two mirrors, and trace a ray bouncing off mirrors on a grid.

## 2. Exam evidence

| Id | Archetype | Form | Frequency |
|---|---|---|---|
| M1 | Which option is the mirror image of the figure | Single choice | Common |
| M2 | Water image of a figure or word | Single choice | Regular |
| M3 | A figure mirrored in turn along several named axes: the result | Single choice | Regular |
| M4 | An object between two mirrors at an angle: how many reflections | Single or numerical | Occasional |
| M5 | Reflection of a real scene in water: which drawing is right | Single choice | Occasional |
| M6 | Mirror image of a clock or of letters and numbers | Single or numerical | Regular in NID and NIFT style papers |
| M7 | Light or sight lines bouncing off mirrors | Single or numerical | Occasional |

## 3. Techniques taught

- **One pair swaps.** Side mirror: left and right. Water: top and bottom.
- **Nearest stays nearest.** The part touching the mirror line touches it
  in the image.
- **Letters that survive.** A H I M O T U V W X Y look the same in a side
  mirror. B C D E H I K O X look the same in water. H I O X in both.
- **Clock in a mirror.** Mirror time = 11:60 minus the time shown (12:00
  and 6:00 stay).
- **Two reflections make a turn or a slide.** Across two perpendicular
  lines: a half turn. Across two parallel lines: a slide, no flip.
- **Images between two mirrors.** With angle θ between the mirrors, let
  m = 360 ÷ θ. If m is even, m − 1 images. If m is odd, m − 1 images when
  the object is on the bisector, otherwise m.
- **Ray on a grid.** A ray turns a right angle at every 45° mirror; follow
  it cell by cell.

## 4. Ladder

### Foundations (L1–L2) — built

`mirror` (mirror-image L1–L2 ×4), `water` (water-image ×3, mirror-image ×1).
Quiz: mirror 4, water 4.

### Exam standard (L3)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `any-side` | Mirror on any side | hook (`mirror-image` L3) · slide: the mirror line can be left, right, above or below, tool with a movable mirror line · slide: bigger figures, same rule · worked | `mirror-image` L3 ×4 (7×7 patterns with inner detail; the line on any of four sides), practice |
| `letters-clocks` | Letters and clocks | hook (`clock-mirror`) · slide: letters that survive · slide: the clock rule · worked | `symmetric-words` ×2 (multiple select), `clock-mirror` ×3 (numerical, answer as minutes past twelve or single choice of four clock faces), practice |
| `diagonal` | A mirror at 45° | hook (`mirror-image` L3 diagonal) · slide: a diagonal mirror swaps across and down, tool · worked | `diagonal-mirror` ×4, practice |

Quiz (8, pass 6): `mirror-image` L3 ×3, `symmetric-words` 1, `clock-mirror`
2, `diagonal-mirror` 2.

### Exam hard (L4)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `chains` | One mirror after another | hook (`reflection-chain`) · slide: two perpendicular lines make a half turn · slide: two parallel lines make a slide · worked | `reflection-chain` ×4, practice |
| `two-mirrors` | Images between two mirrors | hook (`image-count`) · slide: the 360 ÷ θ rule, tool with an angle slider · slide: the odd case · worked | `image-count` ×4 (numerical), practice |
| `rays` | Following a ray | hook (`ray-exit`) · slide: a 45° mirror turns the ray a right angle · worked | `ray-exit` ×3, `ray-bounces` ×1 (numerical), practice |

Quiz (8, pass 5): `reflection-chain` 3, `image-count` 2, `ray-exit` 2,
`ray-bounces` 1.

### Mastery (L5)

Review lesson, then 12 questions, 18 minutes, `uceed` marking:
`mirror-image` L3 ×2, `diagonal-mirror` ×1, `clock-mirror` ×2,
`symmetric-words` ×1, `reflection-chain` ×3, `image-count` ×2, `ray-exit` ×1.

## 5. Question kinds

| Kind | Levels | Mode | State |
|---|---|---|---|
| `mirror-image` | 1–2 (5×5, line right), 3 (7×7, line on any side) | single | exists at L1–L2 |
| `water-image` | 2 | single | exists |
| `symmetric-words` | 3 | multi | new |
| `clock-mirror` | 3 | single or numeric | new |
| `diagonal-mirror` | 3 | single | new |
| `reflection-chain` | 4 | single | new |
| `image-count` | 4 | numeric | new |
| `ray-exit` | 4 | single | new |
| `ray-bounces` | 4 | numeric | new |

### `mirror-image` L3

7×7 patterns of 14–20 cells in two tones (two cell classes, so inner detail
matters), asymmetric under all transforms. The mirror line is drawn on one
of four sides; left and right lines both mean `mirror`, top and bottom mean
`water`. Distractors: the other reflection, the half turn, and the truth
with one cell's tone swapped (`one-cell-off`), verified different.

### `symmetric-words` (multiple select)

- **Scenario.** Four words of 3–6 capitals from a fixed original list
  (section 6). Ask which look the same in a side mirror **when the whole
  word is reflected** (so the letters must be mirror-safe and the word a
  palindrome), or which have every letter unchanged in water (no palindrome
  needed; water keeps letter order).
- **Answer.** By the letter sets and a palindrome test.
- **Reasons.** Name the first letter that changes, or that the order
  reverses.

### `clock-mirror`

- **Scenario.** A plain clock face with hands and tick marks, no numerals,
  showing h:mm with mm a multiple of 5.
- **Ask.** "This is the clock seen in a mirror. What is the real time?"
  Single choice of four times, or numerical (hours and minutes as two
  inputs; treat as two numeric parts both required).
- **Answer.** (11:60 − h:mm), with 12:00 ↔ 12:00 and 6:00 ↔ 6:00, mapped
  into 1–12.
- **Mistakes.** `water-rule` (18:30 − t), `hands-swapped`, `plus-six`.

### `diagonal-mirror`

Pattern and a mirror line at 45°. Truth is `transposed` (or the
anti-diagonal version). Distractors: side mirror, quarter turn, half turn.

### `reflection-chain`

- **Scenario.** A pattern and two or three labelled lines (P, Q, R) among:
  vertical through the right edge, horizontal through the bottom edge, the
  two diagonals. "Reflect in P, then the result in Q (then R)."
- **Answer.** Compose the transforms as 2×2 matrices; the result is one of
  the eight symmetries of the square.
- **Distractors.** The result of only the first reflection; the reverse
  order when it differs; the half turn when it is not the answer.
- **Solution.** One step per reflection, each with the intermediate figure.

### `image-count`

- **Scenario.** Two mirrors meeting at θ from {30°, 45°, 60°, 72°, 90°,
  120°}. An object placed on the bisector or clearly off it.
- **Answer.** The rule in section 3.
- **Mistakes.** `m` (forgets to subtract), `m − 1` in the odd off-bisector
  case, `180 ÷ θ`.
- **Figure.** `mirror-angle`: two lines, the angle marked, a dot.

### `ray-exit` and `ray-bounces`

- **Scenario.** A 5×5 or 6×6 grid. Three to six cells hold a mirror as `/`
  or `\`. A ray enters from a labelled edge cell.
- **Ask.** Which labelled edge cell it leaves from (single choice of four
  exits), or how many times it bounces (numerical).
- **Answer.** Trace: direction (dx, dy); at `/` (drawn from bottom-left to
  top-right, y down) a ray moving east goes north, north goes east, west
  goes south, south goes west; at `\` east goes south, south goes east,
  west goes north, north goes west. Guard against loops (reject seeds whose
  ray revisits a cell with the same direction).
- **Distractors.** Exits reached by treating one mirror as the other type.

## 6. Engine

- Transforms as 2×2 integer matrices with composition; `applyMatrix(cells,
  matrix, size)`. Keep the named transforms as constants built from
  matrices.
- `randomPattern(rng, size, tones)` generalised to 7×7 and two tones.
- `MIRROR_SAFE = 'AHIMOTUVWXY'`, `WATER_SAFE = 'BCDEHIKOX'`.
- Word list for `symmetric-words`, original and neutral, including
  palindromes of mirror-safe letters (TOOT, OTTO, MUM, WOW, AHA, MAAM,
  TAT, AVA, HAH) and non-palindromes of mirror-safe letters (MATH, TOMATO,
  WAIT, YOUTH), water-safe words (BOX, HIDE, CHOKE, DECK, BIKE, COOK) and
  unsafe words (FLAG, ROAD, PAGE, JUNE).
- `mirrorTime(h, m)` and `imageCount(theta, onBisector)`.
- `traceRay(grid, entry)` → `{ exit, bounces, path }`.

## 7. Figures and tool

- `image` figure: `size`, two tones, a mirror line on any side or
  diagonal.
- New figures `clock` (hands at an angle, `mirrored` flag), `mirror-angle`,
  `ray-grid` (mirrors, entry arrow, labelled exits, optional traced path).
- Tool `mirror` gains: a mirror-line selector as four edge chips plus two
  diagonal chips; a "second mirror" toggle that shows the chain result; and
  for the two-mirrors lesson an angle slider showing the images as dots
  around a circle.

## 8. Hand-checked cases

- `mirrorTime(3, 0)` = 9:00; `(2, 20)` = 9:40; `(12, 0)` = 12:00;
  `(7, 35)` = 4:25.
- `imageCount(90, any)` = 3; `(60, any)` = 5; `(45, any)` = 7;
  `(72, on bisector)` = 4; `(72, off)` = 5; `(120, on)` = 2; `(120, off)` = 3.
- Reflect in a vertical line then a horizontal line = half turn. Reflect in
  a vertical line twice = the original.
- Ray entering a 3×3 grid from the west into the middle row with a `/` in
  the centre leaves from the north of the centre column, one bounce.
- TOOT is unchanged in a side mirror. MATH is not (order reverses). BOX is
  unchanged in water.

## 9. Archetype coverage

| Archetype | Kind and level | Verified on seeds | Notes |
|---|---|---|---|
| M1 | `mirror-image` L1–L3 | | |
| M2 | `water-image` L2, `mirror-image` L3 with a line below | | |
| M3 | `reflection-chain` L4 | | |
| M4 | `image-count` L4 | | |
| M5 | — | | Scene reflections need illustration; out of scope |
| M6 | `clock-mirror`, `symmetric-words` L3 | | |
| M7 | `ray-exit`, `ray-bounces` L4 | | |

## 10. Out of scope

Reflections of drawn real-world scenes. Curved mirrors (see Everyday
physics). Water images of clocks (no exact time results).
