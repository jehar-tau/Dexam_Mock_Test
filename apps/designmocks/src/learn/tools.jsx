import React, { useMemo, useState } from 'react';
import { FoldExplorer, IconButton, NetBuilder, OppositeExplorer, buildPracticeQuestion } from './CubeNetTool.jsx';
import { Question } from './Question.jsx';
import { generateQuestion } from './questions.js';
import { canFold, fold, foldKinds, freshSheet, punch, punchable } from './paper-fold.js';
import { FoldingFigure, FoldSequence, HoleGrid, ImageFigure, PunchedSheet, SolidFigure, SolidNetFigure, StackFigure, Swatch, ViewsFigure } from './figures.jsx';
import { canAnimate, describeFace, extrusion, foldedPose, joined, polycube, profiles, pyramid, unfold, sliced } from './solid-net.js';
import { marksOnNet, marksOnSolid, ringMarks } from './solid-pattern.js';
import { dirWord, presetSystem, solve } from './gears.js';
import { BeamFigure, GearsFigure } from './mechanism-figures.jsx';
import { seededRandom } from './random.js';
import { bySize, shapesOf } from './figure-count.js';
import { counterPresets } from './figure-questions.js';
import { LinesFigure } from './lines-figure.jsx';
import { NOTCHES, S, notch, openings, packetAfter, packetOutline, refold, unfoldShapes } from './paper-cut.js';
import { MATRICES, NAMES, applyTo, imageAngles, imageCount, multiply, nameOf, traceRay } from './mirror-exam.js';
import { ClockFace, MirrorAngle, RayGrid, ToneGrid } from './mirror-figures.jsx';
import { CLUE_CHECK, shiftCode } from './logic.js';
import { SIZE } from './mirror.js';
import { cubeList, exposure, hiddenCount, minMaxFromViews, total, viewsOf } from './cube-count.js';
import { analogous, complement, hexToHsl, hsl, triad, wheel } from './colour.js';

function WorkedCube({ seed }) {
  const question = useMemo(() => generateQuestion('which-cube', seed), [seed]);
  return <Question question={question} worked response={question.answer} idPrefix={`worked-${seed}-`} />;
}
function PracticeBuilder({ seed }) {
  const question = useMemo(() => buildPracticeQuestion(seed), [seed]);
  return <NetBuilder key={seed} question={question} />;
}

// ---------- paper folding ----------
export function FoldPunchExplorer() {
  const [sheet, setSheet] = useState(freshSheet);
  const [cells, setCells] = useState([]);
  const holes = punch(sheet, cells);
  const spots = punchable(sheet);
  const toggle = p => setCells(cells.some(c => c.x === p.x && c.y === p.y) ? cells.filter(c => !(c.x === p.x && c.y === p.y)) : [...cells, p].slice(-2));
  const doFold = kind => { setSheet(fold(sheet, kind)); setCells([]); };
  return <div className="tool">
    <div className="tool-row">
      {Object.entries(foldKinds).map(([kind, text]) => <button key={kind} type="button" className="pill quiet" disabled={!canFold(sheet, kind)} onClick={() => doFold(kind)}>{text}</button>)}
      <button type="button" className="pill quiet" disabled={!sheet.folds.length && !cells.length} onClick={() => { setSheet(freshSheet()); setCells([]); }}>Start again</button>
    </div>
    <div className="tool-stage">
      <div className="stage-block">
        <span className="stage-caption">Folds so far</span>
        {sheet.folds.length ? <FoldSequence folds={sheet.folds} punched={null} /> : <p className="stage-hint">No folds yet.</p>}
      </div>
      <div className="stage-block">
        <span className="stage-caption">Folded sheet: tap to punch (up to two)</span>
        <PunchedSheet state={sheet} cells={cells} onPunch={toggle} punchable={spots} />
      </div>
      <div className="stage-block">
        <span className="stage-caption">Unfolded</span>
        <HoleGrid holes={holes} />
      </div>
    </div>
    <p className="tool-status" role="status">{cells.length ? `${sheet.layers.length} layer${sheet.layers.length === 1 ? '' : 's'} × ${cells.length} punch${cells.length === 1 ? '' : 'es'} = ${holes.length} hole${holes.length === 1 ? '' : 's'} when unfolded.` : sheet.folds.length ? `${sheet.layers.length} layer${sheet.layers.length === 1 ? '' : 's'} now. Punch the sheet to see the holes.` : 'Fold the sheet, then punch it.'}</p>
  </div>;
}

// ---------- mirror ----------
export function MirrorExplorer({ initial = ['1,0', '1,1', '1,2', '1,3', '2,3', '3,3', '2,1'] }) {
  const [cells, setCells] = useState(initial);
  const toggle = k => setCells(cells.includes(k) ? cells.filter(c => c !== k) : [...cells, k]);
  const figure = { type: 'pattern', cells };
  return <div className="tool">
    <div className="tool-stage">
      <div className="stage-block">
        <span className="stage-caption">Draw: tap cells</span>
        <div className="pixel-grid" role="group" aria-label="Drawing grid" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
          {Array.from({ length: SIZE * SIZE }, (_, i) => { const x = i % SIZE, y = Math.floor(i / SIZE), k = `${x},${y}`; return <button key={k} type="button" className={`pixel${cells.includes(k) ? ' is-on' : ''}`} aria-pressed={cells.includes(k)} aria-label={`Cell ${x + 1}, ${y + 1}`} onClick={() => toggle(k)} />; })}
        </div>
      </div>
      <div className="stage-block"><span className="stage-caption">Mirror image</span><ImageFigure figure={figure} transform="mirror" /></div>
      <div className="stage-block"><span className="stage-caption">Water image</span><ImageFigure figure={figure} transform="water" /></div>
    </div>
    <p className="tool-status">Mirror swaps left and right. Water swaps top and bottom. Neither turns the figure.</p>
  </div>;
}

