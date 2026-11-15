// Sections of solids: cut faces, solids made by turning a shape, plane
// sections of a cube, pieces after cuts, and solids with corners or edges
// sliced off. Specification: docs/learn/topics/sections.md.
const slicer = normal => ({ tool: 'section-slicer', props: { normal } });
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const sectionsProgramme = Object.freeze({
  slug: 'sections', title: 'Sections of solids',
  summary: 'The shape of a cut face, solids made by spinning a shape, flat cuts through a cube, and pieces, faces and edges after cutting.',
  topic: 'visualisation', exams: ['uceed', 'ceed', 'nid'], minutes: 90, status: 'preview',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'cut-faces', title: 'The shape of a cut', minutes: 8, level: 1, summary: 'Across, along and at a slant.', steps: [
        { id: 'across', kind: 'slide', title: 'Across and along', text: ['Cut across a cylinder or cone and the face is a circle; cut along its axis and it is a rectangle or a triangle.', 'Every flat cut of a sphere is a circle. A cube cut parallel to a face shows a square.'], ...slicer('Face to face'), hint: 'Slide the cut and watch the face: it stays a square.' },
        check('check-1', 'cut-face', 1, 1), check('check-2', 'cut-face', 2, 1), check('check-3', 'cut-face', 3, 1), check('check-4', 'cut-face', 4, 1),
        { id: 'remember', kind: 'takeaway', body: 'Across: the cross shape. Along the axis: the side outline.' }] },
      { id: 'slants', title: 'Slanting cuts', minutes: 8, level: 2, summary: 'A slant stretches a circle into an ellipse.', steps: [
        { id: 'stretch', kind: 'slide', title: 'Stretched circles', text: 'Tilt the cut through a cylinder or cone and the circle stretches into an ellipse, as long as the cut does not reach the ends. A cut through three corners round one corner of a cube is a triangle.', ...slicer('Corner to corner'), hint: 'Slide the cut: triangle, then hexagon, then triangle again.' },
        check('check-1', 'cut-face', 1, 2), check('check-2', 'cut-face', 2, 2), check('check-3', 'cut-face', 3, 2),
        { id: 'remember', kind: 'takeaway', body: 'Slanting cut through a round solid: an ellipse.' }] },
      { id: 'spinning', title: 'Spinning a shape', minutes: 8, level: 2, summary: 'A flat shape turned round an axis sweeps out a solid.', steps: [
        { id: 'sweep', kind: 'slide', title: 'Every point sweeps a circle', text: 'Spin a rectangle round one side and you get a cylinder. A right triangle round a short side makes a cone; a half circle round its straight edge, a sphere.' },
        check('check-1', 'revolution', 1, 2), check('check-2', 'revolution', 2, 2), check('check-3', 'revolution', 3, 2),
        { id: 'remember', kind: 'takeaway', body: 'Rectangle: cylinder. Right triangle: cone. Half circle: sphere.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain', questions: [{ kind: 'cut-face', level: 1, count: 3 }, { kind: 'cut-face', level: 2, count: 2 }, { kind: 'revolution', level: 2, count: 3 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'cube-cuts', title: 'Flat cuts through a cube', minutes: 14, level: 3, summary: 'Join points on the same face; opposite faces give parallel lines.', steps: [
        hook('Three marked points. What shape is the cut?', 'cube-section', 1, 3),
        { id: 'join', kind: 'slide', title: 'Join, then go parallel', text: ['Two marked points on the same face are joined by a straight line on that face. Where the cut meets the opposite face, its line there is parallel.', 'The number of faces the cut crosses is the number of sides: 3 to 6.'], ...slicer('Edge to edge'), hint: 'Each cut direction gives its own family of shapes.' },
        worked('cube-section', 2, 3),
        check('check-1', 'cube-section', 3, 3), check('check-2', 'cube-section', 4, 3), check('check-3', 'cube-section', 5, 3),
        practice('cube-section', 3), check('check-hook', 'cube-section', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Same face: join. Opposite faces: parallel. Faces crossed = sides.' }] },
      { id: 'pieces', title: 'How many pieces?', minutes: 10, level: 3, summary: 'Parallel cuts make slices; cuts in different directions multiply.', steps: [
        hook('A cube of cheese and a round cake, cut several ways.', 'cut-pieces', 1, 3),
        { id: 'slices', kind: 'slide', title: 'Slices multiply', text: 'k parallel cuts make k + 1 slices. Cuts in three directions multiply: (a + 1)(b + 1)(c + 1). Each cut through the centre of a round cake makes two wedges.' },
        worked('cut-pieces', 2, 3),
        check('check-1', 'cut-pieces', 3, 3), check('check-2', 'cut-pieces', 4, 3), check('check-3', 'cut-pieces', 5, 3),
        practice('cut-pieces', 3), check('check-hook', 'cut-pieces', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Slices are cuts + 1; directions multiply; centre cuts make two wedges each.' }] },
      { id: 'compound', title: 'Spinning harder shapes', minutes: 10, level: 3, summary: 'Steps, gaps and slanting edges.', steps: [
        hook('An unusual outline spun round the axis.', 'revolution', 1, 3),
        { id: 'edges', kind: 'slide', title: 'Edge by edge', text: 'An edge parallel to the axis sweeps a cylinder wall, a slanting edge a cone, an edge square to the axis a flat ring. A gap between the shape and the axis leaves a hole down the middle.' },
        worked('revolution', 2, 3),
        check('check-1', 'revolution', 3, 3), check('check-2', 'revolution', 4, 3),
        practice('revolution', 3), check('check-hook', 'revolution', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Parallel: cylinder. Slanting: cone. Square to the axis: ring. Gap: hole.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 16, pass: 6, marking: 'plain', questions: [{ kind: 'cube-section', level: 3, count: 3 }, { kind: 'cut-pieces', level: 3, count: 3 }, { kind: 'revolution', level: 3, count: 2 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'odd-sections', title: 'Pentagons, trapezia and rhombi', minutes: 14, level: 4, summary: 'Cuts that cross five faces, or meet the cube unevenly.', steps: [
        hook('This cut is not one of the neat ones.', 'cube-section', 1, 4),
        { id: 'five', kind: 'slide', title: 'Five faces, or uneven sides', text: ['A cut that crosses five faces is a pentagon. A cube section is never a regular pentagon.', 'Two parallel sides of different lengths make a trapezium; four equal sides that are not square make a rhombus.'], ...slicer('Tilted'), hint: 'Slide this tilted cut and watch the shapes change.' },
        worked('cube-section', 2, 4),
        check('check-1', 'cube-section', 3, 4), check('check-2', 'cube-section', 4, 4), check('check-3', 'cube-section', 5, 4),
        practice('cube-section', 4), check('check-hook', 'cube-section', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Count faces crossed, then compare side lengths and angles.' }] },
      { id: 'sliced-off', title: 'Corners and edges sliced off', minutes: 12, level: 4, summary: 'Each small cut adds a face, three edges and two corners.', steps: [
        hook('A cube with its corners trimmed. Count again.', 'truncation', 1, 4),
        { id: 'adds', kind: 'slide', title: 'What one cut adds', text: 'Slicing off a corner leaves a small triangle: one new face, three new edges, and three new corners replacing one. Bevelling an edge adds a thin rectangle with the same totals. Check with corners − edges + faces = 2.' },
        worked('truncation', 2, 4),
        check('check-1', 'truncation', 3, 4), check('check-2', 'truncation', 4, 4), check('check-3', 'truncation', 5, 4),
        practice('truncation', 4), check('check-hook', 'truncation', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Each cut: +1 face, +3 edges, +2 corners.' }] },
      { id: 'most-pieces', title: 'The most pieces', minutes: 10, level: 4, summary: 'Tilted cuts that cross every earlier cut.', steps: [
        hook('A few cuts, as many pieces as possible.', 'cut-pieces', 1, 4),
        { id: 'pancake', kind: 'slide', title: 'Each cut adds what it crosses', text: 'A new cut adds one piece for every region the earlier cuts divide it into. On a flat cut, k lines make at most 1, 2, 4, 7, 11 regions. So solid cuts give at most 2, 4, 8, 15, 26 pieces.' },
        check('check-1', 'cut-pieces', 2, 4), check('check-2', 'cut-pieces', 3, 4), check('check-3', 'cut-pieces', 6, 4),
        practice('cut-pieces', 4), check('check-hook', 'cut-pieces', 1, 4),
        { id: 'remember', kind: 'takeaway', body: '2, 4, 8, 15, 26: add the pancake number each time.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 18, pass: 5, marking: 'plain', questions: [{ kind: 'cube-section', level: 4, count: 3 }, { kind: 'truncation', level: 4, count: 3 }, { kind: 'cut-pieces', level: 4, count: 2 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 8, level: 5, summary: 'The rules once more, then mixed practice before the timed set.', steps: [
        { id: 'rules', kind: 'slide', title: 'Sections in one screen', text: ['Across, along, slant: circle, rectangle or triangle, ellipse. Cube cuts: join on a face, parallel on opposite faces, faces crossed = sides.', 'Pieces: slices multiply. Sliced corners and edges: +1, +3, +2. Spinning: edge by edge.'] },
        { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'About two minutes a question. Typed answers lose nothing when wrong; always enter one.' },
        { id: 'practice-1', kind: 'practice', question: { kind: 'cube-section', level: 4 }, streak: 2 },
        { id: 'practice-2', kind: 'practice', question: { kind: 'truncation', level: 4 }, streak: 2 },
        { id: 'remember', kind: 'takeaway', body: 'Faces crossed, then sides and angles.' }] },
    ], quiz: { title: 'Timed exam set', minutes: 22, pass: 9, marking: 'uceed', description: 'Twelve section questions at exam pace, marked like UCEED.', questions: [{ kind: 'cube-section', level: 3, count: 2 }, { kind: 'cube-section', level: 4, count: 2 }, { kind: 'cut-pieces', level: 3, count: 2 }, { kind: 'cut-pieces', level: 4, count: 1 }, { kind: 'truncation', level: 4, count: 2 }, { kind: 'revolution', level: 3, count: 2 }, { kind: 'cut-face', level: 2, count: 1 }] } },
  ],
});
