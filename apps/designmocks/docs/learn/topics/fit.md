# Fit and hidden figures

Slug `fit` · topic `visualisation` · exams uceed, ceed, nid, nift · engine
`src/learn/fit.js` · figures `src/learn/fit-figures.jsx` · tool
`piece-fitter` · tests `tests/fit.test.mjs`

Status: all four tiers **Built** (16 November 2026).

## 1. Outcome

The student can pick the piece that fills a gap, the pair of pieces that
makes a shape, the piece left over when three make a rectangle, and the
drawing that hides a given figure, and can count copies of a figure in a
drawing. Pieces may be turned but never flipped over.

## 2. Kinds

| Kind | Levels | Mode | Model |
|---|---|---|---|
| `fill-gap` | 2 (3×3 board), 3 (larger boards, always a mirror-image distractor) | single | Polyomino gap; wrong pieces are the mirror image or one square moved |
| `two-pieces` | 3 | single | A shape split into two; wrong pairs change one piece (mirror or one square) and are checked not to tile |
| `odd-piece` | 4 | single | A rectangle split into three plus a near-twin; exactly one set of three tiles it |
| `hidden-figure` | 3 (4 lines), 4 (5 lines, busier) | single | Figures built from unit lattice steps; wrong drawings hide only a turned or mirrored copy |
| `hidden-count` | 4 | typed | Copies counted over every whole-number shift |

Line figures are drawn with a fixed unit (`unit` on the `lines` figure), so
the figure and every option are to one scale.

## 3. Verification

`tests/fit.test.mjs` re-checks gap pieces by matrix rotation, tilings by
trying every placement of every piece, the odd piece by tiling each set of
three, and hidden figures by sampling points along every line and testing
containment after each shift.

## 4. Not built

Pieces that may be flipped, three-dimensional pieces, and embedded figures
with curves.