// ---------- cube stacks ----------
// One tool for the whole programme. Props switch on what each tier needs:
// `size` (3 or 4), `showViews` (live top, front and side views), `paint`
// (counts unpainted faces) and `layers` (a slider that lifts off the upper
// layers so the student can look inside).
export function StackBuilder({ initial = null, size = 3, showViews = false, paint = false, layers = false }) {
  const start = initial ?? (size === 4 ? [[4, 3, 2, 1], [3, 3, 2, 1], [2, 2, 1, 0], [1, 1, 0, 0]] : [[2, 1, 0], [1, 3, 1], [0, 1, 2]]);
  const tallest = size === 4 ? 4 : 3;
  const [heights, setHeights] = useState(start);
  const [active, setActive] = useState(null);
  const [shown, setShown] = useState(tallest);
  const bump = (x, y) => setHeights(heights.map((row, i) => row.map((h, j) => (i === x && j === y ? (h + 1) % (tallest + 1) : h))));
  const capped = heights.map(row => row.map(h => Math.min(h, shown)));
  const list = cubeList(heights);
  const n = total(heights);
  const unpainted = 6 * n - exposure(list, { floorPainted: false }).reduce((a, b) => a + b, 0);
  const views = viewsOf(heights);
  const range = minMaxFromViews(views.top, views.front, views.side);
  const status = layers && shown < tallest
    ? `Showing layers 1 to ${shown}: ${total(capped)} of ${n} cubes.`
    : paint ? `${n} cube${n === 1 ? '' : 's'}. Painted while standing on a table, ${unpainted} faces would get no paint.`
      : showViews ? `${n} cube${n === 1 ? '' : 's'} here. These three views fit anything from ${range.min} to ${range.max} cubes.`
        : `${n} cube${n === 1 ? '' : 's'} in total, ${hiddenCount(heights)} completely hidden.`;
  return <div className="tool">
    <div className="tool-stage">
      <div className="stage-block">
        <span className="stage-caption">Plan: tap a square to add cubes</span>
        <div className="plan-grid" role="group" aria-label="Column heights" style={{ gridTemplateColumns: `repeat(${heights[0].length}, 1fr)` }}>
          {heights.map((row, x) => row.map((h, y) => <button key={`${x}-${y}`} type="button" className={`plan-cell h${Math.min(h, 3)}${active && active.x === x && active.y === y ? ' is-active' : ''}`} aria-label={`Column ${x + 1}, ${y + 1}: ${h} cube${h === 1 ? '' : 's'}`} onClick={() => bump(x, y)} onFocus={() => setActive({ x, y })} onMouseEnter={() => setActive({ x, y })} onMouseLeave={() => setActive(null)}>{h}</button>))}
        </div>
      </div>
      <div className="stage-block"><StackFigure heights={capped} large={size !== 4} highlight={active} /></div>
      {showViews && <div className="stage-block"><ViewsFigure top={views.top} front={views.front} side={views.side} /></div>}
    </div>
    {layers && <div className="tool-row">
      <label className="slider"><span>Layers</span><input type="range" min="1" max={tallest} step="1" value={shown} onChange={e => setShown(Number(e.target.value))} aria-label="Layers shown" /><output aria-hidden="true">{shown}/{tallest}</output></label>
    </div>}
    <p className="tool-status" role="status">{status}</p>
  </div>;
}

// ---------- colour wheel ----------
export function ColourWheel({ initial = 'blue' }) {
  const [hue, setHue] = useState(initial);
  const [value, setValue] = useState(null);
  const [saturation, setSaturation] = useState(null);
  const base = wheel.find(h => h.id === hue);
  const hslBase = hexToHsl(base.hex);
  const current = hsl(hslBase.h, saturation ?? hslBase.s, value ?? hslBase.l);
  return <div className="tool">
    <div className="tool-stage">
      <div className="colour-wheel" role="group" aria-label="Colour wheel">
        {wheel.map((h, i) => <button key={h.id} type="button" className={`wheel-chip${h.id === hue ? ' is-active' : ''}`} style={{ background: h.hex, transform: `rotate(${i * 30}deg) translateY(-78px) rotate(${-i * 30}deg)` }} aria-pressed={h.id === hue} aria-label={h.name} onClick={() => { setHue(h.id); setValue(null); setSaturation(null); }} />)}
        <span className="wheel-centre" style={{ background: current }} aria-hidden="true" />
      </div>
      <div className="stage-block">
        <p className="stage-caption">{base.name} · {base.role}{['red', 'red-orange', 'orange', 'yellow-orange', 'yellow', 'red-violet'].includes(base.id) ? ' · warm' : ' · cool'}</p>
        <div className="swatch-row"><Swatch colour={complement(hue).hex} name={`complement: ${complement(hue).name}`} /></div>
        <div className="swatch-row">{analogous(hue).map(h => <Swatch key={h.id} colour={h.hex} name={`analogous: ${h.name}`} />)}</div>
        <div className="swatch-row">{triad(hue).map(h => <Swatch key={h.id} colour={h.hex} name={`triad: ${h.name}`} />)}</div>
        <label className="slider"><span>Value</span><input type="range" min="10" max="90" value={Math.round((value ?? hslBase.l) * 100)} onChange={e => setValue(Number(e.target.value) / 100)} aria-label="Value, light to dark" /></label>
        <label className="slider"><span>Saturation</span><input type="range" min="0" max="100" value={Math.round((saturation ?? hslBase.s) * 100)} onChange={e => setSaturation(Number(e.target.value) / 100)} aria-label="Saturation" /></label>
      </div>
    </div>
  </div>;
}

