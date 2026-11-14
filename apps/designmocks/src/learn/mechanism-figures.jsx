import React from 'react';
import { CW, mobileWeight, ropePath, solve } from './gears.js';

// Figures for gears.js. Screen coordinates throughout: y runs down, a
// positive rotation is clockwise.

// ---------- gears and belts ----------
const TOOTH = 0.3; // how far a tooth stands above and below the pitch circle, in layout units
function gearOutline(r, teeth, s) {
  const p = (2 * Math.PI) / teeth, points = [];
  for (let k = 0; k < teeth; k++) {
    for (const [radius, at] of [[r - TOOTH, -0.3], [r + TOOTH, -0.16], [r + TOOTH, 0.16], [r - TOOTH, 0.3]]) {
      const a = (k + at) * p;
      points.push(`${(radius * s * Math.cos(a)).toFixed(1)},${(radius * s * Math.sin(a)).toFixed(1)}`);
    }
  }
  return points.join(' ');
}
const teethOf = wheel => Math.max(6, Math.round(wheel.r * 4));
// Starting angle of each gear so that teeth sit in the gaps of the gear they mesh with.
function phases(system) {
  const phase = system.wheels.map(() => null);
  phase[system.driver] = 0;
  const queue = [system.driver];
  while (queue.length) {
    const a = queue.shift();
    for (const link of system.links) {
      if (link.a !== a && link.b !== a) continue;
      const b = link.a === a ? link.b : link.a;
      if (phase[b] !== null) continue;
      if (link.type === 'mesh') {
        const A = system.wheels[a], B = system.wheels[b], contact = Math.atan2(B.y - A.y, B.x - A.x);
        const u = ((contact - phase[a]) * teethOf(A)) / (2 * Math.PI);
        phase[b] = contact + Math.PI - ((2 * Math.PI) / teethOf(B)) * (0.5 - u);
      } else phase[b] = link.type === 'shaft' ? phase[a] : 0;
      queue.push(b);
    }
  }
  return phase.map(v => v ?? 0);
}
// The two straight runs of a belt between wheels a and b.
function beltLines(a, b, crossed) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), lines = [];
  for (const side of [1, -1]) {
    const sb = crossed ? -side : side, k = sb * b.r - side * a.r;
    if (Math.abs(k) >= L) continue;
    const beta = Math.atan2(dy, dx) - Math.asin(k / L), ux = Math.cos(beta), uy = Math.sin(beta);
    lines.push([[a.x + side * a.r * uy, a.y - side * a.r * ux], [b.x + sb * b.r * uy, b.y - sb * b.r * ux]]);
  }
  return lines;
}
// A curved arrow beside a wheel showing which way it turns.
function TurnArrow({ r, dir, s, mid = -Math.PI / 2, className = 'turn-arrow' }) {
  const R = (r + 0.95) * s, from = mid - (35 * Math.PI) / 180, to = mid + (35 * Math.PI) / 180;
  const start = dir === CW ? from : to, end = dir === CW ? to : from;
  const tip = [R * Math.cos(end), R * Math.sin(end)], along = dir === CW ? end + Math.PI / 2 : end - Math.PI / 2, h = Math.max(5, s * 0.55);
  const wing = side => [tip[0] - h * Math.cos(along) + side * h * 0.6 * Math.cos(end), tip[1] - h * Math.sin(along) + side * h * 0.6 * Math.sin(end)];
  return <g className={className}>
    <path d={`M ${(R * Math.cos(start)).toFixed(1)} ${(R * Math.sin(start)).toFixed(1)} A ${R.toFixed(1)} ${R.toFixed(1)} 0 0 ${dir === CW ? 1 : 0} ${tip[0].toFixed(1)} ${tip[1].toFixed(1)}`} />
    <polygon points={[tip, wing(1), wing(-1)].map(q => q.map(v => v.toFixed(1)).join(',')).join(' ')} />
  </g>;
}

