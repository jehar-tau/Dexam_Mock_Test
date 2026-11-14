import React, { useEffect, useMemo, useState } from 'react';
import {
  adjacentIndices, checkBuild, contentLabel, cubeNets, cubeView, faceName, foldNet, generateQuestion,
  identity, oppositeIndex, paletteNames, rotations, slotGeometry, slotGlyphMatrix, slotNames, transformCells,
} from './cube-net.js';

// ---------- glyphs ----------
export function Glyph({ glyph, fill }) {
  const cls = `glyph${fill ? ' on-fill' : ''}`;
  switch (glyph) {
    case 'dot': return <circle className={cls} r="0.42" />;
    case 'ring': return <circle className={`${cls} stroke`} r="0.45" />;
    case 'square': return fill ? null : <rect className={cls} x="-0.45" y="-0.45" width="0.9" height="0.9" />;
    case 'plus': return <path className={cls} d="M-0.15,0.6 H0.15 V0.15 H0.6 V-0.15 H0.15 V-0.6 H-0.15 V-0.15 H-0.6 V0.15 H-0.15 Z" />;
    case 'bar': return <rect className={cls} x="-0.14" y="-0.6" width="0.28" height="1.2" />;
    case 'diag': return <path className={`${cls} stroke`} d="M-0.55,-0.55 L0.55,0.55" />;
    case 'arrow': return <path className={cls} d="M0,0.7 L0.55,0.05 L0.2,0.05 L0.2,-0.65 L-0.2,-0.65 L-0.2,0.05 L-0.55,0.05 Z" />;
    case 'tri': return <path className={cls} d="M0,0.6 L0.6,-0.5 L-0.6,-0.5 Z" />;
    case 'half': return <rect className={cls} x="-0.6" y="0" width="1.2" height="0.6" />;
    case 'corner': return <path className={cls} d="M-0.55,0.6 L-0.15,0.6 L-0.15,-0.2 L0.55,-0.2 L0.55,-0.6 L-0.55,-0.6 Z" />;
    case 'hook': return <path className={cls} d="M-0.5,0.6 L0.5,0.6 L0.5,-0.6 L0.1,-0.6 L0.1,0.2 L-0.5,0.2 Z" />;
    default: return <text className={cls} transform="scale(1,-1)" y="0.05" textAnchor="middle" dominantBaseline="middle" fontSize="1.25" fontWeight="700">{glyph}</text>;
  }
}
const fillClass = content => (content?.fill ? ` fill-${content.fill}` : '');

function CellFace({ content }) {
  return <svg className="net-face" viewBox="-1 -1 2 2" aria-hidden="true" focusable="false">
    <g transform="scale(1,-1)">{content && <Glyph glyph={content.glyph} fill={content.fill} />}</g>
  </svg>;
}

// ---------- net as an HTML grid ----------
export function NetDiagram({ cells, states = {}, onSelect, focusSelects = false, selected = null, label, compact = false, size = null }) {
  const maxX = Math.max(...cells.map(c => c.x)), maxY = Math.max(...cells.map(c => c.y));
  const describe = (c, i) => `Square ${i + 1}${c.content ? ', ' + contentLabel(c.content) : ''}`;
  const description = label ?? `Net of six squares: ${cells.map(c => (c.content ? contentLabel(c.content) : 'blank')).join(', ')}`;
  const variant = size ?? (compact ? 'compact' : 'normal');
  return <div className={`net-grid is-${variant}`} role={onSelect ? 'group' : 'img'} aria-label={description}
    style={{ gridTemplateColumns: `repeat(${maxX + 1}, var(--cell))`, gridTemplateRows: `repeat(${maxY + 1}, var(--cell))` }}>
    {cells.map((c, i) => {
      const style = { gridColumn: c.x + 1, gridRow: maxY - c.y + 1 };
      const className = `net-cell${fillClass(c.content)}${states[i] ? ' ' + states[i] : ''}${selected === i ? ' is-selected' : ''}`;
      return onSelect
        ? <button key={i} type="button" className={className} style={style} aria-pressed={selected === i} aria-label={describe(c, i)} onClick={() => onSelect(i)} onFocus={focusSelects ? () => onSelect(i) : undefined}><CellFace content={c.content} /></button>
        : <span key={i} className={className} style={style}><CellFace content={c.content} /></span>;
    })}
  </div>;
}