// ---------- nets of solids ----------
const solidChoices = {
  box: () => extrusion(profiles.box(3, 2), 1), wedge: () => extrusion(profiles.wedge(), 2), pyramid: () => pyramid(4),
  ell: () => extrusion(profiles.ell(), 2), tee: () => extrusion(profiles.tee(), 1), stairs: () => extrusion(profiles.stairs(), 2),
  ramp: () => extrusion(profiles.ramp(), 2), neck: () => extrusion(profiles.neck(), 1), bow: () => extrusion(profiles.bow(), 1),
  roundEnd: () => extrusion(profiles.roundEnd(), 2), stripes: () => { const base = extrusion(profiles.box(4, 2), 3), pattern = ringMarks(base, [{ axis: 0, at: 1 }, { axis: 1, at: 3 }]); return { ...base, pattern, marks: marksOnSolid(base, pattern) }; }, twin: () => joined(6, 5), sliced: () => sliced([2, 2, 2], [[0, 1, 1], [1, 0, 1], [1, 1, 0]]), slicedLong: () => sliced([3, 2, 2], [[1, 1, 1], [0, 1, 1]]), cubes: () => polycube([[0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0]]),
};
const solidNames = { box: 'Box', wedge: 'Wedge', pyramid: 'Pyramid', ell: 'L block', tee: 'T block', stairs: 'Stairs', ramp: 'Ramp', neck: 'Joined boxes', bow: 'Long strip', roundEnd: 'Round end', twin: 'Two prisms', stripes: 'Striped box', sliced: 'Three corners cut', slicedLong: 'Two corners cut', cubes: 'Four cubes' };
// The net beside the solid it makes. For solids with flat faces the slider swings every face
// about its hinge, from flat to closed. A solid with a curved side cannot swing rigidly, so there
// the slider adds faces one at a time instead. Tapping a face of the net shows where it goes.
export function Unfolder({ choices = ['box'], seed = 1 }) {
  const [choice, setChoice] = useState(choices[0]);
  const { solid, net, moving } = useMemo(() => {
    const built = solidChoices[choice](), flat = unfold(built, seededRandom(seed));
    return { solid: built, net: built.pattern ? { ...flat, marks: marksOnNet(built, flat, built.pattern) } : flat, moving: canAnimate(built) };
  }, [choice, seed]);
  const [amount, setAmount] = useState(100);
  const [selected, setSelected] = useState(null);
  const [turns, setTurns] = useState(0);
  const pick = name => { setChoice(name); setSelected(null); setAmount(100); };
  const total = net.faces.length;
  const count = moving ? total : Math.max(1, Math.round((amount / 100) * total));
  const face = selected === null ? null : net.faces[selected];
  const role = face && (face.role === 'cap' ? 'an end face' : face.kind === 'curved' ? 'the curved side, unrolled flat' : 'a side face');
  const status = face ? `${describeFace(face).replace(/^the /, 'This ')} is ${role}.`
    : moving ? (amount === 100 ? `Closed: ${total} faces. Drag Fold back to open it out flat.` : amount === 0 ? 'Opened out flat. This is the net.' : `Folding: ${amount}% closed.`)
      : `${count} of ${total} faces folded. This solid has a curved side, so its faces go on one at a time.`;
  return <div className="tool">
    {choices.length > 1 && <div className="tool-row" role="group" aria-label="Choose a solid">
      {choices.map(name => <button key={name} type="button" className={`chip${name === choice ? ' is-active' : ''}`} aria-pressed={name === choice} onClick={() => pick(name)}>{solidNames[name]}</button>)}
    </div>}
    <div className="tool-stage">
      <SolidNetFigure net={net} shown={moving ? null : new Set(net.faces.map((_, i) => i).filter(i => i < count))} selected={selected} onSelect={setSelected} label="Net: tap a face" />
      {moving
        ? <FoldingFigure pose={foldedPose(solid, net, amount / 100)} marks={solid.marks ?? []} turns={turns} closed={amount === 100} highlight={face ? face.id : null} label={`The net ${amount}% folded`} />
        : <SolidFigure solid={solid} turns={turns} shown={new Set(net.faces.slice(0, count).map(f => f.id))} highlight={face && selected < count ? face.id : null} large />}
    </div>
    <div className="tool-row">
      <label className="slider"><span>Fold</span><input type="range" min="0" max="100" step="5" value={amount} onChange={e => setAmount(Number(e.target.value))} aria-label="How far folded" /><output aria-hidden="true">{amount}%</output></label>
      <div className="icon-cluster" role="group" aria-label="Turn the solid">
        <IconButton label="Turn left" onClick={() => setTurns(turns + 1)}>↺</IconButton>
        <IconButton label="Turn right" onClick={() => setTurns(turns + 3)}>↻</IconButton>
      </div>
    </div>
    <p className="tool-status" role="status">{status}</p>
  </div>;
}

