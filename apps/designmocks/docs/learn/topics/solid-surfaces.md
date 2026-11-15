# Surfaces of solids

Slug `solid-surfaces` · topic `visualisation` · exams uceed, ceed ·
engine `src/learn/surfaces.js` (uses `voxel.js`) · tool `surface-explorer`

Status: all four tiers **Built** (16 November 2026). Figures
`src/learn/surface-figures.jsx`; tests `tests/surfaces.test.mjs`.

Changes from the plan below, so that every drawing fixes the solid:
`polycube-surfaces` and `notch-surfaces` use column stacks whose every
column top can be seen (`stackReadable`), with notches only on the sides in
view; tunnels are described in words as well as drawn; painted blocks are
split into prism pieces (a footprint piece times a layer) and shown both
assembled, each piece tinted, and one by one. A foundations lesson on faces,
edges and corners of prisms and pyramids (`edges-corners`, with Euler's
rule) was added for the completion plan.

Build after Views and rotation, whose `voxels` figure it reuses.

## 1. Outcome

The student can count the surfaces of any solid built from flat faces,
including solids with steps, notches and tunnels, and solids that are
joined, painted and separated, and type the number.

## 2. Exam evidence

| Id | Archetype | Form | Frequency |
|---|---|---|---|
| S1 | How many surfaces does this solid have | Numerical | Common |
| S2 | A cube or pyramid with cut-outs or tunnels through it: number of surfaces | Numerical | Regular |
| S3 | A flat shape is extruded: how many surfaces; how many shapes in a set give more than n | Numerical or single | Regular |
| S4 | Solids joined into a block, painted, then separated: surfaces without paint | Numerical | Occasional |
| S5 | A 3D form made by operations on a shape has n surfaces; apply the same operations to another shape | Numerical | Occasional |

## 3. Techniques taught

- **What counts as one surface.** A flat region you could cover with one
  sticker without crossing an edge. Two squares side by side in the same
  plane are one surface.
- **Six directions.** Count the surfaces facing up, down, front, back, left
  and right in turn. Nothing is missed and nothing is counted twice.
- **Extrusion rule.** A flat shape pushed into a solid has one surface per
  side of the shape, plus two ends. A hole in the shape adds one surface
  per side of the hole.
- **Tunnels.** A tunnel adds its inside walls. Where tunnels cross, each
  wall is broken into separate surfaces.
- **Joined and painted.** The unpainted surfaces are exactly the ones that
  were touching.

## 4. Ladder

### Foundations (L1–L2)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `what-is-a-surface` | What counts as a surface | slide: the sticker test, tool colouring each surface · slide: curved surfaces count as one | `basic-surfaces` L1 ×4 (cube 6, prism, pyramid, cylinder 3, cone 2) |
| `extrude` | Push a shape into a solid | slide: sides plus two, tool with a shape and an extrude slider · slide: holes | `extrusion-surfaces` L2 ×4 |
| `six-directions` | Count in six directions | slide: up, down, four sides, tool with a direction selector · slide: same plane, same surface | `polycube-surfaces` L2 ×4 (3–4 cubes, single choice) |

Quiz: `basic-surfaces` 2, `extrusion-surfaces` 3, `polycube-surfaces` L2 ×3.

### Exam standard (L3)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `stepped` | Stepped solids | hook (`polycube-surfaces` L3) · slide: steps split a direction into several surfaces · worked (direction by direction table) | `polycube-surfaces` L3 ×4 (numerical), practice |
| `shapes-set` | Sets of shapes | hook (`extrusion-set`) · slide: count sides fast: corners equal sides · worked | `extrusion-set` ×3 (numerical), `extrusion-surfaces` L3 ×1 (with a hole), practice |
| `notches` | Notches and slots | hook (`notch-surfaces`) · slide: a notch replaces part of two surfaces and adds its own walls · worked | `notch-surfaces` ×4, practice |

Quiz (8, pass 6): `polycube-surfaces` L3 ×3, `extrusion-set` 2,
`notch-surfaces` 3.

### Exam hard (L4)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `tunnels` | Tunnels | hook (`tunnel-surfaces`) · slide: one tunnel adds four walls and leaves the outside at six · slide: crossing tunnels break the walls · worked | `tunnel-surfaces` ×4, practice |
| `join-paint` | Join, paint, separate | hook (`unpainted-surfaces`) · slide: unpainted means touching · worked | `unpainted-surfaces` ×4, practice |
| `same-operations` | Same operations, new shape | hook (`operation-transfer`) · slide: find what the operation adds per side · worked | `operation-transfer` ×3, `tunnel-surfaces` ×1, practice |

Quiz (8, pass 5): `tunnel-surfaces` 3, `unpainted-surfaces` 3,
`operation-transfer` 2.

### Mastery (L5)

Review lesson, then 12 numerical questions, 24 minutes, `uceed` marking,
two of each L3–L4 kind.

## 5. Question kinds

| Kind | Levels | Mode |
|---|---|---|
| `basic-surfaces` | 1 | single |
| `extrusion-surfaces` | 2, 3 | single / numeric |
| `polycube-surfaces` | 2 (single), 3 (numeric) | single / numeric |
| `extrusion-set` | 3 | numeric |
| `notch-surfaces` | 3 | numeric |
| `tunnel-surfaces` | 4 | numeric |
| `unpainted-surfaces` | 4 | numeric |
| `operation-transfer` | 4 | numeric |

