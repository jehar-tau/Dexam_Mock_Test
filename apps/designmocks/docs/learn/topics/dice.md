# Dice

Slug `dice` · topic `visualisation` · exams uceed, ceed, nid, nift ·
engine `src/learn/dice.js` (builds on `cube-net.js`) · tool `die-roller`

Status: Foundations Planned · Exam standard Planned · Exam hard Planned ·
Mastery Planned

## 1. Outcome

From a die's net or from two or three pictures of the same die, the student
can find any opposite or hidden face, follow a die as it rolls, and total
the hidden faces of stacked or touching dice as a typed number.

## 2. Exam evidence

| Id | Archetype | Form | Frequency |
|---|---|---|---|
| D1 | Several positions of one die: which number is opposite a given one | Single or numerical | Common |
| D2 | The net of a die: opposite or adjacent faces | Single or numerical | Common |
| D3 | A die's net and a stack of identical dice: sum of the faces parallel to the ground, or of the hidden faces | Numerical | Regular |
| D4 | A die rolled along a path: the number on top at the end | Numerical or single | Regular |
| D5 | Which of these pictures can be the same die; standard and non-standard dice | Single or multiple select | Occasional |
| D6 | Dice with unusual faces (blank, repeated) thrown together: probability of a total | Numerical | Occasional |

## 3. Techniques taught

- **Standard die.** Opposite faces add to 7. A non-standard die is defined
  only by its net or its pictures.
- **Neighbours rule.** A face has four neighbours and one opposite. Collect
  the neighbours of a number across the pictures; the number never seen
  beside it is its opposite.
- **Common face rule.** Two pictures sharing one number in the same
  position: the remaining faces pair off as opposites.
- **Rolling.** Rolling toward a side sends the top to that side and brings
  the opposite side to the top. The two faces on the rolling axis stay.
- **Stacks.** In a vertical stack every die's top and bottom are an
  opposite pair. If two different side faces of a die are visible, its top
  and bottom are the pair not containing either.

## 4. Ladder

### Foundations (L1–L2)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `standard` | The standard die | slide: opposites add to 7, tool · slide: three faces meet at a corner | `die-opposite` L1 ×3 |
| `die-net` | A die as a net | slide: the line rule and zigzag rule from Cube nets, with pips · slide: non-standard dice | `die-net-opposite` L2 ×4 |
| `rolling` | Rolling a die | slide: one roll, tool with roll arrows · slide: the axis faces stay | `die-roll` L2 ×4 (one or two rolls) |

Quiz: `die-opposite` 2, `die-net-opposite` 3, `die-roll` L2 ×3.

### Exam standard (L3)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `positions` | Several positions, one die | hook (`die-positions`) · slide: neighbours rule · slide: common face rule · worked | `die-positions` ×4 (numerical), practice |
| `paths` | Rolling along a path | hook (`die-roll` L3) · slide: track top, front and right only · worked | `die-roll` L3 ×4 (3–4 rolls, standard die), practice |
| `same-die` | Can these be the same die? | hook (`same-die`) · slide: check pairs first, then the corner order · worked | `same-die` ×3 (multiple select), `standard-check` ×1, practice |

Quiz (8, pass 6): `die-positions` 3, `die-roll` L3 ×3, `same-die` 2.

### Exam hard (L4)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `stacks` | Stacked dice | hook (`die-stack-sum`) · slide: top and bottom are a pair · slide: read the pair from the side faces · worked | `die-stack-sum` ×4, practice |
| `long-rolls` | Long rolls with a strange die | hook (`die-roll` L4) · slide: read the die from its net first · worked | `die-roll` L4 ×4 (5–7 rolls, die given as a net), practice |
| `touching` | Dice in a row | hook (`die-row-hidden`) · slide: touching faces are hidden twice · worked | `die-row-hidden` ×3, `die-positions` L4 ×1, practice |

Quiz (8, pass 5): `die-stack-sum` 3, `die-roll` L4 ×3, `die-row-hidden` 2.

### Mastery (L5)

Review lesson, then 12 questions, 24 minutes, `uceed` marking:
`die-positions` ×3, `die-roll` L3 ×2 and L4 ×2, `same-die` ×1,
`die-stack-sum` ×2, `die-row-hidden` ×2.

## 5. Question kinds

| Kind | Levels | Mode | Notes |
|---|---|---|---|
| `die-opposite` | 1 | single | Standard die, "what is opposite 3?" |
| `die-net-opposite` | 2 | single | Non-standard numbering on one of the 11 nets |
| `die-roll` | 2, 3, 4 | single (L2), numeric (L3–L4) | See below |
| `die-positions` | 3, 4 | numeric | Two or three views |
| `same-die` | 3 | multi | Which pictures can be the reference die |
| `standard-check` | 3 | single | Which net is a standard die |
| `die-stack-sum` | 4 | numeric | Net + stack |
| `die-row-hidden` | 4 | numeric | Dice touching in a row |

### `die-positions`

