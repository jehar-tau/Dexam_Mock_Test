# Views and rotation

Slug `views-and-rotation` · topic `visualisation` · exams uceed, ceed, nid,
nift · engine `src/learn/voxel.js` · tool `solid-builder`

Status: Foundations Built · Exam standard Built · Exam hard Built ·
Mastery Built (15 November 2026). As built: engine `src/learn/voxel.js`;
views kinds use stacks (a supported solid is a height map), drawn with the
existing `stack`, `views` and new `view-grid` figures; rotation kinds use
asymmetric chiral polycubes drawn with `voxels`. Tools: `stack-builder`
(with views) and the new `solid-turner`. `third-picture` is folded into
`same-solid` L4 (select all), and `views-count` reuses Counting cubes'
`views-max`. Tests in `tests/voxel.test.mjs`.

This is the highest-weight spatial family in UCEED and CEED (about 160
bank questions match its keywords). Build it first in wave 2. Its `voxels`
figure and view functions are reused by Counting cubes and Surfaces of
solids.

## 1. Outcome

Given a solid, the student can draw its front, top and side views in their
head; given two views, say which third views are possible; given three
views, pick the solid; and recognise the same solid after it has been
turned, rejecting its mirror image.

## 2. Exam evidence

| Id | Archetype | Form | Frequency |
|---|---|---|---|
| V1 | A solid is shown: which is its top (or front, or side) view | Single choice | Common |
| V2 | Front and top views are given: which option(s) can be the side view | Multiple select | Common |
| V3 | Orthographic views are given: which solid do they describe | Single choice | Common |
| V4 | Which option is the same object seen from another direction (mental rotation) | Single or multiple select | Common |
| V5 | A solid seen from two directions: which option can be a third view of the same solid | Multiple select | Regular |
| V6 | A solid is turned about an axis by a stated angle: its new view | Single choice | Regular |
| V7 | Which perspective drawing matches the viewing direction shown by an arrow | Single choice | Regular |
| V8 | Building-block pieces: which assembly uses all the pieces | Multiple select | Occasional |

## 3. Techniques taught

- **Three views.** Front shows width and height, top shows width and
  depth, side shows depth and height. Each view flattens one direction.
- **Read the outline, then the steps.** A line inside a view means the
  surface changes depth there.
- **Carry the heights.** Heights are the same in front and side. Widths are
  the same in front and top. Depths are the same in top and side.
- **Can it exist?** A third view is possible if a solid can be built that
  matches all three: fill every cell that all three views allow, then check
  nothing is missing.
- **Same or mirror?** Pick an end of the solid and walk along it: straight,
  turn, turn. A mirror image turns the other way at one step.
- **Turn by quarter turns.** Track one marked cube through the turn.

## 4. Ladder

### Foundations (L1–L2)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `three-views` | Three ways to look | slide: front, top and side, tool with the three views live · slide: each view flattens one direction | `view-of-stack` L1 ×4 (which is the top view of this stack?) |
| `which-view` | Which view is this? | slide: read the outline · slide: heights and widths carry across | `view-name` L2 ×2, `view-of-solid` L2 ×3 |
| `turning` | Turning a solid | slide: a quarter turn, tool with turn icons · slide: follow one cube | `same-solid` L2 ×4 (clear distractors) |

Quiz: `view-of-stack` 2, `view-name` 1, `view-of-solid` 3, `same-solid` L2 ×2.

### Exam standard (L3)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `solid-from-views` | From views to the solid | hook (`solid-from-views`) · slide: start from the top view, raise each square · worked · slide: the trap is one cube that changes only one view | `solid-from-views` ×4, practice |
| `missing-view` | The missing view | hook (`missing-view`) · slide: carry heights and depths · slide: more than one answer can be possible · worked | `missing-view` ×4 (multiple select), practice |
| `mirror-twin` | The mirror twin | hook (`same-solid` L3) · slide: walk the solid · worked | `same-solid` L3 ×4 (one option is the mirror image), practice |

Quiz (8, pass 6): `solid-from-views` 3, `missing-view` 2, `same-solid` L3 ×3.

