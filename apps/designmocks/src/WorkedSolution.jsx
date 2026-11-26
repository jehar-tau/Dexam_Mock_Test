import React, { useEffect, useState } from "react";
import { parseSolutionText } from "./solution-text.mjs";

const svgProps = {
  "fill-opacity": "fillOpacity",
  "stroke-width": "strokeWidth",
  "stroke-dasharray": "strokeDasharray",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "font-size": "fontSize",
  "font-weight": "fontWeight",
  "text-anchor": "textAnchor",
};

const drawable = new Set(["line", "path", "polyline", "polygon"]);
// Lines and outlines in the newest step are drawn on; other shapes fade in.
function renderShape({ tag, attrs, text, children }, index, draw = false) {
  const props = Object.fromEntries(Object.entries(attrs).map(([name, value]) => [svgProps[name] ?? name, value]));
  if (draw && drawable.has(tag) && !attrs["stroke-dasharray"] && attrs.stroke && attrs.stroke !== "none") {
    props.pathLength = "1"; props.className = "worked-draw";
  }
  return React.createElement(tag, { ...props, key: index }, children?.map((child, i) => renderShape(child, i, draw)) ?? text);
}

export function WorkedSolution({ solution, explanation, figureUrl, mediaStatus, onRetry, children }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failedUrl, setFailedUrl] = useState(null);
  const last = solution.steps.length - 1;
  useEffect(() => {
    if (!playing) return;
    if (step >= last) { setPlaying(false); return; }
    const timer = setTimeout(() => setStep(value => Math.min(value + 1, last)), 2400);
    return () => clearTimeout(timer);
  }, [playing, step, last]);
  const go = value => { setPlaying(false); setStep(value); };
  const { width, height } = solution.figure;
  const showFigure = figureUrl && figureUrl !== failedUrl;
  return (
    <div className="worked-solution">
      <h4>Worked solution</h4>
      <p>{solution.keyIdea}</p>
      {showFigure ? (
        <figure className="worked-solution-figure">
          <div>
            <img src={figureUrl} width={width} height={height} alt="Question figure annotated for the current solution step"
              onError={() => setFailedUrl(figureUrl)} />
            <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
              {solution.steps.slice(0, step + 1).map((item, index) => <g key={index} className={index === step ? "worked-step-current" : "worked-step-done"}>{item.shapes.map((shape, i) => renderShape(shape, i, index === step))}</g>)}
            </svg>
          </div>
        </figure>
      ) : mediaStatus === "loading" ? <p role="status">Loading the solution figure…</p> : (
        <div>
          <p role="status">The solution figure couldn’t load. You can still read each step.</p>
          <button type="button" className="text-button" onClick={() => { setFailedUrl(null); onRetry(); }}>Retry solution figure</button>
        </div>
      )}
      <div className="worked-solution-controls">
        <button type="button" className="button quiet" disabled={step === 0}
          onClick={() => go(step - 1)}>Previous step</button>
        <button type="button" className="button worked-play" aria-pressed={playing} disabled={!playing && step === last && last === 0}
          onClick={() => { if (playing) setPlaying(false); else { if (step === last) setStep(0); setPlaying(true); } }}>
          {playing ? "Pause" : step === last && last > 0 ? "Replay steps" : "Play steps"}</button>
        <span aria-live="polite">Step {step + 1} of {solution.steps.length}</span>
        <button type="button" className="button quiet" disabled={step === last}
          onClick={() => go(step + 1)}>Next step</button>
      </div>
      <div className="worked-progress" aria-hidden="true">{solution.steps.map((item, index) =>
        <i key={index} data-state={index < step ? "done" : index === step ? "current" : "next"} />)}</div>
      <ol>
        {solution.steps.map((item, index) => (
          <li key={index} aria-current={index === step ? "step" : undefined}>
            <button type="button" className="worked-step-jump" onClick={() => go(index)}>{item.text}</button></li>
        ))}
      </ol>
      {children}
      <details>
        <summary>Full explanation</summary>
        <p className="worked-solution-text">{explanation}</p>
      </details>
    </div>
  );
}

const verdictLabels = { correct: "Correct", wrong: "Incorrect", partial: "Partly correct" };

function SolutionExtras({ parsed }) {
  if (!parsed) return null;
  return <>
    {parsed.options.length > 0 && <section className="solution-options" aria-label="Option by option">
      <h5>Option by option</h5>
      <ul>{parsed.options.map(item => <li key={item.option} data-verdict={item.verdict}>
        <b>{item.option}</b><span className="solution-verdict">{verdictLabels[item.verdict]}</span><p>{item.why}</p></li>)}</ul>
    </section>}
    {parsed.trap && <aside className="solution-callout" data-kind="trap"><h5>Common trap</h5><p>{parsed.trap}</p></aside>}
    {parsed.faster && <aside className="solution-callout" data-kind="faster"><h5>Faster method</h5><p>{parsed.faster}</p></aside>}
  </>;
}

// Released explanations become key idea, steps, option check, trap and faster
// method. A reviewed worked solution adds the figure animation to the steps.
export function SolutionPanel({ explanation, solution, figureUrl, mediaStatus, onRetry }) {
  const parsed = parseSolutionText(explanation);
  if (solution) return <WorkedSolution solution={solution} explanation={explanation} figureUrl={figureUrl}
    mediaStatus={mediaStatus} onRetry={onRetry}><SolutionExtras parsed={parsed} /></WorkedSolution>;
  if (!parsed) return <div className="analysis-explanation"><h4>Explanation</h4><p className="worked-solution-text">{explanation}</p></div>;
  return <div className="analysis-explanation solution-structured">
    <h4>Explanation</h4>
    <div className="solution-key"><span>Key idea</span><p>{parsed.keyIdea}</p></div>
    <ol className="solution-steps">{parsed.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
    <SolutionExtras parsed={parsed} />
  </div>;
}