// ---------- gears and belts ----------
// A small machine that runs. Wheels turn at their true relative speeds; controls change one thing
// at a time so the student can see what it does.
const gearPresetNames = { pair: 'Two gears', chain: 'A chain', belt: 'A belt', compound: 'One shaft', mixed: 'Gears and a belt', ring: 'A ring' };
export function GearTrain({ presets = ['pair'] }) {
  const [preset, setPreset] = useState(presets[0]);
  const [count, setCount] = useState(3);
  const [crossed, setCrossed] = useState(false);
  const [big, setBig] = useState(false);
  const [running, setRunning] = useState(true);
  const system = useMemo(() => presetSystem(preset, { count: preset === 'ring' ? Math.max(3, count) : count, crossed, big }), [preset, count, crossed, big]);
  const result = solve(system);
  const speedOf = i => { const f = result.speed[i]; return f.d === 1 ? `${f.n}` : (f.n / f.d).toFixed(1); };
  const status = result.locked
    ? `Locked. ${system.wheels.length} gears in a ring would need gear A to turn both ways at once.`
    : system.wheels.map((w, i) => `${w.id} ${dirWord(result.dir[i])}${preset === 'chain' || preset === 'ring' ? '' : ` ${speedOf(i)}`}`).join(' · ') + (preset === 'chain' || preset === 'ring' ? '' : ' turns a minute');
  const choose = name => { setPreset(name); setCrossed(false); setBig(false); setCount(3); };
  return <div className="tool">
    {presets.length > 1 && <div className="tool-row" role="group" aria-label="Choose a machine">
      {presets.map(name => <button key={name} type="button" className={`chip${name === preset ? ' is-active' : ''}`} aria-pressed={name === preset} onClick={() => choose(name)}>{gearPresetNames[name]}</button>)}
    </div>}
    <div className="tool-stage">
      <GearsFigure key={`${preset}.${count}.${crossed}.${big}`} system={system} arrows="all" showLocked animate={running} showSizes={preset !== 'chain' && preset !== 'ring'} />
    </div>
    <div className="tool-row">
      <button type="button" className="chip" aria-pressed={running} onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Run'}</button>
      {(preset === 'chain' || preset === 'ring') && <label className="slider"><span>Gears</span><input type="range" min={preset === 'ring' ? 3 : 2} max="6" step="1" value={preset === 'ring' ? Math.max(3, count) : count} onChange={e => setCount(Number(e.target.value))} aria-label="Number of gears" /><output aria-hidden="true">{preset === 'ring' ? Math.max(3, count) : count}</output></label>}
      {(preset === 'belt' || preset === 'mixed') && <button type="button" className={`chip${crossed ? ' is-active' : ''}`} aria-pressed={crossed} onClick={() => setCrossed(!crossed)}>Cross the belt</button>}
      {(preset === 'pair' || preset === 'belt') && <button type="button" className={`chip${big ? ' is-active' : ''}`} aria-pressed={big} onClick={() => setBig(!big)}>{preset === 'pair' ? 'Bigger driver' : 'Bigger second pulley'}</button>}
    </div>
    <p className={`tool-status${result.locked ? ' is-wrong' : ''}`} role="status">{status}</p>
  </div>;
}

// A beam to load by hand: tap a mark to hang or remove a 1 kg weight, and see which way it tips.
export function LeverBench({ length = 10, pivot = 5 }) {
  const [counts, setCounts] = useState(() => { const start = Array(length + 1).fill(0); start[pivot - 3] = 2; return start; });
  const beam = { length, pivot, loads: counts.map((n, at) => ({ at, weight: n, label: `${n}` })).filter(l => l.weight > 0) };
  const left = beam.loads.filter(l => l.at < pivot).reduce((sum, l) => sum + l.weight * (pivot - l.at), 0), right = beam.loads.filter(l => l.at > pivot).reduce((sum, l) => sum + l.weight * (l.at - pivot), 0);
  const tip = Math.sign(right - left);
  const add = (at, by) => setCounts(counts.map((n, i) => (i === at ? Math.max(0, Math.min(6, n + by)) : n)));
  return <div className="tool">
    <div className="tool-stage"><BeamFigure beam={{ ...beam, loads: beam.loads.map(l => ({ ...l, label: '' })) }} tilt={tip * 7} /></div>
    <div className="tool-row lever-row" role="group" aria-label="Weights on the beam">
      {counts.map((n, at) => at === pivot ? <span key={at} className="lever-pivot" aria-hidden="true">▲</span> : <span key={at} className="lever-cell">
        <button type="button" className="mini-button" aria-label={`Add 1 kilogram ${Math.abs(at - pivot)} ${Math.abs(at - pivot) === 1 ? 'unit' : 'units'} to the ${at < pivot ? 'left' : 'right'} of the pivot`} onClick={() => add(at, 1)}>+</button>
        <span className="lever-count">{n}</span>
        <button type="button" className="mini-button" aria-label={`Remove 1 kilogram ${Math.abs(at - pivot)} ${Math.abs(at - pivot) === 1 ? 'unit' : 'units'} to the ${at < pivot ? 'left' : 'right'} of the pivot`} disabled={n === 0} onClick={() => add(at, -1)}>−</button>
      </span>)}
    </div>
    <p className={`tool-status${tip === 0 ? ' is-correct' : ''}`} role="status">{`Left side: ${left}. Right side: ${right}. ${tip === 0 ? 'Balanced.' : tip < 0 ? 'The left side goes down.' : 'The right side goes down.'}`}</p>
  </div>;
}

