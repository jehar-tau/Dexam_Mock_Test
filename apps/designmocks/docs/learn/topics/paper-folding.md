# Paper folding and cutting

Slug `paper-folding` · topic `visualisation` · exams uceed, ceed, nid, nift ·
engine `src/learn/paper-fold.js` · tool `fold-punch`

Status: Foundations **Built** · Exam standard Planned · Exam hard Planned ·
Mastery Planned

## 1. Outcome

Shown a sheet folded two or three times and then punched or cut with shaped
notches, the student can pick or describe the unfolded sheet, count its
holes and pieces, and reason about which side and which way round a printed
or coloured panel ends up.

## 2. Exam evidence

| Id | Archetype | Form | Frequency |
|---|---|---|---|
| P1 | Sheet folded in a shown sequence, punched or cut, find the unfolded pattern | Single choice | Common |
| P2 | Cuts are shapes on the edges and corners of the folded packet (the coloured part is removed) | Single choice | Common |
| P3 | Three folds including a diagonal fold | Single choice | Regular |
| P4 | Number of holes, or of pieces, after unfolding | Numerical | Occasional |
| P5 | A two-coloured sheet (front and back differ) folded so both colours show; match folded view and creases | Single choice | Occasional |
| P6 | A word or figure printed on the folded packet; how it looks when unfolded and seen from the other side | Single choice | Occasional |
| P7 | An irregular (non-square) sheet folded and cut | Single choice | Occasional |
| P8 | Booklet imposition: page numbers and orientation after folding a printed sheet | Multiple select | Rare |

## 3. Techniques taught

- **Layers double.** n folds, 2ⁿ layers, each punch 2ⁿ holes.
- **Unfold in reverse.** Undo the last fold first; mirror everything across
  that fold line; repeat.
- **Edge or fold?** A notch on an outer edge stays a notch. A notch on a
  fold line becomes a whole shape straddling the crease. A notch on a
  corner where two folds meet becomes one shape at the centre.
- **Mirrors never turn.** An asymmetric notch flips; it never rotates.
- **Which layer is on top.** The part you fold over lands on top with its
  back showing.

## 4. Ladder

### Foundations (L1–L2) — built

| Lesson | Title | Checks |
|---|---|---|
| `layers` | Folds make layers | `fold-count` L1 ×3 |
| `unfold` | Unfolding in reverse | `unfold` L2 ×4 |

Quiz: `fold-count` 3, `unfold` 5.

### Exam standard (L3)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `notches` | Edge or fold? | hook (`unfold-cuts` L3) · slide: a notch on an outer edge, tool in cut mode · slide: a notch on a fold line opens into a whole shape · slide: the centre corner · worked | `unfold-cuts` L3 ×4, practice |
| `diagonal` | The diagonal fold | hook · slide: the diagonal swaps across and down, tool · slide: only a square can take it · worked | `unfold` L3 ×2 (three folds), `unfold-cuts` L3 ×2 with diagonal, practice |
| `counting-holes` | How many holes? | hook (`hole-count` L3) · slide: a punch on a fold line makes one hole from two layers · worked | `hole-count` L3 ×4, practice |

Quiz (8, pass 6): `unfold` L3 ×2, `unfold-cuts` L3 ×4, `hole-count` L3 ×2.

### Exam hard (L4)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `asymmetric` | Shapes that flip | hook (`unfold-cuts` L4) · slide: an asymmetric notch mirrors · worked · slide: the close distractor is the same pattern with one shape unflipped | `unfold-cuts` L4 ×4, practice |
| `two-colours` | Two-coloured sheets | hook (`two-colour-fold`) · slide: the folded flap shows the back · slide: flaps as mirrored shapes, tool in flap mode · worked | `two-colour-fold` ×4, practice |
| `other-side` | Seen from the other side | hook (`seen-from-behind`) · slide: which layer is on top · slide: turning the sheet over mirrors it left to right · worked | `seen-from-behind` ×3, `piece-count` ×2, practice |

Quiz (8, pass 5): `unfold-cuts` L4 ×3, `two-colour-fold` 2, `seen-from-behind`
2, `piece-count` 1.

### Mastery (L5)

