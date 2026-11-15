// Dice: opposite faces, nets, rolling along a path, several pictures of one
// die, and stacks or rows of dice. Specification: docs/learn/topics/dice.md.
const roller = { tool: 'die-roller', props: {} };
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const diceProgramme = Object.freeze({
  slug: 'dice', title: 'Dice',
  summary: 'Find hidden and opposite faces from nets and pictures, follow a die as it rolls, and total the hidden faces of stacked dice.',
  topic: 'visualisation', exams: ['uceed', 'ceed', 'nid', 'nift'], minutes: 100, status: 'preview',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'standard', title: 'The standard die', minutes: 8, level: 1, summary: 'Opposite faces of a standard die add to 7.', steps: [
        { id: 'seven', kind: 'slide', title: 'Opposites add to 7', text: 'On a standard die, 1 is opposite 6, 2 opposite 5 and 3 opposite 4. Three faces meet at every corner, and no two of them are opposite.', ...roller, hint: 'Roll the die and read the six faces in the status line.' },
        check('check-1', 'die-opposite', 1, 1), check('check-2', 'die-opposite', 2, 1), check('check-3', 'die-opposite', 4, 1),
        { id: 'remember', kind: 'takeaway', body: 'Standard die: opposite faces add to 7. Any other die, read it from its net or its pictures.' }] },
      { id: 'die-net', title: 'A die as a net', minutes: 8, level: 2, summary: 'In a net, squares two apart in a line are opposite.', steps: [
        { id: 'line', kind: 'slide', title: 'Two apart in a line', text: 'In a straight row of squares, the ones with exactly one square between them fold opposite each other. In a zigzag, the two ends of an S-step are opposite.' },
        check('check-1', 'die-net-opposite', 1, 2), check('check-2', 'die-net-opposite', 2, 2), check('check-3', 'die-net-opposite', 4, 2), check('check-4', 'die-net-opposite', 5, 2),
        { id: 'remember', kind: 'takeaway', body: 'Squares two apart in a line are opposite; so are the ends of a zigzag step.' }] },
      { id: 'rolling', title: 'Rolling a die', minutes: 8, level: 2, summary: 'Rolling sends the top to the side it rolls toward and brings the far side up.', steps: [
        { id: 'one-roll', kind: 'slide', title: 'One roll', text: 'Rolling east, the die tips over its east edge: the top goes to the east and the west face comes up. The north and south faces stay where they are.', ...roller, hint: 'Roll east then west: the die comes back as it was.' },
        check('check-1', 'die-roll', 1, 2), check('check-2', 'die-roll', 2, 2), check('check-3', 'die-roll', 4, 2), check('check-4', 'die-roll', 5, 2),
        { id: 'remember', kind: 'takeaway', body: 'The far side comes up; the two faces on the rolling edge stay.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain', questions: [{ kind: 'die-opposite', level: 1, count: 2 }, { kind: 'die-net-opposite', level: 2, count: 3 }, { kind: 'die-roll', level: 2, count: 3 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'positions', title: 'Several pictures, one die', minutes: 12, level: 3, summary: 'Every number seen beside a face is a neighbour; the one never seen beside it is its opposite.', steps: [
        hook('Two or three pictures of one die. Which number is opposite?', 'die-positions', 1, 3),
        { id: 'neighbours', kind: 'slide', title: 'Collect the neighbours', text: 'List every number seen in the same picture as your number. A face has four neighbours and one opposite. When four neighbours are found, the number left over is the opposite.' },
        worked('die-positions', 2, 3),
        check('check-1', 'die-positions', 3, 3), check('check-2', 'die-positions', 4, 3), check('check-3', 'die-positions', 7, 3),
        practice('die-positions', 3), check('check-hook', 'die-positions', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Seen together means neighbours. Four neighbours found: the fifth number is opposite.' }] },
      { id: 'paths', title: 'Rolling along a path', minutes: 12, level: 3, summary: 'Track top, front and right after every roll.', steps: [
        hook('Several rolls, with turns. Keep a table.', 'die-roll', 1, 3),
        { id: 'table', kind: 'slide', title: 'Three faces are enough', text: 'Write the top, front and right after each roll. The bottom, back and left are their opposites, so you never lose them.' },
        worked('die-roll', 2, 3),
        check('check-1', 'die-roll', 3, 3), check('check-2', 'die-roll', 4, 3), check('check-3', 'die-roll', 6, 3),
        practice('die-roll', 3), check('check-hook', 'die-roll', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'A row in the table per roll: top, front, right.' }] },
      { id: 'same-die', title: 'Can these be the same die?', minutes: 12, level: 3, summary: 'Opposite faces never show together, and the corner order must go the same way round.', steps: [
        hook('Some pictures show the same die turned; others are a different die.', 'same-die', 1, 3),
        { id: 'pairs-first', kind: 'slide', title: 'Pairs first, then the corner', text: 'Rule out any picture showing two opposite faces together. Then read the three numbers round the corner clockwise: on the same die they always go round in the same order.' },
        worked('same-die', 2, 3),
        check('check-1', 'same-die', 3, 3), check('check-2', 'same-die', 4, 3), check('check-3', 'same-die', 5, 3),
        practice('same-die', 3), check('check-hook', 'same-die', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'No opposite pair together, and the same clockwise order round the corner.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 16, pass: 6, marking: 'plain', questions: [{ kind: 'die-positions', level: 3, count: 3 }, { kind: 'die-roll', level: 3, count: 3 }, { kind: 'same-die', level: 3, count: 2 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'stacks', title: 'Stacked dice', minutes: 14, level: 4, summary: 'In a stack, each die\'s top and bottom are the pair containing neither visible side.', steps: [
        hook('The dice are not standard. Read the pairs from the net.', 'die-stack-sum', 1, 4),
        { id: 'pair', kind: 'slide', title: 'Top and bottom are a pair', text: 'For each die you see two side faces. Its top and bottom are the opposite pair that contains neither of them.' },
        worked('die-stack-sum', 2, 4),
        check('check-1', 'die-stack-sum', 3, 4), check('check-2', 'die-stack-sum', 4, 4), check('check-3', 'die-stack-sum', 5, 4),
        practice('die-stack-sum', 4), check('check-hook', 'die-stack-sum', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Pairs from the net; each die\'s vertical pair is the one with neither visible side.' }] },
      { id: 'long-rolls', title: 'Long rolls with a strange die', minutes: 12, level: 4, summary: 'Five to seven rolls with a die known only from its net.', steps: [
        hook('A long path and an unusual die. The net tells you every face.', 'die-roll', 1, 4),
        { id: 'net-first', kind: 'slide', title: 'Read the die first', text: 'From the net write the three opposite pairs. From the picture you know top, front and right; their opposites give the rest. Then roll as before.' },
        check('check-1', 'die-roll', 2, 4), check('check-2', 'die-roll', 3, 4), check('check-3', 'die-roll', 5, 4),
        practice('die-roll', 4), check('check-hook', 'die-roll', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Pairs from the net, then the same table of top, front and right.' }] },
      { id: 'touching', title: 'Dice in a row, and harder pictures', minutes: 12, level: 4, summary: 'Left and right faces of touching dice, and opposites found by elimination.', steps: [
        hook('Touching dice hide their left and right faces.', 'die-row-hidden', 1, 4),
        { id: 'third-pair', kind: 'slide', title: 'The third pair', text: 'Each die shows its top and front, which belong to two of the three pairs. Its left and right faces are the third pair.' },
        check('check-1', 'die-row-hidden', 2, 4), check('check-2', 'die-row-hidden', 3, 4),
        { id: 'eliminate', kind: 'slide', title: 'Pair off the others first', text: 'If a number is seen beside only three others, find the opposites of other numbers first. The pairs left over decide it.' },
        check('check-3', 'die-positions', 1, 4),
        practice('die-row-hidden', 4), check('check-hook', 'die-row-hidden', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Visible faces name two pairs; the hidden sides are the third.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 18, pass: 5, marking: 'plain', questions: [{ kind: 'die-stack-sum', level: 4, count: 3 }, { kind: 'die-roll', level: 4, count: 2 }, { kind: 'die-row-hidden', level: 4, count: 2 }, { kind: 'die-positions', level: 4, count: 1 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 8, level: 5, summary: 'The rules once more, then mixed practice before the timed set.', steps: [
        { id: 'rules', kind: 'slide', title: 'Dice in one screen', text: ['Standard: opposites add to 7. Otherwise: pairs from the net, or neighbours from the pictures.', 'Rolling: the far side comes up. Stacks and rows: the hidden pair is the one with neither visible face.'] },
        { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'About two minutes a question. Typed answers lose nothing when wrong; always enter one.' },
        { id: 'practice-1', kind: 'practice', question: { kind: 'die-positions', level: 3 }, streak: 2 },
        { id: 'practice-2', kind: 'practice', question: { kind: 'die-stack-sum', level: 4 }, streak: 2 },
        { id: 'remember', kind: 'takeaway', body: 'Pairs first, always.' }] },
    ], quiz: { title: 'Timed exam set', minutes: 24, pass: 9, marking: 'uceed', description: 'Twelve dice questions at exam pace, marked like UCEED.', questions: [{ kind: 'die-positions', level: 3, count: 3 }, { kind: 'die-roll', level: 3, count: 2 }, { kind: 'die-roll', level: 4, count: 2 }, { kind: 'same-die', level: 3, count: 1 }, { kind: 'die-stack-sum', level: 4, count: 2 }, { kind: 'die-row-hidden', level: 4, count: 2 }] } },
  ],
});
