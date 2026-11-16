// Animated illustrations for Learn topics and for the four stages of a topic.
// Used on Learn programme cards and programme pages (released 16 November 2026).
//
//   <TopicMotif topic="cube-nets" />        keys match the programme slugs
//   <StageMotif stage="exam-hard" />        foundations | exam-standard | exam-hard | mastery
//
// Drawn on the same canvas and with the same CSS as Motion.jsx.
import React from "react";
import { MotifFrame, MotifSpark } from "./Motion.jsx";

const pts = (list) => list.map(([a, b]) => `${a},${b}`).join(" ");

function Iso({ x, y, w = 30, h = 15, d = 30, className = "" }) {
  return (
    <g className={className}>
      <polygon className="m-cube-left" points={pts([[x - w, y + h], [x, y + 2 * h], [x, y + 2 * h + d], [x - w, y + h + d]])} />
      <polygon className="m-cube-right" points={pts([[x + w, y + h], [x, y + 2 * h], [x, y + 2 * h + d], [x + w, y + h + d]])} />
      <polygon className="m-cube-top" points={pts([[x, y], [x + w, y + h], [x, y + 2 * h], [x - w, y + h]])} />
    </g>
  );
}

function Stack({ cells, cx, cy, w = 30, h = 15, d = 30, from = 1 }) {
  return cells.map(([i, j, k], index) => (
    <Iso key={index} x={cx + (i - j) * w} y={cy + (i + j) * h - k * d} w={w} h={h} d={d} className={"m-drop m-s" + Math.min(8, from + index)} />
  ));
}

function Badge({ x, y, text, step }) {
  return (
    <g className={"m-pop m-s" + step}>
      <circle className="m-orange" cx={x} cy={y} r="20" />
      <text className="m-badge-text" x={x} y={y + 7} textAnchor="middle">{text}</text>
    </g>
  );
}

function Arrow({ x, y, step }) {
  return <path className={"m-line m-draw m-s" + step} pathLength="1" d={`M${x} ${y}h30m-9-8l9 8-9 8`} />;
}

function CubeNets() {
  const net = [[70, 45, "m-lime-solid"], [70, 75, "m-tint"], [40, 75, "m-yellow"], [100, 75, "m-yellow"], [70, 105, "m-lime-solid"], [70, 135, "m-tint"]];
  return (
    <>
      {net.map(([x, y, tone], index) => (
        <rect key={index} className={tone + " m-edge m-pop m-s" + (index + 1)} x={x} y={y + 15} width="30" height="30" />
      ))}
      <Arrow x={152} y={120} step={7} />
      <Iso x={246} y={74} w={40} h={20} d={42} className="m-pop m-s8" />
    </>
  );
}

function NetsOfSolids() {
  const flaps = [
    [[60, 95], [110, 95], [85, 55]],
    [[110, 95], [110, 145], [150, 120]],
    [[60, 145], [110, 145], [85, 185]],
    [[60, 95], [60, 145], [20, 120]],
  ];
  return (
    <>
      <rect className="m-yellow m-edge m-pop m-s1" x="60" y="95" width="50" height="50" />
      {flaps.map((flap, index) => (
        <polygon key={index} className={(index % 2 ? "m-tint" : "m-lime-solid") + " m-edge m-pop m-s" + (index + 2)} points={pts(flap)} />
      ))}
      <Arrow x={160} y={120} step={6} />
      <g className="m-pop m-s7">
        <polygon className="m-cube-top" points={pts([[248, 58], [204, 152], [254, 176]])} />
        <polygon className="m-cube-right" points={pts([[248, 58], [254, 176], [298, 148]])} />
      </g>
    </>
  );
}

function PaperFolding() {
  return (
    <>
      <rect className="m-sheet m-pop m-s1" x="34" y="70" width="100" height="100" />
      <path className="m-dash m-draw m-s2" pathLength="1" d="M84 62v116" />
      <rect className="m-tint m-edge m-foldx m-s3" x="34" y="70" width="50" height="100" />
      <circle className="m-orange m-pop m-s4" cx="60" cy="104" r="9" />
      <Arrow x={146} y={120} step={5} />
      <rect className="m-sheet m-pop m-s6" x="190" y="70" width="100" height="100" />
      <path className="m-dash m-fade m-s6" d="M240 70v100" />
      <circle className="m-orange m-pop m-s7" cx="216" cy="104" r="9" />
      <circle className="m-orange m-pop m-s8" cx="264" cy="104" r="9" />
    </>
  );
}

