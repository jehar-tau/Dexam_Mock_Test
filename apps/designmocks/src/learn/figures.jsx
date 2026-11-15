import React from 'react';
import { CubeView, NetDiagram } from './CubeNetTool.jsx';
import { GRID, freshSheet, fold } from './paper-fold.js';
import { SIZE, applyTransform } from './mirror.js';
import { cubeList, drawOrder } from './cube-count.js';
import { project } from './cube-net.js';
import { describeFace, newell } from './solid-net.js';
import { BeamFigure, GearsFigure, MobileFigure, RopeFigure } from './mechanism-figures.jsx';
import { LinesFigure } from './lines-figure.jsx';
import { CutSequence, CutSheet, FlapPlan, FlapSheet, LetterSheet } from './paper-figures.jsx';
import { ClockFace, MirrorAngle, RayGrid, ToneGrid } from './mirror-figures.jsx';
import { MazeFigure, NumberDiamond } from './logic-figures.jsx';
import { DieFigure, DiePath, DieRow, DieStack } from './dice-figures.jsx';
import { Panel, PanelGrid, PanelRow } from './pattern-figures.jsx';
import { TextSwatch, WheelMarks } from './colour-figures.jsx';
import { ShadowSide, ShadowTop, Silhouette, Walkers } from './shadow-figures.jsx';
import { Outline } from './surface-figures.jsx';
import { CubeCut, Revolve } from './section-figures.jsx';
import { Pieces } from './fit-figures.jsx';
import { Sheet } from './overlay-figures.jsx';
import { Coins, Frame, LeverLine, PulleyBlock, Standing } from './machine-figures.jsx';