// ---------- cube as SVG ----------
export function CubeView({ view, size = 40, highlight = null, label, large = false }) {
  const w = size * 1.8, h = size * 2.15;
  const shown = slotNames.filter(slot => view?.[slot]);
  const description = label ?? (shown.length
    ? `Cube showing ${shown.map(slot => `${contentLabel(view[slot].content)} on the ${slot}`).join(', ')}`
    : 'Empty cube outline');
  return <svg className={`cube-view${large ? ' large' : ''}`} viewBox={`${-w} ${-h} ${2 * w} ${2 * h}`} role="img" aria-label={description}>
    {slotNames.map(slot => {
      const geometry = slotGeometry(slot, size);
      const points = geometry.corners.map(p => p.join(',')).join(' ');
      const face = view?.[slot];
      if (!face) return <polygon key={slot} className="cube-face empty" points={points} />;
      const matrix = slotGlyphMatrix(slot, face.m, size, 0.5);
      return <g key={slot} className={`cube-face-group${highlight === slot ? ' is-highlight' : ''}`}>
        <polygon className={`cube-face${fillClass(face.content)}`} points={points} />
        <g transform={`matrix(${matrix.map(v => v.toFixed(3)).join(' ')})`}>
          {!(face.content.glyph === 'square' && face.content.fill) && <Glyph glyph={face.content.glyph} fill={face.content.fill} />}
        </g>
      </g>;
    })}
  </svg>;
}