### `extrusion-surfaces` and `extrusion-set`

- **Scenario.** Rectilinear polygons on a 4×4 grid (L, T, U, plus, step,
  Z), built as unions of cells; at L3 one may have a rectangular hole.
- **Answer.** Sides of the outline (count its corners) + sides of each hole
  + 2.
- `extrusion-set`: six shapes shown; "How many of these have more than n
  surfaces when extruded?" with n chosen so the answer is 1–5.
- **Mistakes.** `forgot-ends` (sides only), `cells-not-sides`.

### `polycube-surfaces`

- **Scenario.** A supported polycube of 3–4 cubes (L2) or 6–10 cubes in a
  3×3×3 box (L3), drawn as `voxels`. The prompt adds: "Count every flat
  surface, including the ones you cannot see. The solid has no hollow
  space."
- **Answer.** `surfaceCount` (section 6).
- **Mistakes.** `visible-only`; `cube-faces` (unit faces, not merged).
- **Solution.** Six lines: "Facing up: n", and so on, then the total.
- Reject solids whose hidden side is ambiguous from the drawing: require
  that the solid equals the maximal supported solid consistent with its
  visible faces, or state the hidden shape in words.

### `notch-surfaces` (L3)

A box a×b×c (cells) with one or two rectangular notches cut from an edge or
a slot across a face. Model as voxels with the notch cells removed. Answer
by `surfaceCount`.

### `tunnel-surfaces` (L4)

A cube of 5×5×5 cells with one, two or three straight square tunnels
through the centres of opposite faces, or a cube with corner cubes removed.
Answer by `surfaceCount`. Mistakes: `walls-not-broken` (four walls per
tunnel regardless of crossings), `outside-only`.

### `unpainted-surfaces` (L4)

Two or three polycube pieces that fit together into a box. "The block is
painted on the outside and the pieces are separated. How many surfaces have
no paint?" Answer: for each piece, count the merged surfaces made only of
unit faces that touched another piece; a surface that is partly painted and
partly not counts as painted unless the unpainted part is in a different
plane (it cannot be, so treat mixed coplanar regions as two surfaces only
when separated by an edge; state in the prompt "count a surface as
unpainted only if none of it has paint"). The generator must assert that no
merged surface is mixed; otherwise redraw.

### `operation-transfer` (L4)

"Shape X is extruded and a square hole is punched through it, giving 11
surfaces. The same is done to shape Y. How many surfaces?" Operations:
extrude; extrude and punch one rectangular hole (+4); extrude and cut one
corner off (+1). Answer from the extrusion rule.

## 6. Engine

`src/learn/surfaces.js`.

- `surfaceCount(solid)`:
  1. For every cube and each of the six directions, if the neighbouring
     cell is empty, record a unit face keyed by (axis, sign, plane
     coordinate) with its two in-plane coordinates.
  2. Within each key, find connected components using 4-neighbour
     adjacency in the plane.
  3. The answer is the total number of components.
- `surfacesByDirection(solid)` → the six counts, for solutions.
- `outlineSides(cells)` → number of corners of a rectilinear cell union's
  boundary (count boundary vertices where the boundary turns), per loop.
- Basic solids table: cube 6, cuboid 6, triangular prism 5, n-gonal prism
  n + 2, n-gonal pyramid n + 1, cylinder 3, cone 2, sphere 1, hemisphere 2.

## 7. Figures and tool

- `voxels` figure with `tint: 'surfaces'`, giving each merged surface one of
  the six face fills so neighbours differ.
- Figure `outline`: a rectilinear shape on a grid, optional hole.
- Tool `surface-explorer`: a solid (from props) with a direction selector
  of six chips; the chosen direction's surfaces light up and the status
  line counts them; a running total of directions visited; turn icons.

## 8. Hand-checked cases

All computed with the algorithm above.

- One cube: 6.
- Three cubes in an L: 8.
- A 5×5×5 cube with one square tunnel through the centre: 10.
- A 5×5×5 cube with three tunnels through the centres of all three pairs
  of faces: 30.
- A 3×3×3 cube with its eight corner cubes removed: 30.
- L-shaped outline (6 sides) extruded: 8. With a rectangular hole: 12.
- A plus-shaped outline has 12 sides: 14 surfaces.

## 9. Archetype coverage

| Archetype | Kind and level | Verified on seeds | Notes |
|---|---|---|---|
| S1 | `polycube-surfaces` L2–L3 | 1–40 | Array flood fill |
| S2 | `notch-surfaces` L3, `tunnel-surfaces` L4 | 1–40 | Array flood fill; pyramids with cut-outs out of scope |
| S3 | `extrusion-surfaces`, `extrusion-set` | 1–40 | Sides by straight boundary runs |
| S4 | `unpainted-surfaces` L4 | 1–40 | All surfaces minus painted ones |
| S5 | `operation-transfer` L4 | 1–40 | Recomputed from runs |

## 10. Out of scope

Edges and vertices of irregular solids, sloped cuts, and curved cut-outs.
Add an "edges and corners" lesson with Euler's rule (V − E + F = 2) only
after the surface kinds are released and calibrated.
