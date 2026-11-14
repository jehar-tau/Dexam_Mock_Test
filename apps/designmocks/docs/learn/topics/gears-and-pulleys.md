# Gears, belts and pulleys

Slug `gears-and-pulleys` · topic `mechanics` · exams uceed, ceed ·
engine `src/learn/gears.js` · tool `gear-train`

Status: Foundations Planned · Exam standard Planned · Exam hard Planned ·
Mastery Planned

## 1. Outcome

For any drawn system of gears, belts and pulleys the student can say which
way each wheel turns, how fast the last one turns, whether the system can
move at all, and how much force a pulley arrangement needs, as a typed
number.

## 2. Exam evidence

| Id | Archetype | Form | Frequency |
|---|---|---|---|
| G1 | A driving gear turns clockwise: which statement about another gear is true | Single choice | Common |
| G2 | Gears and belts with given sizes: the speed of the last wheel | Numerical | Regular |
| G3 | A belt and pulley arrangement: how many pulleys turn clockwise | Numerical | Regular |
| G4 | Pulleys lifting a load: the least force needed | Numerical | Occasional |
| G5 | A mechanism drawn in section (toy, tool): which design will work | Multiple select | Occasional |

## 3. Techniques taught

- **Touching gears turn opposite ways.** Count the gears in a chain: odd
  positions turn with the driver, even positions against it.
- **Small turns faster.** Speeds are in inverse proportion to teeth (or
  diameter): speed × teeth is the same for two meshing gears.
- **Idlers change direction, not speed.** Only the first and last gear of a
  simple chain set the ratio.
- **Same shaft, same speed and direction.** A compound gear passes its
  speed to its partner unchanged.
- **Belts.** An open belt keeps the direction. A crossed belt reverses it.
  Speeds are in inverse proportion to pulley diameters.
- **A loop of an odd number of meshing gears is locked.**
- **Pulleys.** With ideal ropes and pulleys, the effort is the load divided
  by the number of rope segments holding up the moving block.

## 4. Ladder

### Foundations (L1–L2)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `two-gears` | Two gears | slide: opposite ways, tool with two gears turning · slide: small turns faster | `gear-direction` L1 ×4 (2–3 gears in a line) |
| `chains` | Chains and idlers | slide: odd and even positions, tool with a gear count slider · slide: idlers do not change speed | `gear-direction` L2 ×2 (4–6 gears), `gear-speed` L2 ×2 (two gears, single choice) |
| `belts` | Belts | slide: open belt, crossed belt, tool with a belt toggle · slide: pulley sizes | `belt-direction` L2 ×4 |

Quiz: `gear-direction` 3, `gear-speed` L2 ×2, `belt-direction` 3.

### Exam standard (L3)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `ratios` | Speed through a chain | hook (`gear-speed` L3) · slide: speed × teeth stays the same · slide: skip the idlers · worked | `gear-speed` L3 ×4 (numerical, 3–4 gears), practice |
| `compound` | Gears on one shaft | hook (`compound-speed`) · slide: same shaft, same speed · worked (two stages multiply) | `compound-speed` ×4, practice |
| `count-clockwise` | Which way does each turn? | hook (`count-clockwise`) · slide: mark the driver, walk the system · worked | `count-clockwise` ×4 (numerical; gears and belts mixed), practice |

Quiz (8, pass 6): `gear-speed` L3 ×3, `compound-speed` 2, `count-clockwise` 3.

### Exam hard (L4)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `mixed-systems` | Gears and belts together | hook (`system-speed`) · slide: one link at a time, write the speed after each · worked | `system-speed` ×4 (numerical; 5–6 wheels, meshes, shafts and belts), practice |
| `locked` | Will it move? | hook (`will-it-move`) · slide: an odd loop is locked · slide: two paths to one gear must agree · worked | `will-it-move` ×4 (multiple select: which systems can turn), practice |
| `pulleys` | Lifting with pulleys | hook (`pulley-effort`) · slide: count the rope segments on the moving block · worked | `pulley-effort` ×3 (numerical), `pulley-distance` ×1, practice |

Quiz (8, pass 5): `system-speed` 3, `will-it-move` 2, `pulley-effort` 2,
`count-clockwise` 1.

### Mastery (L5)

Review lesson, then 12 questions, 24 minutes, `uceed` marking: `gear-speed`
L3 ×2, `compound-speed` ×2, `count-clockwise` ×2, `system-speed` ×3,
`will-it-move` ×1, `pulley-effort` ×2.

## 5. Question kinds

| Kind | Levels | Mode |
|---|---|---|
| `gear-direction` | 1, 2 | single |
| `belt-direction` | 2 | single |
| `gear-speed` | 2 (single), 3 (numeric) | single / numeric |
| `compound-speed` | 3 | numeric |
| `count-clockwise` | 3 | numeric |
| `system-speed` | 4 | numeric |
| `will-it-move` | 4 | multi |
| `pulley-effort`, `pulley-distance` | 4 | numeric |

### Numbers