// ---------- paper folding ----------
const U = 10; // pixels per grid unit
function sheetPolygon(state) {
  const w = state.w * U, h = state.h * U;
  return state.triangle ? `0,0 0,${h} ${w},${h}` : `0,0 ${w},0 ${w},${h} 0,${h}`;
}
function FoldStep({ state, kind }) {
  const w = state.w * U, h = state.h * U;
  let line, arrow;
  if (kind === 'left') { line = [w / 2, 0, w / 2, h]; arrow = [w * 0.9, h / 2, w * 0.6, h / 2]; }
  else if (kind === 'up') { line = [0, h / 2, w, h / 2]; arrow = [w / 2, h * 0.9, w / 2, h * 0.6]; }
  else { line = [0, 0, w, h]; arrow = [w * 0.85, h * 0.15, w * 0.6, h * 0.4]; }
  return <svg className="fold-step" viewBox={`-4 -4 ${w + 8} ${h + 8}`} width={w + 8} height={h + 8} aria-hidden="true">
    <polygon className="sheet" points={sheetPolygon(state)} />
    <line className="fold-line" x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} />
    <line className="fold-arrow" x1={arrow[0]} y1={arrow[1]} x2={arrow[2]} y2={arrow[3]} markerEnd="url(#fold-arrowhead)" />
  </svg>;
}
export function PunchedSheet({ state, cells, onPunch, punchable = [] }) {
  const w = state.w * U, h = state.h * U;
  const key = p => `${p.x},${p.y}`;
  const chosen = new Set(cells.map(key));
  return <svg className="punched-sheet" viewBox={`-4 -4 ${w + 8} ${h + 8}`} width={(w + 8) * 1.6} height={(h + 8) * 1.6} role={onPunch ? 'group' : 'img'} aria-label={onPunch ? 'Folded sheet: choose where to punch' : `Folded sheet with ${cells.length} punch${cells.length === 1 ? '' : 'es'}`}>
    <polygon className="sheet" points={sheetPolygon(state)} />
    {onPunch && punchable.map(p => <circle key={key(p)} className={`punch-spot${chosen.has(key(p)) ? ' is-punched' : ''}`} cx={p.x * U} cy={p.y * U} r={U * 0.42} role="button" tabIndex={0} aria-pressed={chosen.has(key(p))} aria-label={`Punch at column ${Math.ceil(p.x)}, row ${Math.ceil(p.y)}`} onClick={() => onPunch(p)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPunch(p); } }} />)}
    {!onPunch && cells.map(p => <circle key={key(p)} className="hole" cx={p.x * U} cy={p.y * U} r={U * 0.32} />)}
  </svg>;
}
export function FoldSequence({ folds, punched }) {
  let state = freshSheet();
  const steps = [];
  for (const kind of folds) { steps.push({ state, kind }); state = fold(state, kind); }
  const description = `${folds.length} fold${folds.length === 1 ? '' : 's'}: ${folds.join(', then ')}${punched ? `, then ${punched.cells.length} punch${punched.cells.length === 1 ? '' : 'es'}` : ''}`;
  return <div className="fold-sequence" role="img" aria-label={description}>
    <svg width="0" height="0" aria-hidden="true"><defs><marker id="fold-arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" /></marker></defs></svg>
    {steps.map((step, i) => <React.Fragment key={i}><FoldStep state={step.state} kind={step.kind} /><span className="fold-arrow-text" aria-hidden="true">→</span></React.Fragment>)}
    {punched ? <PunchedSheet state={punched.state} cells={punched.cells} /> : <svg className="fold-step" viewBox={`-4 -4 ${state.w * U + 8} ${state.h * U + 8}`} width={state.w * U + 8} height={state.h * U + 8} aria-hidden="true"><polygon className="sheet" points={sheetPolygon(state)} /></svg>}
  </div>;
}
export function HoleGrid({ holes, compact = false }) {
  const cell = compact ? 14 : 20;
  const size = GRID * cell;
  const set = new Set(holes.map(h => `${h.x},${h.y}`));
  return <svg className="hole-grid" viewBox={`-1 -1 ${size + 2} ${size + 2}`} width={size + 2} height={size + 2} role="img" aria-label={`Unfolded sheet with ${holes.length} hole${holes.length === 1 ? '' : 's'}`}>
    <rect className="sheet" x="0" y="0" width={size} height={size} />
    {Array.from({ length: GRID - 1 }, (_, i) => <React.Fragment key={i}><line className="grid-line" x1={(i + 1) * cell} y1="0" x2={(i + 1) * cell} y2={size} /><line className="grid-line" x1="0" y1={(i + 1) * cell} x2={size} y2={(i + 1) * cell} /></React.Fragment>)}
    {[...set].map(k => { const [x, y] = k.split(',').map(Number); return <circle key={k} className="hole" cx={(x + 0.5) * cell} cy={(y + 0.5) * cell} r={cell * 0.3} />; })}
  </svg>;
}

// ---------- mirror and water images ----------
const wordTransform = { same: '', mirror: 'scale(-1,1)', water: 'scale(1,-1)', turned: 'rotate(180)', quarter: 'rotate(90)', transposed: 'matrix(0,1,1,0,0,0)' };
export function ImageFigure({ figure, transform = 'same', line = null, compact = false }) {
  const cell = compact ? 12 : 18;
  const size = SIZE * cell;
  const pad = 6;
  const lineLength = size + 2 * pad;
  const width = size + 2 * pad + (line === 'mirror' ? 12 : 0), height = size + 2 * pad + (line === 'water' ? 12 : 0);
  const name = transform === 'same' ? 'figure' : `${transform} version of the figure`;
  return <svg className="image-figure" viewBox={`0 0 ${width} ${height}`} width={width * (compact ? 1 : 1.3)} height={height * (compact ? 1 : 1.3)} role="img" aria-label={name}>
    <g transform={`translate(${pad} ${pad})`}>
      {figure.type === 'pattern'
        ? applyTransform(figure.cells, transform).map(k => { const [x, y] = k.split(',').map(Number); return <rect key={k} className="image-cell" x={x * cell} y={y * cell} width={cell} height={cell} />; })
        : <g transform={`translate(${size / 2} ${size / 2}) ${wordTransform[transform]}`}><text className="image-word" textAnchor="middle" dominantBaseline="central" fontSize={cell * 1.25} fontWeight="700">{figure.word}</text></g>}
    </g>
    {line === 'mirror' && <line className="reflect-line" x1={size + 2 * pad + 4} y1="0" x2={size + 2 * pad + 4} y2={lineLength} />}
    {line === 'water' && <line className="reflect-line water" x1="0" y1={size + 2 * pad + 4} x2={lineLength} y2={size + 2 * pad + 4} />}
  </svg>;
}