// options: showSizes (number under each letter), arrows ('driver' | 'all' | 'none'), animate, marks, plain (no letters), compact.
export function GearsFigure({ system, showSizes = false, arrows = 'driver', animate = false, marks = false, plain = false, compact = false, caption = null, showLocked = false, label }) {
  const result = solve(system), phase = phases(system);
  const reach = w => w.r + (w.toothed ? TOOTH : 0) + 1.6;
  const minX = Math.min(...system.wheels.map(w => w.x - reach(w))), maxX = Math.max(...system.wheels.map(w => w.x + reach(w)));
  const minY = Math.min(...system.wheels.map(w => w.y - reach(w))), maxY = Math.max(...system.wheels.map(w => w.y + reach(w)));
  const s = Math.min((compact ? 230 : 520) / (maxX - minX), (compact ? 150 : 300) / (maxY - minY), compact ? 9 : 15);
  const planes = [...new Set(system.wheels.map(w => w.plane ?? 0))].sort((a, b) => a - b);
  const sharesShaft = i => system.wheels.findIndex((w, j) => j !== i && w.x === system.wheels[i].x && w.y === system.wheels[i].y);
  const labelSpot = i => {
    const w = system.wheels[i], partner = sharesShaft(i);
    if (partner < 0 || system.wheels[partner].r > w.r) return [0, 0];
    // The larger wheel of a shaft pair: put its letter in the ring that shows round the smaller one, away from its neighbours.
    const ringR = (w.r + system.wheels[partner].r) / 2;
    const others = system.wheels.filter((o, j) => j !== i && j !== partner);
    let best = [0, -ringR], bestGap = -1;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4, spot = [ringR * Math.cos(a), ringR * Math.sin(a)];
      const gap = Math.min(...others.map(o => Math.hypot(w.x + spot[0] - o.x, w.y + spot[1] - o.y) - o.r), 99);
      if (gap > bestGap) { bestGap = gap; best = spot; }
    }
    return best;
  };
  // Put each direction arrow on the side of its wheel that is furthest from the other wheels.
  const arrowSpot = i => {
    const w = system.wheels[i];
    let best = -Math.PI / 2, bestGap = -Infinity;
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 4, x = w.x + (w.r + 1.2) * Math.cos(a), y = w.y + (w.r + 1.2) * Math.sin(a);
      const gap = Math.min(...system.wheels.filter((o, j) => j !== i && (o.x !== w.x || o.y !== w.y)).map(o => Math.hypot(x - o.x, y - o.y) - o.r), 50) - (k ? 0.01 * k : 0);
      if (gap > bestGap) { bestGap = gap; best = a; }
    }
    return best;
  };
  const driverSpeed = result.speed[system.driver];
  const turnsPerSecond = i => { const f = result.speed[i]; return f ? (f.n * driverSpeed.d) / (f.d * driverSpeed.n) : 0; };
  const text = label ?? `${system.wheels.length} wheels: ${system.links.map(l => `${system.wheels[l.a].id} ${{ mesh: 'meshes with', shaft: 'on one shaft with', open: 'open belt to', crossed: 'crossed belt to' }[l.type]} ${system.wheels[l.b].id}`).join(', ')}`;
  return <figure className={`gears-figure${compact ? ' compact' : ''}`}>
    <svg viewBox={`${(minX * s).toFixed(1)} ${(minY * s).toFixed(1)} ${((maxX - minX) * s).toFixed(1)} ${((maxY - minY) * s).toFixed(1)}`} width={(maxX - minX) * s} height={(maxY - minY) * s} role="img" aria-label={text}>
      {planes.map(plane => <g key={plane}>
        {system.wheels.map((w, i) => (w.plane ?? 0) !== plane ? null : <g key={w.id} transform={`translate(${(w.x * s).toFixed(1)} ${(w.y * s).toFixed(1)})`}>
          <g className={animate && !result.locked ? 'gear-spin' : undefined} style={animate && !result.locked ? { animationDuration: `${(8 / turnsPerSecond(i)).toFixed(2)}s`, animationDirection: result.dir[i] === CW ? 'normal' : 'reverse' } : undefined}>
            <g transform={`rotate(${((phase[i] * 180) / Math.PI).toFixed(2)})`}>
              {w.toothed ? <polygon className={`gear-body plane-${Math.min(plane, 2)}${result.locked && showLocked ? ' is-locked' : ''}`} points={gearOutline(w.r, teethOf(w), s)} />
                : <circle className={`gear-body is-pulley plane-${Math.min(plane, 2)}`} r={w.r * s} />}
              {!w.toothed && <circle className="pulley-groove" r={Math.max(1, (w.r - 0.35) * s)} />}
              <line className="gear-spoke" x1={0} y1={0} x2={(w.r - (w.toothed ? 0.55 : 0.5)) * s} y2={0} />
              {marks && <polygon className="gear-mark" points={(() => {
                // A mark at the tooth that touches the other gear at the start.
                const other = system.wheels[1 - i], a = Math.atan2(other.y - w.y, other.x - w.x) - phase[i], R = (w.r - 0.75) * s, q = (da, dr) => `${((R + dr) * Math.cos(a + da)).toFixed(1)},${((R + dr) * Math.sin(a + da)).toFixed(1)}`;
                return [q(0, 0.45 * s), q(0.16 * (4 / w.r), -0.35 * s), q(-0.16 * (4 / w.r), -0.35 * s)].join(' ');
              })()} />}
            </g>
          </g>
          <circle className="gear-hub" r={Math.max(1.6, s * 0.16)} />
          {(arrows === 'all' || (arrows === 'driver' && i === system.driver)) && (!result.locked || (!showLocked && i === system.driver)) && <TurnArrow r={w.r + (w.toothed ? TOOTH : 0)} dir={result.dir[i]} s={s} mid={arrowSpot(i)} className={`turn-arrow${i === system.driver ? ' is-driver' : ''}`} />}
        </g>)}
        {system.links.filter(l => l.type !== 'mesh' && l.type !== 'shaft' && (system.wheels[l.a].plane ?? 0) === plane).flatMap((l, k) => beltLines(system.wheels[l.a], system.wheels[l.b], l.type === 'crossed').map((line, j) =>
          <line key={`${k}.${j}`} className="belt" x1={(line[0][0] * s).toFixed(1)} y1={(line[0][1] * s).toFixed(1)} x2={(line[1][0] * s).toFixed(1)} y2={(line[1][1] * s).toFixed(1)} />))}
      </g>)}
      {!plain && system.wheels.map((w, i) => {
        const [dx, dy] = labelSpot(i), small = w.r * s < 15;
        return <g key={w.id} className="gear-label" transform={`translate(${((w.x + dx) * s).toFixed(1)} ${((w.y + dy) * s).toFixed(1)})`}>
          <circle r={small ? 6.5 : 8.5} />
          <text y={small ? 3.2 : 4}>{w.id}</text>
          {showSizes && w.r * s >= 22 && dx === 0 && dy === 0 && <text className="gear-size" y={19}>{w.size}</text>}
        </g>;
      })}
    </svg>
    {caption && <figcaption>{cap(caption)}.</figcaption>}
  </figure>;
}
const cap = text => text.charAt(0).toUpperCase() + text.slice(1);

