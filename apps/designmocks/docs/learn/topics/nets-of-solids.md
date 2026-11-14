# Nets of solids

Slug `nets-of-solids` · topic `visualisation` · exams uceed, ceed ·
engine `src/learn/solid-net.js` · tool `unfolder`

Status: all four tiers **Built** on 13 November 2026 (first build; see
section 9 for what it does and does not yet cover).

This programme exists because of the owner's reference standard
([../08-owner-reference-standard.md](../08-owner-reference-standard.md),
section 8.3). It is the top of the folding ladder: Cube nets teaches the
rules on a cube; this programme applies them to solids with many faces of
different shapes, which is what the exam actually sets.

**This engine is the hardest piece of the whole Learn build.** It should be
built by the strongest model available, or reviewed by it step by step.

## 1. Outcome

Shown an unfamiliar solid with 8 to 22 faces (prisms, stepped blocks,
solids built from cubes, joined solids, solids with sloping and curved
faces) and four nets that differ by one face, the student can pick the net
that folds into it, or every net that does, in about two minutes.

## 2. Exam evidence

| Id | Archetype | Form | Frequency |
|---|---|---|---|
| S1 | A compound solid of many-sided prisms; four long nets of polygon caps on a strip of rectangles | Single | Anchor |
| S2 | A solid built from cubes (L, T, step); four near-identical nets of merged rectangles with fold lines | Single or multi | Anchor, common |
| S3 | An extruded profile with steps, a slope and a rounded end; nets with rounded tabs | Single | Anchor |
| S4 | Boxes or wedges joined at an angle; nets on a square grid with diagonal folds and triangles | Single | Anchor |
| S5 | A prism or wedge with given edge lengths: which nets are right | Multi | Common |
| S6 | A cuboid with stripes that must line up across folds | Single | Common |
| S7 | A truncated or bevelled block seen from front and back | Single | Occasional |
| S8 | A package blank with tabs and slots: which cannot fold into the package | Single | Occasional |
| S9 | A hollow box cut along planes: which unfolded pieces are right | Multi | Occasional |

## 3. Techniques taught

- **Count and sort.** How many faces, and how many of each shape. A net
  with the wrong count is out at once.
- **Find the belt.** An extruded solid has side faces that wrap round it.
  They unroll into one strip. The strip's segments are the sides of the
  profile, in order.
- **Caps.** The two end faces have the profile's shape. Each joins the
  belt along one side, and that side must be the matching segment.
- **Edge matching.** Two edges that meet when folded must be equal. Check
  the longest and the shortest first.
- **Which side.** A flap on the wrong side of the strip builds the mirror
  solid, or lands on a face already covered.
- **Sloping faces.** A slope's length is longer than its height. On a grid
  it shows as a diagonal or as a rectangle longer than its neighbours.
- **Curved faces.** A curved surface unrolls into a rectangle as long as
  the curve. A half-round end of radius r unrolls to about 3.14 × r.

## 4. Ladder

### Foundations (L1–L2)

| Lesson | Title | Checks |
|---|---|---|
| `count-sort` | Count and sort the faces | `face-inventory` L1 ×4 (how many rectangles, how many triangles) |
| `prisms` | Prisms: belt and two caps | `prism-net` L2 ×4 (triangular, pentagonal, hexagonal prisms) |
| `pyramids` | Pyramids and wedges | `pyramid-net` L2 ×4 |

### Exam standard (L3)

| Lesson | Title | Checks |
|---|---|---|
| `edges` | Edges that must match | `net-of-solid` L3 ×4 on cuboids and wedges with unequal sides (multi) |
| `cube-built` | Solids built from cubes | `net-of-solid` L3 ×4 on three- and four-cube solids |
| `stripes` | Patterns across folds | `patterned-cuboid` L3 ×4 |

### Exam hard (L4): the anchor level

| Lesson | Title | Checks |
|---|---|---|
| `stepped` | Stepped and sloped profiles | `net-of-solid` L4 ×4 on stepped profiles with one slope (12–16 faces) |
| `joined` | Joined solids and long strips | `net-of-solid` L4 ×4 on joined prisms and five-cube solids (14–22 faces) |
| `curved` | Rounded ends | `net-of-solid` L4 ×3 on profiles with one arc, `strip-order` ×2 (numerical: length of the curved strip) |
| `diagonals` | Nets on a grid with diagonal folds | `net-of-solid` L4 ×4 on joined wedges |

### Mastery (L5)

