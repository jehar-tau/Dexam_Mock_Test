// Method decks for posters, mascots and campaigns, and for storyboarding.
// The methods follow the owner's theory guides; every brief here is our own.
import { seededRandom, shuffle } from '../random.js';

function orderItems(sequences, prompt, why) {
  const out = [], LET = 'ABCDEF';
  sequences.forEach((steps, s) => {
    for (let v = 0; v < 2; v++) {
      const rng = seededRandom((s + 1) * 577 + v * 31), shown = shuffle(rng, steps.map((_, i) => i)), say = order => order.map(i => LET[shown.indexOf(i)]).join(', ');
      const truth = steps.map((_, i) => i), wrong = [];
      for (let g = 0; wrong.length < 3 && g < 60; g++) { const p = [...truth], i = Math.floor(rng() * (steps.length - 1)); [p[i], p[i + 1]] = [p[i + 1], p[i]]; if (rng() < 0.5) { const j = Math.floor(rng() * (steps.length - 1)); [p[j], p[j + 1]] = [p[j + 1], p[j]]; } if (p.join() !== truth.join() && !wrong.some(w => w.join() === p.join())) wrong.push(p); }
      out.push({ prompt, table: { head: ['', 'Item'], rows: shown.map((i, k) => [LET[k], steps[i]]) }, right: say(truth), wrong: wrong.map(p => ({ text: say(p), why: `${steps[p.findIndex((x, i) => x !== i)]} is out of place.` })), why: `${steps.join(' → ')}. ${why}` });
    }
  });
  return out;
}

