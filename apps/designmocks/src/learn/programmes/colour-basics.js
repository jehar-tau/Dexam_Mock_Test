// Colour, from the artists' wheel to exam-hard colour codes, proportions and
// value. Specification: docs/learn/topics/colour.md.
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });
const mixer = mode => ({ tool: 'colour-mixer', props: { mode } });

export const colourBasicsProgramme = Object.freeze({
  slug: 'colour-basics',
  title: 'Colour',
  summary: 'The wheel, light and ink, harmonies, value and contrast, then colour codes and paint proportions at exam pace.',
  topic: 'design-sensitivity',
  exams: ['uceed', 'ceed', 'nid', 'nift'],
  minutes: 110, status: 'preview',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'wheel', title: 'The wheel', minutes: 10, level: 1, summary: 'Primaries, secondaries and the tertiaries between them.', steps: [
        { id: 'primaries', kind: 'slide', title: 'Three colours no mixing makes', text: 'Red, yellow and blue are the painter’s primaries. Mix two of them in equal amounts and you get a secondary: orange, green or violet.', tool: 'colour-wheel', hint: 'Tap any colour on the wheel.' },
        { id: 'tertiaries', kind: 'slide', title: 'The colours in between', text: 'Between each primary and its neighbouring secondary sits a tertiary, named after both: red-orange, yellow-green, blue-violet and so on. Twelve steps round the wheel.' },
        check('check-1', 'mix', 141), check('check-2', 'mix', 142), check('check-3', 'mix', 143),
        { id: 'remember', kind: 'takeaway', body: 'Red, yellow, blue make orange, green, violet. Tertiaries sit between and carry both names.' }] },
      { id: 'light-ink', title: 'Light and ink', minutes: 10, level: 2, summary: 'Screens add light; printers take it away.', steps: [
        { id: 'add', kind: 'slide', title: 'Light adds', text: 'A screen mixes red, green and blue light. Each light you add makes the mix brighter: red and green make yellow, and all three make white.', ...mixer('light'), hint: 'Switch the lights on and off and watch the overlap.' },
        { id: 'subtract', kind: 'slide', title: 'Ink takes away', text: 'A printer uses cyan, magenta and yellow ink. Each ink absorbs one colour of light, so every ink you add makes it darker: cyan and yellow leave green, and all three make black.', ...mixer('ink'), hint: 'Try cyan with magenta, then add yellow.' },
        check('check-1', 'light-ink', 1, 2), check('check-2', 'light-ink', 2, 2), check('check-3', 'light-ink', 4, 2),
        { id: 'remember', kind: 'takeaway', body: 'Light: red, green, blue, all three make white. Ink: cyan, magenta, yellow, all three make black.' }] },
      { id: 'complements', title: 'Opposites and neighbours', minutes: 10, level: 2, summary: 'Complements sit across the wheel; analogous colours sit side by side.', steps: [
        { id: 'across', kind: 'slide', title: 'Straight across the wheel', text: 'A colour’s complement sits directly opposite it, six steps away. Side by side, complements make each other look stronger. Mixed, they dull each other towards grey.', tool: 'colour-wheel', props: { initial: 'orange' }, hint: 'Tap a colour and read its complement below the wheel.' },
        { id: 'beside', kind: 'slide', title: 'Next door', text: 'Analogous colours are neighbours on the wheel. They sit together quietly. A triad takes every fourth colour and feels lively.' },
        check('check-1', 'complement', 151), check('check-2', 'complement', 152),
        check('check-3', 'harmony-name', 1, 2), check('check-4', 'analogous-run', 1, 2),
        { id: 'remember', kind: 'takeaway', body: 'Complement: six steps across. Analogous: next door. Triad: every fourth colour.' }] },
      { id: 'value', title: 'Value and temperature', minutes: 10, level: 2, summary: 'How light a colour is, how pure it is, and whether it feels warm or cool.', steps: [
        { id: 'light', kind: 'slide', title: 'Value: light to dark', text: 'Value is how light or dark a colour is, separate from its hue. Add white for a tint, black for a shade. Saturation is how pure the colour is; grey it down and it becomes a tone.', tool: 'colour-wheel', props: { initial: 'blue' }, hint: 'Move the value and saturation sliders and watch the centre swatch.' },
        { id: 'warm', kind: 'slide', title: 'Warm and cool', text: 'Reds, oranges and yellows feel warm and come forward. Greens, blues and violets feel cool and sit back. Red-violet is on the warm edge; yellow-green on the cool edge.' },
        check('check-1', 'value', 161), check('check-2', 'tint-shade-tone', 1, 2), check('check-3', 'tint-shade-tone', 2, 2), check('check-4', 'warm-cool', 164),
        { id: 'remember', kind: 'takeaway', body: 'Tint adds white, shade adds black, tone adds grey. Reds through yellows are warm; greens through violets are cool.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 8, pass: 7, marking: 'plain', questions: [{ kind: 'mix', count: 1 }, { kind: 'light-ink', level: 2, count: 2 }, { kind: 'complement', count: 2 }, { kind: 'harmony-name', level: 2, count: 2 }, { kind: 'tint-shade-tone', level: 2, count: 2 }, { kind: 'warm-cool', count: 1 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'harmonies', title: 'Colour schemes', minutes: 12, level: 3, summary: 'Name a scheme from the gaps between its colours on the wheel.', steps: [
        hook('Four colours, or three. Which scheme is it?', 'harmony-name', 1, 3),
        { id: 'gaps', kind: 'slide', title: 'Count the gaps', text: ['Number the wheel 1 to 12 from red. Count the steps between the chosen colours going round.', 'Complementary 6 and 6. Analogous 1 and 1. Triadic 4, 4, 4. Split-complementary 5, 2, 5. Square 3, 3, 3, 3.'], tool: 'colour-wheel', props: { initial: 'green' }, hint: 'Pick a colour: the wheel shows its complement, neighbours and triad.' },
        worked('harmony-name', 2, 3),
        check('check-1', 'harmony-name', 3, 3), check('check-2', 'scheme-check', 1, 3), check('check-3', 'scheme-check', 2, 3),
        practice('harmony-name', 3), check('check-hook', 'harmony-name', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Gaps name the scheme: 6-6, 1-1, 4-4-4, 5-2-5, 3-3-3-3.' }] },
      { id: 'walks', title: 'Walks and analogies on the wheel', minutes: 10, level: 3, summary: 'Continue a walk round the wheel and match neighbours in the same order.', steps: [
        hook('The colours step round the wheel. One is missing.', 'analogous-run', 1, 3),
        { id: 'direction', kind: 'slide', title: 'Direction and step size', text: 'Find which way the walk goes, towards yellow or towards violet, and how many steps each move takes. Some walks skip a colour every time.' },
        worked('analogous-run', 2, 3),
        check('check-1', 'analogous-run', 3, 3), check('check-2', 'neighbour-analogy', 1, 3), check('check-3', 'neighbour-analogy', 2, 3),
        practice('neighbour-analogy', 3), check('check-hook', 'analogous-run', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Direction first, then the step size, then the order of the neighbours.' }] },
      { id: 'codes', title: 'Reading colour codes', minutes: 12, level: 3, summary: 'RGB values and greys written in hex.', steps: [
        hook('A screen colour is written as three numbers. Which colour is it?', 'code-read', 1, 3),
        { id: 'channels', kind: 'slide', title: 'Three channels of light', text: ['Each channel runs from 0 (off) to 255 (full). Full red and full green make yellow; full red with half green makes orange.', 'Equal channels always make a grey: the higher the number, the lighter.'], ...mixer('light'), hint: 'Turn lights on and off to see each pair.' },
        worked('code-read', 2, 3),
        check('check-1', 'code-read', 3, 3), check('check-2', 'hex-grey', 1, 3), check('check-3', 'hex-grey', 2, 3),
        practice('code-read', 3), check('check-hook', 'code-read', 1, 3),
        { id: 'remember', kind: 'takeaway', body: '0 off, about 128 half, 255 full. Equal channels: a grey, and the number ÷ 255 is the share of white.' }] },
      { id: 'filters', title: 'Filters and contrast', minutes: 12, level: 3, summary: 'What a colour filter does on black and white film, and which text stands out.', steps: [
        hook('Black and white film, a coloured filter. Which object prints darkest?', 'filter-photo', 1, 3),
        { id: 'filter', kind: 'slide', title: 'A filter passes its own colour', text: ['A red filter lets red light through, so red objects print light on black and white film. It blocks its complement, so green objects print dark.', 'Sheets laid over each other, and objects under coloured light, work the same way: only the light every one of them passes reaches the eye.'] },
        worked('filter-photo', 2, 3),
        check('check-1', 'filter-photo', 3, 3), check('check-1b', 'filter-light', 1, 3), check('check-1c', 'filter-light', 2, 3),
        { id: 'contrast', kind: 'slide', title: 'Legibility is about value', text: 'Text is easy to read when it differs from its background in lightness, not just in hue. Yellow on white or red on green look different but blur at a distance.', ...mixer('grey'), hint: 'Pick a hue and lightness: the status gives its contrast with white and black text.' },
        check('check-2', 'contrast-pick', 1, 3), check('check-3', 'contrast-pick', 2, 3),
        practice('filter-photo', 3), check('check-hook', 'filter-photo', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Filters lighten their own colour and darken its complement. Legibility follows value contrast.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 16, pass: 7, marking: 'plain', questions: [{ kind: 'harmony-name', level: 3, count: 2 }, { kind: 'scheme-check', level: 3, count: 1 }, { kind: 'neighbour-analogy', level: 3, count: 1 }, { kind: 'analogous-run', level: 3, count: 1 }, { kind: 'code-read', level: 3, count: 1 }, { kind: 'hex-grey', level: 3, count: 1 }, { kind: 'filter-photo', level: 3, count: 1 }, { kind: 'filter-light', level: 3, count: 1 }, { kind: 'contrast-pick', level: 3, count: 1 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'print', title: 'Hex and CMYK', minutes: 14, level: 4, summary: 'Hex codes of any colour, and print colours converted to screen.', steps: [
        hook('A hex code close to its neighbours. Which colour is it?', 'code-read', 1, 4),
        { id: 'hex', kind: 'slide', title: 'Hex pairs', text: 'A hex code is three pairs: red, green, blue. FF is 255, 80 is 128, 40 is 64, 00 is 0. Read each pair, then name the light mix.' },
        worked('code-read', 2, 4),
        check('check-1', 'code-read', 3, 4),
        { id: 'cmyk', kind: 'slide', title: 'From print to screen', text: ['Cyan ink absorbs red light, magenta absorbs green, yellow absorbs blue, and black absorbs all three.', 'So R = 255 × (1 − C) × (1 − K), G = 255 × (1 − M) × (1 − K), B = 255 × (1 − Y) × (1 − K).'] },
        check('check-2', 'cmyk-channel', 1, 4), check('check-3', 'cmyk-channel', 2, 4),
        practice('cmyk-channel', 4), check('check-hook', 'code-read', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Hex: three pairs, FF full. CMYK: what is left after each ink, times what is left after black.' }] },
      { id: 'proportions', title: 'Paint in proportion', minutes: 12, level: 4, summary: 'Pour mixed pots together and work out the share of each colour.', steps: [
        hook('Three pots, each mixed differently, poured together.', 'paint-share', 1, 4),
        { id: 'average', kind: 'slide', title: 'Average the shares', text: 'When the pots hold equal amounts, find the share of the colour in each pot, then average those shares. Adding up parts across pots only works when every pot has the same number of parts.' },
        worked('paint-share', 2, 4),
        check('check-1', 'paint-share', 3, 4), check('check-2', 'paint-share', 4, 4), check('check-3', 'paint-share', 5, 4),
        practice('paint-share', 4), check('check-hook', 'paint-share', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Share in each pot first; equal pots means average them.' }] },
      { id: 'value-across', title: 'Value across hues', minutes: 12, level: 4, summary: 'Match lightness between different hues, judge close contrasts, and follow light through an object and a lens.', steps: [
        hook('Different hues. Which prints the same grey?', 'same-value', 1, 4),
        { id: 'squint', kind: 'slide', title: 'Squint at it', text: 'Yellow is naturally light and violet naturally dark. A dark yellow can match a light blue in black and white. Judge lightness alone and ignore the hue.', ...mixer('grey'), hint: 'Pick yellow, then blue, and find the lightness where they print the same grey.' },
        worked('same-value', 2, 4),
        check('check-1', 'same-value', 3, 4), check('check-2', 'contrast-pick', 1, 4), check('check-3', 'contrast-pick', 2, 4), check('check-4', 'filter-light', 1, 4),
        practice('same-value', 4), check('check-hook', 'same-value', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Value is separate from hue. Squint, or picture the photograph in black and white.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 18, pass: 6, marking: 'plain', questions: [{ kind: 'code-read', level: 4, count: 2 }, { kind: 'cmyk-channel', level: 4, count: 2 }, { kind: 'paint-share', level: 4, count: 2 }, { kind: 'same-value', level: 4, count: 1 }, { kind: 'contrast-pick', level: 4, count: 1 }, { kind: 'filter-light', level: 4, count: 1 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 8, level: 5, summary: 'The rules once more, then mixed practice before the timed set.', steps: [
        { id: 'rules', kind: 'slide', title: 'Colour in one screen', text: ['Light adds to white; ink subtracts to black. Schemes are named by their gaps on the wheel.', 'Codes: 0 off, 255 full; CMYK is what each ink leaves. Pots: average the shares. Value and legibility: judge lightness, not hue.'] },
        { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'About a minute a question. Typed answers lose nothing when wrong; always enter one.' },
        { id: 'practice-1', kind: 'practice', question: { kind: 'harmony-name', level: 3 }, streak: 2 },
        { id: 'practice-2', kind: 'practice', question: { kind: 'paint-share', level: 4 }, streak: 2 },
        { id: 'remember', kind: 'takeaway', body: 'Gaps, channels, shares and value: four habits that answer most colour questions.' }] },
    ], quiz: { title: 'Timed exam set', minutes: 18, pass: 9, marking: 'uceed', description: 'Twelve colour questions at exam pace, marked like UCEED.', questions: [{ kind: 'harmony-name', level: 3, count: 2 }, { kind: 'scheme-check', level: 3, count: 1 }, { kind: 'filter-photo', level: 3, count: 1 }, { kind: 'neighbour-analogy', level: 3, count: 1 }, { kind: 'code-read', level: 4, count: 2 }, { kind: 'cmyk-channel', level: 4, count: 1 }, { kind: 'paint-share', level: 4, count: 2 }, { kind: 'same-value', level: 4, count: 1 }, { kind: 'contrast-pick', level: 4, count: 1 }] } },
  ],
});