// ---------- shared helpers ----------
const letters = 'ABCDEF';
const mixedSet = ['arrow', 'corner', 'hook', 'A', 'half', 'diag'];
function contentsFor(glyphSet) {
  if (glyphSet === 'mixed') return mixedSet.map((glyph, i) => ({ glyph, fill: `c${i + 1}` }));
  return letters.split('').map(glyph => ({ glyph }));
}
const Rz = [[0, -1, 0], [1, 0, 0], [0, 0, 1]], RzInv = [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];
const halfTurn = [[-1, 0, 0], [0, -1, 0], [0, 0, 1]];
const Rx = [[1, 0, 0], [0, 0, -1], [0, 1, 0]], RxInv = [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
const mul3 = (a, b) => a.map(row => [0, 1, 2].map(j => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
const matchRotation = m => rotations.find(r => r.every((row, i) => row.every((v, j) => v === m[i][j]))) ?? identity;
const rotationShowing = normal => rotations.find(r => r[2][0] * normal[0] + r[2][1] * normal[1] + r[2][2] * normal[2] === 1 && r[0][0] * normal[0] + r[0][1] * normal[1] + r[0][2] * normal[2] === 0) ?? identity;

export function IconButton({ label, onClick, children, disabled = false, pressed }) {
  return <button type="button" className="icon-button" aria-label={label} title={label} onClick={onClick} disabled={disabled} aria-pressed={pressed}>{children}</button>;
}
const arrowIcon = rotate => <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" style={{ transform: `rotate(${rotate}deg)` }}><path d="M4 10a6 6 0 1 1 2 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M3 15.5v-4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const tipIcon = flip => <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" style={{ transform: flip ? 'scaleY(-1)' : 'none' }}><path d="M10 3v12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M5 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export function RotationControls({ rotation, onChange }) {
  const turn = m => onChange(matchRotation(mul3(m, rotation)));
  return <div className="icon-cluster" role="group" aria-label="Turn the cube">
    <IconButton label="Turn left" onClick={() => turn(Rz)}>{arrowIcon(0)}</IconButton>
    <IconButton label="Turn right" onClick={() => turn(RzInv)}>{arrowIcon(180)}</IconButton>
    <IconButton label="Tip forward" onClick={() => turn(Rx)}>{tipIcon(false)}</IconButton>
    <IconButton label="Tip back" onClick={() => turn(RxInv)}>{tipIcon(true)}</IconButton>
  </div>;
}

function NetPicker({ index, onChange, orientation, onFlip }) {
  return <div className="net-picker" role="group" aria-label="Choose a net">
    {cubeNets.map((net, i) => <button key={net.id} type="button" className={`net-thumb${i === index ? ' is-active' : ''}`} aria-pressed={i === index} aria-label={`Net ${i + 1} of 11, ${net.family}`} onClick={() => onChange(i)}>
      <NetDiagram cells={net.cells.map(c => ({ ...c }))} size="mini" label={`Net ${i + 1}`} />
    </button>)}
    <IconButton label={`Turn the net (${orientation + 1} of 8)`} onClick={onFlip}>{arrowIcon(0)}</IconButton>
  </div>;
}

function useNet(props) {
  const start = props.netId ? Math.max(0, cubeNets.findIndex(n => n.id === props.netId)) : 0;
  const [index, setIndex] = useState(start);
  const [orientation, setOrientation] = useState(0);
  const contents = useMemo(() => contentsFor(props.glyphSet), [props.glyphSet]);
  const cells = useMemo(() => transformCells(cubeNets[index].cells, orientation).map((c, i) => ({ ...c, content: contents[i] })), [index, orientation, contents]);
  // Fold from the topmost square so the ring of side faces hangs below it and reads upright.
  const root = useMemo(() => cells.reduce((best, c, i) => (c.y > cells[best].y || (c.y === cells[best].y && c.x < cells[best].x) ? i : best), 0), [cells]);
  const fold = useMemo(() => foldNet(cells, root), [cells, root]);
  return { index, setIndex, orientation, flip: () => setOrientation((orientation + 1) % 8), cells, fold };
}

// ---------- fold explorer ----------
export function FoldExplorer({ picker = false, startFolded = 6, ...props }) {
  const net = useNet(props);
  // Start half a turn round, facing the squares that hang below the top one.
  const [rotation, setRotation] = useState(halfTurn);
  const [folded, setFolded] = useState(startFolded);
  const [focus, setFocus] = useState(null);
  useEffect(() => { setFocus(null); }, [net.cells]);
  const { cells, fold } = net;
  const foldedSet = new Set(fold.order.slice(0, folded));
  const full = cubeView({ cells }, fold, rotation);
  const view = Object.fromEntries(slotNames.map(slot => [slot, foldedSet.has(full[slot].cell) ? full[slot] : null]));
  const visibleSlot = focus === null ? null : slotNames.find(slot => full[slot].cell === focus) ?? null;
  const states = {};
  cells.forEach((_, i) => { states[i] = foldedSet.has(i) ? 'is-folded' : 'is-flat'; });
  if (focus !== null) states[focus] += ' is-focus';
  const faceOf = i => {
    const normal = fold.frames[i].n;
    return faceName([0, 1, 2].map(r => rotation[r][0] * normal[0] + rotation[r][1] * normal[1] + rotation[r][2] * normal[2]));
  };
  const status = focus === null
    ? (folded === 6 ? 'All six squares folded. Tap a square to find its face.' : `${folded} of 6 squares folded.`)
    : foldedSet.has(focus)
      ? `${contentLabel(cells[focus].content)} is the ${faceOf(focus)} face${visibleSlot ? '' : ', hidden in this view'}.`
      : `${contentLabel(cells[focus].content)} is still flat. Move the slider to fold it.`;
  return <div className="tool">
    {picker && <NetPicker index={net.index} onChange={net.setIndex} orientation={net.orientation} onFlip={net.flip} />}
    <div className="tool-stage">
      <NetDiagram cells={cells} states={states} selected={focus} focusSelects onSelect={i => setFocus(i)} />
      <CubeView view={view} highlight={visibleSlot} large />
    </div>
    <div className="tool-row">
      <label className="slider">
        <span>Fold</span>
        <input type="range" min="1" max="6" step="1" value={folded} onChange={e => setFolded(Number(e.target.value))} aria-label="Folded squares" />
        <output aria-hidden="true">{folded}/6</output>
      </label>
      <RotationControls rotation={rotation} onChange={setRotation} />
    </div>
    <p className="tool-status" role="status">{status}</p>
  </div>;
}

// ---------- opposite explorer ----------
export function OppositeExplorer({ picker = false, initial = 0, ...props }) {
  const net = useNet({ ...props, glyphSet: 'letters' });
  const [selected, setSelected] = useState(initial);
  const { cells, fold } = net;
  const opposite = oppositeIndex(fold, selected);
  const adjacent = adjacentIndices(fold, selected);
  const states = { [selected]: 'is-focus', [opposite]: 'is-opposite' };
  for (const i of adjacent) states[i] = 'is-adjacent';
  const rotation = rotationShowing(fold.frames[selected].n);
  const view = cubeView({ cells }, fold, rotation);
  const name = i => cells[i].content.glyph;
  return <div className="tool">
    {picker && <NetPicker index={net.index} onChange={i => { net.setIndex(i); setSelected(0); }} orientation={net.orientation} onFlip={net.flip} />}
    <div className="tool-stage">
      <NetDiagram cells={cells} states={states} selected={selected} focusSelects onSelect={i => setSelected(i)} />
      <CubeView view={view} highlight="top" large label={`Cube with ${name(selected)} on top, ${name(view.left.cell)} and ${name(view.right.cell)} beside it, and ${name(opposite)} hidden underneath`} />
    </div>
    <ul className="legend">
      <li><span className="swatch-dot is-focus" /> {name(selected)} on top</li>
      <li><span className="swatch-dot is-opposite" /> {name(opposite)} opposite, hidden underneath</li>
      <li><span className="swatch-dot is-adjacent" /> {adjacent.map(name).join(', ')} touch it</li>
    </ul>
  </div>;
}

// ---------- net builder ----------
export function NetBuilder({ question, onResult, scored = false }) {
  const [placements, setPlacements] = useState(() => question.shape.map(() => null));
  const [colour, setColour] = useState(question.palette[0]);
  const [result, setResult] = useState(null);
  const [checks, setChecks] = useState(0);
  const locked = scored && result?.correct;
  const place = i => {
    if (locked) return;
    const next = [...placements];
    if (next[i] === colour) next[i] = null;
    else {
      const previous = next.indexOf(colour);
      if (previous >= 0) next[previous] = null;
      next[i] = colour;
    }
    setPlacements(next);
    setResult(null);
  };
  const check = () => {
    const outcome = checkBuild(question, placements);
    setResult(outcome);
    setChecks(checks + 1);
    if (checks === 0 || outcome.correct) onResult?.(outcome, checks === 0);
  };
  const cells = question.shape.map((c, i) => ({ ...c, content: placements[i] ? { glyph: 'square', fill: placements[i] } : null }));
  return <div className="tool net-builder">
    <div className="tool-stage">
      <div className="builder-views">
        <CubeView view={question.views[0]} label="Front corner of the cube" />
        <CubeView view={question.views[1]} label="Back corner of the cube" />
      </div>
      <NetDiagram cells={cells} onSelect={place} label="Blank net to colour" />
    </div>
    <div className="tool-row">
      <fieldset className="palette">
        <legend className="visually-hidden">Colour to place</legend>
        {question.palette.map(fill => <label key={fill} className={`palette-chip fill-${fill}${placements.includes(fill) ? ' is-placed' : ''}`} title={paletteNames[fill]}>
          <input type="radio" name={`colour-${question.seed}`} value={fill} aria-label={paletteNames[fill]} checked={colour === fill} onChange={() => setColour(fill)} disabled={locked} />
        </label>)}
      </fieldset>
      <button type="button" className="pill" onClick={check} disabled={locked}>Check my net</button>
      <button type="button" className="pill quiet" onClick={() => { setPlacements(question.shape.map(() => null)); setResult(null); }} disabled={locked}>Clear</button>
    </div>
    <p className={`tool-status${result ? (result.correct ? ' is-correct' : ' is-wrong') : ''}`} role="status">{result?.feedback ?? ''}</p>
  </div>;
}

export function buildPracticeQuestion(seed) { return generateQuestion('build-net', seed); }
