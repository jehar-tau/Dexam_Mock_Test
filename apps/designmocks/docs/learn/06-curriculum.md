# 6. Curriculum

Every topic Learn will cover, grouped by exam section, with its weight in the
exams, its engine type, its wave and its status.

## 6.1 How the weights were measured

On 13 November 2026 the private bank (4,737 questions) was scanned for topic
keywords. The counts below are **keyword estimates**: a question can match
two topics, figure-only questions are missed, and about a third of UCEED and
CEED questions matched nothing. Treat them as an order of priority, not as
statistics. Recount when the bank's topic tags are available.

| Topic family | UCEED | CEED | NID | NIFT |
|---|---:|---:|---:|---:|
| Views, rotation, orthographic and isometric | 87 | 76 | 13 | 6 |
| Pattern, series, analogy, odd one out | 99 | 73 | 36 | 12 |
| Counting figures and surfaces | 32 | 27 | 9 | — |
| Gears, belts, pulleys, mechanisms | 33 | 26 | 7 | 5 |
| Shadows, light, silhouettes | 21 | 24 | 7 | 1 |
| Paper folding and cutting | 21 | 20 | 4 | 4 |
| Cube nets and dice | 18 | 25 | 3 | 6 |
| Counting cubes, painted cubes | 16 | 16 | 6 | 1 |
| Mirror and water images | 14 | 8 | 4 | — |
| Colour | 52 | 73 | 55 | 20 |
| Typography, logos, symbols | 39 | 64 | 32 | 87 |
| Perspective, camera, depth | 28 | 55 | 96 | 5 |
| Materials and processes | 61 | 85 | 40 | 65 |
| Art, craft, architecture, design history | 41 | 65 | 36 | 60 |
| Logical reasoning | 144 | 70 | 39 | 153 |
| Quantitative reasoning | 101 | 117 | 75 | 295 |
| English | 17 | 32 | 22 | 265 |
| General knowledge and current affairs | 20 | 7 | 33 | 114 |

The owner's own spatial bank (146 questions, see
[08-owner-reference-standard.md](08-owner-reference-standard.md)) gives a
sharper picture for UCEED: assembly and mechanism 48, solid generation,
rotation and shadows 22, orthographic views 20, cube nets 17, surface
counting 17, paper folding and cutting 13, cube rotation 9. Mechanism and
assembly topics deserve more weight than the keyword scan suggests.

## 6.2 Engine types

| Type | What it is | Rights and accuracy |
|---|---|---|
| **Generative** | A geometry or logic engine computes scenarios, answers and distractors. Unlimited questions. | No rights issue. Correctness is proven by tests. |
| **Rule-based** | A small rule set (colour wheel, gear ratios, clock mirrors) drives generation. | No rights issue. Rules are cited in the spec. |
| **Deck** | A reviewed set of facts (crafts, designers, materials) presented as recall cards and questions. Not generated. | Every fact needs a source and an owner review before release. Build the deck tool once (wave 5), then decks are content work. |
| **Drawing** | Sketching drills judged by rubric and, later, the drawing review system. | Waits for drawing review to be released. |

## 6.3 The catalogue

Status: **B** built at Foundations, **S** fully specified in `topics/`,
**C** card only (below), **—** not started.

### A. Visualisation and spatial ability (UCEED, CEED, NID, NIFT)

| # | Programme | Type | Wave | Status |
|---|---|---|---|---|
| A1 | [Cube nets](topics/cube-nets.md) | Generative | 1 | B, S |
| A2 | [Paper folding and cutting](topics/paper-folding.md) | Generative | 1 | B, S |
| A3 | [Mirror and water images](topics/mirror-images.md) | Generative | 1 | B, S |
| A4 | [Counting cubes](topics/counting-cubes.md) | Generative | 1 | B, S |
| A5 | [Views and rotation](topics/views-and-rotation.md) | Generative | 2 | S |
| A6 | [Dice](topics/dice.md) | Generative | 2 | S |
| A7 | [Surfaces of solids](topics/solid-surfaces.md) | Generative | 2 | S |
| A8 | [Counting figures](topics/counting-figures.md) | Generative | 2 | S |
| A9 | [Shadows and light](topics/shadows-and-light.md) | Generative | 2 | S |
| A10 | Pattern series, analogies and matrices | Generative | 3 | C |
| A11 | Sections and cuts of solids | Generative | 3 | C |
| A12 | Fit, jigsaw and embedded figures | Generative | 3 | C |
| A13 | Transparent overlays and pixel shifts | Generative | 3 | C |
| A14 | [Nets of solids](topics/nets-of-solids.md) | Generative | 1b, right after cube nets | S |

