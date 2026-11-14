// Nets of solids: the top of the folding ladder. Cube nets teaches the rules
// on a cube; this applies them to solids with many faces of different
// shapes, which is the level the exam sets (docs/learn/08-owner-reference-standard.md).
// Specification: docs/learn/topics/nets-of-solids.md.
const unfolder = (choices, seed = 3) => ({ tool: 'unfolder', props: { choices, seed } });
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });

export const netsOfSolidsProgramme = Object.freeze({
  slug: 'nets-of-solids',
  title: 'Nets of solids',
  summary: 'Fold and unfold solids with many faces: prisms, stepped blocks, joined prisms, rounded ends, striped boxes, sliced corners and solids built from cubes.',
  topic: 'visualisation',
  exams: ['uceed', 'ceed'],
  minutes: 146,
  status: 'preview',
  tiers: [
    {
      id: 'foundations', title: 'Foundations', level: 2,
      lessons: [
        {
          id: 'count-sort', title: 'Count and sort the faces', minutes: 8, level: 1,
          summary: 'Before any folding, know what the solid is made of: how many faces, and how many of each shape.',
          steps: [
            { id: 'not-a-cube', kind: 'slide', title: 'Not every solid is a cube', text: 'A net is every face of a solid laid flat. A cube has six equal squares. Most solids have faces of different shapes, and that is what makes their nets harder and more interesting.', ...unfolder(['box', 'wedge', 'pyramid', 'ell']), hint: 'Pick a solid. Drag Fold to open it out flat and close it again.' },
            { id: 'sort', kind: 'slide', title: 'Sort before you fold', text: 'Count the faces by shape: so many rectangles, so many triangles. A net that has the wrong number of any shape is wrong, and you never need to fold it.' },
            check('check-1', 'face-inventory', 1, 1), check('check-2', 'face-inventory', 4, 1),
            check('check-3', 'face-inventory', 6, 1), check('check-4', 'face-inventory', 9, 1),
            { id: 'remember', kind: 'takeaway', body: 'Count and sort first. Faces underneath and behind count. A net with the wrong mix of shapes is out at once.' },
          ],
        },
        {
          id: 'prisms', title: 'A belt and two ends', minutes: 10, level: 2,
          summary: 'A prism is a strip of side faces wrapped round two matching end faces.',
          steps: [
            { id: 'belt', kind: 'slide', title: 'The belt', text: 'Push a flat shape straight back and you get a prism. Its side faces wrap round it like a belt, and they unroll into one strip of rectangles.', ...unfolder(['wedge', 'box', 'ell']), hint: 'Tap the faces of the net. The belt faces are side faces; the other two are end faces.' },
            { id: 'ends', kind: 'slide', title: 'Two ends, one on each side', text: 'The two end faces are the same shape. Each one joins the belt along one of its own sides, and the two ends sit on opposite sides of the strip. A pyramid is different: its triangles all meet the base.' },
            check('check-1', 'prism-net', 2, 2), check('check-2', 'prism-net', 5, 2),
            check('check-3', 'prism-net', 7, 2), check('check-4', 'prism-net', 11, 2),
            { id: 'remember', kind: 'takeaway', body: 'A prism is a belt of rectangles with an end face on each side of it. Find the belt first.' },
          ],
        },
      ],
      quiz: { title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain', questions: [{ kind: 'face-inventory', level: 1, count: 3 }, { kind: 'prism-net', level: 2, count: 5 }] },
    },
    {
      id: 'exam-standard', title: 'Exam standard', level: 3,
      lessons: [
        {
          id: 'edges', title: 'Edges that must match', minutes: 12, level: 3,
          summary: 'Blocks with unequal sides and stepped ends: the belt has segments of different lengths, in a fixed order.',
          steps: [
            { id: 'hook', kind: 'hook', text: 'The four nets look almost the same. One face is in a different place in each. We will find a way to tell without folding every one.', question: { kind: 'net-of-solid', seed: 9, level: 3 } },
            { id: 'order', kind: 'slide', title: 'The belt follows the outline', text: 'Walk round the outline of the end face. Each side you pass is one segment of the belt, in the same order and the same length. A long side gives a long segment.', ...unfolder(['ell', 'tee', 'stairs']), hint: 'Tap a belt segment, then find the side of the end face it matches.' },
            { id: 'belt-sum', kind: 'slide', title: 'How long is the belt?', text: 'The whole strip is as long as the outline of the end face. Its width is the depth of the solid.' },
            check('check-1', 'belt-length', 2, 3), check('check-2', 'belt-length', 5, 3),
            { id: 'match', kind: 'slide', title: 'An end face joins its own side', text: 'An end face can only join the belt along a segment as long as one of its sides, and it must be the right side. The same length in the wrong place builds a solid that does not close.' },
            { id: 'worked-1', kind: 'worked', question: { kind: 'net-of-solid', seed: 5, level: 3 } },
            check('check-3', 'net-of-solid', 3, 3), check('check-4', 'net-of-solid', 13, 3), check('check-5', 'net-of-solid', 10, 3),
            { id: 'practice', kind: 'practice', question: { kind: 'net-of-solid', level: 3 }, streak: 3 },
            check('check-hook', 'net-of-solid', 9, 3),
            { id: 'remember', kind: 'takeaway', body: 'The belt copies the outline of the end face, side by side, in order. An end face joins the belt only along its own matching side.' },
          ],
        },
        {
          id: 'cube-built', title: 'Solids built from cubes', minutes: 12, level: 3,
          summary: 'When cubes are joined, faces in the same plane merge into bigger shapes.',
          steps: [
            { id: 'hook', kind: 'hook', text: 'This solid is only a few cubes, yet it has many more faces than a cube, and they are not all squares.', question: { kind: 'net-of-solid', seed: 7, level: 3 } },
            { id: 'merge', kind: 'slide', title: 'Faces merge', text: 'Two cubes side by side share one face, which disappears, and their tops join into one rectangle. So a solid built from cubes has rectangles and L-shapes among its faces, not only squares.', ...unfolder(['cubes']), hint: 'Tap each face of the net and read its shape below.' },
            { id: 'big-first', kind: 'slide', title: 'Start from the biggest face', text: 'Find the largest face on the solid and find it in each net. Then check its neighbours one edge at a time: the face across each edge must be the right shape, the right way round.' },
            { id: 'worked-1', kind: 'worked', question: { kind: 'net-of-solid', seed: 12, level: 3 } },
            check('check-1', 'net-of-solid', 15, 3), check('check-2', 'net-of-solid', 19, 3), check('check-3', 'net-of-solid', 8, 3),
            { id: 'practice', kind: 'practice', question: { kind: 'net-of-solid', level: 3 }, streak: 3 },
            check('check-hook', 'net-of-solid', 7, 3),
            { id: 'remember', kind: 'takeaway', body: 'Joined cubes merge their faces. Find the biggest face, then check each neighbour across each edge.' },
          ],
        },
        {
          id: 'stripes', title: 'Patterns across folds', minutes: 12, level: 3,
          summary: 'A box with stripes painted round it. The stripes must join up across every edge when the net is folded.',
          steps: [
            { id: 'hook', kind: 'hook', text: 'All four nets are the same shape, so counting faces will not help. Only the stripes differ, and only on a face or two.', question: { kind: 'patterned-cuboid', seed: 4, level: 3 } },
            { id: 'round', kind: 'slide', title: 'A stripe goes right round', text: 'A stripe painted round a box crosses four faces in a row and misses the two faces it runs parallel to. Open the box out and the stripe is cut into four pieces, one on each of those faces.', ...unfolder(['stripes']), hint: 'Drag Fold slowly and watch the pieces of each stripe come together at the edges.' },
            { id: 'meet', kind: 'slide', title: 'Same point on both sides', text: 'Where a stripe crosses a fold line, it must leave one face and enter the next at the same point. Measure from the same corner on both sides. A stripe 1 from the corner on one face and 3 from it on the next cannot join.' },
            { id: 'cut-edges', kind: 'slide', title: 'Cut edges meet too', text: ['Some edges that touch on the box are cut apart in the net. The stripe has to match there as well.', 'When a stripe runs along a fold and never crosses it, the fold tells you nothing. Follow the stripe to the cut edge it reaches, and work out which face that edge lands against.'] },
            { id: 'worked-1', kind: 'worked', question: { kind: 'patterned-cuboid', seed: 9, level: 3 } },
            check('check-1', 'patterned-cuboid', 2, 3), check('check-2', 'patterned-cuboid', 13, 3), check('check-3', 'patterned-cuboid', 21, 3), check('check-4', 'patterned-cuboid', 30, 3),
            { id: 'practice', kind: 'practice', question: { kind: 'patterned-cuboid', level: 3 }, streak: 3 },
            check('check-hook', 'patterned-cuboid', 4, 3),
            { id: 'remember', kind: 'takeaway', body: 'Follow one stripe at a time. It must cross every fold at the same point on both sides, and match again where cut edges close up.' },
          ],
        },
      ],
      quiz: { title: 'Exam standard quiz', minutes: 18, pass: 7, marking: 'plain', questions: [{ kind: 'belt-length', level: 3, count: 2 }, { kind: 'net-of-solid', level: 3, count: 5 }, { kind: 'patterned-cuboid', level: 3, count: 3 }] },
    },
    {
      id: 'exam-hard', title: 'Exam hard', level: 4,
      lessons: [
        {
          id: 'stepped', title: 'Steps and slopes', minutes: 14, level: 4,
          summary: 'Profiles with several steps and a sloping side. Ten or more faces, and nets that differ by one of them.',
          steps: [
            { id: 'hook', kind: 'hook', text: 'This is the size of solid the exam uses. Do not try to fold it in your head all at once.', question: { kind: 'net-of-solid', seed: 4, level: 4 } },
            { id: 'routine', kind: 'slide', title: 'One routine, four steps', text: ['Count and sort. Find the belt and read its segments in order. Place the two end faces. Check the one edge you are unsure of.', 'Stop at the first failure. Most wrong nets fail at step three.'], ...unfolder(['stairs', 'ramp', 'neck']), hint: 'Open each solid out slowly and say which step of the routine each face belongs to.' },
            { id: 'slopes', kind: 'slide', title: 'A slope is longer than it is tall', text: 'A sloping side makes a belt segment longer than the step beside it. In a net drawn on a square grid it shows as a rectangle that does not sit on the grid lines, or as a diagonal fold.' },
            { id: 'worked-1', kind: 'worked', question: { kind: 'net-of-solid', seed: 5, level: 4 } },
            check('check-1', 'net-of-solid', 11, 4), check('check-2', 'net-of-solid', 18, 4), check('check-3', 'net-of-solid', 20, 4),
            { id: 'practice', kind: 'practice', question: { kind: 'net-of-solid', level: 4 }, streak: 3 },
            check('check-hook', 'net-of-solid', 4, 4),
            { id: 'remember', kind: 'takeaway', body: 'Count and sort, find the belt, place the ends, check one edge. Stop at the first failure.' },
          ],
        },
        {
          id: 'long-strips', title: 'Long strips and rounded ends', minutes: 14, level: 4,
          summary: 'Sixteen faces, and solids with a curved side that unrolls into a long rectangle.',
          steps: [
            { id: 'hook', kind: 'hook', text: 'Sixteen faces, and the four nets differ in where one or two of them sit. The belt does almost all the work.', question: { kind: 'net-of-solid', seed: 7, level: 4 } },
            { id: 'long', kind: 'slide', title: 'When the belt is long', text: 'With many sides the belt is a long strip of narrow rectangles. Do not check them all. Find the longest and the shortest segments on the solid and check that they sit in the right order in the net.', ...unfolder(['twin', 'bow', 'neck']), hint: 'Drag Fold to open the solid out. Two prisms joined have four end faces on one strip.' },
            { id: 'curved', kind: 'slide', title: 'A curved side unrolls flat', text: 'A rounded end is one face. Unrolled, it is a rectangle as long as the curve: about one and a half times the width of the rounded end for a half-round. The end faces keep the curve; they never fold along it.', ...unfolder(['roundEnd']), hint: 'Tap the long rectangle in the net: it is the curved side.' },
            { id: 'worked-1', kind: 'worked', question: { kind: 'net-of-solid', seed: 15, level: 4 } },
            check('check-1', 'net-of-solid', 23, 4), check('check-2', 'net-of-solid', 9, 4), check('check-3', 'net-of-solid', 19, 4),
            { id: 'practice', kind: 'practice', question: { kind: 'net-of-solid', level: 4 }, streak: 3 },
            check('check-hook', 'net-of-solid', 7, 4),
            { id: 'remember', kind: 'takeaway', body: 'On a long belt, check the longest and shortest segments and their order. A curved side is one long rectangle; the ends never fold along the curve.' },
          ],
        },
        {
          id: 'many-cubes', title: 'Five cubes, many faces', minutes: 12, level: 4,
          summary: 'Cube-built solids with a dozen or more faces, and questions where more than one net is right.',
          steps: [
            { id: 'hook', kind: 'hook', text: 'More than one net may be right, or you may be asked for the one that cannot work. Read the question twice.', question: { kind: 'net-of-solid', seed: 3, level: 4 } },
            { id: 'select-all', kind: 'slide', title: 'Select all that apply', text: 'One solid has many true nets. When the question allows several answers, test every option fully; finding one that works does not mean the others fail.' },
            { id: 'worked-1', kind: 'worked', question: { kind: 'net-of-solid', seed: 6, level: 4 } },
            check('check-1', 'net-of-solid', 12, 4), check('check-2', 'net-of-solid', 1, 4), check('check-3', 'net-of-solid', 17, 4),
            { id: 'practice', kind: 'practice', question: { kind: 'net-of-solid', level: 4 }, streak: 3 },
            check('check-hook', 'net-of-solid', 3, 4),
            { id: 'remember', kind: 'takeaway', body: 'Several nets can be right. Test every option to the end, and read whether the question asks for can or cannot.' },
          ],
        },
        {
          id: 'diagonals', title: 'Nets on a grid with diagonal folds', minutes: 14, level: 4,
          summary: 'A box with corners sliced off. Its net sits on a square grid, and every sloping face folds along a diagonal.',
          steps: [
            { id: 'hook', kind: 'hook', text: 'The triangles are all the same, and so are the diagonals they could join. Only one arrangement closes up.', question: { kind: 'grid-net', seed: 15, level: 4 } },
            { id: 'slice', kind: 'slide', title: 'Slice a corner, gain a triangle', text: 'Cut a corner off a box and three faces each lose a corner. One new face appears: a triangle that leans against all three. In the net, each of those three faces shows a diagonal edge.', ...unfolder(['sliced', 'slicedLong']), hint: 'Tap a triangle in the net, then fold. Watch which three faces it ends up touching.' },
            { id: 'diagonal', kind: 'slide', title: 'A diagonal means a slope', text: 'On a square grid, a fold along a grid line joins two faces at a right angle. A fold along a diagonal joins a face to a sloping one. Count the diagonals round each face: that is how many of its corners were cut.' },
            { id: 'three', kind: 'slide', title: 'One triangle, three diagonals', text: ['Each triangle has three sides, and each side lies on a diagonal of a different face. In the net it is joined to one of them by a fold. The other two diagonals are cut edges that close against it.', 'So for every triangle, find its three diagonals. They must be the three that meet at one corner of the box. A triangle joined to a diagonal from another corner is the commonest wrong net.'] },
            { id: 'worked-1', kind: 'worked', question: { kind: 'grid-net', seed: 18, level: 4 } },
            check('check-1', 'grid-net', 23, 4), check('check-2', 'grid-net', 6, 4), check('check-3', 'grid-net', 2, 4),
            { id: 'practice', kind: 'practice', question: { kind: 'grid-net', level: 4 }, streak: 3 },
            check('check-hook', 'grid-net', 15, 4),
            { id: 'remember', kind: 'takeaway', body: 'A diagonal fold is a sloping face. Count the cut corners on each face, then check that every triangle sits where three diagonals meet at one corner.' },
          ],
        },
      ],
      quiz: { title: 'Exam hard quiz', minutes: 20, pass: 5, marking: 'plain', questions: [{ kind: 'net-of-solid', level: 4, count: 6 }, { kind: 'grid-net', level: 4, count: 2 }] },
    },
    {
      id: 'mastery', title: 'Mastery', level: 5,
      lessons: [
        {
          id: 'review', title: 'Mixed review', minutes: 12, level: 5,
          summary: 'The routine once more, then mixed practice before the timed set.',
          steps: [
            { id: 'routine', kind: 'slide', title: 'The routine', text: 'Count and sort. Find the belt, or the biggest face. Place the ends, or walk the neighbours. Check one doubtful edge. Stop at the first failure.' },
            { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'Two minutes a question. Single-choice questions lose marks when wrong, so rule options out properly. Select-all questions give part marks for a correct but incomplete choice and lose a mark for any wrong pick.' },
            { id: 'practice-1', kind: 'practice', question: { kind: 'net-of-solid', level: 4 }, streak: 3 },
            { id: 'remember', kind: 'takeaway', body: 'Never fold the whole net in your head. Run the routine and let the first failure decide.' },
          ],
        },
      ],
      quiz: { title: 'Timed exam set', minutes: 24, pass: 9, marking: 'uceed', description: 'Twelve nets of complex solids at exam pace, marked like UCEED.', questions: [{ kind: 'net-of-solid', level: 3, count: 2 }, { kind: 'patterned-cuboid', level: 3, count: 2 }, { kind: 'net-of-solid', level: 4, count: 6 }, { kind: 'grid-net', level: 4, count: 2 }] },
    },
  ],
});
