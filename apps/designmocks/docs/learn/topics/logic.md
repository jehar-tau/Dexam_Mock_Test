# Logical reasoning: three programmes

Slugs `codes-patterns`, `arrangements`, `directions` · topic
`logical-reasoning` · exams uceed, ceed, nid, nift · engine
`src/learn/logic.js` · figures `src/learn/logic-figures.jsx` · tool
`logic-lab` (modes `shift`, `seats`, `compass`)

Status: all three Built through four tiers (15 November 2026).

## 1. Source

The owner's Logical Reasoning bank (28 questions, UCEED, NID, NIFT),
described in our own words. Sections: number and alphabet series; coding
and decoding (symbol codes, letter changes, words from bars); direction and
path puzzles (a village plan, fewest openings); constraint puzzles
(handshakes, rules applied in order, symbol sums); number figures
(diamonds, triangles); visual series, matrices, jigsaws and data charts.
The visual sections belong to programme 9 (visual series and matrices) and
14 (fit and embedded figures) in `../10-completion-plan.md`.

## 2. Kinds

| Programme | Kind | Level | Mode | Checked by |
|---|---|---|---|---|
| codes-patterns | `number-series` | 1 | single | the filled series fits a taught family; no wrong option does |
| | `letter-shift` | 2 | single | search over every shift and reversal |
| | `series-rule` | 3 | numeric | the filled series fits a family; no listed mistake does |
| | `word-code` | 3 | single | search over every letter-to-symbol assignment and order |
| | `figure-number` | 4 | numeric | exactly one listed rule fits the complete figures |
| | `series-odd` | 4 | single | only the odd term can be changed to complete a pattern |
| arrangements | `ranking` | 1 | single | every ordering tried against the parsed facts |
| | `row-seating` | 2 | single | every seating tried against the parsed clues; exactly one fits |
| | `circle-seating` | 3 | single | every seating round the table tried; exactly one fits |
| | `symbol-sum` | 3 | single | search over bases and digit values |
| | `rule-sequence` | 4 | single | rules re-applied from the table's text |
| | `handshakes` | 4 | numeric | search over group sizes |
| directions | `direction-facing` | 1 | single | the walk replayed with turns as rotations |
| | `direction-distance` | 2 | numeric | the walk replayed |
| | `relations` | 3 | single | generations rebuilt from the parsed sentences |
| | `day-of-week`, `clock-gain` | 3 | single, numeric | dates from the calendar; whole hours |
| | `calendar-repeat` | 4 | numeric | every day of each year compared |
| | `maze-openings` | 4 | numeric | distances relaxed until stable (a different method from the engine) |

Seating clues are trimmed so that every clue is needed: removing any one
leaves more than one seating.

## 3. Conventions

Round a table, everyone faces the centre. Seen from above, each person's
left is the next seat clockwise. Seats are numbered in that direction.
