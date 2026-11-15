# Shadows and light

Slug `shadows-and-light` · topic `visualisation` · exams uceed, ceed, nid ·
engine `src/learn/shadows.js` · tool `sun-table`

Status: all four tiers **Built** (16 November 2026). Figures
`src/learn/shadow-figures.jsx`; tests `tests/shadows.test.mjs`.

Changes from the plan below: `compass-shadows` is single choice (one right
drawing, three wrong ones: a shadow that turned with the walker, shadows
towards the sun, shadows across the light). The sun-table tool has no lamp
mode; lamps are taught with the side-view figure. All drawn shadows use a
45° sun so reach equals height.

## 1. Outcome

Given a light direction and simple objects, the student can pick the
correct shadow in top view, find a shadow's length or an object's height
as a number, tell sunlight from a nearby lamp by the shadows, and reason
about shadows through the day.

## 2. Exam evidence

| Id | Archetype | Form | Frequency |
|---|---|---|---|
| L1 | Solids on a surface under parallel light: which top view shows the shadows correctly | Single choice | Common |
| L2 | A flat shape held parallel to a table in sunlight: the shape of its shadow | Single choice | Regular |
| L3 | A solid on another solid, light at 45°: the correct shadow | Single choice | Regular |
| L4 | Heights and shadow lengths in proportion | Numerical or single | Regular |
| L5 | People or objects, a compass direction and the sun's position: the correct shadows from above | Multiple select | Occasional |
| L6 | Shadow puppets and screens: a new arrangement, the new picture | Single choice | Occasional |
| L7 | Silhouettes: which solids can cast this outline | Multiple select | Occasional |

## 3. Techniques taught

- **Away from the light.** A shadow points directly away from the light's
  direction. Sun in the east, shadows to the west.
