# Visual observation

Slug `observation-skills` · topic `observation` · exams uceed, ceed, nid,
nift · engine `src/learn/observation.js` · figures
`src/learn/observation-figures.jsx` · tool `feature-scanner` · tests
`tests/observation.test.mjs`

Status: all four tiers **Built** (16 November 2026).

## 1. Source

The owner's visual observation bank groups its questions as: odd one out
and pattern break; figure-ground and clutter counting (the most common);
fragment and assembly matching (taught in Fit and hidden figures); and
object, symbol and letterform observation. Read for form and level only.

## 2. Kinds

| Kind | Levels | Mode | Model |
|---|---|---|---|
| `odd-icon` | 2 (3 × 3, obvious change), 3 (4 × 4, a hand turned one step or one dot more) | single | Dial icons: hand direction, dots, fill; answer by row and column |
| `letter-symmetry` | 2 | multi | Capitals that survive a side mirror, a reflection in water, or a half turn |
| `pattern-break` | 3 | single | A repeat of 2–4 tiles with one tile wrong, read row by row |
| `clutter-count` | 3 (14–19 shapes), 4 (20–25 shapes, or only triangles pointing straight up) | typed | Overlapping outline triangles, squares at any angle, circles and stars |
| `spot-difference` | 3 (4 × 4, 2–4 changes), 4 (5 × 5, 3–6 subtle changes) | typed | Two icon grids |

## 3. Verification

`tests/observation.test.mjs` finds the odd icon by a majority vote over
the drawn grid, the pattern break by trying every repeat length, re-reads
clutter counts and differences from the drawn figures, and checks letter
symmetry by reflecting stroke models of the letters.

## 4. Not built

Photographic scenes, figure-ground illusions and memory tests (observe,
then answer after the picture is hidden).
