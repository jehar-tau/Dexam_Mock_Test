// Number and quantity: the numerical questions of UCEED and CEED. They are
// short puzzles, so the lessons teach a way in for each kind (equations from
// sentences, relative speed, a table of steps) rather than drill.
// Specification: docs/learn/topics/quant.md.
const lab = mode => ({ tool: 'number-lab', props: { mode } });
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level, id = 'worked-1') => ({ id, kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const quantProgramme = Object.freeze({
  slug: 'quant',
  title: 'Number and quantity',
  summary: 'Percentages, ratios, ages, speeds, clocks, time and work, and the short number puzzles UCEED sets, each with a way in.',
  topic: 'quantitative-reasoning',
  exams: ['uceed', 'ceed', 'nift'],
  minutes: 150,
  status: 'preview',
  tiers: [
    {
      id: 'foundations', title: 'Foundations', level: 2,
      lessons: [
        {
          id: 'percent-ratio', title: 'Percentages and ratios', minutes: 10, level: 1,
          summary: 'A percentage change multiplies; a ratio shares out parts.',
          steps: [
            { id: 'multiply', kind: 'slide', title: 'A change multiplies', text: 'Up 20% means × 1.2. Down 25% means × 0.75. Two changes in a row multiply, and the second works on the new amount, so up 20% then down 20% is not back to the start.' },
            { id: 'parts', kind: 'slide', title: 'A ratio is a count of parts', text: 'Shared 2 : 3, the whole is 5 parts. Find one part, then multiply by each share\'s parts.', ...lab('bar'), hint: 'Change the parts and the total, and watch one part\'s value.' },
            check('check-1', 'percent-change', 1, 1), check('check-2', 'percent-change', 2, 1), check('check-3', 'ratio-share', 1, 1), check('check-4', 'ratio-share', 3, 1),
            { id: 'remember', kind: 'takeaway', body: 'Percentage changes multiply, one after another. A ratio: total ÷ parts, then times each share.' },
          ],
        },
        {
          id: 'averages-speed', title: 'Averages and speed', minutes: 10, level: 2,
          summary: 'Work with totals, not averages; and change units before you divide.',
          steps: [
            { id: 'totals', kind: 'slide', title: 'Think in totals', text: 'An average times the count is the total. To find a missing number, subtract the old total from the new total.' },
            { id: 'units', kind: 'slide', title: 'Metres a second and km an hour', text: 'Multiply metres a second by 18 ÷ 5 to get km an hour; multiply km an hour by 5 ÷ 18 to go back. A train passing a pole travels its own length.' },
            check('check-1', 'average-missing', 1, 2), check('check-2', 'average-missing', 3, 2), check('check-3', 'speed-units', 1, 2), check('check-4', 'speed-units', 2, 2),
            { id: 'remember', kind: 'takeaway', body: 'Averages: go through totals. Speeds: get the units right first.' },
          ],
        },
      ],
      quiz: { title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain', questions: [{ kind: 'percent-change', level: 1, count: 2 }, { kind: 'ratio-share', level: 1, count: 2 }, { kind: 'average-missing', level: 2, count: 2 }, { kind: 'speed-units', level: 2, count: 2 }] },
    },
    {
      id: 'exam-standard', title: 'Exam standard', level: 3,
      lessons: [
        {
          id: 'sentences', title: 'Equations from sentences', minutes: 14, level: 3,
          summary: 'Age puzzles, fractions of a year, and patterns in a table: write down what each sentence says.',
          steps: [
            hook('Two sentences, two unknown ages. One equation each.', 'age-puzzle', 1, 3),
            { id: 'one-each', kind: 'slide', title: 'One equation per sentence', text: 'Use today\'s ages as the unknowns. "Was 3 years ago" is age − 3; "in 5 years" is age + 5. Then put one equation into the other.' },
            check('check-1', 'age-puzzle', 2, 3), check('check-2', 'age-puzzle', 5, 3),
            { id: 'fractions', kind: 'slide', title: 'Fractions of a whole', text: 'Turn every fraction into hours of the whole period first. A leap year has 8,784 hours; an ordinary year 8,760.' },
            check('check-3', 'fraction-time', 2, 3),
            { id: 'patterns', kind: 'slide', title: 'A table that keeps going', text: 'Look at how each column grows. If the step between values doubles, keep doubling it to extend the table.' },
            worked('slab-pattern', 5, 3),
            check('check-4', 'slab-pattern', 2, 3),
            practice('age-puzzle', 3),
            check('check-hook', 'age-puzzle', 1, 3),
            { id: 'remember', kind: 'takeaway', body: 'Write each sentence as an equation in today\'s values. Turn fractions into amounts. Extend patterns by their steps.' },
          ],
        },
        {
          id: 'motion', title: 'Speed, trains and walks', minutes: 14, level: 3,
          summary: 'Relative speed for trains passing, and a sketch for people walking.',
          steps: [
            hook('Three trains facts, one unknown time. Relative speed does all the work.', 'relative-speed', 1, 3),
            { id: 'relative', kind: 'slide', title: 'Add or subtract the speeds', text: 'Going opposite ways, two trains close at the sum of their speeds. Going the same way, at the difference. To pass, the gap that closes is the length of what you are watching.' },
            worked('relative-speed', 2, 3),
            check('check-1', 'relative-speed', 4, 3), check('check-2', 'relative-speed', 6, 3),
            { id: 'sketch', kind: 'slide', title: 'Draw the walk', text: 'For walking puzzles, draw the start and each leg. A left turn depends on which way the person is facing. Then use Pythagoras for the straight-line distance.' },
            check('check-3', 'walk-distance', 1, 3), check('check-4', 'walk-distance', 3, 3),
            practice('relative-speed', 3),
            check('check-hook', 'relative-speed', 1, 3),
            { id: 'remember', kind: 'takeaway', body: 'Opposite ways: add speeds. Same way: subtract. Always draw a walk before measuring it.' },
          ],
        },
        {
          id: 'clocks', title: 'Clock hands', minutes: 12, level: 3,
          summary: 'The minute hand gains 5.5° a minute on the hour hand.',
          steps: [
            hook('Both hands move. That is what makes this harder than it looks.', 'clock-hands', 1, 3),
            { id: 'gain', kind: 'slide', title: '5.5° a minute', text: 'The minute hand turns 6° a minute, the hour hand 0.5°. So the minute hand gains 5.5° a minute. At 3:00 the hour hand is 90° ahead.', ...lab('clock'), hint: 'Step the time a minute at a time and watch the angle change by 5.5°.' },
            { id: 'every', kind: 'slide', title: 'Every 65 5/11 minutes', text: 'To catch up a full 360°, the minute hand needs 360 ÷ 5.5 = 720/11 minutes, about 65.45. That is the gap between two meetings, and between two times they point opposite ways.' },
            worked('clock-hands', 2, 3),
            check('check-1', 'clock-hands', 3, 3), check('check-2', 'clock-hands', 5, 3), check('check-3', 'clock-hands', 9, 3),
            practice('clock-hands', 3),
            check('check-hook', 'clock-hands', 1, 3),
            { id: 'remember', kind: 'takeaway', body: 'Angle to gain ÷ 5.5 = minutes. At h o\'clock the hour hand is 30h° ahead.' },
          ],
        },
        {
          id: 'cutting', title: 'Cutting and counting pieces', minutes: 10, level: 3,
          summary: 'Whole pieces from a sheet, and the most pieces a few straight cuts can make.',
          steps: [
            hook('Dividing the areas gives the wrong answer. Pieces must be whole.', 'cut-sheets', 1, 3),
            { id: 'floors', kind: 'slide', title: 'Round down along each side', text: 'Count how many fit along each side, rounding down, and multiply. Then turn the piece round and try again.' },
            check('check-1', 'cut-sheets', 2, 3), check('check-2', 'cut-sheets', 4, 3),
            { id: 'cuts', kind: 'slide', title: 'Each cut adds one more', text: 'A new cut that crosses every earlier cut passes through one more piece than there are cuts before it, and splits each one. The pieces go 2, 4, 7, 11, 16…' },
            check('check-3', 'max-pieces', 4, 3), check('check-4', 'max-pieces', 6, 3),
            practice('cut-sheets', 3),
            check('check-hook', 'cut-sheets', 1, 3),
            { id: 'remember', kind: 'takeaway', body: 'Whole pieces: round down on each side, try both ways. Cuts: the n-th adds n.' },
          ],
        },
      ],
      quiz: { title: 'Exam standard quiz', minutes: 18, pass: 6, marking: 'plain', questions: [{ kind: 'age-puzzle', level: 3, count: 1 }, { kind: 'slab-pattern', level: 3, count: 1 }, { kind: 'fraction-time', level: 3, count: 1 }, { kind: 'relative-speed', level: 3, count: 1 }, { kind: 'walk-distance', level: 3, count: 1 }, { kind: 'clock-hands', level: 3, count: 1 }, { kind: 'cut-sheets', level: 3, count: 1 }, { kind: 'max-pieces', level: 3, count: 1 }] },
    },
    {
      id: 'exam-hard', title: 'Exam hard', level: 4,
      lessons: [
        {
          id: 'rates', title: 'Average speed and volumes', minutes: 14, level: 4,
          summary: 'Average speed is total distance over total time; filling a tank is net volume over net change.',
          steps: [
            hook('The two legs are different lengths at different speeds. The average is not halfway.', 'two-legs', 1, 4),
            { id: 'not-mean', kind: 'slide', title: 'Never the mean of the speeds', text: 'Call the first leg d and its speed x. Write the time for each leg, add them, and divide the whole distance by the whole time.' },
            worked('two-legs', 2, 4),
            check('check-1', 'two-legs', 3, 4), check('check-2', 'two-legs', 5, 4),
            { id: 'net', kind: 'slide', title: 'What each one really adds', text: 'A brick that soaks up water takes up its own volume but removes some water, so the level rises by the difference. Divide the space left by that net amount.' },
            check('check-3', 'displacement', 1, 4), check('check-4', 'displacement', 3, 4),
            practice('two-legs', 4),
            check('check-hook', 'two-legs', 1, 4),
            { id: 'remember', kind: 'takeaway', body: 'Average speed: total distance over total time. Volumes: space left over net change per item.' },
          ],
        },
        {
          id: 'puzzles', title: 'Number puzzles', minutes: 16, level: 4,
          summary: 'Crossing with one umbrella, and a basket pinned down by ratios and limits.',
          steps: [
            hook('Two people at a time, and someone has to bring the umbrella back.', 'crossing', 1, 4),
            { id: 'plans', kind: 'slide', title: 'Two plans to compare', text: 'Either the fastest walks everyone home, or the two slowest go together so their times overlap. Work out both totals and take the smaller.' },
            worked('crossing', 2, 4),
            check('check-1', 'crossing', 3, 4), check('check-2', 'crossing', 5, 4),
            { id: 'multiples', kind: 'slide', title: 'Ratios make multiples', text: 'If rotten apples are twice the good ones, apples come in threes. List the totals that fit every ratio, then use the limits to pick one.' },
            check('check-3', 'basket', 1, 4), check('check-4', 'basket', 2, 4),
            practice('crossing', 4),
            check('check-hook', 'crossing', 1, 4),
            { id: 'remember', kind: 'takeaway', body: 'Compare the two crossing plans. Turn each ratio into a multiple and let the limits choose.' },
          ],
        },
        {
          id: 'step-by-step', title: 'Step by step: procedures, clocks and calendars', minutes: 14, level: 4,
          summary: 'Follow a procedure with a table, add digits over a range, and count days in a cycle.',
          steps: [
            hook('Keep a table: one row per pass through the loop.', 'procedure', 1, 4),
            { id: 'table', kind: 'slide', title: 'A row per pass', text: 'Write x and y after each step. Check the test straight after y changes; that is where most answers go one step too far.' },
            check('check-1', 'procedure', 2, 4), check('check-2', 'procedure', 4, 4),
            { id: 'split', kind: 'slide', title: 'Split the digits', text: 'For a clock, the hour digits show every minute, and the minute digits run 0–9 in the units place and change every ten minutes in the tens place. Add each part separately.' },
            check('check-3', 'clock-digits', 1, 4),
            { id: 'cycle', kind: 'slide', title: 'Count from the restart', text: 'For a daily cycle, only the days since the last restart matter. Divide by the cycle length; the remainder picks the item.' },
            check('check-4', 'calendar-cycle', 1, 4),
            practice('procedure', 4),
            check('check-hook', 'procedure', 1, 4),
            { id: 'remember', kind: 'takeaway', body: 'A table for procedures, parts for digit sums, remainders for cycles.' },
          ],
        },
      ],
      quiz: { title: 'Exam hard quiz', minutes: 20, pass: 5, marking: 'plain', questions: [{ kind: 'two-legs', level: 4, count: 1 }, { kind: 'displacement', level: 4, count: 1 }, { kind: 'crossing', level: 4, count: 1 }, { kind: 'basket', level: 4, count: 1 }, { kind: 'procedure', level: 4, count: 1 }, { kind: 'clock-digits', level: 4, count: 1 }, { kind: 'calendar-cycle', level: 4, count: 1 }, { kind: 'clock-hands', level: 3, count: 1 }] },
    },
    {
      id: 'mastery', title: 'Mastery', level: 5,
      lessons: [
        {
          id: 'review', title: 'Mixed review', minutes: 10, level: 5,
          summary: 'The ways in once more, then mixed practice before the timed set.',
          steps: [
            { id: 'ways-in', kind: 'slide', title: 'The ways in', text: ['Sentences become equations. Speeds add or subtract. Clocks gain 5.5° a minute.', 'Pieces round down. Procedures get a table. Cycles use remainders. Ratios become multiples.'] },
            { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'Typed answers lose nothing when wrong, so always enter a number. If a puzzle is taking more than three minutes, move on and come back.' },
            { id: 'practice-1', kind: 'practice', question: { kind: 'crossing', level: 4 }, streak: 2 },
            { id: 'practice-2', kind: 'practice', question: { kind: 'relative-speed', level: 3 }, streak: 2 },
            { id: 'remember', kind: 'takeaway', body: 'Find the way in first; the arithmetic is the easy part.' },
          ],
        },
      ],
      quiz: { title: 'Timed exam set', minutes: 24, pass: 9, marking: 'uceed', description: 'Twelve number questions at exam pace, marked like UCEED.', questions: [{ kind: 'age-puzzle', level: 3, count: 1 }, { kind: 'slab-pattern', level: 3, count: 1 }, { kind: 'relative-speed', level: 3, count: 1 }, { kind: 'clock-hands', level: 3, count: 1 }, { kind: 'cut-sheets', level: 3, count: 1 }, { kind: 'two-legs', level: 4, count: 1 }, { kind: 'displacement', level: 4, count: 1 }, { kind: 'crossing', level: 4, count: 1 }, { kind: 'basket', level: 4, count: 1 }, { kind: 'procedure', level: 4, count: 1 }, { kind: 'clock-digits', level: 4, count: 1 }, { kind: 'calendar-cycle', level: 4, count: 1 }] },
    },
  ],
});