// ---------- cube stacks and solids ----------
// Any set of unit cubes, drawn back to front as seen from (+x, +y, +z).
export function VoxelFigure({ cubes: list, box = null, large = false, marked = null, highlight = null, label }) {
  const s = large ? 26 : 18;
  const nx = box?.[0] ?? Math.max(1, ...list.map(c => c.x + 1)), ny = box?.[1] ?? Math.max(1, ...list.map(c => c.y + 1)), nz = box?.[2] ?? Math.max(1, ...list.map(c => c.z + 1));
  const p = v => project(v).map(c => c * s);
  const corners = [[0, 0, 0], [nx, 0, 0], [0, ny, 0], [nx, ny, 0], [0, 0, nz], [nx, 0, nz], [0, ny, nz], [nx, ny, nz]].map(p);
  const minX = Math.min(...corners.map(c => c[0])) - 4, maxX = Math.max(...corners.map(c => c[0])) + 4;
  const minY = Math.min(...corners.map(c => c[1])) - 4, maxY = Math.max(...corners.map(c => c[1])) + 4;
  const face = points => points.map(v => p(v).join(',')).join(' ');
  const isMarked = c => marked && marked.x === c.x && marked.y === c.y && marked.z === c.z;
  const isHighlight = c => highlight && highlight.x === c.x && highlight.y === c.y;
  return <svg className="stack-figure" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} width={maxX - minX} height={maxY - minY} role="img" aria-label={label ?? `Solid made of ${list.length} cubes`}>
    <polygon className="floor" points={face([[0, 0, 0], [nx, 0, 0], [nx, ny, 0], [0, ny, 0]])} />
    {drawOrder(list).map(c => { const { x, y, z } = c; return <g key={`${x}-${y}-${z}`} className={`stack-cube${isHighlight(c) ? ' is-highlight' : ''}${isMarked(c) ? ' is-marked' : ''}${c.piece != null ? ` piece-${c.piece}` : ''}`}>
      <polygon className="face top" points={face([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]])} />
      <polygon className="face left" points={face([[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]])} />
      <polygon className="face right" points={face([[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]])} />
    </g>; })}
  </svg>;
}
export function StackFigure({ heights, large = false, highlight = null, marked = null }) {
  const total = heights.flat().reduce((a, b) => a + b, 0);
  const box = [heights.length, heights[0].length, Math.max(1, ...heights.flat())];
  return <VoxelFigure cubes={cubeList(heights)} box={box} large={large} highlight={highlight} marked={marked}
    label={`Stack of ${total} cubes on a ${heights.length} by ${heights[0].length} floor${marked ? ', one cube coloured orange' : ''}`} />;
}

