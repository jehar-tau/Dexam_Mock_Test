// Everyday physics: floating, mirrors, lenses, sound and light, twisted
// loops, rolling, how a mechanism works and control mapping.
// Specification: docs/learn/topics/everyday-physics.md.
import { pick, seededRandom, shuffle } from './random.js';

const LETTERS = 'ABCD';
function retry(seed, build) {
  for (let i = 0; i < 400; i++) { const q = build(seededRandom(seed * 6211 + i * 4519)); if (q) return q; }
  throw new Error('No physics question for seed ' + seed);
}
const lettered = (rng, list) => {
  const options = shuffle(rng, list).map((o, i) => ({ ...o, id: LETTERS[i], label: LETTERS[i] }));
  return { options, answer: options.find(o => o.correct).id };
};
const clean = (value, list) => list.map(m => ({ ...m, value: Math.round(m.value * 100) / 100 })).filter((m, i, l) => m.value > 0 && m.value !== value && l.findIndex(o => o.value === m.value) === i);

export const DENSITY = Object.freeze({ cork: 0.24, pine: 0.5, ice: 0.92, candle_wax: 0.9, olive_oil: 0.92, rubber: 1.2, glass: 2.5, aluminium: 2.7, iron: 7.9, gold: 19.3, plastic_bottle_cap: 0.95, teak: 0.65 });
const nice = k => k.replace(/_/g, ' ');
export function floatingQuestion(seed, level = 2) {
  return retry(seed, rng => {
    if (level <= 2) {
      const floats = shuffle(rng, Object.keys(DENSITY).filter(k => DENSITY[k] < 1)), sinks = shuffle(rng, Object.keys(DENSITY).filter(k => DENSITY[k] > 1)), askFloat = rng() < 0.5;
      const right = askFloat ? floats[0] : sinks[0], wrong = (askFloat ? sinks : floats).slice(0, 3);
      const { options, answer } = lettered(rng, [right, ...wrong].map(k => ({ correct: k === right, text: `${nice(k)} (${DENSITY[k]} g/cm³)`, reason: `${DENSITY[k] < 1 ? 'Less' : 'More'} dense than water (1 g/cm³), so it ${DENSITY[k] < 1 ? 'floats' : 'sinks'}.` })));
      return { kind: 'floating', seed, answerMode: 'single', prompt: `Which of these ${askFloat ? 'floats' : 'sinks'} in fresh water?`, figures: [], options, answer, explanation: 'Anything less dense than the liquid floats; anything denser sinks. Water is 1 g/cm³.' };
    }
    const obj = pick(rng, Object.keys(DENSITY).filter(k => DENSITY[k] < 1)), liquid = pick(rng, [['fresh water', 1], ['sea water', 1.025]]);
    const value = Math.round((DENSITY[obj] / liquid[1]) * 1000) / 10;
    if (liquid[1] !== 1 && rng() < 0.5) return null;
    return { kind: 'floating', seed, answerMode: 'numeric', unit: '%', prompt: `A block of ${nice(obj)} (density ${DENSITY[obj]} g/cm³) floats in ${liquid[0]} (density ${liquid[1]} g/cm³). What percentage of the block is under the surface? Give one decimal place.`, figures: [], answer: { value }, mistakes: clean(value, [{ value: 100 - value, reason: 'That is the part above the surface.' }, { value: DENSITY[obj] * 100, reason: liquid[1] === 1 ? 'Check the arithmetic: divide by the liquid’s density.' : 'Divide by the sea water’s density, not by 1.' }]), explanation: `A floating body sinks until it pushes aside its own weight of liquid: fraction under = its density ÷ the liquid’s = ${DENSITY[obj]} ÷ ${liquid[1]} = ${value}%.`, hints: ['A floating body displaces its own weight of liquid.', 'Fraction under the surface = object density ÷ liquid density.'], solution: [{ text: `Object ${DENSITY[obj]}, liquid ${liquid[1]} g/cm³.` }, { text: `${DENSITY[obj]} ÷ ${liquid[1]} = ${Math.round((DENSITY[obj] / liquid[1]) * 10000) / 10000}.` }, { text: `${value}% is under the surface.` }] };
  });
}
export function mirrorQuestion(seed, level = 2) {
  return retry(seed, rng => {
    if (level <= 2) {
      const d = pick(rng, [1, 1.5, 2, 2.5, 3]), step = pick(rng, [0, 0.5, 1]), value = 2 * (d - step);
      if (value <= 0) return null;
      return { kind: 'mirror', seed, answerMode: 'numeric', unit: 'm', prompt: step ? `You stand ${d} m in front of a flat mirror, then step ${step} m towards it. How far are you now from your image, in metres?` : `You stand ${d} m in front of a flat mirror. How far are you from your image, in metres?`, figures: [], answer: { value }, mistakes: clean(value, [{ value: d - step, reason: 'That is your distance to the mirror; the image is as far behind it.' }, { value: 2 * d, reason: 'Use your new distance after stepping.' }]), explanation: `The image is as far behind the mirror as you are in front: 2 × ${d - step} = ${value} m.` };
    }
    const H = pick(rng, [150, 160, 170, 180]), value = H / 2;
    return { kind: 'mirror', seed, answerMode: 'numeric', unit: 'cm', prompt: `A person ${H} cm tall wants to see their whole body in a flat wall mirror. What is the shortest mirror that works, in centimetres?`, figures: [], answer: { value }, mistakes: clean(value, [{ value: H, reason: 'Light from your feet reflects halfway up between your eyes and your feet, so half your height is enough.' }, { value: H / 4, reason: 'Half your height, not a quarter.' }]), explanation: `Each ray reflects halfway between the eye and the point it comes from, so the mirror needs only half your height: ${value} cm, wherever you stand.`, hints: ['Draw the ray from your feet to the mirror and back to your eyes.', 'It meets the mirror halfway up.'], solution: [{ text: 'Top of the mirror: halfway between eyes and top of the head.' }, { text: 'Bottom: halfway between eyes and feet.' }, { text: `Length: half of ${H} = ${value} cm.` }] };
  });
}
export const LENS_SETS = Object.freeze([[30, 10], [20, 10], [15, 10], [60, 20], [40, 20], [12, 8], [24, 12], [36, 12], [18, 12]]);
export function lensQuestion(seed, level = 3) {
  return retry(seed, rng => {
    if (level <= 2) {
      const inside = rng() < 0.5;
      const right = inside ? 'Upright and larger: a magnifying glass' : 'Upside down, on the far side of the lens';
      const { options, answer } = lettered(rng, [right, inside ? 'Upside down, on the far side of the lens' : 'Upright and larger: a magnifying glass', 'No image ever forms', 'The same size and upright, like a flat mirror'].map(t => ({ correct: t === right, text: t, reason: t === right ? (inside ? 'Inside the focal length a convex lens magnifies.' : 'Beyond the focal length a convex lens forms a real, inverted image.') : 'Compare the object’s distance with the focal length.' })));
      return { kind: 'lens', seed, answerMode: 'single', prompt: `A convex lens has a focal length of 10 cm. An object is placed ${inside ? 5 : 30} cm from it. What image do you get?`, figures: [], options, answer, explanation: 'Inside the focal length: upright, magnified, as in a magnifying glass. Beyond it: a real, upside-down image that can fall on a screen.' };
    }
    const [u, f] = pick(rng, LENS_SETS), v = (u * f) / (u - f), askMag = level >= 4 && rng() < 0.5, value = askMag ? Math.round((v / u) * 100) / 100 : v;
    if (!Number.isInteger(v)) return null;
    return { kind: 'lens', seed, answerMode: 'numeric', unit: askMag ? '×' : 'cm', prompt: askMag ? `An object is ${u} cm from a convex lens of focal length ${f} cm. How many times its size is the image?` : `An object is ${u} cm from a convex lens of focal length ${f} cm. How far from the lens does a sharp image form on a screen, in centimetres?`, figures: [], answer: { value }, mistakes: clean(value, askMag ? [{ value: u / v, reason: 'Image size ÷ object size = image distance ÷ object distance.' }, { value: f / u, reason: 'Use the image distance, not the focal length.' }] : [{ value: u - f, reason: 'Use 1/f = 1/u + 1/v, not a subtraction.' }, { value: (u * f) / (u + f), reason: 'For a real image, 1/v = 1/f − 1/u.' }, { value: u, reason: 'The image is not always as far as the object.' }]), explanation: `1/v = 1/${f} − 1/${u}, so v = ${u} × ${f} ÷ (${u} − ${f}) = ${v} cm.${askMag ? ` Size ratio v ÷ u = ${v} ÷ ${u} = ${value}.` : ''}`, hints: ['Lens rule: 1/f = 1/u + 1/v for a real image.', askMag ? 'Then image size ÷ object size = v ÷ u.' : 'Rearrange: v = u f ÷ (u − f).'], solution: [{ text: `1/v = 1/${f} − 1/${u}.` }, { text: `v = ${u} × ${f} ÷ ${u - f} = ${v} cm.` }, { text: askMag ? `Size ratio ${v} ÷ ${u} = ${value}.` : `The image forms ${v} cm from the lens.` }] };
  });
}
export function soundQuestion(seed, level = 2) {
  return retry(seed, rng => {
    const echo = level >= 3 && rng() < 0.6, t = pick(rng, [1, 1.5, 2, 3, 4, 5]), value = echo ? (340 * t) / 2 : 340 * t;
    return { kind: 'sound', seed, answerMode: 'numeric', unit: 'm', prompt: echo ? `You shout towards a cliff and hear the echo ${t} s later. Sound travels at 340 m/s. How far away is the cliff, in metres?` : `You see lightning and hear its thunder ${t} s later. Sound travels at 340 m/s and the light arrives almost at once. How far away was the strike, in metres?`, figures: [], answer: { value }, mistakes: clean(value, echo ? [{ value: 340 * t, reason: 'The sound went there and back: halve it.' }, { value: 340 / t, reason: 'Distance = speed × time.' }] : [{ value: (340 * t) / 2, reason: 'Thunder makes a one-way trip; do not halve.' }, { value: 340 / t, reason: 'Distance = speed × time.' }]), explanation: echo ? `The echo travels there and back: 340 × ${t} ÷ 2 = ${value} m.` : `Light is almost instant, so the delay is the sound's travel time: 340 × ${t} = ${value} m (about a kilometre every 3 seconds).`, ...(level >= 3 ? { hints: ['Distance = speed × time.', echo ? 'An echo travels there and back.' : 'Light arrives almost at once.'], solution: [{ text: 'Speed of sound: 340 m/s.' }, { text: echo ? `There and back: 340 × ${t} = ${340 * t} m.` : `One way: 340 × ${t}.` }, { text: `Distance: ${value} m.` }] } : {}) };
  });
}
export function twistQuestion(seed) {
  return retry(seed, rng => {
    const k = pick(rng, [0, 1, 2, 3, 4]), ask = pick(rng, ['edges', 'sides']), value = k % 2 ? 1 : 2;
    const words = k === 0 ? 'no twist' : `${k} half-twist${k > 1 ? 's' : ''}`;
    return { kind: 'twist', seed, answerMode: 'numeric', unit: '', prompt: `A paper strip is given ${words} and its ends are taped together. How many ${ask} does the loop have?`, figures: [], answer: { value }, mistakes: [{ value: 3 - value, reason: k % 2 ? 'An odd number of half-twists joins the two edges into one, and the two sides into one.' : 'An even number of half-twists leaves two edges and two sides, like a plain loop.' }], explanation: `What matters is whether the number of half-twists is odd or even. ${k} is ${k % 2 ? 'odd: one side and one edge, like a Möbius strip' : 'even: two sides and two edges, like a plain loop'}.`, hints: ['Only odd or even matters.', 'A full twist is two half-twists.'], solution: [{ text: `${words}: ${k % 2 ? 'odd' : 'even'}.` }, { text: k % 2 ? 'Odd joins the edges and sides into one.' : 'Even leaves them separate.' }, { text: `${ask}: ${value}.` }] };
  });
}
export function rollAngleQuestion(seed) {
  return retry(seed, rng => {
    const r = pick(rng, [10, 14, 20, 21, 35]), turnDeg = pick(rng, [90, 180, 270, 360, 540, 720]), dist = Math.round((22 / 7) * r * (turnDeg / 180) * 100) / 100;
    if (!Number.isInteger(dist * 10)) return null;
    return { kind: 'roll-angle', seed, answerMode: 'numeric', unit: '°', prompt: `A wheel of radius ${r} cm rolls ${dist} cm along the ground without slipping. Taking π as 22/7, through how many degrees does it turn?`, figures: [], answer: { value: turnDeg }, mistakes: clean(turnDeg, [{ value: turnDeg / 2, reason: 'Use the radius, not the diameter: angle in radians = distance ÷ radius.' }, { value: turnDeg * 2, reason: 'One full turn rolls 2πr, not πr.' }]), explanation: `Angle in radians = distance ÷ radius = ${dist} ÷ ${r}; in degrees, × 180 ÷ π = ${turnDeg}°.`, hints: ['Rolling without slipping: distance = radius × angle (in radians).', 'Convert radians to degrees: × 180 ÷ π.'], solution: [{ text: `One full turn rolls 2 × 22/7 × ${r} = ${Math.round((44 / 7) * r * 100) / 100} cm.` }, { text: `${dist} cm is ${turnDeg / 360} of that.` }, { text: `${turnDeg / 360} × 360 = ${turnDeg}°.` }] };
  });
}

