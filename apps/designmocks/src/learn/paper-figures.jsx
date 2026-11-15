import React from 'react';
import { S, packetAfter, packetOutline } from './paper-cut.js';

// Figures for paper-cut.js. Grid units, y down, sheet S × S.
const pts = (list, u) => list.map(([x, y]) => `${(x * u).toFixed(1)},${(y * u).toFixed(1)}`).join(' ');
const FOLD_TEXT = { left: 'right half over to the left', up: 'bottom half up', diagonal: 'corner to corner' };

// One fold step: the packet before the fold, the fold line dashed and the part that moves shaded.
function FoldStepFigure({ state, kind, u = 7 }) {
  const { w, h } = state, outline = packetOutline(state);
  const moving = kind === 'left' ? [[w / 2, 0], [w, 0], [w, h], [w / 2, h]] : kind === 'up' ? [[0, h / 2], [w, h / 2], [w, h], [0, h]] : [[0, 0], [w, 0], [w, h]];
  const line = kind === 'left' ? [[w / 2, 0], [w / 2, h]] : kind === 'up' ? [[0, h / 2], [w, h / 2]] : [[0, 0], [w, h]];
  const arrow = kind === 'left' ? [[w * 0.85, h / 2], [w * 0.55, h / 2]] : kind === 'up' ? [[w / 2, h * 0.85], [w / 2, h * 0.55]] : [[w * 0.8, h * 0.2], [w * 0.55, h * 0.45]];
  return <svg className="fold-step" viewBox={`-3 -3 ${w * u + 6} ${h * u + 6}`} width={w * u + 6} height={h * u + 6} aria-hidden="true">
    <polygon className="sheet" points={pts(outline, u)} />
    <polygon className="fold-moving" points={pts(moving, u)} />
    <line className="fold-line" x1={line[0][0] * u} y1={line[0][1] * u} x2={line[1][0] * u} y2={line[1][1] * u} />
    <line className="fold-arrow" x1={arrow[0][0] * u} y1={arrow[0][1] * u} x2={arrow[1][0] * u} y2={arrow[1][1] * u} markerEnd="url(#paper-arrowhead)" />
  </svg>;
}
// The fold steps, then the final packet with cuts (coloured), cut lines (dashed) or a printed letter.
export function CutSequence({ folds, cuts = [], cutLines = [], strokes = null }) {
  const steps = [];
  for (let i = 0; i < folds.length; i++) steps.push({ state: packetAfter(folds.slice(0, i)), kind: folds[i] });
  const packet = packetAfter(folds), u = 22;
  const what = cuts.length ? `${cuts.length} coloured part${cuts.length === 1 ? '' : 's'} cut away` : cutLines.length ? `${cutLines.length} dashed cut line${cutLines.length === 1 ? '' : 's'} across it` : strokes ? 'a letter printed on top' : 'nothing marked';
  return <div className="fold-sequence" role="img" aria-label={`${folds.length} fold${folds.length === 1 ? '' : 's'}: ${folds.map(k => FOLD_TEXT[k]).join(', then ')}. The folded packet has ${what}.`}>
    <svg width="0" height="0" aria-hidden="true"><defs><marker id="paper-arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" /></marker></defs></svg>
    {steps.map((step, i) => <React.Fragment key={i}><FoldStepFigure state={step.state} kind={step.kind} /><span className="fold-arrow-text" aria-hidden="true">→</span></React.Fragment>)}
    <svg className="cut-packet" viewBox={`-6 -6 ${packet.w * u + 12} ${packet.h * u + 12}`} width={packet.w * u + 12} height={packet.h * u + 12} aria-hidden="true">
      <polygon className="sheet" points={pts(packetOutline(packet), u)} />
      {cuts.map((c, i) => <polygon key={i} className="cut-away" points={pts(c.points, u)} />)}
      {cutLines.map((l, i) => <line key={`l${i}`} className="cut-line" x1={l[0][0] * u} y1={l[0][1] * u} x2={l[1][0] * u} y2={l[1][1] * u} />)}
      {strokes && strokes.map((st, i) => <polyline key={`s${i}`} className="printed-letter" points={pts(st, u)} />)}
    </svg>
  </div>;
}