// Top, front and right-side views. Top: x runs down, y runs right. Front (seen from +x): y runs
// right. Right side (seen from +y): x runs LEFT, so the front of the stack is at its left edge.
// One view on its own: rows top to bottom, each a list of filled cells left to right.
export function ViewGrid({ grid, compact = false }) {
  const cell = compact ? 14 : 22, rows = grid.length, cols = grid[0].length;
  return <svg className="view-grid" viewBox={`-1 -1 ${cols * cell + 2} ${rows * cell + 2}`} width={cols * cell + 2} height={rows * cell + 2} role="img" aria-label={`A view ${cols} squares wide and ${rows} high, with ${grid.flat().filter(Boolean).length} squares filled`}>
    {grid.flatMap((row, r) => row.map((on, c) => <rect key={`${r}-${c}`} className={on ? 'view-cell is-on' : 'view-cell'} x={c * cell} y={r * cell} width={cell} height={cell} />))}
  </svg>;
}
export function ViewsFigure({ top, front, side, compact = false }) {
  const cell = compact ? 12 : 24;
  const nx = top.length, ny = top[0].length, nz = Math.max(1, ...front, ...(side ?? []));
  const grid = (columns, rows, filled, key) => <svg className="view-grid" viewBox={`-1 -1 ${columns * cell + 2} ${rows * cell + 2}`} width={columns * cell + 2} height={rows * cell + 2} aria-hidden="true">
    {Array.from({ length: columns * rows }, (_, i) => { const c = i % columns, r = Math.floor(i / columns); return <rect key={`${key}-${i}`} className={filled(c, r) ? 'view-cell is-on' : 'view-cell'} x={c * cell} y={r * cell} width={cell} height={cell} />; })}
  </svg>;
  const description = `Top view with ${top.flat().filter(Boolean).length} floor squares. Front view, column heights left to right: ${front.join(', ')}. ${side ? `Right-side view, column heights left to right: ${[...side].reverse().join(', ')}.` : 'The right-side view is not given.'}`;
  return <div className="views-figure" role="img" aria-label={description}>
    <div className="view view-top"><span className="view-caption">Top</span>{grid(ny, nx, (c, r) => top[r][c], 'top')}</div>
    <div className="view view-front"><span className="view-caption">Front</span>{grid(ny, nz, (c, r) => front[c] > nz - 1 - r, 'front')}</div>
    {side ? <div className="view view-side"><span className="view-caption">Right side</span>{grid(nx, nz, (c, r) => side[nx - 1 - c] > nz - 1 - r, 'side')}</div>
      : <div className="view view-side"><span className="view-caption">Right side</span><span className="view-unknown" aria-hidden="true">?</span></div>}
  </div>;
}

