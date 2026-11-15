// Visual observation: odd icons, pattern breaks, counting in clutter,
// spotting differences and letter symmetry. Specification:
// docs/learn/topics/observation.md.
const scanner = { tool: 'feature-scanner', props: {} };
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const observationProgramme = Object.freeze({
  slug: 'observation-skills', title: 'Visual observation',
  summary: 'Find the odd one out, the tile that breaks a pattern, every shape in a cluttered picture, and every difference between two pictures.',
  topic: 'observation', exams: ['uceed', 'ceed', 'nid', 'nift'], minutes: 80, status: 'preview',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'one-feature', title: 'One feature at a time', minutes: 8, level: 2, summary: 'Scan the whole grid for one feature, then the next.', steps: [
        { id: 'scan', kind: 'slide', title: 'Scan, do not stare', text: 'Comparing whole pictures is slow and unreliable. Pick one feature, such as the fill, and sweep the whole grid for it. Then the next feature. Each sweep is quick and certain.', ...scanner, hint: 'Scan by fill, then hand, then dots.' },
        check('check-1', 'odd-icon', 1, 2), check('check-2', 'odd-icon', 2, 2), check('check-3', 'odd-icon', 3, 2),
        { id: 'remember', kind: 'takeaway', body: 'One feature per sweep across the whole grid.' }] },
      { id: 'letters', title: 'Letters and symmetry', minutes: 8, level: 2, summary: 'Which capitals survive a mirror, a reflection in water, or a half turn.', steps: [
        { id: 'fold', kind: 'slide', title: 'Fold it in your head', text: ['A mirror beside a letter flips left and right: A, H, I, M, O, T, U, V, W, X, Y survive.', 'Water below flips top and bottom: B, C, D, E, H, I, K, O, X survive. A half turn keeps H, I, N, O, S, X and Z.'] },
        check('check-1', 'letter-symmetry', 1, 2), check('check-2', 'letter-symmetry', 2, 2), check('check-3', 'letter-symmetry', 3, 2),
        { id: 'remember', kind: 'takeaway', body: 'Mirror: left-right. Water: top-bottom. Half turn: both at once.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 6, pass: 5, marking: 'plain', questions: [{ kind: 'odd-icon', level: 2, count: 3 }, { kind: 'letter-symmetry', level: 2, count: 3 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'subtle', title: 'Subtle differences', minutes: 10, level: 3, summary: 'A hand turned one step, one dot more.', steps: [
        hook('Sixteen icons. One is almost the same.', 'odd-icon', 1, 3),
        { id: 'small', kind: 'slide', title: 'Small changes', text: 'At exam level the odd one differs by one small feature. Sweep for each feature in turn, and for directions, compare each hand with the one beside it.', ...scanner, hint: 'Which feature finds the odd one fastest?' },
        worked('odd-icon', 2, 3),
        check('check-1', 'odd-icon', 3, 3), check('check-2', 'odd-icon', 4, 3),
        practice('odd-icon', 3), check('check-hook', 'odd-icon', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Subtle changes need feature-by-feature sweeps.' }] },
      { id: 'patterns', title: 'Patterns that break', minutes: 10, level: 3, summary: 'Find the repeat, then the tile that does not follow it.', steps: [
        hook('A repeating strip with one mistake.', 'pattern-break', 1, 3),
        { id: 'repeat', kind: 'slide', title: 'Find the repeat first', text: 'Read the first few tiles to find how often the pattern repeats. Then compare each tile with the one a full repeat before it.' },
        worked('pattern-break', 2, 3),
        check('check-1', 'pattern-break', 3, 3), check('check-2', 'pattern-break', 4, 3),
        practice('pattern-break', 3), check('check-hook', 'pattern-break', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Repeat length first, then compare across one repeat.' }] },
      { id: 'clutter', title: 'Counting in clutter', minutes: 12, level: 3, summary: 'Strips, ticks and full outlines.', steps: [
        hook('Overlapping outlines. Count one kind of shape.', 'clutter-count', 1, 3),
        { id: 'strips', kind: 'slide', title: 'Strips and ticks', text: 'Count strip by strip from the top, ticking each shape on rough paper as you go. Where outlines cross, follow each line through: a shape counts only with its own closed outline.' },
        worked('clutter-count', 2, 3),
        check('check-1', 'clutter-count', 3, 3), check('check-2', 'spot-difference', 1, 3), check('check-3', 'spot-difference', 2, 3),
        practice('clutter-count', 3), check('check-hook', 'clutter-count', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Strips, ticks, and trace every outline.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 14, pass: 6, marking: 'plain', questions: [{ kind: 'odd-icon', level: 3, count: 2 }, { kind: 'pattern-break', level: 3, count: 2 }, { kind: 'clutter-count', level: 3, count: 2 }, { kind: 'spot-difference', level: 3, count: 2 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'busier', title: 'Busier pictures', minutes: 14, level: 4, summary: 'More shapes, two conditions, and more differences.', steps: [
        hook('Only triangles pointing straight up count.', 'clutter-count', 1, 4),
        { id: 'conditions', kind: 'slide', title: 'Two conditions', text: 'When a question adds a condition, such as pointing up, first find every shape of the kind, then test each against the condition. Do not try both at once.' },
        worked('clutter-count', 2, 4),
        check('check-1', 'clutter-count', 3, 4), check('check-2', 'spot-difference', 1, 4), check('check-3', 'spot-difference', 2, 4),
        practice('spot-difference', 4), check('check-hook', 'clutter-count', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Find the kind, then test the condition.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 14, pass: 5, marking: 'plain', questions: [{ kind: 'clutter-count', level: 4, count: 4 }, { kind: 'spot-difference', level: 4, count: 3 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 8, level: 5, summary: 'The habits once more, then mixed practice before the timed set.', steps: [
        { id: 'rules', kind: 'slide', title: 'Observation in one screen', text: ['One feature per sweep. Repeat length before pattern breaks.', 'Clutter: strips, ticks and full outlines. Differences: square by square, the same features each time.'] },
        { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'About a minute a question. Typed answers lose nothing when wrong; always enter one.' },
        { id: 'practice-1', kind: 'practice', question: { kind: 'clutter-count', level: 4 }, streak: 2 },
        { id: 'practice-2', kind: 'practice', question: { kind: 'odd-icon', level: 3 }, streak: 2 },
        { id: 'remember', kind: 'takeaway', body: 'A system beats a quick look.' }] },
    ], quiz: { title: 'Timed exam set', minutes: 15, pass: 9, marking: 'uceed', description: 'Twelve observation questions at exam pace, marked like UCEED.', questions: [{ kind: 'odd-icon', level: 3, count: 2 }, { kind: 'pattern-break', level: 3, count: 2 }, { kind: 'letter-symmetry', level: 2, count: 2 }, { kind: 'clutter-count', level: 4, count: 3 }, { kind: 'spot-difference', level: 4, count: 3 }] } },
  ],
});
