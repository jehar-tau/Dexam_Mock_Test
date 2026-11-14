// Colour basics on the traditional twelve-step artists' wheel (red, yellow,
// blue primaries) plus value and saturation.
import { pick, seededRandom, shuffle } from './random.js';

export const wheel = Object.freeze([
  { id: 'red', name: 'red', hex: '#d7263d', role: 'primary' },
  { id: 'red-orange', name: 'red-orange', hex: '#e2502b', role: 'tertiary' },
  { id: 'orange', name: 'orange', hex: '#f08a24', role: 'secondary' },
  { id: 'yellow-orange', name: 'yellow-orange', hex: '#f6b426', role: 'tertiary' },
  { id: 'yellow', name: 'yellow', hex: '#f4d93c', role: 'primary' },
  { id: 'yellow-green', name: 'yellow-green', hex: '#a9cf3a', role: 'tertiary' },
  { id: 'green', name: 'green', hex: '#3fa652', role: 'secondary' },
  { id: 'blue-green', name: 'blue-green', hex: '#1f9a8a', role: 'tertiary' },
  { id: 'blue', name: 'blue', hex: '#2456c4', role: 'primary' },
  { id: 'blue-violet', name: 'blue-violet', hex: '#5a3fb3', role: 'tertiary' },
  { id: 'violet', name: 'violet', hex: '#8a3a9c', role: 'secondary' },
  { id: 'red-violet', name: 'red-violet', hex: '#b92f78', role: 'tertiary' },
]);
export const hueIndex = id => wheel.findIndex(h => h.id === id);
export const complement = id => wheel[(hueIndex(id) + 6) % 12];
export const analogous = id => [wheel[(hueIndex(id) + 11) % 12], wheel[(hueIndex(id) + 1) % 12]];
export const triad = id => [wheel[(hueIndex(id) + 4) % 12], wheel[(hueIndex(id) + 8) % 12]];
export const isWarm = id => hueIndex(id) <= 4 || id === 'red-violet';
export const mixes = Object.freeze({ 'red+yellow': 'orange', 'yellow+blue': 'green', 'red+blue': 'violet' });
export function mixOf(a, b) { return mixes[`${a}+${b}`] ?? mixes[`${b}+${a}`] ?? null; }

// value and saturation adjustments in HSL for swatch rendering
export function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
export const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
export function swatch(id, { value = null, saturation = null } = {}) {
  const base = hexToHsl(wheel[hueIndex(id)].hex);
  return hsl(base.h, saturation ?? base.s, value ?? base.l);
}

const option = (hue, i, extra = {}) => ({ id: hue.id, label: 'ABCD'[i], colour: hue.hex, name: hue.name, ...extra });

export function colourQuestion(seed, kind) {
  const rng = seededRandom(seed);
  const hue = pick(rng, wheel);
  if (kind === 'complement') {
    const right = complement(hue.id);
    const wrong = shuffle(rng, wheel.filter(h => h.id !== hue.id && h.id !== right.id)).slice(0, 3);
    const options = shuffle(rng, [right, ...wrong]).map((h, i) => option(h, i, { correct: h.id === right.id, reason: h.id === right.id ? `${h.name} sits directly across the wheel from ${hue.name}.` : `${h.name} is ${Math.min(Math.abs(hueIndex(h.id) - hueIndex(hue.id)), 12 - Math.abs(hueIndex(h.id) - hueIndex(hue.id)))} steps from ${hue.name}, not the full six.` }));
    return { kind, seed, prompt: `Which colour is the complement of ${hue.name}?`, swatches: [{ colour: hue.hex, name: hue.name }], options, answer: right.id, explanation: `Complements sit opposite each other on the wheel: ${hue.name} and ${right.name}. Side by side they make each other look stronger; mixed, they dull each other to grey.` };
  }
  if (kind === 'mix') {
    const pair = pick(rng, Object.keys(mixes));
    const [a, b] = pair.split('+');
    const right = wheel[hueIndex(mixes[pair])];
    const wrong = shuffle(rng, wheel.filter(h => h.role !== 'tertiary' && h.id !== right.id && h.id !== a && h.id !== b)).slice(0, 3);
    const options = shuffle(rng, [right, ...wrong]).map((h, i) => option(h, i, { correct: h.id === right.id, reason: h.id === right.id ? `${a} and ${b} are primaries; mixed in equal amounts they make ${right.name}.` : `${h.name} is not made from ${a} and ${b}.` }));
    return { kind, seed, prompt: `Mixing equal amounts of ${a} and ${b} paint gives which colour?`, swatches: [{ colour: wheel[hueIndex(a)].hex, name: a }, { colour: wheel[hueIndex(b)].hex, name: b }], options, answer: right.id, explanation: `Two primaries mixed give a secondary: ${a} + ${b} = ${right.name}.` };
  }
  if (kind === 'warm-cool') {
    const warm = wheel.filter(h => isWarm(h.id)), cool = wheel.filter(h => !isWarm(h.id));
    const askWarm = rng() < 0.5;
    const right = pick(rng, askWarm ? warm : cool);
    const wrong = shuffle(rng, askWarm ? cool : warm).slice(0, 3);
    const options = shuffle(rng, [right, ...wrong]).map((h, i) => option(h, i, { correct: h.id === right.id, reason: `${h.name} is a ${isWarm(h.id) ? 'warm' : 'cool'} colour.` }));
    return { kind, seed, prompt: `Which of these is a ${askWarm ? 'warm' : 'cool'} colour?`, swatches: [], options, answer: right.id, explanation: askWarm ? 'Warm colours run from red through orange to yellow, with red-violet on the edge. They feel close and energetic.' : 'Cool colours run from yellow-green through blue to violet. They feel distant and calm.' };
  }
  // value: which swatch is lightest (highest value) or darkest
  const askLight = rng() < 0.5;
  const base = hexToHsl(hue.hex);
  const levels = shuffle(rng, [0.25, 0.4, 0.55, 0.7]);
  const options = levels.map((l, i) => ({ id: `l${Math.round(l * 100)}`, label: 'ABCD'[i], colour: hsl(base.h, base.s, l), level: l, correct: l === (askLight ? Math.max(...levels) : Math.min(...levels)), reason: `Value ${Math.round(l * 100)}%: ${l === Math.max(...levels) ? 'the lightest here' : l === Math.min(...levels) ? 'the darkest here' : 'in between'}.` }));
  const right = options.find(o => o.correct);
  return { kind: 'value', seed, prompt: `All four swatches are ${hue.name}. Which one has the ${askLight ? 'highest value, the lightest' : 'lowest value, the darkest'}?`, swatches: [], options, answer: right.id, explanation: `Value is how light or dark a colour is, separate from its hue. Adding white raises value (a tint); adding black lowers it (a shade).` };
}
