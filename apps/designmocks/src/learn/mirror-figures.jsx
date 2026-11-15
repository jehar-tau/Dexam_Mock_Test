import React from 'react';
import { edgeSpots } from './mirror-exam.js';

// Figures for mirror-exam.js. Cells "x,y", y down.

// A two-tone pattern with mirror lines drawn beside it: on a side, or at 45° near a corner.
export function ToneGrid({ cells, n, lines = [], compact = false, label }) {
  const c = compact ? 11 : 20, size = n * c, pad = lines.length ? 30 : 4;
  const drawn = lines.map(({ at, label: text }) => {
    const L = { left: [[-10, -14], [-10, size + 14]], right: [[size + 10, -14], [size + 10, size + 14]], top: [[-14, -10], [size + 14, -10]], bottom: [[-14, size + 10], [size + 14, size + 10]], falling: [[size * 0.55, -26], [size + 26, size * 0.45]], rising: [[size * 0.55, size + 26], [size + 26, size * 0.55]] }[at];
    return { at, L, text };
  });
  const tones = Object.values(cells);
  return <svg className="tone-grid" viewBox={`${-pad} ${-pad} ${size + 2 * pad} ${size + 2 * pad}`} width={size + 2 * pad} height={size + 2 * pad} role="img"
    aria-label={label ?? `Pattern of ${tones.length} cells, ${tones.filter(t => t === 2).length} of them orange${lines.length ? `, with ${lines.length} mirror line${lines.length === 1 ? '' : 's'}` : ''}`}>
    <rect className="tone-frame" x="0" y="0" width={size} height={size} />
    {Object.entries(cells).map(([k, tone]) => { const [x, y] = k.split(',').map(Number); return <rect key={k} className={`tone-cell tone-${tone}`} x={x * c} y={y * c} width={c} height={c} />; })}
    {drawn.map(({ at, L, text }, i) => <g key={i}>
      <line className="mirror-line" x1={L[0][0]} y1={L[0][1]} x2={L[1][0]} y2={L[1][1]} />
      {text && (() => { const end = at === 'top' || at === 'bottom' ? L[1] : L[0], dx = at === 'top' || at === 'bottom' ? 6 : at === 'rising' ? -12 : 6, dy = at === 'top' || at === 'bottom' ? 4 : at === 'rising' ? 4 : -2; return <text className="mirror-label" x={end[0] + dx} y={end[1] + dy}>{text}</text>; })()}
    </g>)}
  </svg>;
}

// A plain clock face: ticks, no numerals, hour and minute hands.
export function ClockFace({ h, m, size = 150, label }) {
  const r = size / 2 - 6, centre = size / 2;
  const hand = (turns, length) => { const a = turns * 2 * Math.PI - Math.PI / 2; return [centre + length * Math.cos(a), centre + length * Math.sin(a)]; };
  const hour = hand(((h % 12) + m / 60) / 12, r * 0.5), minute = hand(m / 60, r * 0.8);
  return <svg className="clock-face" viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={label ?? 'A clock face with no numbers. Read the hands.'}>
    <circle className="clock-rim" cx={centre} cy={centre} r={r} />
    {Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * 2 * Math.PI, o = [centre + r * Math.cos(a), centre + r * Math.sin(a)], inner = [centre + (r - (i % 3 === 0 ? 12 : 6)) * Math.cos(a), centre + (r - (i % 3 === 0 ? 12 : 6)) * Math.sin(a)]; return <line key={i} className={`clock-tick${i % 3 === 0 ? ' is-major' : ''}`} x1={o[0]} y1={o[1]} x2={inner[0]} y2={inner[1]} />; })}
    <line className="clock-hand is-hour" x1={centre} y1={centre} x2={hour[0]} y2={hour[1]} />
    <line className="clock-hand" x1={centre} y1={centre} x2={minute[0]} y2={minute[1]} />
    <circle className="clock-pin" cx={centre} cy={centre} r="3.5" />
  </svg>;
}