- **Scenario.** A cube numbered 1–6 at random (non-standard). Choose a
  target number. Draw views (rotations) until the target has appeared with
  four distinct neighbours in total across at most three views (L3: target
  visible in two views with disjoint neighbour pairs; L4: one of the views
  does not show the target, and the opposite must be reached through a
  second number's neighbours).
- **Ask.** "Which number is opposite n?" Numerical.
- **Answer.** `oppositeIndex`. **Verification of solvability:** the set of
  numbers seen adjacent to the target has size four, or (L4) the deduction
  chain recorded in the solution uses only facts visible in the pictures.
- **Mistakes.** A neighbour of the target; 7 − n (assumes a standard die).
- **Solution.** List neighbours seen in each view; name the one left.

### `die-roll`

- **Scenario.** A die on a square grid with a path of unit moves (N, E, S,
  W). L2: standard die shown in a view, 1–2 rolls. L3: standard die, 3–4
  rolls with at least one turn. L4: die given only by its net (non-
  standard), start orientation given by a view, 5–7 rolls.
- **Ask.** The number on top at the end.
- **Answer.** Apply `roll` per move (section 6).
- **Figure.** `die-path`: the grid, the path as arrows, the die at the
  start.
- **Mistakes.** Result of rolling the reverse direction on the last move;
  the bottom face.
- **Solution.** A table: after each move, top / front / right.

### `same-die` (multiple select)

- **Scenario.** A reference view of a die with pips (orientation of pips
  ignored; faces treated as D4-symmetric). Four option views. One to three
  are views of the same die; wrong ones show an opposite pair together or
  the mirror order around the corner.
- **Verification.** `allViewSignatures` membership.

### `die-stack-sum`

- **Scenario.** A net with numbers 1–6 (non-standard) and a stack of 3 or 4
  identical dice. Each die is drawn showing its front-left and front-right
  faces; the top die also shows its top.
- **Ask.** One of: the sum of all faces parallel to the ground; the sum of
  the faces hidden between dice and on the table; the number on the table.
- **Answer.** For each die, the vertical pair is the opposite pair that
  contains neither visible side face. Sum as asked. For "hidden" sums,
  subtract the visible top.
- **Mistakes.** `standard-assumed` (7 per die), `sides-added`,
  `top-included`.
- **Solution.** Pairs from the net; each die's vertical pair; the total.

### `die-row-hidden`

- **Scenario.** A non-standard die given as a net. Two or three such dice
  stand in a row touching side to side, each drawn with its top and its
  front visible.
- **Ask.** "What is the sum of the left and right faces of all the dice?"
  (the faces that touch a neighbour plus the two outer end faces).
- **Answer.** Each die's left–right pair is the opposite pair containing
  neither its top nor its front. Add the pair sums.
- **Why not "touching faces only".** Which member of the pair faces left
  depends on the die's handedness, which the pictures do not fix. The
  generator must compute the asked sum for the die and for its mirror image
  and assert the two are equal.
- **Mistakes.** `standard-assumed` (7 per die), `tops-added`.

## 6. Engine

`src/learn/dice.js`, importing from `cube-net.js`.

- A die is a net with contents `{ glyph: 'pips-n' }` (n = 1–6), treated as
  fully symmetric for signatures. `standardDie()` returns the cross-shaped
  net with opposites summing to 7 and 1-2-3 anticlockwise around their
  common corner.
- `orientation` is a rotation matrix from `rotations`. `faceAt(die,
  orientation, normal)` → the number on the face whose rotated normal equals
  `normal`.
- `roll(orientation, direction)`. With +x east, +y north, +z up, a roll is
  a quarter turn that sends the top face to the side it rolls toward:
  - east: (x, y, z) → (z, y, −x)
  - west: (x, y, z) → (−z, y, x)
  - north: (x, y, z) → (x, z, −y)
  - south: (x, y, z) → (x, −z, y)

  Compose as `matrix(direction) × orientation` and match to `rotations`.
- `verticalPair(die, visibleSideNumbers)` → the opposite pair containing
  none of the visible numbers.

## 7. Figures and tool

- Glyphs `pips-1` … `pips-6` in `Glyph` (dots in the usual layouts), D4
  symmetry in `glyphSymmetry` (treat 2, 3 and 6 as symmetric for
  signatures; say so on a slide: "ignore which way the pips lean").
- Figure `die-stack`: dice drawn one above another in isometric view, each
  with its two side faces, the top one with its top.
- Figure `die-path`: grid with arrows and a small die.
- Tool `die-roller`: a die on a 5×5 grid, four roll arrows as an icon
  cluster, a net beside it with the current top, bottom and sides
  highlighted, a reset icon, and a "show hidden faces" toggle. Status line:
  "Top 3, front 2, right 1. Bottom 4."

## 8. Hand-checked cases

- "Front" means the south side and "right" the east side throughout.
  Standard die with top 1, front 2, right 3 (so bottom 6, back 5, left 4).
  Rolling east brings the left face up: top 4, front 2. Rolling north from
  the start brings the front face up: top 2, bottom 5. Rolling south from
  the start brings the back face up: top 5. Rolling west: top 3.
- Four rolls in the same direction return the die to its start.
- East then west returns the die to its start.
- Stack of three standard dice: sum of all top and bottom faces = 21.
- For a non-standard die with pairs (1,2), (3,4), (5,6) and visible sides 1
  and 3: the vertical pair is (5,6), sum 11.

## 9. Archetype coverage

| Archetype | Kind and level | Verified on seeds | Notes |
|---|---|---|---|
| D1 | `die-positions` L3–L4 | | |
| D2 | `die-net-opposite` L2 | | |
| D3 | `die-stack-sum` L4 | | |
| D4 | `die-roll` L2–L4 | | |
| D5 | `same-die`, `standard-check` L3 | | |
| D6 | — | | Belongs to the probability programme (E4) |

## 10. Out of scope

Probability with dice (D6). Dice where pip orientation matters. Left- and
right-handed dice as a named concept (handedness is handled silently by
asking only handedness-free sums).
