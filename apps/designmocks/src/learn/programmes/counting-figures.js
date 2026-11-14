// Counting figures: every triangle, square and rectangle in a drawing of
// straight lines. Specification: docs/learn/topics/counting-figures.md. The
// top tier is set by the owner's shape-counting question bank
// (docs/learn/09-topic-bank-map.md): stars inside polygons, uneven panels,
// figures copied and reflected, and figures with a line missing.
const counter = (...figures) => ({ tool: 'figure-counter', props: { figures } });
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const countingFiguresProgramme = Object.freeze({
  slug: 'counting-figures',
  title: 'Counting figures',
  summary: 'Count every triangle, square and rectangle in a figure, including the big ones made of smaller pieces, without missing or repeating any.',
  topic: 'observation',
  exams: ['uceed', 'ceed', 'nid', 'nift'],
  minutes: 140,
  status: 'preview',
  tiers: [
    {
      id: 'foundations', title: 'Foundations', level: 2,
      lessons: [
        {
          id: 'by-size', title: 'Count by size', minutes: 8, level: 1,
          summary: 'The small shapes are easy to see. The marks are lost on the bigger ones made of several pieces.',
          steps: [
            { id: 'small-first', kind: 'slide', title: 'Smallest first', text: 'Count the smallest squares, then the squares made of four, then of nine. Write one number for each size and add them at the end.', ...counter('grid-2', 'grid-3'), hint: 'Drag Size and step through with the arrows. Watch the tally under the figure.' },
            { id: 'hidden', kind: 'slide', title: 'Big ones hide in plain sight', text: 'The whole outline is a square too. Most wrong answers are right for the small sizes and miss one or two large ones.' },
            check('check-1', 'count-squares', 1, 1), check('check-2', 'count-squares', 3, 1), check('check-3', 'count-squares', 8, 1), check('check-4', 'count-squares', 9, 1),
            { id: 'remember', kind: 'takeaway', body: 'One tally per size, smallest first, then add. Never count by wandering round the figure.' },
          ],
        },
        {
          id: 'rectangles', title: 'Rectangles in a grid', minutes: 8, level: 2,
          summary: 'A rectangle is fixed by its left and right edges and its top and bottom edges.',
          steps: [
            { id: 'choose', kind: 'slide', title: 'Two uprights, two levels', text: 'Pick any two upright lines and any two level lines of the grid. They always close one rectangle, and every rectangle comes from exactly one such choice.', ...counter('grid-3-rect', 'grid-4-rect'), hint: 'Step through the sizes. Long thin rectangles count as well as squares.' },
            { id: 'rule', kind: 'slide', title: 'Multiply the choices', text: 'Four upright lines give 6 pairs; three level lines give 3 pairs. So a grid 3 across and 2 down holds 6 × 3 = 18 rectangles.' },
            check('check-1', 'count-rectangles', 1, 2), check('check-2', 'count-rectangles', 6, 2), check('check-3', 'count-rectangles', 8, 2), check('check-4', 'count-rectangles', 9, 2),
            { id: 'remember', kind: 'takeaway', body: 'Pairs of upright lines × pairs of level lines. Squares are rectangles too.' },
          ],
        },
        {
          id: 'fans', title: 'Triangles from one corner', minutes: 8, level: 2,
          summary: 'Lines fanning out from one corner make a triangle for every pair of them.',
          steps: [
            { id: 'pairs', kind: 'slide', title: 'Any two lines from the top', text: 'Every triangle here uses the top corner and a piece of the base. Choose any two of the lines that leave the top corner and you have one triangle.', ...counter('fan-2', 'fan-3'), hint: 'With two inner lines there are four lines from the top: six pairs, six triangles.' },
            { id: 'diagonals', kind: 'slide', title: 'A square with its diagonals', text: 'Two diagonals cut a square into four small triangles. Two neighbours join into a bigger one, four ways. That makes eight.', ...counter('star-1', 'star-2'), hint: 'Add the midlines and count again by size.' },
            check('check-1', 'count-triangles', 1, 2), check('check-2', 'count-triangles', 6, 2), check('check-3', 'count-triangles', 8, 2), check('check-4', 'count-triangles', 9, 2),
            { id: 'remember', kind: 'takeaway', body: 'Lines from one corner: count pairs of lines. Everything else: count by size.' },
          ],
        },
      ],
      quiz: { title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain', questions: [{ kind: 'count-squares', level: 1, count: 2 }, { kind: 'count-rectangles', level: 2, count: 3 }, { kind: 'count-triangles', level: 2, count: 3 }] },
    },
    {
      id: 'exam-standard', title: 'Exam standard', level: 3,
      lessons: [
        {
          id: 'layered-triangles', title: 'Fans with cross lines', minutes: 12, level: 3,
          summary: 'A bar across a fan makes a second, smaller fan above it. Both must be counted.',
          steps: [
            hook('Type your count. Then see how many you missed and where they were hiding.', 'count-triangles', 4, 3),
            { id: 'bars', kind: 'slide', title: 'Each bar is another base', text: 'A line across the fan is the base of a smaller copy of the whole fan. With one bar there are two bases, so twice as many triangles as the plain fan.', ...counter('fan-bars', 'fan-bars-2'), hint: 'Step through the sizes and notice which base each triangle stands on.' },
            { id: 'rows', kind: 'slide', title: 'Rows of small triangles', text: 'In a triangle cut into rows, count upright triangles and upside-down triangles separately, each by size. The upside-down ones are the ones people miss.', ...counter('tri-3', 'tri-4'), hint: 'Three rows hold 13. Find the three upside-down ones.' },
            worked('count-triangles', 7, 3),
            check('check-1', 'count-triangles', 1, 3), check('check-2', 'count-triangles', 17, 3), check('check-3', 'count-triangles', 22, 3),
            practice('count-triangles', 3),
            check('check-hook', 'count-triangles', 4, 3),
            { id: 'remember', kind: 'takeaway', body: 'Each cross line is a new base. In rows, count upright and upside-down separately.' },
          ],
        },
        {
          id: 'tilted', title: 'Tilted squares and uneven panels', minutes: 12, level: 3,
          summary: 'Squares standing on a corner, and rectangles in a figure that is not a tidy grid.',
          steps: [
            hook('Not every square here has level sides.', 'count-squares', 5, 3),
            { id: 'diamond', kind: 'slide', title: 'Turn your head', text: 'A square standing on its corner is still a square. Where diagonals are drawn, look for squares at 45° as well as upright ones.', ...counter('tilted-squares'), hint: 'Step through every size. Some sizes hold both upright and tilted squares.' },
            { id: 'panels', kind: 'slide', title: 'When the lines stop short', text: 'If lines stop part-way, the grid rule fails. Go back to counting by size: single panels, then pairs that share a full side, then threes.', ...counter('bricks'), hint: 'Two panels join into a rectangle only if their shared side is the same length on both.' },
            worked('count-rectangles', 3, 3),
            check('check-1', 'count-rectangles', 6, 3), check('check-2', 'count-squares', 6, 3), check('check-3', 'count-rectangles', 10, 3),
            practice('count-rectangles', 3),
            check('check-hook', 'count-squares', 5, 3),
            { id: 'remember', kind: 'takeaway', body: 'Look for tilted squares wherever there are diagonals. When lines stop short, count by size, not by rule.' },
          ],
        },
        {
          id: 'missing-lines', title: 'When a line is missing', minutes: 12, level: 3,
          summary: 'One short line rubbed out removes every shape that used it, large and small.',
          steps: [
            hook('Only one short line is gone. More than one shape went with it.', 'count-missing', 1, 3),
            { id: 'used', kind: 'slide', title: 'Which shapes used that line?', text: 'A line is a side of the small shape next to it, and part of a side of every bigger shape that ran along it. All of them are gone.' },
            { id: 'recount', kind: 'slide', title: 'Count what is left', text: 'The safest way is to count the figure as it now stands, by size. If you know the full count, the difference is what was lost.' },
            worked('count-missing', 3, 3),
            check('check-1', 'count-missing', 5, 3), check('check-2', 'count-missing', 2, 3), check('check-3', 'count-missing', 11, 3),
            practice('count-missing', 3),
            check('check-hook', 'count-missing', 1, 3),
            { id: 'remember', kind: 'takeaway', body: 'A missing line removes every shape that ran along it. Recount by size.' },
          ],
        },
      ],
      quiz: { title: 'Exam standard quiz', minutes: 16, pass: 6, marking: 'plain', questions: [{ kind: 'count-triangles', level: 3, count: 3 }, { kind: 'count-squares', level: 3, count: 1 }, { kind: 'count-rectangles', level: 3, count: 2 }, { kind: 'count-missing', level: 3, count: 2 }] },
    },
    {
      id: 'exam-hard', title: 'Exam hard', level: 4,
      lessons: [
        {
          id: 'stars', title: 'Stars and crossing diagonals', minutes: 14, level: 4,
          summary: 'A star inside a pentagon, a square with every line drawn: thirty or forty triangles of five or six sizes.',
          steps: [
            hook('This is the size the exam sets. Expect a count in the thirties or forties.', 'count-triangles', 1, 4),
            { id: 'sizes', kind: 'slide', title: 'Name each size before you count it', text: 'Find one triangle of each size first: the tiny points, the kites cut in half, the long thin ones, the big ones across the whole figure. Then count how many times each repeats round the figure.', ...counter('pentagon', 'star-3'), hint: 'A pentagon repeats everything five times. Each size should give 5 or 10.' },
            { id: 'symmetry', kind: 'slide', title: 'Use the symmetry', text: 'If the figure looks the same from five corners, every kind of triangle appears five times, or ten when it has a mirror twin. A count like 7 for one size means one is missing.' },
            worked('count-triangles', 3, 4),
            check('check-1', 'count-triangles', 7, 4), check('check-2', 'count-triangles', 8, 4), check('check-3', 'count-triangles', 16, 4), check('check-4', 'count-triangles', 12, 4),
            practice('count-triangles', 4),
            check('check-hook', 'count-triangles', 1, 4),
            { id: 'remember', kind: 'takeaway', body: 'One example of each size first. Then multiply by how often the figure repeats.' },
          ],
        },
        {
          id: 'reflected', title: 'Copy, reflect, join', minutes: 14, level: 4,
          summary: 'A figure is mirrored onto itself. The answer is never just double.',
          steps: [
            hook('The figure is small. The joined figure holds more than twice as many shapes.', 'count-joined', 1, 4),
            { id: 'draw', kind: 'slide', title: 'Draw the result first', text: 'Sketch the mirrored copy beside the figure. The line they share is still one line, and lines that meet it from both sides may now run straight through.', ...counter('half-square', 'joined-square'), hint: 'Compare the count for one half with the count for the joined figure.' },
            { id: 'across', kind: 'slide', title: 'Three groups', text: 'Count the shapes inside the left half, the shapes inside the right half, and the new shapes that cross the join. The third group is the whole question.' },
            worked('count-joined', 3, 4),
            check('check-1', 'count-joined', 5, 4), check('check-2', 'count-joined', 12, 4), check('check-3', 'count-joined', 4, 4),
            practice('count-joined', 4),
            check('check-hook', 'count-joined', 1, 4),
            { id: 'remember', kind: 'takeaway', body: 'Twice one half, plus everything that crosses the join. Draw it; do not imagine it.' },
          ],
        },
        {
          id: 'panels-and-slants', title: 'Uneven panels and parallelograms', minutes: 12, level: 4,
          summary: 'Eight or more panels of different sizes, sometimes slanted, with twenty or more shapes to find.',
          steps: [
            hook('The same figure as brickwork, pushed over. Count parallelograms exactly as you would rectangles.', 'count-rectangles', 3, 4),
            { id: 'slant', kind: 'slide', title: 'Slanted is the same', text: 'Pushing a figure sideways turns every rectangle into a parallelogram and loses none. Count as before: singles, then pairs sharing a full side, then larger groups.', ...counter('slanted', 'bricks'), hint: 'Both figures here have the same kind of structure. Step through the sizes.' },
            { id: 'order', kind: 'slide', title: 'Keep an order', text: 'Work from the top-left panel. For each panel, count the shapes that have it as their top-left piece. Each shape is then counted once and only once.' },
            worked('count-rectangles', 1, 4),
            check('check-1', 'count-rectangles', 5, 4), check('check-2', 'count-rectangles', 9, 4), check('check-3', 'count-rectangles', 10, 4),
            practice('count-rectangles', 4),
            check('check-hook', 'count-rectangles', 3, 4),
            { id: 'remember', kind: 'takeaway', body: 'Give every shape one home panel, its top-left piece, and count panel by panel.' },
          ],
        },
        {
          id: 'exactly-n', title: 'Exactly n, and two lines gone', minutes: 12, level: 4,
          summary: 'Pick every figure with a given count, and recount a large figure with two pieces missing.',
          steps: [
            hook('More than one figure may be right. Count them all.', 'figure-with-n', 4, 4),
            { id: 'estimate', kind: 'slide', title: 'Estimate, then count the close ones', text: 'A quick look rules out figures that are far too simple or far too busy. The ones near the target need a full count by size.' },
            check('check-1', 'figure-with-n', 1, 4), check('check-2', 'figure-with-n', 8, 4),
            { id: 'two-gone', kind: 'slide', title: 'Two lines gone', text: 'With two pieces missing, some shapes used both. Subtracting twice counts those twice, so recount the figure as it stands.' },
            worked('count-missing', 1, 4),
            check('check-3', 'count-missing', 5, 4), check('check-4', 'count-missing', 8, 4),
            practice('count-missing', 4),
            check('check-hook', 'figure-with-n', 4, 4),
            { id: 'remember', kind: 'takeaway', body: 'In select-all, count every option. With lines missing, recount; do not subtract.' },
          ],
        },
      ],
      quiz: { title: 'Exam hard quiz', minutes: 20, pass: 5, marking: 'plain', questions: [{ kind: 'count-triangles', level: 4, count: 3 }, { kind: 'count-joined', level: 4, count: 2 }, { kind: 'count-rectangles', level: 4, count: 1 }, { kind: 'figure-with-n', level: 4, count: 1 }, { kind: 'count-missing', level: 4, count: 1 }] },
    },
    {
      id: 'mastery', title: 'Mastery', level: 5,
      lessons: [
        {
          id: 'review', title: 'Mixed review', minutes: 10, level: 5,
          summary: 'The method once more, then mixed practice before the timed set.',
          steps: [
            { id: 'method', kind: 'slide', title: 'The method', text: 'Count by size, smallest first, one tally per size. Use a rule only for a clean grid or a fan. Check each tally against the symmetry of the figure.' },
            { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'Under two minutes a question. Typed answers lose nothing when wrong, so always enter a count. If two counts disagree, the larger is usually right: shapes get missed far more often than invented.' },
            { id: 'practice-1', kind: 'practice', question: { kind: 'count-triangles', level: 4 }, streak: 2 },
            { id: 'practice-2', kind: 'practice', question: { kind: 'count-joined', level: 4 }, streak: 2 },
            { id: 'remember', kind: 'takeaway', body: 'A tally per size, on paper. The big shapes are where the marks are.' },
          ],
        },
      ],
      quiz: { title: 'Timed exam set', minutes: 20, pass: 9, marking: 'uceed', description: 'Twelve counting questions at exam pace, marked like UCEED.', questions: [{ kind: 'count-triangles', level: 3, count: 2 }, { kind: 'count-rectangles', level: 3, count: 1 }, { kind: 'count-missing', level: 3, count: 1 }, { kind: 'count-triangles', level: 4, count: 3 }, { kind: 'count-joined', level: 4, count: 2 }, { kind: 'count-rectangles', level: 4, count: 1 }, { kind: 'figure-with-n', level: 4, count: 2 }] },
    },
  ],
});
