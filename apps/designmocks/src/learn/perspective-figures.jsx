// Figures and the perspective-box tool.
import { useState } from 'react';
import { boxCorners, camera, drawBox } from './perspective.js';

const INK = 'var(--ink, #1d1d1b)';
const HZ = 'var(--orange, #e2502b)';
function frameOf(pts, pad = 0.6) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad };
}
export function Persp({ lines = [], horizon = 0, points = [], compact = false }) {
  const all = [...lines.flat(), ...points.map(p => p.at), [0, horizon]], b = frameOf(all), s = Math.min((compact ? 160 : 300) / (b.x1 - b.x0), (compact ? 130 : 220) / (b.y1 - b.y0), 60);
  const P = ([x, y]) => [(x - b.x0) * s, (b.y1 - y) * s], w = (b.x1 - b.x0) * s, h = (b.y1 - b.y0) * s;
  return <svg className="persp-figure" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={`A box drawn in perspective with the horizon line${points.length ? ` and ${points.length} labelled points` : ''}`}>
    <line x1="0" y1={P([0, horizon])[1]} x2={w} y2={P([0, horizon])[1]} stroke={HZ} strokeWidth="1.4" strokeDasharray="6 4" />
    <text x={w - 4} y={P([0, horizon])[1] + 12} textAnchor="end" fontSize="10" fill={HZ}>horizon</text>
    {lines.map(([a, c], i) => { const [p, q] = [P(a), P(c)]; return <line key={i} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={INK} strokeWidth="1.6" />; })}
    {points.map(({ at, label }) => { const [x, y] = P(at); return <g key={label}><circle cx={x} cy={y} r="4" fill={INK} /><text x={x + 6} y={y - 6} fontSize="12" fontWeight="700" fill={INK}>{label}</text></g>; })}
  </svg>;
}
export function PerspPeople({ people = [], horizon = 0 }) {
  const all = people.flatMap(p => [p.foot, p.head]).concat([[0, horizon]]), b = frameOf(all, 0.4), s = Math.min(300 / (b.x1 - b.x0), 220 / (b.y1 - b.y0));
  const P = ([x, y]) => [(x - b.x0) * s, (b.y1 - y) * s], w = (b.x1 - b.x0) * s, h = (b.y1 - b.y0) * s;
  return <svg className="persp-figure" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={`${people.length} people of the same height at different distances, and the horizon line`}>
    <line x1="0" y1={P([0, horizon])[1]} x2={w} y2={P([0, horizon])[1]} stroke={HZ} strokeWidth="1.4" strokeDasharray="6 4" />
    {people.map((p, i) => { const [fx, fy] = P(p.foot), [, hy] = P(p.head), tall = fy - hy, wd = tall * 0.28; return <g key={i}><circle cx={fx} cy={hy + tall * 0.09} r={tall * 0.09} fill="#5c6b7a" /><rect x={fx - wd / 2} y={hy + tall * 0.18} width={wd} height={tall * 0.82} rx={wd * 0.3} fill="#5c6b7a" /></g>; })}
  </svg>;
}
const GLYPH = { tower: 'tall cylinder', block: 'cube', cone: 'cone' };
export function PlanView({ objects = [], camera: cam = [0, -8] }) {
  const s = 14, P = ([x, y]) => [(x + 9) * s, (9 - y) * s], w = 18 * s;
  return <svg className="persp-figure" viewBox={`0 0 ${w} ${w}`} width={w} height={w} role="img" aria-label={`Plan from above, north at the top: ${objects.map(o => GLYPH[o.type]).join(', ')}, with a camera at the edge`}>
    <rect x={s} y={s} width={w - 2 * s} height={w - 2 * s} fill="none" stroke="var(--line, #ccc)" />
    <text x={w / 2} y={s - 3} textAnchor="middle" fontSize="10" fill={INK}>N</text>
    {objects.map((o, i) => { const [x, y] = P(o.at); return o.type === 'tower' ? <circle key={i} cx={x} cy={y} r={s * 0.7} fill="#9ec5e8" stroke={INK} /> : o.type === 'block' ? <rect key={i} x={x - s * 0.9} y={y - s * 0.9} width={s * 1.8} height={s * 1.8} fill="#f2c38b" stroke={INK} /> : <g key={i}><circle cx={x} cy={y} r={s * 0.9} fill="#b9d87a" stroke={INK} /><circle cx={x} cy={y} r="2" fill={INK} /></g>; })}
    {(() => { const [x, y] = P(cam), a = Math.atan2(-(cam[1]), -(cam[0])), dx = Math.cos(a) * 16, dy = -Math.sin(a) * 16; return <g><rect x={x - 7} y={y - 5} width="14" height="10" rx="2" fill={INK} /><line x1={x} y1={y} x2={x + dx} y2={y + dy} stroke={HZ} strokeWidth="2" /></g>; })()}
  </svg>;
}
export function ViewStrip({ items = [] }) {
  const gap = 18, base = 70, widths = items.map(it => 34 * it.size * 10 / 1.2);
  let x = 10;
  const w = widths.reduce((a, b) => a + b + gap, 10);
  return <svg className="persp-figure" viewBox={`0 0 ${w} ${base + 6}`} width={w} height={base + 6} role="img" aria-label={`From left to right: ${items.map(it => GLYPH[it.type]).join(', ')}`}>
    <line x1="0" y1={base} x2={w} y2={base} stroke={INK} />
    {items.map((it, i) => { const sw = widths[i], left = x; x += sw + gap; const hgt = it.type === 'tower' ? sw * 1.8 : sw; return it.type === 'cone' ? <polygon key={i} points={`${left},${base} ${left + sw},${base} ${left + sw / 2},${base - hgt}`} fill="#b9d87a" stroke={INK} /> : <rect key={i} x={left} y={base - Math.min(hgt, base - 2)} width={sw} height={Math.min(hgt, base - 2)} rx={it.type === 'tower' ? 3 : 0} fill={it.type === 'tower' ? '#9ec5e8' : '#f2c38b'} stroke={INK} />; })}
  </svg>;
}

export function PerspectiveBox() {
  const [eye, setEye] = useState(1.6);
  const [turn, setTurn] = useState(0);
  const [tilt, setTilt] = useState(0);
  const cam = camera({ eye: [0, 0, eye], yaw: turn, pitch: tilt, f: 5 }), lines = drawBox(cam, boxCorners([0, 6, 0], [2, 2, 2.4]));
  const type = tilt !== 0 ? 'three-point' : turn !== 0 ? 'two-point' : 'one-point';
  const seen = eye > 2.4 ? 'its top' : eye < 0 ? 'its bottom' : 'neither top nor bottom';
  return <div className="tool">
    <div className="tool-stage">{lines && <Persp lines={lines} horizon={cam.horizon} />}</div>
    <label className="slider"><span>Eye height</span><input type="range" min="0.2" max="5" step="0.2" value={eye} onChange={e => setEye(Number(e.target.value))} aria-label="Eye height in metres" /></label>
    <label className="slider"><span>Turn</span><input type="range" min="-40" max="40" step="5" value={turn} onChange={e => setTurn(Number(e.target.value))} aria-label="Turn the view, degrees" /></label>
    <label className="slider"><span>Look up</span><input type="range" min="0" max="25" step="5" value={tilt} onChange={e => setTilt(Number(e.target.value))} aria-label="Tilt the view upward, degrees" /></label>
    <p className="tool-status" role="status">{`${type.replace(/^./, c => c.toUpperCase())} perspective. Eye ${eye.toFixed(1)} m high: you see ${seen} of the 2.4 m box.`}</p>
  </div>;
}