- **Low sun, long shadow.** Length = height ÷ tan(sun's height angle). At
  45° the shadow is as long as the object is tall.
- **Parallel light keeps shape.** A flat shape parallel to the ground
  casts a shadow of the same shape and size, just moved.
- **Push the top.** The shadow of a solid is its base joined to the shadow
  of its top. A pointed top gives a pointed shadow.
- **Same sun, same ratio.** At one moment height ÷ shadow length is the
  same for everything.
- **Near lamp, spreading shadows.** A lamp gives shadows that fan out and
  grow as the object nears the lamp. The sun's shadows are parallel.

## 4. Ladder

### Foundations (L1–L2)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `direction` | Which way does it fall? | slide: away from the light, tool with a sun-direction dial · slide: compass words | `shadow-direction` L1 ×4 |
| `length` | How long? | slide: low sun, long shadow, tool with a sun-height slider · slide: 45° means equal | `shadow-length-compare` L2 ×4 (which is longer, which sun is higher) |
| `flat-shapes` | Flat shapes in sunlight | slide: same shape, moved · slide: tilted shapes squash | `flat-shadow` L2 ×4 |

Quiz: `shadow-direction` 3, `shadow-length-compare` 2, `flat-shadow` 3.

### Exam standard (L3)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `solids` | Shadows of solids | hook (`solid-shadow`) · slide: base plus shifted top, tool with solid chips · slide: pointed tops · worked | `solid-shadow` ×4 (cube, cylinder, cone, pyramid, prism), practice |
| `proportion` | Same sun, same ratio | hook (`shadow-ratio`) · slide: the ratio · worked | `shadow-ratio` ×4 (numerical), practice |
| `rows` | Several objects in a row | hook (`row-shadows`) · slide: equal heights, equal lengths; identify each by its shadow's end · worked | `row-shadows` ×4, practice |

Quiz (8, pass 6): `solid-shadow` 3, `shadow-ratio` 3, `row-shadows` 2.

### Exam hard (L4)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `stacked` | One solid on another | hook (`stacked-shadow`) · slide: shadow each part, then join · worked | `stacked-shadow` ×4, practice |
| `compass` | Sun, compass and turning | hook (`compass-shadows`) · slide: the shadow does not turn when the walker turns · worked | `compass-shadows` ×4 (multiple select), practice |
| `lamp` | A lamp, not the sun | hook (`lamp-shadow`) · slide: shadows fan out from the point under the lamp · slide: similar triangles · worked | `lamp-shadow` ×3 (numerical), `silhouette-set` ×1 (multiple select), practice |

Quiz (8, pass 5): `stacked-shadow` 3, `compass-shadows` 2, `lamp-shadow` 2,
`silhouette-set` 1.

### Mastery (L5)

Review lesson, then 12 questions, 22 minutes, `uceed` marking, two of each
L3–L4 kind except one `silhouette-set`.

## 5. Question kinds

| Kind | Levels | Mode |
|---|---|---|
| `shadow-direction` | 1 | single |
| `shadow-length-compare` | 2 | single |
| `flat-shadow` | 2 | single |
| `solid-shadow` | 3 | single |
| `shadow-ratio` | 3 | numeric |
| `row-shadows` | 3 | single |
| `stacked-shadow` | 4 | single |
| `compass-shadows` | 4 | multi |
| `lamp-shadow` | 4 | numeric |
| `silhouette-set` | 4 | multi |

### `solid-shadow` and `row-shadows`

- **Scenario.** One solid (L3 `solid-shadow`) or three in a row of equal
  height in random order (`row-shadows`) on a top-view grid. Light given as
  an arrow in the top view plus a height angle of 30°, 45° or 60°.
- **Answer.** `shadowOf(solid, light)` (section 6). Options are top views.
- **Distractors.** `toward-light` (shadow on the wrong side), `too-long` or
  `too-short` (wrong angle), `wrong-tip` (a cone drawn with a flat-ended
  shadow or a cube with a pointed one), `unshifted` (shadow the same as the
  base).
- **Verification.** Options compared as polygons (sorted hull vertices
  rounded to 1/100) plus arcs.

### `flat-shadow` (L2)

A circle, square or triangle held parallel to the table on a thin post.
Truth: the same shape, shifted. Distractors: an ellipse or stretched
shape, a larger copy, the shape under the object unshifted. A tilted
variant (the shape tilted 60° toward the light) has a squashed shadow as
the truth; state the tilt in the prompt.

### `shadow-ratio` (L3, numerical)

"A 6 m pole casts a 4 m shadow. At the same time a tree casts a 10 m
shadow. How tall is the tree?" Choose numbers so the answer is a whole
number or one decimal. Variants ask for the shadow given the height.
Mistakes: `ratio-inverted`, `difference` (adds the difference instead of
scaling).

### `stacked-shadow` (L4)

A cylinder, cone or pyramid standing centred on a cube (heights equal to
the cube's side), light at 45° from a stated direction. Truth: union of
the cube's shadow and the upper solid's shadow, the latter shifted by its
base height. Distractors: upper solid's shadow not shifted further;
upper shadow missing; wrong tip.

### `compass-shadows` (L4, multiple select)

Two walkers heading in a stated compass direction; the sun's position
given as a compass point; one walker then turns by 45° or 90°. Four
top-view drawings; correct ones show both shadows parallel and pointing
away from the sun whatever the walkers' headings. Wrong: shadows that
follow the body's heading; shadows toward the sun; non-parallel shadows.
One or two options are correct (two when both differ only in details that
are both valid, such as walker spacing).

### `lamp-shadow` (L4, numerical)

A lamp at height H above the ground; a post of height h at distance D from
the point below the lamp. Shadow length = D × h ÷ (H − h). Numbers chosen
so the answer is whole. Mistakes: `sun-rule` (h, as if at 45°), `d-times-h-
over-H`.

### `silhouette-set` (L4, multiple select)

A flat outline (circle, square, triangle, rectangle). "Which of these
solids can cast this shadow on a wall when lit from one side?" From a table
of solids and their possible silhouettes (section 6).

## 6. Engine

`src/learn/shadows.js`. Top view: x right, y up the page; z up out of the
page. Units are grid cells.

- Light: `{ azimuth, elevation }`. `azimuth` is the compass direction the
  light **comes from**, in degrees clockwise from north (north is up the
  page). The horizontal travel direction is the opposite. For a point at
  height h the shadow offset is `h ÷ tan(elevation)` along the travel
  direction: `offset = (−sin(azimuth), −cos(azimuth)) × h ÷ tan(elevation)`.
- `shadowOf(solid, light)` returns a list of shapes:
  - box with footprint polygon P and height h: convex hull of P and
    P + offset(h).
  - cylinder radius r, height h: hull of the base circle and the circle
    shifted by offset(h) (a stadium shape: two arcs and two tangent lines).
  - cone or pyramid with apex above the base centre at height h: hull of
    the base and the single point centre + offset(h).
  - prism: as box with its polygon.
  - sphere of radius r resting on the ground: an ellipse centred at the
    contact point shifted by offset(r), semi-minor r across the light,
    semi-major r ÷ sin(elevation) along it.
  - flat shape at height h parallel to the ground: the same shape shifted
    by offset(h).
- `compassToAzimuth(name)` for N, NE, E, SE, S, SW, W, NW.
- `lampShadow(H, h, D)` = D × h ÷ (H − h).
- Silhouette table: sphere {circle}; cylinder {circle, rectangle}; cone
  {circle, triangle}; cube {square, rectangle, hexagon}; square pyramid
  {square, triangle}; triangular prism {triangle, rectangle}.
- Convex hull: monotone chain on rounded coordinates.

## 7. Figures and tool

- Figure `shadow-top`: a top-view grid with solids drawn as their plan
  outlines in ink, shadows as translucent grey shapes under them, a compass
  rose, a light arrow.
- Figure `shadow-side`: a side view with the ground line, objects, a sun or
  lamp and rays, for ratio and lamp questions.
- Tool `sun-table`: a top view of a table with one to three solids chosen
  by chips; a **direction dial** (eight compass chips) and a **height
  slider** (15°–75°) for the sun; shadows update live; a small side view
  shows the ray and the angle; a toggle switches the sun for a lamp so the
  shadows fan out. Status line: "Sun from the east at 45°. The cube's
  shadow is as long as the cube is tall and points west."

## 8. Hand-checked cases

- Sun from the east (azimuth 90°), elevation 45°, a post of height 2 at
  the origin: shadow tip at (−2, 0).
- Elevation 30°: length = height × 1.732. Elevation 60°: height × 0.577.
- Unit-square box of height 1, sun from the south at 45°: shadow is the
  hull of the square and the square moved 1 north (a 1×2 rectangle).
- Sun from the south-west at 45°, same box: a hexagon (the square and the
  square moved (0.707, 0.707)).
- A disc held parallel to the table: a circle of the same radius.
- Pole 6, shadow 4; shadow 10 → height 15.
- Lamp at 6 m, post 2 m, 4 m away: shadow 2 m.
- Sphere of radius 1, elevation 30°: ellipse semi-axes 1 and 2.

## 9. Archetype coverage

| Archetype | Kind and level | Verified on seeds | Notes |
|---|---|---|---|
| L1 | `solid-shadow`, `row-shadows` L3 | 1–40 | Ray-cast check of every option |
| L2 | `flat-shadow` L2 | 1–40 | Translation check |
| L3 | `stacked-shadow` L4 | 1–40 | Each part cast from its own height |
| L4 | `shadow-ratio` L3, `lamp-shadow` L4 | 1–40 | Cross-multiplied |
| L5 | `compass-shadows` L4 | 1–40 | Shadow vectors parallel to the light |
| L6 | — | | Shadow puppetry needs scene illustration; out of scope |
| L7 | `silhouette-set` L4 | 1–40 | Separate table of views |

## 10. Out of scope

Shadows falling on walls and steps, coloured shadows, eclipses (Everyday
physics, B3), and shadow puppet scenes.
