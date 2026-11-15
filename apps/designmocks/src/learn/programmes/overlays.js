// Transparent sheets and overlays: stacking sheets as drawn, turned or
// flipped; folding one sheet onto itself; counting overlaps.
// Specification: docs/learn/topics/overlays.md.
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const overlaysProgramme = Object.freeze({
  slug: 'overlays', title: 'Transparent sheets',
  summary: 'Stack see-through sheets, turned or flipped first, fold a sheet onto itself, and count the squares that overlap.',
  topic: 'visualisation', exams: ['uceed', 'ceed', 'nid'], minutes: 70, status: 'preview',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'stack', title: 'Stacking sheets', minutes: 10, level: 2, summary: 'Every mark on every sheet shows through.', steps: [
        { id: 'through', kind: 'slide', title: 'Everything shows', text: 'Lay transparent sheets on top of each other and every mark shows, each in its own square. Nothing hides anything else.', tool: 'sheet-stacker', hint: 'Turn and flip sheet 2 and watch the stacked result.' },
        check('check-1', 'sheet-stack', 1, 2), check('check-2', 'sheet-stack', 2, 2), check('check-3', 'sheet-stack', 3, 2), check('check-4', 'sheet-stack', 4, 2),
        { id: 'remember', kind: 'takeaway', body: 'Stacked transparent sheets: every mark, in its own square.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 6, pass: 4, marking: 'plain', questions: [{ kind: 'sheet-stack', level: 2, count: 5 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'moved', title: 'Turned or flipped first', minutes: 12, level: 3, summary: 'Move the sheet first, line marks included.', steps: [
        hook('Three sheets, one turned before stacking.', 'sheet-stack', 1, 3),
        { id: 'redraw', kind: 'slide', title: 'Redraw, then stack', text: ['Redraw the moved sheet first. A quarter turn clockwise takes the top row to the right-hand column. Flipping left to right swaps the columns.', 'Line marks move too: a quarter turn makes — into |, and both a turn and a flip make / into \\.'], tool: 'sheet-stacker', hint: 'Flip sheet 2 and follow its slanting line.' },
        worked('sheet-stack', 2, 3),
        check('check-1', 'sheet-stack', 3, 3), check('check-2', 'sheet-stack', 4, 3), check('check-3', 'sheet-stack', 5, 3),
        practice('sheet-stack', 3), check('check-hook', 'sheet-stack', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Move the sheet, turn its lines with it, then stack.' }] },
      { id: 'fold', title: 'Folding a sheet', minutes: 12, level: 3, summary: 'A fold mirrors one half onto the other.', steps: [
        hook('One sheet, folded in half. What shows?', 'sheet-fold', 1, 3),
        { id: 'mirror', kind: 'slide', title: 'A fold is a mirror', text: 'Every mark on the moving half lands as far from the fold on the other side, and slanting lines flip direction. Marks on the half that stays do not move.' },
        worked('sheet-fold', 2, 3),
        check('check-1', 'sheet-fold', 3, 3), check('check-2', 'sheet-fold', 4, 3), check('check-3', 'sheet-fold', 5, 3),
        practice('sheet-fold', 3), check('check-hook', 'sheet-fold', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Fold = mirror, lines included.' }] },
      { id: 'count', title: 'Counting overlaps', minutes: 10, level: 3, summary: 'A number in every square: how many sheets shade it.', steps: [
        hook('Three shaded sheets stacked. Count the overlaps.', 'sheet-count', 1, 3),
        { id: 'tally', kind: 'slide', title: 'A tally per square', text: 'Go square by square and write how many sheets shade it. Then count the squares with the number asked: “exactly two” leaves out squares shaded three times.' },
        worked('sheet-count', 2, 3),
        check('check-1', 'sheet-count', 3, 3), check('check-2', 'sheet-count', 4, 3),
        practice('sheet-count', 3), check('check-hook', 'sheet-count', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Tally each square, then read “exactly” carefully.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 14, pass: 6, marking: 'plain', questions: [{ kind: 'sheet-stack', level: 3, count: 3 }, { kind: 'sheet-fold', level: 3, count: 3 }, { kind: 'sheet-count', level: 3, count: 2 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'diagonal', title: 'Diagonal folds', minutes: 12, level: 4, summary: 'Across a diagonal, rows become columns.', steps: [
        hook('Folded along the diagonal.', 'sheet-fold', 1, 4),
        { id: 'swap', kind: 'slide', title: 'Rows become columns', text: 'Folding along the diagonal from top-left to bottom-right sends row r, column c to row c, column r. Level lines become upright and upright lines level; slanting lines keep their direction.' },
        worked('sheet-fold', 2, 4),
        check('check-1', 'sheet-fold', 3, 4), check('check-2', 'sheet-fold', 4, 4), check('check-3', 'sheet-fold', 5, 4),
        practice('sheet-fold', 4), check('check-hook', 'sheet-fold', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Diagonal fold: swap row and column, and level with upright.' }] },
      { id: 'moved-count', title: 'Counting after a move', minutes: 10, level: 4, summary: 'Turn or flip a sheet, then tally.', steps: [
        hook('Sheet 2 is turned before stacking. Count again.', 'sheet-count', 1, 4),
        { id: 'first', kind: 'slide', title: 'Move first, count second', text: 'Redraw the moved sheet on rough paper, then tally square by square as before.' },
        worked('sheet-count', 2, 4),
        check('check-1', 'sheet-count', 3, 4), check('check-2', 'sheet-count', 4, 4),
        practice('sheet-count', 4), check('check-hook', 'sheet-count', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Redraw, tally, count.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 14, pass: 5, marking: 'plain', questions: [{ kind: 'sheet-fold', level: 4, count: 4 }, { kind: 'sheet-count', level: 4, count: 3 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 8, level: 5, summary: 'The rules once more, then mixed practice before the timed set.', steps: [
        { id: 'rules', kind: 'slide', title: 'Sheets in one screen', text: ['Stacked: every mark shows. Moved first: redraw it, lines turning too.', 'Folded: a mirror across the fold. Counting: a tally in every square.'] },
        { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'About a minute and a half a question. Typed answers lose nothing when wrong; always enter one.' },
        { id: 'practice-1', kind: 'practice', question: { kind: 'sheet-fold', level: 4 }, streak: 2 },
        { id: 'practice-2', kind: 'practice', question: { kind: 'sheet-count', level: 4 }, streak: 2 },
        { id: 'remember', kind: 'takeaway', body: 'Redraw before you stack.' }] },
    ], quiz: { title: 'Timed exam set', minutes: 16, pass: 7, marking: 'uceed', description: 'Ten transparent-sheet questions at exam pace, marked like UCEED.', questions: [{ kind: 'sheet-stack', level: 3, count: 3 }, { kind: 'sheet-fold', level: 3, count: 2 }, { kind: 'sheet-fold', level: 4, count: 2 }, { kind: 'sheet-count', level: 4, count: 3 }] } },
  ],
});
