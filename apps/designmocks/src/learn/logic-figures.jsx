import React from 'react';

// Figures for logic.js.

// Four numbers on the corners of a diamond, top, left, bottom and right, with one in the middle.
export function NumberDiamond({ outer, centre, compact = false }) {
  const s = compact ? 84 : 110, h = s / 2, [top, left, bottom, right] = outer;
  return <svg className="number-diamond" viewBox={`0 0 ${s} ${s}`} width={s} height={s} role="img" aria-label={`Diamond: top ${top}, left ${left}, bottom ${bottom}, right ${right}, middle ${centre === '?' ? 'unknown' : centre}`}>
    <polygon className="diamond-shape" points={`${h},3 ${s - 3},${h} ${h},${s - 3} 3,${h}`} />
    <line className="diamond-cross" x1={h} y1="3" x2={h} y2={s - 3} /><line className="diamond-cross" x1="3" y1={h} x2={s - 3} y2={h} />
    <text className="diamond-num" x={h} y={s * 0.22}>{top}</text>
    <text className="diamond-num" x={s * 0.2} y={h + 5}>{left}</text>
    <text className="diamond-num" x={h} y={s * 0.86}>{bottom}</text>
    <text className="diamond-num" x={s * 0.8} y={h + 5}>{right}</text>
    <circle className="diamond-centre" cx={h} cy={h} r={s * 0.13} />
    <text className={`diamond-num is-centre${centre === '?' ? ' is-ask' : ''}`} x={h} y={h + 5}>{centre}</text>
  </svg>;
}

// Rooms on a grid; a wall between two rooms has a gap where there is an opening.
export function MazeFigure({ n, m, open, from, to, compact = false }) {
  const c = compact ? 28 : 46, w = n * c, h = m * c, gap = c * 0.38, openSet = new Set(open), walls = [];
  for (let x = 0; x < n; x++) for (let y = 0; y < m; y++) {
    if (x + 1 < n) { const k = [`${x},${y}`, `${x + 1},${y}`].sort().join('|'), X = (x + 1) * c; walls.push(openSet.has(k) ? [[X, y * c, X, y * c + (c - gap) / 2], [X, y * c + (c + gap) / 2, X, (y + 1) * c]] : [[X, y * c, X, (y + 1) * c]]); }
    if (y + 1 < m) { const k = [`${x},${y}`, `${x},${y + 1}`].sort().join('|'), Y = (y + 1) * c; walls.push(openSet.has(k) ? [[x * c, Y, x * c + (c - gap) / 2, Y], [x * c + (c + gap) / 2, Y, (x + 1) * c, Y]] : [[x * c, Y, (x + 1) * c, Y]]); }
  }
  const at = k => { const [x, y] = k.split(',').map(Number); return [(x + 0.5) * c, (y + 0.5) * c + 5]; };
  return <svg className="maze-figure" viewBox={`-3 -3 ${w + 6} ${h + 6}`} width={w + 6} height={h + 6} role="img" aria-label={`Plan of ${n * m} rooms in ${m} rows of ${n}, with openings in some walls. R is Riya's room and B is the room to reach.`}>
    <rect className="maze-floor" x="0" y="0" width={w} height={h} />
    {walls.flat().map((l, i) => <line key={i} className="maze-wall" x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} />)}
    <rect className="maze-border" x="0" y="0" width={w} height={h} />
    <text className="maze-mark" x={at(from)[0]} y={at(from)[1]}>R</text>
    <text className="maze-mark" x={at(to)[0]} y={at(to)[1]}>B</text>
  </svg>;
}
