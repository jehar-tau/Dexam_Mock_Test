# Visual series and matrices

Slug `visual-patterns` · topic `logical-reasoning` · exams uceed, ceed, nid,
nift · engine `src/learn/patterns.js` · shapes `src/learn/pattern-shapes.js` ·
figures `src/learn/pattern-figures.jsx` · tool `rule-mixer`

Status: all four tiers Built (15 November 2026).

## 1. Source

The visual series, matrix and analogy sections of the owner's logical
reasoning bank, described in our own words.

## 2. Model

A panel is a list of items (shape, fill, position, turn, size, mirror).
Rules change a part of the panel each step: turn, move round the edge, add
one, change colour. Series combine one to three rules on different parts.
Grids use a Latin square of shapes along rows, one fill per column and, at
level 4, a count along the row. Analogies apply one or two of: quarter turn,
flip, colour swap, size swap. Odd one out: three turned copies and one with a
changed colour (level 2) or the mirror image (level 4).

## 3. Kinds

| Kind | Levels | Mode |
|---|---|---|
| `series-next` | 1–4 (one to three rules) | single |
| `matrix-cell` | 3, 4 | single |
| `analogy` | 3 | single |
| `odd-one-out` | 2, 4 | single |

## 4. Verification

Options are compared by their drawn outlines (`looks`), so two options that
would look the same can never both appear. `tests/patterns.test.mjs` checks
that slanted shapes are never their own mirror image, that every grid answer
fits its row and column and every wrong one breaks a rule, that every pair of
changes turning the first analogy figure into the second gives the answer,
and that in odd one out the other three are turned copies of each other.
Positions and angles are cleaned of float error before outlines are compared.