// The opened sheet with its holes and notches. Pieces of one opening that meet on a crease are
// drawn without the line between them.
export function CutSheet({ shapes, compact = false }) {
  const u = compact ? 13 : 20, size = S * u;
  const edgeKey = (a, b) => [a, b].map(p => p.map(v => Math.round(v * 1e4)).join(',')).sort().join('|');
  const count = new Map();
  shapes.forEach(s => s.points.forEach((p, i) => { const k = edgeKey(p, s.points[(i + 1) % s.points.length]); count.set(k, (count.get(k) ?? 0) + 1); }));
  const onBorder = (a, b) => [0, 1].some(axis => [0, S].some(v => Math.abs(a[axis] - v) < 1e-6 && Math.abs(b[axis] - v) < 1e-6));
  return <svg className="cut-sheet" viewBox={`-2 -2 ${size + 4} ${size + 4}`} width={size + 4} height={size + 4} role="img" aria-label={`Opened sheet with ${shapes.length} cut piece${shapes.length === 1 ? '' : 's'}`}>
    <rect className="sheet" x="0" y="0" width={size} height={size} />
    {shapes.map((s, i) => <polygon key={i} className="cut-hole" points={pts(s.points, u)} />)}
    {shapes.flatMap((s, i) => s.points.map((p, j) => {
      const q = s.points[(j + 1) % s.points.length];
      if (count.get(edgeKey(p, q)) > 1 || onBorder(p, q)) return null;
      return <line key={`${i}.${j}`} className="cut-edge" x1={p[0] * u} y1={p[1] * u} x2={q[0] * u} y2={q[1] * u} />;
    }))}
  </svg>;
}

// Two-coloured sheet: the plan (which parts fold over) and the result seen from the front.
export function FlapPlan({ flaps }) {
  const u = 20, size = S * u, regions = [], lines = [];
  for (const f of flaps) {
    if (f.kind === 'strip') {
      const k = f.size;
      const r = { top: [[0, 0], [S, 0], [S, k], [0, k]], bottom: [[0, S - k], [S, S - k], [S, S], [0, S]], left: [[0, 0], [k, 0], [k, S], [0, S]], right: [[S - k, 0], [S, 0], [S, S], [S - k, S]] }[f.side];
      regions.push(r);
      lines.push({ top: [[0, k], [S, k]], bottom: [[0, S - k], [S, S - k]], left: [[k, 0], [k, S]], right: [[S - k, 0], [S - k, S]] }[f.side]);
    } else {
      const c = { 'top-left': [0, 0], 'top-right': [S, 0], 'bottom-right': [S, S], 'bottom-left': [0, S] }[f.corner], dx = c[0] === 0 ? 1 : -1, dy = c[1] === 0 ? 1 : -1, a = [c[0] + dx * f.size, c[1]], b = [c[0], c[1] + dy * f.size];
      regions.push([c, a, b]); lines.push([a, b]);
    }
  }
  return <svg className="flap-sheet" viewBox={`-2 -2 ${size + 4} ${size + 4}`} width={size + 4} height={size + 4} role="img" aria-label={`Square sheet with ${flaps.length} shaded part${flaps.length === 1 ? '' : 's'} to fold over along dashed lines`}>
    <defs><pattern id="flap-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" className="flap-hatch-line" /></pattern></defs>
    <rect className="flap-front" x="0" y="0" width={size} height={size} />
    {regions.map((r, i) => <polygon key={i} className="flap-to-fold" points={pts(r, u)} />)}
    {lines.map((l, i) => <line key={`l${i}`} className="fold-line" x1={l[0][0] * u} y1={l[0][1] * u} x2={l[1][0] * u} y2={l[1][1] * u} />)}
  </svg>;
}
export function FlapSheet({ outline, back, allFront = false, compact = false }) {
  const u = compact ? 13 : 20, size = S * u;
  return <svg className="flap-sheet" viewBox={`-2 -2 ${size + 4} ${size + 4}`} width={size + 4} height={size + 4} role="img" aria-label={`Folded sheet seen from the front, with ${back.length} folded part${back.length === 1 ? '' : 's'} showing ${allFront ? 'green' : 'orange'}`}>
    <defs><pattern id="back-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" className="back-hatch-line" /></pattern></defs>
    <polygon className="flap-front" points={pts(outline, u)} />
    {back.map((poly, i) => <React.Fragment key={i}>
      <polygon className={allFront ? 'flap-front' : 'flap-back'} points={pts(poly, u)} />
      {!allFront && <polygon className="flap-back-hatch" points={pts(poly, u)} />}
    </React.Fragment>)}
  </svg>;
}

// The opened sheet with its creases and a printed letter.
export function LetterSheet({ strokes, creases = [], compact = false }) {
  const u = compact ? 13 : 20, size = S * u, lines = [];
  for (let i = 0; i < creases.length; i++) {
    const packet = packetAfter(creases.slice(0, i)), { w, h } = packet, kind = creases[i];
    const line = kind === 'left' ? [[w / 2, 0], [w / 2, h]] : kind === 'up' ? [[0, h / 2], [w, h / 2]] : [[0, 0], [w, h]];
    for (const layer of packet.layers) lines.push(line.map(layer));
  }
  return <svg className="cut-sheet" viewBox={`-2 -2 ${size + 4} ${size + 4}`} width={size + 4} height={size + 4} role="img" aria-label="Opened sheet with creases and a letter">
    <rect className="sheet" x="0" y="0" width={size} height={size} />
    {lines.map((l, i) => <line key={i} className="crease" x1={l[0][0] * u} y1={l[0][1] * u} x2={l[1][0] * u} y2={l[1][1] * u} />)}
    {strokes.map((st, i) => <polyline key={`s${i}`} className="printed-letter" points={pts(st, u)} />)}
  </svg>;
}
