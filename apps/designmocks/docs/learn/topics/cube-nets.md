# Cube nets

Slug `cube-nets` · topic `visualisation` · exams uceed, ceed, nid, nift ·
engine `src/learn/cube-net.js` · tool `fold-explorer`

Status: Foundations **Built** (five lessons; reorganise into tiers with F2) ·
Exam standard Planned · Exam hard Planned · Mastery Planned

## 1. Outcome

Given a net with directional symbols, or two or three views of a cube, the
student can decide which cube or net matches, select every net that folds
to the same cube, and work with open boxes and nets of other simple solids,
without the folding tool.

## 2. Exam evidence

| Id | Archetype | Form | Frequency |
|---|---|---|---|
| N1 | A net with symbols: which cube can (or cannot) be made | Single choice | Common |
| N2 | A cube: which net folds into it | Single choice | Common |
| N3 | Two views of one cube: which is its unwrapped net | Single choice | Regular |
| N4 | Which of these options fold into the solid shown (cube or other solid) | Single or multiple select | Regular |
| N5 | Opposite or adjacent face questions from a net | Single or numerical | Regular (see also Dice) |
| N6 | A hollow box cut along planes: which unfolded pieces are correct | Multiple select | Occasional |
| N7 | A line or pattern running across faces of the net: which cube shows it correctly | Single choice | Occasional |

## 3. Techniques taught

- **Three tests** (built): opposites, order around the corner, turn.
- **Anchor and walk.** Pick one face as the anchor, walk to a neighbour
  across the shared edge, and track which edge of each symbol meets it.
- **Rebuild from views.** From two or three views list the opposite pairs,
  then the clockwise order at one corner; that fixes the whole cube.
- **Same cube test.** Two nets fold to the same cube when they have the
  same three opposite pairs, the same clockwise order at one corner, and
  the same symbol turns relative to a neighbour.
- **Open boxes.** Five squares: the base is the square whose opposite is
  missing.

## 4. Ladder

### Foundations (L1–L2) — built

Keep the five built lessons as the Foundations tier in this order: `fold`,
`opposite`, `which-cube`, `which-net`, `build`. Quiz: the built challenge.

### Exam standard (L3)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `turns` | Symbols that turn | hook (`which-cube` L3) · slide: anchor and walk, tool with symbols and a "follow this edge" highlight · worked · slide: the mirror-image trap | `which-cube` L3 ×3, `cannot-cube` L3 ×1, practice |
| `from-views` | From views to the net | hook (`net-from-views`) · slide: list the pairs from the views · slide: fix one corner · worked | `net-from-views` ×4, practice |
| `open-box` | Open boxes | hook (`open-box`) · slide: five squares, one face missing, tool with five-square shapes · slide: finding the base · worked | `open-box` ×4, practice |

Quiz (8, pass 6): `which-cube` L3 ×2, `cannot-cube` L3 ×1, `which-net` L3 ×1,
`net-from-views` ×2, `open-box` ×2.

### Exam hard (L4)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `same-cube` | Different nets, same cube | hook (`same-cube`) · slide: the same-cube test · worked · slide: one to three options can be right | `same-cube` ×4 (multiple select), practice |
| `partial-views` | When the views do not show everything | hook (`net-from-views` L4) · slide: a face you never see is fixed by its opposite · worked | `net-from-views` L4 ×3, `which-net` L4 ×1, practice |
| `lines-across` | Lines across faces | hook (`path-cube`) · slide: a line leaves a face through an edge and enters the neighbour through the same edge · worked | `path-cube` ×4, practice |

Quiz (8, pass 5): `same-cube` 3, `net-from-views` L4 ×2, `path-cube` 2,
`cannot-cube` L3 ×1.

### Mastery (L5)

Review lesson, then 12 questions, 22 minutes, `uceed` marking: `which-cube`
L3 ×2, `cannot-cube` L3 ×1, `which-net` L3 ×1, `net-from-views` L3 ×2 and L4
×1, `open-box` ×1, `same-cube` ×2, `path-cube` ×2.

## 5. Question kinds

| Kind | Levels | Mode | State |
|---|---|---|---|
| `is-net`, `opposite` | 1 | single | exist |
| `which-cube`, `cannot-cube`, `which-net` | 2 (as built), 3 (below) | single | exist at L2 |
| `build-net` | 2 | interactive | exists |
| `net-from-views` | 3, 4 | single | new |
| `open-box` | 3 | single | new |
| `same-cube` | 4 | multi | new |
| `path-cube` | 4 | single | new |

### `which-cube`, `cannot-cube`, `which-net` at L3

Differences from L2:

- All six faces carry **asymmetric** content (`asymmetricGlyphs`), so the
  turn test is needed on every option.
- Distractors are close: exactly one of `mirrored`, `turned` (one face a
  quarter turn), `swapped` (two visible faces exchanged with turns
  corrected so only the order is wrong). No `opposite-together` distractor
  at L3 for `which-cube`; use at most one.