### Exam hard (L4)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `two-pictures` | Two pictures, one solid | hook (`third-picture`) · slide: what each picture proves, what it leaves open · worked | `third-picture` ×4 (multiple select), practice |
| `turn-then-view` | Turn, then look | hook (`view-after-turn`) · slide: a turn about a vertical axis swaps front and side · slide: a tip swaps top and front · worked | `view-after-turn` ×4, practice |
| `rotation-sets` | Find every match | hook (`same-solid` L4) · slide: check each option against one landmark | `same-solid` L4 ×3 (multiple select, 1–3 correct), `views-count` ×2 (numerical), practice |

Quiz (8, pass 5): `third-picture` 2, `view-after-turn` 3, `same-solid` L4 ×2,
`views-count` 1.

### Mastery (L5)

Review lesson, then 12 questions, 24 minutes, `uceed` marking:
`solid-from-views` ×2, `missing-view` ×2, `same-solid` L3 ×2 and L4 ×1,
`third-picture` ×2, `view-after-turn` ×2, `views-count` ×1.

## 5. Question kinds

| Kind | Levels | Mode |
|---|---|---|
| `view-of-stack` | 1 | single |
| `view-name` | 2 | single |
| `view-of-solid` | 2 | single |
| `same-solid` | 2, 3 (single), 4 (multi) | single / multi |
| `solid-from-views` | 3 | single |
| `missing-view` | 3 | multi |
| `third-picture` | 4 | multi |
| `view-after-turn` | 4 | single |
| `views-count` | 4 | numeric |

### Solids used

- **Stacks** (L1–L2): height maps on 3×3, as in Counting cubes.
- **Polycubes** (L2–L4): connected sets of 5–9 unit cubes inside a 3×3×3
  box, generated by growing from one cube. For rotation kinds require
  **chiral** solids (not equal to their mirror image under any rotation)
  and solids with **no rotational symmetry** (24 distinct orientations), so
  that every option is distinguishable.
- **Supported polycubes** (views kinds): every cube rests on the floor or
  on another cube, so the solid can be drawn as views without hidden
  overhang ambiguity.

### `view-of-solid` (L2) and `solid-from-views` (L3)

- **Scenario.** A supported polycube. Compute its three views (section 6).
- `view-of-solid`: show the solid; ask for its front, top or side view.
  Distractors: another of its views; the correct view mirrored; the view
  with one cell added or removed.
- `solid-from-views`: show the three views; options are four solids.
  Distractors are the true solid with one cube moved so that **exactly one**
  view changes, verified by recomputing views; and its mirror image when
  that changes a view.
- **Solution.** Top view first (footprint), then heights from the front,
  then confirm with the side.

### `missing-view` (L3, multiple select)

- **Scenario.** Front and top of a hidden supported polycube. Four
  candidate side views.
- **Answer.** A candidate S is correct when `consistent(front, top, S)` is
  true (section 6). Build candidates from: the true side view; side views
  of other solids sharing the same front and top (found by removing or
  adding cubes that do not change front or top); impossible views (a height
  that the front view does not allow, a depth the top view does not allow).
  Require 1–3 correct, varying by seed.
- **Reasons.** For an impossible view name the clash: "This shows height 3,
  but the front view is never taller than 2."

### `same-solid`

- **Scenario.** A chiral asymmetric polycube drawn in one orientation.
- L2: three distractors are different solids (one cube moved).
- L3: one distractor is the **mirror image** in some orientation; two have
  one cube moved.
- L4 (multiple select): four options, 1–3 are rotations of the solid, the
  rest mirror images or one-cube variants.
- **Verification.** `canonical(solid)` equality (section 6).
- Choose option orientations whose isometric drawing shows every cube's
  position unambiguously: reject an orientation if two different solids in
  the option set have the same drawing (compare the sets of visible faces).

### `third-picture` (L4, multiple select)

Two isometric pictures of one solid from different corners. Options are
pictures; correct ones are other views of the same solid. Wrong ones are
views of the mirror solid or of a one-cube variant consistent with one
picture but not both.

### `view-after-turn` (L4)

"The solid is turned a quarter turn clockwise (seen from above) about the
vertical axis. Which is its front view now?" Also tips forward and back.
Answer by rotating the voxels then computing the view. Distractors: the
view after the opposite turn; the unturned view; the mirrored view.

### `views-count` (L4, numerical)

From three views: the number of cubes in the largest solid that fits
(`maximalSolid`), or how many cubes cannot be seen from the front.

## 6. Engine

`src/learn/voxel.js`. A solid is an array of `[x, y, z]` integers.

