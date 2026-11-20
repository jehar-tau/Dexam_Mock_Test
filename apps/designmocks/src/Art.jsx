import React from "react";
export function Arrow({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}
export function Spark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path
        d="M16 2h8l-1 12 9-8 6 6-11 8 11 8-6 6-9-8 1 12h-8l1-12-9 8-6-6 11-8L2 12l6-6 9 8Z"
        fill="currentColor"
      />
    </svg>
  );
}
export function Art({ kind = "space", className = "" }) {
  return (
    <svg
      className={"art " + className}
      viewBox="0 0 360 260"
      fill="none"
      aria-hidden="true"
    >
      {kind === "space" && (
        <>
          <path d="M71 188 180 124l110 64-110 63Z" fill="#dceba1" />
          <path d="m100 99 80-46 80 46-80 46Z" fill="#edc668" />
          <path d="m100 99 80 46v84l-80-46Z" fill="#386451" />
          <path d="m180 145 80-46v84l-80 46Z" fill="#244735" />
          <path
            d="m100 99 80-46 80 46v84l-80 46-80-46Zm80 46v84m-80-130 80 46 80-46"
            stroke="#162824"
            strokeWidth="2"
          />
          <path
            d="m288 60 20 8-20 8m20-8h-45"
            stroke="#ef633d"
            strokeWidth="3"
          />
          <circle cx="64" cy="72" r="19" fill="#ef633d" />
          <path d="M48 72h32M64 56v32" stroke="#faf9f3" strokeWidth="2" />
        </>
      )}
      {kind === "ideas" && (
        <>
          <path d="M67 191h224" stroke="#162824" strokeWidth="2" />
          <rect x="86" y="117" width="60" height="74" fill="#ef633d" />
          <circle cx="182" cy="143" r="48" fill="#edc668" />
          <path d="m256 71 47 120h-94Z" fill="#386451" />
          <path
            d="M80 213h223M113 48v44m-22-22h44"
            stroke="#244735"
            strokeWidth="2"
          />
          <circle cx="166" cy="70" r="9" fill="#244735" />
          <path
            d="M63 37c41-17 96-13 127 0"
            stroke="#244735"
            strokeWidth="2"
            strokeDasharray="5 5"
          />
        </>
      )}
      {kind === "pattern" && (
        <>
          <rect
            x="67"
            y="42"
            width="226"
            height="177"
            rx="4"
            fill="#faf9f3"
            stroke="#244735"
            strokeWidth="2"
          />
          {[0, 1, 2].flatMap((r) =>
            [0, 1, 2, 3].map((c) => (
              <g
                key={r + "-" + c}
                transform={`translate(${91 + c * 51} ${65 + r * 53})`}
              >
                <path
                  d="M0 0h38v38H0Z"
                  fill={["#edc668", "#386451", "#ef633d"][(r + c) % 3]}
                />
                <path
                  d={(r + c) % 2 ? "M0 0 38 38H0Z" : "M0 38 38 0v38Z"}
                  fill="#dceba1"
                />
              </g>
            )),
          )}
          <path
            d="m40 198 27-8m233-148 18-17"
            stroke="#ef633d"
            strokeWidth="3"
          />
        </>
      )}
      {kind === "object" && (
        <>
          <path d="M66 217h242" stroke="#244735" strokeWidth="2" />
          <path
            d="M159 207h92M205 207V87l-55-34"
            stroke="#244735"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="m150 53-51 47 75 33 7-68Z"
            fill="#edc668"
            stroke="#244735"
            strokeWidth="2"
          />
          <path d="m100 100 74 33-49 68-66-17Z" fill="#dceba1" />
          <rect x="69" y="184" width="48" height="25" fill="#ef633d" />
          <path d="m248 58 14-17m1 37 23-3" stroke="#ef633d" strokeWidth="3" />
          <circle cx="279" cy="130" r="25" fill="#386451" />
        </>
      )}
      {kind === "report" && (
        <>
          <rect
            x="78"
            y="24"
            width="198"
            height="217"
            rx="3"
            fill="#fffdf5"
            stroke="#244735"
            strokeWidth="2"
          />
          <path d="M99 55h132m-132 16h81" stroke="#244735" strokeWidth="3" />
          <circle cx="125" cy="114" r="20" fill="#edc668" />
          <path d="m116 114 6 6 13-14" stroke="#244735" strokeWidth="3" />
          {[0, 1, 2].map((r) => (
            <g key={r}>
              <path
                d={`M100 ${163 + r * 22}h151`}
                stroke="#dde0d4"
                strokeWidth="7"
              />
              <path
                d={`M100 ${163 + r * 22}h${[116, 76, 132][r]}`}
                stroke={["#386451", "#edc668", "#ef633d"][r]}
                strokeWidth="7"
              />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
const shapeCells = {
  base: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  choices: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 0],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
      [1, 2],
    ],
  ],
};
function Shape({ cells, color = "#244735" }) {
  return (
    <svg viewBox="0 0 130 100" aria-hidden="true">
      {cells.map(([x, y], i) => (
        <rect
          key={i}
          x={30 + x * 24}
          y={12 + y * 24}
          width="22"
          height="22"
          rx="1"
          fill={color}
        />
      ))}
    </svg>
  );
}
export function Stimulus({ kind }) {
  if (kind === "rotation")
    return (
      <div className="rotation-stimulus" role="img" aria-label="Three squares in a vertical column with a fourth square to the right of the bottom square. Rotate the shape 90 degrees clockwise.">
        <Shape cells={shapeCells.base} />
        <span>↻ 90°</span>
        <span className="missing">?</span>
      </div>
    );
  if (kind === "contrast")
    return (
      <div className="stimulus-caption">
        Look for the greatest difference in lightness.
      </div>
    );
  if (kind === "sequence")
    return (
      <div className="pattern-matrix" role="img" aria-label="Top row: one circle, two circles, three circles. Bottom row: one square, two squares, empty tile.">
        {[1, 2, 3, 1, 2, 0].map((n, i) => (
          <div key={i}>
            {n ? (
              Array.from({ length: n }, (_, j) => (
                <i key={j} className={i < 3 ? "round" : ""} />
              ))
            ) : (
              <b>?</b>
            )}
          </div>
        ))}
      </div>
    );
  if (kind === "hierarchy")
    return (
      <div className="brief-strip">
        <span>01 / TITLE</span>
        <span>02 / DATE</span>
        <span>03 / VENUE</span>
      </div>
    );
  return (
    <svg
      className="negative-stimulus"
      viewBox="0 0 320 150"
      role="img"
      aria-label="White slots sit at the left, left of centre, right of centre and right of a dark rectangle. A shallow white notch opens at its top edge."
    >
      <path d="M35 25h250v100H35Z" fill="#244735" />
      <path
        d="M58 48h32v50H58Zm55 0h32v50h-32Zm55 0h32v50h-32Zm55 0h32v50h-32Zm-95-23h20v15h-20Z"
        fill="#faf9f3"
      />
    </svg>
  );
}
const rotationDescriptions = [
  "Three squares down the right, with one to the left of the top square.",
  "Three squares along the bottom, with one above the right end.",
  "Three squares along the top, with one below the left end.",
  "Three squares down the right, with one to the left of the bottom square.",
];

export function describeChoice(kind, index, legacyRotation) {
  if (kind === "rotation") return rotationDescriptions[legacyRotation && index === 1 ? 2 : index];
  if (kind === "contrast") return ["Beige and cream.", "Dark green-black and pale cream.", "Medium green and sage.", "Orange and yellow."][index];
  if (kind === "sequence") return index === 0 ? "One square." : (index + 1) + " squares.";
  if (kind === "hierarchy") return ["Title largest, date next, venue smallest.", "Date largest.", "Venue largest.", "All three lines the same size."][index];
  return String(index + 1);
}

export function ChoiceArt({ kind, index, legacyRotation = false }) {
  if (kind === "rotation") return <Shape cells={shapeCells.choices[legacyRotation && index === 1 ? 2 : index]} />;
  if (kind === "contrast") {
    const pairs = [
      ["#c8c6b1", "#f0e9d2"],
      ["#162824", "#faf9f3"],
      ["#4d6a53", "#8fa68a"],
      ["#ef633d", "#edc668"],
    ];
    return (
      <span className="contrast-pair">
        {pairs[index].map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
      </span>
    );
  }
  if (kind === "sequence")
    return (
      <span className="sequence-choice">
        {Array.from({ length: index + 1 }, (_, i) => (
          <i key={i} />
        ))}
      </span>
    );
  if (kind === "hierarchy")
    return (
      <span className={"mini-poster poster-option-" + index}>
        <b>OPEN STUDIO</b>
        <strong>16 NOV</strong>
        <small>ROOM 04</small>
      </span>
    );
  return <span className="number-choice">{index + 1}</span>;
}