export const posterDeck = Object.freeze({
  prefix: 'pc', topic: 'posters',
  levels: { hierarchy: [2, 3], slogan: [2], mascot: [3], symbol: [3], campaign: [3, 4], critique: [4] },
  method: {
    hierarchy: { hint: 'The eye should land on the visual, then the headline, then the message, then the call to action.', steps: ['Name the one message.', 'One dominant visual carries it.', 'Size order: headline largest, supporting text smaller, call to action clear.'] },
    slogan: { hint: 'Short, carries the idea on its own, and matches the poster’s tone.', steps: ['Note the exact idea.', 'Cut it to six or eight words, with rhythm or wordplay.', 'Check it makes sense without the poster.'] },
    mascot: { hint: 'A mascot carries the campaign’s value and has personality, not just a look.', steps: ['Name the core value.', 'Choose a character that can plausibly carry it.', 'Give it two or three traits and a silhouette you would know in outline.'] },
    symbol: { hint: 'One form that reads at a glance, inside the format given.', steps: ['List the core idea.', 'Choose one form that reads as that idea.', 'Strip detail until it works small, and fit the format.'] },
    campaign: { hint: 'Audience first: age, literacy, access to media.', steps: ['Identify the issue and the audience.', 'Choose a medium that reaches them and a tone that fits.', 'Build the message around one action that reads without words.'] },
    critique: { hint: 'Check the common mistakes one by one.', steps: ['Is there a single focal point?', 'Is the text short and large enough?', 'Does the slogan relate to the visual, and does the poster communicate rather than decorate?'] },
  },
  items: {
    hierarchy: [
      ...orderItems([['Main visual', 'Headline', 'Supporting message', 'Call to action'], ['Headline', 'Date and place', 'Ticket details', 'Sponsor logos']], 'A poster for a school science fair. In what order should the eye meet these, largest and boldest first?', 'The most important element is the largest; small print comes last.'),
      { prompt: 'Which poster layout will read best from across a school corridor?', optionFigures: { 'One large picture, a big headline, a short line, a clear button': { type: 'poster-mock', layout: 'clear' }, 'Six equal small pictures, all text the same size': { type: 'poster-mock', layout: 'equal' }, 'A small picture and paragraphs of small text': { type: 'poster-mock', layout: 'wall' }, 'A large picture, but a headline as small as the body text': { type: 'poster-mock', layout: 'tiny' } }, right: 'One large picture, a big headline, a short line, a clear button', wrong: [{ text: 'Six equal small pictures, all text the same size', why: 'No single focal point, and no size order.' }, { text: 'A small picture and paragraphs of small text', why: 'Nobody reads paragraphs on a poster from a distance.' }, { text: 'A large picture, but a headline as small as the body text', why: 'The headline must be clearly larger than the rest.' }], why: 'One dominant visual, then a large headline, a short message and a clear call to action.' },
      { prompt: 'A road-safety poster has a big photo, a headline, three paragraphs of facts and a phone number. What most weakens it?', figure: { type: 'poster-mock', layout: 'wall' }, right: 'The three paragraphs of small text', wrong: ['The big photo', 'The headline', 'The phone number'], why: 'Posters are read in seconds from a distance; paragraphs are not read at all.' },
      { prompt: 'What should a passer-by grasp from a poster in the first two seconds?', right: 'The one main message', wrong: ['Every detail of the event', 'The designer’s name', 'All the sponsors'], why: 'A poster is built around one message the eye catches first.' },
    ],
    slogan: [
      { prompt: 'Which slogan best suits a campaign to save water at home?', right: 'Every drop counts', wrong: ['Water is a very important natural resource that we must all try to conserve', 'Buy our taps', 'Blue is a nice colour'], why: 'Short, rhythmic, and it carries the idea on its own.' },
      { prompt: 'Which slogan suits a cheerful bakery advertisement?', right: 'Fresh from our oven to your table', wrong: ['Bread prices are subject to change', 'Food safety rules apply', 'The bakery opened in a building'], why: 'It carries the idea, has rhythm, and matches the warm commercial tone.' },
      { prompt: 'Which slogan suits a serious anti-smoking campaign?', right: 'Every puff steals a breath', wrong: ['Smoke more, laugh more', 'Cigarettes come in packs', 'Have a nice day'], why: 'It is short, carries the message and matches the serious tone.' },
      { prompt: 'Which is the best length for a poster slogan?', right: 'About six to eight words or fewer', wrong: ['A full paragraph', 'At least twenty words', 'Any length, as long as it is true'], why: 'Short lines are remembered and read at a distance.' },
    ],
    mascot: [
      { prompt: 'Which mascot best carries a “keep the beach clean” campaign?', right: 'A cheerful crab who carries a tiny litter bag and scolds litterbugs', wrong: [{ text: 'A detailed photo-realistic crab with no expression', why: 'A mascot needs personality, not just an appearance.' }, { text: 'A tiger in a business suit', why: 'Nothing connects a tiger in a suit to a clean beach.' }, { text: 'A collage of twelve sea creatures', why: 'A mascot is one character with a memorable silhouette.' }], why: 'It belongs to the setting, carries the value through its prop and has personality.' },
      { prompt: 'What makes a mascot memorable?', right: 'A silhouette recognisable in outline alone', wrong: ['Lots of fine detail', 'Realistic shading', 'Many bright colours'], why: 'If you can recognise the outline alone, it works at any size.' },
      { prompt: 'A mascot for a vaccination drive should above all…', right: 'carry the campaign’s value, such as protection, through a trait or prop', wrong: ['be the cutest animal possible', 'show every medical detail', 'look like a famous film character'], why: 'Start from the core value; the character carries it.' },
      { prompt: 'How many personality traits should a campaign mascot show?', right: 'Two or three clear ones', wrong: ['None: appearance is enough', 'As many as possible', 'Only one colour'], why: 'A few clear traits make a character; none make a drawing.' },
    ],
    symbol: [
      { prompt: 'A logo must work as a tiny phone icon. What matters most?', right: 'It still reads when stripped of fine detail', wrong: ['It has realistic shading', 'It includes the full company name in small text', 'It uses many thin lines'], why: 'Symbols must survive small sizes.' },
      { prompt: 'A circular postage stamp honours a poet. Which approach fits stamp conventions?', right: 'A simple profile with one symbolic motif, the value in a corner', wrong: ['A full page of the poet’s poems', 'A detailed crowd scene', 'No value shown, so the art stays clean'], why: 'Stamps carry a simple image, a motif and the denomination in a corner.' },
      { prompt: 'A symbol for “recycling centre” should be built from…', right: 'one form that already reads as recycling, such as circling arrows', wrong: ['several unrelated pictures', 'a long written explanation', 'a random abstract blob'], why: 'One form that reads as the idea at a glance.' },
      { prompt: 'A logo must also print in one colour. How do you check it?', right: 'Look at it in plain black and white; it must still read', wrong: ['Add more colours to compensate', 'Only test it on screen', 'Use gradients for depth'], why: 'Fit the mark to the format: monochrome must still work.' },
    ],
    campaign: [
      { prompt: 'A hand-washing campaign is for village children who cannot yet read. Which medium and approach fit?', right: 'A picture-led wall painting near the school tap showing the steps', wrong: [{ text: 'A newspaper article', why: 'Children who cannot read will not use a newspaper.' }, { text: 'A text-heavy leaflet', why: 'The audience cannot read it.' }, { text: 'A radio talk for adults at night', why: 'It does not reach children at the moment of action.' }], why: 'It reaches the audience where the action happens and needs no reading.' },
      { prompt: 'Which tone suits a campaign against drunk driving?', right: 'Urgent and serious', wrong: ['Silly and jokey', 'Sleepy and calm', 'Boastful'], why: 'Match the tone to the issue: life and death calls for urgency.' },
      { prompt: 'A campaign asks city residents to separate wet and dry waste. Its message should centre on…', right: 'one action: two bins, wet and dry', wrong: ['all the facts about landfills', 'the history of waste collection', 'the mayor’s name'], why: 'One clear action beats many facts.' },
      { prompt: 'A light-hearted campaign asks juice shops to welcome stray birds with water bowls. Which approach fits?', right: 'Humour: birds lining up at a juice counter with a cheeky headline', wrong: ['Grim statistics in small type', 'A legal notice', 'A plain list of shops'], why: 'Humour suits a gentle ask, and the joke reads before any text.' },
    ],
    critique: [
      { prompt: 'A poster shows six small, equal pictures and a slogan unrelated to them. What is the main fault?', figure: { type: 'poster-mock', layout: 'equal' }, right: 'No single focal point, and a slogan unconnected to the visual', wrong: ['It uses pictures', 'The slogan is too short', 'It has a slogan at all'], why: 'One dominant visual and a slogan that belongs to it.' },
      { prompt: 'A mascot is a well-drawn, expressionless owl. What is missing?', right: 'Personality that carries the campaign value', wrong: ['More feathers', 'A realistic background', 'Smaller size'], why: 'A mascot must show personality, not just be an animal.' },
      { prompt: 'A beautiful decorative poster wins no marks. Why?', right: 'It does not communicate a message', wrong: ['It is too beautiful', 'It is in colour', 'It has a border'], why: 'Posters are judged on communication, not decoration.' },
      { prompt: 'A poster’s headline is the same size as its small print. What should change?', figure: { type: 'poster-mock', layout: 'tiny' }, right: 'Make the headline clearly largest', wrong: ['Make everything smaller', 'Add more small print', 'Remove the headline'], why: 'Visual hierarchy needs a clear size order.' },
    ],
  },
});