// ---------- a rope over pulleys ----------
export function RopeFigure({ rope, towardsPull = true, showDirections = false, compact = false }) {
  const path = ropePath(rope);
  const xs = [rope.weight.x - 1.2, rope.pull.x + 1.4, ...rope.pulleys.flatMap(p => [p.x - p.r - 0.4, p.x + p.r + 0.4])], ys = [rope.weight.y + 1.6, rope.pull.y + 1.2, ...rope.pulleys.flatMap(p => [p.y - p.r - 0.4, p.y + p.r + 0.4])];
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.min((compact ? 250 : 560) / (maxX - minX), (compact ? 160 : 320) / (maxY - minY), 24);
  const at = q => `${(q[0] * s).toFixed(1)} ${(q[1] * s).toFixed(1)}`;
  let d = '';
  if (path) {
    d = `M ${at(path.pieces[0].from)} L ${at(path.pieces[0].to)}`;
    rope.pulleys.forEach((p, i) => { d += ` A ${(p.r * s).toFixed(1)} ${(p.r * s).toFixed(1)} 0 ${path.wraps[i] > Math.PI ? 1 : 0} ${p.side === 1 ? 1 : 0} ${at(path.pieces[i + 1].from)} L ${at(path.pieces[i + 1].to)}`; });
  }
  const last = path ? path.pieces[path.pieces.length - 1] : { u: [1, 0], to: [rope.pull.x, rope.pull.y] };
  const u = towardsPull ? last.u : last.u.map(v => -v), tip = [last.to[0] + u[0] * 0.9, last.to[1] + u[1] * 0.9];
  const head = [[tip[0], tip[1]], [tip[0] - u[0] * 0.6 - u[1] * 0.32, tip[1] - u[1] * 0.6 + u[0] * 0.32], [tip[0] - u[0] * 0.6 + u[1] * 0.32, tip[1] - u[1] * 0.6 - u[0] * 0.32]];
  return <figure className="gears-figure is-wide" tabIndex={0}>
    <svg viewBox={`${(minX * s).toFixed(1)} ${(minY * s).toFixed(1)} ${((maxX - minX) * s).toFixed(1)} ${((maxY - minY) * s).toFixed(1)}`} width={(maxX - minX) * s} height={(maxY - minY) * s} role="img" aria-label={`A rope from a weight past ${rope.pulleys.length} pulleys, ${rope.pulleys.map(p => p.id).join(', ')}, to an end marked with an arrow`}>
      {rope.pulleys.map(p => <g key={p.id} transform={`translate(${at([p.x, p.y])})`}>
        <circle className="gear-body is-pulley plane-0" r={p.r * s} />
        <circle className="gear-hub" r={2} />
        {showDirections && <TurnArrow r={p.r - 1.5} dir={p.side * (towardsPull ? 1 : -1)} s={s} />}
      </g>)}
      <path className="rope" d={d} />
      <rect className="rope-weight" x={(rope.weight.x - 0.55) * s} y={rope.weight.y * s} width={1.1 * s} height={1.1 * s} rx={2} />
      <line className="rope" x1={last.to[0] * s} y1={last.to[1] * s} x2={tip[0] * s} y2={tip[1] * s} />
      <polygon className="rope-arrow" points={head.map(q => q.map(v => (v * s).toFixed(1)).join(',')).join(' ')} />
      {rope.pulleys.map(p => <g key={p.id} className="gear-label" transform={`translate(${at([p.x, p.y])})`}><circle r={7.5} /><text y={3.6}>{p.id}</text></g>)}
    </svg>
  </figure>;
}