// ---------- counting figures ----------
// Steps through every shape in a figure, one size at a time, lighting each one up. The tally
// under it is the method: count by size, add the sizes.
export function FigureCounter({ figures = ['grid-2'] }) {
  const [name, setName] = useState(figures[0]);
  const preset = counterPresets[name];
  const { segments, groups } = useMemo(() => { const segs = preset.segments(); return { segments: segs, groups: bySize(shapesOf(segs, preset.shape)) }; }, [name]);
  const [size, setSize] = useState(0);
  const [index, setIndex] = useState(0);
  const group = groups[Math.min(size, groups.length - 1)], total = groups.reduce((sum, g) => sum + g.count, 0);
  const word = n => ({ triangle: ['triangle', 'triangles'], square: ['square', 'squares'], rectangle: ['rectangle', 'rectangles'], parallelogram: ['parallelogram', 'parallelograms'] })[preset.shape][n === 1 ? 0 : 1];
  const choose = next => { setName(next); setSize(0); setIndex(0); };
  const step = by => setIndex((index + by + group.count) % group.count);
  return <div className="tool">
    {figures.length > 1 && <div className="tool-row" role="group" aria-label="Choose a figure">
      {figures.map(f => <button key={f} type="button" className={`chip${f === name ? ' is-active' : ''}`} aria-pressed={f === name} onClick={() => choose(f)}>{counterPresets[f].name}</button>)}
    </div>}
    <div className="tool-stage"><LinesFigure segments={segments} highlight={group.shapes[Math.min(index, group.count - 1)].points} label={`The figure with one ${word(1)} lit up`} /></div>
    <div className="tool-row">
      <label className="slider"><span>Size</span><input type="range" min="1" max={groups.length} step="1" value={size + 1} onChange={e => { setSize(Number(e.target.value) - 1); setIndex(0); }} aria-label="Size of shape" /><output aria-hidden="true">{size + 1} of {groups.length}</output></label>
      <div className="icon-cluster" role="group" aria-label="Step through the shapes of this size">
        <IconButton label="Previous shape" onClick={() => step(-1)}>‹</IconButton>
        <IconButton label="Next shape" onClick={() => step(1)}>›</IconButton>
      </div>
    </div>
    <p className="tool-status" role="status">{`Size ${size + 1}: ${word(2)} ${Math.min(index, group.count - 1) + 1} of ${group.count}. All sizes: ${groups.map(g => g.count).join(' + ')} = ${total} ${word(total)}.`}</p>
  </div>;
}

// ---------- unfolding cuts, one fold at a time ----------
const cutFoldSets = { half: ['left'], quarter: ['left', 'up'], corner: ['left', 'up', 'diagonal'] };
const cutFoldNames = { half: 'One fold', quarter: 'Two folds', corner: 'Three folds' };
export function CutUnfolder({ sets = ['half', 'quarter'], shapes = ['semicircle', 'triangle'] }) {
  const [set, setSet] = useState(sets[0]);
  const [shape, setShape] = useState(shapes[0]);
  const folds = cutFoldSets[set], packet = packetAfter(folds), edges = packet.triangle ? ['left', 'bottom', 'diagonal'] : ['top', 'right', 'bottom', 'left'];
  const [edge, setEdge] = useState('right');
  const usedEdge = edges.includes(edge) ? edge : edges[1];
  const [opened, setOpened] = useState(0);
  const cut = notch(packet, usedEdge, 0.5, shape, Math.min(0.8, (usedEdge === 'diagonal' ? packet.w * Math.SQRT2 : usedEdge === 'left' || usedEdge === 'right' ? packet.h : packet.w) * 0.16));
  const all = unfoldShapes(packet, [cut]), still = folds.slice(0, folds.length - opened), now = packetAfter(still);
  const shown = all.map(s => ({ ...s, points: refold(s.points, still) }));
  const isFold = { right: folds.includes('left'), bottom: folds.includes('up'), diagonal: folds.includes('diagonal'), top: false, left: false }[usedEdge];
  const open = openings(all), holes = open.filter(o => !o.notch).length;
  const choose = next => { setSet(next); setOpened(0); };
  const status = opened === 0 ? `Folded: ${packet.layers.length} layers. The ${usedEdge} edge is ${isFold ? 'a fold' : "the sheet's own edge"}.`
    : opened < folds.length ? `${opened} of ${folds.length} folds undone: the cut now shows ${2 ** opened} times.`
      : `Fully open: ${holes} hole${holes === 1 ? '' : 's'} and ${open.length - holes} notch${open.length - holes === 1 ? '' : 'es'} at the edge.`;
  const u = 20, uniq = new Map(shown.map(s => [s.points.map(p => p.map(v => v.toFixed(3)).join(',')).sort().join(';'), s]));
  return <div className="tool">
    <div className="tool-row" role="group" aria-label="Choose the folds">
      {sets.map(name => <button key={name} type="button" className={`chip${name === set ? ' is-active' : ''}`} aria-pressed={name === set} onClick={() => choose(name)}>{cutFoldNames[name]}</button>)}
    </div>
    <div className="tool-row" role="group" aria-label="Choose the edge to cut">
      {edges.map(name => <button key={name} type="button" className={`chip${name === usedEdge ? ' is-active' : ''}`} aria-pressed={name === usedEdge} onClick={() => { setEdge(name); setOpened(0); }}>{`Cut the ${name} edge`}</button>)}
      {shapes.length > 1 && shapes.map(name => <button key={name} type="button" className={`chip${name === shape ? ' is-active' : ''}`} aria-pressed={name === shape} onClick={() => setShape(name)}>{NOTCHES[name].name.replace(/^a /, '').replace(/^./, c => c.toUpperCase())}</button>)}
    </div>
    <div className="tool-stage">
      <svg className="cut-sheet" viewBox={`-4 -4 ${S * u + 8} ${S * u + 8}`} width={S * u + 8} height={S * u + 8} role="img" aria-label={`The sheet with ${opened} of ${folds.length} folds undone`}>
        <rect className="sheet-ghost" x="0" y="0" width={S * u} height={S * u} />
        <polygon className="sheet" points={packetOutline(now).map(([x, y]) => `${x * u},${y * u}`).join(' ')} />
        {[...uniq.values()].map((s, i) => <polygon key={i} className="cut-away" points={s.points.map(([x, y]) => `${(x * u).toFixed(1)},${(y * u).toFixed(1)}`).join(' ')} />)}
      </svg>
    </div>
    <div className="tool-row">
      <label className="slider"><span>Unfold</span><input type="range" min="0" max={folds.length} step="1" value={opened} onChange={e => setOpened(Number(e.target.value))} aria-label="Folds undone" /><output aria-hidden="true">{opened} of {folds.length}</output></label>
    </div>
    <p className="tool-status" role="status">{status}</p>
  </div>;
}