// Pendulum frames: equal time steps bunch up near the ends of the swing.
function pendulumItems() {
  const fmt = a => a.map(x => `${x}°`).join(', ');
  const make = A => {
    const truth = Array.from({ length: 5 }, (_, k) => Math.round(A * Math.cos((Math.PI * k) / 4)));
    const even = Array.from({ length: 5 }, (_, k) => Math.round(A - (2 * A * k) / 4));
    const bunchedMiddle = [A, Math.round(A * 0.3), 0, Math.round(-A * 0.3), -A];
    const lopsided = [A, Math.round(A * 0.4), 0, Math.round(-A * 0.9), -A];
    const figs = Object.fromEntries([truth, even, bunchedMiddle, lopsided].map(a => [fmt(a), { type: 'pendulum', angles: a }]));
    return { prompt: `A pendulum swings from ${A}° on one side to ${A}° on the other. Five frames are taken at equal time steps and drawn on top of each other. Which drawing is right?`, optionFigures: figs, right: fmt(truth), wrong: [{ text: fmt(even), why: 'Equal angle steps would mean constant speed; a pendulum slows near the ends.' }, { text: fmt(bunchedMiddle), why: 'This bunches the frames near the bottom, where the bob moves fastest.' }, { text: fmt(lopsided), why: 'The swing must be symmetric about the bottom.' }], why: 'The bob moves fastest at the bottom and slowest at the ends, so frames taken at equal times bunch up near the ends, symmetrically.', steps: ['Mark the start and end of the swing.', 'The bob slows near the ends: frames bunch there.', 'The pattern must be symmetric about the bottom.'] };
  };
  return [40, 60, 30, 50].map(make);
}
export const storyDeck = Object.freeze({
  prefix: 'sb', topic: 'storyboarding',
  levels: { frames: [2, 3], shots: [2], caption: [2], process: [3], movement: [3, 4], emotion: [3], critique: [4] },
  method: {
    frames: { hint: 'Setup, problem, twist, resolution.', steps: ['Frame 1 sets up the normal situation.', 'Frame 2 brings the problem; frame 3 the twist or escalation.', 'Frame 4 resolves it.'] },
    shots: { hint: 'Wide to set up, close-up for the problem, reaction for the feeling.', steps: ['Ask what the frame must show.', 'Wide shots show place; close-ups show detail; reaction shots show feeling.', 'Vary the camera across frames.'] },
    caption: { hint: 'A caption names what the drawing cannot show.', steps: ['Draw first; the picture should make sense alone.', 'Use the caption for a feeling, a sound or a jump in time.', 'Never repeat what the drawing already shows.'] },
    process: { hint: 'Show the steps that change the material, each with one action verb.', steps: ['Name the start material and the end product.', 'Keep the three or four steps that really change it.', 'One action verb per frame, arrows forward.'] },
    movement: { hint: 'Equal time steps, smooth path, physical limits.', steps: ['Name the path of the motion.', 'Check spacing: faster means bigger steps between frames.', 'Reject any frame outside the range of motion.'] },
    emotion: { hint: 'Posture and context first, face second.', steps: ['List the states the story passes through.', 'Give each a posture change and a context detail.', 'Make the first and last frames clearly different.'] },
    critique: { hint: 'Check the common mistakes one by one.', steps: ['Does each frame change something?', 'Is the character the same in every frame?', 'Is there a beginning, middle and end?'] },
  },
  items: {
    frames: [
      ...orderItems([['A boy waits happily for the school bus', 'The bus drives off without him', 'A neighbour on a bicycle offers him a ride', 'He arrives at school just in time'], ['A girl plants a seed', 'Days pass and nothing grows', 'A storm floods the pot', 'A green shoot appears after the rain']], 'These four comic frames are jumbled. Which order tells the story?', 'Setup → problem → twist → resolution.'),
      { prompt: 'In a four-frame comic, what is the job of frame 3?', right: 'A twist or escalation', wrong: ['Setting up the normal situation', 'The happy ending', 'The title'], why: 'Setup, problem, twist, resolution.' },
      { prompt: 'In a four-frame comic, what must stay the same in every frame?', right: 'The main character’s look: proportions, hair and clothes', wrong: ['The camera angle', 'The background', 'The facial expression'], why: 'Keep the character consistent; vary the camera.' },
    ],
    shots: [
      { prompt: 'Which frame is a close-up?', optionFigures: { 'The torn ticket filling the frame': { type: 'shot', shot: 'close' }, 'The whole platform with a train': { type: 'shot', shot: 'wide' }, 'One face reacting': { type: 'shot', shot: 'reaction' }, 'Empty sky': { type: 'shot', shot: 'sky' } }, right: 'The torn ticket filling the frame', wrong: [{ text: 'The whole platform with a train', why: 'That is a wide shot: it sets up the place.' }, { text: 'One face reacting', why: 'That is a reaction shot: it shows feeling.' }, { text: 'Empty sky', why: 'It shows nothing of the story.' }], why: 'A close-up fills the frame with one detail: here, the problem.' },
      { prompt: 'Which frame should open the story by setting up the place?', optionFigures: { 'The whole platform with a train': { type: 'shot', shot: 'wide' }, 'The torn ticket filling the frame': { type: 'shot', shot: 'close' }, 'One face reacting': { type: 'shot', shot: 'reaction' }, 'Empty sky': { type: 'shot', shot: 'sky' } }, right: 'The whole platform with a train', wrong: [{ text: 'The torn ticket filling the frame', why: 'A close-up shows the problem, not the setting.' }, { text: 'One face reacting', why: 'A reaction shot belongs after something has happened.' }, { text: 'Empty sky', why: 'It tells the viewer nothing about where we are.' }], why: 'A wide shot sets up where the story happens.' },
      { prompt: 'Frame 1 must show a crowded railway station where the story begins. Which shot?', right: 'A wide shot', wrong: ['An extreme close-up of a ticket', 'A reaction shot of one face', 'A close-up of a shoe'], why: 'Wide shots set up the place.' },
      { prompt: 'Frame 2 must show that the hero’s ticket is torn. Which shot?', right: 'A close-up of the torn ticket', wrong: ['A wide shot of the whole station', 'An aerial view of the city', 'A shot of the sky'], why: 'Close-ups show the problem in detail.' },
      { prompt: 'Frame 3 must show how the hero feels on seeing the torn ticket. Which shot?', right: 'A reaction shot of the hero’s face and posture', wrong: ['A wide shot of the platform', 'A close-up of the train wheels', 'A map'], why: 'Reaction shots show feeling.' },
      { prompt: 'Why vary the camera between frames?', right: 'To show place, detail and feeling where each matters', wrong: ['To make each frame look different for its own sake', 'Because the same shot is not allowed', 'To hide the character'], why: 'Each shot type does a job.' },
    ],
    caption: [
      { prompt: 'Frame 4 shows the same garden, now full of flowers. Which caption adds what the drawing cannot show?', right: '“Three months later…”', wrong: ['“There are flowers in the garden.”', '“The garden is green.”', '“This is frame four.”'], why: 'A jump in time cannot be drawn; the flowers already can be seen.' },
      { prompt: 'A drawing clearly shows a girl laughing. Which caption is best?', right: 'None: the drawing already says it', wrong: ['“The girl is laughing.”', '“She has a happy face.”', '“Laughing girl, frame two.”'], why: 'Never repeat what the drawing shows.' },
      { prompt: 'How long should a storyboard caption be?', right: 'One short line, about four to eight words', wrong: ['A full paragraph', 'At least three sentences', 'Any length'], why: 'Captions support the picture; they never carry the story.' },
      { prompt: 'A frame shows a dog staring at a closed door. Which caption adds meaning?', right: '“Thunder again.”', wrong: ['“A dog looks at a door.”', '“The door is brown.”', '“Dog, door.”'], why: 'It names a sound the picture cannot show, and explains the stare.' },
    ],
    process: [
      ...orderItems([['Wash and peel the potatoes', 'Slice them into thin rounds', 'Fry them until golden', 'Season and pack'], ['Shear the sheep', 'Wash and comb the wool', 'Spin it into yarn', 'Knit the sweater'], ['Pick the tea leaves', 'Wither and roll them', 'Dry them', 'Pack the tea']], 'A process storyboard: from raw material to product. Which order is right?', 'Each frame shows a different action on the material.'),
    ],
    movement: pendulumItems(),
    emotion: [
      { prompt: 'A trekker goes from energetic to exhausted. Which frame shows exhaustion best?', right: 'Shoulders slumped, leaning on a stick, sun high and hot', wrong: ['Upright and smiling, light bag', 'Only the face drawn, frowning', 'Standing still with no change'], why: 'Posture and context carry the feeling; the face is secondary.' },
      { prompt: 'What should show a character’s changing feelings most?', right: 'Posture and the setting around them', wrong: ['Only the eyebrows', 'The colour of the shirt', 'A caption saying how they feel'], why: 'Posture and context first, expression second.' },
      { prompt: 'Order these frames of a runner’s race.', right: 'Eager at the start, straining uphill, stumbling tired, arms raised at the finish', wrong: ['Arms raised at the finish, eager at the start, stumbling tired, straining uphill', 'Stumbling tired, eager at the start, arms raised at the finish, straining uphill', 'Eager at the start, arms raised at the finish, straining uphill, stumbling tired'], why: 'The states change step by step, and the first and last frames contrast clearly.' },
      { prompt: 'Why should the first and last frames of an emotional journey look clearly different side by side?', right: 'That contrast is what shows the change', wrong: ['To fill the page', 'Because the character changes', 'It does not matter'], why: 'The change between states is what is graded.' },
    ],
    critique: [
      { prompt: 'Four frames show four unrelated scenes. What is the main fault?', right: 'No story link between frames', wrong: ['Too few colours', 'The frames are square', 'The character is drawn well'], why: 'Frames must connect into one story.' },
      { prompt: 'A process storyboard shows only raw potatoes and a packet of chips. What is wrong?', right: 'The steps in between are missing', wrong: ['There are too many frames', 'Chips are not a product', 'The arrows point forward'], why: 'A process needs the steps that change the material, not just before and after.' },
      { prompt: 'The hero has short hair in frame 1 and long hair in frame 3. What is the fault?', right: 'Inconsistent character design', wrong: ['Too much drawing', 'Wrong camera angle', 'Missing caption'], why: 'Keep the character identical across frames.' },
      { prompt: 'Each frame is mostly a paragraph of text under a small sketch. What is wrong?', right: 'Too much text, not enough drawing', wrong: ['The sketches are small but fine', 'Paragraphs are required', 'Nothing'], why: 'The pictures should tell the story; captions only support.' },
    ],
  },
});
