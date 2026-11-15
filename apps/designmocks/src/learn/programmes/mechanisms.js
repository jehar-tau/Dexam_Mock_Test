// Gears, belts and levers: which way things turn, how fast, and what balances.
// Specification: docs/learn/topics/mechanisms.md. The top tier is set by the
// owner's mechanical question bank (docs/learn/09-topic-bank-map.md): mixed
// systems of gears and belts, one rope over many pulleys, marks that meet
// again, and a hanging mobile.
const gears = (...presets) => ({ tool: 'gear-train', props: { presets } });
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const mechanismsProgramme = Object.freeze({
  slug: 'mechanisms',
  title: 'Gears, belts and levers',
  summary: 'Work out which way every wheel turns, how fast the last one spins, whether a machine can move at all, and what makes a beam balance.',
  topic: 'mechanical-reasoning',
  exams: ['uceed', 'ceed'],
  minutes: 150,
  status: 'preview',
  tiers: [
    {
      id: 'foundations', title: 'Foundations', level: 2,
      lessons: [
        {
          id: 'two-gears', title: 'Two gears', minutes: 8, level: 1,
          summary: 'Gears that touch turn opposite ways, and the smaller one turns faster.',
          steps: [
            { id: 'opposite', kind: 'slide', title: 'Touching gears turn opposite ways', text: 'Where two gears meet, their teeth move together in the same direction. That forces the two wheels to spin opposite ways.', ...gears('pair'), hint: 'Watch the teeth at the point where the gears touch. Pause it if that helps.' },
            { id: 'faster', kind: 'slide', title: 'The small one turns faster', text: 'Every tooth that passes on one gear pushes one tooth on the other. A gear with fewer teeth gets round sooner, so it turns faster.', ...gears('pair'), hint: 'Press Bigger driver and read the speeds under the machine.' },
            check('check-1', 'gear-direction', 1, 1), check('check-2', 'gear-direction', 4, 1), check('check-3', 'gear-speed', 2, 2), check('check-4', 'gear-speed', 5, 2),
            { id: 'remember', kind: 'takeaway', body: 'Touching gears turn opposite ways. Fewer teeth means more turns.' },
          ],
        },
        {
          id: 'chains', title: 'A chain of gears', minutes: 8, level: 1,
          summary: 'In a row of gears the direction flips at every step, so every other gear turns the same way.',
          steps: [
            { id: 'flip', kind: 'slide', title: 'Flip, flip, flip', text: 'Each gear reverses the one after it. The first, third and fifth turn one way; the second, fourth and sixth turn the other.', ...gears('chain'), hint: 'Drag the slider to add gears. Read off which ones match gear A.' },
            { id: 'arrows', kind: 'slide', title: 'Draw the arrows', text: 'Never do this in your head. Put an arrow on the first gear, then on the next, one at a time, until every gear has one.' },
            check('check-1', 'gear-direction', 2, 1), check('check-2', 'gear-direction', 7, 1), check('check-3', 'gear-direction', 9, 1), check('check-4', 'gear-direction', 12, 1),
            { id: 'remember', kind: 'takeaway', body: 'One arrow per gear, one gear at a time. Every other gear turns the same way.' },
          ],
        },
        {
          id: 'belts', title: 'Belts and shafts', minutes: 10, level: 2,
          summary: 'An open belt copies the direction, a crossed belt reverses it, and wheels on one shaft turn together.',
          steps: [
            { id: 'open', kind: 'slide', title: 'Open belt: same way', text: 'A belt drags the rim of the second pulley the way it is moving. With an open belt both pulleys turn the same way.', ...gears('belt'), hint: 'Press Cross the belt and watch the second pulley change direction.' },
            { id: 'crossed', kind: 'slide', title: 'Crossed belt: opposite', text: 'Cross the belt into a figure of eight and it reaches the second pulley on the other side. Now the pulleys turn opposite ways.' },
            { id: 'shaft', kind: 'slide', title: 'One shaft, one motion', text: 'Two wheels fixed on the same shaft are one solid piece. They turn the same way at the same speed, whatever their sizes.', ...gears('mixed', 'compound'), hint: 'Find the two wheels that share a centre. They always agree.' },
            check('check-1', 'belt-direction', 1, 2), check('check-2', 'belt-direction', 3, 2), check('check-3', 'gear-direction', 2, 2), check('check-4', 'gear-direction', 6, 2),
            { id: 'remember', kind: 'takeaway', body: 'Reverse at a mesh or a crossed belt. Copy at an open belt or a shared shaft.' },
          ],
        },
        {
          id: 'lever-classes', title: 'Three kinds of lever', minutes: 8, level: 2,
          summary: 'Name the lever by what sits in the middle.',
          steps: [
            { id: 'middle', kind: 'slide', title: 'What is in the middle?', text: ['Every lever has a pivot (F), a load (L) and an effort (E). Name it by the one in the middle.', 'Pivot in the middle: class 1, a see-saw. Load in the middle: class 2, a wheelbarrow. Effort in the middle: class 3, tweezers.'] },
            check('check-1', 'lever-class', 1, 2), check('check-2', 'lever-class', 2, 2), check('check-3', 'lever-class', 3, 2), check('check-4', 'lever-class', 4, 2),
            { id: 'remember', kind: 'takeaway', body: 'F, L, E in the middle: classes 1, 2, 3.' },
          ],
        },
      ],
      quiz: { title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain', questions: [{ kind: 'gear-direction', level: 1, count: 2 }, { kind: 'gear-direction', level: 2, count: 2 }, { kind: 'belt-direction', level: 2, count: 2 }, { kind: 'gear-speed', level: 2, count: 2 }, { kind: 'lever-class', level: 2, count: 2 }] },
    },
    {
      id: 'exam-standard', title: 'Exam standard', level: 3,
      lessons: [
        {
          id: 'ratios', title: 'Speed through a chain', minutes: 12, level: 3,
          summary: 'Speed times teeth is the same for two meshing gears. The gears in between do not change the result.',
          steps: [
            hook('Type the speed of the last gear. There is a short way that skips the gears in the middle.', 'gear-speed', 3, 3),
            { id: 'rule', kind: 'slide', title: 'Speed × teeth stays the same', text: 'For two meshing gears, speed × teeth is equal on both. A 12-tooth gear at 60 turns a minute drives a 20-tooth gear at 60 × 12 ÷ 20 = 36.', ...gears('pair'), hint: 'Check the two speeds against the tooth counts.' },
            { id: 'idlers', kind: 'slide', title: 'Skip the middle gears', text: 'A gear between two others passes each tooth straight on. It changes the direction but not the speed, so only the first and last tooth counts matter.' },
            worked('gear-speed', 8, 3),
            check('check-1', 'gear-speed', 1, 3), check('check-2', 'gear-speed', 6, 3), check('check-3', 'gear-speed', 11, 3),
            practice('gear-speed', 3),
            check('check-hook', 'gear-speed', 3, 3),
            { id: 'remember', kind: 'takeaway', body: 'Speed × teeth is the same on both gears. In a simple chain, use only the first and the last.' },
          ],
        },
        {
          id: 'compound', title: 'Two gears on one shaft', minutes: 12, level: 3,
          summary: 'A shared shaft passes the speed on unchanged, so a compound train is two ratios multiplied.',
          steps: [
            hook('Here the short cut fails. Two of these gears share a shaft, and that changes everything.', 'compound-speed', 2, 3),
            { id: 'stages', kind: 'slide', title: 'One stage at a time', text: 'Work out the first pair. The gear sharing its shaft has the same speed. Then work out the second pair from there.', ...gears('compound'), hint: 'B and C share a shaft: read their speeds. Then compare C with D.' },
            { id: 'not-idler', kind: 'slide', title: 'A shaft pair is not a middle gear', text: 'A middle gear touches both neighbours with the same teeth. A shaft pair uses a different gear for each neighbour, so both ratios count.' },
            worked('compound-speed', 5, 3),
            check('check-1', 'compound-speed', 1, 3), check('check-2', 'compound-speed', 7, 3), check('check-3', 'compound-speed', 10, 3),
            practice('compound-speed', 3),
            check('check-hook', 'compound-speed', 2, 3),
            { id: 'remember', kind: 'takeaway', body: 'Same shaft, same speed. Write the speed beside every wheel and take one pair at a time.' },
          ],
        },
        {
          id: 'count-clockwise', title: 'Which way does each turn?', minutes: 12, level: 3,
          summary: 'Gears, shafts and belts in one system: mark every wheel, then count.',
          steps: [
            hook('Seven wheels, four kinds of link. Guessing by eye gets this wrong almost every time.', 'count-clockwise', 4, 3),
            { id: 'four-rules', kind: 'slide', title: 'Four links, two results', text: ['Mesh: reverse. Crossed belt: reverse.', 'Shared shaft: copy. Open belt: copy.'], ...gears('mixed'), hint: 'Cross the belt and see which wheels change.' },
            { id: 'walk', kind: 'slide', title: 'Walk it, never jump', text: 'Start at the driver. Move to a wheel only through a link, and write its arrow before going on. Count at the end.' },
            worked('count-clockwise', 9, 3),
            check('check-1', 'count-clockwise', 1, 3), check('check-2', 'count-clockwise', 6, 3), check('check-3', 'count-clockwise', 13, 3),
            practice('count-clockwise', 3),
            check('check-hook', 'count-clockwise', 4, 3),
            { id: 'remember', kind: 'takeaway', body: 'An arrow on every wheel, through the links, in order. Then count.' },
          ],
        },
        {
          id: 'levers', title: 'Balancing a beam', minutes: 12, level: 3,
          summary: 'A weight far from the pivot turns the beam more. Weight times distance must match on both sides.',
          steps: [
            hook('The weights are not equal and neither are the distances. One number makes it balance.', 'lever-balance', 3, 3),
            { id: 'bench', kind: 'slide', title: 'Far out counts for more', text: 'A weight turns the beam by its weight × its distance from the pivot. One kilogram four units out balances two kilograms two units out.', tool: 'lever-bench', props: {}, hint: 'Hang weights with + and −. Make it balance with different weights on each side.' },
            { id: 'sum', kind: 'slide', title: 'Add up each side', text: 'With several weights on a side, add their turning effects. The beam balances when the two totals are equal.' },
            worked('lever-balance', 7, 3),
            check('check-1', 'lever-balance', 1, 3), check('check-2', 'lever-balance', 5, 3), check('check-3', 'lever-balance', 12, 3),
            practice('lever-balance', 3),
            check('check-hook', 'lever-balance', 3, 3),
            { id: 'remember', kind: 'takeaway', body: 'Weight × distance from the pivot, added up on each side. Equal totals balance.' },
          ],
        },
        {
          id: 'effort', title: 'Levers and pulley blocks', minutes: 12, level: 3,
          summary: 'Work out the effort a lever or a pulley block needs.',
          steps: [
            hook('A pulley block with several strands. How hard must you pull?', 'pulley-effort', 1, 3),
            { id: 'share', kind: 'slide', title: 'Strands share the load', text: ['Count the rope strands holding up the bottom block. They share the load equally, so the pull is the load divided by that number. The price: you pull that many times more rope.', 'For a lever, effort × effort arm = load × load arm, with both arms measured from the pivot.'] },
            worked('pulley-effort', 2, 3),
            check('check-1', 'pulley-effort', 3, 3), check('check-2', 'lever-effort', 1, 3), check('check-3', 'lever-effort', 2, 3),
            practice('lever-effort', 3),
            check('check-hook', 'pulley-effort', 1, 3),
            { id: 'remember', kind: 'takeaway', body: 'Pulleys: load ÷ strands. Levers: effort × arm = load × arm.' },
          ],
        },
        {
          id: 'frames-balance', title: 'Frames, toppling and rolling', minutes: 14, level: 3,
          summary: 'Triangles keep their shape, a block tips when its balance point leaves the base, and rolling things turn by their rim.',
          steps: [
            hook('Bars pinned at the joints. Which frame keeps its shape?', 'rigid-frame', 1, 3),
            { id: 'triangles', kind: 'slide', title: 'Triangles are rigid', text: 'A triangle cannot change shape once its sides are fixed. A four-sided panel leans over like a parallelogram. Brace every panel into triangles and the frame is rigid.' },
            check('check-1', 'rigid-frame', 2, 3),
            { id: 'base', kind: 'slide', title: 'Over the base or over the edge', text: 'A standing block stays up while a line dropped from its centre of gravity lands on its base. Lean it or load one side until that line passes the edge, and it tips.' },
            check('check-2', 'topple', 1, 3), check('check-3', 'topple', 2, 3),
            { id: 'rim', kind: 'slide', title: 'Rolling', text: 'A wheel rolling without slipping moves one rim length, π × diameter, per turn. The top of a rolling log moves twice as fast as its centre.' },
            check('check-4', 'rolling', 1, 3),
            practice('topple', 3),
            check('check-hook', 'rigid-frame', 1, 3),
            { id: 'remember', kind: 'takeaway', body: 'Triangles hold; balance points over the base stand; one turn rolls one rim.' },
          ],
        },
      ],
      quiz: { title: 'Exam standard quiz', minutes: 16, pass: 6, marking: 'plain', questions: [{ kind: 'gear-speed', level: 3, count: 2 }, { kind: 'compound-speed', level: 3, count: 2 }, { kind: 'count-clockwise', level: 3, count: 2 }, { kind: 'lever-balance', level: 3, count: 2 }, { kind: 'pulley-effort', level: 3, count: 1 }, { kind: 'rigid-frame', level: 3, count: 1 }, { kind: 'topple', level: 3, count: 1 }] },
    },
    {
      id: 'exam-hard', title: 'Exam hard', level: 4,
      lessons: [
        {
          id: 'mixed-systems', title: 'Gears and belts together', minutes: 14, level: 4,
          summary: 'Five or six wheels joined by teeth, belts and shafts, sized by diameter. Find the speed of the last.',
          steps: [
            hook('This is how the exam sets it: diameters, a mix of links, and one speed to find.', 'system-speed', 3, 4),
            { id: 'diameter', kind: 'slide', title: 'Diameter works like teeth', text: 'Teeth are spaced evenly round a gear, so tooth count goes with diameter. For any pair joined by teeth or a belt, speed × diameter is the same on both.', ...gears('mixed'), hint: 'Follow the speed from A to E, one link at a time.' },
            { id: 'table', kind: 'slide', title: 'Write a line per wheel', text: 'List the wheels in the order the motion reaches them. Beside each, write its speed. A shaft copies the line above; any other link multiplies by one diameter and divides by the next.' },
            worked('system-speed', 6, 4),
            check('check-1', 'system-speed', 1, 4), check('check-2', 'system-speed', 9, 4), check('check-3', 'system-speed', 14, 4),
            practice('system-speed', 4),
            check('check-hook', 'system-speed', 3, 4),
            { id: 'remember', kind: 'takeaway', body: 'One line per wheel. Shafts copy the speed; teeth and belts scale it by the two diameters.' },
          ],
        },
        {
          id: 'rope', title: 'One rope, many pulleys', minutes: 14, level: 4,
          summary: 'A single rope snakes past eight or nine pulleys. Count the ones that turn clockwise.',
          steps: [
            hook('The pulleys do not simply alternate. Try it, then learn the one check that settles each pulley.', 'rope-count', 2, 4),
            { id: 'rim', kind: 'slide', title: 'The rim goes with the rope', text: 'Where the rope touches a pulley, the rim moves the way the rope moves. Rope going right over the top turns the pulley clockwise. Rope going right under the bottom turns it anticlockwise.' },
            { id: 'side', kind: 'slide', title: 'Same side, same turn', text: 'If the rope passes two pulleys on the same side of itself, they turn the same way. The direction changes only where the rope crosses over to the other side of the next pulley.' },
            { id: 'which-way', kind: 'slide', title: 'First find which way the rope moves', text: 'Pulling the free end drags the rope towards it. Letting the weight down sends the rope the other way, and every pulley reverses.' },
            worked('rope-count', 5, 4),
            check('check-1', 'rope-count', 1, 4), check('check-2', 'rope-count', 8, 4), check('check-3', 'rope-count', 11, 4),
            practice('rope-count', 4),
            check('check-hook', 'rope-count', 2, 4),
            { id: 'remember', kind: 'takeaway', body: 'Find which way the rope moves. At each pulley the rim goes with the rope. The turn changes only when the rope changes side.' },
          ],
        },
        {
          id: 'locked-and-marks', title: 'Will it move, and when do marks meet?', minutes: 14, level: 4,
          summary: 'A ring of gears can lock solid. Two marked gears line up again only after a set number of turns.',
          steps: [
            hook('Some of these cannot turn at all. More than one answer may be right.', 'will-it-move', 2, 4),
            { id: 'ring', kind: 'slide', title: 'Go round the ring', text: 'Mark one gear clockwise and go round, reversing each time. If you get back to the start with the opposite arrow, the gears are locked. That happens whenever the ring has an odd number of gears.', ...gears('ring'), hint: 'Drag the slider through 3, 4, 5 and 6 gears.' },
            check('check-1', 'will-it-move', 5, 4), check('check-2', 'will-it-move', 9, 4),
            { id: 'marks', kind: 'slide', title: 'Count teeth, not turns', text: 'Two marks start together. After a whole number of turns each mark is back, so they meet again when the teeth that have passed is a multiple of both tooth counts: the lowest common multiple.' },
            worked('gear-realign', 1, 4),
            check('check-3', 'gear-realign', 4, 4), check('check-4', 'gear-realign', 7, 4), check('check-5', 'gear-realign', 10, 4),
            practice('gear-realign', 4),
            check('check-hook', 'will-it-move', 2, 4),
            { id: 'remember', kind: 'takeaway', body: 'An odd ring is locked. Marks meet again after the lowest common multiple of the tooth counts has passed.' },
          ],
        },
        {
          id: 'mobiles', title: 'A hanging mobile', minutes: 14, level: 4,
          summary: 'Sticks hanging from sticks. Balance one at a time, from the weight you know upward.',
          steps: [
            hook('Only one weight is given. Every other weight follows from it, one stick at a time.', 'mobile-balance', 3, 4),
            { id: 'bottom-up', kind: 'slide', title: 'Start where you know a weight', text: 'Find the stick that holds the known weight. Count the marks on each arm and use weight × arm to find the weight on its other end.' },
            { id: 'carry', kind: 'slide', title: 'A stick pulls with all it carries', text: 'The string holding a stick carries both of its weights added together. Use that total as the weight on the stick above.' },
            worked('mobile-balance', 6, 4),
            check('check-1', 'mobile-balance', 1, 4), check('check-2', 'mobile-balance', 8, 4), check('check-3', 'mobile-balance', 12, 4),
            practice('mobile-balance', 4),
            check('check-hook', 'mobile-balance', 3, 4),
            { id: 'remember', kind: 'takeaway', body: 'Lowest stick first. Weight × arm on each side, then pass the total up the string.' },
          ],
        },
        {
          id: 'machines-hard', title: 'More machines, harder', minutes: 14, level: 4,
          summary: 'Larger pulley blocks, bars to add to a frame, and coins rolling round coins.',
          steps: [
            hook('How many bars must be added before this frame stops wobbling?', 'rigid-frame', 1, 4),
            { id: 'count', kind: 'slide', title: '2J − 3', text: 'A pinned frame with J joints needs 2J − 3 bars, each doing work, to be rigid. Count the panels that are not triangles: a four-sided panel needs one diagonal, a five-sided panel two.' },
            worked('rigid-frame', 2, 4),
            check('check-1', 'rigid-frame', 3, 4), check('check-2', 'pulley-effort', 1, 4),
            { id: 'coins', kind: 'slide', title: 'Coins round coins', text: 'A coin rolling round another turns once for each of its own rims along the path, plus one more for going round the outside, or one fewer going round the inside. Equal coins: two turns.' },
            check('check-3', 'rolling', 1, 4), check('check-4', 'rolling', 2, 4),
            practice('rolling', 4),
            check('check-hook', 'rigid-frame', 1, 4),
            { id: 'remember', kind: 'takeaway', body: '2J − 3 bars. Outside: one extra turn; inside: one fewer.' },
          ],
        },
      ],
      quiz: { title: 'Exam hard quiz', minutes: 20, pass: 5, marking: 'plain', questions: [{ kind: 'system-speed', level: 4, count: 2 }, { kind: 'rope-count', level: 4, count: 2 }, { kind: 'will-it-move', level: 4, count: 1 }, { kind: 'gear-realign', level: 4, count: 1 }, { kind: 'mobile-balance', level: 4, count: 2 }, { kind: 'rigid-frame', level: 4, count: 1 }, { kind: 'rolling', level: 4, count: 1 }] },
    },
    {
      id: 'mastery', title: 'Mastery', level: 5,
      lessons: [
        {
          id: 'review', title: 'Mixed review', minutes: 10, level: 5,
          summary: 'The rules once more, then mixed practice before the timed set.',
          steps: [
            { id: 'rules', kind: 'slide', title: 'The rules on one screen', text: ['Direction: reverse at a mesh or crossed belt, copy at an open belt or shared shaft. A rope turns each pulley the way it moves at the rim.', 'Speed: speed × size is equal across teeth or a belt; a shaft copies the speed. Balance: weight × distance is equal on both sides.'] },
            { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'Two minutes a question. Typed answers lose nothing when wrong, so always enter one. Single-choice questions lose marks when wrong, so rule options out properly.' },
            { id: 'practice-1', kind: 'practice', question: { kind: 'system-speed', level: 4 }, streak: 2 },
            { id: 'practice-2', kind: 'practice', question: { kind: 'rope-count', level: 4 }, streak: 2 },
            { id: 'remember', kind: 'takeaway', body: 'Arrows and speeds on paper, one link at a time. Never by eye.' },
          ],
        },
      ],
      quiz: { title: 'Timed exam set', minutes: 24, pass: 9, marking: 'uceed', description: 'Twelve mechanism questions at exam pace, marked like UCEED.', questions: [{ kind: 'gear-speed', level: 3, count: 1 }, { kind: 'compound-speed', level: 3, count: 2 }, { kind: 'count-clockwise', level: 3, count: 1 }, { kind: 'lever-balance', level: 3, count: 1 }, { kind: 'system-speed', level: 4, count: 2 }, { kind: 'rope-count', level: 4, count: 2 }, { kind: 'gear-realign', level: 4, count: 1 }, { kind: 'will-it-move', level: 4, count: 1 }, { kind: 'mobile-balance', level: 4, count: 1 }] },
    },
  ],
});