Conventions, identical to the corrected `cube-net.js` and `cube-count.js`:
viewer at (+x, +y, +z); z up. **Front view** = seen from the +x side:
horizontal axis y increasing to the right, vertical z. **Right-side view** =
seen from the +y side: horizontal axis x increasing to the **left**, vertical
z. **Top view** = seen from above with the front at the bottom of the page:
x increasing downward, y increasing to the right.

- `normalise(solid)` → translated so minima are 0, sorted.
- `rotate(solid, matrix)` using the 24 `rotations` from `cube-net.js`.
- `mirror(solid)` → x negated, normalised.
- `canonical(solid)` → the smallest serialisation over the 24 rotations.
  `sameSolid(a, b)` compares canonicals. `isChiral(s)` =
  `!sameSolid(s, mirror(s))`. `symmetryCount(s)` = number of rotations that
  leave the normalised solid unchanged (want 1).
- `views(solid)` → `{ front, top, side }` as sets of 2D cells:
  front = {(y, z)}, top = {(x, y)}, side = {(x, z)}.
- `maximalSolid(front, top, side)` → every cube (x, y, z) with (y, z) in
  front, (x, y) in top and (x, z) in side.
- `consistent(front, top, side)` → true when the views of
  `maximalSolid(front, top, side)` equal the three given views. (Any solid
  with those views is a subset of the maximal one, so if the maximal solid
  fails, none exists.)
- `isSupported(solid)` → every cube has z = 0 or a cube directly below.
- `visibleFaces(solid)` → for drawing and for the ambiguity check: the
  faces with normal +x, +y or +z whose neighbour cell in that direction is
  empty and which are not occluded. Occlusion test for a face: step from
  the face centre toward the viewer along (1, 1, 1) in half-unit steps and
  stop if a cube contains the point.
- `randomPolycube(rng, { size, box, supported, chiral, asymmetric })` by
  growth with rejection, guard and fallback list.

Inner lines in views: draw a line between two adjacent cells of a view when
both are filled and their nearest-cube depth differs.

## 7. Figures and tool

- New figure `voxels`: isometric drawing of any solid; cubes sorted by
  x + y + z ascending and drawn back to front with top, front (+x) and side
  (+y) faces in three tones; optional `marked` cube. Replace the internals
  of `StackFigure` with it (a stack is a solid).
- New figure `views`: three grids arranged top above front, side to the
  right of front, with captions and optional inner lines. Shared with
  Counting cubes.
- Tool `solid-builder`: a 3×3 plan with a layer slider (1–3); tapping a
  cell toggles the cube in the current layer; the isometric drawing and the
  three views update live; an icon cluster turns the solid by quarter turns
  about the vertical axis and tips it. Status line names the cube count and
  whether the solid matches a target when the slide sets one
  (`props.target`).

## 8. Hand-checked cases

- An L-shaped solid `[[0,0,0],[1,0,0],[2,0,0],[0,0,1]]`: front = {(0,0),
  (0,1)} (one column two high), top = {(0,0),(1,0),(2,0)} (three in a line
  down the page), side = {(0,0),(1,0),(2,0),(0,1)}.
- `consistent` is true for the views of any solid. For front = one column
  of height 2, top = a single cell, side = a single cell of height 1:
  false (the heights disagree).
- A straight line of three cubes has `symmetryCount` 8 and is not chiral.
  The solid `[[0,0,0],[1,0,0],[2,0,0],[2,1,0],[2,1,1]]` is chiral.
- Rotating any solid 4 times about one axis returns it.
- `maximalSolid` of the views of a 2×2×2 block with one top cube removed is
  the full block only when no view shows the gap; here the top view still
  shows 4 cells and front and side still show 2×2, so the maximal solid is
  the full block of 8.

## 9. Archetype coverage

| Archetype | Kind and level | Verified on seeds | Notes |
|---|---|---|---|
| V1 | `view-of-stack`, `view-of-solid` | | |
| V2 | `missing-view` L3 | | |
| V3 | `solid-from-views` L3 | | |
| V4 | `same-solid` L2–L4 | | |
| V5 | `third-picture` L4 | | |
| V6 | `view-after-turn` L4 | | |
| V7 | — | | Perspective programme (C2) |
| V8 | — | | Fit and jigsaw programme (A12) |

## 10. Out of scope

Sloped and curved solids, hidden (dashed) lines, sectional views, and
perspective drawings. Cube-based solids cover the reasoning; sloped solids
can follow as a second engine once this programme is released.
