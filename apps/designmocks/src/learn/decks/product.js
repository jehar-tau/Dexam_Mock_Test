// Method deck for product design thinking. The method follows the owner's
// design-thinking theory guide (User + Context + Problem + Feature +
// Material + Label); every brief here is our own, not a bank question.
import { seededRandom, shuffle } from '../random.js';

const PHASES = ['Research the need', 'Analyse the findings', 'Generate ideas', 'Prototype and test', 'Develop the product', 'Take it to market'];
function orderItems() {
  const out = [], LET = 'ABCDEF';
  for (let s = 1; s <= 8; s++) {
    const rng = seededRandom(s * 911), shown = shuffle(rng, PHASES.map((_, i) => i)), say = order => order.map(i => LET[shown.indexOf(i)]).join(', ');
    const truth = PHASES.map((_, i) => i), wrong = [];
    for (let g = 0; wrong.length < 3 && g < 40; g++) { const p = [...truth], i = Math.floor(rng() * 5); [p[i], p[i + 1]] = [p[i + 1], p[i]]; if (rng() < 0.5) { const j = Math.floor(rng() * 5); [p[j], p[j + 1]] = [p[j + 1], p[j]]; } if (p.join() !== truth.join() && !wrong.some(w => w.join() === p.join())) wrong.push(p); }
    out.push({ prompt: 'These steps of a design project are jumbled. Which order is right?', table: { head: ['', 'Step'], rows: shown.map((i, k) => [LET[k], PHASES[i]]) }, right: say(truth), wrong: wrong.map(p => ({ text: say(p), why: `${PHASES[p.findIndex((v, i) => v !== i)]} is out of place: research comes before ideas, ideas before prototypes, prototypes before the business.` })), why: `Research → analysis → ideas → prototype and test → develop → market: ${say(truth)}.` });
  }
  return out;
}
function rampItems() {
  const sets = [[[0.5, 6], [0.6, 6], [0.8, 8], [0.4, 3]], [[0.3, 4], [0.45, 5], [0.6, 9], [0.5, 4]], [[0.6, 10], [0.4, 5], [0.9, 12], [0.3, 3]], [[0.75, 9], [0.5, 5], [0.4, 6], [0.6, 6]]];
  return sets.map(rs => {
    const slope = ([h, l]) => h / l, best = rs.reduce((a, b) => (slope(b) < slope(a) ? b : a)), say = ([h, l]) => `Rise ${h} m over ${l} m`;
    return { prompt: 'Which ramp is easiest to push a wheelchair up? (Heights are drawn six times taller so they show.)', optionFigures: Object.fromEntries(rs.map(r => [say(r), { type: 'ramp', rise: r[0], run: r[1] }])), right: say(best), wrong: rs.filter(r => r !== best).map(r => ({ text: say(r), why: `Its slope is ${(slope(r) * 100).toFixed(1)}%, steeper than ${(slope(best) * 100).toFixed(1)}%. Length alone does not decide it; rise ÷ length does.` })), why: `The variable that matters is slope, rise ÷ length: ${(slope(best) * 100).toFixed(1)}% is the gentlest.`, steps: ['The context depends on one physical variable: the slope.', `Slopes: ${rs.map(r => `${(slope(r) * 100).toFixed(1)}%`).join(', ')}.`, `The gentlest is ${say(best)}.`] };
  });
}