// Authored items for mechanism chains and control mapping (our own examples).
export const physicsMethod = Object.freeze({
  prefix: 'phy', topic: 'everyday-physics',
  levels: { chain: [3], mapping: [2] },
  method: {
    chain: { hint: 'Follow the input one part at a time to the output.', steps: ['Find where the user pushes, turns or squeezes.', 'Follow that motion to each next part in turn.', 'Reject any step that is physically impossible, such as flow backward through a one-way valve.'] },
    mapping: { hint: 'Do the controls sit in the same layout as what they control?', steps: ['Note the layout of the outcomes.', 'Note the layout of the controls.', 'The best layout needs no labels.'] },
  },
  items: {
    chain: [
      { prompt: 'In a hand-pump soap dispenser, you press the button down and let go. What happens as the spring pushes the piston back up?', right: 'Suction draws soap up from the bottle into the pump, ready for the next press', wrong: ['Soap flows back down into the bottle', 'Air is blown out of the nozzle', 'Nothing until the next press'], why: 'Rising piston → lower pressure → bottom valve opens, top valve shuts → soap drawn in.' },
      { prompt: 'You click the top of a retractable ball-point pen once. What does the click do?', right: 'A cam turns and locks the refill in the writing position', wrong: ['It refills the ink', 'It sharpens the tip', 'It releases the spring permanently'], why: 'Push → plunger turns the cam → cam catches in a notch → refill held out.' },
      { prompt: 'You squeeze a bicycle’s hand brake. What is the chain from hand to wheel?', right: 'Lever pulls the cable, the cable closes the calipers, the pads press the rim', wrong: ['Lever pushes the tyre directly', 'Cable spins the wheel backwards', 'Pads lift away from the rim'], why: 'Input squeeze → cable tension → caliper arms close → friction on the rim.' },
      { prompt: 'You turn a door handle down. How does the latch let the door open?', right: 'The spindle turns a cam that pulls the latch bolt back into the door', wrong: ['The hinge lifts the door', 'The handle pushes the door frame', 'The latch springs further out'], why: 'Turn → spindle → cam → latch withdrawn → door free.' },
    ],
    mapping: [
      { prompt: 'A cooker has four burners in a square. Which knob layout needs no labels?', right: 'Knobs arranged in the same square, each next to its burner’s position', wrong: ['Four knobs in a straight row, in any order', 'Knobs on the back of the cooker', 'One knob that cycles through the burners'], why: 'The control layout mirrors the burner layout.' },
      { prompt: 'A car has four window switches by the driver. Which layout is best?', right: 'Switches laid out like the seats: front left, front right, rear left, rear right', wrong: ['A straight row in random order', 'A single switch for all windows', 'Switches on the roof'], why: 'Matching the seating plan lets the driver press the right one without reading.' },
      { prompt: 'A classroom has three rows of lights, front to back. Which switch panel maps best?', right: 'Three switches in a column, top for the front row and bottom for the back', wrong: ['Three switches in a random order', 'One switch for all three rows', 'Switches numbered 7, 2 and 5'], why: 'The panel order follows the room order.' },
      { prompt: 'Which is a sign of poor control mapping?', right: 'Users need labels to guess which control works which thing', wrong: ['Controls are grouped by what they do', 'Controls sit next to what they control', 'Controls move in the direction of the result'], why: 'Good mapping needs no labels.' },
    ],
  },
});

export function physicsQuestion(seed, kind, level) {
  switch (kind) {
    case 'floating': return floatingQuestion(seed, level);
    case 'mirror': return mirrorQuestion(seed, level);
    case 'lens': return lensQuestion(seed, level);
    case 'sound': return soundQuestion(seed, level);
    case 'twist': return twistQuestion(seed);
    case 'roll-angle': return rollAngleQuestion(seed);
    default: throw new Error('Unknown physics kind ' + kind);
  }
}
export const PHYSICS_KINDS = Object.freeze({ floating: [2, 3], mirror: [2, 3], lens: [2, 3, 4], sound: [2, 3], twist: [3], 'roll-angle': [3] });
