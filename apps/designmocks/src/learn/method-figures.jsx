// Drawn figures for the method programmes: ramps, chairs, poster layouts,
// camera shots and pendulum frames. All inline SVG, sized to read on a phone.
const INK = 'var(--ink, #1d1d1b)';
const ACCENT = 'var(--orange, #e2502b)';
const SOFT = 'var(--lime, #b9d87a)';

export function Ramp({ rise, run, compact = false }) {
  const scale = (compact ? 150 : 220) / 12, w = run * scale, h = rise * scale * 6; // rise drawn 6× taller so it is visible
  const W = (compact ? 150 : 220) + 40, H = 0.9 * scale * 6 + 34; // room for the tallest rise used (0.9 m)
  return <svg className="method-figure" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`A ramp rising ${rise} m over ${run} m (heights drawn six times taller)`}>
    <polygon points={`10,${H - 20} ${10 + w},${H - 20} ${10 + w},${H - 20 - h}`} fill={SOFT} stroke={INK} strokeWidth="1.5" />
    <text x={10 + w / 2} y={H - 6} textAnchor="middle" fontSize="11" fill={INK}>{run} m</text>
    <text x={14 + w} y={H - 22 - h / 2} fontSize="11" fill={INK}>{rise} m</text>
  </svg>;
}

const CHAIR = {
  wide: <g><rect x="18" y="38" width="64" height="8" rx="2" /><rect x="18" y="8" width="6" height="34" /><line x1="20" y1="46" x2="12" y2="86" /><line x1="80" y1="46" x2="88" y2="86" /><line x1="38" y1="46" x2="34" y2="86" /><line x1="62" y1="46" x2="66" y2="86" /></g>,
  thin: <g><rect x="30" y="38" width="40" height="7" rx="2" /><rect x="30" y="8" width="5" height="34" /><line x1="34" y1="45" x2="38" y2="86" /><line x1="66" y1="45" x2="62" y2="86" /><line x1="50" y1="45" x2="50" y2="86" /></g>,
  post: <g><rect x="22" y="36" width="56" height="8" rx="2" /><rect x="22" y="6" width="6" height="34" /><line x1="50" y1="44" x2="50" y2="80" strokeWidth="5" /><line x1="38" y1="86" x2="62" y2="86" strokeWidth="4" /></g>,
  runners: <g><rect x="24" y="36" width="52" height="8" rx="2" /><rect x="24" y="6" width="6" height="34" /><line x1="40" y1="44" x2="40" y2="84" /><line x1="60" y1="44" x2="60" y2="84" /><line x1="36" y1="86" x2="64" y2="86" strokeWidth="4" /></g>,
};
export function Chairs({ chairs = [] }) {
  const W = chairs.length * 100;
  return <svg className="method-figure" viewBox={`0 0 ${W} 110`} width={W} height="110" role="img" aria-label={`Four chairs seen from the front: ${chairs.map(c => `${c.label}, ${{ wide: 'four legs set wide', thin: 'three thin legs close together', post: 'one central post', runners: 'two legs on narrow runners' }[c.kind]}`).join('; ')}`}>
    {chairs.map((c, i) => <g key={c.label} transform={`translate(${i * 100},0)`} fill="#c9a46b" stroke={INK} strokeWidth="3" strokeLinecap="round">{CHAIR[c.kind]}<text x="50" y="106" textAnchor="middle" fontSize="13" fontWeight="700" fill={INK} stroke="none">{c.label}</text></g>)}
  </svg>;
}

// Poster layouts drawn as blocks: visual, headline, body text, call to action.
const POSTERS = {
  clear: { label: 'one large picture, a big headline, a short line and a clear call to action', draw: <><rect x="10" y="10" width="80" height="58" rx="4" fill={SOFT} /><rect x="10" y="74" width="80" height="12" rx="2" fill={INK} /><rect x="10" y="92" width="56" height="4" fill="#999" /><rect x="58" y="104" width="32" height="10" rx="5" fill={ACCENT} /></> },
  equal: { label: 'six equal small pictures and text all the same size', draw: <>{[0, 1, 2, 3, 4, 5].map(i => <rect key={i} x={10 + (i % 3) * 28} y={10 + Math.floor(i / 3) * 28} width="24" height="24" rx="2" fill={SOFT} />)}{[0, 1, 2, 3].map(i => <rect key={`t${i}`} x="10" y={70 + i * 11} width="80" height="6" fill="#999" />)}</> },
  wall: { label: 'a small picture and several paragraphs of small text', draw: <><rect x="10" y="10" width="30" height="24" rx="2" fill={SOFT} />{Array.from({ length: 13 }, (_, i) => <rect key={i} x={i < 3 ? 46 : 10} y={10 + i * 8} width={i < 3 ? 44 : 80} height="4" fill="#999" />)}</> },
  tiny: { label: 'a large picture with a headline as small as the body text', draw: <><rect x="10" y="10" width="80" height="58" rx="4" fill={SOFT} /><rect x="10" y="76" width="50" height="4" fill={INK} />{[0, 1, 2, 3].map(i => <rect key={i} x="10" y={86 + i * 7} width="80" height="4" fill="#999" />)}</> },
};
export function PosterMock({ layout = 'clear' }) {
  const p = POSTERS[layout];
  return <svg className="method-figure" viewBox="0 0 100 124" width="100" height="124" role="img" aria-label={`Poster layout: ${p.label}`}><rect x="1" y="1" width="98" height="122" rx="4" fill="#fff" stroke={INK} strokeWidth="1.5" />{p.draw}</svg>;
}

