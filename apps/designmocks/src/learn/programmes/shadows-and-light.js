// Shadows and light: direction and length from the sun, flat shapes and
// solids in top view, proportion, stacked solids, walkers and lamps.
// Specification: docs/learn/topics/shadows-and-light.md.
const sun = props => ({ tool: 'sun-table', props });
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const shadowsProgramme = Object.freeze({
  slug: 'shadows-and-light', title: 'Shadows and light',
  summary: 'Which way and how far shadows fall, the shadows of solids seen from above, heights from shadows, and lamps that are not the sun.',
  topic: 'visualisation', exams: ['uceed', 'ceed', 'nid'], minutes: 100, status: 'preview',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'direction', title: 'Which way does it fall?', minutes: 8, level: 1, summary: 'A shadow points directly away from the light.', steps: [
        { id: 'away', kind: 'slide', title: 'Away from the light', text: 'A shadow lies on the side of an object away from the light. Sun in the east, shadows to the west. Morning shadows point west; evening shadows point east.', ...sun({ azimuth: 90 }), hint: 'Pick a sun direction and watch the shadow swing.' },
        check('check-1', 'shadow-direction', 1, 1), check('check-2', 'shadow-direction', 2, 1), check('check-3', 'shadow-direction', 3, 1), check('check-4', 'shadow-direction', 5, 1),
        { id: 'remember', kind: 'takeaway', body: 'The shadow points to the compass point opposite the sun.' }] },
      { id: 'length', title: 'How long?', minutes: 8, level: 2, summary: 'Low sun, long shadow. At 45° the shadow equals the height.', steps: [
        { id: 'low', kind: 'slide', title: 'Low sun, long shadow', text: 'The ray over the top of an object, the object and its shadow make a right triangle. The lower the sun, the longer the shadow. At 45° the shadow is exactly as long as the object is tall.', ...sun({ solid: 'cylinder', azimuth: 180 }), hint: 'Move the sun height slider from 15° to 75°.' },
        check('check-1', 'shadow-length-compare', 1, 2), check('check-2', 'shadow-length-compare', 2, 2), check('check-3', 'shadow-length-compare', 3, 2), check('check-4', 'shadow-length-compare', 4, 2),
        { id: 'remember', kind: 'takeaway', body: 'Lower sun, longer shadow. 45°: shadow = height.' }] },
      { id: 'flat-shapes', title: 'Flat shapes in sunlight', minutes: 8, level: 2, summary: 'A shape held level casts its own shape, moved.', steps: [
        { id: 'same', kind: 'slide', title: 'Same shape, moved', text: 'Sun rays are parallel. A card held level casts a shadow of exactly its shape and size, slid away from the sun by its height ÷ tan(sun height). Only a tilted card is squashed or stretched.' },
        check('check-1', 'flat-shadow', 1, 2), check('check-2', 'flat-shadow', 2, 2), check('check-3', 'flat-shadow', 3, 2), check('check-4', 'flat-shadow', 4, 2),
        { id: 'remember', kind: 'takeaway', body: 'Level card, parallel light: same shape, same size, moved away from the sun.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain', questions: [{ kind: 'shadow-direction', level: 1, count: 3 }, { kind: 'shadow-length-compare', level: 2, count: 2 }, { kind: 'flat-shadow', level: 2, count: 3 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'solids', title: 'Shadows of solids', minutes: 12, level: 3, summary: 'The base joined to the shadow of the top.', steps: [
        hook('A solid, the sun and a top view. Which shadow is right?', 'solid-shadow', 1, 3),
        { id: 'push', kind: 'slide', title: 'Push the top', text: ['Find where the top lands: away from the sun, as far as the solid is tall at 45°. Join that to the base.', 'A flat top lands as a whole shape, so the shadow ends square or round. A pointed top lands as a single point, so the shadow ends in a tip.'], ...sun({ solid: 'cone', azimuth: 135 }), hint: 'Switch between the cone and the cylinder with the same sun.' },
        worked('solid-shadow', 2, 3),
        check('check-1', 'solid-shadow', 3, 3), check('check-2', 'solid-shadow', 4, 3), check('check-3', 'solid-shadow', 5, 3),
        practice('solid-shadow', 3), check('check-hook', 'solid-shadow', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Base plus the landed top. Pointed top, pointed shadow.' }] },
      { id: 'proportion', title: 'Same sun, same ratio', minutes: 10, level: 3, summary: 'At one moment height ÷ shadow is the same for everything.', steps: [
        hook('A pole and its shadow tell you how tall the tree is.', 'shadow-ratio', 1, 3),
        { id: 'ratio', kind: 'slide', title: 'One ratio for everything', text: 'The sun is at one height for everything in the same place at the same moment. So every object’s height ÷ shadow is the same number. Scale, never add.' },
        worked('shadow-ratio', 2, 3),
        check('check-1', 'shadow-ratio', 3, 3), check('check-2', 'shadow-ratio', 4, 3), check('check-3', 'shadow-ratio', 5, 3),
        practice('shadow-ratio', 3), check('check-hook', 'shadow-ratio', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Height ÷ shadow is fixed at one moment. Find the scale factor.' }] },
      { id: 'rows', title: 'Several objects in a row', minutes: 10, level: 3, summary: 'Equal heights give equal reach; each shadow’s end names its solid.', steps: [
        hook('Three solids in a row. Which top view is right?', 'row-shadows', 1, 3),
        { id: 'ends', kind: 'slide', title: 'Read the ends', text: 'All the shadows are parallel and point away from the sun. Equal heights reach equally far. Then read each end: a tip for a cone or pyramid, a full shape for a cube or cylinder.' },
        worked('row-shadows', 2, 3),
        check('check-1', 'row-shadows', 3, 3), check('check-2', 'row-shadows', 4, 3), check('check-3', 'row-shadows', 5, 3),
        practice('row-shadows', 3), check('check-hook', 'row-shadows', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Direction, then reach, then the shape of each end.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 16, pass: 6, marking: 'plain', questions: [{ kind: 'solid-shadow', level: 3, count: 3 }, { kind: 'shadow-ratio', level: 3, count: 3 }, { kind: 'row-shadows', level: 3, count: 2 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'stacked', title: 'One solid on another', minutes: 12, level: 4, summary: 'Shadow each part from its own height, then join.', steps: [
        hook('A cone on a cube. The cone starts high up.', 'stacked-shadow', 1, 4),
        { id: 'parts', kind: 'slide', title: 'Every point lands by its own height', text: 'At 45° a point lands as far away as it is high. The upper solid’s base is already up on the cube, so its shadow starts beyond the cube’s, and its top lands further still.' },
        worked('stacked-shadow', 2, 4),
        check('check-1', 'stacked-shadow', 3, 4), check('check-2', 'stacked-shadow', 4, 4), check('check-3', 'stacked-shadow', 5, 4),
        practice('stacked-shadow', 4), check('check-hook', 'stacked-shadow', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Shadow each part from its true height, then put them together.' }] },
      { id: 'compass', title: 'Sun, compass and turning', minutes: 10, level: 4, summary: 'Shadows follow the sun, not the way someone faces.', steps: [
        hook('Two walkers, one turns. Where do the shadows go?', 'compass-shadows', 1, 4),
        { id: 'turn', kind: 'slide', title: 'The sun does not turn', text: 'A person’s heading changes when they turn; the sun does not move. Every shadow at one moment is parallel and points away from the sun.' },
        check('check-1', 'compass-shadows', 2, 4), check('check-2', 'compass-shadows', 3, 4), check('check-3', 'compass-shadows', 4, 4),
        practice('compass-shadows', 4), check('check-hook', 'compass-shadows', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Headings turn; shadows stay parallel, away from the sun.' }] },
      { id: 'lamp', title: 'A lamp, not the sun', minutes: 14, level: 4, summary: 'Similar triangles for a lamp; outlines a solid can cast.', steps: [
        hook('A street lamp and a post. How long is the shadow?', 'lamp-shadow', 1, 4),
        { id: 'triangles', kind: 'slide', title: 'Similar triangles', text: ['A lamp is close, so its rays spread out and shadows fan away from the foot of the lamp. Moving closer to the lamp shortens the shadow.', 'The ray over the post’s top makes two similar triangles: shadow ÷ post = (distance + shadow) ÷ lamp, which gives shadow = distance × post ÷ (lamp − post).'] },
        worked('lamp-shadow', 2, 4),
        check('check-1', 'lamp-shadow', 3, 4), check('check-2', 'lamp-shadow', 4, 4),
        { id: 'outline', kind: 'slide', title: 'Outlines on a wall', text: 'A solid lit from one side throws its outline. A cylinder gives a circle end on and a rectangle side on; a cone a circle or a triangle; a cube a square, a rectangle or, corner on, a hexagon.' },
        check('check-3', 'silhouette-set', 1, 4),
        practice('lamp-shadow', 4), check('check-hook', 'lamp-shadow', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Lamp: similar triangles with lamp − post. Wall outline: look from every side.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 18, pass: 5, marking: 'plain', questions: [{ kind: 'stacked-shadow', level: 4, count: 3 }, { kind: 'compass-shadows', level: 4, count: 2 }, { kind: 'lamp-shadow', level: 4, count: 2 }, { kind: 'silhouette-set', level: 4, count: 1 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 8, level: 5, summary: 'The rules once more, then mixed practice before the timed set.', steps: [
        { id: 'rules', kind: 'slide', title: 'Shadows in one screen', text: ['Away from the sun. At 45° the reach equals the height. Level shapes keep their shape.', 'Solids: base plus the landed top, by each part’s own height. One sun: one ratio. A lamp: similar triangles with lamp − post.'] },
        { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'About two minutes a question. Typed answers lose nothing when wrong; always enter one.' },
        { id: 'practice-1', kind: 'practice', question: { kind: 'solid-shadow', level: 3 }, streak: 2 },
        { id: 'practice-2', kind: 'practice', question: { kind: 'stacked-shadow', level: 4 }, streak: 2 },
        { id: 'remember', kind: 'takeaway', body: 'Direction, reach, ends: in that order.' }] },
    ], quiz: { title: 'Timed exam set', minutes: 22, pass: 9, marking: 'uceed', description: 'Twelve shadow questions at exam pace, marked like UCEED.', questions: [{ kind: 'solid-shadow', level: 3, count: 2 }, { kind: 'shadow-ratio', level: 3, count: 2 }, { kind: 'row-shadows', level: 3, count: 2 }, { kind: 'stacked-shadow', level: 4, count: 2 }, { kind: 'compass-shadows', level: 4, count: 2 }, { kind: 'lamp-shadow', level: 4, count: 1 }, { kind: 'silhouette-set', level: 4, count: 1 }] } },
  ],
});