Review lesson, then 12 questions, 20 minutes, `ceed` marking: `unfold` L3 ×2,
`unfold-cuts` L3 ×2, `unfold-cuts` L4 ×3, `hole-count` L3 ×2,
`two-colour-fold` ×1, `seen-from-behind` ×1, `piece-count` ×1.

## 5. Question kinds

| Kind | Levels | Mode | State |
|---|---|---|---|
| `fold-count` | 1 | single | exists |
| `unfold` | 2 (1–2 folds, 1 punch), 3 (3 folds, 1–2 punches) | single | exists at L2 |
| `unfold-cuts` | 3 (symmetric shapes), 4 (asymmetric shapes, close distractors) | single | new |
| `hole-count` | 3 | numeric | new |
| `piece-count` | 4 | numeric | new |
| `two-colour-fold` | 4 | single | new |
| `seen-from-behind` | 4 | single | new |

### `unfold` L3

Three folds, the last may be diagonal; one or two punches at cell centres.
Distractors as at L2 plus `wrong-order` (the folds undone in the wrong
order). Solution: one step per unfold with the hole count doubling.

### `unfold-cuts`

- **Scenario.** Sheet 8×8 units. Two or three half folds (left, up; a final
  diagonal allowed at both levels). One to three cuts placed on the edges
  and corners of the folded packet. A cut is a shape from the list in
  section 6. At L3 use shapes that are mirror-symmetric about the edge
  normal (semicircle, isosceles triangle, square). At L4 use at least one
  asymmetric shape (right triangle, quarter-circle, L-step).
- **Figure.** `fold-sequence` with the final packet showing cuts as
  coloured shapes ("the coloured parts are cut away").
- **Answer.** Unfold every cut through every layer map; clip to the sheet.
- **Distractors.** (a) `one-fold-forgotten`: apply only half the layers.
  (b) `rotated`: quarter turn of the truth. (c) `unflipped`: at L4, the
  truth with one mirrored copy replaced by an unmirrored copy. (d)
  `edge-as-fold`: a notch on an outer edge wrongly doubled into a full
  shape, or a fold-line notch left as a half. Choose three that differ from
  the truth and from each other by signature.
- **Verification.** Signature = sorted list of shape signatures; a shape
  signature is its type plus sorted vertices (or centre and radius).
- **Solution.** One step per unfold showing the sheet so far.

### `hole-count` L3

- **Scenario.** Two or three folds; two or three round punches, each at a
  cell centre, on a fold edge of the packet, or on an outer edge.
- **Answer.** Count distinct circles lying wholly inside the unfolded
  sheet, after merging circles with the same centre. Notches on the outer
  edge are not holes; say so in the prompt ("Count complete holes only").
- **Mistakes.** `layers-times-punches` (ignores merging and edges),
  `plus-notches`.

### `piece-count` L4

- **Scenario.** Two or three folds (left and up only). One straight cut
  across the whole packet parallel to an edge, at a quarter, half or
  three-quarter position (never on an outer edge).
- **Answer.** Map the cut line through every layer. Count distinct lines
  after merging coincident ones. Pieces = distinct lines + 1 when all lines
  are parallel (they are, for left and up folds with an axis-parallel cut).
- **Mistakes.** `layers-plus-one`, `lines-not-merged`.

### `two-colour-fold` L4

- **Scenario.** Sheet 8×8, front colour `fill-c2`, back colour `fill-c1`.
  One or two **flap folds**, not half folds: a strip of width 1–3 along one
  side folded over, or a corner triangle with legs 2–4 folded in. Flaps do
  not overlap each other.
- **Ask.** Either "which is the top view after folding?" given the crease
  diagram, or "which crease diagram gives this top view?" (seed chooses).
- **Answer.** Each flap removes its region from the outline and adds its
  mirror image across the fold line in the back colour.
- **Distractors.** `wrong-colour` (flap in front colour), `not-removed`
  (outline unchanged), `wrong-size` (flap width ±1), `wrong-corner`.

### `seen-from-behind` L4

- **Scenario.** Sheet folded once or twice (left, up). A short asymmetric
  mark (one of the letters F, G, J, L, P, R, or a small arrow) is printed on
  the top face of the packet.
