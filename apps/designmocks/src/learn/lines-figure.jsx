import React from 'react';
import { bounds } from './figure-count.js';

// A figure of straight lines from figure-count.js. Screen coordinates, y down.
// ghost: pieces that were rubbed out, drawn dotted. mirrors: dashed lines to
// reflect in, numbered when there are two. highlight: one shape to fill.
export function LinesFigure({ segments, ghost = [], mirrors = [], highlight = null, compact = false, label, unit = null }) {
  const b = bounds([...segments, ...ghost]);
  const w = b.maxX - b.minX || 1, h = b.maxY - b.minY || 1;
  // unit: a fixed size per grid step, so figures meant to be compared are drawn to one scale.
  const s = unit ? unit : Math.min((compact ? 150 : 300) / w, (compact ? 120 : 260) / h, compact ? 30 : 56);
  const pad = mirrors.length ? 40 : 8;
  const at = ([x, y]) => [((x - b.minX) * s).toFixed(1), ((y - b.minY) * s).toFixed(1)];
  const line = ([p, q], className, key) => { const a = at(p), c = at(q); return <line key={key} className={className} x1={a[0]} y1={a[1]} x2={c[0]} y2={c[1]} />; };
  return <svg className={`lines-figure${compact ? ' compact' : ''}`} viewBox={`${-pad} ${-pad} ${w * s + 2 * pad} ${h * s + 2 * pad}`} width={w * s + 2 * pad} height={h * s + 2 * pad} role="img"
    aria-label={label ?? `A figure drawn with ${segments.length} straight lines${ghost.length ? `, with ${ghost.length} short ${ghost.length === 1 ? 'piece' : 'pieces'} rubbed out` : ''}${mirrors.length ? `, and ${mirrors.length} dashed mirror ${mirrors.length === 1 ? 'line' : 'lines'}` : ''}`}>
    {highlight && <polygon className="lines-highlight" points={highlight.map(p => at(p).join(',')).join(' ')} />}
    {segments.map((sg, i) => line(sg, 'lines-stroke', `s${i}`))}
    {ghost.map((sg, i) => line(sg, 'lines-ghost', `g${i}`))}
    {mirrors.map((m, i) => {
      const from = m.axis === 'x' ? [m.at, b.minY] : [b.minX, m.at], to = m.axis === 'x' ? [m.at, b.maxY] : [b.maxX, m.at], a = at(from), c = at(to);
      const ex = m.axis === 'x' ? [0, 32] : [32, 0];
      return <g key={`m${i}`}>
        <line className="lines-mirror" x1={a[0] - ex[0]} y1={a[1] - ex[1]} x2={Number(c[0]) + ex[0]} y2={Number(c[1]) + ex[1]} />
        <text className="lines-mirror-label" x={Number(c[0]) + (m.axis === 'x' ? 0 : 32)} y={Number(c[1]) + (m.axis === 'x' ? 32 : 0)} dx={m.axis === 'x' ? 9 : 0} dy={m.axis === 'x' ? 0 : -6}>{mirrors.length > 1 ? `mirror ${i + 1}` : 'mirror'}</text>
      </g>;
    })}
  </svg>;
}
