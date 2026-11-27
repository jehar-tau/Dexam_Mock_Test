import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { platform } from "./platform.js";
import { useAuthState } from "./useAuth.js";
import { freeAllowance } from "./config.js";

// One short line and a link to /plans, shown at the moment a free limit is reached.
// `live` announces it; static notes beside a form stay out of its status region.
export function PassPrompt({ children, cta = "See plans", className = "", live = true }) {
  return <p className={`pass-prompt ${className}`.trim()} role={live ? "status" : undefined}>{children} <Link to="/plans">{cta} →</Link></p>;
}

// After a paper: the first worked solutions are free, the rest come with the pass.
export function LockedSolutionsPrompt({ count }) {
  if (!Number.isInteger(count) || count < 1) return null;
  return <PassPrompt cta={`See how to solve the other ${count}`}>
    You’ve seen worked solutions for the first {freeAllowance.workedSolutionsPerPaper} questions.
  </PassPrompt>;
}

export function LockedSolution() {
  return <div className="analysis-explanation solution-locked">
    <h4>Worked solution</h4>
    <PassPrompt live={false}>The answer key is above. The step-by-step solution comes with the pass.</PassPrompt>
  </div>;
}

// Shown where a drawing is uploaded. The server decides what reaches a teacher.
export function DrawingMarkingNote({ client = platform }) {
  const { session } = useAuthState();
  const actorId = session?.user.id;
  const [allowance, setAllowance] = useState(null);
  useEffect(() => {
    setAllowance(null);
    if (!actorId || !client) return;
    const controller = new AbortController();
    client.rpc("my_drawing_marking_allowance").abortSignal(controller.signal).then(({ data, error }) => {
      if (!controller.signal.aborted && !error && data && typeof data.passActive === "boolean") setAllowance(data);
    }, () => {});
    return () => controller.abort();
  }, [actorId, client]);
  if (!allowance) return null;
  if (!allowance.passActive) return <PassPrompt className="drawing-marking-note" live={false}>
    Teacher marking comes with the pass: {freeAllowance.drawingMarkingPerMonth} drawings a month, marked against the exam criteria.
  </PassPrompt>;
  return <p className="drawing-marking-note">
    Teacher marking: {allowance.remaining} of {allowance.monthlyLimit} drawings left this month.
    {allowance.remaining === 0 && " New drawings are marked from the 1st of next month."}
  </p>;
}