Twelve questions, 24 minutes, `uceed` marking, all at L4, one third
multiple select.

## 5. Question kinds

| Kind | Levels | Mode |
|---|---|---|
| `face-inventory` | 1 | single / numeric |
| `prism-net`, `pyramid-net` | 2 | single |
| `net-of-solid` | 3, 4 | single or multi (seed chooses; "which can" and "which cannot") |
| `patterned-cuboid` | 3 | single |
| `strip-order` | 4 | numeric |

### `net-of-solid`

- **Scenario.** Draw a solid from the level's families (section 6). Make
  one true net by unfolding it. Make three more options by the mutations
  below. For multi, two or three options are true nets (different
  unfoldings of the same solid) and the rest are mutated.
- **Mutations** (each must be verified to fail the fold test and must
  stay flat without overlap):
  1. `flap-moved`: detach one leaf face and re-attach it to a different
     net edge of the **same length**. The commonest exam trap.
  2. `flap-side`: reflect one asymmetric face across its fold line's
     perpendicular, so it sits correctly attached but mirrored.
  3. `stretched`: lengthen or shorten one strip segment by one unit.
  4. `mirrored`: mirror the whole net, used only when the solid is chiral.
  5. `segment-swap`: swap two neighbouring belt segments of different
     lengths.
- **Closeness rule for L4.** Every wrong option differs from a true net by
  exactly one mutation, and at least two wrong options use `flap-moved` or
  `segment-swap`.
- **Reasons.** Computed from the failed fold: "The pentagon joins the
  strip on a segment 2 long, but its matching side is 3 long", "This flap
  lands on the face already covered by the top", "This builds the mirror
  image".
- **Solution.** Count and sort, find the belt and read its segment
  lengths, place each cap, check one doubtful edge.

## 6. Engine

`src/learn/solid-net.js`. Exact arithmetic on a half-unit lattice; lengths
of slopes kept as squared integers so comparisons are exact.

### Solid

`{ vertices: [[x, y, z]], faces: [{ loop: [vertexIndex…], kind }] }` with
each loop planar and ordered anticlockwise seen from outside. `kind` is
`flat` or `curved`. Derived: `edges` (each shared by exactly two faces),
`faceGraph`.

Families, each a function from parameters to a solid:

| Family | Parameters | Faces | Level |
|---|---|---:|---|
| `prism(profile, depth)` | regular n-gon, n = 3–8 | n + 2 | 2 |
| `pyramid(n, height)`, `wedge(a, b, h)` | | n + 1, 5 | 2–3 |
| `cuboid(a, b, c)` | unequal sides | 6 | 3 |
| `polycube(cells)` | 3–5 cubes, coplanar faces merged into rectilinear polygons | 8–14 | 3–4 |
| `extrusion(profile, depth)` | rectilinear profile with steps; optionally one sloping side and one arc | 8–16 | 4 |
| `joined(a, b)` | two prisms sharing a face region; the shared region is removed and faces are re-merged | 14–22 | 4 |

Curved faces: an arc in a profile becomes one `curved` face. Its developed
shape is a rectangle of width equal to the arc length (store the arc length
exactly as a multiple of π × r and draw it to scale). End caps keep the
arc.

### Unfolding

`unfold(solid, rng)` → net:

1. Choose a spanning tree of the face graph (random, biased to keep the
   belt in one strip, as exam nets do).
2. Lay the root face flat using its own in-plane coordinates.
3. For each tree edge, place the child face in the plane by rotating it
   about the shared edge until it is coplanar with its parent, on the far
   side of the edge.
4. Reject and retry if any two faces overlap (polygon intersection test)
   or the bounding box is longer than 4:1.

Net: `{ faces: [{ id, polygon }], folds: [{ parent, child, edge }] }`.

### Does this net fold into this solid?

`foldsInto(net, solid)` → `{ ok, reason }`. A combinatorial test, no
floating-point folding:

1. For the net's root face, try every solid face of the same shape, in
   every orientation-preserving alignment (never a reflection).
2. Walk the net's fold tree. Crossing a fold edge must lead, on the solid,
   to the face across the corresponding edge; that face must not be used
   already; and its shape, read from the shared edge onward (sequence of
   edge lengths and angles), must equal the net face's.
3. Succeed when every net face is placed and every solid face is used once.
4. On failure, return the first clash as the reason.

Tests: every `unfold` of every family passes `foldsInto`; every mutation
fails it; the mirror net fails exactly when the solid is chiral; the 11
cube nets pass against a cube and the 24 other hexominoes fail.

