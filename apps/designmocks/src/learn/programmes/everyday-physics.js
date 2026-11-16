// Everyday physics: floating, mirrors, lenses, sound, twisted loops,
// rolling, mechanism chains and control mapping.
// Specification: docs/learn/topics/everyday-physics.md.
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const physicsProgramme = Object.freeze({
  slug: 'everyday-physics', title: 'Everyday physics',
  summary: 'Why things float, how mirrors and lenses form images, how far sound travels, what twisting a loop does, how far a wheel turns, and how everyday mechanisms and controls work.',
  topic: 'mechanical', exams: ['uceed', 'nid', 'nift', 'ceed'], minutes: 80, status: 'preview',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'float-sink', title: 'Float or sink', minutes: 8, level: 2, summary: 'Less dense than the liquid floats.', steps: [
        { id: 'density', kind: 'slide', title: 'Density decides', text: 'Water is 1 g/cm³. Anything less dense floats; anything denser sinks. Cork, wood, wax and ice float; glass, aluminium and iron sink. A steel ship floats because its hollow shape makes its overall density less than water’s.' },
        check('check-1', 'floating', 1, 2), check('check-2', 'floating', 2, 2), check('check-3', 'floating', 3, 2),
        { id: 'remember', kind: 'takeaway', body: 'Compare densities: lighter than the liquid floats.' }] },
      { id: 'light-sound', title: 'Mirrors, lenses and sound', minutes: 10, level: 2, summary: 'Images behind mirrors, magnifiers, and thunder after lightning.', steps: [
        { id: 'mirror', kind: 'slide', title: 'Mirrors and lenses', text: ['A flat mirror’s image is as far behind it as you are in front. A convex lens magnifies an object inside its focal length, and forms an upside-down real image of one beyond it.'] },
        { id: 'sound', kind: 'slide', title: 'Sound is slow', text: 'Sound travels about 340 m every second; light arrives almost at once. Count the seconds between lightning and thunder: about one kilometre for every three seconds.' },
        check('check-1', 'mirror', 1, 2), check('check-2', 'lens', 1, 2), check('check-3', 'sound', 1, 2), check('check-4', 'sound', 2, 2),
        { id: 'remember', kind: 'takeaway', body: 'Mirror: as far behind as in front. Sound: 340 m/s.' }] },
      { id: 'controls', title: 'Controls that map', minutes: 6, level: 2, summary: 'Controls laid out like what they control.', steps: [
        { id: 'map', kind: 'slide', title: 'No labels needed', text: 'Good control mapping puts each control in the same layout as the thing it works: knobs in the shape of the burners, switches in the order of the lights. If people need labels to guess, the mapping is poor.' },
        check('check-1', 'phy-mapping', 1, 2), check('check-2', 'phy-mapping', 2, 2), check('check-3', 'phy-mapping', 3, 2),
        { id: 'remember', kind: 'takeaway', body: 'The layout of the controls should mirror the layout of the outcomes.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain', questions: [{ kind: 'floating', level: 2, count: 2 }, { kind: 'mirror', level: 2, count: 2 }, { kind: 'lens', level: 2, count: 1 }, { kind: 'sound', level: 2, count: 1 }, { kind: 'phy-mapping', level: 2, count: 2 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'how-much', title: 'How much floats, how far it echoes', minutes: 12, level: 3, summary: 'Fractions under water, echoes and full-length mirrors.', steps: [
        hook('Ice in sea water: how much is hidden?', 'floating', 1, 3),
        { id: 'fraction', kind: 'slide', title: 'Fraction under the surface', text: ['A floating body sinks until it pushes aside its own weight of liquid, so the fraction under the surface is its density divided by the liquid’s.', 'An echo travels there and back: halve the distance. A full-length mirror need only be half your height.'] },
        worked('floating', 2, 3),
        check('check-1', 'floating', 3, 3), check('check-2', 'sound', 1, 3), check('check-3', 'mirror', 1, 3),
        practice('floating', 3), check('check-hook', 'floating', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Density ratio under water; halve an echo; half-height mirror.' }] },
      { id: 'lens-rule', title: 'The lens rule', minutes: 10, level: 3, summary: '1/f = 1/u + 1/v.', steps: [
        hook('Where does the sharp image form?', 'lens', 1, 3),
        { id: 'rule', kind: 'slide', title: 'One rule', text: 'For a convex lens forming a real image: 1/f = 1/u + 1/v, with u the object distance and v the image distance. Rearranged: v = u f ÷ (u − f). At twice the focal length, the image is the same size and the same distance away.' },
        worked('lens', 2, 3),
        check('check-1', 'lens', 3, 3), check('check-2', 'lens', 4, 3),
        practice('lens', 3), check('check-hook', 'lens', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'v = u f ÷ (u − f).' }] },
      { id: 'loops-wheels', title: 'Twisted loops and rolling wheels', minutes: 10, level: 3, summary: 'Odd or even twists; distance over radius.', steps: [
        hook('How many edges does a twisted loop have?', 'twist', 1, 3),
        { id: 'odd', kind: 'slide', title: 'Odd or even', text: ['A loop with an odd number of half-twists has one side and one edge, like a Möbius strip. An even number, including a full twist, leaves two sides and two edges.', 'A wheel rolling without slipping turns through distance ÷ radius radians: one full turn for every 2πr.'] },
        check('check-1', 'twist', 2, 3), check('check-2', 'roll-angle', 1, 3), check('check-3', 'roll-angle', 2, 3),
        practice('roll-angle', 3), check('check-hook', 'twist', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Odd half-twists: one side. Rolling: distance ÷ radius.' }] },
      { id: 'mechanisms', title: 'How a mechanism works', minutes: 10, level: 3, summary: 'Input → each part → output.', steps: [
        hook('Press the pump and let go. What happens next?', 'phy-chain', 1, 3),
        { id: 'trace', kind: 'slide', title: 'One part at a time', text: 'Find where the user applies the input. Follow that motion to the first moving part, then to the next, until you reach the output. Reject any step that is physically impossible.' },
        check('check-1', 'phy-chain', 2, 3), check('check-2', 'phy-chain', 3, 3), check('check-3', 'phy-chain', 4, 3),
        { id: 'remember', kind: 'takeaway', body: 'Trace input to output, one part at a time.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 14, pass: 6, marking: 'plain', questions: [{ kind: 'floating', level: 3, count: 2 }, { kind: 'lens', level: 3, count: 2 }, { kind: 'twist', level: 3, count: 1 }, { kind: 'roll-angle', level: 3, count: 1 }, { kind: 'phy-chain', level: 3, count: 2 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'magnification', title: 'Image size', minutes: 10, level: 4, summary: 'How many times bigger is the image?', steps: [
        hook('How large is the image?', 'lens', 1, 4),
        { id: 'ratio', kind: 'slide', title: 'Size follows distance', text: 'Image size ÷ object size = image distance ÷ object distance = v ÷ u. Find v with the lens rule first.' },
        check('check-1', 'lens', 2, 4), check('check-2', 'lens', 3, 4), check('check-3', 'sound', 3, 3),
        practice('lens', 4), check('check-hook', 'lens', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Magnification = v ÷ u.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 10, pass: 4, marking: 'plain', questions: [{ kind: 'lens', level: 4, count: 3 }, { kind: 'floating', level: 3, count: 1 }, { kind: 'roll-angle', level: 3, count: 1 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 6, level: 5, summary: 'The rules once more before the timed set.', steps: [
        { id: 'rules', kind: 'slide', title: 'Everyday physics in one screen', text: ['Float: density below the liquid’s; fraction under = density ratio. Mirror: as far behind as in front; half-height mirror. Lens: v = u f ÷ (u − f); size ratio v ÷ u.', 'Sound: 340 m/s, halve an echo. Loops: odd half-twists, one side. Rolling: distance ÷ radius. Mechanisms: trace input to output. Controls: mirror the layout.'] },
        { id: 'practice-1', kind: 'practice', question: { kind: 'lens', level: 3 }, streak: 2 },
        { id: 'remember', kind: 'takeaway', body: 'One rule per topic; apply it carefully.' }] },
    ], quiz: { title: 'Timed exam set', minutes: 14, pass: 8, marking: 'uceed', description: 'Eleven everyday-physics questions at exam pace, marked like UCEED.', questions: [{ kind: 'floating', level: 3, count: 2 }, { kind: 'mirror', level: 3, count: 1 }, { kind: 'lens', level: 4, count: 2 }, { kind: 'sound', level: 3, count: 1 }, { kind: 'twist', level: 3, count: 1 }, { kind: 'roll-angle', level: 3, count: 1 }, { kind: 'phy-chain', level: 3, count: 2 }, { kind: 'phy-mapping', level: 2, count: 1 }] } },
  ],
});