### B. Practical and scientific knowledge (UCEED, CEED)

| # | Programme | Type | Wave | Status |
|---|---|---|---|---|
| B1 | [Gears, belts and levers](topics/mechanisms.md) | Rule-based | 2 | S |
| B2 | Levers, linkages and simple machines | Rule-based | 3 | C |
| B3 | Everyday physics: balance, floating, lenses, sound | Rule-based + deck | 4 | C |
| B4 | Materials and manufacturing processes | Deck | 5 | C |

### C. Observation and design sensitivity (all four exams)

| # | Programme | Type | Wave | Status |
|---|---|---|---|---|
| C1 | [Colour](topics/colour.md) | Rule-based | 1 | B, S |
| C2 | Perspective, camera and depth | Generative | 3 | C |
| C3 | Typography and letterforms | Rule-based + deck | 4 | C |
| C4 | Visual observation and detail memory | Generative | 4 | C |
| C5 | Composition, Gestalt and visual hierarchy | Rule-based | 4 | C |
| C6 | Proportion, scale and ergonomics | Rule-based | 4 | C |
| C7 | Logos, symbols and signage | Deck | 5 | C |

### D. Analytical and logical reasoning (all four exams)

| # | Programme | Type | Wave | Status |
|---|---|---|---|---|
| D1 | Arrangements: seating, ordering, ranking | Generative | 3 | C |
| D2 | Coding, sequences and number patterns | Generative | 3 | C |
| D3 | Relations, directions, clocks and calendars | Generative | 4 | C |
| D4 | Statements, conclusions and sets | Generative | 4 | C |
| D5 | Data reading: tables, charts, maps | Generative | 4 | C |

### E. Quantitative reasoning (NIFT GAT, CEED, UCEED numerical)

| # | Programme | Type | Wave | Status |
|---|---|---|---|---|
| E1 | Ratio, percentage, averages | Generative | 4 | C |
| E2 | Lengths, areas and volumes | Generative | 4 | C |
| E3 | Speed, work and rates | Generative | 4 | C |
| E4 | Counting and probability | Generative | 4 | C |

### F. Language (NIFT GAT; UCEED and CEED lightly)

| # | Programme | Type | Wave | Status |
|---|---|---|---|---|
| F1 | Vocabulary in context | Deck | 5 | C |
| F2 | Reading comprehension | Deck | 5 | C |
| F3 | Grammar and usage | Rule-based + deck | 5 | C |

### G. Environment, society and design awareness (all four exams)

| # | Programme | Type | Wave | Status |
|---|---|---|---|---|
| G1 | Indian crafts and textiles | Deck | 5 | C |
| G2 | Art, architecture and monuments | Deck | 5 | C |
| G3 | Designers, products and design history | Deck | 5 | C |
| G4 | General knowledge and current affairs | Deck | 5 | C |

### H. Drawing (UCEED and CEED Part B, NID, NIFT CAT)

| # | Programme | Type | Wave | Status |
|---|---|---|---|---|
| H1 | Sketching drills: line, form, perspective | Drawing | After drawing review ships | C |
| H2 | Ideation and visual storytelling tasks | Drawing | After drawing review ships | C |

## 6.4 Waves

| Wave | Contents | Why this order |
|---|---|---|
| 1 | Take the five built programmes through all four tiers | The player and tools exist; this proves the ladder. |
| 2 | Views and rotation, dice, surfaces, counting figures, gears, shadows | The highest spatial and mechanical weight in UCEED and CEED; all generative. |
| 3 | Patterns and matrices, sections of solids, fit and embedded figures, overlays, levers, perspective, arrangements, coding | Completes visualisation; starts reasoning with generative engines. |
| 4 | Remaining reasoning and quantitative topics, typography, observation, composition, ergonomics, everyday physics | Broad coverage for NIFT GAT and the rest of Part A. |
| 5 | Deck tool, then knowledge decks | Needs sourced, reviewed facts; content-heavy rather than engine-heavy. |
| Later | Drawing | Depends on the drawing review release. |

A wave-3 or later topic needs a full spec in `topics/` before it is built.
Write the spec from `topics/_TEMPLATE.md`; a spec is itself a deliverable and
should be reviewed by the owner before building.

## 6.5 Cards for topics without a full spec yet

