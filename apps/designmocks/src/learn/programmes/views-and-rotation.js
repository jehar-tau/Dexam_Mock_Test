// Views and rotation: front, top and side views of cube solids, solids from
// their views, the views that are possible, and the same solid turned or
// mirrored. Specification: docs/learn/topics/views-and-rotation.md.
const builder = props => ({ tool: 'stack-builder', props: { showViews: true, ...props } });
const turner = { tool: 'solid-turner', props: {} };
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const viewsRotationProgramme = Object.freeze({
  slug: 'views-and-rotation', title: 'Views and rotation',
  summary: 'See a solid from the front, top and side; build it back from its views; and know it when it is turned, but not when it is mirrored.',
  topic: 'visualisation', exams: ['uceed', 'ceed', 'nid', 'nift'], minutes: 120, status: 'preview',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'three-views', title: 'Three ways to look', minutes: 10, level: 1, summary: 'Front, top and side: each view flattens one direction.', steps: [
        { id: 'flatten', kind: 'slide', title: 'Each view flattens one direction', text: 'The top view squashes the heights: you see which floor squares are used. The front view squashes the depth: each column shows the tallest stack behind it. The side view does the same from the right.', ...builder({}), hint: 'Tap squares to raise stacks and watch all three views change.' },
        { id: 'carry', kind: 'slide', title: 'Sizes carry across', text: 'Heights are the same in the front and side views. Widths are the same in the front and top. Depths are the same in the top and side.' },
        check('check-1', 'view-of-stack', 1, 1), check('check-2', 'view-of-stack', 2, 1), check('check-3', 'view-of-stack', 3, 1), check('check-4', 'view-of-stack', 8, 1),
        { id: 'remember', kind: 'takeaway', body: 'Top: the footprint. Front and side: the tallest stack in each line.' }] },
      { id: 'turning', title: 'Turning a solid', minutes: 10, level: 2, summary: 'A turned solid is the same solid; check it cube by cube.', steps: [
        { id: 'follow', kind: 'slide', title: 'Follow one cube', text: 'Choose a landmark, such as the end of the longest arm, and watch where it goes as the solid turns. Every other cube keeps its place relative to it.', ...turner, hint: 'Turn and tip the solid a few times. It always matches the start.' },
        check('check-1', 'same-solid', 1, 2), check('check-2', 'same-solid', 2, 2), check('check-3', 'same-solid', 3, 2), check('check-4', 'view-of-stack', 4, 2),
        { id: 'remember', kind: 'takeaway', body: 'Pick a landmark and follow it. Same cubes, same places relative to it: same solid.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain', questions: [{ kind: 'view-of-stack', level: 1, count: 3 }, { kind: 'view-of-stack', level: 2, count: 2 }, { kind: 'same-solid', level: 2, count: 3 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'solid-from-views', title: 'From views to the solid', minutes: 12, level: 3, summary: 'Start from the top view, then raise each square to the heights the front and side allow.', steps: [
        hook('Three views, four stacks. Three of them differ in just one view.', 'solid-from-views', 1, 3),
        { id: 'footprint', kind: 'slide', title: 'Footprint first', text: 'Rule out every stack whose floor squares do not match the top view. Then check the tallest stack in each column against the front view, and in each row against the side.', ...builder({}), hint: 'Build a stack, then change one height and see which view changes.' },
        { id: 'one-view', kind: 'slide', title: 'The trap is one view', text: 'A wrong option usually matches two views and fails the third. Check all three before choosing.' },
        worked('solid-from-views', 2, 3),
        check('check-1', 'solid-from-views', 3, 3), check('check-2', 'solid-from-views', 4, 3), check('check-3', 'solid-from-views', 5, 3),
        practice('solid-from-views', 3), check('check-hook', 'solid-from-views', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Top first, then front, then side. A wrong option fails exactly one of them.' }] },
      { id: 'missing-view', title: 'The missing view', minutes: 12, level: 3, summary: 'Given the top and front, more than one side view can be possible.', steps: [
        hook('Several side views may fit. Find every one.', 'missing-view', 1, 3),
        { id: 'allowed', kind: 'slide', title: 'What each row may be', text: 'A row of the side view can be at most as tall as its tallest square allows: a square in that row, under a front column that tall. A row with no square in the top view must be empty.' },
        { id: 'many', kind: 'slide', title: 'More than one answer', text: 'Different stacks can share a top and front view yet have different sides. If a side view is possible for any of them, it counts.' },
        worked('missing-view', 2, 3),
        check('check-1', 'missing-view', 3, 3), check('check-2', 'missing-view', 4, 3), check('check-3', 'missing-view', 6, 3),
        practice('missing-view', 3), check('check-hook', 'missing-view', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Each row of the side view: no taller than its tallest allowed square. Every possible view counts.' }] },
      { id: 'mirror-twin', title: 'The mirror twin', minutes: 12, level: 3, summary: 'A mirror image looks right from some sides but can never be turned to match.', steps: [
        hook('One option is the mirror image. It looks almost right.', 'same-solid', 1, 3),
        { id: 'walk', kind: 'slide', title: 'Walk the solid', text: 'Start at one end and walk along the solid: straight, turn, turn. The mirror image turns the other way at one step, however it is turned.', ...turner, hint: 'Show the mirror image, then try to turn it back to the start. You cannot.' },
        worked('same-solid', 2, 3),
        check('check-1', 'same-solid', 3, 3), check('check-2', 'same-solid', 4, 3), check('check-3', 'same-solid', 6, 3),
        practice('same-solid', 3), check('check-hook', 'same-solid', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Walk from a landmark and note each turn. The mirror twin turns the other way once.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 16, pass: 6, marking: 'plain', questions: [{ kind: 'solid-from-views', level: 3, count: 3 }, { kind: 'missing-view', level: 3, count: 2 }, { kind: 'same-solid', level: 3, count: 3 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'turn-then-view', title: 'Turn, then look', minutes: 14, level: 4, summary: 'A quarter turn brings a side round to the front.', steps: [
        hook('The stack turns on the spot. What does the front look like now?', 'view-after-turn', 1, 4),
        { id: 'swap', kind: 'slide', title: 'A side comes to the front', text: 'Turned a quarter turn clockwise seen from above, the right side comes round to the front and the back comes round to the right. Half a turn brings the back to the front, and left and right swap.' },
        worked('view-after-turn', 2, 4),
        check('check-1', 'view-after-turn', 3, 4), check('check-2', 'view-after-turn', 4, 4), check('check-3', 'view-after-turn', 7, 4),
        practice('view-after-turn', 4), check('check-hook', 'view-after-turn', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Redraw the floor plan after the turn, then read the view from it.' }] },
      { id: 'rotation-sets', title: 'Find every match', minutes: 14, level: 4, summary: 'Several options may be the same solid; check each against one landmark.', steps: [
        hook('More than one option may match. Check every one.', 'same-solid', 2, 4),
        { id: 'each', kind: 'slide', title: 'Every option, the same check', text: 'For each option find the same landmark and walk the solid the same way. Count the cubes too: a variant with one cube moved has the right number but the wrong shape.' },
        check('check-1', 'same-solid', 1, 4), check('check-2', 'same-solid', 3, 4), check('check-3', 'same-solid', 4, 4),
        { id: 'max', kind: 'slide', title: 'Views tell you the most cubes', text: 'From three views, the largest stack puts on each used square the smaller of its front and side heights. Counting those gives the most cubes the views allow.' },
        check('check-4', 'views-max', 2, 4),
        practice('same-solid', 4), check('check-hook', 'same-solid', 2, 4),
        { id: 'remember', kind: 'takeaway', body: 'Same landmark, same walk, for every option. Do not stop at the first match.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 18, pass: 5, marking: 'plain', questions: [{ kind: 'view-after-turn', level: 4, count: 3 }, { kind: 'same-solid', level: 4, count: 2 }, { kind: 'missing-view', level: 3, count: 2 }, { kind: 'views-max', level: 4, count: 1 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 8, level: 5, summary: 'The methods once more, then mixed practice before the timed set.', steps: [
        { id: 'methods', kind: 'slide', title: 'Views and turns', text: ['Views: top is the footprint; front and side show the tallest stack in each line. Check all three.', 'Turns: follow a landmark. A mirror image turns the other way once and never matches.'] },
        { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'About two minutes a question. In select-all questions, check every option; a wrong pick costs marks.' },
        { id: 'practice-1', kind: 'practice', question: { kind: 'solid-from-views', level: 3 }, streak: 2 },
        { id: 'practice-2', kind: 'practice', question: { kind: 'same-solid', level: 3 }, streak: 2 },
        { id: 'remember', kind: 'takeaway', body: 'Three views, every option, one landmark.' }] },
    ], quiz: { title: 'Timed exam set', minutes: 24, pass: 9, marking: 'uceed', description: 'Twelve views and rotation questions at exam pace, marked like UCEED.', questions: [{ kind: 'solid-from-views', level: 3, count: 2 }, { kind: 'missing-view', level: 3, count: 2 }, { kind: 'same-solid', level: 3, count: 2 }, { kind: 'same-solid', level: 4, count: 1 }, { kind: 'view-after-turn', level: 4, count: 3 }, { kind: 'views-max', level: 4, count: 2 }] } },
  ],
});
