// Visual series, matrices, analogies and odd one out.
// Specification: docs/learn/topics/visual-patterns.md.
const mixer = rules => ({ tool: 'rule-mixer', props: { rules } });
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const visualPatternsProgramme = Object.freeze({
  slug: 'visual-patterns', title: 'Visual series and matrices',
  summary: 'Find the rule in a series of figures, complete a grid, carry a change across an analogy, and spot the odd one out.',
  topic: 'logical-reasoning', exams: ['uceed', 'ceed', 'nid', 'nift'], minutes: 100, status: 'preview',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'one-rule', title: 'One rule at a time', minutes: 10, level: 1, summary: 'A shape turns, moves round, multiplies or changes colour, the same way each step.', steps: [
        { id: 'rules', kind: 'slide', title: 'Four kinds of change', text: 'Most series use a few simple changes: a shape turns by a set angle, moves round the edge, grows in number, or changes colour in a repeating order.', ...mixer(['spin', 'orbit', 'count', 'fill']), hint: 'Switch rules on one at a time and read each change.' },
        check('check-1', 'series-next', 1, 1), check('check-2', 'series-next', 2, 1), check('check-3', 'series-next', 4, 1), check('check-4', 'series-next', 5, 1),
        { id: 'remember', kind: 'takeaway', body: 'Name the change between two figures, check it on the next pair, then apply it once more.' }] },
      { id: 'odd-colour', title: 'The odd one out', minutes: 8, level: 2, summary: 'Three figures are the same turned; one has changed.', steps: [
        { id: 'turn-them', kind: 'slide', title: 'Turn them to match', text: 'Pick one part, such as the point of the big shape, and turn each figure in your head until it points the same way. Then compare the rest.' },
        check('check-1', 'odd-one-out', 1, 2), check('check-2', 'odd-one-out', 2, 2), check('check-3', 'series-next', 1, 2), check('check-4', 'series-next', 3, 2),
        { id: 'remember', kind: 'takeaway', body: 'Turn to a common landmark, then compare part by part.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain', questions: [{ kind: 'series-next', level: 1, count: 3 }, { kind: 'series-next', level: 2, count: 3 }, { kind: 'odd-one-out', level: 2, count: 2 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'two-rules', title: 'Two rules at once', minutes: 12, level: 3, summary: 'Different parts of the figure follow different rules. Track each part on its own.', steps: [
        hook('Two parts, two rules. Follow one part across the whole series first.', 'series-next', 1, 3),
        { id: 'separate', kind: 'slide', title: 'One part at a time', text: 'Cover everything except one part and follow it across. Then do the same for the next part. Wrong options usually get one part right and the other wrong.', ...mixer(['spin', 'orbit', 'fill']), hint: 'Switch two rules on and watch each part move on its own.' },
        worked('series-next', 2, 3),
        check('check-1', 'series-next', 3, 3), check('check-2', 'series-next', 4, 3), check('check-3', 'series-next', 6, 3),
        practice('series-next', 3), check('check-hook', 'series-next', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Split the figure into parts and find a rule for each.' }] },
      { id: 'grids', title: 'Completing a grid', minutes: 12, level: 3, summary: 'A rule along the rows and another down the columns.', steps: [
        hook('The missing figure must fit its row and its column.', 'matrix-cell', 1, 3),
        { id: 'rows-columns', kind: 'slide', title: 'Rows, then columns', text: 'Read along the rows: often each shape appears once in every row. Read down the columns: often the colour or size stays the same. The answer satisfies both.' },
        worked('matrix-cell', 2, 3),
        check('check-1', 'matrix-cell', 3, 3), check('check-2', 'matrix-cell', 4, 3), check('check-3', 'matrix-cell', 5, 3),
        practice('matrix-cell', 3), check('check-hook', 'matrix-cell', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'One rule along the rows, one down the columns. The answer obeys both.' }] },
      { id: 'analogies', title: 'Analogies', minutes: 12, level: 3, summary: 'Do to the third figure exactly what was done to the first.', steps: [
        hook('The first figure changes into the second. Do the same to the third.', 'analogy', 1, 3),
        { id: 'name-it', kind: 'slide', title: 'Name every change', text: 'Write down each change: a turn (which way), a flip, a colour swap, a size swap. A turn and a flip can look alike; a slanted part tells them apart.' },
        worked('analogy', 2, 3),
        check('check-1', 'analogy', 3, 3), check('check-2', 'analogy', 4, 3), check('check-3', 'analogy', 5, 3),
        practice('analogy', 3), check('check-hook', 'analogy', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'List the changes, then apply exactly those, in the same order.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 14, pass: 6, marking: 'plain', questions: [{ kind: 'series-next', level: 3, count: 3 }, { kind: 'matrix-cell', level: 3, count: 3 }, { kind: 'analogy', level: 3, count: 2 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'three-rules', title: 'Three rules and harder grids', minutes: 14, level: 4, summary: 'Three parts changing at once, and grids with three rules.', steps: [
        hook('Three parts, three rules. Track them one at a time.', 'series-next', 1, 4),
        { id: 'checklist', kind: 'slide', title: 'A checklist per option', text: 'For each option, tick each rule: is the turn right, is the moving part in the right place, is the colour right? The answer gets every tick.' },
        check('check-1', 'series-next', 2, 4), check('check-2', 'series-next', 3, 4),
        { id: 'count', kind: 'slide', title: 'Grids that count', text: 'Some grids add a third rule: how many shapes there are changes along the row. Check shape, colour and count for every option.' },
        check('check-3', 'matrix-cell', 1, 4), check('check-4', 'matrix-cell', 2, 4),
        practice('series-next', 4), check('check-hook', 'series-next', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'A tick per rule, for every option. Only one option gets them all.' }] },
      { id: 'mirror-odd', title: 'The mirror image among turns', minutes: 12, level: 4, summary: 'Three figures are turned copies; one is the mirror image, which no turn can make.', steps: [
        hook('All four look alike. One cannot be turned to match the others.', 'odd-one-out', 1, 4),
        { id: 'side', kind: 'slide', title: 'Which side is the small part on?', text: 'Turn each figure until the big shape points up. In a turned copy the small parts stay on the same side; in the mirror image they swap sides.' },
        worked('odd-one-out', 2, 4),
        check('check-1', 'odd-one-out', 3, 4), check('check-2', 'odd-one-out', 4, 4), check('check-3', 'odd-one-out', 6, 4),
        practice('odd-one-out', 4), check('check-hook', 'odd-one-out', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Point the big shape up; the mirror image has its small parts on the other side.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 16, pass: 5, marking: 'plain', questions: [{ kind: 'series-next', level: 4, count: 3 }, { kind: 'matrix-cell', level: 4, count: 2 }, { kind: 'odd-one-out', level: 4, count: 2 }, { kind: 'analogy', level: 3, count: 1 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 8, level: 5, summary: 'The methods once more, then mixed practice before the timed set.', steps: [
        { id: 'methods', kind: 'slide', title: 'One part, one rule', text: ['Series: split the figure into parts and find a rule for each. Grids: rows, then columns.', 'Analogies: name every change. Odd one out: turn to a landmark; look for the mirror image.'] },
        { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'About a minute a question. Rule options out: each wrong option breaks exactly one rule.' },
        { id: 'practice-1', kind: 'practice', question: { kind: 'series-next', level: 4 }, streak: 2 },
        { id: 'practice-2', kind: 'practice', question: { kind: 'matrix-cell', level: 4 }, streak: 2 },
        { id: 'remember', kind: 'takeaway', body: 'Every rule, every option.' }] },
    ], quiz: { title: 'Timed exam set', minutes: 16, pass: 9, marking: 'uceed', description: 'Twelve pattern questions at exam pace, marked like UCEED.', questions: [{ kind: 'series-next', level: 3, count: 2 }, { kind: 'series-next', level: 4, count: 3 }, { kind: 'matrix-cell', level: 3, count: 1 }, { kind: 'matrix-cell', level: 4, count: 2 }, { kind: 'analogy', level: 3, count: 2 }, { kind: 'odd-one-out', level: 4, count: 2 }] } },
  ],
});