// ---------- a beam on a pivot ----------
export function BeamFigure({ beam, ask = null, tilt = 0, compact = false }) {
  const u = compact ? 20 : Math.min(38, 480 / beam.length), w = beam.length * u, pad = 26, drop = 34;
  return <figure className="gears-figure">
    <svg viewBox={`${-pad} -30 ${w + 2 * pad} ${drop + 96}`} width={w + 2 * pad} height={drop + 96} role="img" aria-label={`A beam ${beam.length} units long on a pivot ${beam.pivot} units from the left end. ${beam.loads.map(l => `${l.label}${l.hidden ? '' : `, ${l.weight} kilograms,`} hangs ${Math.abs(l.at - beam.pivot)} units to the ${l.at < beam.pivot ? 'left' : 'right'} of the pivot`).join('. ')}.`}>
      <g transform={`rotate(${tilt} ${beam.pivot * u} 0)`}>
        <rect className="beam" x={0} y={-5} width={w} height={10} rx={2} />
        {Array.from({ length: beam.length + 1 }, (_, i) => <line key={i} className="beam-tick" x1={i * u} y1={-5} x2={i * u} y2={i === beam.pivot ? -14 : -10} />)}
        {beam.loads.map(l => <g key={`load-${l.at}-${l.label}`} transform={`translate(${l.at * u} 5)`}>
          <line className="string" x1={0} y1={0} x2={0} y2={drop} />
          <rect className={`beam-load${l.hidden ? ' is-unknown' : ''}`} x={-17} y={drop} width={34} height={30} rx={4} />
          <text className="beam-load-name" y={drop + 13}>{l.label}</text>
          <text className="beam-load-weight" y={drop + 25}>{l.hidden ? '?' : `${l.weight} kg`}</text>
        </g>)}
      </g>
      <polygon className="pivot" points={`${beam.pivot * u},5 ${beam.pivot * u - 13},${drop + 44} ${beam.pivot * u + 13},${drop + 44}`} />
      <line className="ground" x1={-pad + 6} y1={drop + 44} x2={w + pad - 6} y2={drop + 44} />
      {ask && <text className="beam-note" x={w / 2} y={drop + 62}>{`${ask.label} (${ask.weight} kg) hangs on the right. How far out?`}</text>}
    </svg>
  </figure>;
}

