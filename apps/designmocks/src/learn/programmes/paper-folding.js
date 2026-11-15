// Paper folding and cutting. Foundations punches holes through a folded
// sheet; the upper tiers cut shapes on its edges, cut straight across it,
// fold flaps on a two-coloured sheet and print a letter on top of it.
// Specification: docs/learn/topics/paper-folding.md.
const cutter = (sets, shapes) => ({ tool: 'cut-unfolder', props: { sets, shapes } });
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level, id = 'worked-1') => ({ id, kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const paperFoldingProgramme = Object.freeze({
  slug: 'paper-folding',
  title: 'Paper folding and punching',
  summary: 'Fold a sheet, punch or cut it, and know the pattern before it is opened: holes, notches, pieces, flaps and printed letters.',
  topic: 'visualisation',
  exams: ['uceed', 'ceed', 'nid', 'nift'],
  minutes: 120,
  status: 'preview',
  tiers: [
    {
      id: 'foundations', title: 'Foundations', level: 2,
      lessons: [
        {
          id: 'layers', title: 'Folds make layers', minutes: 8, level: 1,
          summary: 'Every fold doubles the layers, and every punch makes one hole per layer.',
          steps: [
            { id: 'one-fold', kind: 'slide', title: 'One fold, two holes', text: 'Fold a sheet in half and punch once. The punch goes through both layers, so the unfolded sheet has two holes, mirror images across the fold line.', tool: 'fold-punch', hint: 'Fold once, then tap the sheet to punch it. Watch the unfolded pattern.' },
            { id: 'doubling', kind: 'slide', title: 'Each fold doubles the layers', text: ['Two folds give four layers; three folds give eight. One punch through all of them makes that many holes.', 'The fold direction does not change the count. It changes where the holes land.'] },
            { id: 'check-1', kind: 'check', question: { kind: 'fold-count', seed: 71 } },
            { id: 'check-2', kind: 'check', question: { kind: 'fold-count', seed: 72 } },
            { id: 'check-3', kind: 'check', question: { kind: 'fold-count', seed: 75 } },
            { id: 'remember', kind: 'takeaway', body: 'Count the layers: every fold doubles them, and each punch makes one hole per layer.' },
          ],
        },
        {
          id: 'unfold', title: 'Unfolding in reverse', minutes: 12, level: 2,
          summary: 'Undo the last fold first, mirroring every hole across its fold line, then the fold before it.',
          steps: [
            { id: 'reverse', kind: 'slide', title: 'Undo the last fold first', text: 'To find the pattern, unfold in reverse order. Undo the last fold and mirror every hole across that fold line. Then undo the fold before it, mirroring everything you have so far.', tool: 'fold-punch', hint: 'Make two folds, punch, and compare the unfolded sheet with what you expected.' },
            { id: 'never-turn', kind: 'slide', title: 'Holes mirror, they never turn', text: 'A fold is a reflection. If an option looks like the right pattern turned a quarter turn, it is wrong. If a hole sits on the wrong side of a fold line, it is wrong.' },
            { id: 'check-1', kind: 'check', question: { kind: 'unfold', seed: 81 } },
            { id: 'check-2', kind: 'check', question: { kind: 'unfold', seed: 82 } },
            { id: 'check-3', kind: 'check', question: { kind: 'unfold', seed: 83 } },
            { id: 'check-4', kind: 'check', question: { kind: 'unfold', seed: 84 } },
            { id: 'remember', kind: 'takeaway', body: 'Unfold in reverse. Mirror across each fold line in turn, and never let a hole turn.' },
          ],
        },
      ],
      quiz: { title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain', questions: [{ kind: 'fold-count', level: 1, count: 3 }, { kind: 'unfold', level: 2, count: 5 }] },
    },
    {
      id: 'exam-standard', title: 'Exam standard', level: 3,
      lessons: [
        {
          id: 'notches', title: 'Edge or fold?', minutes: 12, level: 3,
          summary: 'A cut on a fold opens into a whole shape across the crease. A cut on the sheet\'s own edge stays a notch.',
          steps: [
            hook('The coloured parts are cut away. Two of the edges you see are folds, two are the sheet\'s own edges.', 'unfold-cuts', 2, 3),
            { id: 'which-edge', kind: 'slide', title: 'Which edges are folds?', text: 'After folding the right half over, the packet\'s right edge is the fold. After folding the bottom half up, the bottom edge is the fold. The other edges are the sheet\'s own edges.', ...cutter(['half', 'quarter'], ['semicircle', 'triangle']), hint: 'Cut the right edge, then the left edge. Drag Unfold and compare.' },
            { id: 'whole', kind: 'slide', title: 'On a fold: a whole shape', text: 'A half circle cut on a fold opens into a full circle, because the crease is the middle of the shape. A cut where two folds meet opens into one shape in the middle of the sheet.' },
            { id: 'notch', kind: 'slide', title: 'On an outer edge: a notch', text: 'A cut on the sheet\'s own edge has nothing beyond it. It opens into notches along the edges of the sheet, mirrored across each fold.' },
            worked('unfold-cuts', 10, 3),
            check('check-1', 'unfold-cuts', 1, 3), check('check-2', 'unfold-cuts', 7, 3), check('check-3', 'unfold-cuts', 19, 3),
            practice('unfold-cuts', 3),
            check('check-hook', 'unfold-cuts', 2, 3),
            { id: 'remember', kind: 'takeaway', body: 'Find the folds first. On a fold, a cut becomes a whole shape; on an outer edge, it stays a notch.' },
          ],
        },
        {
          id: 'diagonal', title: 'The diagonal fold', minutes: 12, level: 3,
          summary: 'Folding corner to corner makes eight layers and copies everything across the diagonal.',
          steps: [
            hook('Three folds, the last one corner to corner. Eight layers.', 'unfold', 3, 3),
            { id: 'swap', kind: 'slide', title: 'The diagonal swaps across and down', text: 'Undoing a diagonal fold copies each mark across the line from corner to corner. A mark two along and one down gets a copy one along and two down.', ...cutter(['corner'], ['semicircle', 'triangle']), hint: 'Cut the diagonal edge and drag Unfold one step at a time.' },
            { id: 'square-only', kind: 'slide', title: 'Only a square takes it', text: 'A diagonal fold needs a square packet, so it always comes after the half folds. Undo it first, then the half folds.' },
            worked('unfold-cuts', 16, 3),
            check('check-1', 'unfold', 1, 3), check('check-2', 'unfold', 5, 3), check('check-3', 'unfold-cuts', 5, 3), check('check-4', 'unfold-cuts', 23, 3),
            practice('unfold', 3),
            check('check-hook', 'unfold', 3, 3),
            { id: 'remember', kind: 'takeaway', body: 'Undo the diagonal first: copy each mark across the corner-to-corner line. Then undo the half folds.' },
          ],
        },
        {
          id: 'counting-holes', title: 'How many holes?', minutes: 10, level: 3,
          summary: 'Count complete holes: punches in the middle, cuts on folds joined into one, notches at the edge left out.',
          steps: [
            hook('Type the number of complete holes. Notches at the edge are not holes.', 'hole-count', 1, 3),
            { id: 'three-kinds', kind: 'slide', title: 'Three kinds of mark', text: ['A punch in the middle of the packet: one hole for every layer.', 'A cut on a fold: two layers make one hole. A cut on an outer edge: notches, not holes.'] },
            worked('hole-count', 2, 3),
            check('check-1', 'hole-count', 4, 3), check('check-2', 'hole-count', 5, 3), check('check-3', 'hole-count', 9, 3),
            practice('hole-count', 3),
            check('check-hook', 'hole-count', 1, 3),
            { id: 'remember', kind: 'takeaway', body: 'Layers × punches, then halve the cuts on folds and drop the cuts on outer edges.' },
          ],
        },
      ],
      quiz: { title: 'Exam standard quiz', minutes: 16, pass: 6, marking: 'plain', questions: [{ kind: 'unfold', level: 3, count: 2 }, { kind: 'unfold-cuts', level: 3, count: 4 }, { kind: 'hole-count', level: 3, count: 2 }] },
    },
    {
      id: 'exam-hard', title: 'Exam hard', level: 4,
      lessons: [
        {
          id: 'asymmetric', title: 'Shapes that flip', minutes: 14, level: 4,
          summary: 'A slanted cut faces the other way in every neighbouring copy. The close wrong answer has one copy facing the wrong way.',
          steps: [
            hook('All four patterns have the cuts in the same places. Look at which way each one faces.', 'unfold-cuts', 2, 4),
            { id: 'flip', kind: 'slide', title: 'Each copy is a mirror image', text: 'Undoing a fold mirrors a cut. A slanted cut that leans right in the packet leans left in the copy across the fold, and right again in the copy beyond that.', ...cutter(['quarter', 'corner'], ['right-triangle', 'step']), hint: 'Choose a slanted shape and unfold one step at a time. Watch it flip.' },
            { id: 'pairs', kind: 'slide', title: 'Check in pairs', text: 'Take any two copies on either side of a crease. They must be mirror images of each other. One pair that faces the same way rules the option out.' },
            worked('unfold-cuts', 5, 4),
            check('check-1', 'unfold-cuts', 1, 4), check('check-2', 'unfold-cuts', 9, 4), check('check-3', 'unfold-cuts', 16, 4),
            practice('unfold-cuts', 4),
            check('check-hook', 'unfold-cuts', 2, 4),
            { id: 'remember', kind: 'takeaway', body: 'Across every crease, a slanted cut and its copy are mirror images. One pair facing the same way is wrong.' },
          ],
        },
        {
          id: 'two-colours', title: 'Two-coloured sheets', minutes: 12, level: 4,
          summary: 'A flap folded over shows the back of the sheet and leaves its own edge behind.',
          steps: [
            hook('Green on the front, orange on the back. Each shaded part is folded over.', 'two-colour-fold', 1, 4),
            { id: 'back', kind: 'slide', title: 'The flap shows the back', text: 'A part folded over lands face down, so you see its back: the other colour. It lands as its mirror image across the fold line.' },
            { id: 'outline', kind: 'slide', title: 'The edge moves in', text: 'The flap has left the edge it came from. The outline is now shorter there by the width of the flap, or cut off at the corner.' },
            worked('two-colour-fold', 2, 4),
            check('check-1', 'two-colour-fold', 4, 4), check('check-2', 'two-colour-fold', 7, 4), check('check-3', 'two-colour-fold', 10, 4),
            practice('two-colour-fold', 4),
            check('check-hook', 'two-colour-fold', 1, 4),
            { id: 'remember', kind: 'takeaway', body: 'A flap shows the back colour, lands as its mirror image, and shortens the edge it left.' },
          ],
        },
        {
          id: 'other-side', title: 'Seen from the other side, and cut across', minutes: 14, level: 4,
          summary: 'Where a letter printed on top of the packet ends up, and how many pieces a straight cut makes.',
          steps: [
            hook('The letter is printed on top of the folded packet. Where is it on the opened sheet, and which way round?', 'seen-from-behind', 1, 4),
            { id: 'top', kind: 'slide', title: 'The top is the last flap', text: 'The top of the packet is the part folded over last. When it is opened, that part lies face down: the letter is on the back of the sheet, back to front from the front.' },
            { id: 'turn', kind: 'slide', title: 'Turn it over to read it', text: 'Turning the sheet over left to right brings the letter to the front, reading the right way round. Its position is mirrored left to right as well.' },
            worked('seen-from-behind', 2, 4),
            check('check-1', 'seen-from-behind', 4, 4), check('check-2', 'seen-from-behind', 8, 4),
            { id: 'pieces', kind: 'slide', title: 'One cut, many pieces', text: 'A straight cut through the packet lands on several lines of the sheet, one for each different place the layers put it. Parallel lines make one more piece than lines; lines that cross multiply.' },
            worked('piece-count', 1, 4, 'worked-2'),
            check('check-3', 'piece-count', 2, 4), check('check-4', 'piece-count', 6, 4),
            practice('seen-from-behind', 4),
            check('check-hook', 'seen-from-behind', 1, 4),
            { id: 'remember', kind: 'takeaway', body: 'The top flap opens face down. Cut lines unfold onto the sheet; count them, then count the pieces.' },
          ],
        },
      ],
      quiz: { title: 'Exam hard quiz', minutes: 20, pass: 5, marking: 'plain', questions: [{ kind: 'unfold-cuts', level: 4, count: 3 }, { kind: 'two-colour-fold', level: 4, count: 2 }, { kind: 'seen-from-behind', level: 4, count: 2 }, { kind: 'piece-count', level: 4, count: 1 }] },
    },
    {
      id: 'mastery', title: 'Mastery', level: 5,
      lessons: [
        {
          id: 'review', title: 'Mixed review', minutes: 10, level: 5,
          summary: 'The method once more, then mixed practice before the timed set.',
          steps: [
            { id: 'method', kind: 'slide', title: 'The method', text: 'Count the layers. Find which edges are folds. Undo the folds from the last to the first, mirroring every mark. Check slanted cuts in pairs across each crease.' },
            { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'Under two minutes a question. Single-choice questions lose marks when wrong, so rule options out: wrong number of copies first, then wrong positions, then wrong facing.' },
            { id: 'practice-1', kind: 'practice', question: { kind: 'unfold-cuts', level: 4 }, streak: 2 },
            { id: 'practice-2', kind: 'practice', question: { kind: 'two-colour-fold', level: 4 }, streak: 2 },
            { id: 'remember', kind: 'takeaway', body: 'Layers, folds, reverse, pairs. In that order, every time.' },
          ],
        },
      ],
      quiz: { title: 'Timed exam set', minutes: 20, pass: 9, marking: 'ceed', description: 'Twelve folding questions at exam pace, marked like CEED.', questions: [{ kind: 'unfold', level: 3, count: 2 }, { kind: 'unfold-cuts', level: 3, count: 2 }, { kind: 'unfold-cuts', level: 4, count: 3 }, { kind: 'hole-count', level: 3, count: 2 }, { kind: 'two-colour-fold', level: 4, count: 1 }, { kind: 'seen-from-behind', level: 4, count: 1 }, { kind: 'piece-count', level: 4, count: 1 }] },
    },
  ],
});
