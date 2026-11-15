// Figures and the mixer tool for exam-level colour.
import { useState } from 'react';
import { wheel, hexToHsl } from './colour.js';
import { contrastRatio, hslToRgb, luminance, mixInk, mixLight, nameOf, toHex } from './colour-exam.js';

// A twelve-segment wheel with some segments marked and joined.
export function WheelMarks({ marks = [], size = 120 }) {
  const c = size / 2, r = size / 2 - 4, inner = r * 0.55;
  const pt = (i, rad) => { const a = (i * 30 - 90 - 15) * Math.PI / 180; return [c + rad * Math.cos(a), c + rad * Math.sin(a)]; };
  const mid = (i, rad) => { const a = (i * 30 - 90) * Math.PI / 180; return [c + rad * Math.cos(a), c + rad * Math.sin(a)]; };
  const seg = i => { const [a, b] = [pt(i, r), pt(i + 1, r)], [d, e] = [pt(i + 1, inner), pt(i, inner)]; return `M${a} A${r},${r} 0 0 1 ${b} L${d} A${inner},${inner} 0 0 0 ${e}Z`; };
  const sorted = [...marks].sort((a, b) => a - b);
  return <svg className="wheel-marks" viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`Colour wheel with marks on ${sorted.map(m => wheel[m].name).join(', ')}`}>
    {wheel.map((h, i) => <path key={h.id} d={seg(i)} fill={h.hex} stroke="#fff" strokeWidth="1" opacity={marks.includes(i) ? 1 : 0.35} />)}
    <polygon points={sorted.map(m => mid(m, inner - 6).join(',')).join(' ')} fill="none" stroke="var(--ink, #1d1d1b)" strokeWidth="2" />
    {sorted.map(m => <circle key={m} cx={mid(m, (r + inner) / 2)[0]} cy={mid(m, (r + inner) / 2)[1]} r="5" fill="#fff" stroke="var(--ink, #1d1d1b)" strokeWidth="2" />)}
  </svg>;
}

export function TextSwatch({ fg, bg, name }) {
  return <span className="text-swatch" style={{ background: bg, color: fg }} role="img" aria-label={name}>SALE</span>;
}

// Mixer: coloured lights, printing inks, or the grey a colour prints as.
const LIGHTS = ['red', 'green', 'blue'], INKS = ['cyan', 'magenta', 'yellow'];
export function ColourMixer({ mode: initialMode = 'light' }) {
  const [mode, setMode] = useState(initialMode);
  const [on, setOn] = useState({ red: true, green: true, blue: false, cyan: true, magenta: false, yellow: true });
  const [hue, setHue] = useState('blue');
  const [light, setLight] = useState(50);
  const list = mode === 'light' ? LIGHTS : INKS, used = list.filter(n => on[n]);
  const mixed = mode === 'light' ? mixLight(used) : mixInk(used);
  const rgb = hslToRgb(hexToHsl(wheel.find(h => h.id === hue).hex).h, 0.75, light / 100), y = luminance(rgb), grey = Math.round(255 * (y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055));
  const status = mode === 'grey'
    ? `${wheel.find(h => h.id === hue).name} at ${light}% lightness prints as a ${Math.round(y * 100)}% grey. Contrast with white text ${contrastRatio(rgb, [255, 255, 255]).toFixed(1)} to 1, with black ${contrastRatio(rgb, [0, 0, 0]).toFixed(1)} to 1.`
    : `${used.length ? used.join(' + ') : mode === 'light' ? 'No lights' : 'No ink'} = ${nameOf(mixed) ?? 'a mix'}${mode === 'light' ? ' (light adds)' : ' (ink subtracts)'}.`;
  return <div className="tool">
    <div className="icon-cluster" role="group" aria-label="Mixer mode">
      {[['light', 'Lights'], ['ink', 'Inks'], ['grey', 'In black and white']].map(([m, label]) => <button key={m} type="button" className={`chip${mode === m ? ' is-active' : ''}`} aria-pressed={mode === m} onClick={() => setMode(m)}>{label}</button>)}
    </div>
    <div className="tool-stage">
      {mode === 'grey' ? <div className="stage-block">
        <div className="swatch-row" role="group" aria-label="Hue">{wheel.map(h => <button key={h.id} type="button" className={`wheel-chip flat${h.id === hue ? ' is-active' : ''}`} style={{ background: h.hex }} aria-pressed={h.id === hue} aria-label={h.name} onClick={() => setHue(h.id)} />)}</div>
        <label className="slider"><span>Lightness</span><input type="range" min="10" max="90" value={light} onChange={e => setLight(Number(e.target.value))} aria-label="Lightness" /></label>
        <div className="swatch-row"><span className="swatch-figure large"><span className="swatch-chip" style={{ background: toHex(rgb) }} role="img" aria-label="colour" /><span className="swatch-name">colour</span></span><span className="swatch-figure large"><span className="swatch-chip" style={{ background: toHex([grey, grey, grey]) }} role="img" aria-label="as grey" /><span className="swatch-name">as grey</span></span></div>
      </div> : <div className="stage-block">
        <div className={`mixer-circles ${mode}`} aria-hidden="true">{list.map(n => <span key={n} className={`mixer-circle ${n}${on[n] ? '' : ' is-off'}`} />)}</div>
        <div className="swatch-row" role="group" aria-label={mode === 'light' ? 'Lights' : 'Inks'}>{list.map(n => <button key={n} type="button" className={`chip${on[n] ? ' is-active' : ''}`} aria-pressed={on[n]} onClick={() => setOn(s => ({ ...s, [n]: !s[n] }))}>{n}</button>)}</div>
        <div className="swatch-row"><span className="swatch-figure large"><span className="swatch-chip" style={{ background: toHex(mixed) }} role="img" aria-label="overlap colour" /><span className="swatch-name">overlap</span></span></div>
      </div>}
    </div>
    <p className="tool-status" role="status">{status}</p>
  </div>;
}
