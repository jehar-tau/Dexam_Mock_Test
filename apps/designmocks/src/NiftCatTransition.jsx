import React from "react";
import {Link} from "react-router-dom";

export function NiftCatTransition({seconds, onContinue, workspaceHref}) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const clock = minutes + ":" + String(Math.max(0,seconds) % 60).padStart(2,"0");
  return <section className="wrap section sample-result" aria-labelledby="nift-cat-start-heading">
    <Link className="back-link" to={workspaceHref}>← Your workspace</Link>
    <p className="eyebrow">NIFT · Creative Ability Test</p>
    <h1 id="nift-cat-start-heading">Your GAT is complete.</h1>
    <p>The three-hour CAT clock has started. You can take a break here or open the drawing tasks now.</p>
    <p role="timer" aria-label="CAT time remaining"><strong>{clock}</strong> remaining</p>
    <button type="button" className="button" onClick={onContinue}>Open CAT drawing tasks</button>
  </section>;
}
