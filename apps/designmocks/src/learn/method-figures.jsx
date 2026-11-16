// Figures for the method programmes. Chairs, poster layouts and camera shots
// are AI-generated illustrations (Figma image generation, made for DMocks,
// owner decision 16 November 2026). Ramps and pendulum frames stay as exact
// diagrams, because their numbers decide the answer.
const INK = 'var(--ink, #1d1d1b)';
const BASE = '/learn-images/illustrations/';

function Illustration({ file, alt, width, height }) {
  return <img className="illustration" src={BASE + file} alt={alt} width={width} height={height} loading="lazy" decoding="async" />;
}

// ---------- ramps: exact proportions, heights drawn six times taller ----------
function Wheelchair({ x, y, s = 1 }) {
  return <g transform={`translate(${x},${y}) scale(${s})`} fill="none" stroke="#3d4a5c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="0" cy="-11" r="11" /><circle cx="0" cy="-11" r="2" fill="#3d4a5c" /><circle cx="15" cy="-4" r="4" />
    <path d="M-4,-30 L-4,-14 L14,-14 L15,-8" /><path d="M-4,-30 L-9,-30" /><path d="M-4,-22 L9,-22" />
  </g>;
}
export function Ramp({ rise, run, compact = false }) {
  // Compact copies are shrunk into answer cards, so their labels are drawn larger.
  const unit = 230 / 12, w = run * unit, h = rise * unit * 6, pad = 34, fs = compact ? 22 : 12, lab = compact ? 40 : 26;
  const W = 12 * unit + pad + (compact ? 90 : 46), H = 0.9 * unit * 6 + 34 + lab, gy = H - lab, x0 = pad;
  const id = `ramp-${String(rise).replace('.', '')}-${run}`;
  return <svg className="method-figure ramp-figure" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`A ramp rising ${rise} m over ${run} m (heights drawn six times taller)`}>
    <defs><linearGradient id={id} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#d9cbb0" /><stop offset="1" stopColor="#b9a47c" /></linearGradient></defs>
    <rect x="0" y={gy} width={W} height={lab} fill="#ece7dc" />
    <line x1="0" y1={gy} x2={W} y2={gy} stroke="#8c836f" strokeWidth="1.5" />
    <polygon points={`${x0},${gy} ${x0 + w},${gy} ${x0 + w},${gy - h}`} fill={`url(#${id})`} stroke="#7a6a4c" strokeWidth="1.5" strokeLinejoin="round" />
    <rect x={x0 + w} y={gy - h} width="14" height={h} fill="#cfc4ad" stroke="#7a6a4c" strokeWidth="1.2" />
    <Wheelchair x={x0 - 14} y={gy} s={compact ? 1.1 : 0.85} />
    <g stroke={INK} strokeWidth={compact ? 2 : 1} fill={INK} fontSize={fs} fontWeight="600">
      <line x1={x0} y1={gy + 13} x2={x0 + w} y2={gy + 13} /><path d={`M${x0},${gy + 9} v8 M${x0 + w},${gy + 9} v8`} />
      <text x={x0 + w / 2} y={gy + lab - 4} textAnchor="middle" stroke="none">{run} m</text>
      <line x1={x0 + w + 22} y1={gy} x2={x0 + w + 22} y2={gy - h} /><path d={`M${x0 + w + 18},${gy} h8 M${x0 + w + 18},${gy - h} h8`} />
      <text x={x0 + w + 28} y={gy - h / 2 + fs / 3} stroke="none">{rise} m</text>
    </g>
  </svg>;
}

// ---------- AI illustrations ----------
const CHAIR_ALT = { wide: 'a chair on four legs set wide apart', thin: 'a chair on three thin legs bunched close together', post: 'a chair on one central post with a small round foot', runners: 'a chair on two legs resting on narrow curved runners' };
export function Chairs({ chairs = [] }) {
  return <div className="illustration-row" role="group" aria-label="Four chairs seen from the front">
    {chairs.map(c => <figure key={c.label} className="illustration-card"><Illustration file={`chair-${c.kind}.jpg`} alt={`Chair ${c.label}: ${CHAIR_ALT[c.kind]}`} width={560} height={560} /><figcaption>{c.label}</figcaption></figure>)}
  </div>;
}
const POSTER_ALT = { clear: 'one large picture, a big headline, a short line and a clear button', equal: 'six equal small pictures and text all the same size', wall: 'a small picture and the rest filled with paragraphs of small text', tiny: 'a large picture with a headline as small as the body text' };
export function PosterMock({ layout = 'clear' }) {
  return <Illustration file={`poster-${layout}.jpg`} alt={`Poster layout: ${POSTER_ALT[layout]}`} width={420} height={560} />;
}
const SHOT_ALT = { wide: 'the whole railway platform from a distance, a train and small passengers', close: 'a torn train ticket filling the frame', reaction: 'one student’s face and shoulders, looking dismayed', sky: 'empty sky with two clouds' };
export function ShotFrame({ shot = 'wide' }) {
  return <Illustration file={`shot-${shot}.jpg`} alt={`Storyboard frame: ${SHOT_ALT[shot]}`} width={560} height={373} />;
}

// ---------- pendulum: exact angles, frames drawn on top of each other ----------
export function PendulumFrames({ angles = [] }) {
  const cx = 110, cy = 22, L = 104, W = 220, H = 150, amp = Math.max(...angles.map(Math.abs)), rad = d => (d * Math.PI) / 180;
  const pt = a => [cx + L * Math.sin(rad(a)), cy + L * Math.cos(rad(a))];
  const [ax, ay] = pt(-amp), [bx, by] = pt(amp), gid = `bob-${angles.join('_').replace(/-/g, 'm')}`;
  return <svg className="method-figure pendulum-figure" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`A pendulum drawn at ${angles.length} equally spaced moments: ${angles.map(a => `${a} degrees`).join(', ')}`}>
    <defs><radialGradient id={gid} cx="0.35" cy="0.35" r="0.7"><stop offset="0" stopColor="#ffb08f" /><stop offset="1" stopColor="#c8401c" /></radialGradient></defs>
    <rect x="60" y="8" width="100" height="10" rx="3" fill="#6b6457" />
    {[70, 90, 110, 130, 150].map(x => <line key={x} x1={x} y1="8" x2={x - 8} y2="0" stroke="#6b6457" strokeWidth="2" />)}
    <path d={`M${ax},${ay} A${L},${L} 0 0 0 ${bx},${by}`} fill="none" stroke="#b9b2a3" strokeWidth="1.5" strokeDasharray="4 4" />
    <line x1={cx} y1={cy} x2={cx} y2={cy + L + 14} stroke="#d6d0c4" strokeWidth="1" strokeDasharray="2 4" />
    {angles.map((a, i) => { const [x, y] = pt(a), o = 0.3 + (0.7 * (i + 1)) / angles.length; return <g key={i} opacity={o}>
      <line x1={cx} y1={cy} x2={x} y2={y} stroke="#3d3a33" strokeWidth="1.8" />
      <circle cx={x} cy={y} r="9" fill={`url(#${gid})`} stroke="#7a2a12" strokeWidth="1" />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">{i + 1}</text>
    </g>; })}
    <circle cx={cx} cy={cy} r="4" fill="#3d3a33" />
  </svg>;
}
