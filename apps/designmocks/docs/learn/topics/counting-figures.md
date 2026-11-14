# Counting figures

Slug `counting-figures` · topic `observation` · exams uceed, ceed, nid, nift ·
engine `src/learn/figure-count.js` · tool `figure-counter`

Status: Foundations Planned · Exam standard Planned · Exam hard Planned ·
Mastery Planned

## 1. Outcome

Shown a figure made of straight lines, the student can count every
triangle, square or rectangle in it without missing overlapping ones, and
type the number.

## 2. Exam evidence

| Id | Archetype | Form | Frequency |
|---|---|---|---|
| F1 | How many triangles in the figure | Numerical or single | Common |
| F2 | How many squares or rectangles in a grid-like figure | Numerical or single | Common |
| F3 | A figure is copied and reflected or joined to itself: count in the result | Numerical | Occasional |
| F4 | A figure with pieces missing (a bitten grid): how many shapes are gone or remain | Numerical or single | Occasional |
| F5 | Which figure contains exactly n of a shape | Single or multiple select | Occasional |

## 3. Techniques taught

- **Count by size.** Smallest shapes first, then shapes made of two pieces,
  three, and so on. Write a tally per size.
- **Grid rules.** In a grid of m by n cells there are
  m(m+1)/2 × n(n+1)/2 rectangles. In an n by n grid there are
  1² + 2² + … + n² squares.
- **Fan rule.** A triangle with k lines from one corner to the opposite
  side holds (k+1)(k+2)/2 triangles.
- **Label and list.** For irregular figures, letter the regions and list
  combinations that close into the shape.
- **Missing line, missing shapes.** Removing a line removes every shape
  that used it; count those and subtract.

## 4. Ladder

### Foundations (L1–L2)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `by-size` | Count by size | slide: small ones first, tool with a size slider that lights up each size class · slide: big ones hide in plain sight | `count-squares` L1 ×4 (2×2 and 3×3 grids) |
| `rectangles` | Rectangles in a grid | slide: choose two vertical lines and two horizontal lines · slide: the rule | `count-rectangles` L2 ×4 |
| `fans` | Triangles in a fan | slide: every pair of lines from the corner makes a triangle, tool · slide: the rule | `count-triangles` L2 ×4 (fans and a square with diagonals) |

Quiz: `count-squares` 2, `count-rectangles` 3, `count-triangles` L2 ×3.

### Exam standard (L3)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `layered-triangles` | Fans with cross lines | hook (`count-triangles` L3) · slide: each cross line makes a new, smaller fan · worked | `count-triangles` L3 ×4 (numerical), practice |
| `stars-and-crosses` | Crossing diagonals | hook · slide: label regions, list combinations · worked on a square with diagonals and midlines | `count-triangles` L3 ×3 (square families), `count-squares` L3 ×1 (grid with diagonals), practice |
| `missing-lines` | When a line is missing | hook (`count-missing`) · slide: which shapes used that line · worked | `count-missing` ×4, practice |

Quiz (8, pass 6): `count-triangles` L3 ×4, `count-squares` L3 ×1,
`count-rectangles` L3 ×1, `count-missing` 2.

### Exam hard (L4)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `reflected` | Copy, reflect, join | hook (`count-joined`) · slide: count one half, then the shapes that cross the joint · worked | `count-joined` ×4, practice |
| `composite` | Composite figures | hook (`count-triangles` L4) · slide: split the figure into families · worked | `count-triangles` L4 ×3, `count-rectangles` L4 ×1 (overlapping grids), practice |
| `exactly-n` | Exactly n | hook (`figure-with-n`) · slide: estimate, then count the closest two · worked | `figure-with-n` ×3 (multiple select), `count-missing` L4 ×1, practice |

Quiz (8, pass 5): `count-joined` 2, `count-triangles` L4 ×3,
`count-rectangles` L4 ×1, `figure-with-n` 2.

### Mastery (L5)

Review lesson, then 12 questions, 20 minutes, `uceed` marking, numerical
except two `figure-with-n`.

## 5. Question kinds

| Kind | Levels | Mode |
|---|---|---|
| `count-squares` | 1 (single), 3 (numeric) | single / numeric |
| `count-rectangles` | 2 (single), 3–4 (numeric) | single / numeric |
| `count-triangles` | 2 (single), 3–4 (numeric) | single / numeric |
| `count-missing` | 3–4 | numeric |
| `count-joined` | 4 | numeric |
| `figure-with-n` | 4 | multi |