### Drawing

- Solid: reuse `project` from `cube-net.js`, with a rotation chosen so at
  least 60% of the faces are visible. Draw faces with outward normals
  toward the viewer, sorted back to front by centroid depth; verify per
  family that the sort gives no artefacts (convex pieces are safe; for
  cube-built solids split merged faces into unit squares for sorting only).
  Three tones by face direction. Curved faces drawn as fine strips without
  inner outlines.
- Net: SVG polygons, solid outline for cuts, dashed lines for folds, on an
  optional square grid. `compact` size for options.

## 7. Figures and tool

- Figures `solid` and `solid-net`.
- Tool `unfolder`. The solid and its net share one stage. A **fold
  slider** runs from flat to closed: each face rotates about its hinge by
  the slider's fraction of its final angle, children carried with their
  parents, so the student watches the net close into the solid. Tapping a
  face highlights it in both states. Icon buttons turn the solid. A chip
  row switches solid family. This is the centrepiece interaction of the
  programme; give it the care the fold explorer got.

## 8. Hand-checked cases

- Triangular prism: 5 faces, 9 edges. Hexagonal prism: 8 faces, 18 edges.
- An L of three cubes (two in a row, one on top of an end) merges to 8
  faces: two L-shaped hexagons and six rectangles (1×1 ×4, 1×2 ×2).
- A staircase profile of two steps extruded: profile has 6 sides, so 8
  faces.
- A cube's 11 nets fold; a row of six squares does not.
- A square pyramid's net with all four triangles on one side of the base
  does not fold.

## 9. Archetype coverage

First build, compared by eye with the four anchors on 13 November 2026.
The owner has not yet judged it.

| Archetype | Kind and level | Compared with anchor | Notes |
|---|---|---|---|
| S1 | `net-of-solid` L4, profile `bow` (16 faces) | Close to UCEED 2015 Q76: a long strip of narrow rectangles with two many-sided end faces, options differing in where an end face attaches | The anchor has four end faces; ours has two. A true two-prism `joined` family is not built. |
| S2 | `net-of-solid` L3–L4, `polycube` (4 and 5 cubes, 10–16 faces) | Same reasoning as UCEED 2016 Q27 | The solid is drawn with its unit-cube lines showing; the anchor shows merged faces. |
| S3 | `net-of-solid` L4, profiles `roundEnd`, `roundStep` | Same idea as UCEED 2016 Q33: a stepped block with a rounded end whose curved side unrolls into a rectangle | Simpler profile than the anchor (8–10 faces against about 14). |
| S4 | `net-of-solid` L4, profiles `neck`, `ramp` | Partly matches UCEED 2023 Q49: sloping faces between box-like parts | Also `grid-net` L4: a box with sliced corners, drawn on a unit grid with diagonal folds. The exam solid is two pieces joined at an angle; ours is one box. |
| S5 | `prism-net` L2, `net-of-solid` L3 | Covered, including select-all | |
| S6 | `patterned-cuboid` L3 (`src/learn/solid-pattern.js`) | Built: two stripes round a box, one net, marks spoiled on one or two faces | Curves and split-colour faces are not built. |
| S7 | — | | Add a `bevelled` family after first release |
| S8 | — | | Tabs and slots need a thickness model; later |
| S9 | — | | Cut hollow boxes; later |

## 9a. What the first build left out

- Kinds `pyramid-net` (folded into `prism-net`), `patterned-cuboid` and
  `strip-order` (replaced by the simpler `belt-length`).
- Mutations `flap-side`, `mirrored` and `segment-swap`. Wrong options are
  made by `flap-moved` and by nets of a slightly different solid
  (`stretched`). Extrusions are never chiral, so a mirrored net is a true
  net; `mirrored` only matters for cube-built solids.
- The `joined` family. Compound shapes are single extruded profiles.
- A hinge-by-hinge folding animation. The unfolder adds faces to the solid
  one at a time as the slider moves and links each net face to its place on
  the solid. A true 3D folding motion is the obvious next improvement.
- Lessons `pyramids`, `stripes`, `joined`, `curved` and `diagonals` as
  separate lessons; the built tiers have seven lessons in all.
- Geometry uses floating point with a 0.0001 tolerance, not exact
  arithmetic. The fold test compares rounded lengths and angles.

## 10. Out of scope for the first build

Package blanks with glue tabs (S8), hollow boxes cut by planes (S9),
doubly curved surfaces, and solids with holes through a face.