- Teeth counts from {8, 10, 12, 15, 16, 20, 24, 30, 36, 40, 48, 60};
  diameters from {1, 2, 3, 4, 5, 6}; driver speeds from {30, 60, 90, 100,
  120, 150, 180, 240, 300, 360}. Choose so that every asked speed is a
  whole number between 5 and 2,000. Reject other seeds.
- Speeds are stated in turns per minute in prompts ("120 turns a minute").

### `count-clockwise` and `system-speed`

- **Scenario.** A system graph (section 6) of 4–7 wheels laid out on a
  grid so no parts overlap. Links: mesh, same shaft, open belt, crossed
  belt. One wheel is marked as the driver with a direction arrow and, for
  speed kinds, its speed.
- **Ask.** How many wheels turn clockwise; or the speed of a named wheel.
- **Answer.** `solve(system)` (section 6).
- **Mistakes.** `idler-counted` (ratio through every gear multiplied),
  `belt-as-mesh` (belt treated as reversing), `ratio-inverted`.
- **Solution.** One step per link in walk order: wheel, direction, speed.

### `will-it-move` (multiple select)

Four small systems. A system is locked when `solve` finds a wheel reached
by two paths with different direction or speed (an odd ring of meshing
gears, or two shafts geared at clashing ratios). One to three can move.

### `pulley-effort` and `pulley-distance`

- **Scenario.** One of five standard arrangements drawn from parameters:
  single fixed pulley (advantage 1), single moving pulley (2), fixed plus
  moving with the rope end tied to the ceiling (2) or to the moving block
  (3), block and tackle with n = 4 or 6 supporting segments.
- **Ask.** Effort for a load chosen as a multiple of the advantage (so the
  answer is whole), "with ideal ropes and pulleys"; or how far the rope
  must be pulled to raise the load a given distance (distance × advantage).
- **Mistakes.** `count-pulleys` (advantage = number of pulleys),
  `count-all-segments` (includes the segment being pulled downward).

## 6. Engine

`src/learn/gears.js`.

- A system is `{ wheels: [{ id, teeth | diameter, x, y }], links: [{ a, b,
  type }], driver: { id, direction: 1 | -1, speed } }` with link types
  `mesh`, `shaft`, `belt`, `crossed`.
- `solve(system)` → `{ wheels: { id: { direction, speed } }, locked }`.
  Breadth-first from the driver. Across a link from a to b:
  - `mesh`: direction × −1; speed × teeth(a) ÷ teeth(b).
  - `shaft`: unchanged.
  - `belt`: direction unchanged; speed × diameter(a) ÷ diameter(b).
  - `crossed`: direction × −1; speed as belt.
  When a wheel already has a value, compare; a mismatch in direction or
  speed (as exact fractions) sets `locked`.
  Use integer fractions (numerator and denominator), never floating point.
- `layout(system)` validation: meshing gears touch (centre distance equals
  the sum of pitch radii, with radius proportional to teeth), other gears
  do not overlap; belts join pulleys that do not touch.
- `pulleyAdvantage(arrangement)` from the table above.

## 7. Figures and tool

- Figure `gear-system`: gears as toothed circles sized by teeth, letters at
  the centres, belts as tangent lines (crossed belts cross), a curved arrow
  on the driver, optional arrows on all wheels (for solutions).
- Figure `pulley-rig`: ceiling, pulleys, rope segments, load box with its
  weight, an arrow where the rope is pulled.
- Tool `gear-train`: a row of 2–6 gears with a count slider, tooth-count
  chips per gear, a belt toggle for the last pair, and a play control. When
  playing, gears rotate with CSS animation at speeds in the true ratio;
  with reduced motion, static arrows and the speeds as numbers. Status
  line: "A turns clockwise at 60. D turns anticlockwise at 90."

## 8. Hand-checked cases

- A (20 teeth) drives B (40): B turns the other way at half the speed.
- A (20) – B (40) – C (10) in a line, A at 60 clockwise: C at 120
  clockwise; B at 30 anticlockwise.
- Compound: A (10) meshes B (30); C (15) on B's shaft meshes D (45). A at
  180 clockwise: B and C at 60 anticlockwise; D at 20 clockwise.
- Open belt from a pulley of diameter 3 to one of diameter 1, driver at
  100: follower at 300, same direction. Crossed belt: 300, opposite.
- Three gears meshing in a ring: locked. Four in a ring: free.
- Block and tackle with 4 supporting segments and a 600 N load: 150 N; to
  raise the load 0.5 m pull 2 m of rope.

## 9. Archetype coverage

| Archetype | Kind and level | Verified on seeds | Notes |
|---|---|---|---|
| G1 | `gear-direction` L1–L2 | | |
| G2 | `gear-speed`, `compound-speed`, `system-speed` | | |
| G3 | `count-clockwise` L3 | | |
| G4 | `pulley-effort` L4 | | |
| G5 | `will-it-move` L4 partly | | Drawn mechanisms belong to Levers and linkages (B2) |

## 10. Out of scope

Worm gears, bevel gears, rack and pinion, cams and linkages (programme B2).
Friction, rope weight and efficiency.