Each card fixes the scope so the spec writer starts from the same place.

**A10 Pattern series, analogies and matrices.** Engine: a figure is a small
set of elements with attributes (shape, count, rotation, fill, position);
rules transform attributes step by step (rotate 45°, add one, alternate
fill, move clockwise). Kinds: next in series, missing cell of a 3×3 matrix
(row and column rules), analogy A:B::C:?, odd one out. Hard levels: two or
three rules at once, one rule on rows and another on columns, distractors
that satisfy one rule only. Tool: rule mixer that animates one rule at a
time.

**A11 Sections and cuts of solids.** Engine: cube, prism, pyramid, cylinder
and cone cut by a plane; section polygon by intersecting the plane with
edges. Kinds: shape of the cut face, which piece is part P, how many
pieces, count of faces after the cut. Hard levels: oblique planes through
three given points (hexagonal section of a cube), two cuts. Tool: plane
slider through a wireframe solid.

**A12 Fit, jigsaw and embedded figures.** Engine: polyomino and polygon
pieces; a target outline with a missing region; rotations allowed,
reflections not unless stated. Kinds: which piece completes the figure
(single and multiple select), which figure hides the given shape, which set
of pieces makes the target. Hard levels: pieces that differ by one cell,
mirror-image decoys, two missing regions.

**A13 Transparent overlays and pixel shifts.** Engine: line drawings on a
grid of a transparent sheet; fold along a dotted line and superimpose;
shift rows of pixels. Kinds: resulting figure after the fold, which options
are row shifts of the image. Shares reflection code with paper folding.

**B2 Levers, linkages and simple machines.** Rule set: lever classes and
moments, four-bar linkages on a grid (direction of output for an input
direction), cams, rack and pinion, inclined plane. Kinds: direction of
motion, force needed (numerical), which design works (multiple select).

**B3 Everyday physics.** Stability and centre of gravity, floating and
displacement, convex and concave lenses and mirrors, sound in spaces,
eclipses and shadows in the sky. Mix of rule-based figures and a reviewed
deck.

**B4 Materials and manufacturing processes.** Deck: process to product
(injection moulding, casting, extrusion, weaving, block printing, ceramics
forming), material properties, joinery. Recall cards then matching and
multiple-select questions.

**C2 Perspective, camera and depth.** Engine: simple scenes of boxes on a
ground plane rendered in one- and two-point perspective for a given eye
height and position. Kinds: which drawing matches the viewpoint, where is
the horizon, order by focal length, depth cues. Heavy in NID.

**C3 Typography and letterforms.** Rules: serif and sans serif, x-height,
ascenders, kerning, weight, alignment, legibility. Kinds: identify the
classification, find the mis-kerned word, pick the most legible setting.
Uses system and bundled fonts only (Figtree, Zilla Slab) plus drawn
letterform parts.

**C4 Visual observation and detail memory.** Engine: generated scenes of
shapes with attributes; a copy with n changes. Kinds: spot the differences
(numerical), which is identical to the original, recall after a timed view.

**C5 Composition, Gestalt and visual hierarchy.** Rule-based layouts:
proximity, similarity, closure, continuity, figure–ground, balance,
alignment grids. Kinds: which grouping principle, which layout reads in the
stated order, which is balanced.

**C6 Proportion, scale and ergonomics.** Human-scale reference sizes,
percentile reasoning for design populations, scale drawings. Kinds: which
dimension fits most users, convert scale (numerical), pick the comfortable
posture.

**C7 Logos, symbols and signage.** Deck with drawn generic symbols only; no
trademarks reproduced. Road and public-information symbols, care labels,
recycling codes.

**D1–D5 Reasoning.** Constraint puzzles generated with a unique solution
(verify uniqueness by exhaustive search), letter and number codes with
stated rules, family trees and compass paths, mirror-free clock and calendar
arithmetic, syllogisms over small set diagrams, and small data tables with
computed questions.

**E1–E4 Quantitative.** Parameterised word problems with clean numbers,
numerical answers at higher levels, distractors from named mistakes (ratio
inverted, percentage of the wrong base).

**F1–F3 Language.** Reviewed decks: words in context, short original
passages with questions, and rule-based sentence correction.

**G1–G4 Awareness.** Reviewed decks with sources. Spaced recall first,
questions second. Current affairs needs a dated refresh cycle.

**H1–H2 Drawing.** Prompt, timed sketch, upload, rubric self-check, later
human review through the drawing review system.
