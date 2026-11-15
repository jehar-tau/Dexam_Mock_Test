// Figures and the piece-fitter tool for fit and embedded figures.
import { useState } from 'react';
import { Outline } from './surface-figures.jsx';
import { flip, normalise, shapeKey, turn } from './fit.js';

export function Pieces({ pieces = [], compact = false }) {
  return <span className="pieces-figure" role="group" aria-label={`${pieces.length} pieces`}>{pieces.map((cells, i) => <Outline key={i} cells={cells} holes={[]} compact={compact} />)}</span>;
}

// Turn or flip a piece until it matches the gap.
const GAP = [[1, 0], [1, 1], [1, 2], [2, 0]];
const BOARD = [0, 1, 2, 3].flatMap(x => [0, 1, 2].map(y => [x, y])).filter(c => !GAP.some(g => g[0] === c[0] && g[1] === c[1]));
const START = turn(normalise(GAP));
export function PieceFitter() {
  const [piece, setPiece] = useState(START);
  const [flips, setFlips] = useState(0);
  const fits = shapeKey(piece) === shapeKey(GAP);
  return <div className="tool">
    <div className="tool-stage piece-stage">
      <Outline cells={BOARD} holes={GAP} />
      <Outline cells={piece} holes={[]} label="piece" />
    </div>
    <div className="icon-cluster" role="group" aria-label="Move the piece">
      <button type="button" className="chip" onClick={() => setPiece(p => turn(p))}>Turn a quarter</button>
      <button type="button" className="chip" onClick={() => { setPiece(p => flip(p)); setFlips(f => f + 1); }}>Flip over</button>
    </div>
    <p className="tool-status" role="status">{fits ? 'It fits the gap exactly.' : flips % 2 ? 'Flipped over, it is the mirror image: no amount of turning makes it fit. Flip it back.' : 'Not yet: turn it until it matches the gap.'}</p>
  </div>;
}
