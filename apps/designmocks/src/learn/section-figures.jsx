// Figures and the section-slicer tool for sections of solids.
import { useState } from 'react';
import { CUBE_EDGES, classify, cubeSection } from './sections.js';

const INK = 'var(--ink, #1d1d1b)';
// Oblique view of the [0,2] cube: x right, y back (up and to the right), z up.
const proj = ([x, y, z], s = 52) => [20 + (x + y * 0.55) * s, 20 + (2 - z + (2 - y) * 0.35) * s * 0.92];
const CORNERS = [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0], [0, 0, 2], [2, 0, 2], [2, 2, 2], [0, 2, 2]];
const HIDDEN = 3; // the back-bottom-left corner (0, 2, 0) is out of sight

function CubeFrame({ s, children, label }) {
  const w = proj([2, 2, 0], s)[0] + 24, h = proj([0, 0, 0], s)[1] + 24;
  return <svg className="section-figure" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={label}>
    {CUBE_EDGES.map(([a, b]) => { const [p, q] = [proj(CORNERS[a], s), proj(CORNERS[b], s)]; return <line key={`${a}-${b}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={INK} strokeWidth="1.4" strokeDasharray={a === HIDDEN || b === HIDDEN ? '4 3' : undefined} opacity={a === HIDDEN || b === HIDDEN ? 0.55 : 1} />; })}
    {children}
  </svg>;
}
const where = ([x, y, z]) => `${['left', 'middle', 'right'][x]}, ${['front', 'middle', 'back'][y]}, ${['bottom', 'middle', 'top'][z]}`;
export function CubeCut({ points = [], polygon = null, compact = false }) {
  const s = compact ? 40 : 52;
  return <CubeFrame s={s} label={`Cube with marked points ${points.map(pt => `${pt.label} at ${where(pt.p)}`).join('; ')}`}>
    {polygon && <polygon points={polygon.map(p => proj(p, s).join(',')).join(' ')} fill="rgba(226,80,43,.35)" stroke="var(--orange, #e2502b)" strokeWidth="1.6" />}
    {points.map(({ p, label }) => { const [x, y] = proj(p, s); return <g key={label}><circle cx={x} cy={y} r="4.5" fill="var(--orange, #e2502b)" stroke="#fff" strokeWidth="1.2" /><text x={x + 7} y={y - 6} fontSize="13" fontWeight="700" fill={INK}>{label}</text></g>; })}
  </CubeFrame>;
}

export function Revolve({ shape }) {
  const s = 30, maxX = Math.max(...shape.map(p => p[0])), maxY = Math.max(...shape.map(p => p[1]));
  const ax = 30, w = ax + (maxX + 1) * s, h = (maxY + 1) * s + 10, P = ([x, y]) => [ax + x * s, h - 10 - y * s];
  return <svg className="section-figure" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="A flat shape beside a dashed upright axis it will spin round">
    <line x1={ax} y1={4} x2={ax} y2={h - 2} stroke={INK} strokeWidth="1.4" strokeDasharray="7 4" />
    <path d={`M${ax - 10},${10} a10,5 0 1,0 20,0`} fill="none" stroke={INK} strokeWidth="1.2" />
    <polygon points={shape.map(p => P(p).join(',')).join(' ')} fill="var(--lime, #b9d87a)" stroke={INK} strokeWidth="1.6" />
  </svg>;
}

// Tool: a cut perpendicular to a chosen direction, slid through the cube.
const NORMALS = { 'Corner to corner': [1, 1, 1], 'Edge to edge': [1, 1, 0], 'Face to face': [0, 0, 1], Tilted: [1, 2, 0] };
export function SectionSlicer({ normal: initial = 'Corner to corner' }) {
  const [which, setWhich] = useState(initial);
  const [t, setT] = useState(50);
  const n = NORMALS[which], max = 2 * (n[0] + n[1] + n[2]), d = (max * t) / 100;
  // three points on the plane n·p = d, found along axis directions
  const base = n.map(v => (v ? d / (n[0] + n[1] + n[2]) : 1));
  const u = n[2] ? [n[2], 0, -n[0]] : [-n[1], n[0], 0], w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const poly = cubeSection([base, base.map((v, i) => v + u[i]), base.map((v, i) => v + w[i])]);
  const name = poly && poly.length >= 3 ? classify(poly) : null;
  return <div className="tool">
    <div className="icon-cluster" role="group" aria-label="Cut direction">{Object.keys(NORMALS).map(k => <button key={k} type="button" className={`chip${which === k ? ' is-active' : ''}`} aria-pressed={which === k} onClick={() => setWhich(k)}>{k}</button>)}</div>
    <div className="tool-stage"><CubeCut polygon={poly && poly.length >= 3 ? poly : null} /></div>
    <label className="slider"><span>Slide the cut</span><input type="range" min="2" max="98" value={t} onChange={e => setT(Number(e.target.value))} aria-label="Position of the cut through the cube" /></label>
    <p className="tool-status" role="status">{name ? `The cut face is a ${name.toLowerCase()} with ${poly.length} sides.` : 'The cut misses the cube.'}</p>
  </div>;
}
