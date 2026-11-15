# Perspective and viewpoint

Slug `perspective` · topic `visualisation` · exams uceed, ceed, nid, nift ·
engine `src/learn/perspective.js` · figures
`src/learn/perspective-figures.jsx` · tool `perspective-box` · tests
`tests/perspective.test.mjs`

Status: all four tiers **Built** (16 November 2026).

## 1. Model

Every drawing comes from a pinhole camera: world x right, y away, z up; the
camera has an eye position, a turn (yaw) and a tilt (pitch). Level edges
vanish on the horizon; tilting the camera makes uprights converge too. The
owner's perspective theory PDF is image-only; the rules taught are the
standard ones.

## 2. Kinds

| Kind | Levels | Mode | Model |
|---|---|---|---|
| `eye-level` | 2 | single | Box drawn with the eye above, below or level with it; where is the horizon? |
| `perspective-type` | 2 | single | Square-on (one point), turned (two), looking up at a tall box (three) |
| `vanishing-point` | 3 | single | Labelled points: the true one, one off the horizon, one between, and the other vanishing point |
| `eye-height` | 3 (horizon crosses people), 4 (horizon above their heads) | typed | Horizon cuts every same-height person at the viewer's eye height |
| `camera-view` | 3, 4 | single | Plan of three objects; which left-to-right picture a camera at one edge takes; wrong ones are other edges or mirrored |

## 3. Verification

`tests/perspective.test.mjs` re-reads every answer from the drawn lines:
which side of the horizon the box lies, which edge families stay parallel
on the page, where two drawn edges cross, where the horizon cuts each
person, and the left-to-right order from plain angles on the plan.

## 4. Not built

Drawing in perspective (a method skill), curvilinear perspective, and
reflections in perspective.
