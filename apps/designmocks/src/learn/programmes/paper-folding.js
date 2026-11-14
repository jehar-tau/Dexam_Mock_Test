// Paper folding and punching. Lessons 1 and 2 are built; lesson 3 (diagonal
// folds and corner punches) is planned in docs/LEARN_INTERACTIVE_PLAN.md.
export const paperFoldingProgramme = Object.freeze({
  slug: 'paper-folding',
  title: 'Paper folding and punching',
  summary: 'Fold a sheet, punch it, and know the hole pattern before it is unfolded.',
  topic: 'visualisation',
  exams: ['uceed', 'ceed', 'nid', 'nift'],
  minutes: 30,
  lessons: [
    {
      id: 'layers', title: 'Folds make layers', minutes: 8,
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
      id: 'unfold', title: 'Unfolding in reverse', minutes: 12,
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
  challenge: {
    title: 'Fold and punch challenge', minutes: 8,
    description: 'Eight questions mixing layer counts and unfolded patterns.',
    questions: [{ kind: 'fold-count', count: 3 }, { kind: 'unfold', count: 5 }],
  },
});