// Camera shots of one small scene: a person waiting at a station with a ticket.
const Person = ({ x, y, s = 1, sad = false }) => <g transform={`translate(${x},${y}) scale(${s})`} stroke={INK} strokeWidth={2 / s} fill="none" strokeLinecap="round">
  <circle cx="0" cy="-34" r="8" fill="#fff" /><line x1="0" y1="-26" x2="0" y2="0" /><line x1="0" y1="0" x2="-7" y2="18" /><line x1="0" y1="0" x2="7" y2="18" /><line x1="0" y1="-18" x2="-10" y2="-6" /><line x1="0" y1="-18" x2="10" y2="-8" />
  <path d={sad ? 'M-3,-30 Q0,-33 3,-30' : 'M-3,-32 Q0,-29 3,-32'} />
</g>;
const SHOTS = {
  wide: { label: 'the whole platform, a train and several small people', draw: <><line x1="0" y1="78" x2="140" y2="78" stroke={INK} /><rect x="70" y="30" width="66" height="34" rx="4" fill={SOFT} stroke={INK} /><Person x={24} y={70} s={0.6} /><Person x={44} y={70} s={0.6} /><Person x={58} y={70} s={0.55} /><rect x="4" y="8" width="40" height="10" fill="#ddd" stroke={INK} /></> },
  close: { label: 'one torn ticket filling the frame', draw: <><path d="M18,20 L120,20 L120,38 L112,46 L120,54 L120,70 L18,70 Z" fill="#fff4c9" stroke={INK} strokeWidth="2" /><line x1="30" y1="34" x2="90" y2="34" stroke="#999" strokeWidth="3" /><line x1="30" y1="46" x2="76" y2="46" stroke="#999" strokeWidth="3" /><path d="M112,46 L100,40 L106,48 L96,52" stroke={ACCENT} strokeWidth="2" fill="none" /></> },
  reaction: { label: 'one face and shoulders, eyebrows raised and mouth turned down', draw: <><circle cx="70" cy="42" r="24" fill="#fff" stroke={INK} strokeWidth="2" /><path d="M58,30 l8,-4 M82,30 l-8,-4" stroke={INK} strokeWidth="2" /><circle cx="62" cy="38" r="2.5" fill={INK} /><circle cx="78" cy="38" r="2.5" fill={INK} /><path d="M60,56 Q70,48 80,56" stroke={INK} strokeWidth="2" fill="none" /><path d="M36,86 Q70,62 104,86" stroke={INK} strokeWidth="2" fill="none" /></> },
  sky: { label: 'empty sky with clouds', draw: <><ellipse cx="45" cy="32" rx="22" ry="9" fill="#e8eef5" stroke="#9aa" /><ellipse cx="96" cy="50" rx="26" ry="10" fill="#e8eef5" stroke="#9aa" /></> },
};
export function ShotFrame({ shot = 'wide' }) {
  const p = SHOTS[shot];
  return <svg className="method-figure" viewBox="0 0 140 90" width="140" height="90" role="img" aria-label={`Storyboard frame: ${p.label}`}><rect x="1" y="1" width="138" height="88" rx="3" fill="#fbfaf6" stroke={INK} strokeWidth="1.5" />{p.draw}</svg>;
}

export function PendulumFrames({ angles = [] }) {
  const cx = 80, cy = 10, L = 80, W = 160, H = 100;
  return <svg className="method-figure" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`A pendulum drawn at ${angles.length} moments: ${angles.map(a => `${a} degrees`).join(', ')}`}>
    <line x1="40" y1={cy} x2="120" y2={cy} stroke={INK} strokeWidth="2" />
    {angles.map((a, i) => { const r = (a * Math.PI) / 180, x = cx + L * Math.sin(r), y = cy + L * Math.cos(r); return <g key={i} opacity={0.35 + (0.65 * (i + 1)) / angles.length}><line x1={cx} y1={cy} x2={x} y2={y} stroke={INK} strokeWidth="1.4" /><circle cx={x} cy={y} r="6" fill={ACCENT} stroke={INK} /></g>; })}
  </svg>;
}