// ---------- the mirror lab: a movable mirror, two mirrors at an angle, a ray on a grid ----------
const LAB_PATTERN = { '2,1': 1, '2,2': 1, '2,3': 1, '3,3': 1, '4,3': 2, '3,1': 2, '1,4': 1, '2,4': 1 };
const LAB_LINES = { right: 'mirror', left: 'mirror', bottom: 'water', top: 'water', falling: 'transposed', rising: 'anti' };
const LAB_LINE_NAMES = { right: 'Right side', left: 'Left side', bottom: 'Below', top: 'Above', falling: 'Falling 45°', rising: 'Rising 45°' };
const LAB_MIRRORS = { '3,1': '\\', '3,3': '/', '1,3': '\\', '1,0': '/' };
export function MirrorLab({ mode = 'line', lines = ['right', 'bottom', 'falling'] }) {
  const [line, setLine] = useState(lines[0]);
  const [second, setSecond] = useState(null);
  const [theta, setTheta] = useState(90);
  const [onBisector, setOnBisector] = useState(false);
  const [mirrors, setMirrors] = useState(LAB_MIRRORS);
  if (mode === 'angle') {
    const m = 360 / theta, count = imageCount(theta, onBisector);
    // Image positions: the object's angle reflected in the two mirrors in turn, as far as they reach.
    const a1 = ((90 - theta / 2) * Math.PI) / 180, phi = onBisector ? theta / 2 : theta * 0.3;
    const images = imageAngles(theta, phi).map(a => a1 + (a * Math.PI) / 180);
    return <div className="tool">
      <div className="tool-stage"><MirrorAngle theta={theta} onBisector={onBisector} images={images} /></div>
      <div className="tool-row">
        <label className="slider"><span>Angle</span><input type="range" min="0" max="5" step="1" value={[30, 45, 60, 72, 90, 120].indexOf(theta)} onChange={e => setTheta([30, 45, 60, 72, 90, 120][Number(e.target.value)])} aria-label="Angle between the mirrors" /><output aria-hidden="true">{theta}°</output></label>
        <button type="button" className={`chip${onBisector ? ' is-active' : ''}`} aria-pressed={onBisector} onClick={() => setOnBisector(!onBisector)}>Object half way</button>
      </div>
      <p className="tool-status" role="status">{`360 ÷ ${theta} = ${m}, ${m % 2 ? 'odd' : 'even'}. ${count} image${count === 1 ? '' : 's'}.`}</p>
    </div>;
  }
  if (mode === 'ray') {
    const n = 5, start = { x: -1, y: 1, d: [1, 0] }, result = traceRay(n, mirrors, { x: 0, y: 1, d: [1, 0] });
    const flip = k => setMirrors({ ...mirrors, [k]: mirrors[k] === '/' ? '\\' : '/' });
    return <div className="tool">
      <div className="tool-stage"><RayGrid n={n} mirrors={mirrors} start={start} path={result ? [[-1, 1], ...result.path] : null} /></div>
      <div className="tool-row" role="group" aria-label="Turn a mirror">
        {Object.keys(mirrors).map(k => <button key={k} type="button" className="chip" onClick={() => flip(k)}>{`Turn mirror at ${k.split(',').map(v => Number(v) + 1).join(', ')}`}</button>)}
      </div>
      <p className="tool-status" role="status">{result ? `The ray bounces ${result.bounces} time${result.bounces === 1 ? '' : 's'} and leaves the grid.` : 'The ray goes round in a loop.'}</p>
    </div>;
  }
  const first = LAB_LINES[line], total = second ? nameOf(multiply(MATRICES[LAB_LINES[second]], MATRICES[first])) : first;
  return <div className="tool">
    <div className="tool-row" role="group" aria-label="Place the mirror">
      {lines.map(l => <button key={l} type="button" className={`chip${l === line ? ' is-active' : ''}`} aria-pressed={l === line} onClick={() => setLine(l)}>{LAB_LINE_NAMES[l]}</button>)}
    </div>
    {mode === 'chain' && <div className="tool-row" role="group" aria-label="Then reflect in">
      {[null, ...lines].map(l => <button key={l ?? 'none'} type="button" className={`chip${l === second ? ' is-active' : ''}`} aria-pressed={l === second} onClick={() => setSecond(l)}>{l ? `Then ${LAB_LINE_NAMES[l].toLowerCase()}` : 'One mirror only'}</button>)}
    </div>}
    <div className="tool-stage">
      <div className="stage-block"><span className="stage-caption">Figure</span><ToneGrid cells={LAB_PATTERN} n={6} lines={[{ at: line, label: mode === 'chain' ? '1' : undefined }, ...(second ? [{ at: second, label: '2' }] : [])]} /></div>
      <div className="stage-block"><span className="stage-caption">Result</span><ToneGrid cells={applyTo(LAB_PATTERN, total, 6)} n={6} label={`The figure ${NAMES[total]}`} /></div>
    </div>
    <p className="tool-status" role="status">{`Result: ${NAMES[total]}.`}</p>
  </div>;
}

