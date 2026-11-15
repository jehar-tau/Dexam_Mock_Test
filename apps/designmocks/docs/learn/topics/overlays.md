# Transparent sheets

Slug `overlays` · topic `visualisation` · exams uceed, ceed, nid · engine
`src/learn/overlay.js` · figures `src/learn/overlay-figures.jsx` · tool
`sheet-stacker` · tests `tests/overlay.test.mjs`

Status: all four tiers **Built** (16 November 2026).

## 1. Outcome

The student can predict what shows when transparent sheets are stacked,
including after one is turned a quarter or flipped, what shows when one
sheet is folded onto itself, and how many squares are shaded a given number
of times.

## 2. Model

A sheet is an n × n grid; each square holds marks: dot, ring, or a line
that keeps its direction (level, upright, rising, falling). Moves act on
squares and on line directions together: a quarter turn makes level into
upright and swaps the two slants; a flip swaps the slants; a diagonal fold
swaps level and upright and keeps both slants.

## 3. Kinds

| Kind | Levels | Mode | Notes |
|---|---|---|---|
| `sheet-stack` | 2 (two 3 × 3 sheets as drawn), 3 (three 4 × 4 sheets, the last turned or flipped) | single | Wrong options: sheet left unmoved or moved the wrong way, a sheet's marks missing, one mark moved |
| `sheet-fold` | 3 (upright or level fold), 4 (adds the diagonal fold and all marks) | single | Wrong options: lines not mirrored, half slid instead of folded, wrong half kept |
| `sheet-count` | 3 (as drawn), 4 (sheet 2 moved first) | typed | Squares shaded on none, exactly one, exactly two, or all three |

## 4. Verification

`tests/overlay.test.mjs` turns every mark into points in the plane, applies
each move as a real rotation or reflection about the sheet's centre or the
fold line, reads the points back into squares and line directions, and
compares; overlap counts are re-tallied square by square.

## 5. Not built

Sheets with free-drawn line figures (counting triangles after stacking) and
three-way folds.
