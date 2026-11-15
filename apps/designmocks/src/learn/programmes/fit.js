// Fit and embedded figures: pieces that fill a gap, pairs that make a shape,
// the piece left over, and figures hidden in busy drawings.
// Specification: docs/learn/topics/fit.md.
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const fitProgramme = Object.freeze({
  slug: 'fit', title: 'Fit and hidden figures',
  summary: 'Which piece fills a gap, which pieces make a shape, which is left over, and where a figure hides in a busy drawing.',
  topic: 'visualisation', exams: ['uceed', 'ceed', 'nid', 'nift'], minutes: 80, status: 'preview',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'gaps', title: 'Filling a gap', minutes: 10, level: 2, summary: 'Count squares, then match the outline by turning.', steps: [
        { id: 'count', kind: 'slide', title: 'Count, then turn', text: ['First count the squares: the piece must have as many as the gap. Then turn the piece in your head until its outline matches.', 'Turning is allowed; flipping over is not, unless the question says so. A mirror image never fits by turning alone.'], tool: 'piece-fitter', hint: 'Turn the piece until it fits. Then flip it and see why the mirror image cannot.' },
        check('check-1', 'fill-gap', 1, 2), check('check-2', 'fill-gap', 2, 2), check('check-3', 'fill-gap', 3, 2), check('check-4', 'fill-gap', 4, 2),
        { id: 'remember', kind: 'takeaway', body: 'Same number of squares, same outline after turning, never flipped.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 6, pass: 4, marking: 'plain', questions: [{ kind: 'fill-gap', level: 2, count: 5 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'mirror-traps', title: 'Mirror-image traps', minutes: 10, level: 3, summary: 'Larger gaps with a mirror-image piece among the options.', steps: [
        hook('One of these pieces is the gap’s mirror image.', 'fill-gap', 1, 3),
        { id: 'corner', kind: 'slide', title: 'Find the telling corner', text: 'Pick the gap’s most unusual corner or step and follow it round. A mirror image has the step on the other side once it is turned to line up.' },
        worked('fill-gap', 2, 3),
        check('check-1', 'fill-gap', 3, 3), check('check-2', 'fill-gap', 4, 3), check('check-3', 'fill-gap', 5, 3),
        practice('fill-gap', 3), check('check-hook', 'fill-gap', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Line up the long side, then check which side the step is on.' }] },
      { id: 'pairs', title: 'Two pieces make a shape', minutes: 12, level: 3, summary: 'Place the awkward piece first.', steps: [
        hook('Which two pieces make this shape?', 'two-pieces', 1, 3),
        { id: 'awkward', kind: 'slide', title: 'Awkward piece first', text: 'All the pairs have the right number of squares, so outlines decide. Put the more awkward piece in the shape’s most awkward corner; the other piece must fill exactly what is left.' },
        worked('two-pieces', 2, 3),
        check('check-1', 'two-pieces', 3, 3), check('check-2', 'two-pieces', 4, 3), check('check-3', 'two-pieces', 5, 3),
        practice('two-pieces', 3), check('check-hook', 'two-pieces', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Awkward corner, awkward piece, then check the rest.' }] },
      { id: 'hidden', title: 'Hidden figures', minutes: 12, level: 3, summary: 'Same size, same way up, inside a busy drawing.', steps: [
        hook('The figure is hidden in one drawing.', 'hidden-figure', 1, 3),
        { id: 'feature', kind: 'slide', title: 'Hunt for one feature', text: 'Pick the figure’s most unusual feature, such as a slanting line meeting a straight one. Find it in each drawing, the same way up, then check every other line from there. Turned or mirrored copies do not count.' },
        worked('hidden-figure', 2, 3),
        check('check-1', 'hidden-figure', 3, 3), check('check-2', 'hidden-figure', 4, 3), check('check-3', 'hidden-figure', 5, 3),
        practice('hidden-figure', 3), check('check-hook', 'hidden-figure', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'One feature first, the same way up, then the rest.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 14, pass: 6, marking: 'plain', questions: [{ kind: 'fill-gap', level: 3, count: 3 }, { kind: 'two-pieces', level: 3, count: 3 }, { kind: 'hidden-figure', level: 3, count: 2 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'left-over', title: 'The piece left over', minutes: 12, level: 4, summary: 'Three pieces make a rectangle; find the odd one.', steps: [
        hook('Four pieces, one rectangle. One piece is spare.', 'odd-piece', 1, 4),
        { id: 'totals', kind: 'slide', title: 'Totals, then corners', text: 'Add up the squares: the three pieces must total the rectangle’s area. Then fill the rectangle from a corner with the largest piece. Two pieces that look alike are often a piece and its mirror image: only one can fit.' },
        worked('odd-piece', 2, 4),
        check('check-1', 'odd-piece', 3, 4), check('check-2', 'odd-piece', 4, 4), check('check-3', 'odd-piece', 5, 4),
        practice('odd-piece', 4), check('check-hook', 'odd-piece', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Area first, corners next, and watch for mirror twins.' }] },
      { id: 'busier', title: 'Busier drawings', minutes: 12, level: 4, summary: 'Bigger figures, more lines, and counting every copy.', steps: [
        hook('A bigger figure in a busier drawing.', 'hidden-figure', 1, 4),
        { id: 'count', kind: 'slide', title: 'Counting copies', text: 'To count copies, find every place the figure’s rarest line appears, and check the rest of the figure at each. Copies may share lines with each other.' },
        worked('hidden-count', 2, 4),
        check('check-1', 'hidden-figure', 3, 4), check('check-2', 'hidden-count', 3, 4), check('check-3', 'hidden-count', 4, 4),
        practice('hidden-count', 4), check('check-hook', 'hidden-figure', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Rarest line first; every copy, overlapping ones too.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 16, pass: 5, marking: 'plain', questions: [{ kind: 'odd-piece', level: 4, count: 3 }, { kind: 'hidden-figure', level: 4, count: 2 }, { kind: 'hidden-count', level: 4, count: 2 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 8, level: 5, summary: 'The rules once more, then mixed practice before the timed set.', steps: [
        { id: 'rules', kind: 'slide', title: 'Fitting in one screen', text: ['Count squares, then turn; never flip. Awkward corner first.', 'Hidden figures: one unusual feature, the same way up, then every other line.'] },
        { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'About a minute and a half a question. Typed answers lose nothing when wrong; always enter one.' },
        { id: 'practice-1', kind: 'practice', question: { kind: 'odd-piece', level: 4 }, streak: 2 },
        { id: 'practice-2', kind: 'practice', question: { kind: 'hidden-figure', level: 4 }, streak: 2 },
        { id: 'remember', kind: 'takeaway', body: 'Count, turn, never flip.' }] },
    ], quiz: { title: 'Timed exam set', minutes: 18, pass: 8, marking: 'uceed', description: 'Eleven fitting and hidden-figure questions at exam pace, marked like UCEED.', questions: [{ kind: 'fill-gap', level: 3, count: 2 }, { kind: 'two-pieces', level: 3, count: 2 }, { kind: 'odd-piece', level: 4, count: 2 }, { kind: 'hidden-figure', level: 3, count: 1 }, { kind: 'hidden-figure', level: 4, count: 2 }, { kind: 'hidden-count', level: 4, count: 2 }] } },
  ],
});
