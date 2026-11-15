// The transparent-sheet figure and the sheet-stacker tool.
import { useState } from 'react';
import { overlay, transform } from './overlay.js';

const INK = 'var(--ink, #1d1d1b)';
const NAMES = { dot: 'dot', ring: 'ring', h: 'level line', v: 'upright line', d1: 'line rising to the right', d2: 'line falling to the right', fill: 'shaded' };
const inRegion = (region, c, r, n) => !region || (region === 'left' ? c < n / 2 : region === 'right' ? c >= n / 2 : region === 'top' ? r < n / 2 : region === 'bottom' ? r >= n / 2 : region === 'upper' ? r <= c : r >= c);
function Mark({ mark, x, y, s }) {
  const m = s * 0.22, cx = x + s / 2, cy = y + s / 2;
  if (mark === 'fill') return <rect x={x + 1} y={y + 1} width={s - 2} height={s - 2} fill="rgba(46,94,170,.45)" />;
  if (mark === 'dot') return <circle cx={cx} cy={cy} r={s * 0.12} fill={INK} />;
  if (mark === 'ring') return <circle cx={cx} cy={cy} r={s * 0.28} fill="none" stroke={INK} strokeWidth="1.8" />;
  const [dx, dy] = { h: [1, 0], v: [0, 1], d1: [1, -1], d2: [1, 1] }[mark];
  return <line x1={cx - dx * s * 0.34} y1={cy - dy * s * 0.34} x2={cx + dx * s * 0.34} y2={cy + dy * s * 0.34} stroke={INK} strokeWidth="2.2" strokeLinecap="round" />;
}
export function Sheet({ n = 3, cells = {}, label = null, fold = null, region = null, compact = false }) {
  const s = compact ? 22 : 30, w = n * s, list = Object.entries(cells).filter(([, m]) => m.length);
  const desc = list.map(([k, m]) => { const [c, r] = k.split(',').map(Number); return `row ${r + 1} column ${c + 1}: ${m.map(x => NAMES[x]).join(' and ')}`; }).join('; ');
  return <span className="outline-figure">
    <svg viewBox={`-2 -2 ${w + 4} ${w + 4}`} width={w + 4} height={w + 4} role="img" aria-label={`${label ? `${label}: ` : ''}a ${n} by ${n} transparent sheet${region ? `, folded so only the ${region} half shows` : ''}${list.length ? ` with ${desc}` : ', blank'}${fold ? `, dashed ${fold} fold line` : ''}`}>
      <rect x="0" y="0" width={w} height={w} fill="rgba(220,236,250,.55)" stroke={INK} strokeWidth="1.4" />
      {Array.from({ length: n * n }, (_, i) => { const c = i % n, r = Math.floor(i / n); return <rect key={i} x={c * s} y={r * s} width={s} height={s} fill={inRegion(region, c, r, n) ? 'none' : 'rgba(120,120,120,.28)'} stroke="rgba(0,0,0,.15)" strokeWidth="0.6" />; })}
      {list.flatMap(([k, m]) => { const [c, r] = k.split(',').map(Number); return m.map(mark => <Mark key={`${k}-${mark}`} mark={mark} x={c * s} y={r * s} s={s} />); })}
      {fold === 'vertical' && <line x1={w / 2} y1={-2} x2={w / 2} y2={w + 2} stroke="var(--orange, #e2502b)" strokeWidth="2" strokeDasharray="5 3" />}
      {fold === 'horizontal' && <line x1={-2} y1={w / 2} x2={w + 2} y2={w / 2} stroke="var(--orange, #e2502b)" strokeWidth="2" strokeDasharray="5 3" />}
      {fold === 'diagonal' && <line x1={0} y1={0} x2={w} y2={w} stroke="var(--orange, #e2502b)" strokeWidth="2" strokeDasharray="5 3" />}
    </svg>
    {label && <span className="swatch-name">{label}</span>}
  </span>;
}

const A = { '0,0': ['dot'], '2,0': ['d1'], '1,2': ['h'] }, B = { '1,0': ['ring'], '0,2': ['v'], '2,1': ['d2'] };
export function SheetStacker() {
  const [moves, setMoves] = useState([]);
  const b = moves.reduce((s, m) => transform(s, m, 3), B);
  const label = { turn: 'turned', flipH: 'flipped left to right', flipV: 'flipped top to bottom' };
  return <div className="tool">
    <div className="tool-stage piece-stage"><Sheet n={3} cells={A} label="Sheet 1" /><Sheet n={3} cells={b} label="Sheet 2" /><Sheet n={3} cells={overlay(A, b)} label="Stacked" /></div>
    <div className="icon-cluster" role="group" aria-label="Move sheet 2">
      <button type="button" className="chip" onClick={() => setMoves(m => [...m, 'turn'])}>Turn sheet 2</button>
      <button type="button" className="chip" onClick={() => setMoves(m => [...m, 'flipH'])}>Flip left to right</button>
      <button type="button" className="chip" onClick={() => setMoves(m => [...m, 'flipV'])}>Flip top to bottom</button>
      <button type="button" className="chip" onClick={() => setMoves([])}>Start again</button>
    </div>
    <p className="tool-status" role="status">{moves.length ? `Sheet 2 ${moves.map(m => label[m]).join(', then ')}. Watch the slanting line change direction.` : 'Sheet 2 as drawn. Stacked, every mark shows through.'}</p>
  </div>;
}
