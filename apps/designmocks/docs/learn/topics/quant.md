# Number and quantity

Slug `quant` · topic `quantitative-reasoning` · exams uceed, ceed, nift ·
engine `src/learn/quant.js` · tool `number-lab`

Status: Foundations Built · Exam standard Built · Exam hard Built · Mastery
Built (15 November 2026).

## 1. Outcome

Faced with a short numerical puzzle of the UCEED kind, the student finds the
way in (an equation per sentence, relative speed, a table of steps, a
remainder) and types the exact number.

## 2. Exam evidence

From the owner's Quantitative Aptitude bank (30 UCEED questions, 2015–2026).
Described in our own words; nothing is copied.

| Archetype | Example in the bank | Kind |
|---|---|---|
| Discount slabs that follow a pattern | festive discount table, extend it | `slab-pattern` L3 |
| Ages from two sentences | "three times as old as … was" | `age-puzzle` L3 |
| Fractions of a period | half working, a third sleeping, … in a year | `fraction-time` L3 |
| Trains passing | crossing time, passenger sees the other train | `relative-speed` L3 |
| Walking with turns | opposite ways, then each turns left | `walk-distance` L3 |
| Clock hands | together, opposite, at right angles | `clock-hands` L3 |
| Cutting sheets | pieces from a roll | `cut-sheets` L3 |
| Pieces from straight cuts | most pieces with four cuts | `max-pieces` L3 |
| Two legs of a trip | average speed, find one leg's speed | `two-legs` L4 |
| Crossing with one umbrella | four people, two at a time | `crossing` L4 |
| Digits on a clock | sum of digits shown over an hour | `clock-digits` L4 |
| Bricks in a tank | soaking up water until full | `displacement` L4 |
| A procedure with a loop | steps with a test and a jump | `procedure` L4 |
| Ratios and limits | apples and oranges in a basket | `basket` L4 |
| Daily cycle with a break | kit worn in turn, which on a date | `calendar-cycle` L4 |

Foundations adds `percent-change`, `ratio-share`, `average-missing` and
`speed-units` (single choice).

Not generated: questions that need a printed chart (population pie charts),
an account statement, or the calculator-keys puzzle (too few variants).

## 3. Techniques taught

Percentage changes multiply. Ratios count parts. Averages go through totals.
Opposite ways add speeds, same way subtracts. The minute hand gains 5.5° a
minute. Whole pieces round down on each side. The n-th crossing cut adds n
pieces. Average speed is total distance over total time. Volumes divide by
the net change per item. Procedures get a table. Cycles use remainders.
Ratios become multiples, and limits choose among them.

## 4. Ladder

Foundations `percent-ratio`, `averages-speed`; Exam standard `sentences`,
`motion`, `clocks`, `cutting`; Exam hard `rates`, `puzzles`,
`step-by-step`; Mastery `review` and a 12-question timed set (UCEED
marking). See `src/learn/programmes/quant.js`.

## 5. Verification

`tests/quant.test.mjs` recomputes every answer from the question's own
words by a different method: a full search of the umbrella crossing, a fine
time-step simulation of the clock hands, searches over ages, apples and first
speeds, physically tiling pieces, adding bricks one at a time, running the
procedure, and stepping through the calendar a day at a time.
