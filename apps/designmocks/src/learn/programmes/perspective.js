// Perspective and viewpoint: eye level, one-, two- and three-point
// perspective, vanishing points, eye height and which view is from where.
// Specification: docs/learn/topics/perspective.md.
const box = { tool: 'perspective-box', props: {} };
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const perspectiveProgramme = Object.freeze({
  slug: 'perspective', title: 'Perspective and viewpoint',
  summary: 'Eye level and the horizon, one-, two- and three-point perspective, vanishing points, and which picture is taken from where.',
  topic: 'visualisation', exams: ['uceed', 'ceed', 'nid', 'nift'], minutes: 80, status: 'preview',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'horizon', title: 'The horizon is your eye level', minutes: 8, level: 2, summary: 'Below eye level you see tops; above it, bottoms.', steps: [
        { id: 'eye', kind: 'slide', title: 'Eye level', text: 'The horizon line in a drawing is always at the viewer’s eye level. Things below it show their tops; things above it show their bottoms; at eye level you see neither.', ...box, hint: 'Raise and lower your eye and watch the top of the box appear and vanish.' },
        check('check-1', 'eye-level', 1, 2), check('check-2', 'eye-level', 2, 2), check('check-3', 'eye-level', 3, 2),
        { id: 'remember', kind: 'takeaway', body: 'Horizon = eye level. Below it, tops; above it, bottoms.' }] },
      { id: 'points', title: 'One, two and three points', minutes: 8, level: 2, summary: 'Count the sets of parallel edges that meet.', steps: [
        { id: 'count', kind: 'slide', title: 'How many meet?', text: ['Face a box square on: only the edges running away meet, at one point. Turn it: both sets of level edges meet, at two points on the horizon.', 'Look up or down at a tall box: its uprights lean together too, towards a third point.'], ...box, hint: 'Turn the box, then tilt your view up.' },
        check('check-1', 'perspective-type', 1, 2), check('check-2', 'perspective-type', 2, 2), check('check-3', 'perspective-type', 3, 2),
        { id: 'remember', kind: 'takeaway', body: 'Square on: one. Turned: two. Looking up or down: three.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 6, pass: 5, marking: 'plain', questions: [{ kind: 'eye-level', level: 2, count: 3 }, { kind: 'perspective-type', level: 2, count: 3 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'vanishing', title: 'Finding a vanishing point', minutes: 10, level: 3, summary: 'Extend two parallel edges.', steps: [
        hook('Which point do the edges run to?', 'vanishing-point', 1, 3),
        { id: 'extend', kind: 'slide', title: 'Extend two edges', text: 'Parallel level edges meet at one point on the horizon. Extend two of them with a ruler; where they cross is the vanishing point. It is never above or below the horizon for level edges.' },
        worked('vanishing-point', 2, 3),
        check('check-1', 'vanishing-point', 3, 3), check('check-2', 'vanishing-point', 4, 3),
        practice('vanishing-point', 3), check('check-hook', 'vanishing-point', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Level edges vanish on the horizon. Extend two and see where they cross.' }] },
      { id: 'eye-height', title: 'How high is the viewer?', minutes: 10, level: 3, summary: 'The horizon cuts everyone on flat ground at the viewer’s eye height.', steps: [
        hook('People near and far. Where does the horizon cross them?', 'eye-height', 1, 3),
        { id: 'cuts', kind: 'slide', title: 'Same cut on everyone', text: 'On flat ground, the horizon crosses every person of the same height at the same place on their body: the viewer’s eye height. If it crosses at the waist, the viewer’s eye is waist-high.' },
        worked('eye-height', 2, 3),
        check('check-1', 'eye-height', 3, 3), check('check-2', 'eye-height', 4, 3),
        practice('eye-height', 3), check('check-hook', 'eye-height', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Where the horizon cuts a person is the viewer’s eye height.' }] },
      { id: 'where-from', title: 'Which view is from where?', minutes: 10, level: 3, summary: 'Stand at the camera and read left to right.', steps: [
        hook('A plan and a camera. Which picture does it take?', 'camera-view', 1, 3),
        { id: 'stand', kind: 'slide', title: 'Stand at the camera', text: 'Turn the plan in your head so the camera is nearest you, facing into the scene. Read the objects from your left hand to your right; nearer objects look larger.' },
        worked('camera-view', 2, 3),
        check('check-1', 'camera-view', 3, 3), check('check-2', 'camera-view', 4, 3),
        practice('camera-view', 3), check('check-hook', 'camera-view', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Turn the plan to the camera, then read left to right.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 14, pass: 6, marking: 'plain', questions: [{ kind: 'vanishing-point', level: 3, count: 3 }, { kind: 'eye-height', level: 3, count: 2 }, { kind: 'camera-view', level: 3, count: 3 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'high-viewer', title: 'Viewers above the crowd', minutes: 10, level: 4, summary: 'When the horizon passes above every head.', steps: [
        hook('The horizon is above everyone. How high is the viewer?', 'eye-height', 1, 4),
        { id: 'stack', kind: 'slide', title: 'Count body-heights', text: 'If the horizon passes above the heads, stack copies of a person upward in your head until you reach it. Two body-heights up means the viewer’s eye is twice a person’s height.' },
        worked('eye-height', 2, 4),
        check('check-1', 'eye-height', 3, 4), check('check-2', 'camera-view', 1, 4), check('check-3', 'camera-view', 2, 4),
        practice('eye-height', 4), check('check-hook', 'eye-height', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Count body-heights from the feet up to the horizon.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 12, pass: 5, marking: 'plain', questions: [{ kind: 'eye-height', level: 4, count: 3 }, { kind: 'camera-view', level: 4, count: 3 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 8, level: 5, summary: 'The rules once more, then mixed practice before the timed set.', steps: [
        { id: 'rules', kind: 'slide', title: 'Perspective in one screen', text: ['Horizon = eye level. Square on: one point; turned: two; looking up or down: three.', 'Level edges vanish on the horizon. The horizon cuts every person at the viewer’s eye height. Views: stand at the camera.'] },
        { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'About a minute and a half a question. Typed answers lose nothing when wrong; always enter one.' },
        { id: 'practice-1', kind: 'practice', question: { kind: 'vanishing-point', level: 3 }, streak: 2 },
        { id: 'practice-2', kind: 'practice', question: { kind: 'camera-view', level: 4 }, streak: 2 },
        { id: 'remember', kind: 'takeaway', body: 'Find the horizon first, every time.' }] },
    ], quiz: { title: 'Timed exam set', minutes: 16, pass: 8, marking: 'uceed', description: 'Eleven perspective questions at exam pace, marked like UCEED.', questions: [{ kind: 'eye-level', level: 2, count: 1 }, { kind: 'perspective-type', level: 2, count: 2 }, { kind: 'vanishing-point', level: 3, count: 2 }, { kind: 'eye-height', level: 3, count: 1 }, { kind: 'eye-height', level: 4, count: 2 }, { kind: 'camera-view', level: 4, count: 3 }] } },
  ],
});