// ---------- a hanging mobile ----------
export function MobileFigure({ mobile, known = null }) {
  const parts = [];
  let minX = 0, maxX = 0, maxY = 0;
  const see = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
  (function draw(node, x, y, unit, depth) {
    const left = x - node.a * unit, right = x + node.b * unit;
    parts.push(<line key={`s${parts.length}`} className="mobile-stick" x1={left} y1={y} x2={right} y2={y} />);
    for (let i = -node.a; i <= node.b; i++) parts.push(<line key={`t${parts.length}`} className="beam-tick" x1={x + i * unit} y1={y - (i === 0 ? 7 : 4)} x2={x + i * unit} y2={y + 4} />);
    see(left - 24, y); see(right + 24, y);
    [[node.left, left], [node.right, right]].forEach(([child, cx]) => {
      if (child.weight !== undefined) {
        const [name, colour] = child.name, cy = y + 30;
        parts.push(<line key={`l${parts.length}`} className="string" x1={cx} y1={y} x2={cx} y2={cy - 11} />);
        parts.push(<circle key={`w${parts.length}`} className="mobile-weight" cx={cx} cy={cy} r={11} style={{ fill: colour }} />);
        parts.push(<text key={`n${parts.length}`} className="mobile-name" x={cx} y={cy + 25}>{name === known ? `${name} ${child.weight} g` : name}</text>);
        see(cx, cy + 30);
      } else {
        const below = y + 62;
        parts.push(<line key={`l${parts.length}`} className="string" x1={cx} y1={y} x2={cx} y2={below} />);
        draw(child, cx, below, unit * 0.8, depth + 1);
      }
    });
  })(mobile, 0, 22, 34, 0);
  return <figure className="gears-figure">
    <svg viewBox={`${minX - 8} -6 ${maxX - minX + 16} ${maxY + 14}`} width={maxX - minX + 16} height={maxY + 20} role="img" aria-label={`A hanging mobile of ${mobileDescription(mobile)}. Total weight not given.`}>
      <line className="string" x1={0} y1={-6} x2={0} y2={22} />
      {parts}
    </svg>
  </figure>;
}
function mobileDescription(node) {
  if (node.weight !== undefined) return `the ${node.name[0]} weight`;
  return `a stick with ${mobileDescription(node.left)} ${node.a} ${node.a === 1 ? 'unit' : 'units'} to the left of its string and ${mobileDescription(node.right)} ${node.b} ${node.b === 1 ? 'unit' : 'units'} to the right`;
}
export const mobileTotal = mobileWeight;