// ---------- number lab: clock hands, and a bar split in a ratio ----------
export function NumberLab({ mode = 'clock' }) {
  const [minutes, setMinutes] = useState(120);
  const [parts, setParts] = useState([2, 3]);
  const [total, setTotal] = useState(250);
  if (mode === 'bar') {
    const sum = parts[0] + parts[1], unit = total / sum;
    return <div className="tool">
      <div className="tool-stage"><div className="ratio-bar" role="img" aria-label={`A bar of ${total} split ${parts[0]} to ${parts[1]}`}>
        {parts.flatMap((n, side) => Array.from({ length: n }, (_, i) => <span key={`${side}.${i}`} className={`ratio-part side-${side}`}>{Number.isInteger(unit) ? unit : unit.toFixed(1)}</span>))}
      </div></div>
      <div className="tool-row">
        <label className="slider"><span>First</span><input type="range" min="1" max="6" step="1" value={parts[0]} onChange={e => setParts([Number(e.target.value), parts[1]])} aria-label="Parts for the first share" /><output aria-hidden="true">{parts[0]}</output></label>
        <label className="slider"><span>Second</span><input type="range" min="1" max="6" step="1" value={parts[1]} onChange={e => setParts([parts[0], Number(e.target.value)])} aria-label="Parts for the second share" /><output aria-hidden="true">{parts[1]}</output></label>
        <label className="slider"><span>Total</span><input type="range" min="50" max="600" step="50" value={total} onChange={e => setTotal(Number(e.target.value))} aria-label="Total to share" /><output aria-hidden="true">{total}</output></label>
      </div>
      <p className="tool-status" role="status">{`${sum} parts, each ${Number.isInteger(unit) ? unit : unit.toFixed(2)}. Shares: ${Number.isInteger(unit * parts[0]) ? unit * parts[0] : (unit * parts[0]).toFixed(2)} and ${Number.isInteger(unit * parts[1]) ? unit * parts[1] : (unit * parts[1]).toFixed(2)}.`}</p>
    </div>;
  }
  const h = Math.floor(minutes / 60) % 12 || 12, m = minutes % 60, hourAngle = (30 * (h % 12) + m / 2) % 360, minuteAngle = 6 * m, gap = Math.abs(hourAngle - minuteAngle), angle = Math.min(gap, 360 - gap);
  return <div className="tool">
    <div className="tool-stage"><ClockFace h={h} m={m} size={170} label={`Clock showing ${h}:${String(m).padStart(2, '0')}`} /></div>
    <div className="tool-row">
      <label className="slider"><span>Time</span><input type="range" min="0" max="719" step="1" value={minutes} onChange={e => setMinutes(Number(e.target.value))} aria-label="Minutes after 12 o'clock" /><output aria-hidden="true">{`${h}:${String(m).padStart(2, '0')}`}</output></label>
      <div className="icon-cluster" role="group" aria-label="Step the time">
        <IconButton label="One minute back" onClick={() => setMinutes((minutes + 719) % 720)}>‹</IconButton>
        <IconButton label="One minute on" onClick={() => setMinutes((minutes + 1) % 720)}>›</IconButton>
      </div>
    </div>
    <p className="tool-status" role="status">{`${h}:${String(m).padStart(2, '0')}. Hour hand at ${hourAngle}°, minute hand at ${minuteAngle}°: ${angle}° apart.`}</p>
  </div>;
}

