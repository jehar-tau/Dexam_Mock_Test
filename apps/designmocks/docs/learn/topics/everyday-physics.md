# Everyday physics

Slug `everyday-physics` · engine `src/learn/physics.js` · tests
`tests/physics.test.mjs` · sources: the owner's mechanical reasoning theory
(object function, control mapping, twisted loops, rolling) and standard
school physics for floating, mirrors, lenses and sound.

Status: all four tiers **Built** (16 November 2026).

| Kind | Levels | Mode | Model |
|---|---|---|---|
| `floating` | 2 (float or sink), 3 (percentage under the surface) | single / typed | Density compared with the liquid's |
| `mirror` | 2 (distance to the image), 3 (shortest full-length mirror) | typed | Image as far behind as the object is in front; half-height rule |
| `lens` | 2 (kind of image), 3 (image distance), 4 (magnification) | single / typed | 1/f = 1/u + 1/v |
| `sound` | 2, 3 | typed | 340 m/s; echoes halve |
| `twist` | 3 | typed | Odd half-twists: one side and one edge |
| `roll-angle` | 3 | typed | Angle = distance ÷ radius, π = 22/7 |
| `phy-chain` | 3 | single | Authored mechanism chains (pump, pen, brake, latch) |
| `phy-mapping` | 2 | single | Authored control-mapping items |

Verification re-derives every answer by a second route: densities
compared, reflection geometry, ray tracing with similar triangles, an edge
walk round the twisted strip, and arc length.