// ---------- solids and their nets ----------
const quarterTurn = (p, turns) => { let [x, y, z] = p; for (let i = 0; i < ((turns % 4) + 4) % 4; i++) [x, y] = [-y, x]; return [x, y, z]; };
const LIGHT = [0.35, 0.5, 0.79];
// A solid built from cubes, drawn as the exam draws it: faces in one plane merge, so only the
// real edges of the solid are lined in.
function MergedCubes({ cells, large, compact, label }) {
  const s = large ? 30 : compact ? 13 : 20;
  const has = new Set(cells.map(c => c.join(',')));
  const there = c => has.has(c.join(','));
  const dirs = [{ axis: 2, tone: 'top' }, { axis: 0, tone: 'left' }, { axis: 1, tone: 'right' }];
  const p = v => project(v).map(c => c * s);
  const order = [...cells].sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]) || a[2] - b[2]);
  const shapes = [];
  for (const cell of order) for (const { axis, tone } of dirs) {
    const out = [...cell]; out[axis] += 1;
    if (there(out)) continue;
    const [b, c] = [(axis + 1) % 3, (axis + 2) % 3];
    const corner = (db, dc) => { const q = [...cell]; q[axis] += 1; q[b] += db; q[c] += dc; return q; };
    const quad = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)];
    shapes.push({ kind: 'fill', tone, points: quad.map(p) });
    // Line an edge only where the neighbouring square is not part of the same flat face.
    const sides = [[quad[0], quad[1], c, -1], [quad[1], quad[2], b, 1], [quad[2], quad[3], c, 1], [quad[3], quad[0], b, -1]];
    for (const [from, to, along, step] of sides) {
      const beside = [...cell]; beside[along] += step;
      const above = [...beside]; above[axis] += 1;
      if (there(beside) && !there(above)) continue;
      shapes.push({ kind: 'line', points: [p(from), p(to)] });
    }
  }
  const all = shapes.flatMap(shape => shape.points);
  const minX = Math.min(...all.map(q => q[0])) - 4, maxX = Math.max(...all.map(q => q[0])) + 4, minY = Math.min(...all.map(q => q[1])) - 4, maxY = Math.max(...all.map(q => q[1])) + 4;
  return <svg className="solid-figure merged-cubes" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} width={maxX - minX} height={maxY - minY} role="img" aria-label={label}>
    {shapes.map((shape, i) => (shape.kind === 'fill'
      ? <polygon key={i} className={`merged-face ${shape.tone}`} points={shape.points.map(q => q.join(',')).join(' ')} />
      : <line key={i} className="merged-edge" x1={shape.points[0][0]} y1={shape.points[0][1]} x2={shape.points[1][0]} y2={shape.points[1][1]} />))}
  </svg>;
}
// A net caught part-way through folding: every face drawn where foldedPose puts it.
export function FoldingFigure({ pose, turns = 0, highlight = null, closed = false, marks = [], label }) {
  const s = 24;
  const pieces = pose.map(face => {
    const points = face.points.map(q => quarterTurn(q, turns));
    const normal = newell(points);
    const facing = normal[0] + normal[1] + normal[2];
    const depth = points.reduce((sum, q) => sum + q[0] + q[1] + q[2], 0) / points.length;
    const lit = Math.max(0, (facing >= 0 ? 1 : -1) * (normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2]));
    const shade = Math.round((facing >= 0 ? 150 : 120) + 95 * lit);
    const lines = marks.filter(m => m.face === face.id).map(m => ({ cls: m.cls, ends: [m.a, m.b].map(q => project(quarterTurn(face.place(q), turns)).map(c => c * s)) }));
    return { id: face.id, facing, depth, lines, fill: `rgb(${shade},${shade},${Math.round(shade * 0.96)})`, points: points.map(q => project(q).map(c => c * s)) };
  }).filter(piece => !closed || piece.facing > 0.02).sort((a, b) => a.depth - b.depth);
  const all = pieces.flatMap(piece => piece.points);
  const minX = Math.min(...all.map(q => q[0])) - 4, maxX = Math.max(...all.map(q => q[0])) + 4, minY = Math.min(...all.map(q => q[1])) - 4, maxY = Math.max(...all.map(q => q[1])) + 4;
  return <svg className="solid-figure folding-figure" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} role="img" aria-label={label ?? 'The net part-way through folding'}>
    {pieces.map((piece, i) => <g key={i}><polygon className={`solid-face${highlight === piece.id ? ' is-highlight' : ''}`} points={piece.points.map(q => q.join(',')).join(' ')} style={highlight === piece.id ? undefined : { fill: piece.fill }} />
      {piece.lines.map((line, k) => <line key={k} className={`face-mark mark-${line.cls}${piece.facing > 0 ? '' : ' is-back'}`} x1={line.ends[0][0]} y1={line.ends[0][1]} x2={line.ends[1][0]} y2={line.ends[1][1]} />)}</g>)}
  </svg>;
}

