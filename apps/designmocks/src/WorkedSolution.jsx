import React, { useState } from "react";

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

function renderShape({ tag, attrs, text, children }, index) {
  const props = Object.fromEntries(Object.entries(attrs).map(([name, value]) => [svgProps[name] ?? name, value]));
  return React.createElement(tag, { ...props, key: index }, children?.map(renderShape) ?? text);
}

export function WorkedSolution({ solution, explanation, figureUrl, mediaStatus, onRetry }) {
  const [step, setStep] = useState(0);
  const [failedUrl, setFailedUrl] = useState(null);
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
              {solution.steps.slice(0, step + 1).map((item, index) => <g key={index}>{item.shapes.map(renderShape)}</g>)}
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
          onClick={() => setStep(step - 1)}>Previous step</button>
        <span aria-live="polite">Step {step + 1} of {solution.steps.length}</span>
        <button type="button" className="button quiet" disabled={step === solution.steps.length - 1}
          onClick={() => setStep(step + 1)}>Next step</button>
      </div>
      <ol>
        {solution.steps.map((item, index) => (
          <li key={index} aria-current={index === step ? "step" : undefined}>{item.text}</li>
        ))}
      </ol>
      <details>
        <summary>Full explanation</summary>
        <p className="worked-solution-text">{explanation}</p>
      </details>
    </div>
  );
}