- For `which-net`, options use **different net shapes and orientations**,
  not the same shape with contents swapped. Requires cell turns (section
  6).

### `net-from-views`

- **Scenario.** A cube with six distinct contents (L3: asymmetric symbols
  on three faces, plain colours on three; L4: asymmetric on all). Show two
  corner views that together show all six faces (L3: `identity` and
  `oppositeView`), or at L4 three views that show five faces between them,
  the sixth never seen (its content is given in the prompt as "the sixth
  face is blank").
- **Options.** Four nets on different shapes. One folds to the cube.
- **Distractors.** A net of the mirror cube; a net with one opposite pair
  wrong; a net with one face turned.
- **Verification.** `cubesEquivalent` between the option's fold and the
  cube; exactly one true.
- **Solution.** Pairs from the views; the corner order; the turn of one
  symbol relative to its neighbour.

### `open-box`

- **Scenario.** A five-square shape, lettered. Of the 12 pentomino shapes,
  8 fold to an open box. Ask one of: "Can this fold into an open box?"
  (L3, yes/no with the overlap reason), "Which square is the base?"
  (single choice among the five), "Which square is opposite the open top?"
- **Answer.** `foldCells` with five cells (section 6). The base is the cell
  whose normal is the negative of the missing normal.

### `same-cube` (multiple select)

- **Scenario.** A reference net (asymmetric contents). Four option nets on
  other shapes. One to three fold to the same cube; the count varies by
  seed.
- **Wrong options.** Mirror cube; one pair swapped; one face turned a
  quarter.
- **Verification.** `cubesEquivalent` for each option. Reject the seed
  unless the wrong options are all non-equivalent and the right ones all
  equivalent.

### `path-cube`

- **Scenario.** A net where three or four faces each carry a line segment
  from one edge midpoint to another (straight across or a corner turn), so
  that after folding the segments form a continuous path across faces.
  Content glyphs: `bar` (straight), new `bend` (corner).
- **Ask.** Which cube shows the path correctly.
- **Distractors.** One face's segment turned so the path breaks; the
  mirror image.

## 6. Engine

- **Cell turns.** Add `turn` (0–3 quarter turns anticlockwise) to cell
  content. In `foldNet` the frame's `r` and `u` are rotated by the cell's
  turn before use in `cubeView`. All existing nets have turn 0, so nothing
  changes for them. `NetDiagram` rotates the glyph by the turn.
- `unfoldCube(cube, shape, root, rootTurn)` → a net on `shape` (one of the
  11, in any of 8 orientations) whose fold is equivalent to `cube`: fold
  the blank shape to get each cell's frame; for each cell find the cube
  face with that normal; set the cell's content and choose the turn that
  makes the frames agree. Test: `cubesEquivalent(original, fold(unfoldCube(…)))`
  for every shape and orientation.
- `mirrorCube(net)` → the net with x negated and each content mirrored;
  used for mirror distractors. Assert it is **not** equivalent to the
  original whenever any content is asymmetric.
- `foldCells(cells)` → like `foldNet` without the six-cell requirement,
  returning frames or the overlap. Use it for open boxes.
- Glyph `bend` with trivial symmetry group, and its drawing in `Glyph`.

## 7. Figures and tool

- `net` figure shows cell turns.
- Tool `fold-explorer` gains prop `follow` (highlight the shared edge
  between a chosen cell and its neighbours on both the net and the cube),
  and accepts five-square shapes (`shape: 'pentomino-n'`) for open boxes,
  drawing the missing face as an open top.

## 8. Hand-checked cases

- The 11 nets and 24 rotations already tested.
- Exactly 8 of the 12 five-square shapes fold into an open box: F, L, N,
  T, W, X, Y and Z. The I (five in a row), P (contains a 2×2 block), U and
  V shapes overlap. Verified with the engine's fold rule; the test asserts
  both lists.
- `unfoldCube` round-trips on all 11 shapes × 8 orientations for a cube
  with six asymmetric contents.
- A cube and `mirrorCube` of it are not equivalent; with six `dot`
  contents they are.

## 9. Archetype coverage

| Archetype | Kind and level | Verified on seeds | Notes |
|---|---|---|---|
| N1 | `which-cube`, `cannot-cube` L2–L3 | | |
| N2 | `which-net` L2–L3 | | |
| N3 | `net-from-views` L3–L4 | | |
| N4 | `same-cube` L4 for cubes | | Other solids out of scope |
| N5 | `opposite` L1; see Dice | | |
| N6 | `open-box` L3 partly | | Cut-box pieces out of scope |
| N7 | `path-cube` L4 | | |

## 10. Out of scope

Nets of prisms, pyramids, cuboids, cube-built solids and compound solids.
These are **not** optional: the owner's reference standard shows they are
the real exam level. They live in their own programme,
[nets-of-solids.md](nets-of-solids.md), which is the top of the folding
ladder. This programme teaches the rules on a cube and hands over to it.
