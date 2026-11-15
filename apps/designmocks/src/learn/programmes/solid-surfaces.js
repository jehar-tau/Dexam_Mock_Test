// Surfaces of solids: faces, edges and corners of named solids, extruded
// outlines, stepped stacks, notches, tunnels, painted blocks taken apart, and
// operations moved to a new shape. Specification: docs/learn/topics/solid-surfaces.md.
const explorer = sample => ({ tool: 'surface-explorer', props: { sample } });
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const surfacesProgramme = Object.freeze({
  slug: 'solid-surfaces', title: 'Surfaces of solids',
  summary: 'Count faces, edges and corners, then the surfaces of stepped, notched, tunnelled and painted solids, and type the number.',
  topic: 'visualisation', exams: ['uceed', 'ceed'], minutes: 100, status: 'preview',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'what-is-a-surface', title: 'What counts as a surface', minutes: 8, level: 1, summary: 'A surface is a region one sticker could cover without crossing an edge.', steps: [
        { id: 'sticker', kind: 'slide', title: 'The sticker test', text: ['A surface is a region you could cover with one sticker without folding it over an edge. Two squares side by side in the same flat plane are one surface.', 'A curved surface counts as one, however far it bends: a cylinder has 3, a cone 2, a sphere 1.'], ...explorer('L'), hint: 'Pick a direction: the status counts the surfaces facing that way.' },
        check('check-1', 'basic-surfaces', 1, 1), check('check-2', 'basic-surfaces', 2, 1), check('check-3', 'basic-surfaces', 3, 1), check('check-4', 'basic-surfaces', 4, 1),
        { id: 'remember', kind: 'takeaway', body: 'One flat or one curved region is one surface. Same plane and touching: still one.' }] },
      { id: 'edges-corners', title: 'Faces, edges and corners', minutes: 8, level: 2, summary: 'Prisms and pyramids from the shape of their end or base.', steps: [
        { id: 'prisms', kind: 'slide', title: 'Prisms and pyramids', text: ['A prism whose end has n sides has n + 2 faces, 3n edges and 2n corners.', 'A pyramid on an n-sided base has n + 1 faces, 2n edges and n + 1 corners. Check any solid with corners − edges + faces = 2.'] },
        check('check-1', 'edges-corners', 1, 2), check('check-2', 'edges-corners', 2, 2), check('check-3', 'edges-corners', 3, 2), check('check-4', 'edges-corners', 4, 2),
        { id: 'remember', kind: 'takeaway', body: 'Prism: n + 2, 3n, 2n. Pyramid: n + 1, 2n, n + 1. Corners − edges + faces = 2.' }] },
      { id: 'extrude', title: 'Push a shape into a solid', minutes: 8, level: 2, summary: 'One surface per side, plus the two ends.', steps: [
        { id: 'sides', kind: 'slide', title: 'Sides plus two', text: 'Push a flat shape straight up and every side of the shape becomes a wall. Add the top and the bottom. For a shape made of squares, count its corners: it has as many sides as corners.' },
        check('check-1', 'extrusion-surfaces', 1, 2), check('check-2', 'extrusion-surfaces', 2, 2), check('check-3', 'extrusion-surfaces', 3, 2),
        { id: 'remember', kind: 'takeaway', body: 'Extruded shape: sides + 2.' }] },
      { id: 'six-directions', title: 'Count in six directions', minutes: 8, level: 2, summary: 'Up, down, front, back, left, right: nothing missed, nothing twice.', steps: [
        { id: 'six', kind: 'slide', title: 'One direction at a time', text: 'Count the surfaces facing up, then down, then each of the four sides. Within one direction, squares in the same plane that touch are one surface; a step splits them.', ...explorer('steps'), hint: 'Go through all six directions and add them up.' },
        check('check-1', 'polycube-surfaces', 1, 2), check('check-2', 'polycube-surfaces', 2, 2), check('check-3', 'polycube-surfaces', 3, 2),
        { id: 'remember', kind: 'takeaway', body: 'Six directions, flat patches in each, then add.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain', questions: [{ kind: 'basic-surfaces', level: 1, count: 2 }, { kind: 'edges-corners', level: 2, count: 2 }, { kind: 'extrusion-surfaces', level: 2, count: 2 }, { kind: 'polycube-surfaces', level: 2, count: 2 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'stepped', title: 'Stepped solids', minutes: 12, level: 3, summary: 'Steps split a direction into several surfaces.', steps: [
        hook('Count every flat surface, the hidden ones too.', 'polycube-surfaces', 1, 3),
        { id: 'table', kind: 'slide', title: 'A table of six', text: 'Write the six directions down the side. For each, count the separate flat patches: every step up or down starts a new one. Bottoms are usually one surface when the solid stands flat on the floor.' },
        worked('polycube-surfaces', 2, 3),
        check('check-1', 'polycube-surfaces', 3, 3), check('check-2', 'polycube-surfaces', 4, 3), check('check-3', 'polycube-surfaces', 5, 3),
        practice('polycube-surfaces', 3), check('check-hook', 'polycube-surfaces', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'One row per direction; count patches, not squares.' }] },
      { id: 'shapes-set', title: 'Sets of shapes', minutes: 10, level: 3, summary: 'Count sides fast by counting corners; holes add their walls.', steps: [
        hook('Six shapes. How many give more than n surfaces?', 'extrusion-set', 1, 3),
        { id: 'corners', kind: 'slide', title: 'Corners equal sides', text: 'A shape made of squares has exactly as many sides as corners, inside corners included. A square hole adds four more walls.' },
        worked('extrusion-set', 2, 3),
        check('check-1', 'extrusion-set', 3, 3), check('check-2', 'extrusion-surfaces', 1, 3), check('check-3', 'extrusion-surfaces', 4, 3),
        practice('extrusion-set', 3), check('check-hook', 'extrusion-set', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Corners = sides. Surfaces = sides + 2 + hole walls.' }] },
      { id: 'notches', title: 'Notches and slots', minutes: 12, level: 3, summary: 'A notch can split a face and adds its own floor and walls.', steps: [
        hook('A block with notches cut from its edges.', 'notch-surfaces', 1, 3),
        { id: 'notch', kind: 'slide', title: 'What a notch does', text: 'A slot across the top splits the top into two surfaces and adds a floor and two walls. A notch along an edge adds a floor and a wall but splits nothing.', ...explorer('notched'), hint: 'Look at the top direction for the slotted block.' },
        worked('notch-surfaces', 2, 3),
        check('check-1', 'notch-surfaces', 3, 3), check('check-2', 'notch-surfaces', 4, 3), check('check-3', 'notch-surfaces', 5, 3),
        practice('notch-surfaces', 3), check('check-hook', 'notch-surfaces', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Each notch: which faces does it split, and what floors and walls does it add?' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 16, pass: 6, marking: 'plain', questions: [{ kind: 'polycube-surfaces', level: 3, count: 3 }, { kind: 'extrusion-set', level: 3, count: 2 }, { kind: 'notch-surfaces', level: 3, count: 3 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'tunnels', title: 'Tunnels', minutes: 14, level: 4, summary: 'A tunnel adds walls; crossing tunnels break them.', steps: [
        hook('Tunnels straight through a cube.', 'tunnel-surfaces', 1, 4),
        { id: 'one', kind: 'slide', title: 'One tunnel', text: 'The six outside faces stay six, each with a hole. One square tunnel adds its four walls: 10 in all.', ...explorer('tunnel'), hint: 'Count the inside walls direction by direction.' },
        { id: 'crossing', kind: 'slide', title: 'Crossing tunnels', text: 'Where two tunnels cross, each wall is cut where the other tunnel passes. A wall broken at the centre becomes two surfaces, one each side of the crossing.' },
        worked('tunnel-surfaces', 2, 4),
        check('check-1', 'tunnel-surfaces', 3, 4), check('check-2', 'tunnel-surfaces', 4, 4), check('check-3', 'tunnel-surfaces', 5, 4),
        practice('tunnel-surfaces', 4), check('check-hook', 'tunnel-surfaces', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Outside 6, plus the tunnel walls, broken wherever tunnels cross.' }] },
      { id: 'join-paint', title: 'Join, paint, separate', minutes: 12, level: 4, summary: 'The unpainted surfaces are exactly the ones that touched.', steps: [
        hook('Pieces make a block; the block is painted and taken apart.', 'unpainted-surfaces', 1, 4),
        { id: 'touching', kind: 'slide', title: 'Unpainted means touching', text: 'Paint only reaches the outside of the block. Every surface pressed against another piece stays bare. Count those, piece by piece; a wall shared by two pieces is bare on both.' },
        worked('unpainted-surfaces', 2, 4),
        check('check-1', 'unpainted-surfaces', 3, 4), check('check-2', 'unpainted-surfaces', 4, 4), check('check-3', 'unpainted-surfaces', 5, 4),
        practice('unpainted-surfaces', 4), check('check-hook', 'unpainted-surfaces', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Bare = touched another piece. Count both sides of every shared wall.' }] },
      { id: 'same-operations', title: 'Same operations, new shape', minutes: 10, level: 4, summary: 'Work out what the operations add from one shape, then apply them to another.', steps: [
        hook('X gives so many surfaces. What does Y give?', 'operation-transfer', 1, 4),
        { id: 'adds', kind: 'slide', title: 'Find what is added', text: 'Pushing a shape up gives sides + 2. A hole straight through adds 4. Slicing off one upright outside corner adds 1. Use the first shape to check, then apply the same to the second.' },
        worked('operation-transfer', 2, 4),
        check('check-1', 'operation-transfer', 3, 4), check('check-2', 'operation-transfer', 4, 4), check('check-3', 'tunnel-surfaces', 6, 4),
        practice('operation-transfer', 4), check('check-hook', 'operation-transfer', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Sides + 2, then + 4 per hole and + 1 per cut corner.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 18, pass: 5, marking: 'plain', questions: [{ kind: 'tunnel-surfaces', level: 4, count: 3 }, { kind: 'unpainted-surfaces', level: 4, count: 3 }, { kind: 'operation-transfer', level: 4, count: 2 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 8, level: 5, summary: 'The rules once more, then mixed practice before the timed set.', steps: [
        { id: 'rules', kind: 'slide', title: 'Surfaces in one screen', text: ['Same plane and touching: one surface. Count six directions.', 'Extruded: sides + 2. Holes: + 4. Tunnels: walls broken where they cross. Painted blocks: bare faces are the ones that touched.'] },
        { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'About two minutes a question. Typed answers lose nothing when wrong; always enter one.' },
        { id: 'practice-1', kind: 'practice', question: { kind: 'polycube-surfaces', level: 3 }, streak: 2 },
        { id: 'practice-2', kind: 'practice', question: { kind: 'tunnel-surfaces', level: 4 }, streak: 2 },
        { id: 'remember', kind: 'takeaway', body: 'Six directions, every time.' }] },
    ], quiz: { title: 'Timed exam set', minutes: 24, pass: 9, marking: 'uceed', description: 'Twelve typed-answer surface questions at exam pace, marked like UCEED.', questions: [{ kind: 'polycube-surfaces', level: 3, count: 2 }, { kind: 'extrusion-set', level: 3, count: 2 }, { kind: 'notch-surfaces', level: 3, count: 2 }, { kind: 'tunnel-surfaces', level: 4, count: 2 }, { kind: 'unpainted-surfaces', level: 4, count: 2 }, { kind: 'operation-transfer', level: 4, count: 2 }] } },
  ],
});