// ---------- logic lab: a letter code, a row of seats, a walk on a compass ----------
const LAB_WORDS = ['CHAIR', 'PLANT', 'RIVER', 'STONE'];
const LAB_CLUES = [{ type: 'end', who: ['Esha'] }, { type: 'leftOf', who: ['Charu', 'Asha'] }, { type: 'gapOne', who: ['Bilal', 'Asha'] }, { type: 'notEnd', who: ['Dev'] }];
const LAB_CLUE_TEXT = { end: x => `${x} sits at one end`, notEnd: x => `${x} does not sit at either end`, leftOf: (x, y) => `${x} sits immediately to the left of ${y}`, gapOne: (x, y) => `exactly one person sits between ${x} and ${y}` };
export function LogicLab({ mode = 'shift' }) {
  const [word, setWord] = useState(LAB_WORDS[0]);
  const [k, setK] = useState(1);
  const [backwards, setBackwards] = useState(false);
  const [row, setRow] = useState(['Asha', 'Bilal', 'Charu', 'Dev', 'Esha']);
  const [picked, setPicked] = useState(null);
  const [path, setPath] = useState([{ x: 0, y: 0 }]);
  const [facing, setFacing] = useState(0);
  if (mode === 'seats') {
    const holds = LAB_CLUES.map(c => CLUE_CHECK[c.type](row, ...c.who));
    const tap = i => { if (picked === null) setPicked(i); else { const r = [...row]; [r[picked], r[i]] = [r[i], r[picked]]; setRow(r); setPicked(null); } };
    return <div className="tool">
      <div className="tool-row seat-row" role="group" aria-label="Seats from left to right">
        {row.map((name, i) => <button key={name} type="button" className={`chip seat${picked === i ? ' is-active' : ''}`} aria-pressed={picked === i} onClick={() => tap(i)}>{name}</button>)}
      </div>
      <ul className="clue-list">{LAB_CLUES.map((c, i) => <li key={i} className={holds[i] ? 'is-true' : 'is-false'}>{holds[i] ? '✓ ' : '✗ '}{LAB_CLUE_TEXT[c.type](...c.who)}</li>)}</ul>
      <p className="tool-status" role="status">{picked !== null ? `Now tap the seat to swap ${row[picked]} with.` : `${holds.filter(Boolean).length} of ${LAB_CLUES.length} clues hold.${holds.every(Boolean) ? ' Every clue fits.' : ''}`}</p>
    </div>;
  }
  if (mode === 'compass') {
    const D = [[0, 1], [1, 0], [0, -1], [-1, 0]], names = ['north', 'east', 'south', 'west'], last = path[path.length - 1];
    const step = () => setPath([...path, { x: last.x + D[facing][0], y: last.y + D[facing][1] }]);
    const xs = path.map(p => p.x), ys = path.map(p => p.y), minX = Math.min(...xs, -2), maxX = Math.max(...xs, 2), minY = Math.min(...ys, -2), maxY = Math.max(...ys, 2), u = 24;
    const pt = p => `${(p.x - minX) * u + 10},${(maxY - p.y) * u + 10}`;
    return <div className="tool">
      <div className="tool-stage"><svg className="walk-figure" viewBox={`0 0 ${(maxX - minX) * u + 20} ${(maxY - minY) * u + 20}`} width={(maxX - minX) * u + 20} height={(maxY - minY) * u + 20} role="img" aria-label={`A walk of ${path.length - 1} metres`}>
        <polyline className="walk-path" points={path.map(pt).join(' ')} />
        <circle className="walk-start" cx={pt(path[0]).split(',')[0]} cy={pt(path[0]).split(',')[1]} r="5" />
        <circle className="walk-now" cx={pt(last).split(',')[0]} cy={pt(last).split(',')[1]} r="6" />
      </svg></div>
      <div className="tool-row">
        <button type="button" className="chip" onClick={() => setFacing((facing + 3) % 4)}>Turn left</button>
        <button type="button" className="chip" onClick={step}>Walk 1 m</button>
        <button type="button" className="chip" onClick={() => setFacing((facing + 1) % 4)}>Turn right</button>
        <button type="button" className="chip" onClick={() => { setPath([{ x: 0, y: 0 }]); setFacing(0); }}>Start again</button>
      </div>
      <p className="tool-status" role="status">{`Facing ${names[facing]}. ${Math.abs(last.x)} m ${last.x >= 0 ? 'east' : 'west'} and ${Math.abs(last.y)} m ${last.y >= 0 ? 'north' : 'south'} of the start: ${Math.hypot(last.x, last.y).toFixed(Number.isInteger(Math.hypot(last.x, last.y)) ? 0 : 2)} m away.`}</p>
    </div>;
  }
  const coded = (backwards ? [...shiftCode(word, k)].reverse().join('') : shiftCode(word, k));
  return <div className="tool">
    <div className="tool-row" role="group" aria-label="Choose a word">
      {LAB_WORDS.map(w => <button key={w} type="button" className={`chip${w === word ? ' is-active' : ''}`} aria-pressed={w === word} onClick={() => setWord(w)}>{w}</button>)}
    </div>
    <div className="tool-stage"><p className="code-pair"><span>{word}</span><span aria-hidden="true">→</span><span>{coded}</span></p></div>
    <div className="tool-row">
      <label className="slider"><span>Shift</span><input type="range" min="-5" max="5" step="1" value={k} onChange={e => setK(Number(e.target.value))} aria-label="Letters to move along the alphabet" /><output aria-hidden="true">{k > 0 ? `+${k}` : k}</output></label>
      <button type="button" className={`chip${backwards ? ' is-active' : ''}`} aria-pressed={backwards} onClick={() => setBackwards(!backwards)}>Write it backwards</button>
    </div>
    <p className="tool-status" role="status">{`${word} is written ${coded}: each letter moves ${Math.abs(k)} ${k >= 0 ? 'forward' : 'back'}${backwards ? ', then the code is reversed' : ''}.`}</p>
  </div>;
}

export function LearnTool({ tool, props = {} }) {
  switch (tool) {
    case 'fold-explorer': return <FoldExplorer {...props} />;
    case 'opposite-explorer': return <OppositeExplorer {...props} />;
    case 'worked-cube': return <WorkedCube {...props} />;
    case 'net-builder': return <PracticeBuilder seed={props.seed ?? 1} />;
    case 'fold-punch': return <FoldPunchExplorer {...props} />;
    case 'mirror': return <MirrorExplorer {...props} />;
    case 'stack-builder': return <StackBuilder {...props} />;
    case 'colour-wheel': return <ColourWheel {...props} />;
    case 'unfolder': return <Unfolder {...props} />;
    case 'gear-train': return <GearTrain {...props} />;
    case 'lever-bench': return <LeverBench {...props} />;
    case 'figure-counter': return <FigureCounter {...props} />;
    case 'cut-unfolder': return <CutUnfolder {...props} />;
    case 'mirror-lab': return <MirrorLab {...props} />;
    case 'number-lab': return <NumberLab {...props} />;
    case 'logic-lab': return <LogicLab {...props} />;
    default: return <p role="alert">This tool is not available.</p>;
  }
}
export const toolNames = Object.freeze(['fold-explorer', 'opposite-explorer', 'worked-cube', 'net-builder', 'fold-punch', 'mirror', 'stack-builder', 'colour-wheel', 'unfolder', 'gear-train', 'lever-bench', 'figure-counter', 'cut-unfolder', 'mirror-lab', 'number-lab', 'logic-lab']);
export { IconButton };
