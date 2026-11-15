// Figures for more machines: lever line, pulley block, pinned frame,
// standing block, and coins rolling.
const INK = 'var(--ink, #1d1d1b)';
const ACCENT = 'var(--orange, #e2502b)';
const NAME = { F: 'pivot', L: 'load', E: 'effort' };

export function LeverLine({ order = ['F', 'L', 'E'], arms = null }) {
  const xs = [30, 130, 230];
  const at = id => xs[order.indexOf(id)];
  return <svg className="machine-figure" viewBox="0 0 260 110" width="260" height="110" role="img" aria-label={`A lever: ${order.map(id => NAME[id]).join(', then ')}, from left to right`}>
    <rect x="14" y="52" width="232" height="8" rx="3" fill="#c9a46b" stroke={INK} />
    <polygon points={`${at('F') - 14},84 ${at('F') + 14},84 ${at('F')},60`} fill="#888" stroke={INK} />
    <rect x={at('L') - 16} y="22" width="32" height="30" fill="#7aa7d1" stroke={INK} />
    <line x1={at('E')} y1="6" x2={at('E')} y2="46" stroke={ACCENT} strokeWidth="3" /><polygon points={`${at('E') - 7},40 ${at('E') + 7},40 ${at('E')},52`} fill={ACCENT} />
    {order.map(id => <text key={id} x={at(id)} y="102" textAnchor="middle" fontSize="13" fontWeight="700" fill={INK}>{id}</text>)}
    {arms && <text x="130" y="16" textAnchor="middle" fontSize="11" fill={INK}>{`load ${arms.load} m from F, effort ${arms.effort} m from F`}</text>}
  </svg>;
}

export function PulleyBlock({ strands = 3 }) {
  const topWheels = Math.ceil(strands / 2), botWheels = Math.floor(strands / 2) || 1, w = 220, top = 30, bot = 150;
  const xs = Array.from({ length: strands + 1 }, (_, i) => 50 + i * 26);
  const bx = Math.min(xs[0] - 14, (xs[0] + xs[strands - 1]) / 2 - 36), bw = Math.max(xs[strands - 1] - xs[0] + 28, 72);
  const lines = [];
  for (let i = 0; i < strands; i++) lines.push(<line key={i} x1={xs[i]} y1={top + 14} x2={xs[i]} y2={bot - 10} stroke={INK} strokeWidth="2" />);
  return <svg className="machine-figure" viewBox={`0 0 ${w} 220`} width={w} height="220" role="img" aria-label={`A pulley system: ${strands} rope strands hold up the bottom block and its load; the free end comes down on the right`}>
    <rect x="20" y="4" width={w - 40} height="10" fill="#999" />
    <rect x={bx} y={top} width={bw} height="22" rx="10" fill="#ddd" stroke={INK} />
    <text x={(xs[0] + xs[strands - 1]) / 2} y={top + 15} textAnchor="middle" fontSize="10" fill={INK}>{topWheels} wheel{topWheels > 1 ? 's' : ''}</text>
    {lines}
    <line x1={bx + bw + 10} y1={top + 11} x2={bx + bw + 10} y2="200" stroke={ACCENT} strokeWidth="2.4" />
    <text x={bx + bw + 15} y="196" fontSize="11" fill={ACCENT}>pull</text>
    <rect x={bx} y={bot - 12} width={bw} height="22" rx="10" fill="#ddd" stroke={INK} />
    <text x={(xs[0] + xs[strands - 1]) / 2} y={bot + 3} textAnchor="middle" fontSize="10" fill={INK}>{botWheels} wheel{botWheels > 1 ? 's' : ''}</text>
    <rect x={(xs[0] + xs[strands - 1]) / 2 - 22} y={bot + 18} width="44" height="30" fill="#7aa7d1" stroke={INK} />
    <line x1={(xs[0] + xs[strands - 1]) / 2} y1={bot + 10} x2={(xs[0] + xs[strands - 1]) / 2} y2={bot + 18} stroke={INK} strokeWidth="2" />
    <text x={(xs[0] + xs[strands - 1]) / 2} y={bot + 37} textAnchor="middle" fontSize="11" fill={INK}>load</text>
  </svg>;
}

export function Frame({ points = [], bars = [], compact = false }) {
  const s = compact ? 22 : 30, P = ([x, y]) => [x * s + 6, (5 - y) * s + 6], w = 5 * s + 12;
  return <svg className="machine-figure" viewBox={`0 0 ${w} ${w}`} width={w} height={w} role="img" aria-label={`A frame of ${bars.length} bars pinned at ${points.length} joints`}>
    {bars.map(([i, j], k) => { const [a, b] = [P(points[i]), P(points[j])]; return <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#8a6a3a" strokeWidth="4" strokeLinecap="round" />; })}
    {points.map((p, i) => { const [x, y] = P(p); return <circle key={i} cx={x} cy={y} r="4" fill="#fff" stroke={INK} strokeWidth="1.6" />; })}
  </svg>;
}

export function Standing({ poly = [], compact = false }) {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]), x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y1 = Math.max(...ys) + 0.5, s = compact ? 18 : 24;
  const P = ([x, y]) => `${(x - x0) * s},${(y1 - y) * s}`;
  const w = (x1 - x0) * s, h = y1 * s + 10;
  return <svg className="machine-figure" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="A solid block standing on the ground">
    <polygon points={poly.map(P).join(' ')} fill="#c9a46b" stroke={INK} strokeWidth="1.6" />
    <line x1="0" y1={y1 * s} x2={w} y2={y1 * s} stroke={INK} strokeWidth="2" />
    {Array.from({ length: Math.ceil(w / 10) }, (_, i) => <line key={i} x1={i * 10} y1={y1 * s} x2={i * 10 - 6} y2={y1 * s + 7} stroke={INK} strokeWidth="0.8" />)}
  </svg>;
}

export function Coins({ R = 1, r = 1, inside = false }) {
  const s = 26, cx = 110, cy = 100, small = inside ? [cx, cy - (R - r) * s] : [cx, cy - (R + r) * s];
  return <svg className="machine-figure" viewBox="0 0 220 200" width="220" height="200" role="img" aria-label={`A fixed ${inside ? 'ring' : 'coin'} ${R} times as wide as a smaller coin rolling ${inside ? 'inside' : 'round'} it`}>
    <circle cx={cx} cy={cy} r={R * s} fill={inside ? 'none' : '#e6c46a'} stroke={INK} strokeWidth={inside ? 3 : 1.6} />
    <circle cx={small[0]} cy={small[1]} r={r * s} fill="#cfd8dc" stroke={INK} strokeWidth="1.6" />
    <line x1={small[0]} y1={small[1]} x2={small[0]} y2={small[1] - r * s} stroke={ACCENT} strokeWidth="2" />
  </svg>;
}
