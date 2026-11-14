// Mirror and water images. Figures are 5-by-5 cell patterns or short strings.
import { pick, seededRandom, shuffle } from './random.js';

export const SIZE = 5;
const key = cells => [...cells].sort().join('|');
const parse = k => k.split(',').map(Number);
export const transforms = Object.freeze({
  same: ([x, y]) => [x, y],
  mirror: ([x, y]) => [SIZE - 1 - x, y],
  water: ([x, y]) => [x, SIZE - 1 - y],
  turned: ([x, y]) => [SIZE - 1 - x, SIZE - 1 - y],
  quarter: ([x, y]) => [SIZE - 1 - y, x],
  transposed: ([x, y]) => [y, x],
});
export const applyTransform = (cells, name) => cells.map(c => transforms[name](parse(c)).join(','));

export function isAsymmetric(cells) {
  const base = key(cells);
  return Object.keys(transforms).filter(name => name !== 'same').every(name => key(applyTransform(cells, name)) !== base);
}

export function randomPattern(rng) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const cells = new Set(['2,2']);
    const target = 8 + Math.floor(rng() * 4);
    while (cells.size < target) {
      const [x, y] = parse(pick(rng, [...cells]));
      const [dx, dy] = pick(rng, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
      cells.add(`${nx},${ny}`);
    }
    const list = [...cells];
    if (isAsymmetric(list)) return list;
  }
  return ['0,0', '1,0', '2,0', '0,1', '0,2', '1,2', '2,3', '3,4'];
}

export const words = Object.freeze(['FLAG', 'ROAD', 'PAGE', 'JUNE', 'BIRD', 'LAMP', 'GREY', 'DUSK', 'KNOB', 'FERN', 'QUIZ', 'LEAF']);

export function imageQuestion(seed, kind) {
  const rng = seededRandom(seed);
  const useWord = rng() < 0.4;
  const figure = useWord ? { type: 'word', word: pick(rng, words) } : { type: 'pattern', cells: randomPattern(rng) };
  const wanted = kind === 'mirror-image' ? 'mirror' : 'water';
  const reasons = {
    same: 'This is the original, unchanged. A reflection always flips the figure.',
    mirror: 'This is the mirror image (flipped left to right). A water image flips top to bottom.',
    water: 'This is the water image (flipped top to bottom). A mirror beside the figure flips it left to right.',
    turned: 'This figure is turned by a half turn, not reflected. A reflection swaps left and right or top and bottom, never both.',
    quarter: 'This figure is turned by a quarter turn. Reflections never turn a figure.',
    transposed: 'This figure is flipped across a diagonal. Mirrors and water lines are vertical or horizontal here.',
  };
  const names = shuffle(rng, ['same', 'mirror', 'water', 'turned', 'quarter', 'transposed'].filter(n => n !== wanted)).slice(0, 3);
  const options = shuffle(rng, [wanted, ...names]).map((name, i) => ({ id: name, label: 'ABCD'[i], transform: name, correct: name === wanted, reason: reasons[name] }));
  return {
    kind, seed, figure,
    prompt: kind === 'mirror-image' ? 'A mirror stands to the right of the figure. Which option shows its reflection?' : 'The figure stands above a still pool. Which option shows its reflection in the water?',
    options, answer: wanted,
    explanation: wanted === 'mirror'
      ? 'A mirror beside the figure swaps left and right. Whatever is nearest the mirror stays nearest it, and up stays up.'
      : 'A water image swaps top and bottom. Whatever touches the water line stays at the water line, and left stays left.',
  };
}