function MirrorImages() {
  return (
    <>
      <path className="m-dash m-draw m-s1" pathLength="1" d="M160 28v184" />
      <g className="m-pop m-s2">
        <rect className="m-ink" x="80" y="70" width="14" height="100" />
        <rect className="m-ink" x="80" y="70" width="50" height="14" />
        <rect className="m-ink" x="80" y="108" width="36" height="14" />
        <circle className="m-yellow" cx="122" cy="150" r="9" />
      </g>
      <g className="m-slide m-s4" style={{ "--dx": "-46px" }}>
        <rect className="m-orange" x="226" y="70" width="14" height="100" />
        <rect className="m-orange" x="190" y="70" width="50" height="14" />
        <rect className="m-orange" x="204" y="108" width="36" height="14" />
        <circle className="m-yellow" cx="198" cy="150" r="9" />
      </g>
      <MotifSpark x={160} y={120} scale={1.1} className="m-lime-solid m-edge m-pop m-s3" />
    </>
  );
}

function CountingCubes() {
  const cells = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1]];
  return (
    <>
      <Stack cells={cells} cx={136} cy={90} />
      <Badge x={262} y={62} text="7" step={8} />
    </>
  );
}

function gear(radius, teeth, depth = 8) {
  const step = (Math.PI * 2) / teeth;
  const inner = radius - depth / 2;
  const outer = radius + depth / 2;
  const at = (r, a) => `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
  const list = [];
  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const a = tooth * step;
    list.push(at(inner, a), at(inner, a + step * 0.25), at(outer, a + step * 0.35), at(outer, a + step * 0.65), at(inner, a + step * 0.75));
  }
  return list.join(" ");
}

function Mechanisms() {
  return (
    <>
      <g transform="translate(118 122)">
        <g className="m-spin" style={{ animationDuration: "12s" }}>
          <polygon className="m-ink" points={gear(52, 12)} />
          <circle className="m-paper" r="16" />
          <circle className="m-yellow" cx="0" cy="-32" r="5" />
        </g>
      </g>
      <g transform="translate(196 122)">
        <g className="m-spin m-rev" style={{ animationDuration: "6s" }}>
          <polygon className="m-orange" points={gear(26, 6)} transform="rotate(30)" />
          <circle className="m-paper" r="8" />
        </g>
      </g>
      <path className="m-dash" d="M60 50a80 80 0 0 1 116 0" />
      <path className="m-line" d="M168 40l9 10-13 2" />
    </>
  );
}

function CountingFigures() {
  return (
    <>
      <polygon className="m-lime-solid m-fade m-s4" points={pts([[160, 36], [60, 196], [127, 196]])} />
      <polygon className="m-yellow m-fade m-s5" points={pts([[160, 36], [127, 196], [193, 196]])} />
      <polygon className="m-tint m-fade m-s6" points={pts([[160, 36], [193, 196], [260, 196]])} />
      <path className="m-line m-draw m-s1" pathLength="1" d="M160 36L60 196h200Z" />
      <path className="m-line m-draw m-s2" pathLength="1" d="M160 36l-33 160" />
      <path className="m-line m-draw m-s3" pathLength="1" d="M160 36l33 160" />
      <Badge x={270} y={56} text="6" step={8} />
    </>
  );
}

const hues = ["#e5484d", "#ef633d", "#f08c2e", "#edc668", "#dceba1", "#8fc27a", "#3f9a6b", "#2f8f96", "#3f79c4", "#5a5fc7", "#8a55c0", "#c2478f"];

function Colour() {
  const wedge = (index) => {
    const a = ((index * 30 - 105) * Math.PI) / 180;
    const b = ((index * 30 - 75) * Math.PI) / 180;
    const p = (r, t) => `${(160 + r * Math.cos(t)).toFixed(1)} ${(120 + r * Math.sin(t)).toFixed(1)}`;
    return `M${p(38, a)}L${p(92, a)}A92 92 0 0 1 ${p(92, b)}L${p(38, b)}A38 38 0 0 0 ${p(38, a)}Z`;
  };
  return (
    <>
      {hues.map((hue, index) => (
        <path key={hue} className={"m-wedge m-pop m-s" + (Math.floor(index / 2) + 1)} style={{ fill: hue }} d={wedge(index)} />
      ))}
      <g transform="translate(160 120)">
        <g className="m-spin" style={{ animationDuration: "14s" }}>
          <path className="m-line" d="M0-104V104" />
          <circle className="m-paper m-edge" cy="-104" r="7" />
          <circle className="m-paper m-edge" cy="104" r="7" />
        </g>
      </g>
      <circle className="m-paper" cx="160" cy="120" r="30" />
    </>
  );
}

function ViewsAndRotation() {
  const panel = (x, y, squares, step, letter) => (
    <g className={"m-pop m-s" + step} key={letter}>
      <rect className="m-sheet" x={x} y={y} width="56" height="56" rx="7" />
      {squares.map(([a, b], index) => (
        <rect key={index} className="m-ink" x={x + 12 + a * 16} y={y + 12 + b * 16} width="15" height="15" />
      ))}
      <text className="m-label" x={x + 47} y={y + 14} textAnchor="middle">{letter}</text>
    </g>
  );
  return (
    <>
      <Stack cells={[[0, 0, 0], [1, 0, 0], [0, 0, 1]]} cx={84} cy={98} w={32} h={16} d={32} />
      <Arrow x={160} y={120} step={4} />
      {panel(206, 22, [[0, 1], [1, 1]], 5, "T")}
      {panel(206, 92, [[0, 0], [0, 1], [1, 1]], 6, "F")}
      {panel(206, 162, [[0, 0], [0, 1]], 7, "S")}
    </>
  );
}

const pips = {
  1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

function Dice() {
  const face = (x, y, value, step) => (
    <g className={"m-pop m-s" + step} key={value}>
      <rect className="m-sheet" x={x} y={y} width="48" height="48" rx="9" />
      {pips[value].map(([a, b], index) => (
        <circle key={index} className="m-pip" cx={x + 12 + a * 12} cy={y + 12 + b * 12} r="4" />
      ))}
    </g>
  );
  return (
    <>
      {[1, 2, 3].map((value, row) => (
        <React.Fragment key={value}>
          {face(46, 26 + row * 66, value, row * 2 + 1)}
          <path className={"m-dash m-draw m-s" + (row * 2 + 2)} pathLength="1" d={`M100 ${50 + row * 66}h46`} />
          {face(152, 26 + row * 66, 7 - value, row * 2 + 2)}
        </React.Fragment>
      ))}
      <Badge x={258} y={120} text="7" step={7} />
    </>
  );
}

function SolidSurfaces() {
  return (
    <>
      <path className="m-yellow m-fade m-s3" d="M96 76v96a64 20 0 0 0 128 0V76a64 20 0 0 1-128 0Z" />
      <ellipse className="m-lime-solid m-fade m-s2" cx="160" cy="76" rx="64" ry="20" />
      <path className="m-line m-draw m-s1" pathLength="1" d="M96 76a64 20 0 1 0 128 0a64 20 0 1 0-128 0M96 76v96a64 20 0 0 0 128 0V76" />
      <path className="m-dash m-draw m-s4" pathLength="1" d="M96 172a64 20 0 0 1 128 0" />
      <Badge x={266} y={56} text="3" step={6} />
    </>
  );
}

function ShadowsAndLight() {
  return (
    <>
      <g transform="translate(58 54)">
        <g className="m-spin" style={{ animationDuration: "16s" }}>
          <path className="m-line" style={{ stroke: "var(--m-yellow)" }} d="M0-34v-10M0 34v10M-34 0h-10M34 0h10M-24-24l-7-7M24 24l7 7M-24 24l-7 7M24-24l7-7" />
        </g>
        <circle className="m-yellow" r="22" />
      </g>
      <path className="m-line" d="M20 190h280" />
      <polygon className="m-shadow m-grow m-s3" points={pts([[196, 190], [292, 190], [262, 204], [166, 204]])} />
      <path className="m-dash m-draw m-s2" pathLength="1" d="M76 68L292 190" />
      <g className="m-pop m-s1">
        <polygon className="m-cube-left" points={pts([[150, 104], [176, 116], [176, 204], [150, 190]])} />
        <polygon className="m-cube-right" points={pts([[176, 116], [202, 104], [202, 190], [176, 204]])} />
        <polygon className="m-cube-top" points={pts([[150, 104], [176, 92], [202, 104], [176, 116]])} />
      </g>
    </>
  );
}


// ---------- added 16 November 2026: the programmes built after the first twelve ----------
function Quant() {
  return (
    <>
      <path className="m-line" d="M50 196h220" />
      {[[70, 60, "m-tint"], [120, 100, "m-yellow"], [170, 70, "m-lime-solid"], [220, 130, "m-orange"]].map(([x, h, tone], i) => (
        <rect key={x} className={tone + " m-edge m-drop m-s" + (i + 1)} x={x} y={196 - h} width="34" height={h} rx="3" />
      ))}
      <path className="m-mark m-draw m-s6" pathLength="1" d="M87 136L137 96 187 126 237 66" />
      <Badge x={262} y={50} text="%" step={8} />
    </>
  );
}
function CodesPatterns() {
  const box = (x, text, step, tone = "m-paper") => (
    <g key={x} className={"m-pop m-s" + step}>
      <rect className={tone + " m-edge"} x={x} y={96} width="46" height="46" rx="8" />
      <text className="m-number" x={x + 23} y={128} textAnchor="middle">{text}</text>
    </g>
  );
  return <>{box(28, "2", 1)}{box(92, "4", 2)}{box(156, "8", 3)}{box(220, "?", 5, "m-yellow")}<Badge x={243} y={72} text="16" step={8} /></>;
}
function Arrangements() {
  const seats = Array.from({ length: 6 }, (_, i) => { const a = (i * 60 - 90) * Math.PI / 180; return [160 + 78 * Math.cos(a), 120 + 78 * Math.sin(a)]; });
  return (
    <>
      <circle className="m-tint m-edge m-fade m-s1" cx="160" cy="120" r="46" />
      {seats.map(([x, y], i) => <circle key={i} className={(i === 3 ? "m-orange" : "m-lime-solid") + " m-edge m-pop m-s" + (i + 2)} cx={x} cy={y} r="16" />)}
      <path className="m-mark m-draw m-s8" pathLength="1" d="M160 198a78 78 0 0 0 67-39" />
    </>
  );
}
function Directions() {
  return (
    <>
      <circle className="m-paper m-edge" cx="88" cy="120" r="54" />
      <text className="m-label" x="88" y="80" textAnchor="middle">N</text>
      <g transform="translate(88 120)"><g className="m-spin" style={{ animationDuration: "10s" }}><path className="m-orange" d="M0-40l9 40H-9Z" /><path className="m-ink" d="M0 40l9-40H-9Z" /></g></g>
      <path className="m-line m-draw m-s3" pathLength="1" d="M170 190V120h60V60h40" />
      <circle className="m-lime-solid m-edge m-pop m-s2" cx="170" cy="190" r="9" />
      <circle className="m-orange m-pop m-s7" cx="270" cy="60" r="9" />
    </>
  );
}
function VisualPatterns() {
  const panel = (x, rot, step, q = false) => (
    <g key={x} className={"m-pop m-s" + step}>
      <rect className={(q ? "m-yellow" : "m-paper") + " m-edge"} x={x} y={84} width="60" height="72" rx="8" />
      {q ? <text className="m-number" x={x + 30} y={130} textAnchor="middle">?</text> : <path className="m-lime-solid m-edge" transform={`rotate(${rot} ${x + 30} 120)`} d={`M${x + 30} 100l18 32h-36Z`} />}
    </g>
  );
  return <>{panel(24, 0, 1)}{panel(96, 90, 2)}{panel(168, 180, 3)}{panel(240, 270, 5, true)}</>;
}
function Sections() {
  return (
    <>
      <Iso x={160} y={58} w={72} h={36} d={78} className="m-pop m-s1" />
      <polygon className="m-orange m-fade m-s4" style={{ opacity: 0.85 }} points={pts([[124, 112], [196, 112], [232, 148], [196, 184], [124, 184], [88, 148]])} />
      <path className="m-line m-draw m-s3" pathLength="1" d="M124 112h72l36 36-36 36h-72l-36-36Z" />
      <Badge x={272} y={52} text="6" step={8} />
    </>
  );
}
function Fit() {
  const sq = 28, board = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) if (!(i === 1 && j <= 1) && !(i === 2 && j === 1)) board.push([60 + i * sq, 76 + j * sq]);
  return (
    <>
      {board.map(([x, y], k) => <rect key={k} className="m-tint m-edge" x={x} y={y} width={sq} height={sq} />)}
      <path className="m-dash" d="M88 76h28v28h28v28h-56Z" />
      <g className="m-slide m-s5" style={{ "--dx": "120px" }}>
        <path className="m-lime-solid m-edge" d="M88 76h28v28h28v28h-56Z" />
      </g>
      <Badge x={250} y={70} text="✓" step={8} />
    </>
  );
}
function Overlays() {
  const sheet = (dx, marks, step, cls) => (
    <g className={"m-slide m-s" + step} style={{ "--dx": dx }}>
      <rect className={cls} x={110} y={60} width="100" height="120" rx="8" style={{ opacity: 0.7 }} />
      {marks}
    </g>
  );
  return (
    <>
      {sheet("-90px", <><circle className="m-ink" cx="135" cy="85" r="7" /><path className="m-line" d="M170 150l25-25" /></>, 2, "m-tint m-edge")}
      {sheet("90px", <><circle className="m-orange" cx="185" cy="90" r="9" /><path className="m-line" d="M130 155h30" /></>, 4, "m-yellow m-edge")}
      <Badge x={252} y={56} text="+" step={8} />
    </>
  );
}
function ObservationSkills() {
  const dots = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) dots.push([70 + i * 46, 74 + j * 46, i === 2 && j === 1]);
  return (
    <>
      {dots.map(([x, y, odd], k) => <g key={k} className={"m-pop m-s" + (1 + (k % 4))}><circle className="m-paper m-edge" cx={x} cy={y} r="15" /><path className="m-line" d={odd ? `M${x} ${y}l9-9` : `M${x} ${y}l9 9`} /></g>)}
      <circle className="m-mark m-pop m-s7" cx="162" cy="120" r="26" />
      <path className="m-sketch m-draw m-s7" pathLength="1" d="M181 139l26 26" />
    </>
  );
}
function Posters() {
  return (
    <>
      <rect className="m-paper m-edge m-pop m-s1" x="100" y="24" width="120" height="192" rx="6" />
      <rect className="m-lime-solid m-pop m-s2" x="114" y="40" width="92" height="80" rx="6" />
      <rect className="m-ink m-drop m-s4" x="114" y="132" width="92" height="18" rx="3" />
      <rect className="m-tint m-fade m-s5" x="114" y="158" width="64" height="7" rx="3" />
      <rect className="m-orange m-pop m-s7" x="160" y="180" width="46" height="20" rx="10" />
    </>
  );
}
function Storyboarding() {
  const frame = (x, step, pose) => (
    <g key={x} className={"m-pop m-s" + step}>
      <rect className="m-paper m-edge" x={x} y={74} width="82" height="92" rx="6" />
      <circle className="m-sketch" cx={x + 41} cy={100} r="10" />
      <path className="m-sketch" d={pose(x + 41)} />
    </g>
  );
  return (
    <>
      {frame(18, 1, x => `M${x} 110v28m0 0l-10 18m10-18l10 18M${x} 118l-14 6m14-6l14 6`)}
      {frame(119, 3, x => `M${x} 110v28m0 0l-12 18m12-18l14 14M${x} 118l-14-10m14 10l16-8`)}
      {frame(220, 5, x => `M${x} 110v28m0 0l-10 18m10-18l10 18M${x} 118l-12-16m12 16l12-16`)}
      <Arrow x={102} y={192} step={2} /><Arrow x={203} y={192} step={4} />
    </>
  );
}

// ---------- built-up isometric models ----------
// The same flat three-tone solids as the cube stacks above, but in any size,
// plus round ones. Each model is assembled piece by piece on the shared loop.
const grid = (cx, cy, u) => (x, y, z) => [cx + (x - y) * u, cy + ((x + y) * u) / 2 - z * u];
const dark = (tone, pct) => (tone ? { fill: `color-mix(in srgb, ${tone}, #10201a ${pct}%)` } : undefined);

function Block({ at, pos: [x, y, z], size: [a, b, c], tone, className = "" }) {
  return (
    <g className={className}>
      <polygon className="m-cube-left" style={dark(tone, 42)} points={pts([at(x, y + b, z), at(x + a, y + b, z), at(x + a, y + b, z + c), at(x, y + b, z + c)])} />
      <polygon className="m-cube-right" style={dark(tone, 20)} points={pts([at(x + a, y, z), at(x + a, y + b, z), at(x + a, y + b, z + c), at(x + a, y, z + c)])} />
      <polygon className="m-cube-top" style={dark(tone, 0)} points={pts([at(x, y, z + c), at(x + a, y, z + c), at(x + a, y + b, z + c), at(x, y + b, z + c)])} />
    </g>
  );
}

function Round({ at, u, pos: [x, y, z], r, c, tone, hole = 0, className = "" }) {
  const [cx, bottom] = at(x, y, z), top = bottom - c * u, rx = r * u * 1.414, ry = r * u * 0.707;
  return (
    <g className={className}>
      <path className="m-cube-left" style={dark(tone, 42)} d={`M${cx - rx} ${top}V${bottom}A${rx} ${ry} 0 0 0 ${cx} ${bottom + ry}V${top}Z`} />
      <path className="m-cube-right" style={dark(tone, 20)} d={`M${cx + rx} ${top}V${bottom}A${rx} ${ry} 0 0 1 ${cx} ${bottom + ry}V${top}Z`} />
      <ellipse className="m-cube-top" style={dark(tone, 0)} cx={cx} cy={top} rx={rx} ry={ry} />
      {hole > 0 && <ellipse className="m-cube-left" cx={cx} cy={top} rx={rx * hole} ry={ry * hole} />}
    </g>
  );
}

function Dome({ at, u, pos: [x, y, z], r, h, className = "" }) {
  const [cx, base] = at(x, y, z), rx = r * u * 1.414, ry = r * u * 0.707, tip = base - h * u;
  const side = (k) => `C${cx + k * rx * 1.3} ${base - h * u * 0.5} ${cx + k * rx * 0.3} ${base - h * u * 0.78} ${cx} ${tip}`;
  return (
    <g className={className}>
      <path className="m-cube-top" d={`M${cx - rx} ${base}${side(-1)}V${base + ry}A${rx} ${ry} 0 0 1 ${cx - rx} ${base}Z`} />
      <path className="m-cube-right" d={`M${cx + rx} ${base}${side(1)}V${base + ry}A${rx} ${ry} 0 0 0 ${cx + rx} ${base}Z`} />
    </g>
  );
}

function Tick({ x, y, step, text }) {
  return (
    <g className={"m-pop m-s" + step}>
      <circle className="m-orange" cx={x} cy={y} r="20" />
      {text ? <text className="m-badge-text" x={x} y={y + 7} textAnchor="middle">{text}</text> : <path className="m-check" d={`M${x - 9} ${y}l6 7 12-13`} />}
    </g>
  );
}

// Perspective: three boxes drawn to one vanishing point, one at a time.
function Perspective() {
  const vp = [160, 66], t = 0.34;
  const back = ([x, y]) => [x + (vp[0] - x) * t, y + (vp[1] - y) * t];
  const solid = ([x0, y0, x1, y1], step) => {
    const side = x1 < vp[0] ? x1 : x0 > vp[0] ? x0 : null;
    return (
      <g key={step}>
        <path className={"m-dash m-draw m-s" + (step + 1)} pathLength="1" style={{ strokeWidth: 1.5 }} d={[[x0, y0], [x1, y0]].map(([x, y]) => `M${x} ${y}L${vp[0]} ${vp[1]}`).join("")} />
        <g className={"m-drop m-s" + step}>
          <polygon className="m-cube-top" points={pts([[x0, y0], [x1, y0], back([x1, y0]), back([x0, y0])])} />
          {side !== null && <polygon className="m-cube-left" points={pts([[side, y0], [side, y1], back([side, y1]), back([side, y0])])} />}
          <polygon className="m-cube-right" points={pts([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])} />
        </g>
      </g>
    );
  };
  return (
    <>
      <path className="m-dash m-draw m-s1" pathLength="1" d="M16 66h288" />
      {solid([36, 118, 104, 204], 2)}
      {solid([216, 100, 284, 204], 4)}
      {solid([136, 166, 184, 210], 6)}
      <circle className="m-orange m-pop m-s1" cx={vp[0]} cy={vp[1]} r="7" />
    </>
  );
}

// Crafts: a pot coiled up ring by ring on the wheel.
function Crafts() {
  const u = 18, at = grid(160, 176, u);
  const coils = [[1.4], [2.0], [2.35, "var(--m-orange)"], [2.3], [1.9, "var(--m-yellow)"], [1.25], [1.5]];
  return (
    <>
      <Round at={at} u={u} pos={[0, 0, 0]} r={3.1} c={0.5} className="m-pop m-s1" />
      {coils.map(([r, tone], i) => (
        <Round key={i} at={at} u={u} pos={[0, 0, 0.5 + i * 0.62]} r={r} c={0.62} tone={tone} hole={i === coils.length - 1 ? 0.7 : 0} className={"m-drop m-s" + (i + 2)} />
      ))}
    </>
  );
}

// Art history: plinth, hall, minarets, drum, dome, then the finial.
function ArtHistory() {
  const u = 13, at = grid(160, 84, u);
  const minaret = (x, y, step) => (
    <g key={x + "-" + y} className={"m-drop m-s" + step}>
      <Round at={at} u={u} pos={[x, y, 0.8]} r={0.42} c={3.2} />
      <Dome at={at} u={u} pos={[x, y, 4]} r={0.5} h={1.1} />
    </g>
  );
  const small = (x, y) => <Dome key={x + "-" + y} at={at} u={u} pos={[x, y, 4.3]} r={0.7} h={1.5} />;
  return (
    <>
      <Block at={at} pos={[0, 0, 0]} size={[10, 10, 0.8]} className="m-pop m-s1" />
      {minaret(0.8, 0.8, 3)}{minaret(9.2, 0.8, 3)}{minaret(0.8, 9.2, 4)}
      <g className="m-drop m-s2">
        <Block at={at} pos={[2.5, 2.5, 0.8]} size={[5, 5, 3.5]} />
        <polygon className="m-cube-left" style={{ stroke: "none" }} points={pts([at(7.5, 4.2, 0.8), at(7.5, 5.8, 0.8), at(7.5, 5.8, 2.9), at(7.5, 5, 3.5), at(7.5, 4.2, 2.9)])} />
        <polygon className="m-cube-right" style={{ stroke: "none" }} points={pts([at(4.2, 7.5, 0.8), at(5.8, 7.5, 0.8), at(5.8, 7.5, 2.9), at(5, 7.5, 3.5), at(4.2, 7.5, 2.9)])} />
      </g>
      <g className="m-drop m-s7">{small(3.2, 3.2)}{small(6.8, 3.2)}{small(3.2, 6.8)}</g>
      <Round at={at} u={u} pos={[5, 5, 4.3]} r={1.6} c={1} className="m-drop m-s5" />
      <Dome at={at} u={u} pos={[5, 5, 5.3]} r={1.75} h={4.2} className="m-drop m-s6" />
      <g className="m-drop m-s7">{small(6.8, 6.8)}</g>
      {minaret(9.2, 9.2, 4)}
      <circle className="m-orange m-pop m-s8" cx={at(5, 5, 9.7)[0]} cy={at(5, 5, 9.7)[1]} r="5" />
    </>
  );
}

// Product design: four legs, a seat, a back, a cushion: a finished chair.
function ProductDesign() {
  const u = 19, at = grid(150, 132, u), leg = [0.45, 0.45, 3];
  return (
    <>
      <Block at={at} pos={[0, 0, 0]} size={leg} className="m-drop m-s1" />
      <Block at={at} pos={[2.55, 0, 0]} size={leg} className="m-drop m-s2" />
      <Block at={at} pos={[0, 2.55, 0]} size={leg} className="m-drop m-s3" />
      <Block at={at} pos={[2.55, 2.55, 0]} size={leg} className="m-drop m-s4" />
      <Block at={at} pos={[0, 0, 3]} size={[3, 3, 0.5]} className="m-drop m-s5" />
      <g className="m-drop m-s6">
        <Block at={at} pos={[0, 0, 3.5]} size={[0.45, 0.45, 2.6]} />
        <Block at={at} pos={[0, 2.55, 3.5]} size={[0.45, 0.45, 2.6]} />
        <Block at={at} pos={[0, 0, 4.7]} size={[0.45, 3, 1.4]} />
      </g>
      <Block at={at} pos={[0.75, 0.3, 3.5]} size={[2, 2.4, 0.35]} tone="var(--m-orange)" className="m-drop m-s7" />
      <Tick x={262} y={62} step={8} />
    </>
  );
}

// Everyday physics: a lever. Two blocks near the pivot balance one far away.
function EverydayPhysics() {
  const u = 17, at = grid(96, 96, u);
  return (
    <>
      <Block at={at} pos={[4.5, 0.2, 0]} size={[1, 1.4, 1.4]} className="m-pop m-s1" />
      <Block at={at} pos={[0.5, 0, 1.4]} size={[9, 1.8, 0.3]} tone="var(--m-yellow)" className="m-drop m-s2" />
      <Block at={at} pos={[2.4, 0.3, 1.7]} size={[1.2, 1.2, 1.2]} className="m-drop m-s3" />
      <Block at={at} pos={[2.4, 0.3, 2.9]} size={[1.2, 1.2, 1.2]} className="m-drop m-s4" />
      <Block at={at} pos={[8.3, 0.3, 1.7]} size={[1.2, 1.2, 1.2]} tone="var(--m-orange)" className="m-drop m-s6" />
      <Tick x={262} y={62} step={8} text="=" />
    </>
  );
}

const topics = {
  "cube-nets": [CubeNets, "Cube nets"],
  "nets-of-solids": [NetsOfSolids, "Nets of solids"],
  "paper-folding": [PaperFolding, "Paper folding and cutting"],
  "mirror-images": [MirrorImages, "Mirror and water images"],
  "counting-cubes": [CountingCubes, "Counting cubes"],
  mechanisms: [Mechanisms, "Gears, belts and levers"],
  "counting-figures": [CountingFigures, "Counting figures"],
  "colour-basics": [Colour, "Colour"],
  "views-and-rotation": [ViewsAndRotation, "Views and rotation"],
  dice: [Dice, "Dice"],
  "solid-surfaces": [SolidSurfaces, "Surfaces of solids"],
  "shadows-and-light": [ShadowsAndLight, "Shadows and light"],
  quant: [Quant, "Number and quantity"],
  "codes-patterns": [CodesPatterns, "Codes and number patterns"],
  arrangements: [Arrangements, "Arrangements and puzzles"],
  directions: [Directions, "Directions, clocks and calendars"],
  "visual-patterns": [VisualPatterns, "Visual series and matrices"],
  sections: [Sections, "Sections of solids"],
  fit: [Fit, "Fit and hidden figures"],
  overlays: [Overlays, "Transparent sheets"],
  "observation-skills": [ObservationSkills, "Visual observation"],
  perspective: [Perspective, "Perspective and viewpoint"],
  crafts: [Crafts, "Crafts, materials and making"],
  "art-history": [ArtHistory, "Art and design history"],
  "product-design": [ProductDesign, "Product design thinking"],
  posters: [Posters, "Posters, mascots and campaigns"],
  storyboarding: [Storyboarding, "Storyboarding"],
  "everyday-physics": [EverydayPhysics, "Everyday physics"],
};

export const topicMotifs = Object.entries(topics).map(([key, [, name]]) => ({ key, name }));

export function TopicMotif({ topic, label = "", className = "" }) {
  const [Picture] = topics[topic] ?? topics["cube-nets"];
  return (
    <MotifFrame kind={"topic-" + topic} label={label} className={className}>
      <Picture />
    </MotifFrame>
  );
}

// Stages: one staircase, one more step built at each stage.
export const stageMotifs = [
  { key: "foundations", name: "Foundations" },
  { key: "exam-standard", name: "Exam standard" },
  { key: "exam-hard", name: "Exam hard" },
  { key: "mastery", name: "Mastery" },
];
const stageTones = ["m-lime-solid", "m-yellow", "m-orange", "m-ink"];

export function StageMotif({ stage = "foundations", label = "", className = "" }) {
  const level = Math.max(0, stageMotifs.findIndex((item) => item.key === stage)) + 1;
  const top = 206 - level * 40;
  const x = 46 + (level - 1) * 58 + 26;
  return (
    <MotifFrame kind={"stage-" + stage} label={label} className={className}>
      <path className="m-line" d="M30 206h260" />
      {stageMotifs.map((item, index) => {
        const height = (index + 1) * 40;
        const built = index < level;
        return (
          <rect
            key={item.key}
            className={built ? stageTones[index] + " m-drop m-s" + (index + 1) : "m-dash"}
            x={46 + index * 58}
            y={206 - height}
            width="52"
            height={height}
            rx="6"
          />
        );
      })}
      <g transform={`translate(${x} ${top - 22})`}>
        <g className={"m-pop m-s" + (level + 2)}>
          <path className={(level === 4 ? "m-orange m-spin" : "m-orange")} d="M0-10C1.5-3 3-1.5 10 0 3 1.5 1.5 3 0 10-1.5 3-3 1.5-10 0-3-1.5-1.5-3 0-10Z" transform="scale(1.6)" />
        </g>
      </g>
    </MotifFrame>
  );
}
