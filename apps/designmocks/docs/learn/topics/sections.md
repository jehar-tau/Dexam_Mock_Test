# Sections of solids

Slug `sections` · topic `visualisation` · exams uceed, ceed, nid · engine
`src/learn/sections.js` · figures `src/learn/section-figures.jsx` · tool
`section-slicer` · tests `tests/sections.test.mjs`

Status: all four tiers **Built** (16 November 2026).

## 1. Outcome

The student can name the face left by a flat cut through a common solid,
work out the plane section of a cube through three marked points, count the
pieces left by several cuts, count faces, edges and corners after corners
or edges are sliced off, and name the solid swept out by spinning a flat
shape about an axis.

## 2. Source

The plan's row: shape of a cut face, pieces after a cut, oblique cuts of a
cube. The owner's spatial bank (mostly images) also has a "solid
generation" subtopic, which no other programme covered, so solids of
revolution are taught here. Nothing is copied from the bank.

## 3. Kinds

| Kind | Levels | Mode | Model |
|---|---|---|---|
| `cut-face` | 1 (across, along), 2 (along, slanting) | single | Table of six solids and three cuts |
| `revolution` | 2 (rectangle, triangle, half and quarter circle), 3 (trapezium, offset rectangle, steps, house, bead) | single | Edge by edge: parallel → cylinder wall, slanting → cone, gap → hole |
| `cube-section` | 3 (equilateral triangle, square, rectangle, regular hexagon), 4 (isosceles triangle, rhombus, trapezium, pentagon) | single | Plane through three of the 20 corners and edge midpoints, met with the 12 edges, ordered round its centre and classified by sides and angles; the target shape is chosen from the seed so all four appear evenly |
| `cut-pieces` | 3 (grid cuts of a cube, layered and wedged cake), 4 (adds the most pieces from n free cuts) | typed | (a + 1)(b + 1)(c + 1); layers × 2 × centre cuts; (n³ + 5n + 6) ÷ 6 |
| `truncation` | 4 | typed | Each sliced corner or bevelled edge: +1 face, +3 edges, +2 corners |

## 4. Ladder

Foundations: `cut-faces`, `slants`, `spinning`. Exam standard:
`cube-cuts`, `pieces`, `compound` (harder spinning). Exam hard:
`odd-sections`, `sliced-off`, `most-pieces`. Mastery: review and a timed
set of twelve at UCEED marking.

## 5. Verification

`tests/sections.test.mjs` rebuilds each cube section face by face from the
six squares (the number of sides is the number of faces crossed, then side
lengths, right angles and parallel pairs confirm the name); counts pieces by
sampling points and grouping them by side of every cut; builds every sliced
cube as a real polytope from half-spaces and counts its faces, edges and
corners; checks the cake numbers against the pancake recurrence; and checks
that spun shapes touch the axis (or not, for a tube) as their solid needs.

## 6. Not built

Cuts of cones giving parabolas and hyperbolas, sections of pyramids and
prisms through marked points, and pieces of irregular solids.