Every kind draws a figure from a **family** (section 6), computes the count
with the general counter, and where the family has a formula the test
compares the two.

- **Single-choice distractors** (L1–L2): the count of smallest shapes only;
  the true count ± the number of largest shapes; a neighbouring value.
  Always four distinct non-negative values.
- **Numerical mistakes**: `smallest-only`, `missed-largest`,
  `double-counted` (a value the generator can compute for the family).
- **Solution**: a tally by size class from `countBySize`.
- **Answer range.** Keep answers between 5 and 60. Reject seeds outside.

### `count-missing`

A family figure with one or two interior segments removed (drawn as a gap).
Ask how many of the shape remain, or how many were lost. Answer by the
counter on the reduced figure.

### `count-joined`

A figure F and its mirror image joined along one full side (or F and a
copy translated to share a side). Ask for the count in the joined figure.
Answer by the counter on the union of segments, after merging collinear
overlapping segments.

### `figure-with-n` (multiple select)

Four figures from one family with different parameters. "Which contain
exactly n triangles?" One to three correct.

## 6. Engine

`src/learn/figure-count.js`. A figure is a list of segments
`[[x1, y1], [x2, y2]]` with integer coordinates (use a fine lattice, for
example multiples of 1/12 scaled to integers, so intersections of the
families used are lattice points or exact rationals; compute with integer
cross-multiplication or a small fraction helper, never floating point).

- `mergeCollinear(segments)` → maximal segments (merge overlapping or
  touching collinear ones).
- `points(segments)` → all endpoints and pairwise intersection points.
- `connected(segments)` → set of point pairs (a, b) that lie on one merged
  segment (so the straight line from a to b is fully drawn).
- `countTriangles(segments)` → number of point triples that are not
  collinear and pairwise connected.
- `countRectangles(segments, { squaresOnly })` → number of point quadruples
  forming a rectangle (any orientation: opposite sides equal and one right
  angle) with all four sides connected.
- `countBySize(segments, shape)` → map from area class to count, for
  solutions.

Families (each a function from parameters to segments):

- `grid(m, n)`; `gridWithDiagonals(n)` (each cell's two diagonals or one).
- `fan(k)`: triangle with k cevians from the apex.
- `fanWithBars(k, b)`: fan plus b lines parallel to the base.
- `squareStar(level)`: square with diagonals (level 1), plus midlines
  (level 2), plus the inner midpoint square (level 3).
- `triangleGrid(n)`: equilateral triangle divided into n rows of small
  triangles (use a sheared integer lattice).
- `composite`: two family figures sharing a side.

## 7. Figures and tool

- Figure `lines`: the segments drawn at 2 px with round caps on a
  `.question-figure` card; optional highlighted polygon; optional vertex
  labels.
- Tool `figure-counter`: the figure, a **size slider** that steps through
  size classes highlighting each shape of that class one at a time (auto-
  advance with next and previous icons), a running tally, and for grids two
  draggable-by-tap line pairs to show "choose two verticals and two
  horizontals".

## 8. Hand-checked cases

Verified with the method above.

- Square with both diagonals: 8 triangles.
- Square with both diagonals and both midlines: 16 triangles.
- Triangle with 2 cevians from the apex: 6 triangles (fan rule: 3 × 4 ÷ 2).
- `grid(2, 2)`: 9 rectangles, 5 squares. `grid(3, 3)`: 36 rectangles, 14
  squares. `grid(4, 3)`: 60 rectangles.
- `triangleGrid(2)`: 5 triangles. `triangleGrid(3)`: 13 triangles.
- `fan(3)`: 10 triangles.

## 9. Archetype coverage

| Archetype | Kind and level | Verified on seeds | Notes |
|---|---|---|---|
| F1 | `count-triangles` L2–L4 | | |
| F2 | `count-squares`, `count-rectangles` | | |
| F3 | `count-joined` L4 | | |
| F4 | `count-missing` L3–L4 | | |
| F5 | `figure-with-n` L4 | | |

## 10. Out of scope

Curved figures (circles, arcs), counting lines or regions, and
three-dimensional counts (see Counting cubes and Surfaces of solids).