// A solid from solid-net.js, seen from (+x, +y, +z). `shown` limits it to some faces; `highlight` tints one.
export function SolidFigure({ solid, turns = 0, shown = null, highlight = null, large = false, compact = false, label }) {
  if (solid.family === 'polycube') return <MergedCubes cells={solid.cells.map(c => quarterTurn(c, turns))} large={large} compact={compact} label={label ?? `Solid built from ${solid.cells.length} cubes, with ${solid.faces.length} faces`} />;
  const s = large ? 26 : compact ? 11 : 16;
  const pieces = [];
  solid.faces.forEach((face, f) => {
    if (shown && !shown.has(f)) return;
    for (const part of face.draw) {
      const points = part.points.map(p => quarterTurn(p, turns));
      const normal = newell(points);
      if (normal[0] + normal[1] + normal[2] <= 0.02) continue;
      const depth = points.reduce((sum, p) => sum + p[0] + p[1] + p[2], 0) / points.length;
      const shade = Math.round(150 + 95 * Math.max(0, normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2]));
      pieces.push({ f, depth, lines: (solid.marks ?? []).filter(m => m.face === f).map(m => ({ cls: m.cls, ends: [m.a, m.b].map(q => project(quarterTurn(q, turns)).map(c => c * s)) })), outline: part.outline, fill: `rgb(${shade},${shade},${Math.round(shade * 0.96)})`, points: points.map(p => project(p).map(c => c * s)) });
    }
  });
  pieces.sort((a, b) => a.depth - b.depth);
  const all = solid.faces.flatMap(face => face.draw.flatMap(part => part.points.map(p => project(quarterTurn(p, turns)).map(c => c * s))));
  const minX = Math.min(...all.map(p => p[0])) - 4, maxX = Math.max(...all.map(p => p[0])) + 4, minY = Math.min(...all.map(p => p[1])) - 4, maxY = Math.max(...all.map(p => p[1])) + 4;
  return <svg className="solid-figure" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} width={maxX - minX} height={maxY - minY} role="img" aria-label={label ?? `Solid with ${solid.faces.length} faces`}>
    {pieces.map((piece, i) => <g key={i}><polygon className={`solid-face${piece.outline ? '' : ' is-smooth'}${highlight === piece.f ? ' is-highlight' : ''}`} points={piece.points.map(p => p.join(',')).join(' ')} style={highlight === piece.f ? undefined : { fill: piece.fill, stroke: piece.outline ? undefined : piece.fill }} />
      {piece.lines.map((line, k) => <line key={k} className={`face-mark mark-${line.cls}`} x1={line.ends[0][0]} y1={line.ends[0][1]} x2={line.ends[1][0]} y2={line.ends[1][1]} />)}</g>)}
  </svg>;
}

// A net from solid-net.js. Cut edges are solid lines, fold edges dashed.
export function SolidNetFigure({ net, compact = false, shown = null, selected = null, onSelect, label }) {
  const raw = net.faces.flatMap(face => face.outline);
  // Lay a tall net on its side, as exam papers do. A quarter turn, never a flip.
  const tall = Math.max(...raw.map(p => p[1])) - Math.min(...raw.map(p => p[1])) > Math.max(...raw.map(p => p[0])) - Math.min(...raw.map(p => p[0]));
  const turn = p => (tall ? [p[1], -p[0]] : p);
  const points = raw.map(turn);
  const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0])), minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
  const [boxW, boxH] = compact ? [270, 150] : [420, 240];
  const k = Math.min(boxW / (maxX - minX), boxH / (maxY - minY), compact ? 22 : 34);
  // Net coordinates have y up; the screen has y down.
  const at = q => { const p = turn(q); return [(p[0] - minX) * k, (maxY - p[1]) * k]; };
  const folds = new Set(net.folds.flatMap(f => [`${f.a}.${f.ea}`]));
  const hidden = new Set(net.folds.map(f => `${f.b}.${f.eb}`));
  const width = (maxX - minX) * k, height = (maxY - minY) * k;
  return <svg className="solid-net" viewBox={`-3 -3 ${width + 6} ${height + 6}`} width={width + 6} height={height + 6} role={onSelect ? 'group' : 'img'} aria-label={label ?? `Net of ${net.faces.length} faces`}>
    {net.faces.map((face, f) => {
      const d = face.outline.map(p => at(p).map(v => v.toFixed(1)).join(',')).join(' ');
      const className = `net-face-shape${shown && !shown.has(f) ? ' is-flat' : ''}${selected === f ? ' is-selected' : ''}`;
      return onSelect
        ? <polygon key={f} className={className} points={d} role="button" tabIndex={0} aria-pressed={selected === f} aria-label={`Face ${f + 1}: ${describeFace(face).replace(/^the /, '')}`} onClick={() => onSelect(f)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(f); } }} />
        : <polygon key={f} className={className} points={d} />;
    })}
    {net.grid && (() => {
      // A unit grid over the whole net, as exam papers print it. Drawn over the faces, under the outlines.
      const lines = [];
      for (let x = Math.ceil(minX - 1e-6); x <= maxX + 1e-6; x++) lines.push([(x - minX) * k, 0, (x - minX) * k, height]);
      for (let y = Math.ceil(minY - 1e-6); y <= maxY + 1e-6; y++) lines.push([0, (maxY - y) * k, width, (maxY - y) * k]);
      return lines.map((l, i) => <line key={`g${i}`} className="net-gridline" x1={l[0].toFixed(1)} y1={l[1].toFixed(1)} x2={l[2].toFixed(1)} y2={l[3].toFixed(1)} />);
    })()}
    {net.faces.map((face, f) => face.lines.map((line, e) => (hidden.has(`${f}.${e}`) ? null
      : <polyline key={`${f}.${e}`} className={folds.has(`${f}.${e}`) ? 'net-fold' : 'net-cut'} points={line.map(p => at(p).map(v => v.toFixed(1)).join(',')).join(' ')} />)))}
    {(net.marks ?? []).map((m, i) => { const [a, b] = [at(m.a), at(m.b)]; return <line key={`m${i}`} className={`face-mark mark-${m.cls}`} x1={a[0].toFixed(1)} y1={a[1].toFixed(1)} x2={b[0].toFixed(1)} y2={b[1].toFixed(1)} />; })}
  </svg>;
}

