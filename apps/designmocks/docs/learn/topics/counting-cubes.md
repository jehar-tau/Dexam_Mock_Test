# Counting cubes

Slug `counting-cubes` · topic `visualisation` · exams uceed, ceed, nid, nift ·
engine `src/learn/cube-count.js` · tool `stack-builder`

Status: Foundations **Built** · Exam standard **Built** · Exam hard
**Built** · Mastery **Built** (13 November 2026). This is the reference
programme.

## 1. Outcome

Given any drawing or set of views of a solid made of unit cubes, the student
can state how many cubes it has, how many are hidden, how many carry paint
on 0, 1, 2 or 3 faces, and the fewest and most cubes that fit three given
views, as a typed number, in about two minutes.

## 2. Exam evidence

| Id | Archetype | Form | Frequency |
|---|---|---|---|
| E1 | Count the cubes in a drawn stack where some are hidden behind others | Numerical | Common |
| E2 | A block of n×n×n is painted and cut into unit cubes: how many have exactly k painted faces | Numerical or single choice | Common |
| E3 | Three views of a stack are given: the minimum (or maximum) number of cubes needed | Numerical or single choice | Regular |
| E4 | A stack described as symmetric with no cavities: count its cubes | Numerical | Occasional |
| E5 | A 4×4×4 block with some visible cubes removed: how many remain | Numerical | Occasional |
| E6 | Cubes that touch, or do not touch, a given cube or feature | Numerical | Occasional |
| E7 | A stack is painted then separated: how many faces are unpainted | Numerical | Occasional |

## 3. Techniques taught

- **Columns.** A stack on a floor is a list of column heights. Add them.
- **Layers.** For a big stack, count each horizontal layer from the top
  down; every layer is at least as large as the one above.
- **Three sides to cover.** A cube is hidden when the cube above, the cube
  front-left and the cube front-right are present.
- **Corners, edges, faces, inside.** In a painted a×b×c block: 8 corners
  have three painted faces; edge cubes have two; face cubes one; the inner
  (a−2)(b−2)(c−2) have none.
- **Most cubes from views.** Each floor square can rise to the smaller of
  its column's front height and its row's side height.
- **Fewest cubes from views.** Every floor square needs one cube. Each
  column still needs one tower as tall as the front view says, each row one
  as tall as the side view says; a column and a row of the same height can
  share one tower where they cross.

## 4. Ladder

### Foundations (L1–L2) — built

| Lesson | Title | Checks |
|---|---|---|
| `columns` | Count by columns | `count-cubes` L1 ×4 |
| `hidden` | Hidden cubes | `count-hidden` L2 ×3 |
| `box` | Filling the block | `count-box` L2 ×3 |

Quiz: `count-cubes` 4, `count-hidden` 2, `count-box` 2.

### Exam standard (L3)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `layers` | Bigger stacks, layer by layer | hook (`count-cubes` L3) · slide: layers, tool with layer slider · worked · slide: the commonest slip is counting only what you see | `count-cubes` L3 ×3 numerical, practice |
| `painted-block` | Painted blocks | hook (`painted-count` L3) · slide: corners · slide: edges · slide: faces and inside, tool in paint mode · worked | `painted-count` L3 ×4, practice |
| `hidden-touching` | Hidden and touching | hook (`touch-count` L3) · slide: hidden means three sides covered · slide: counting face contacts · worked | `count-hidden` L3 ×2, `touch-count` L3 ×2, practice |

Quiz (8, pass 6): `count-cubes` L3 ×2, `painted-count` L3 ×3, `count-hidden`
L3 ×1, `touch-count` L3 ×2.

### Exam hard (L4)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `views-most` | Three views: the most cubes | hook (`views-max`) · slide: what each view fixes, tool with views on · slide: the smaller of the two heights · worked | `views-max` ×3, practice |
| `views-fewest` | Three views: the fewest cubes | hook (`views-min`) · slide: one cube per floor square · slide: towers can be shared · worked ×2 (one with sharing, one without) | `views-min` ×4, practice |
| `painted-stack` | Painted stacks and missing cubes | hook (`painted-stack`) · slide: exposed faces · worked · slide: removed cubes leave new faces | `painted-stack` ×2, `removed-visible` ×2, practice |

Quiz (8, pass 5): `views-max` 2, `views-min` 3, `painted-stack` 2,
`removed-visible` 1.

### Mastery (L5)

Review lesson, then a 12-question set, 24 minutes, `uceed` marking:
`count-cubes` L3 ×2, `count-hidden` L3 ×1, `painted-count` L3 ×2, `touch-count`
L3 ×1, `views-max` ×2, `views-min` ×2, `painted-stack` ×1,
`removed-visible` ×1.

## 5. Question kinds

