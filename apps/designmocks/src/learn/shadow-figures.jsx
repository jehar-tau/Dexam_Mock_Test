// Figures and the sun-table tool for shadows and light.
import { useState } from 'react';
import { COMPASS, compassName, footprint, opposite, shadowOf } from './shadows.js';

const INK = 'var(--ink, #1d1d1b)';
const pts = (poly, s, ox, oy) => poly.map(([x, y]) => `${(x - ox) * s},${(oy - y) * s}`).join(' ');
function bounds(polys, pad = 1) {
  const all = polys.flat();
  if (!all.length) return { x0: -3, x1: 3, y0: -3, y1: 3 };
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  return { x0: Math.floor(Math.min(...xs) - pad), x1: Math.ceil(Math.max(...xs) + pad), y0: Math.floor(Math.min(...ys) - pad), y1: Math.ceil(Math.max(...ys) + pad) };
}
function Arrow({ x1, y1, x2, y2, colour = INK, width = 1.6 }) {
  const a = Math.atan2(y2 - y1, x2 - x1), k = 6, head = [[x2, y2], [x2 - k * Math.cos(a - 0.45), y2 - k * Math.sin(a - 0.45)], [x2 - k * Math.cos(a + 0.45), y2 - k * Math.sin(a + 0.45)]];
  return <g><line x1={x1} y1={y1} x2={x2 - 3 * Math.cos(a)} y2={y2 - 3 * Math.sin(a)} stroke={colour} strokeWidth={width} /><polygon points={head.map(p => p.join(',')).join(' ')} fill={colour} /></g>;
}
function SunArrow({ azimuth, x, y, r = 18 }) {
  const a = (azimuth * Math.PI) / 180, sx = x + Math.sin(a) * r, sy = y - Math.cos(a) * r, ex = x - Math.sin(a) * r * 0.6, ey = y + Math.cos(a) * r * 0.6;
  return <g><Arrow x1={sx} y1={sy} x2={ex} y2={ey} /><circle cx={sx} cy={sy} r="6" fill="#f4c430" stroke={INK} strokeWidth="1.2" /></g>;
}
function Compass({ x, y }) {
  return <g><text x={x} y={y - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill={INK}>N</text><Arrow x1={x} y1={y + 8} x2={x} y2={y - 8} width={1.2} /></g>;
}

export function ShadowTop({ outlines = [], apexes = [], shadows = [], light = null, dashed = false, compassOnly = false, compact = false }) {
  if (compassOnly) {
    return <svg className="shadow-figure" viewBox="0 0 90 70" width="90" height="70" role="img" aria-label={`Compass, north up${light != null ? `, sun in the ${compassName(light)}` : ''}`}><Compass x={20} y={36} />{light != null && <SunArrow azimuth={light} x={60} y={36} r={22} />}</svg>;
  }
  const b = bounds([...outlines, ...shadows]), s = compact ? 14 : 20, w = (b.x1 - b.x0) * s, h = (b.y1 - b.y0) * s;
  const grid = [];
  for (let x = b.x0; x <= b.x1; x++) grid.push(<line key={`x${x}`} x1={(x - b.x0) * s} y1={0} x2={(x - b.x0) * s} y2={h} stroke="var(--line, #ddd)" strokeWidth="0.6" />);
  for (let y = b.y0; y <= b.y1; y++) grid.push(<line key={`y${y}`} x1={0} y1={(b.y1 - y) * s} x2={w} y2={(b.y1 - y) * s} stroke="var(--line, #ddd)" strokeWidth="0.6" />);
  const extra = light != null ? 46 : 0;
  return <svg className="shadow-figure" viewBox={`0 0 ${w + extra} ${Math.max(h, 60)}`} width={w + extra} height={Math.max(h, 60)} role="img" aria-label={`Top view, north up: ${outlines.length} object${outlines.length === 1 ? '' : 's'}${shadows.length ? ` with ${shadows.length} shadow${shadows.length === 1 ? '' : 's'}` : ''}${light != null ? `, sun in the ${compassName(light)}` : ''}`}>
    
    {grid}
    {shadows.map((p, i) => <polygon key={`s${i}`} points={pts(p, s, b.x0, b.y1)} fill="rgba(60,60,60,.42)" stroke="rgba(40,40,40,.6)" strokeWidth="1" />)}
    {outlines.map((p, i) => <polygon key={`o${i}`} points={pts(p, s, b.x0, b.y1)} fill={dashed ? 'none' : 'var(--paper, #fff)'} stroke={INK} strokeWidth="1.6" strokeDasharray={dashed ? '4 3' : undefined} />)}
    {apexes.map(([x, y], i) => <circle key={`a${i}`} cx={(x - b.x0) * s} cy={(b.y1 - y) * s} r="2.6" fill={INK} />)}
    {light != null && <><Compass x={w + 23} y={20} /><SunArrow azimuth={light} x={w + 23} y={Math.max(h, 60) - 22} r={16} /></>}
  </svg>;
}

export function ShadowSide({ objects = [], lamp = null }) {
  // Side view: ground line, objects as posts, rays from the sun (upper left) or the lamp.
  const s = 18, base = 150, maxH = Math.max(...objects.map(o => o.h ?? 0), lamp?.H ?? 0, 4);
  const sc = Math.min(s, 120 / maxH);
  const els = [];
  if (lamp) {
    const lx = 30, px = lx + lamp.D * sc, o = objects[0], tipX = lx + (lamp.D + (lamp.D * o.h) / (lamp.H - o.h)) * sc;
    els.push(<line key="pole" x1={lx} y1={base} x2={lx} y2={base - lamp.H * sc} stroke={INK} strokeWidth="3" />, <circle key="bulb" cx={lx} cy={base - lamp.H * sc} r="6" fill="#f4c430" stroke={INK} />,
      <line key="post" x1={px} y1={base} x2={px} y2={base - o.h * sc} stroke={INK} strokeWidth="3" />, <line key="ray" x1={lx} y1={base - lamp.H * sc} x2={tipX} y2={base} stroke="#d9a400" strokeDasharray="4 3" />,
      <text key="H" x={lx - 6} y={base - lamp.H * sc / 2} textAnchor="end" fontSize="11" fill={INK}>{lamp.H} m</text>, <text key="h" x={px + 5} y={base - o.h * sc / 2} fontSize="11" fill={INK}>{o.label}</text>,
      <text key="D" x={(lx + px) / 2} y={base + 14} textAnchor="middle" fontSize="11" fill={INK}>{lamp.D} m</text>, <text key="q" x={(px + tipX) / 2} y={base + 14} textAnchor="middle" fontSize="11" fill={INK}>?</text>);
    const w = tipX + 30;
    return <svg className="shadow-figure" viewBox={`0 0 ${w} ${base + 22}`} width={w} height={base + 22} role="img" aria-label={`Side view: a ${lamp.H} m lamp, a ${o.h} m post ${lamp.D} m away, and the post's shadow`}><line x1="0" y1={base} x2={w} y2={base} stroke={INK} />{els}</svg>;
  }
  let x = 20;
  objects.forEach((o, i) => {
    const hh = (o.h ?? (objects[0].h * (o.s / objects[0].s))) * sc, ss = (o.s ?? (objects[0].s * (o.h / objects[0].h))) * sc;
    els.push(<line key={`p${i}`} x1={x} y1={base} x2={x} y2={base - hh} stroke={INK} strokeWidth="3" />, <line key={`s${i}`} x1={x} y1={base} x2={x + ss} y2={base} stroke="rgba(40,40,40,.7)" strokeWidth="5" />, <line key={`r${i}`} x1={x} y1={base - hh} x2={x + ss} y2={base} stroke="#d9a400" strokeDasharray="4 3" />,
      <text key={`l${i}`} x={x - 5} y={base - hh / 2} textAnchor="end" fontSize="11" fill={INK}>{o.h != null ? `${o.h} m` : '?'}</text>, <text key={`t${i}`} x={x + ss / 2} y={base + 14} textAnchor="middle" fontSize="11" fill={INK}>{o.s != null ? `${o.s} m` : '?'}</text>);
    x += ss + 50;
  });
  return <svg className="shadow-figure" viewBox={`0 0 ${x} ${base + 22}`} width={x} height={base + 22} role="img" aria-label={`Side view of ${objects.length} objects and their shadows in the same sunlight`}><line x1="0" y1={base} x2={x} y2={base} stroke={INK} />{els}</svg>;
}

export function Walkers({ walkers = [] }) {
  const s = 26, ox = -3.6, oy = 2.2, w = 7.2 * s, h = 4.4 * s;
  const P = ([x, y]) => [(x - ox) * s, (oy - y) * s];
  return <svg className="shadow-figure" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Two walkers seen from above, north up, with their heading arrows and shadows">
    {walkers.map((wk, i) => { const [x, y] = P(wk.at), [sx, sy] = P(wk.shadow[1]), a = (wk.heading * Math.PI) / 180; return <g key={i}>
      <line x1={x} y1={y} x2={sx} y2={sy} stroke="rgba(40,40,40,.6)" strokeWidth="7" strokeLinecap="round" />
      <circle cx={x} cy={y} r="8" fill="var(--paper, #fff)" stroke={INK} strokeWidth="1.6" />
      <Arrow x1={x} y1={y} x2={x + Math.sin(a) * 20} y2={y - Math.cos(a) * 20} colour="var(--orange, #e2502b)" width={2} />
    </g>; })}
    <Compass x={w - 14} y={22} />
  </svg>;
}

export function Silhouette({ outline }) {
  const shape = { circle: <circle cx="50" cy="40" r="28" />, square: <rect x="22" y="12" width="56" height="56" />, rectangle: <rect x="12" y="20" width="76" height="40" />, triangle: <polygon points="50,10 82,68 18,68" />, hexagon: <polygon points="50,10 78,25 78,55 50,70 22,55 22,25" /> }[outline];
  return <svg className="shadow-figure" viewBox="0 0 100 80" width="100" height="80" role="img" aria-label={`A ${outline} shadow on a wall`}><rect x="0" y="0" width="100" height="80" fill="var(--paper, #fff)" stroke="var(--line, #ccc)" /><g fill="rgba(40,40,40,.75)">{shape}</g></svg>;
}

// ---------- tool ----------
const TOOL_SOLIDS = { box: 'Cube', cylinder: 'Cylinder', cone: 'Cone', pyramid: 'Pyramid' };
export function SunTable({ solid: initialSolid = 'box', azimuth: initialAz = 90 }) {
  const [solid, setSolid] = useState(initialSolid);
  const [az, setAz] = useState(initialAz);
  const [el, setEl] = useState(45);
  const s = { type: solid, at: [0, 0], size: 2, h: 2 };
  const light = { azimuth: az, elevation: el }, sh = shadowOf(s, light), len = 2 / Math.tan((el * Math.PI) / 180);
  return <div className="tool">
    <div className="icon-cluster" role="group" aria-label="Solid">{Object.entries(TOOL_SOLIDS).map(([k, label]) => <button key={k} type="button" className={`chip${solid === k ? ' is-active' : ''}`} aria-pressed={solid === k} onClick={() => setSolid(k)}>{label}</button>)}</div>
    <div className="icon-cluster" role="group" aria-label="Sun direction">{Object.entries(COMPASS).map(([name, a]) => <button key={name} type="button" className={`chip${az === a ? ' is-active' : ''}`} aria-pressed={az === a} onClick={() => setAz(a)}>{name}</button>)}</div>
    <div className="tool-stage"><ShadowTop outlines={[footprint(s)]} apexes={solid === 'cone' || solid === 'pyramid' ? [[0, 0]] : []} shadows={[sh]} light={az} /></div>
    <label className="slider"><span>Sun height</span><input type="range" min="15" max="75" step="5" value={el} onChange={e => setEl(Number(e.target.value))} aria-label="Sun height above the horizon, degrees" /></label>
    <p className="tool-status" role="status">{`Sun from the ${compassName(az)} at ${el}°. The ${TOOL_SOLIDS[solid].toLowerCase()} is 2 tall; its top lands ${len.toFixed(1)} away, towards the ${compassName(opposite(az))}.`}</p>
  </div>;
}
