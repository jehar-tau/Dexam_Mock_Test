// Colour basics on the traditional artists' wheel.
export const colourBasicsProgramme = Object.freeze({
  slug: 'colour-basics',
  title: 'Colour basics',
  summary: 'Primaries, secondaries, complements, value and temperature on the artists’ wheel.',
  topic: 'design-sensitivity',
  exams: ['uceed', 'ceed', 'nid', 'nift'],
  minutes: 30,
  lessons: [
    {
      id: 'wheel', title: 'The wheel', minutes: 10,
      summary: 'Primaries, secondaries and the tertiaries between them.',
      steps: [
        { id: 'primaries', kind: 'slide', title: 'Three colours no mixing makes', text: 'Red, yellow and blue are the primaries. Mix two of them in equal amounts and you get a secondary: orange, green or violet.', tool: 'colour-wheel', hint: 'Tap any colour on the wheel.' },
        { id: 'tertiaries', kind: 'slide', title: 'The colours in between', text: 'Between each primary and its neighbouring secondary sits a tertiary, named after both: red-orange, yellow-green, blue-violet and so on. Twelve steps round the wheel.' },
        { id: 'check-1', kind: 'check', question: { kind: 'mix', seed: 141 } },
        { id: 'check-2', kind: 'check', question: { kind: 'mix', seed: 142 } },
        { id: 'check-3', kind: 'check', question: { kind: 'mix', seed: 143 } },
        { id: 'remember', kind: 'takeaway', body: 'Red, yellow, blue make orange, green, violet. Tertiaries sit between and carry both names.' },
      ],
    },
    {
      id: 'complements', title: 'Opposites and neighbours', minutes: 10,
      summary: 'Complementary colours sit across the wheel; analogous colours sit beside each other.',
      steps: [
        { id: 'across', kind: 'slide', title: 'Straight across the wheel', text: 'A colour’s complement sits directly opposite it, six steps away. Side by side, complements make each other look stronger. Mixed, they dull each other towards grey.', tool: 'colour-wheel', props: { initial: 'orange' }, hint: 'Tap a colour and read its complement below the wheel.' },
        { id: 'beside', kind: 'slide', title: 'Next door', text: 'Analogous colours are neighbours on the wheel. They sit together quietly. A triad takes every fourth colour and feels lively.' },
        { id: 'check-1', kind: 'check', question: { kind: 'complement', seed: 151 } },
        { id: 'check-2', kind: 'check', question: { kind: 'complement', seed: 152 } },
        { id: 'check-3', kind: 'check', question: { kind: 'complement', seed: 153 } },
        { id: 'check-4', kind: 'check', question: { kind: 'complement', seed: 154 } },
        { id: 'remember', kind: 'takeaway', body: 'Complement: six steps across. Analogous: next door. Triad: every fourth colour.' },
      ],
    },
    {
      id: 'value', title: 'Value and temperature', minutes: 10,
      summary: 'How light a colour is, how pure it is, and whether it feels warm or cool.',
      steps: [
        { id: 'light', kind: 'slide', title: 'Value: light to dark', text: 'Value is how light or dark a colour is, separate from its hue. Add white for a tint, black for a shade. Saturation is how pure the colour is; grey it down and it becomes a tone.', tool: 'colour-wheel', props: { initial: 'blue' }, hint: 'Move the value and saturation sliders and watch the centre swatch.' },
        { id: 'warm', kind: 'slide', title: 'Warm and cool', text: 'Reds, oranges and yellows feel warm and come forward. Greens, blues and violets feel cool and sit back. Red-violet is on the warm edge; yellow-green on the cool edge.' },
        { id: 'check-1', kind: 'check', question: { kind: 'value', seed: 161 } },
        { id: 'check-2', kind: 'check', question: { kind: 'value', seed: 162 } },
        { id: 'check-3', kind: 'check', question: { kind: 'warm-cool', seed: 163 } },
        { id: 'check-4', kind: 'check', question: { kind: 'warm-cool', seed: 164 } },
        { id: 'remember', kind: 'takeaway', body: 'Value is light to dark, saturation is pure to grey, and reds through yellows are warm while greens through violets are cool.' },
      ],
    },
  ],
  challenge: {
    title: 'Colour challenge', minutes: 6,
    description: 'Ten quick colour questions.',
    questions: [{ kind: 'mix', count: 2 }, { kind: 'complement', count: 3 }, { kind: 'value', count: 2 }, { kind: 'warm-cool', count: 3 }],
  },
});
