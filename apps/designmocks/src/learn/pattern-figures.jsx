import React from 'react';
import { placed } from './pattern-shapes.js';

// Panels of shapes for patterns.js, drawn from the same outlines the tests compare.
const describe = panel => panel.map(i => `${i.fill} ${i.shape}`).join(', ');
export function Panel({ panel, size = 64, label, ask = false }) {
  return <svg className={`pattern-panel${ask ? ' is-ask' : ''}`} viewBox="0 0 1 1" width={size} height={size} role="img" aria-label={label ?? (ask ? 'The missing figure' : `Figure: ${describe(panel)}`)}>
    <rect className="pattern-frame" x="0.01" y="0.01" width="0.98" height="0.98" rx="0.04" />
    {ask ? <text className="pattern-ask" x="0.5" y="0.66">?</text>
      : panel.map((item, i) => <polygon key={i} className={`pattern-item fill-${item.fill}`} points={placed(item).map(p => p.map(v => v.toFixed(4)).join(',')).join(' ')} />)}
  </svg>;
}
export function PanelRow({ panels, ask = false, analogy = false }) {
  return <div className="pattern-row" role="group" aria-label={analogy ? 'First figure changes into the second; third figure' : `Series of ${panels.length} figures, then the missing one`}>
    {panels.map((p, i) => <React.Fragment key={i}>
      <Panel panel={p} />
      {analogy && i === 0 && <span className="pattern-sep" aria-hidden="true">→</span>}
      {analogy && i === 1 && <span className="pattern-sep" aria-hidden="true">as</span>}
    </React.Fragment>)}
    {analogy && <span className="pattern-sep" aria-hidden="true">→</span>}
    {(ask || analogy) && <Panel panel={[]} ask />}
  </div>;
}
export function PanelGrid({ grid }) {
  return <div className="pattern-grid" role="group" aria-label="A three by three grid of figures with the bottom-right one missing">
    {grid.flatMap((row, r) => row.map((p, c) => <Panel key={`${r}-${c}`} panel={p ?? []} ask={!p} />))}
  </div>;
}
