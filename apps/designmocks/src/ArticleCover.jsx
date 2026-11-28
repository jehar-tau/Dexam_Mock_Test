// Cover art for editorial articles: one drawn motif per `cover` name, tinted
// by theme. Colours come from CSS tokens (community-editorial.css), so covers
// follow light and dark mode. Decorative; the title beside it says the same.
import React from "react";

const hash = text => [...String(text)].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);

const motifs = {
  clock: <g>
    <circle className="ec-paper ec-line" cx="320" cy="180" r="104" />
    <path className="ec-accent" d="M320 180 L320 76 A104 104 0 0 1 424 180 Z" opacity=".85" />
    <circle className="ec-line" cx="320" cy="180" r="104" />
    {Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return <line key={i} className="ec-line ec-thin" x1={320 + Math.sin(a) * 84} y1={180 - Math.cos(a) * 84} x2={320 + Math.sin(a) * 94} y2={180 - Math.cos(a) * 94} />; })}
    <path className="ec-line" d="M320 180 L320 112 M320 180 L368 206" />
    <circle className="ec-ink" cx="320" cy="180" r="9" />
  </g>,
  calendar: <g>
    <rect className="ec-paper ec-line" x="196" y="70" width="248" height="218" rx="18" />
    <path className="ec-accent" d="M196 88 a18 18 0 0 1 18 -18 h212 a18 18 0 0 1 18 18 v38 h-248 z" />
    <path className="ec-line" d="M196 126 h248 M250 52 v36 M390 52 v36" />
    {Array.from({ length: 15 }, (_, i) => { const x = 220 + (i % 5) * 42, y = 146 + Math.floor(i / 5) * 44; return i < 9
      ? <path key={i} className="ec-line ec-thin" d={`M${x + 4} ${y + 14} l8 8 l14 -16`} />
      : i === 11 ? <circle key={i} className="ec-line" cx={x + 14} cy={y + 14} r="17" /> : <rect key={i} className="ec-soft" x={x} y={y} width="28" height="28" rx="6" />; })}
  </g>,
  sketch: <g>
    <g transform="rotate(-6 300 190)">
      <rect className="ec-paper ec-line" x="170" y="80" width="250" height="200" rx="10" />
      <path className="ec-line ec-thin" d="M200 230 C 240 140, 300 250, 340 160 S 390 130, 396 200" />
      <circle className="ec-line ec-thin" cx="250" cy="140" r="26" />
    </g>
    <g transform="rotate(38 420 170)">
      <rect className="ec-sun ec-line" x="404" y="40" width="34" height="190" rx="6" />
      <path className="ec-accent ec-line" d="M404 230 L421 272 L438 230 Z" />
    </g>
  </g>,
  eye: <g>
    <path className="ec-paper ec-line" d="M170 180 Q320 50 470 180 Q320 310 170 180 Z" />
    <circle className="ec-accent" cx="320" cy="180" r="56" />
    <circle className="ec-ink" cx="320" cy="180" r="24" />
    <circle className="ec-paper" cx="336" cy="164" r="9" />
    {[-60, -30, 0, 30, 60].map(angle => <line key={angle} className="ec-line ec-thin" transform={`rotate(${angle} 320 180)`} x1="320" y1="58" x2="320" y2="34" />)}
  </g>,
  cube: <g>
    <polygon className="ec-sun ec-line" points="320,70 420,120 320,170 220,120" />
    <polygon className="ec-paper ec-line" points="220,120 320,170 320,284 220,234" />
    <polygon className="ec-accent ec-line" points="420,120 320,170 320,284 420,234" />
    <path className="ec-line ec-thin" d="M150 210 A 190 120 0 0 0 470 290" strokeDasharray="2 16" />
    <path className="ec-line" d="M470 290 l-26 -2 M470 290 l-6 -24" />
  </g>,
  path: <g>
    <path className="ec-line" d="M120 300 C 220 300, 200 200, 300 210 S 380 120, 470 100" strokeDasharray="2 18" />
    {[[120, 300], [300, 210], [400, 140]].map(([x, y]) => <circle key={x} className="ec-paper ec-line" cx={x} cy={y} r="13" />)}
    <path className="ec-line" d="M470 100 V 30" />
    <path className="ec-accent ec-line" d="M470 32 L 530 50 L 470 70 Z" />
  </g>,
  calm: <g>
    {[120, 88, 56].map((r, i) => <circle key={r} className={i === 2 ? "ec-sun" : "ec-line ec-thin"} cx="320" cy="200" r={r} opacity={i === 2 ? 1 : 0.55 + i * 0.2} />)}
    <rect className="ec-cover-bg" x="140" y="200" width="360" height="130" />
    <path className="ec-line" d="M150 200 H 490" />
    <path className="ec-line ec-thin" d="M200 236 H 300 M340 236 H 440 M250 270 H 390" />
    <circle className="ec-accent" cx="320" cy="200" r="10" />
  </g>,
  conversation: <g>
    <path className="ec-paper ec-line" d="M170 90 h190 a24 24 0 0 1 24 24 v80 a24 24 0 0 1 -24 24 h-120 l-40 36 v-36 h-30 a24 24 0 0 1 -24 -24 v-80 a24 24 0 0 1 24 -24 z" />
    <path className="ec-line ec-thin" d="M196 134 h140 M196 170 h96" />
    <path className="ec-accent ec-line" d="M300 160 h170 a24 24 0 0 1 24 24 v64 a24 24 0 0 1 -24 24 h-24 v32 l-36 -32 h-110 a24 24 0 0 1 -24 -24 v-64 a24 24 0 0 1 24 -24 z" />
    {[350, 385, 420].map(x => <circle key={x} className="ec-paper" cx={x} cy="216" r="9" />)}
  </g>,
  papers: <g>
    <rect className="ec-soft ec-line" x="250" y="56" width="190" height="240" rx="8" transform="rotate(8 345 176)" />
    <rect className="ec-paper ec-line" x="210" y="70" width="190" height="240" rx="8" />
    <path className="ec-line ec-thin" d="M238 112 h120 M238 146 h134 M238 180 h100 M238 214 h128" />
    <circle className="ec-accent" cx="380" cy="270" r="44" />
    <path className="ec-line ec-on-accent" d="M360 270 l14 14 l26 -30" />
  </g>,
  compass: <g>
    <circle className="ec-paper ec-line" cx="320" cy="180" r="112" />
    <circle className="ec-line ec-thin" cx="320" cy="180" r="86" />
    {[0, 90, 180, 270].map(angle => <line key={angle} className="ec-line" transform={`rotate(${angle} 320 180)`} x1="320" y1="68" x2="320" y2="88" />)}
    <g transform="rotate(32 320 180)">
      <path className="ec-accent ec-line" d="M320 96 L342 180 L298 180 Z" />
      <path className="ec-sun ec-line" d="M320 264 L342 180 L298 180 Z" />
    </g>
    <circle className="ec-ink" cx="320" cy="180" r="8" />
  </g>,
  balance: <g>
    <path className="ec-line" d="M320 80 V 290 M260 290 H 380" />
    <g transform="rotate(-8 320 100)">
      <path className="ec-line" d="M170 100 H 470" />
      <path className="ec-line ec-thin" d="M190 100 L 160 190 M190 100 L 220 190 M450 100 L 420 190 M450 100 L 480 190" />
      <path className="ec-paper ec-line" d="M146 190 H 234 a44 30 0 0 1 -88 0 Z" />
      <path className="ec-paper ec-line" d="M406 190 H 494 a44 30 0 0 1 -88 0 Z" />
      <rect className="ec-accent ec-line" x="160" y="148" width="60" height="18" rx="3" />
      <rect className="ec-sun ec-line" x="166" y="128" width="50" height="20" rx="3" />
      <circle className="ec-accent ec-line" cx="450" cy="168" r="20" />
    </g>
    <circle className="ec-ink" cx="320" cy="96" r="9" />
  </g>,
  home: <g>
    <path className="ec-paper ec-line" d="M200 170 L320 80 L440 170 V 290 H 200 Z" />
    <rect className="ec-sun ec-line" x="236" y="190" width="56" height="50" rx="4" />
    <path className="ec-line ec-thin" d="M264 190 V 240 M236 215 H 292" />
    <rect className="ec-accent ec-line" x="340" y="214" width="56" height="76" rx="4" />
    <path className="ec-accent" d="M470 120 c-14 -22 -46 -10 -36 14 l36 34 l36 -34 c10 -24 -22 -36 -36 -14 z" />
  </g>,
  bulb: <g>
    {[-70, -35, 0, 35, 70].map(angle => <line key={angle} className="ec-line ec-accent-stroke" transform={`rotate(${angle} 320 160)`} x1="320" y1="40" x2="320" y2="18" />)}
    <path className="ec-sun ec-line" d="M320 62 a86 86 0 0 1 52 154 c-10 8 -14 20 -14 32 h-76 c0 -12 -4 -24 -14 -32 a86 86 0 0 1 52 -154 z" />
    <path className="ec-line ec-thin" d="M298 212 L310 168 L320 196 L330 168 L342 212" />
    <path className="ec-paper ec-line" d="M282 248 h76 v18 a14 14 0 0 1 -14 14 h-48 a14 14 0 0 1 -14 -14 z" />
    <path className="ec-line ec-thin" d="M300 300 h40" />
  </g>,
  target: <g>
    <circle className="ec-paper ec-line" cx="300" cy="190" r="118" />
    <circle className="ec-soft ec-line" cx="300" cy="190" r="80" />
    <circle className="ec-paper ec-line" cx="300" cy="190" r="44" />
    <circle className="ec-accent" cx="300" cy="190" r="16" />
    <path className="ec-line" d="M300 190 L 470 70" />
    <path className="ec-accent ec-line" d="M470 70 l 6 -34 l 24 24 z M 470 70 l 34 -6 l -24 -24" />
  </g>,
};

// A build without Learn content ships no photos, so a missing photo falls back to the drawing.
export function ArticleCover({ photo = null, ...props }) {
  const [failed, setFailed] = React.useState(false);
  if (photo && !failed) return <img className={`editorial-cover editorial-photo cover-${props.theme} ${props.className ?? ""}`.trim()} src={photo.src}
    width={photo.width} height={photo.height} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
  return <DrawnCover {...props} />;
}

function DrawnCover({ cover, theme, seed = "", className = "" }) {
  const n = hash(seed || cover), cx = 80 + (n % 480), cy = 60 + ((n >> 5) % 240), r = 150 + ((n >> 9) % 70);
  return <svg className={`editorial-cover cover-${theme} ${className}`.trim()} viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <rect className="ec-cover-bg" width="640" height="360" />
    <circle className="ec-soft" cx={cx} cy={cy} r={r} />
    {motifs[cover] ?? motifs.papers}
  </svg>;
}
