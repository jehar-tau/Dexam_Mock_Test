// Sign-in-free review route for drawing tasks inside year papers
// (DRAWING_SECTION_SPEC.md). Development and hosted review builds only.
// The task, photos and scores are fictional; no official paper content.
import React, { useEffect, useState } from "react";
import { DrawingCriteria, DrawingGraceBanner, DrawingTaskReview } from "./DrawingTask.jsx";

const svg = body => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="#f7f4ea"/>${body}</svg>`)}`;
const pencil = 'fill="none" stroke="#3b3b3b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
const photoOne = svg(`<g ${pencil}><path d="M40 300 L260 300"/><path d="M70 300 L70 150 L230 120 L230 300"/><path d="M60 155 L240 118"/><path d="M95 300 L95 230 L135 230 L135 300"/><circle cx="115" cy="205" r="12"/><path d="M115 217 L115 260 M100 238 L130 238 M115 260 L105 290 M115 260 L125 290"/><path d="M170 170 q20 -30 40 0" /><path d="M160 60 l-8 20 M190 50 l-8 20 M220 62 l-8 20 M250 48 l-8 20 M130 52 l-8 20"/><path d="M180 300 q10 -40 30 -40 q20 0 25 40"/></g>`);
const photoTwo = svg(`<g ${pencil}><rect x="40" y="60" width="220" height="140" rx="6"/><path d="M40 120 L260 120 M150 60 L150 200"/><path d="M60 260 q40 -40 80 0 t80 0"/><path d="M70 320 L230 320 M90 340 L210 340"/></g>`);

const criteria = [
  { id: "idea", label: "Idea and usefulness", max: 5 },
  { id: "composition", label: "Proportion and composition", max: 5 },
  { id: "sketching", label: "Quality of sketching", max: 5 },
  { id: "story", label: "People, setting and story", max: 5 },
];
const instructions = ["Use only black or HB pencils", "Do not use other colours", "Draw only in the given space"];
const task = {
  label: "TASK B2",
  prompt: "A bus stop on a busy road floods every monsoon. Design a shelter that keeps waiting passengers dry and lets them see the bus coming. Sketch the shelter in use on a rainy evening, from the point of view of a child waiting with a parent.",
  marks: 20, criteria, criteriaSource: "printed-equal-split", instructions,
  notes: "A strong answer shows the shelter solving both problems at once: a raised floor or drain for the flooding and a clear view down the road. The child’s eye level is low, so the roof, the parent and the approaching bus loom large. Rain, reflections and people’s posture carry the mood without colour.",
};
const ready = {
  status: "ready", canReevaluate: true,
  summary: "A clear, believable shelter with a raised floor and a good child’s-eye view. Add more of the busy road and the approaching bus to tell the story fully.",
  criteria: [
    { id: "idea", score: 4, reason: "The raised floor and wide roof answer the flooding; the side panel is see-through so the bus stays visible." },
    { id: "composition", score: 3.5, reason: "The low viewpoint works, but the parent is smaller than they would look from a child’s height." },
    { id: "sketching", score: 3, reason: "Confident outlines; the rain and shadows are uneven and the roof edge wobbles." },
    { id: "story", score: 2.5, reason: "The waiting pair is clear, but the road, traffic and evening light are only hinted at." },
  ],
  flags: [],
};
const states = {
  ready: { name: "Scored", estimate: ready, photos: [photoOne, photoTwo] },
  checked: { name: "Checked by DMocks", estimate: { ...ready, canReevaluate: false, override: { score: 14, note: "The sketching mark was raised after a check." } }, photos: [photoOne, photoTwo] },
  flagged: { name: "Flagged", estimate: { status: "ready", canReevaluate: true, summary: "The photo shows a sketch of a phone, not a bus shelter.", flags: ["off_task", "uses_colour_when_forbidden"], criteria: criteria.map(item => ({ id: item.id, score: 1, reason: "" })) }, photos: [photoTwo] },
  evaluating: { name: "Evaluating", estimate: { status: "evaluating" }, photos: [photoOne, photoTwo] },
  unavailable: { name: "Unavailable", estimate: { status: "unavailable", canReevaluate: true }, photos: [photoOne] },
  none: { name: "Not attempted", estimate: { status: "not_attempted" }, photos: [] },
};

export default function DrawingTaskPreview() {
  const [state, setState] = useState("ready");
  const [left, setLeft] = useState(582);
  useEffect(() => {
    const timer = setInterval(() => setLeft(value => (value > 1 ? value - 1 : 600)), 1000);
    return () => clearInterval(timer);
  }, []);
  const current = states[state];
  return <section className="wrap section drawing-preview">
    <span className="eyebrow">DRAWING TASKS PREVIEW · FICTIONAL TASK AND SCORES</span>
    <h1>Drawing tasks in a paper</h1>
    <p>Students draw on paper, photograph it and upload the photo. An AI model estimates a score against the task’s criteria.</p>

    <h2>1. While the paper runs</h2>
    <div className="drawing-preview-attempt">
      <p className="drawing-task-prompt">{task.prompt}</p>
      <DrawingCriteria criteria={criteria} criteriaSource={task.criteriaSource} instructions={instructions} />
    </div>

    <h2>2. When the clock ends</h2>
    <DrawingGraceBanner remainingSeconds={left} taskCount={2} />

    <h2>3. In the answer review</h2>
    <div className="drawing-preview-states" role="group" aria-label="Estimate state">
      {Object.entries(states).map(([key, value]) => <button key={key} type="button" className={key === state ? "button" : "button quiet"} aria-pressed={key === state} onClick={() => setState(key)}>{value.name}</button>)}
    </div>
    <DrawingTaskReview {...task} photos={current.photos.map((url, index) => ({ id: index, url }))} estimate={current.estimate}
      onReevaluate={() => setState("evaluating")} />
  </section>;
}
