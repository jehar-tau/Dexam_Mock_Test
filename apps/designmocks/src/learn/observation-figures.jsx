// Figures and the feature-scanner tool for visual observation.
import { useState } from 'react';

const INK = 'var(--ink, #1d1d1b)';
export function Icon({ icon, x = 0, y = 0, s = 34, mark = false }) {
  const c = s / 2, a = (icon.hand * Math.PI) / 4, r = s * 0.36;
  return <g transform={`translate(${x},${y})`}>
    {mark && <rect x="1" y="1" width={s - 2} height={s - 2} rx="5" fill="rgba(226,80,43,.18)" stroke="var(--orange, #e2502b)" />}
    <circle cx={c} cy={c} r={r} fill={icon.filled ? '#b9d87a' : '#fff'} stroke={INK} strokeWidth="1.4" />
    <line x1={c} y1={c} x2={c + Math.sin(a) * r * 0.85} y2={c - Math.cos(a) * r * 0.85} stroke={INK} strokeWidth="2" strokeLinecap="round" />
    {Array.from({ length: icon.dots }, (_, i) => <circle key={i} cx={c - ((icon.dots - 1) * 5) / 2 + i * 5} cy={s - 3} r="1.8" fill={INK} />)}
  </g>;
}
export function IconGrid({ icons = [], cols = 3, label = null, marks = [] }) {
  const s = 36, rows = Math.ceil(icons.length / cols), w = cols * s + 22, h = rows * s + 18;
  return <span className="outline-figure">
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={`${label ? `${label}: ` : ''}a grid of ${icons.length} small dial icons in ${rows} rows and ${cols} columns`}>
      {Array.from({ length: cols }, (_, c) => <text key={`c${c}`} x={22 + c * s + s / 2} y="11" textAnchor="middle" fontSize="9" fill="var(--muted, #666)">{c + 1}</text>)}
      {Array.from({ length: rows }, (_, r) => <text key={`r${r}`} x="8" y={18 + r * s + s / 2 + 3} textAnchor="middle" fontSize="9" fill="var(--muted, #666)">{r + 1}</text>)}
      {icons.map((ic, i) => <Icon key={i} icon={ic} x={22 + (i % cols) * s} y={16 + Math.floor(i / cols) * s} s={s} mark={marks.includes(i)} />)}
    </svg>
    {label && <span className="swatch-name">{label}</span>}
  </span>;
}
function shapePath(sh, k) {
  const { x, y, size, turn } = sh, cx = x * k, cy = y * k, r = size * k * 0.5, rot = p => p.map(([u, v]) => { const a = (turn * Math.PI) / 180; return [cx + u * Math.cos(a) - v * Math.sin(a), cy + u * Math.sin(a) + v * Math.cos(a)]; });
  if (sh.type === 'circle') return <circle cx={cx} cy={cy} r={r} />;
  const pts = sh.type === 'square' ? rot([[-r, -r], [r, -r], [r, r], [-r, r]].map(([u, v]) => [u * 0.8, v * 0.8])) : sh.type === 'triangle' ? rot([[0, -r], [r * 0.9, r * 0.6], [-r * 0.9, r * 0.6]]) : rot(Array.from({ length: 10 }, (_, i) => { const a = (Math.PI * i) / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; return [rr * Math.cos(a), rr * Math.sin(a)]; }));
  return <polygon points={pts.map(p => p.join(',')).join(' ')} />;
}
export function Clutter({ shapes = [] }) {
  const k = 34, w = 10 * k, h = 7 * k;
  return <svg className="clutter-figure" viewBox={`${-k * 0.5} ${-k * 0.5} ${w + k * 0.5} ${h + k * 0.5}`} width={w} height={h} role="img" aria-label={`A picture of ${shapes.length} overlapping outline shapes`}>
    <g fill="none" stroke={INK} strokeWidth="1.5">{shapes.map((sh, i) => <g key={i}>{shapePath(sh, k)}</g>)}</g>
  </svg>;
}

const BASE = { hand: 2, dots: 2, filled: false };
const GRID = Array.from({ length: 16 }, (_, i) => (i === 6 ? { ...BASE, hand: 3 } : i === 11 ? { ...BASE, dots: 3 } : BASE));
export function FeatureScanner() {
  const [feature, setFeature] = useState(null);
  const marks = feature ? GRID.map((ic, i) => (ic[feature] !== BASE[feature] ? i : -1)).filter(i => i >= 0) : [];
  const names = { filled: 'Fill', hand: 'Hand', dots: 'Dots' };
  return <div className="tool">
    <div className="tool-stage"><IconGrid icons={GRID} cols={4} marks={marks} /></div>
    <div className="icon-cluster" role="group" aria-label="Scan one feature">{Object.entries(names).map(([k, label]) => <button key={k} type="button" className={`chip${feature === k ? ' is-active' : ''}`} aria-pressed={feature === k} onClick={() => setFeature(k)}>{label}</button>)}</div>
    <p className="tool-status" role="status">{feature ? `Scanning ${names[feature].toLowerCase()} only: ${marks.length} icon${marks.length === 1 ? '' : 's'} differ.` : 'Pick one feature and scan the whole grid for it.'}</p>
  </div>;
}