// Two mirrors meeting at θ, the angle marked, an object between them; optional images as faint dots.
export function MirrorAngle({ theta, onBisector = false, images = null, size = 220 }) {
  const o = [size / 2, size / 2 + 40], R = size * 0.44, ray = a => [o[0] + R * Math.cos(-a), o[1] + R * Math.sin(-a)];
  const start = 90 - theta / 2, a1 = (start * Math.PI) / 180, a2 = ((start + theta) * Math.PI) / 180, p1 = ray(a1), p2 = ray(a2);
  const objAngle = onBisector ? (a1 + a2) / 2 : a1 + ((a2 - a1) * 0.3), obj = [o[0] + R * 0.55 * Math.cos(-objAngle), o[1] + R * 0.55 * Math.sin(-objAngle)];
  const arcR = 26, arc = [o[0] + arcR * Math.cos(-a1), o[1] + arcR * Math.sin(-a1), o[0] + arcR * Math.cos(-a2), o[1] + arcR * Math.sin(-a2)];
  return <svg className="mirror-angle" viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`Two mirrors meeting at ${theta} degrees, with an object ${onBisector ? 'exactly half way between them' : 'nearer one mirror'}${images ? ` and ${images.length} images around it` : ''}`}>
    {images && images.map((p, i) => <circle key={i} className="mirror-image-dot" cx={o[0] + R * 0.55 * Math.cos(-p)} cy={o[1] + R * 0.55 * Math.sin(-p)} r="5" />)}
    <line className="mirror-surface" x1={o[0]} y1={o[1]} x2={p1[0]} y2={p1[1]} />
    <line className="mirror-surface" x1={o[0]} y1={o[1]} x2={p2[0]} y2={p2[1]} />
    <path className="angle-arc" d={`M ${arc[0]} ${arc[1]} A ${arcR} ${arcR} 0 0 0 ${arc[2]} ${arc[3]}`} />
    <text className="angle-label" x={o[0]} y={o[1] - arcR - 6}>{`${theta}°`}</text>
    <circle className="mirror-object" cx={obj[0]} cy={obj[1]} r="6" />
  </svg>;
}

// A grid of two-sided mirrors with the ray's way in, numbered exits and, optionally, the traced path.
export function RayGrid({ n, mirrors, start, labels = [], path = null, compact = false }) {
  const c = compact ? 18 : 32, size = n * c, pad = c;
  const centre = (x, y) => [(x + 0.5) * c, (y + 0.5) * c];
  const arrowTip = centre(start.x + start.d[0] * 0.55, start.y + start.d[1] * 0.55), arrowTail = centre(start.x - start.d[0] * 0.2, start.y - start.d[1] * 0.2);
  return <svg className="ray-grid" viewBox={`${-pad} ${-pad} ${size + 2 * pad} ${size + 2 * pad}`} width={size + 2 * pad} height={size + 2 * pad} role="img" aria-label={`A ${n} by ${n} grid with ${Object.keys(mirrors).length} mirrors and a ray entering at the arrow`}>
    <defs><marker id="ray-head" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" /></marker></defs>
    <rect className="ray-frame" x="0" y="0" width={size} height={size} />
    {Array.from({ length: n - 1 }, (_, i) => <React.Fragment key={i}><line className="ray-gridline" x1={(i + 1) * c} y1="0" x2={(i + 1) * c} y2={size} /><line className="ray-gridline" x1="0" y1={(i + 1) * c} x2={size} y2={(i + 1) * c} /></React.Fragment>)}
    {Object.entries(mirrors).map(([k, m]) => { const [x, y] = k.split(',').map(Number), inset = c * 0.15; return m === '/' ? <line key={k} className="ray-mirror" x1={x * c + inset} y1={(y + 1) * c - inset} x2={(x + 1) * c - inset} y2={y * c + inset} /> : <line key={k} className="ray-mirror" x1={x * c + inset} y1={y * c + inset} x2={(x + 1) * c - inset} y2={(y + 1) * c - inset} />; })}
    {path && <polyline className="ray-path" points={path.map(([x, y]) => centre(x, y).join(',')).join(' ')} />}
    <line className="ray-arrow" x1={arrowTail[0]} y1={arrowTail[1]} x2={arrowTip[0]} y2={arrowTip[1]} markerEnd="url(#ray-head)" />
    {labels.map(({ spot, text }) => { const [x, y] = centre(spot.x, spot.y); return <g key={text}><circle className="ray-exit" cx={x} cy={y} r={c * 0.3} /><text className="ray-exit-label" x={x} y={y + 4}>{text}</text></g>; })}
  </svg>;
}
export { edgeSpots };