// ---------- colour ----------
export function Swatch({ colour, name = '', large = false }) {
  return <span className={`swatch-figure${large ? ' large' : ''}`}><span className="swatch-chip" style={{ background: colour }} role="img" aria-label={name ? `${name} swatch` : 'colour swatch'} />{name && <span className="swatch-name">{name}</span>}</span>;
}

// ---------- dispatcher ----------
export function Figure({ spec, compact = false }) {
  if (!spec) return null;
  switch (spec.type) {
    case 'net': {
      const states = { ...(spec.states ?? {}) };
      for (const i of spec.badCells ?? []) states[i] = 'is-bad';
      return <NetDiagram cells={spec.cells} states={spec.showBad ? states : (spec.states ?? {})} compact={compact || spec.compact} />;
    }
    case 'cube': return <CubeView view={spec.view} large={spec.large && !compact} caption={spec.label ?? null} />;
    case 'fold-sequence': return <FoldSequence folds={spec.folds} punched={spec.punched} />;
    case 'holes': return <HoleGrid holes={spec.holes} compact={compact} />;
    case 'image': return <ImageFigure figure={spec.figure} transform={spec.transform} line={spec.line} compact={compact} />;
    case 'stack': return <StackFigure heights={spec.heights} large={spec.large && !compact} marked={spec.marked} />;
    case 'voxels': return <VoxelFigure cubes={spec.cubes} box={Array.isArray(spec.box) ? spec.box : spec.box ? [spec.box, spec.box, spec.box] : null} large={spec.large && !compact} marked={spec.marked} label={spec.label} />;
    case 'solid': return <SolidFigure solid={spec.solid} large={spec.large && !compact} compact={compact} />;
    case 'solid-net': return <SolidNetFigure net={spec.net} compact={compact} />;
    case 'views': return <ViewsFigure top={spec.top} front={spec.front} side={spec.side} compact={compact} />;
    case 'gears': return <GearsFigure system={spec.system} showSizes={spec.showSizes} marks={spec.marks} plain={spec.plain} caption={compact ? null : spec.caption} compact={compact} />;
    case 'rope': return <RopeFigure rope={spec.rope} towardsPull={spec.towardsPull} compact={compact} />;
    case 'beam': return <BeamFigure beam={spec.beam} ask={spec.ask} compact={compact} />;
    case 'mobile': return <MobileFigure mobile={spec.mobile} known={spec.known} />;
    case 'lines': return <LinesFigure segments={spec.segments} ghost={spec.ghost} mirrors={spec.mirrors} compact={compact} unit={spec.unit} label={spec.label} />;
    case 'cut-sequence': return <CutSequence folds={spec.folds} cuts={spec.cuts} cutLines={spec.cutLines} strokes={spec.strokes} />;
    case 'cut-sheet': return <CutSheet shapes={spec.shapes} compact={compact} />;
    case 'flap-plan': return <FlapPlan flaps={spec.flaps} />;
    case 'flap-sheet': return <FlapSheet outline={spec.outline} back={spec.back} allFront={spec.allFront} compact={compact} />;
    case 'letter-sheet': return <LetterSheet strokes={spec.strokes} creases={spec.creases} compact={compact} />;
    case 'tone-grid': return <ToneGrid cells={spec.cells} n={spec.n} lines={spec.lines} compact={compact} />;
    case 'clock': return <ClockFace h={spec.h} m={spec.m} />;
    case 'mirror-angle': return <MirrorAngle theta={spec.theta} onBisector={spec.onBisector} />;
    case 'ray-grid': return <RayGrid n={spec.n} mirrors={spec.mirrors} start={spec.start} labels={spec.labels} compact={compact} />;
    case 'table': return <table className="data-table"><thead><tr>{spec.head.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{spec.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table>;
    case 'number-diamond': return <NumberDiamond outer={spec.outer} centre={spec.centre} compact={compact} />;
    case 'maze': return <MazeFigure n={spec.n} m={spec.m} open={spec.open} from={spec.from} to={spec.to} compact={compact} />;
    case 'view-grid': return <ViewGrid grid={spec.grid} compact={compact} />;
    case 'die': return <DieFigure top={spec.top} front={spec.front} right={spec.right} compact={compact} />;
    case 'die-stack': return <DieStack dice={spec.dice} />;
    case 'die-row': return <DieRow dice={spec.dice} />;
    case 'die-path': return <DiePath path={spec.path} />;
    case 'panel': return <Panel panel={spec.panel} size={compact ? 56 : 72} />;
    case 'panel-row': return <PanelRow panels={spec.panels} ask={spec.ask} analogy={spec.analogy} />;
    case 'panel-grid': return <PanelGrid grid={spec.grid} />;
    case 'lever-line': return <LeverLine order={spec.order} arms={spec.arms} />;
    case 'pulley-block': return <PulleyBlock strands={spec.strands} />;
    case 'frame': return <Frame points={spec.points} bars={spec.bars} compact={compact} />;
    case 'standing': return <Standing poly={spec.poly} compact={compact} />;
    case 'coins': return <Coins R={spec.R} r={spec.r} inside={spec.inside} />;
    case 'sheet': return <Sheet n={spec.n} cells={spec.cells} label={spec.label} fold={spec.fold} region={spec.region} compact={compact} />;
    case 'pieces': return <Pieces pieces={spec.pieces} compact={compact} />;
    case 'cube-cut': return <CubeCut points={spec.points} polygon={spec.polygon} compact={compact} />;
    case 'revolve': return <Revolve shape={spec.shape} />;
    case 'outline': return <Outline cells={spec.cells} holes={spec.holes} label={spec.label} compact={compact} />;
    case 'shadow-top': return <ShadowTop outlines={spec.outlines} apexes={spec.apexes} shadows={spec.shadows} light={spec.light} dashed={spec.dashed} compassOnly={spec.compassOnly} compact={compact} />;
    case 'shadow-side': return <ShadowSide objects={spec.objects} lamp={spec.lamp} />;
    case 'walkers': return <Walkers walkers={spec.walkers} />;
    case 'silhouette': return <Silhouette outline={spec.outline} />;
    case 'wheel-marks': return <WheelMarks marks={spec.marks} size={compact ? 104 : 132} />;
    case 'text-swatch': return <TextSwatch fg={spec.fg} bg={spec.bg} name={spec.name} />;
    case 'swatch': return <Swatch colour={spec.colour} name={spec.name} large={!compact} />;
    default: return null;
  }
}
