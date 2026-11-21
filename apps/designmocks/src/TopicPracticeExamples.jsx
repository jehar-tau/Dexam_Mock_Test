import React, { useState } from "react";

// The numbers only exercise the builder's session-size rules in the local preview.
export const examplePools = [
  { exam: "uceed", topic: "observation", questions: 30 },
  { exam: "uceed", topic: "spatial-reasoning", questions: 10 },
  { exam: "nift", topic: "general-aptitude", questions: 30 },
  { exam: "nid", topic: "visual-patterns", questions: 30 },
  { exam: "ceed", topic: "visual-composition", questions: 30 },
  { exam: "nift", topic: "proportion", questions: 20 },
  { exam: "nid", topic: "symmetry", questions: 20 },
  { exam: "ceed", topic: "data-interpretation", questions: 30 },
];

const examples = {
  proportion: {
    figure: "strip",
    prompt: "What is the ratio of orange panels to green panels?",
    choices: ["2 to 1", "1 to 2", "2 to 3"], answer: "1 to 2",
    reason: "Two of the six panels are orange and four are green. The ratio 2 to 4 simplifies to 1 to 2.",
    description: "A strip of six equal panels. The first two have orange centres and the other four have green centres.",
  },
  symmetry: {
    figure: "symmetry",
    prompt: "Which line divides the pattern into mirror images?",
    choices: ["Vertical", "Horizontal", "Either line"], answer: "Vertical",
    reason: "Every mark on the left has a partner at the same height on the right. The top and bottom rows have different marks.",
    description: "A square is divided into quarters. The two top quarters each contain a circle, and the two bottom quarters each contain a square.",
  },
  "data-interpretation": {
    figure: "bars",
    prompt: "Which two bars together equal bar C?",
    choices: ["A and B", "A and D", "B and D"], answer: "A and B",
    reason: "A is two units high and B is three. Their total of five matches C.",
    description: "Unit bars A, B, C and D have heights of two, three, five and four respectively.",
  },
  observation: {
    angles: [0, 90, 180, 270], marks: [2, 2, 1, 2],
    prompt: "Which tile changes a detail as well as its orientation?",
    choices: ["Tile A", "Tile B", "Tile C", "Tile D"], answer: "Tile C",
    reason: "The corner rotates, but only C has one dot. Each of the other tiles has two.",
    description: "Four rotated corner tiles. A, B and D each contain two dots. C contains one dot.",
  },
  "spatial-reasoning": {
    angles: [0, 90, 180, 270], marks: [2, 2, 2, 2],
    prompt: "Which tile matches A after a half turn?",
    choices: ["Tile B", "Tile C", "Tile D"], answer: "Tile C",
    reason: "A half turn is 180°. Both the corner and the pair of dots move to the opposite side in C.",
    description: "Tile A has a top-left corner. B points top-right, C bottom-right and D bottom-left. The dots rotate with the corner.",
  },
  "general-aptitude": {
    angles: [0, 0, 0, 0], marks: [1, 2, 2, 3],
    prompt: "What is the average number of dots per tile?",
    choices: ["1.5 dots", "2 dots", "2.5 dots"], answer: "2 dots",
    reason: "There are eight dots across four tiles. Divide 8 by 4 to get 2.",
    description: "Four tiles contain one, two, two and three dots respectively.",
  },
  "visual-patterns": {
    angles: [0, 90, 180, 270], marks: [1, 1, 1, 1],
    prompt: "If the sequence continues, which tile comes after D?",
    choices: ["Tile A", "Tile B", "Tile C"], answer: "Tile A",
    reason: "Every step rotates the corner 90° clockwise. Four steps complete one turn and return to A.",
    description: "Four corner shapes rotate clockwise from top-left to top-right, bottom-right and bottom-left.",
  },
  "visual-composition": {
    angles: [0, 0, 0, 0], marks: [1, 1, 3, 1],
    prompt: "Where does a change in repetition create emphasis?",
    choices: ["Tile A", "Tile C", "Tile D"], answer: "Tile C",
    reason: "The row establishes one dot as its rhythm. Three dots in C interrupt it and draw the eye.",
    description: "Four identical corner shapes. Tiles A, B and D have one dot each. Tile C has three.",
  },
};

function ExampleDiagram({ example }) {
  if (example.figure) return <svg className="topic-diagram" viewBox="0 0 360 103" role="img" aria-label={example.description}>
    {example.figure === "strip" && Array.from({ length: 6 }, (_, index) => <g key={index}>
      <rect x={8 + index * 57} y="24" width="55" height="54" rx="2" fill="#e7ecd9" />
      <rect x={18 + index * 57} y="34" width="35" height="34" fill={index < 2 ? "#ab442a" : "#244735"} />
    </g>)}
    {example.figure === "symmetry" && <g>
      <rect x="138" y="7" width="84" height="84" rx="3" fill="#e7ecd9" />
      <path d="M180 7v84m-42-42h84" fill="none" stroke="#53634f" strokeDasharray="3 3" />
      <circle cx="159" cy="28" r="10" fill="#ab442a" /><circle cx="201" cy="28" r="10" fill="#ab442a" />
      <path d="M149 60h20v20h-20z M191 60h20v20h-20z" fill="#244735" />
    </g>}
    {example.figure === "bars" && [2, 3, 5, 4].map((units, index) => <g key={index}>
      {Array.from({ length: units }, (_, level) => <rect key={level} x={30 + 80 * index}
        y={69 - 14 * level} width="42" height="12" fill={index === 2 ? "#ffc19c" : "#e7ecd9"} />)}
      <text x={51 + 80 * index} y="99" fill="#f5f6e9" textAnchor="middle" fontSize="13">{String.fromCharCode(65 + index)}</text>
    </g>)}
  </svg>;
  return <svg className="topic-diagram" viewBox="0 0 360 103" role="img" aria-label={example.description}>
    {example.angles.map((angle, index) => <g key={index} transform={`translate(${12 + index * 88}, 4)`}>
      <rect x="0" y="0" width="72" height="72" rx="5" fill="#e7ecd9" />
      <g transform={`rotate(${angle} 36 36)`}>
        <path d="M13 49V13h36v9H22v27Z" fill="#244735" />
        {Array.from({ length: example.marks[index] }, (_, i) =>
          <circle key={i} cx={30 + i * 11} cy="40" r="4.1" fill="#ab442a" />)}
      </g>
      <text x="36" y="93" textAnchor="middle" fill="#f5f6e9" fontSize="13">{String.fromCharCode(65 + index)}</text>
    </g>)}
  </svg>;
}

export function TopicPracticeExample({ topic }) {
  const [choice, setChoice] = useState("");
  const example = examples[topic];
  if (!example) return <aside className="topic-example"><h2>Try a worked example</h2>
    <p>Choose an exam and topic to see its example.</p></aside>;

  return <aside className="topic-example" aria-labelledby="topic-example-title">
    <div className="topic-example-figure">
      <span>Worked example</span>
      <ExampleDiagram example={example} />
    </div>
    <div className="topic-example-body">
      <h2 id="topic-example-title">{example.prompt}</h2>
      <div className="topic-answer-choices" role="group" aria-label="Answer choices">
        {example.choices.map(answer => <button key={answer} type="button" aria-pressed={choice === answer}
          onClick={() => setChoice(answer)}>{answer}</button>)}
      </div>
      {choice && <p role="status" className="topic-answer-feedback">
        {choice === example.answer ? "Correct. " + example.reason : "Try again. Compare the tiles from left to right."}
      </p>}
    </div>
  </aside>;
}