| Kind | Levels | Mode | State |
|---|---|---|---|
| `count-cubes` | 1 (3×3, heights ≤ 3, single choice), 3 (4×4, heights ≤ 4, numerical) | single / numeric | exists at L1 |
| `count-hidden` | 2 (3×3, single), 3 (4×4, numerical) | single / numeric | exists at L2 |
| `count-box` | 2 | single | exists |
| `painted-count` | 3 | numeric | new |
| `touch-count` | 3 | numeric | new |
| `views-max` | 4 | numeric | new |
| `views-min` | 4 | numeric | new |
| `painted-stack` | 4 | numeric | new |
| `removed-visible` | 4 | numeric | new, needs the `voxels` figure from views-and-rotation |

### `count-cubes` L3

- **Scenario.** 4×4 floor. Heights 0–4, drawn so that the back corner
  column is the tallest and heights never increase toward the viewer by more
  than the drawing can show: generate heights, then reject a stack unless
  every column has at least one visible face (so the count is determined by
  the drawing plus "no gaps"). Total between 14 and 40.
- **Answer.** Sum of heights. Numerical, unit "cubes".
- **Mistakes.** `visible`: the number of cubes with at least one visible
  face ("That counts only the cubes you can see. Cubes underneath and behind
  still count."). `top-faces`: number of non-empty columns.
- **Solution.** One step per layer from the top: "Layer 4 has n cubes…",
  then the sum.
- **Hint.** "Count one layer at a time, from the top."

### `count-hidden` L3

As L2 on a 4×4 floor, numerical. Mistake `no-top`: cubes with only the top
covered. Solution lists the columns that hide cubes.

### `painted-count` L3

- **Scenario.** Block a×b×c with each side 2–5, not all equal in at least
  half the seeds. Painted on all six faces, cut into unit cubes. Ask for the
  number with exactly k painted faces, k drawn from 0–3 (never a k whose
  answer is 8 for every block more than a quarter of the time).
- **Answer.** Count by brute force over all unit cubes: painted faces of a
  cube = number of its six sides on the block boundary.
- **Mistakes.** `edges-with-corners` (k = 2 counted including corners),
  `one-face-only` (k = 1 counted on one pair of faces), `inner-off-by-one`
  ((a−1)(b−1)(c−1) for k = 0).
- **Figure.** The block as a `stack` figure with uniform height.
- **Solution.** Corners, then edges per direction, faces per pair, inside.

### `touch-count` L3

- **Scenario.** 3×3 or 4×4 stack, heights ≤ 3. One cube is marked (a
  coloured top or side face; choose a cube with a visible face).
- **Ask.** "How many cubes share a face with the marked cube?"
- **Answer.** Number of the six neighbours present.
- **Mistakes.** `edge-touch` (counts diagonal neighbours too),
  `visible-only`.

### `views-max` and `views-min` L4

- **Scenario.** Generate a hidden 3×3 or 4×4 stack with heights 0–4 and at
  least six non-empty squares. Compute its three views (section 6). Show
  only the views, as a `views` figure labelled Top, Front, Side.
- **Answer.** `minMaxFromViews` (section 6). Reject seeds where min equals
  max.
- **Mistakes.** For max: `sum-front` (sum of the front heights times
  nothing else), `footprint` (floor squares only). For min: `max`
  (answers the maximum), `footprint`, `no-sharing` (floor squares + Σ(front
  height − 1) + Σ(side height − 1)).
- **Solution.** Max: one step per row of the floor showing the allowed
  height of each square. Min: floor squares; then each height value in
  turn, naming which column and row share a tower.

### `painted-stack` L4

- **Scenario.** 3×3 stack, heights 0–3, total 8–16. "The stack is painted
  on every face you could touch, including underneath" or "…while standing
  on the table, so the bottom is not painted" (seed chooses; the prompt says
  which). Then the cubes are separated.
- **Ask.** Either the number of unpainted faces in total, or the number of
  cubes with exactly k painted faces.
- **Answer.** `exposure` (section 6): painted faces of a cube = 6 − number
  of face neighbours − (1 if on the floor and the bottom is not painted).
  Unpainted faces = 6 × cubes − painted faces.
- **Mistakes.** `forgot-bottom` (the other floor reading), `contacts-once`
  (each touching pair counted once, not twice).

### `removed-visible` L4

- **Scenario.** A full 4×4×4 (or 3×3×3) block. Remove 3–7 cubes, each of
  which is visible from the corner view at the moment it is removed, and
  such that no removal exposes a gap that hides another removal. Draw the
  result as a `voxels` figure. The prompt states that no hidden cube was
  removed.
- **Ask.** How many cubes remain (or were removed).
- **Mistakes.** `faces-not-cubes` (counts missing faces).

## 6. Engine

Conventions (already in `cube-count.js` and `cube-net.js`):
`heights[x][y]`; the viewer is at (+x, +y, +z). In the isometric drawing +x
runs to the lower left and +y to the lower right, so the +x face of the
stack is the **front** (the left visible side) and the +y face is the
**right side**. The plan grid has x running down the page and y running
right, which is the same stack seen from above with the front at the bottom.
Getting any of these the other way round draws a mirror image; the engine
test `the cube is drawn as it really folds` guards the projection.

