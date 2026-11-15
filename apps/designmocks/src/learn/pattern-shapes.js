// Outlines of the shapes used in visual patterns, as polygons in a unit box
// centred on 0 (y down). The drawing and the tests both use these, so two
// options that would look the same are caught as the same.
const circle = Array.from({ length: 24 }, (_, k) => [0.5 * Math.cos((k * Math.PI) / 12), 0.5 * Math.sin((k * Math.PI) / 12)]);
const regular = (n, r = 0.5, start = -Math.PI / 2) => Array.from({ length: n }, (_, k) => [r * Math.cos(start + (2 * Math.PI * k) / n), r * Math.sin(start + (2 * Math.PI * k) / n)]);
const star = Array.from({ length: 10 }, (_, k) => { const r = k % 2 ? 0.2 : 0.5, a = -Math.PI / 2 + (Math.PI * k) / 5; return [r * Math.cos(a), r * Math.sin(a)]; });
export const OUTLINES = {
  circle, square: [[-0.42, -0.42], [0.42, -0.42], [0.42, 0.42], [-0.42, 0.42]], triangle: regular(3, 0.5, -Math.PI / 2), diamond: regular(4, 0.5, -Math.PI / 2), star,
  plus: [[-0.15, -0.5], [0.15, -0.5], [0.15, -0.15], [0.5, -0.15], [0.5, 0.15], [0.15, 0.15], [0.15, 0.5], [-0.15, 0.5], [-0.15, 0.15], [-0.5, 0.15], [-0.5, -0.15], [-0.15, -0.15]],
  // Chiral shapes: none of them matches its mirror image under any turn.
  arrow: [[0, -0.5], [0.35, -0.1], [0.12, -0.1], [0.12, 0.5], [-0.12, 0.5], [-0.12, -0.25]],
  hook: [[-0.3, -0.5], [-0.05, -0.5], [-0.05, 0.25], [0.35, 0.25], [0.35, 0.5], [-0.3, 0.5]],
  flag: [[-0.3, -0.5], [0.4, -0.3], [-0.12, -0.1], [-0.12, 0.5], [-0.3, 0.5]],
};
// The polygon of an item placed in a panel of size 1: mirror (left–right), then turn, then scale and move.
export function placed(item) {
  // Clean up tiny errors left by repeated turns, so the same picture always gives the same points.
  const snap = v => Math.round(v * 1e6) / 1e6, x0 = snap(item.x), y0 = snap(item.y), rot = ((Math.round(item.rot) % 360) + 360) % 360;
  const a = (rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return OUTLINES[item.shape].map(([x, y]) => { const mx = item.mirror ? -x : x; return [x0 + item.size * (mx * c - y * s), y0 + item.size * (mx * s + y * c)]; });
}
// What a panel looks like: every item's outline as a set of rounded points with its fill, in any order.
export const looks = panel => panel.map(i => `${i.fill}:${placed(i).map(p => p.map(v => (Math.round(v * 200 + 1e-9) / 200).toFixed(3)).join(',')).sort().join(';')}`).sort().join('|');
