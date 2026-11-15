// Mirror and water images. Foundations reflects small patterns and words;
// the upper tiers put the mirror on any side or at 45°, read words and clocks
// in a mirror, chain reflections, count images between two mirrors and follow
// a ray across a grid of mirrors. Specification: docs/learn/topics/mirror-images.md.
const lab = (mode, lines) => ({ tool: 'mirror-lab', props: lines ? { mode, lines } : { mode } });
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level, id = 'worked-1') => ({ id, kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const mirrorImagesProgramme = Object.freeze({
  slug: 'mirror-images',
  title: 'Mirror and water images',
  summary: 'Reflect figures, words and clocks in a mirror on any side or at 45°, chain reflections, count images between two mirrors and follow a ray.',
  topic: 'visualisation',
  exams: ['uceed', 'ceed', 'nid', 'nift'],
  minutes: 110,
  status: 'preview',
  tiers: [
    {
      id: 'foundations', title: 'Foundations', level: 2,
      lessons: [
        {
          id: 'mirror', title: 'Mirror images', minutes: 10, level: 1,
          summary: 'A mirror beside a figure swaps left and right and nothing else.',
          steps: [
            { id: 'swap', kind: 'slide', title: 'Left becomes right', text: 'A mirror standing beside a figure swaps left and right. The part nearest the mirror stays nearest it. Top stays top.', tool: 'mirror', hint: 'Draw on the grid and watch both reflections change.' },
            { id: 'not-turn', kind: 'slide', title: 'A reflection is not a turn', text: ['Turn a figure by half a turn and both left-right and top-bottom swap. A mirror swaps only one of them.', 'Letters help: in a mirror, F becomes a backwards F, never an upside-down one.'] },
            { id: 'check-1', kind: 'check', question: { kind: 'mirror-image', seed: 91 } },
            { id: 'check-2', kind: 'check', question: { kind: 'mirror-image', seed: 92 } },
            { id: 'check-3', kind: 'check', question: { kind: 'mirror-image', seed: 93 } },
            { id: 'check-4', kind: 'check', question: { kind: 'mirror-image', seed: 94 } },
            { id: 'remember', kind: 'takeaway', body: 'Mirror beside the figure: left and right swap, top stays top. If it looks turned, it is wrong.' },
          ],
        },
        {
          id: 'water', title: 'Water images', minutes: 10, level: 2,
          summary: 'A still pool below a figure swaps top and bottom and nothing else.',
          steps: [
            { id: 'flip', kind: 'slide', title: 'Top becomes bottom', text: 'A water image is the reflection in a still pool below the figure. Top and bottom swap. Whatever touches the water line stays at the water line, and left stays left.', tool: 'mirror', props: { initial: ['0,0', '1,0', '2,0', '0,1', '0,2', '1,2', '0,3', '0,4', '3,1'] } },
            { id: 'compare', kind: 'slide', title: 'Mirror or water?', text: 'Ask one question: which pair swapped? Left-right means mirror. Top-bottom means water. Both means a half turn, which neither reflection can make.' },
            { id: 'check-1', kind: 'check', question: { kind: 'water-image', seed: 101 } },
            { id: 'check-2', kind: 'check', question: { kind: 'water-image', seed: 102 } },
            { id: 'check-3', kind: 'check', question: { kind: 'water-image', seed: 103 } },
            { id: 'check-4', kind: 'check', question: { kind: 'mirror-image', seed: 104 } },
            { id: 'remember', kind: 'takeaway', body: 'Water below the figure: top and bottom swap, left stays left. One pair swaps, never both.' },
          ],
        },
      ],
      quiz: { title: 'Foundations quiz', minutes: 6, pass: 6, marking: 'plain', questions: [{ kind: 'mirror-image', level: 1, count: 4 }, { kind: 'water-image', level: 2, count: 4 }] },
    },
    {
      id: 'exam-standard', title: 'Exam standard', level: 3,
      lessons: [
        {
          id: 'any-side', title: 'A mirror on any side', minutes: 12, level: 3,
          summary: 'Bigger two-tone patterns with the mirror on the left, right, above or below.',
          steps: [
            hook('The mirror can be on any side. Each option has the right outline; look at the orange cells too.', 'mirror-image', 1, 3),
            { id: 'side', kind: 'slide', title: 'Which side is the mirror on?', text: 'A mirror to the left or right swaps left and right. A mirror above or below swaps top and bottom, like water. Which side it is on changes where the image sits, not what it looks like.', ...lab('line', ['right', 'left', 'bottom', 'top']), hint: 'Move the mirror round the four sides and compare the results.' },
            { id: 'detail', kind: 'slide', title: 'Check the detail', text: 'Exam options often have the right outline with one cell changed. Pick one orange cell, find where it must land, and check it in each option.' },
            worked('mirror-image', 3, 3),
            check('check-1', 'mirror-image', 2, 3), check('check-2', 'mirror-image', 5, 3), check('check-3', 'mirror-image', 7, 3),
            practice('mirror-image', 3),
            check('check-hook', 'mirror-image', 1, 3),
            { id: 'remember', kind: 'takeaway', body: 'Side mirror: left-right swap. Above or below: top-bottom swap. Then check one detail cell.' },
          ],
        },
        {
          id: 'letters-clocks', title: 'Letters and clocks', minutes: 12, level: 3,
          summary: 'Which words survive a mirror or water, and the real time of a clock seen in a mirror.',
          steps: [
            hook('This clock is seen in a mirror. There is a rule that turns it into the real time in one step.', 'clock-mirror', 1, 3),
            { id: 'letters', kind: 'slide', title: 'Letters that survive', text: ['In a mirror these look the same: A H I M O T U V W X Y. The whole word also reads backwards, so it must read the same both ways.', 'In water these look the same: B C D E H I K O X. Water keeps the order of the letters.'] },
            check('check-1', 'symmetric-words', 1, 3), check('check-2', 'symmetric-words', 4, 3),
            { id: 'clock', kind: 'slide', title: 'The clock rule', text: 'A mirror flips the clock face left to right. The real time and the mirror time always add up to 12:00, so real time = 11:60 − the time you see. 12:00 and 6:00 stay the same.' },
            worked('clock-mirror', 2, 3),
            check('check-3', 'clock-mirror', 3, 3), check('check-4', 'clock-mirror', 5, 3),
            practice('clock-mirror', 3),
            check('check-hook', 'clock-mirror', 1, 3),
            { id: 'remember', kind: 'takeaway', body: 'Mirror words: safe letters and the same backwards. Water words: safe letters only. Clocks: 11:60 minus the time you see.' },
          ],
        },
        {
          id: 'diagonal', title: 'A mirror at 45°', minutes: 10, level: 3,
          summary: 'A slanted mirror swaps across and down: rows become columns.',
          steps: [
            hook('The mirror is slanted at 45°. Rows of the figure become columns of the image.', 'diagonal-mirror', 1, 3),
            { id: 'swap', kind: 'slide', title: 'Across becomes down', text: 'A mirror at 45° swaps how far across a cell is with how far down it is. The top row of the figure becomes a column of the image, in the same order.', ...lab('line', ['falling', 'rising', 'right']), hint: 'Switch between the two diagonals and the side mirror.' },
            { id: 'not-quarter', kind: 'slide', title: 'Not a quarter turn', text: 'A quarter turn also turns rows into columns, but reverses their order. Check one orange cell: in a reflection, it stays on the same side of the mirror line.' },
            worked('diagonal-mirror', 2, 3),
            check('check-1', 'diagonal-mirror', 3, 3), check('check-2', 'diagonal-mirror', 6, 3), check('check-3', 'diagonal-mirror', 8, 3),
            practice('diagonal-mirror', 3),
            check('check-hook', 'diagonal-mirror', 1, 3),
            { id: 'remember', kind: 'takeaway', body: 'At 45°, rows become columns in the same order. A quarter turn reverses the order.' },
          ],
        },
      ],
      quiz: { title: 'Exam standard quiz', minutes: 14, pass: 6, marking: 'plain', questions: [{ kind: 'mirror-image', level: 3, count: 3 }, { kind: 'symmetric-words', level: 3, count: 1 }, { kind: 'clock-mirror', level: 3, count: 2 }, { kind: 'diagonal-mirror', level: 3, count: 2 }] },
    },
    {
      id: 'exam-hard', title: 'Exam hard', level: 4,
      lessons: [
        {
          id: 'chains', title: 'One mirror after another', minutes: 14, level: 4,
          summary: 'Two or three reflections in a row add up to a turn, a flip, or nothing at all.',
          steps: [
            hook('Reflect in each line in turn. The final figure may not look like a reflection at all.', 'reflection-chain', 1, 4),
            { id: 'half-turn', kind: 'slide', title: 'Two lines at right angles: a half turn', text: 'Reflect in an upright line, then in a level line, and the figure has turned half way round. Two flips at right angles make a turn.', ...lab('chain', ['right', 'bottom', 'falling', 'rising']), hint: 'Choose a first mirror, then a second, and read the result.' },
            { id: 'quarter', kind: 'slide', title: 'Lines at 45°: a quarter turn', text: 'Reflect in a side line and then a diagonal, and the figure turns a quarter turn. In the other order it turns the other way, so order matters.' },
            worked('reflection-chain', 2, 4),
            check('check-1', 'reflection-chain', 3, 4), check('check-2', 'reflection-chain', 4, 4), check('check-3', 'reflection-chain', 7, 4),
            practice('reflection-chain', 4),
            check('check-hook', 'reflection-chain', 1, 4),
            { id: 'remember', kind: 'takeaway', body: 'Do one reflection at a time. Two at right angles make a half turn; two at 45° make a quarter turn, and order matters.' },
          ],
        },
        {
          id: 'two-mirrors', title: 'Images between two mirrors', minutes: 12, level: 4,
          summary: 'Two mirrors at an angle make several images. One division and one check give the count.',
          steps: [
            hook('Type the number of images. A rule gives it without drawing them.', 'image-count', 1, 4),
            { id: 'rule', kind: 'slide', title: '360 ÷ θ, then subtract one', text: 'Work out m = 360 ÷ θ. If m is even, there are m − 1 images: the last two land on the same spot.', ...lab('angle'), hint: 'Move the angle and watch the images form round the circle.' },
            { id: 'odd', kind: 'slide', title: 'The odd case', text: 'If m is odd, it depends on the object. Exactly half way between the mirrors, the last two images still meet: m − 1. Anywhere else they are separate: m.' },
            worked('image-count', 6, 4),
            check('check-1', 'image-count', 2, 4), check('check-2', 'image-count', 3, 4), check('check-3', 'image-count', 7, 4), check('check-4', 'image-count', 10, 4),
            practice('image-count', 4),
            check('check-hook', 'image-count', 1, 4),
            { id: 'remember', kind: 'takeaway', body: 'm = 360 ÷ θ. Even: m − 1. Odd: m − 1 on the middle line, m off it.' },
          ],
        },
        {
          id: 'rays', title: 'Following a ray', minutes: 12, level: 4,
          summary: 'A ray crossing a grid of slanted mirrors turns a right angle at each one.',
          steps: [
            hook('Follow the ray from the arrow. Every slanted line turns it.', 'ray-exit', 1, 4),
            { id: 'turn', kind: 'slide', title: 'A right angle at every mirror', text: 'On a / mirror, a ray going right turns up and a ray going down turns left. On a \\ mirror, a ray going right turns down. Move one cell at a time; never guess the path.', ...lab('ray'), hint: 'Turn a mirror and see the whole path change after it.' },
            worked('ray-exit', 2, 4),
            check('check-1', 'ray-exit', 3, 4), check('check-2', 'ray-exit', 6, 4), check('check-3', 'ray-bounces', 2, 4),
            practice('ray-exit', 4),
            check('check-hook', 'ray-exit', 1, 4),
            { id: 'remember', kind: 'takeaway', body: 'One cell at a time; a right angle at each mirror, by its slant.' },
          ],
        },
      ],
      quiz: { title: 'Exam hard quiz', minutes: 16, pass: 5, marking: 'plain', questions: [{ kind: 'reflection-chain', level: 4, count: 3 }, { kind: 'image-count', level: 4, count: 2 }, { kind: 'ray-exit', level: 4, count: 2 }, { kind: 'ray-bounces', level: 4, count: 1 }] },
    },
    {
      id: 'mastery', title: 'Mastery', level: 5,
      lessons: [
        {
          id: 'review', title: 'Mixed review', minutes: 10, level: 5,
          summary: 'The rules once more, then mixed practice before the timed set.',
          steps: [
            { id: 'rules', kind: 'slide', title: 'The rules on one screen', text: ['Side mirror: left-right. Above or below: top-bottom. At 45°: rows become columns. Clock: 11:60 minus the time.', 'Two reflections make a turn. Two mirrors at θ: 360 ÷ θ, then the odd and even check.'] },
            { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'About ninety seconds a question. Single-choice questions lose marks when wrong: rule out turned options first, they are never reflections.' },
            { id: 'practice-1', kind: 'practice', question: { kind: 'reflection-chain', level: 4 }, streak: 2 },
            { id: 'practice-2', kind: 'practice', question: { kind: 'mirror-image', level: 3 }, streak: 2 },
            { id: 'remember', kind: 'takeaway', body: 'Find what swaps, check one detail, never accept a turn as a reflection.' },
          ],
        },
      ],
      quiz: { title: 'Timed exam set', minutes: 18, pass: 9, marking: 'uceed', description: 'Twelve reflection questions at exam pace, marked like UCEED.', questions: [{ kind: 'mirror-image', level: 3, count: 2 }, { kind: 'diagonal-mirror', level: 3, count: 1 }, { kind: 'clock-mirror', level: 3, count: 2 }, { kind: 'symmetric-words', level: 3, count: 1 }, { kind: 'reflection-chain', level: 4, count: 3 }, { kind: 'image-count', level: 4, count: 2 }, { kind: 'ray-exit', level: 4, count: 1 }] },
    },
  ],
});
