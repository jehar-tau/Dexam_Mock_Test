import React from 'react';
import { project } from './cube-net.js';

// Dice drawn as the cube-net figures are: viewer at (+x, +y, +z), so the
// front (south) face is +x on the lower left and the right (east) face is +y
// on the lower right.
const S = 34;
const at = v => project(v).map(c => c * S);
const poly = pts => pts.map(p => at(p).map(c => c.toFixed(1)).join(',')).join(' ');
const centre = pts => at(pts.reduce((a, p) => a.map((v, i) => v + p[i] / pts.length), [0, 0, 0]));
function Cube({ x = 0, y = 0, z = 0, top, front, right }) {
  const faces = [
    { tone: 'top', pts: [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], n: top },
    { tone: 'left', pts: [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]], n: front },
    { tone: 'right', pts: [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], n: right },
  ];
  return <g className="die-cube">{faces.map(f => <g key={f.tone}><polygon className={`die-face ${f.tone}`} points={poly(f.pts)} />{f.n !== null && f.n !== undefined && (() => { const [cx, cy] = centre(f.pts); return <text className="die-number" x={cx} y={cy + 6}>{f.n}</text>; })()}</g>)}</g>;
}
function frame(cubes) {
  const pts = cubes.flatMap(({ x = 0, y = 0, z = 0 }) => [[x, y, z], [x + 1, y, z], [x, y + 1, z], [x + 1, y + 1, z], [x, y, z + 1], [x + 1, y, z + 1], [x, y + 1, z + 1], [x + 1, y + 1, z + 1]]).map(at);
  const minX = Math.min(...pts.map(p => p[0])) - 3, maxX = Math.max(...pts.map(p => p[0])) + 3, minY = Math.min(...pts.map(p => p[1])) - 3, maxY = Math.max(...pts.map(p => p[1])) + 3;
  return { viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`, width: maxX - minX, height: maxY - minY };
}
export function DieFigure({ top, front, right, compact = false }) {
  const f = frame([{}]);
  return <svg className={`die-figure${compact ? ' compact' : ''}`} {...f} role="img" aria-label={`A die showing ${top} on top, ${front} at the front and ${right} on the right`}><Cube top={top} front={front} right={right} /></svg>;
}
// dice[0] is the top die; only it shows its top face.
export function DieStack({ dice }) {
  const cubes = dice.map((d, i) => ({ ...d, z: dice.length - 1 - i })), f = frame(cubes);
  return <svg className="die-figure" {...f} role="img" aria-label={`A stack of ${dice.length} dice. From the top: ${dice.map(d => `front ${d.front}, right ${d.right}`).join('; ')}. The top die shows ${dice[0].top} on top.`}>
    {[...cubes].reverse().map((c, i) => <Cube key={i} {...c} />)}
  </svg>;
}
// Dice in a row, left to right, each showing its top and its front.
export function DieRow({ dice }) {
  const cubes = dice.map((d, i) => ({ top: d.top, front: d.front, right: null, y: i })), f = frame(cubes);
  return <svg className="die-figure" {...f} role="img" aria-label={`${dice.length} dice in a row, touching. Left to right: ${dice.map(d => `top ${d.top}, front ${d.front}`).join('; ')}.`}>
    {cubes.map((c, i) => <Cube key={i} {...c} />)}
  </svg>;
}
// A path of rolls on a square grid: north is up the page, east to the right.
export function DiePath({ path }) {
  const step = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
  const pts = [[0, 0]]; for (const d of path) { const [x, y] = pts[pts.length - 1]; pts.push([x + step[d][0], y + step[d][1]]); }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), minX = Math.min(...xs) - 1, maxX = Math.max(...xs) + 1, minY = Math.min(...ys) - 1, maxY = Math.max(...ys) + 1, c = 30;
  const px = ([x, y]) => [(x - minX + 0.5) * c, (y - minY + 0.5) * c];
  return <svg className="die-path" viewBox={`0 0 ${(maxX - minX + 1) * c} ${(maxY - minY + 1) * c + 16}`} width={(maxX - minX + 1) * c} height={(maxY - minY + 1) * c + 16} role="img" aria-label={`The die rolls ${path.join(', then ')}`}>
    <defs><marker id="die-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" /></marker></defs>
    {Array.from({ length: (maxX - minX + 1) * (maxY - minY + 1) }, (_, i) => { const gx = i % (maxX - minX + 1), gy = Math.floor(i / (maxX - minX + 1)); return <rect key={i} className="die-path-cell" x={gx * c} y={gy * c} width={c} height={c} />; })}
    <rect className="die-path-start" x={px(pts[0])[0] - c * 0.32} y={px(pts[0])[1] - c * 0.32} width={c * 0.64} height={c * 0.64} rx="3" />
    {pts.slice(1).map((p, i) => { const a = px(pts[i]), b = px(p); return <line key={i} className="die-path-step" x1={a[0]} y1={a[1]} x2={a[0] + (b[0] - a[0]) * 0.82} y2={a[1] + (b[1] - a[1]) * 0.82} markerEnd="url(#die-arrow)" />; })}
    <text className="die-path-compass" x="4" y={(maxY - minY + 1) * c + 13}>N ↑</text>
  </svg>;
}
