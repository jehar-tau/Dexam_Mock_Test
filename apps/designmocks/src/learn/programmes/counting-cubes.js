// Counting cubes: the reference programme. It shows the full climb every
// programme must make: Foundations, Exam standard, Exam hard and Mastery.
// Specification: docs/learn/topics/counting-cubes.md.
//
// Lesson anatomy above Foundations: hook (an exam-style problem, unmarked),
// technique slides with the tool, a worked example, checks with hints,
// practice to a streak of three, the hook again as a check, a take-away.
const tool = (props = {}) => ({ tool: 'stack-builder', props });
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });

export const countingCubesProgramme = Object.freeze({
  slug: 'counting-cubes',
  title: 'Counting cubes',
  summary: 'Count every cube in a stack, the ones you cannot see, the ones with paint on them, and the fewest and most that fit three views.',
  topic: 'visualisation',
  exams: ['uceed', 'ceed', 'nid', 'nift'],
  minutes: 150,
  status: 'preview',
  tiers: [
    {
      id: 'foundations', title: 'Foundations', level: 2,
      lessons: [
        {
          id: 'columns', title: 'Count by columns', minutes: 10, level: 1,
          summary: 'Every column stands on the floor with no gaps, so add up the column heights.',
          steps: [
            { id: 'floor', kind: 'slide', title: 'Stacks stand in columns', text: 'A stack of cubes sits on a floor. Each column is a pile with no gaps, so the stack is just a list of column heights.', ...tool(), hint: 'Tap a square on the plan to change its height. Hover to see the column.' },
            { id: 'behind', kind: 'slide', title: 'Columns behind still count', text: ['A short column behind a tall one may be completely hidden in the drawing. It still counts.', 'Read the drawing as a floor plan: how many columns, and how tall is each? Then add.'] },
            check('check-1', 'count-cubes', 111, 1), check('check-2', 'count-cubes', 112, 1),
            check('check-3', 'count-cubes', 113, 1), check('check-4', 'count-cubes', 114, 1),
            { id: 'remember', kind: 'takeaway', body: 'List the column heights, including columns hidden behind taller ones, and add them.' },
          ],
        },
        {
          id: 'hidden', title: 'Hidden cubes', minutes: 10, level: 2,
          summary: 'A cube is fully hidden when each of its three facing sides is covered by another cube.',
          steps: [
            { id: 'three-sides', kind: 'slide', title: 'Three sides to cover', text: 'From the corner view you can see a cube only through its top, its front-left side or its front-right side. When the cube above, the cube to the front-left and the cube to the front-right are all present, the cube is hidden.', ...tool({ initial: [[3, 3, 2], [3, 3, 2], [2, 2, 1]] }), hint: 'The status line counts hidden cubes as you build.' },
            { id: 'method', kind: 'slide', title: 'Check the bottom layers', text: 'Only cubes below the top of their column can be hidden. For each one, look at the two neighbouring columns in front: both must reach at least as high as that cube.' },
            check('check-1', 'count-hidden', 121, 2), check('check-2', 'count-hidden', 122, 2), check('check-3', 'count-hidden', 123, 2),
            { id: 'remember', kind: 'takeaway', body: 'Hidden means covered above, front-left and front-right. Check cubes below the top of their column, one by one.' },
          ],
        },
        {
          id: 'box', title: 'Filling the block', minutes: 10, level: 2,
          summary: 'How many cubes complete the stack into a solid block?',
          steps: [
            { id: 'block', kind: 'slide', title: 'The full block', text: 'A solid block as tall as the tallest column has floor squares × tallest height cubes. Subtract the cubes already there to find how many are missing.' },
            check('check-1', 'count-box', 131, 2), check('check-2', 'count-box', 132, 2), check('check-3', 'count-box', 133, 2),
            { id: 'remember', kind: 'takeaway', body: 'Missing cubes = floor squares × tallest column − cubes present.' },
          ],
        },
      ],
      quiz: {
        title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain',
        questions: [{ kind: 'count-cubes', level: 1, count: 4 }, { kind: 'count-hidden', level: 2, count: 2 }, { kind: 'count-box', level: 2, count: 2 }],
      },
    },
    {
      id: 'exam-standard', title: 'Exam standard', level: 3,
      lessons: [
        {
          id: 'layers', title: 'Bigger stacks, layer by layer', minutes: 12, level: 3,
          summary: 'Sixteen columns and no plan to read: count each layer from the top down and type the total.',
          steps: [
            { id: 'hook', kind: 'hook', text: 'No options to choose from this time. Have a go, then we will build a method that never misses a cube.', question: { kind: 'count-cubes', seed: 3, level: 3 } },
            { id: 'slices', kind: 'slide', title: 'Slice it into layers', text: 'Think of the stack as flat layers. The top layer is small and easy. Each layer below holds every cube of the layer above, plus more.', ...tool({ size: 4, layers: true }), hint: 'Drag the Layers slider down to lift off the upper layers.' },
            { id: 'grows', kind: 'slide', title: 'Layers only grow downward', text: 'A cube cannot float, so every cube stands on one in the layer beneath. If your count for a lower layer is smaller than the layer above it, you have missed some.' },
            { id: 'worked-1', kind: 'worked', question: { kind: 'count-cubes', seed: 6, level: 3 } },
            { id: 'slip', kind: 'slide', title: 'The commonest slip', text: 'Counting only the cubes you can see. Cubes under and behind others are still there. The layer count catches them because it never looks at faces, only at columns.' },
            check('check-1', 'count-cubes', 1, 3), check('check-2', 'count-cubes', 12, 3), check('check-3', 'count-cubes', 13, 3),
            { id: 'practice', kind: 'practice', question: { kind: 'count-cubes', level: 3 }, streak: 3 },
            check('check-hook', 'count-cubes', 3, 3),
            { id: 'remember', kind: 'takeaway', body: 'Count layer by layer from the top. A lower layer is never smaller than the one above it.' },
          ],
        },
        {
          id: 'painted-block', title: 'Painted blocks', minutes: 12, level: 3,
          summary: 'A painted block is cut into small cubes. Sort them into corners, edges, faces and inside.',
          steps: [
            { id: 'hook', kind: 'hook', text: 'This looks like a lot of counting. It is really four small sums.', question: { kind: 'painted-count', seed: 10, level: 3 } },
            { id: 'corners', kind: 'slide', title: 'Corners: always eight', text: 'A corner cube shows three faces to the outside, so it gets three painted faces. Every block has eight corners, whatever its size.' },
            { id: 'edges', kind: 'slide', title: 'Edges: two faces', text: 'Cubes along an edge, between the corners, show two faces. An edge that is n cubes long has n − 2 of them. A block has four edges in each of its three directions.' },
            { id: 'faces-inside', kind: 'slide', title: 'Faces and inside', text: ['Cubes in the middle of a face show one face. Cubes fully inside show none.', 'To step inside the paint, take 2 off every side length.'], ...tool({ initial: [[3, 3, 3], [3, 3, 3], [3, 3, 3]], paint: true }), hint: 'This is a 3 × 3 × 3 block. Change it and watch the unpainted faces.' },
            { id: 'worked-1', kind: 'worked', question: { kind: 'painted-count', seed: 5, level: 3 } },
            check('check-1', 'painted-count', 2, 3), check('check-2', 'painted-count', 3, 3),
            check('check-3', 'painted-count', 11, 3), check('check-4', 'painted-count', 14, 3),
            { id: 'practice', kind: 'practice', question: { kind: 'painted-count', level: 3 }, streak: 3 },
            check('check-hook', 'painted-count', 10, 3),
            { id: 'remember', kind: 'takeaway', body: 'Corners 3 faces (always 8). Edges 2. Face middles 1. Inside 0: take 2 off each side and multiply.' },
          ],
        },
        {
          id: 'hidden-touching', title: 'Hidden and touching', minutes: 12, level: 3,
          summary: 'Count hidden cubes in a large stack, and the cubes that share a face with a marked cube.',
          steps: [
            { id: 'hook', kind: 'hook', text: 'Hidden cubes add up quickly in a big stack. We will count them one layer at a time.', question: { kind: 'count-hidden', seed: 5, level: 3 } },
            { id: 'by-layer', kind: 'slide', title: 'Hidden cubes, layer by layer', text: 'In each layer, a cube is hidden when its own column goes higher and both columns in front reach that layer too. Work up from the floor.', ...tool({ size: 4, layers: true }), hint: 'Use the Layers slider to look at one layer at a time.' },
            { id: 'worked-1', kind: 'worked', question: { kind: 'count-hidden', seed: 10, level: 3 } },
            check('check-1', 'count-hidden', 1, 3), check('check-2', 'count-hidden', 8, 3),
            { id: 'touching', kind: 'slide', title: 'Sharing a face', text: 'Two cubes touch properly only when they share a whole face. Check six places: above, below and the four sides. A neighbouring column counts only if it reaches the level of your cube.' },
            { id: 'worked-2', kind: 'worked', question: { kind: 'touch-count', seed: 9, level: 3 } },
            check('check-3', 'touch-count', 2, 3), check('check-4', 'touch-count', 10, 3),
            { id: 'practice', kind: 'practice', question: { kind: 'touch-count', level: 3 }, streak: 3 },
            check('check-hook', 'count-hidden', 5, 3),
            { id: 'remember', kind: 'takeaway', body: 'Hidden: covered above and on both front sides, counted layer by layer. Touching: whole faces only, six places to check.' },
          ],
        },
      ],
      quiz: {
        title: 'Exam standard quiz', minutes: 16, pass: 6, marking: 'plain',
        questions: [{ kind: 'count-cubes', level: 3, count: 2 }, { kind: 'painted-count', level: 3, count: 3 }, { kind: 'count-hidden', level: 3, count: 1 }, { kind: 'touch-count', level: 3, count: 2 }],
      },
    },
    {
      id: 'exam-hard', title: 'Exam hard', level: 4,
      lessons: [
        {
          id: 'views-most', title: 'Three views: the most cubes', minutes: 12, level: 4,
          summary: 'Only the top, front and side views are given. Find the largest stack that fits all three.',
          steps: [
            { id: 'hook', kind: 'hook', text: 'There is no stack to look at, only three flat views. Have a go before we take it apart.', question: { kind: 'views-max', seed: 4, level: 4 } },
            { id: 'what-views-fix', kind: 'slide', title: 'What each view tells you', text: 'The top view shows which floor squares are used. The front view shows how tall the tallest column is in each line going back. The side view does the same, seen from the right.', ...tool({ showViews: true }), hint: 'Change the stack and watch the three views. Many different stacks give the same views.' },
            { id: 'smaller-of-two', kind: 'slide', title: 'The smaller of two heights', text: 'Each floor square sits in one column of the front view and one column of the side view. It cannot be taller than either. For the most cubes, raise every square to the smaller of the two.' },
            { id: 'worked-1', kind: 'worked', question: { kind: 'views-max', seed: 1, level: 4 } },
            check('check-1', 'views-max', 6, 4), check('check-2', 'views-max', 9, 4), check('check-3', 'views-max', 12, 4),
            { id: 'practice', kind: 'practice', question: { kind: 'views-max', level: 4 }, streak: 3 },
            check('check-hook', 'views-max', 4, 4),
            { id: 'remember', kind: 'takeaway', body: 'Most cubes: for every floor square take the smaller of its front height and its side height, then add.' },
          ],
        },
        {
          id: 'views-fewest', title: 'Three views: the fewest cubes', minutes: 14, level: 4,
          summary: 'The classic hard question: the smallest stack that still shows the same three views.',
          steps: [
            { id: 'hook', kind: 'hook', text: 'Most students answer with the largest stack. The smallest takes one more idea.', question: { kind: 'views-min', seed: 2, level: 4 } },
            { id: 'one-each', kind: 'slide', title: 'Start with one cube everywhere', text: 'Every floor square in the top view needs at least one cube. That is your starting count.' },
            { id: 'towers', kind: 'slide', title: 'Then build only the towers you must', text: 'Each column of the front view needs just one tower of its full height. So does each column of the side view. Every other square can stay at one cube.' },
            { id: 'sharing', kind: 'slide', title: 'One tower can serve both views', text: 'Where a front column and a side column of the same height cross on a used floor square, one tower there satisfies both. Share whenever you can.', ...tool({ showViews: true, initial: [[3, 1, 1], [1, 1, 1], [1, 1, 3]] }), hint: 'Both towers here are needed. Move one and see whether the views still match.' },
            { id: 'worked-1', kind: 'worked', question: { kind: 'views-min', seed: 3, level: 4 } },
            { id: 'worked-2', kind: 'worked', question: { kind: 'views-min', seed: 1, level: 4 } },
            check('check-1', 'views-min', 5, 4), check('check-2', 'views-min', 8, 4),
            check('check-3', 'views-min', 12, 4), check('check-4', 'views-min', 13, 4),
            { id: 'practice', kind: 'practice', question: { kind: 'views-min', level: 4 }, streak: 3 },
            check('check-hook', 'views-min', 2, 4),
            { id: 'remember', kind: 'takeaway', body: 'Fewest cubes: one per floor square, plus one tower for each front column and each side column, sharing a tower wherever equal heights cross.' },
          ],
        },
        {
          id: 'painted-stack', title: 'Painted stacks and missing cubes', minutes: 12, level: 4,
          summary: 'A whole stack is painted and pulled apart; a block has cubes taken out. Count what is hidden and what is gone.',
          steps: [
            { id: 'hook', kind: 'hook', text: 'Do not count painted faces one by one. Count where cubes touch.', question: { kind: 'painted-stack', seed: 6, level: 4 } },
            { id: 'touching-hides', kind: 'slide', title: 'Paint misses only what is covered', text: 'A face stays bare only where it presses against another cube, or against the table if the stack was standing when painted. Each pair of touching cubes hides two faces.', ...tool({ paint: true }), hint: 'Add a cube and watch how many faces lose their paint.' },
            { id: 'read-the-floor', kind: 'slide', title: 'Read the question for the floor', text: 'Painted "on every face, including underneath" means the bottom is painted. Painted "standing on a table" means every cube on the floor keeps one bare face.' },
            { id: 'worked-1', kind: 'worked', question: { kind: 'painted-stack', seed: 3, level: 4 } },
            check('check-1', 'painted-stack', 2, 4), check('check-2', 'painted-stack', 7, 4),
            { id: 'missing', kind: 'slide', title: 'Cubes taken from a block', text: 'When cubes are removed from a solid block, count the gaps layer by layer from the top and subtract from the full block. If nothing hidden was removed, every gap is one you can see into.' },
            { id: 'worked-2', kind: 'worked', question: { kind: 'removed-visible', seed: 7, level: 4 } },
            check('check-3', 'removed-visible', 4, 4), check('check-4', 'removed-visible', 12, 4),
            { id: 'practice', kind: 'practice', question: { kind: 'painted-stack', level: 4 }, streak: 3 },
            check('check-hook', 'painted-stack', 6, 4),
            { id: 'remember', kind: 'takeaway', body: 'Unpainted faces = 2 for every touching pair, plus the faces on the table if it stood there. Missing cubes: count gaps by layer and subtract.' },
          ],
        },
      ],
      quiz: {
        title: 'Exam hard quiz', minutes: 20, pass: 5, marking: 'plain',
        questions: [{ kind: 'views-max', level: 4, count: 2 }, { kind: 'views-min', level: 4, count: 3 }, { kind: 'painted-stack', level: 4, count: 2 }, { kind: 'removed-visible', level: 4, count: 1 }],
      },
    },
    {
      id: 'mastery', title: 'Mastery', level: 5,
      lessons: [
        {
          id: 'review', title: 'Mixed review', minutes: 15, level: 5,
          summary: 'Every routine in one place, then mixed practice before the timed set.',
          steps: [
            { id: 'routines', kind: 'slide', title: 'Six routines', text: ['Layers from the top for a total. Three covered sides for hidden cubes. Six places for touching. Corners, edges, faces and inside for a painted block.', 'From views: the smaller of two heights for the most, shared towers for the fewest. For paint on a stack: two faces per touching pair.'] },
            { id: 'pace', kind: 'slide', title: 'Exam pace', text: 'The timed set gives you two minutes a question and marks like the real paper: +4 for a correct number and nothing lost for a wrong one. So always type an answer.' },
            { id: 'practice-1', kind: 'practice', question: { kind: 'painted-count', level: 3 }, streak: 3 },
            { id: 'practice-2', kind: 'practice', question: { kind: 'views-min', level: 4 }, streak: 3 },
            { id: 'practice-3', kind: 'practice', question: { kind: 'painted-stack', level: 4 }, streak: 3 },
            { id: 'remember', kind: 'takeaway', body: 'Name the routine before you count. Most lost marks come from starting to count before deciding how.' },
          ],
        },
      ],
      quiz: {
        title: 'Timed exam set', minutes: 24, pass: 9, marking: 'uceed',
        description: 'Twelve numerical questions at exam pace, marked like UCEED.',
        questions: [
          { kind: 'count-cubes', level: 3, count: 2 }, { kind: 'count-hidden', level: 3, count: 1 }, { kind: 'painted-count', level: 3, count: 2 }, { kind: 'touch-count', level: 3, count: 1 },
          { kind: 'views-max', level: 4, count: 2 }, { kind: 'views-min', level: 4, count: 2 }, { kind: 'painted-stack', level: 4, count: 1 }, { kind: 'removed-visible', level: 4, count: 1 },
        ],
      },
    },
  ],
});