export const productDeck = Object.freeze({
  prefix: 'pd', topic: 'product-design',
  levels: { users: [2], label: [2], material: [2], process: [2, 4], context: [3], pain: [3], feature: [3, 4] },
  method: {
    users: { hint: 'Which trait of the setting does each challenge depend on?', steps: ['List what the setting stresses: motion, height, reach, hygiene, time.', 'Pick the group whose body or role meets that stress.', 'Reject challenges that would be true anywhere.'] },
    label: { hint: 'Short noun phrase, pointed at the part.', steps: ['A label names a feature in a few words.', 'It points with a leader line to the exact part.', 'Sentences and vague words cost marks.'] },
    material: { hint: 'Name the one property the use demands.', steps: ['Find what the product must survive: water, weight, heat, cleaning.', 'Choose the material whose key property matches.', 'Justify it in one word.'] },
    process: { hint: 'Research before ideas, ideas before prototypes, prototypes before the business.', steps: ['Label each step with its phase.', 'Recall the phase order: research, analysis, ideas, prototype and test, development, market.', 'Read the letters in that order.'] },
    context: { hint: 'Find the one physical variable the setting depends on.', steps: ['Name the variable: slope, space, light, noise, crowd.', 'Restate each option in terms of that variable.', 'Reject absolute claims that ignore it.'] },
    pain: { hint: 'Separate what each side demands from what actually hurts.', steps: ['Write down each side’s stated demand.', 'Name the burden underneath in one sentence.', 'The answer removes that burden without taking away either side’s real interest.'] },
    feature: { hint: 'Every feature must trace back to a named problem.', steps: ['List the constraints exactly as given.', 'For each feature, ask which constraint it answers.', 'A feature that answers none is decoration.'] },
  },
  items: {
    users: [
      { brief: 'A ticket machine stands on a crowded railway platform.', prompt: 'Which user challenge is tied to this setting, not just a general complaint?', right: 'A wheelchair user cannot reach the touch screen set at standing height', wrong: ['Some people dislike queuing', 'Tickets can be expensive', 'Users want the machine to look modern'], why: 'It names a group, a body constraint (seated reach) and the exact part of the setting.' },
      { brief: 'A wash basin is fitted in a moving bus on hill roads.', prompt: 'Which user challenge comes from this context?', right: 'An elderly passenger loses balance at the basin when the bus swerves', wrong: ['People forget to wash their hands', 'Soap can run out', 'The basin colour may not suit everyone'], why: 'The motion of the bus is the stress; balance is the body constraint.' },
      { brief: 'A public library has tall shelves and a busy help desk.', prompt: 'Which user challenge is specific to this setting?', right: 'A child cannot reach books on the upper shelves', wrong: ['Readers want more books', 'Some people prefer e-books', 'The library should be open longer'], why: 'Height of the shelves meets the reach of a small body.' },
      { brief: 'A water tap is fixed at a roadside stall used all day in summer.', prompt: 'Which challenge is tied to the setting?', right: 'A labourer with wet, gloved hands cannot grip the small round knob', wrong: ['Water should be free', 'People like cold water', 'Taps should come in more colours'], why: 'Grip is the constraint; the knob shape is the part.' },
    ],
    label: [
      { prompt: 'Which is the best label for a sketch of a water bottle’s lid?', right: 'Leak-proof screw cap', wrong: ['This cap stops the water from leaking when the bottle is tilted', 'Nice lid', 'Cap (see notes)'], why: 'A short noun phrase naming the feature and what it does.' },
      { prompt: 'Which is the best label for the handle on a school bag sketch?', right: 'Padded grab handle', wrong: ['The handle is padded so that it is comfortable to hold for a long time', 'Handle?', 'Good design here'], why: 'Short, specific, and it names the feature.' },
      { prompt: 'How should a label point to a small hinge on a sketch?', right: 'A straight leader line from the label to the hinge itself', wrong: ['A circle drawn loosely round that corner', 'A paragraph beside the drawing', 'A number with no key'], why: 'The examiner must see exactly which part is meant.' },
      { prompt: 'A product is shown packed and open. What should the labels show?', right: 'What changes between the two states, such as “roll and clip, packed”', wrong: ['The same labels copied on both drawings', 'Only the colours used', 'A long story of how it is used'], why: 'Showing two states is only useful if the change is labelled.' },
    ],
    material: [
      { prompt: 'A shower caddy must stay in a wet bathroom for years. Which single property should decide its material?', right: 'Waterproof and rust-free', wrong: ['Shiny', 'Heavy', 'Cheapest possible, whatever happens to it'], why: 'Constant water is the main thing it must survive.' },
      { prompt: 'Four chair designs: P stands on four straight legs set wide, Q on three thin legs, R on one central post, S on two narrow runners. Which is most stable?', figure: { type: 'chairs', chairs: [{ label: 'P', kind: 'wide' }, { label: 'Q', kind: 'thin' }, { label: 'R', kind: 'post' }, { label: 'S', kind: 'runners' }] }, right: 'P', wrong: ['Q', 'R', 'S'], why: 'The widest base and lowest bulk keep the centre of gravity well inside the base.' },
      { prompt: 'Which chair is made of the fewest visible parts?', right: 'One continuous bent piece of plywood', wrong: ['A frame of separate jointed struts', 'Four legs, a seat and a back screwed together', 'A seat on a stand with arms bolted on'], why: 'A single continuous formed piece has the fewest parts.' },
      { prompt: 'A lunch box for children must be cleaned every day. Which material word justifies the choice best?', right: 'Washable', wrong: ['Decorative', 'Rare', 'Traditional'], why: 'Daily cleaning is the demand; washable answers it in one word.' },
    ],
    process: orderItems(),
    context: [
      ...rampItems(),
      { prompt: 'A reading lamp is for a shared hostel room at night. Which statement is true?', right: 'The light must be aimed so it does not fall on the sleeping roommate', wrong: ['A brighter lamp is always better, whatever the room', 'The lamp’s colour matters more than where its light goes', 'Night use makes no difference to the design'], why: 'The variable is where the light falls; absolute claims ignore it.' },
    ],
    pain: [
      { brief: 'Two flatmates argue: one wants the window open for air, the other shut because street dust settles on his desk.', prompt: 'What is the underlying pain point?', right: 'Dust landing on the desk', wrong: ['The window itself', 'Wanting fresh air', 'Having a flatmate'], why: 'Solve the dust and the window can stay open: a mesh screen or moving the desk keeps both interests.' },
      { brief: 'A shopkeeper wants a bus stop moved because waiting crowds block his door; commuters refuse because it is the only covered stop.', prompt: 'What is the real problem to solve?', right: 'Crowds blocking access to the shop door', wrong: ['The bus stop existing', 'Commuters wanting shelter', 'The shopkeeper’s sales'], why: 'Rearranging where the queue stands keeps the shelter and frees the door.' },
      { brief: 'Parents want a playground closed at dusk because children come home late; children want it open.', prompt: 'What is the pain point under the demand?', right: 'Children losing track of time', wrong: ['The playground itself', 'Children wanting to play', 'Parents being strict'], why: 'A visible clock or a closing chime solves it without closing the playground early.' },
      { brief: 'Office staff want the meeting-room door locked because people walk in during calls; others need the room for quick chats.', prompt: 'What is the underlying problem?', right: 'Not knowing whether the room is in use', wrong: ['The door having no lock', 'People liking quick chats', 'Calls being too long'], why: 'An in-use sign answers it; locking the door would serve only one side.' },
    ],
    feature: [
      { brief: 'Brief: carry 15 litres of water uphill on uneven paths, kept clean, used by several families.', prompt: 'Which feature answers none of the stated constraints?', right: 'A glossy printed pattern on the side', wrong: [{ text: 'Backpack straps for carrying uphill', why: 'This answers the uphill carrying.' }, { text: 'A sealed screw opening to keep the water clean', why: 'This answers hygiene.' }, { text: 'A wide grippy base for setting down on rough ground', why: 'This answers the uneven paths.' }], why: 'Every feature must trace back to a stated problem; decoration answers none.' },
      { brief: 'Brief: a study lamp for a student who works late in a small shared room.', prompt: 'Which feature traces back to a stated need?', right: 'A shade that keeps the light on the desk only', wrong: [{ text: 'A built-in speaker', why: 'Nothing in the brief asks for sound.' }, { text: 'Gold-coloured trim', why: 'Decoration answers no stated need.' }, { text: 'A very tall stand', why: 'A small room argues against a tall stand.' }], why: 'The shared room is the constraint; containing the light answers it.' },
      { brief: 'Brief: a medicine box for an elderly person with weak eyesight who must take tablets at three times a day.', prompt: 'Which feature answers a stated constraint?', right: 'Large, high-contrast morning / noon / night compartments', wrong: [{ text: 'A secret compartment', why: 'Nothing in the brief needs hiding.' }, { text: 'Tiny printed labels', why: 'Weak eyesight needs the opposite.' }, { text: 'A glossy mirror finish', why: 'Glare makes reading harder.' }], why: 'It answers both the eyesight and the three daily doses.' },
      { brief: 'Brief: a school bag for children who walk 3 km and carry wet umbrellas.', prompt: 'Which set of features traces fully to the brief?', right: 'Padded straps, a waterproof umbrella pocket, reflective strips', wrong: [{ text: 'Glitter print, a keyring, a bottle opener', why: 'None of these answers the walk or the wet umbrella.' }, { text: 'Padded straps, glitter print, a keyring', why: 'Only one of these answers the brief.' }, { text: 'A rigid hard shell, wheels, a lock', why: 'Wheels and a hard shell do not suit a long walk; the umbrella is not answered.' }], why: 'Long walk: padded straps and visibility; wet umbrella: a waterproof pocket.' },
    ],
  },
});