Add:

- `viewsOf(heights)` → `{ top, front, side }`.
  - `top[x][y] = heights[x][y] > 0`, drawn like the plan grid.
  - `front[y] = max over x of heights[x][y]`: the stack seen from the +x
    side. Columns are indexed by y and drawn with **y increasing to the
    right**.
  - `side[x] = max over y of heights[x][y]`: the stack seen from the +y
    side (the right-side view). Columns are indexed by x and drawn with
    **x increasing to the left**, so the front of the stack is at the left
    of this view.
  In `minMaxFromViews` below, read "column" as an index of `front` and
  "row" as an index of `side`; the formula is symmetric in the two.
- `minMaxFromViews(top, front, side)` → `{ min, max }`.
  1. `max` = Σ over floor squares (x, y) of `min(front[y], side[x])`.
  2. `min` starts at the number of floor squares.
  3. For each height h from 2 upward: let C = the y with `front[y] = h`,
     R = the x with `side[x] = h`. Let M = the size of a maximum matching
     between C and R using only floor squares (x, y). Add
     `(h − 1) × (|C| + |R| − M)`.
  Matching: the standard augmenting-path algorithm; the sets have at most
  four members.
- `exposure(cubes, { floorPainted })` → for each cube its count of exposed
  faces, where `cubes` is a list of `{x, y, z}`.
- `paintedCounts(a, b, c)` → `{ 0: n0, 1: n1, 2: n2, 3: n3 }` by brute
  force.
- `visibleCubes(heights)` → cubes with at least one of top, front-left,
  front-right uncovered (the complement of the hidden test).

The test file must check `minMaxFromViews` against exhaustive search on 40
random 3×3 stacks with heights 0–3 (enumerate all 4⁹ height maps and keep
those whose three views match).

## 7. Figures and tool

- New figure `views`: three small grids side by side with captions. Top is
  a filled-cell plan; Front and Side are column silhouettes (a bar chart of
  cells). Fields `{ top, front, side }`.
- `stack` figure gains `marked: {x, y, z}` (one cube tinted) and
  `paint: true` (exposed faces tinted with `fill-c1`).
- Tool `stack-builder` gains props: `size` (3 or 4), `showViews` (live
  views beside the stack), `paint` (paint mode with counts of cubes by
  painted faces in the status line), and a **layer slider** that hides
  layers above the chosen height so the student can look inside.

## 8. Hand-checked cases

- Heights `[[3,3,2],[3,3,2],[2,2,1]]`: total 21, hidden 8, box gap 6.
- Heights `[[2,1,0],[1,3,1],[0,1,2]]`: views top = 7 floor squares, front
  `[2,3,2]`, side `[2,3,2]`; min 11, max 15.
- Heights `[[3,0],[1,2]]`: front `[3,2]`, side `[3,2]`; the right-side view
  is drawn with the height-2 column (x = 1) on the left and the height-3
  column (x = 0) on the right.
- `paintedCounts(3,3,3)` = `{0:1, 1:6, 2:12, 3:8}`.
- `paintedCounts(4,3,2)` = `{0:0, 1:4, 2:12, 3:8}`.
- `paintedCounts(5,5,5)` = `{0:27, 1:54, 2:36, 3:8}`.
- A single cube, bottom not painted: 5 painted faces, 1 unpainted.
- Two cubes side by side, bottom painted: unpainted faces 2.

## 9. Archetype coverage

Built 13 November 2026. "Seeds" means the answer is recomputed
independently in `tests/learn-topics.test.mjs` for those seeds.

| Archetype | Kind and level | Verified on seeds | Notes |
|---|---|---|---|
| E1 | `count-cubes` L3 | 1–60 | 4×4 floor, 24–39 cubes, every height readable from the drawing |
| E2 | `painted-count` L3 | 1–60 | Blocks 2–5 on a side, any of 0–3 painted faces |
| E3 | `views-max`, `views-min` L4 | 1–60, plus the formula against exhaustive search on 25 stacks | 3×3 and 4×4 floors |
| E4 | — | | Covered by the E1 routine; no separate kind |
| E5 | `removed-visible` L4 | 1–60 | 3×3×3 block, 4–8 cubes removed |
| E6 | `touch-count` L3 | 1–60 | Sphere variants out of scope |
| E7 | `painted-stack` L4 | 1–60 | Both floor readings |

Still to do by a reviewer or the owner (playbook, section 2.6 steps 4–5):
solve five questions of each Exam hard kind by hand without the engine and
confirm none takes under 30 seconds. `removed-visible` and `touch-count`
are the two most likely to be judged too easy; if so, raise
`removed-visible` to a 4×4×4 block and ask `touch-count` for cubes touching
exactly two others.

## 10. Out of scope

Stacks of spheres, solids with cavities, and cubes of mixed sizes. Minimum
cubes when only two views are given (not unique enough to teach cleanly).
