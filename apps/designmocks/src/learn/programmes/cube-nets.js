// Cube nets. One idea per screen; every check is a seeded, verified question.
// Specification: docs/learn/topics/cube-nets.md. Foundations is the original
// five-lesson course; the upper tiers follow the lesson anatomy of the
// reference programme (counting-cubes.js): hook, slides, worked example,
// checks with hints, practice to a streak, the hook again, a take-away.
import { generateQuestion } from '../cube-net.js';

const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (id, kind, seed, level) => ({ id, kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level, id = 'practice') => ({ id, kind: 'practice', question: { kind, level }, streak: 3 });
// The hook net of "Lines across faces", shown again on its first slide.
const pathNet = generateQuestion('path-cube', 1, 4).net;

export const cubeNetsProgramme = Object.freeze({
  slug: 'cube-nets',
  title: 'Cube nets',
  summary: 'Fold nets in your head: find opposite faces, decide which cube a net makes, and build nets yourself.',
  topic: 'visualisation',
  exams: ['uceed', 'ceed', 'nid', 'nift'],
  minutes: 170,
  status: 'preview',
  tiers: [
    {
      id: 'foundations', title: 'Foundations', level: 2,
      lessons: [
        {
          id: 'fold', title: 'From flat to solid', minutes: 10,
          summary: 'What a net is, how folding works one square at a time, and how to spot a shape that cannot close.',
          steps: [
            { id: 'net', kind: 'slide', title: 'A net is a cube, unfolded', text: 'Cut a paper cube along seven of its edges and it opens flat into six squares joined edge to edge. That flat shape is a net.', tool: 'fold-explorer', props: { netId: 'net-3', glyphSet: 'letters' }, hint: 'Tap any square to see which face it becomes.' },
            { id: 'fold', kind: 'slide', title: 'One square at a time', text: 'Pick a square as the top. Each neighbour folds down over the edge it shares and becomes the face on that side. Its own neighbours fold down from it, until all six faces are covered.', tool: 'fold-explorer', props: { netId: 'net-3', glyphSet: 'letters', startFolded: 1 }, hint: 'Drag the slider to fold the squares one by one.' },
            { id: 'eleven', kind: 'slide', title: 'Only eleven shapes close', text: 'Of all the ways to join six squares, only eleven fold into a cube. Every exam question uses one of them, sometimes turned or flipped.', tool: 'fold-explorer', props: { glyphSet: 'letters', picker: true }, hint: 'Try each net. Turn the cube to find the hidden faces.' },
            { id: 'check-1', kind: 'check', question: { kind: 'is-net', seed: 11 } },
            { id: 'check-2', kind: 'check', question: { kind: 'is-net', seed: 12 } },
            { id: 'spot', kind: 'slide', title: 'Spotting a shape that cannot close', text: ['A 2-by-2 block never closes: four squares would have to meet at one corner, and a cube corner has room for three.', 'A straight row of five wraps all the way round and lands back on the first square.'] },
            { id: 'check-3', kind: 'check', question: { kind: 'is-net', seed: 14 } },
            { id: 'check-4', kind: 'check', question: { kind: 'is-net', seed: 17 } },
            { id: 'remember', kind: 'takeaway', body: 'Six squares joined edge to edge, with no square landing on a face already taken. A 2-by-2 block or a row of five can never close.' },
          ],
        },
        {
          id: 'opposite', title: 'Opposite faces', minutes: 10,
          summary: 'The line rule and the zigzag rule that give you the face on the other side in seconds.',
          steps: [
            { id: 'line', kind: 'slide', title: 'The line rule', text: 'In a line of three squares, the two ends fold to opposite faces, with the middle one between them.', tool: 'opposite-explorer', props: { netId: 'net-5', initial: 1 }, hint: 'B is selected. Its opposite is orange; the faces that touch it are green.' },
            { id: 'zigzag', kind: 'slide', title: 'The zigzag rule', text: 'When squares step sideways, step, step, step, the two ends of the zigzag are opposite too.', tool: 'opposite-explorer', props: { netId: 'net-8', initial: 0 }, hint: 'Tap each square to check its opposite.' },
            { id: 'neighbours', kind: 'slide', title: 'Neighbours never are', text: ['Two squares that share an edge always meet at a corner of the cube, so they can never be opposite.', 'Every net pairs up as three opposite pairs. Find one pair with the line rule, another the same way, and the two squares left over are the third.'], tool: 'opposite-explorer', props: { picker: true } },
            { id: 'check-1', kind: 'check', question: { kind: 'opposite', seed: 21 } },
            { id: 'check-2', kind: 'check', question: { kind: 'opposite', seed: 22 } },
            { id: 'check-3', kind: 'check', question: { kind: 'opposite', seed: 23 } },
            { id: 'check-4', kind: 'check', question: { kind: 'opposite', seed: 24 } },
            { id: 'remember', kind: 'takeaway', body: 'Ends of a line of three are opposite. Ends of a zigzag are opposite. Neighbours never are.' },
          ],
        },
        {
          id: 'which-cube', title: 'Which cube is it?', minutes: 15,
          summary: 'Three tests, run in order, that settle the classic question: which cube can this net make?',
          steps: [
            { id: 'tests', kind: 'slide', title: 'Three tests, in order', text: 'A cube drawing shows three faces meeting at one corner. To decide whether a net can make it, run three tests and stop at the first failure.' },
            { id: 'opposites', kind: 'slide', title: 'Test 1: opposites', text: 'If two faces shown together are an opposite pair on the net, the cube is impossible. This alone removes most wrong options.' },
            { id: 'order', kind: 'slide', title: 'Test 2: order', text: 'Read the three faces clockwise around the corner. Fold the net in your head around that same corner and read them again. If the order runs the other way, the drawing is a mirror image, which folding can never produce.' },
            { id: 'turn', kind: 'slide', title: 'Test 3: turn', text: 'A symbol with a direction must point the right way relative to the faces beside it. Turn the cube and watch each symbol turn with its face.', tool: 'fold-explorer', props: { netId: 'net-2', glyphSet: 'mixed' }, hint: 'Use the arrows to turn the cube. Tap a square to see where it lands.' },
            { id: 'worked', kind: 'slide', title: 'A worked example', text: 'Here is a full question with the reason under every option. Run the three tests on each one before you read the reason.', tool: 'worked-cube', props: { seed: 31 } },
            { id: 'check-1', kind: 'check', question: { kind: 'which-cube', seed: 41 } },
            { id: 'check-2', kind: 'check', question: { kind: 'which-cube', seed: 42 } },
            { id: 'check-3', kind: 'check', question: { kind: 'cannot-cube', seed: 44 } },
            { id: 'check-4', kind: 'check', question: { kind: 'which-cube', seed: 43 } },
            { id: 'check-5', kind: 'check', question: { kind: 'cannot-cube', seed: 45 } },
            { id: 'remember', kind: 'takeaway', body: 'Opposites first, then the order around the corner, then the turn of each symbol. Most questions end at the first test.' },
          ],
        },
        {
          id: 'which-net', title: 'Back to the net', minutes: 10,
          summary: 'The reverse question: given the cube, find the net that makes it.',
          steps: [
            { id: 'reverse', kind: 'slide', title: 'From the cube to its net', text: 'The reverse question gives you a cube and four nets. The same three tests work; now you run them on each net in turn.' },
            { id: 'two-faces', kind: 'slide', title: 'Start with two faces', text: 'Find the two cube faces that are easiest to spot on the nets. They must be neighbours on the net, not an opposite pair. Then check the third face and the order around the corner.' },
            { id: 'trap', kind: 'slide', title: 'The usual trap', text: 'Nets that differ by only one swapped face. Pin down which face moved and ask whether it can still meet the other two.', tool: 'fold-explorer', props: { glyphSet: 'mixed', picker: true }, hint: 'Pick a net and turn the cube until the three faces you want are in view. That is the move you make in your head.' },
            { id: 'check-1', kind: 'check', question: { kind: 'which-net', seed: 51 } },
            { id: 'check-2', kind: 'check', question: { kind: 'which-net', seed: 52 } },
            { id: 'check-3', kind: 'check', question: { kind: 'which-net', seed: 53 } },
            { id: 'check-4', kind: 'check', question: { kind: 'which-net', seed: 54 } },
            { id: 'remember', kind: 'takeaway', body: 'Find two faces, confirm they meet, then check the third face and the order around the corner. One swapped face breaks the corner.' },
          ],
        },
        {
          id: 'build', title: 'Build the net yourself', minutes: 15,
          summary: 'Colour a blank net so it folds into a given cube. The strongest way to make the rules stick.',
          steps: [
            { id: 'construct', kind: 'slide', title: 'Colouring a blank net', text: 'You get two views of a cube, the front corner and the back corner, so all six faces are known. Colour the blank net so it folds into exactly that cube.' },
            { id: 'pairs', kind: 'slide', title: 'Pairs first, then a corner', text: 'Read the three opposite pairs off the two views. Place each pair at the ends of a line of three or a zigzag. Then check one corner: its three colours must run the same way as on the cube, or you have built the mirror image.', tool: 'net-builder', props: { seed: 61 }, hint: 'Choose a colour, tap a square. Check as often as you like.' },
            { id: 'check-1', kind: 'check', question: { kind: 'build-net', seed: 62 } },
            { id: 'check-2', kind: 'check', question: { kind: 'build-net', seed: 63 } },
            { id: 'remember', kind: 'takeaway', body: 'Place the opposite pairs first, then check one corner. If every pair is right but the cube still fails, two touching colours need to swap.' },
          ],
        },
      ],
      quiz: {
        title: 'Foundations quiz', minutes: 10, pass: 7, marking: 'plain',
        description: 'Ten mixed questions in exam format. Your best score is kept.',
        questions: [
          { kind: 'is-net', level: 1, count: 2 }, { kind: 'opposite', level: 1, count: 3 }, { kind: 'which-cube', level: 2, count: 2 },
          { kind: 'cannot-cube', level: 2, count: 1 }, { kind: 'which-net', level: 2, count: 2 },
        ],
      },
    },
    {
      id: 'exam-standard', title: 'Exam standard', level: 3,
      lessons: [
        {
          id: 'turns', title: 'Symbols that turn', minutes: 14, level: 3,
          summary: 'Every face carries a symbol with a direction. Anchor on one face and walk round it edge by edge.',
          steps: [
            hook('Every symbol here points somewhere, and the wrong cubes differ by one turn or a mirror. Have a go first.', 'which-cube', 1, 3),
            { id: 'anchor', kind: 'slide', title: 'Anchor and walk', text: 'Pick one face as the anchor. On the net, read which face sits across the top of its symbol, and which across its right edge. Folding never changes that.', tool: 'fold-explorer', props: { netId: 'net-2', glyphSet: 'mixed', follow: true }, hint: 'Tap a square. The line under the tool names the face across each edge of its symbol.' },
            { id: 'walk', kind: 'slide', title: 'Then check the picture', text: 'In each cube picture, find the anchor and look across the top of its symbol. If a different face is there, or nothing you expected, that option is out.', tool: 'fold-explorer', props: { glyphSet: 'mixed', follow: true, picker: true }, hint: 'Turn the cube until your anchor is on top. The face across the top of its symbol never changes.' },
            worked('worked-1', 'which-cube', 2, 3),
            check('check-1', 'which-cube', 3, 3), check('check-2', 'which-cube', 4, 3),
            { id: 'mirror-trap', kind: 'slide', title: 'The mirror-image trap', text: ['A mirror image has the right faces round the corner, and every symbol looks right, but the faces run the other way round.', 'Read the three faces clockwise on the net and in the picture. If the order is reversed, it is the mirror image.'] },
            check('check-3', 'cannot-cube', 4, 3), check('check-4', 'which-cube', 7, 3),
            practice('which-cube', 3),
            check('check-hook', 'which-cube', 1, 3),
            { id: 'remember', kind: 'takeaway', body: 'Anchor on one face. The face across the top of its symbol, and across its right edge, must be the same in the picture. A reversed order round the corner is the mirror image.' },
          ],
        },
        {
          id: 'from-views', title: 'From views to the net', minutes: 14, level: 3,
          summary: 'Two pictures of one cube from opposite corners: rebuild the pairs and one corner, then find the net.',
          steps: [
            hook('Two pictures of the same cube, from opposite corners. Which net makes it?', 'net-from-views', 1, 3),
            { id: 'pairs', kind: 'slide', title: 'List the pairs from the views', text: 'Opposite corners share no face. So each face in the first view is opposite exactly one face in the second: the one in the same position, top with top.', tool: 'fold-explorer', props: { glyphSet: 'mixed', picker: true }, hint: 'Turn the cube half way round and compare the two corners.' },
            { id: 'corner', kind: 'slide', title: 'Fix one corner', text: 'Read the first view clockwise: top, then right, then left. On a true net those three faces run the same way round their corner, and each symbol points the same way relative to its neighbours.' },
            worked('worked-1', 'net-from-views', 2, 3),
            check('check-1', 'net-from-views', 3, 3), check('check-2', 'net-from-views', 5, 3),
            { id: 'trap', kind: 'slide', title: 'Three ways to be nearly right', text: 'A wrong net here has one pair wrong, one symbol turned, or every corner running the wrong way. Check them in that order: pairs, the corner, then the turn.' },
            check('check-3', 'net-from-views', 7, 3), check('check-4', 'net-from-views', 12, 3),
            practice('net-from-views', 3),
            check('check-hook', 'net-from-views', 1, 3),
            { id: 'remember', kind: 'takeaway', body: 'Opposite corners give the three pairs, top with top, left with left, right with right. Then read one corner clockwise and check one symbol.' },
          ],
        },
        {
          id: 'open-box', title: 'Open boxes', minutes: 12, level: 3,
          summary: 'Five squares and no lid: which shapes fold into an open box, which square is the base, which walls face each other.',
          steps: [
            hook('This box has no lid. Which square ends up at the bottom?', 'open-box', 7, 3),
            { id: 'five', kind: 'slide', title: 'Five squares, one face missing', text: 'An open box is a cube without its lid: a base and four walls. Of the twelve shapes made of five squares, eight fold into one.', tool: 'fold-explorer', props: { shapes: 'pentominoes', glyphSet: 'letters', picker: true }, hint: 'Try each shape. The ones that cannot fold mark the two squares that clash.' },
            { id: 'base', kind: 'slide', title: 'Finding the base', text: ['Once folded, the base touches all four walls. A wall touches only three squares: the base and its two neighbouring walls.', 'So the base is the one square that touches every other square, and opposite walls are the pairs that never touch.'] },
            worked('worked-1', 'open-box', 12, 3),
            check('check-1', 'open-box', 4, 3), check('check-2', 'open-box', 9, 3),
            check('check-3', 'open-box', 14, 3), check('check-4', 'open-box', 1, 3),
            practice('open-box', 3),
            check('check-hook', 'open-box', 7, 3),
            { id: 'remember', kind: 'takeaway', body: 'The base touches all four walls once folded. Opposite walls never touch. A 2-by-2 block, a row of five, a U or a V can never make an open box.' },
          ],
        },
      ],
      quiz: {
        title: 'Exam standard quiz', minutes: 16, pass: 6, marking: 'plain',
        questions: [
          { kind: 'which-cube', level: 3, count: 2 }, { kind: 'cannot-cube', level: 3, count: 1 }, { kind: 'which-net', level: 3, count: 1 },
          { kind: 'net-from-views', level: 3, count: 2 }, { kind: 'open-box', level: 3, count: 2 },
        ],
      },
    },
    {
      id: 'exam-hard', title: 'Exam hard', level: 4,
      lessons: [
        {
          id: 'same-cube', title: 'Different nets, same cube', minutes: 15, level: 4,
          summary: 'Nets of different shapes can fold into the same cube. Select every one that does.',
          steps: [
            hook('More than one option can be right here. Select every net that folds into the same cube.', 'same-cube', 3, 4),
            { id: 'test', kind: 'slide', title: 'The same-cube test', text: ['Two nets make the same cube when they have the same three opposite pairs, the same order round one corner, and each symbol turned the same way relative to a neighbour.', 'Shape does not matter. Only those three things do.'], tool: 'fold-explorer', props: { glyphSet: 'mixed', picker: true, follow: true }, hint: 'Change the net shape. The pairs and the face across the top of each symbol stay the same.' },
            worked('worked-1', 'same-cube', 2, 4),
            check('check-1', 'same-cube', 5, 4), check('check-2', 'same-cube', 6, 4),
            { id: 'how-many', kind: 'slide', title: 'One to three can be right', text: 'Judge every option on its own. Finding one right net tells you nothing about the others, and a mark is lost for any wrong choice.' },
            worked('worked-2', 'same-cube', 4, 4),
            check('check-3', 'same-cube', 9, 4), check('check-4', 'same-cube', 13, 4),
            practice('same-cube', 4),
            check('check-hook', 'same-cube', 3, 4),
            { id: 'remember', kind: 'takeaway', body: 'Pairs, then the order round one corner, then one turn. Test every net on its own: any number from one to three can pass.' },
          ],
        },
        {
          id: 'partial-views', title: 'When the views do not show everything', minutes: 15, level: 4,
          summary: 'Three views that never show one face, and a single view where the hidden faces could be anything.',
          steps: [
            hook('Three views, and one face never appears. You can still pin down the net.', 'net-from-views', 1, 4),
            { id: 'unseen', kind: 'slide', title: 'A face you never see', text: ['The unseen face must be opposite a face that appears in every view, because only that face is never beside it.', 'Once it has its pair, list the other two pairs and check one corner as before.'] },
            worked('worked-1', 'net-from-views', 2, 4),
            check('check-1', 'net-from-views', 3, 4), check('check-2', 'net-from-views', 5, 4),
            { id: 'hidden-free', kind: 'slide', title: 'One view: three faces are free', text: 'From a single picture you know only three faces. A net may put anything on the other three, so ignore them and test only the faces you can see.' },
            worked('worked-2', 'which-net', 1, 4),
            check('check-3', 'net-from-views', 6, 4), check('check-4', 'which-net', 2, 4),
            practice('net-from-views', 4),
            check('check-hook', 'net-from-views', 1, 4),
            { id: 'remember', kind: 'takeaway', body: 'An unseen face is opposite the face seen in every view. With one view, test only the three faces shown and ignore the rest.' },
          ],
        },
        {
          id: 'lines-across', title: 'Lines across faces', minutes: 15, level: 4,
          summary: 'A line runs over several faces of the net. Find the cube where it still joins up correctly.',
          steps: [
            hook('Have a go before the method. The line looks broken on the flat net, but it joins up once folded.', 'path-cube', 1, 4),
            { id: 'same-edge', kind: 'slide', title: 'Through the same edge', text: 'A line leaves a face through the middle of one edge and enters the next face through the middle of that same edge. Folding keeps the two pieces joined.', figure: { type: 'net', cells: pathNet.cells } },
            { id: 'follow', kind: 'slide', title: 'Follow it face by face', text: 'Name the faces the line visits, in order, by colour. Then in each picture check that the pieces join where those colours meet, and that the colours run the right way round the corner.' },
            worked('worked-1', 'path-cube', 2, 4),
            check('check-1', 'path-cube', 4, 4), check('check-2', 'path-cube', 8, 4),
            worked('worked-2', 'path-cube', 6, 4),
            check('check-3', 'path-cube', 9, 4), check('check-4', 'path-cube', 13, 4),
            practice('path-cube', 4),
            check('check-hook', 'path-cube', 1, 4),
            { id: 'remember', kind: 'takeaway', body: 'Follow the line face by face. It crosses each fold at the middle of the shared edge. A line that looks unbroken can still be on the mirror image or on the wrong colours.' },
          ],
        },
      ],
      quiz: {
        title: 'Exam hard quiz', minutes: 20, pass: 5, marking: 'plain',
        questions: [
          { kind: 'same-cube', level: 4, count: 3 }, { kind: 'net-from-views', level: 4, count: 2 }, { kind: 'path-cube', level: 4, count: 2 },
          { kind: 'cannot-cube', level: 3, count: 1 },
        ],
      },
    },
    {
      id: 'mastery', title: 'Mastery', level: 5,
      lessons: [
        {
          id: 'review', title: 'Mixed review', minutes: 15, level: 5,
          summary: 'Every routine in one place, then mixed practice before the timed set.',
          steps: [
            { id: 'routines', kind: 'slide', title: 'The routines', text: ['Cube from a net: opposites, the order round the corner, then the turn. Net from views: pairs, one corner, one turn; an unseen face is opposite the face in every view.', 'Same cube: test each net on its own. Open box: the base touches every wall. Lines: follow them face by face.'] },
            { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'About two minutes a question. A wrong single choice costs marks, and a wrong pick in a select-all question costs a mark, so rule options out properly before you choose.' },
            practice('which-cube', 3, 'practice-1'),
            practice('net-from-views', 4, 'practice-2'),
            practice('same-cube', 4, 'practice-3'),
            { id: 'remember', kind: 'takeaway', body: 'Name the routine before you look at the options. Most lost marks come from comparing options with each other instead of with the net.' },
          ],
        },
      ],
      quiz: {
        title: 'Timed exam set', minutes: 22, pass: 9, marking: 'uceed',
        description: 'Twelve cube net questions at exam pace, marked like UCEED.',
        questions: [
          { kind: 'which-cube', level: 3, count: 2 }, { kind: 'cannot-cube', level: 3, count: 1 }, { kind: 'which-net', level: 3, count: 1 },
          { kind: 'net-from-views', level: 3, count: 2 }, { kind: 'net-from-views', level: 4, count: 1 }, { kind: 'open-box', level: 3, count: 1 },
          { kind: 'same-cube', level: 4, count: 2 }, { kind: 'path-cube', level: 4, count: 2 },
        ],
      },
    },
  ],
});