- **Ask.** "The sheet is unfolded and turned over left to right. Which
  option shows it?"
- **Answer.** The top layer's map (section 6) gives the panel and
  orientation of the mark on the side it was printed on. If the top layer
  shows the sheet's back, the mark is on the back; turning over mirrors x.
  The prompt always fixes which side is viewed.
- **Distractors.** `wrong-panel`, `not-mirrored`, `rotated`.

## 6. Engine

Conventions (already in `paper-fold.js`): grid units, origin top-left, y
down. A layer is a map from packet coordinates to sheet coordinates.

Changes:

- **Layer order.** Keep `layers` ordered bottom to top, each
  `{ map, flipped }`. A fold keeps the stationary layers in order and puts
  the moved layers on top **in reverse order** with `flipped` toggled and
  the reflection composed into `map`. The last layer is the visible top.
- **Grid size.** Parameterise `GRID` per question (6 at L1–L2, 8 from L3).
- **Cuts.** `cut = { type, at, size, turn }` in packet coordinates with
  types `circle`, `semicircle`, `triangle` (isosceles), `right-triangle`,
  `square`, `quarter` (quarter-circle), `step` (L-shape). Represent each as
  a polygon (circles as centre and radius). `unfoldCuts(state, cuts)` maps
  every cut through every layer map (apply the map to each vertex or the
  centre), then merges shapes that share an edge on a fold line (a
  semicircle and its mirror become a circle; two triangles become a
  rhombus). Merging rule: two shapes of the same type whose union is their
  reflection pair across a line are kept as two polygons for drawing but
  one **shape group** for counting and signatures.
- **Flap folds.** `flap(sheetPolygons, line, side)` for
  `two-colour-fold`: reflect the region beyond the line across it, mark it
  back-coloured. Keep to the non-overlapping case.
- `topLayer(state)` → the last layer.

## 7. Figures and tool

- `fold-sequence` gains cuts drawn on the final packet in `fill-c1`.
- New figure `sheet`: the unfolded sheet with holes and notches cut out
  (SVG path with `fill-rule="evenodd"`, clipped to the sheet outline),
  optional crease lines, optional two-colour regions, optional printed
  mark.
- Tool `fold-punch` gains a **cut mode** (pick a shape chip, tap an edge
  position on the packet), a **step slider** that unfolds one fold at a
  time while showing the pattern grow, and a **flap mode** for two-colour
  sheets. Keep the three fold pills; everything else is chips and the
  slider.

## 8. Hand-checked cases

- 6×6 sheet, fold left: punch at packet cell (0,0) → holes at sheet cells
  (0,0) and (5,0).
- Fold left then up: punch at packet cell (1,0) → holes at (1,0), (4,0),
  (1,5), (4,5).
- Fold left, up, diagonal: 8 layers; one interior punch → 8 holes.
- Fold left: a semicircle on the packet's right edge (the fold line) →
  one full circle on the sheet's vertical centre line. The same semicircle
  on the packet's left edge → two half-disc notches, one on each side edge
  of the sheet; `hole-count` 0.
- Fold left then up; cut parallel to the top edge halfway down the packet
  → cut lines at one quarter and three quarters of the sheet height → 3
  pieces. Cut at the packet's bottom edge is excluded (it is the fold).
- Fold left: top layer is the right half, flipped. An "F" printed on the
  packet lies on the back of the sheet's right half.

## 9. Archetype coverage

| Archetype | Kind and level | Verified on seeds | Notes |
|---|---|---|---|
| P1 | `unfold` L2–L3 | | |
| P2 | `unfold-cuts` L3–L4 | | |
| P3 | `unfold` L3, `unfold-cuts` with diagonal | | |
| P4 | `hole-count` L3, `piece-count` L4 | | |
| P5 | `two-colour-fold` L4 | | |
| P6 | `seen-from-behind` L4 | | |
| P7 | — | | Out of scope for now |
| P8 | — | | Out of scope for now |

## 10. Out of scope

Irregular sheets (P7) and booklet imposition (P8): rare, and each needs its
own model. Overlapping flap folds. Curved folds. Revisit after release data
shows whether students ask for them.
