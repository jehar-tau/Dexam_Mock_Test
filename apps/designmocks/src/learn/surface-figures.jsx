// Outline figure and the surface-explorer tool.
import { useState } from 'react';
import { VoxelFigure } from './figures.jsx';
import { outlineSides, surfacesByDirection, tunnelCube } from './surfaces.js';

export function Outline({ cells = [], holes = [], label = null, compact = false }) {
  const s = compact ? 14 : 20, all = [...cells, ...holes], w = Math.max(...all.map(c => c[0])) + 1, h = Math.max(...all.map(c => c[1])) + 1;
  return <span className="outline-figure">
    <svg viewBox={`-2 -2 ${w * s + 4} ${h * s + 4}`} width={w * s + 4} height={h * s + 4} role="img" aria-label={`${label ? `Shape ${label}: ` : ''}a flat shape with ${outlineSides([...cells, ...holes])} straight sides${holes.length ? ' and a square hole' : ''}`}>
      {cells.map(([x, y]) => <rect key={`${x},${y}`} x={x * s} y={(h - 1 - y) * s} width={s} height={s} fill="var(--lime, #b9d87a)" stroke="rgba(0,0,0,.18)" strokeWidth="0.6" />)}
      {holes.map(([x, y]) => <rect key={`h${x},${y}`} x={x * s} y={(h - 1 - y) * s} width={s} height={s} fill="var(--paper, #fff)" stroke="rgba(0,0,0,.1)" strokeWidth="0.6" />)}
    </svg>
    {label && <span className="swatch-name">{label}</span>}
  </span>;
}

const L = [[0, 0, 0], [1, 0, 0], [0, 1, 0]];
const STEPS = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0], [1, 1, 0], [2, 1, 0], [1, 0, 1], [2, 0, 1], [1, 1, 1], [2, 1, 1], [2, 0, 2], [2, 1, 2]];
const NOTCHED = (() => { const out = []; for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 2; z++) if (!(y === 1 && z === 1)) out.push([x, y, z]); return out; })();
const SAMPLES = { L: ['Three cubes', L], steps: ['Steps', STEPS], notched: ['Slotted block', NOTCHED], tunnel: ['Tunnel', tunnelCube(3, [0])] };
export function SurfaceExplorer({ sample = 'L' }) {
  const [which, setWhich] = useState(sample);
  const [dir, setDir] = useState(null);
  const cubes = SAMPLES[which][1], counts = surfacesByDirection(cubes), total = counts.reduce((s, d) => s + d.count, 0);
  const status = dir == null ? `Pick a direction. This solid has ${total} surfaces in all.` : `${counts[dir].name.replace(/^./, c => c.toUpperCase())}: ${counts[dir].count} surface${counts[dir].count === 1 ? '' : 's'}. All six directions together: ${total}.`;
  return <div className="tool">
    <div className="icon-cluster" role="group" aria-label="Solid">{Object.entries(SAMPLES).map(([k, [label]]) => <button key={k} type="button" className={`chip${which === k ? ' is-active' : ''}`} aria-pressed={which === k} onClick={() => { setWhich(k); setDir(null); }}>{label}</button>)}</div>
    <div className="tool-stage"><VoxelFigure cubes={cubes.map(([x, y, z]) => ({ x, y, z }))} large label={`${SAMPLES[which][0]}, ${cubes.length} cubes`} /></div>
    <div className="icon-cluster" role="group" aria-label="Direction">{counts.map((d, i) => <button key={d.name} type="button" className={`chip${dir === i ? ' is-active' : ''}`} aria-pressed={dir === i} onClick={() => setDir(i)}>{d.name.replace('facing ', '')}</button>)}</div>
    <p className="tool-status" role="status">{status}</p>
  </div>;
}
