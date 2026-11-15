// Animated DMocks illustrations. Original geometric SVG, driven only by CSS
// (see motion.css), so they are safe to use on the public site and inside the
// student portal. Each one rests in its finished state when motion is reduced.
//
//   <Motif kind="learn" />            decorative
//   <Motif kind="pass" label="..." /> announced to screen readers
//
// Kinds: learn, mocks, allIndia, practice, community, drawing, report, pass.
import React, { useEffect, useRef, useState } from "react";
import "./motion.css";

const SPARK =
  "M0-10C1.5-3 3-1.5 10 0 3 1.5 1.5 3 0 10-1.5 3-3 1.5-10 0-3-1.5-1.5-3 0-10Z";

function useLive() {
  const ref = useRef(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setLive(true);
      return undefined;
    }
    const watcher = new IntersectionObserver(
      ([entry]) => setLive(entry.isIntersecting),
      { rootMargin: "60px" },
    );
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);
  return [ref, live];
}

function Spark({ x, y, scale = 1, className = "" }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d={SPARK} className={className} />
    </g>
  );
}

function Cube({ i, j, k, step }) {
  const w = 30, h = 15, d = 30;
  const x = 140 + (i - j) * w;
  const y = 82 + (i + j) * h - k * d;
  const points = (list) => list.map(([a, b]) => `${a},${b}`).join(" ");
  return (
    <g className={"m-drop m-s" + step}>
      <polygon className="m-cube-left" points={points([[x - w, y + h], [x, y + 2 * h], [x, y + 2 * h + d], [x - w, y + h + d]])} />
      <polygon className="m-cube-right" points={points([[x + w, y + h], [x, y + 2 * h], [x, y + 2 * h + d], [x + w, y + h + d]])} />
      <polygon className="m-cube-top" points={points([[x, y], [x + w, y + h], [x, y + 2 * h], [x - w, y + h]])} />
    </g>
  );
}

const cubes = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [2, 0, 0], [1, 1, 0],
  [0, 0, 1], [1, 0, 1], [0, 0, 2],
];

function Learn() {
  return (
    <>
      {cubes.map(([i, j, k], index) => (
        <Cube key={index} i={i} j={j} k={k} step={index + 1} />
      ))}
      <Spark x={262} y={44} scale={1.3} className="m-orange m-pop m-s8" />
      <line className="m-track" x1="80" y1="214" x2="240" y2="214" />
      {[0, 1, 2, 3, 4].map((n) => (
        <g key={n}>
          <circle className="m-node" cx={80 + n * 40} cy="214" r="8" />
          <circle className="m-node-on m-pop" style={{ animationName: "m-step-" + [1, 3, 5, 7, 8][n] }} cx={80 + n * 40} cy="214" r="8" />
        </g>
      ))}
    </>
  );
}

function Mocks() {
  return (
    <>
      <rect className="m-tint" x="78" y="30" width="180" height="192" rx="10" transform="rotate(5 168 126)" />
      <rect className="m-sheet" x="70" y="24" width="180" height="192" rx="10" />
      <rect className="m-ink" x="88" y="42" width="62" height="9" rx="4.5" />
      <rect className="m-mid" x="88" y="72" width="138" height="6" rx="3" />
      <rect className="m-mid" x="88" y="86" width="96" height="6" rx="3" />
      <circle className="m-ring-track" cx="224" cy="52" r="13" />
      <circle className="m-ring-run m-timer" cx="224" cy="52" r="13" pathLength="1" transform="rotate(-90 224 52)" />
      <rect className="m-lime m-fade m-s4" x="82" y="130" width="156" height="22" rx="6" />
      {[0, 1, 2, 3].map((row) => (
        <g key={row}>
          <circle className="m-option" cx="96" cy={117 + row * 24} r="7" />
          <rect className="m-tint" x="112" y={114 + row * 24} width={[108, 92, 116, 80][row]} height="6" rx="3" />
        </g>
      ))}
      <circle className="m-ink m-pop m-s3" cx="96" cy="141" r="4" />
      <g className="m-pop m-s6">
        <circle className="m-orange" cx="236" cy="200" r="17" />
        <path className="m-check" d="M228 200l6 6 11-12" />
      </g>
    </>
  );
}

const crowd = [
  [34, 62], [58, 44], [82, 70], [48, 92], [104, 52], [72, 112], [30, 128],
  [98, 100], [56, 148], [88, 142], [116, 128], [40, 178], [76, 186], [108, 168],
];

function AllIndia() {
  return (
    <>
      {crowd.map(([x, y], index) => (
        <g key={index}>
          {index % 3 === 0 && (
            <circle className="m-pulse" style={{ animationDelay: index * 0.37 + "s" }} cx={x} cy={y} r="4" />
          )}
          <circle className={index % 5 === 2 ? "m-orange" : "m-mid"} cx={x} cy={y} r="4" />
        </g>
      ))}
      <rect className="m-sheet" x="146" y="26" width="156" height="188" rx="10" />
      <rect className="m-ink" x="162" y="42" width="58" height="8" rx="4" />
      {[0, 1, 2, 3].map((row) => (
        <g key={row}>
          <circle className={row === 1 ? "m-orange" : "m-tint"} cx="172" cy={80 + row * 34} r="10" />
          <text className={row === 1 ? "m-label m-on-accent" : "m-label"} x="172" y={84 + row * 34} textAnchor="middle">{row + 1}</text>
          <rect className={(row === 1 ? "m-orange" : row === 0 ? "m-ink" : "m-mid") + " m-grow m-s" + (row + 1)} x="190" y={74 + row * 34} width={[98, 86, 70, 56][row]} height="12" rx="6" />
        </g>
      ))}
      <Spark x={290} y={30} scale={1.5} className="m-yellow m-pop m-s6" />
    </>
  );
}

const glyphs = [
  <circle key="a" cx="22" cy="22" r="9" />,
  <path key="b" d="M22 12l10 18H12Z" />,
  <rect key="c" x="13" y="13" width="18" height="18" />,
  <path key="d" d="M12 16h20M12 22h20M12 28h12" />,
  <path key="e" d="M12 27a10 10 0 0 1 20 0Z" />,
  <path key="f" d="M22 11l11 11-11 11-11-11Z" />,
  <path key="g" d="M22 12v20M12 22h20" />,
  <path key="h" d="M12 30c0-10 8-18 18-18" />,
  <path key="i" d="M15 15h0M29 15h0M22 22h0M15 29h0M29 29h0" />,
];
const picked = { 0: 1, 4: 2, 5: 3, 7: 4 };

function Practice() {
  return (
    <>
      {glyphs.map((glyph, index) => {
        const x = 30 + (index % 3) * 54;
        const y = 36 + Math.floor(index / 3) * 54;
        return (
          <g key={index} transform={`translate(${x} ${y})`}>
            <rect className="m-sheet" width="44" height="44" rx="9" />
            {picked[index] && <rect className={"m-lime m-fade m-s" + picked[index]} width="44" height="44" rx="9" />}
            <g className="m-glyph">{glyph}</g>
          </g>
        );
      })}
      <circle className="m-ring-track m-ring-big" cx="252" cy="82" r="32" />
      <circle className="m-ring-run m-ring-big m-timer" cx="252" cy="82" r="32" pathLength="1" transform="rotate(-90 252 82)" />
      <text className="m-number" x="252" y="91" textAnchor="middle">20</text>
      {[10, 20, 30].map((count, index) => (
        <g key={count} transform={`translate(${212 + index * 28} 150)`}>
          <rect className={index === 1 ? "m-ink" : "m-sheet"} width="24" height="24" rx="7" />
          <text className={index === 1 ? "m-label m-on-ink" : "m-label"} x="12" y="16" textAnchor="middle">{count}</text>
        </g>
      ))}
    </>
  );
}

function Community() {
  return (
    <>
      <g className="m-pop m-from-left m-s1">
        <path className="m-sheet" d="M44 26h150a14 14 0 0 1 14 14v26a14 14 0 0 1-14 14H58l-18 14 4-18V40a14 14 0 0 1 0-14Z" />
        <rect className="m-mid" x="62" y="42" width="118" height="6" rx="3" />
        <rect className="m-mid" x="62" y="56" width="82" height="6" rx="3" />
      </g>
      <g className="m-pop m-from-right m-s3">
        <path className="m-ink" d="M126 98h150a14 14 0 0 1 14 14v26a14 14 0 0 1-14 14h-4l4 18-18-18H126a14 14 0 0 1-14-14v-26a14 14 0 0 1 14-14Z" />
        <rect className="m-on-ink-fill" x="130" y="114" width="124" height="6" rx="3" />
        <rect className="m-on-ink-fill" x="130" y="128" width="72" height="6" rx="3" />
      </g>
      <g className="m-pop m-s4">
        <circle className="m-orange" cx="290" cy="98" r="15" />
        <Spark x={290} y={98} scale={0.8} className="m-on-accent-fill" />
      </g>
      <g className="m-pop m-from-left m-s5">
        <rect className="m-sheet" x="30" y="170" width="92" height="42" rx="14" />
        {[0, 1, 2].map((n) => (
          <circle key={n} className="m-mid m-bounce" style={{ animationDelay: n * 0.18 + "s" }} cx={58 + n * 18} cy="191" r="5" />
        ))}
      </g>
    </>
  );
}

function Drawing() {
  return (
    <>
      <rect className="m-sheet" x="48" y="20" width="224" height="200" rx="8" transform="rotate(-2 160 120)" />
      <path className="m-sketch m-draw m-s1" pathLength="1" d="M114 92a42 12 0 1 0 84 0a42 12 0 1 0-84 0" />
      <path className="m-sketch m-draw m-s2" pathLength="1" d="M114 92l9 76q33 14 66 0l9-76" />
      <path className="m-sketch m-draw m-s3" pathLength="1" d="M196 108q34 0 31 26q-3 22-33 18" />
      <path className="m-hatch m-draw m-s4" pathLength="1" d="M92 190h120M104 198h92M120 206h58" />
      <ellipse className="m-mark m-draw m-s5" pathLength="1" cx="213" cy="130" rx="27" ry="32" />
      <g className="m-pop m-s6">
        <rect className="m-orange" x="214" y="176" width="52" height="24" rx="12" />
        <path className="m-check" d="M231 188l6 6 11-12" />
      </g>
      <g className="m-float" transform="translate(70 62) rotate(-38)">
        <rect className="m-yellow" x="-5" y="-30" width="10" height="38" rx="2" />
        <path className="m-ink" d="M-5 8h10l-5 12Z" />
      </g>
    </>
  );
}

function Report() {
  return (
    <>
      <rect className="m-sheet" x="22" y="24" width="276" height="192" rx="10" />
      <circle className="m-ring-track m-ring-wide" cx="94" cy="120" r="46" />
      <circle className="m-ring-score m-s1" cx="94" cy="120" r="46" pathLength="1" transform="rotate(-90 94 120)" />
      <text className="m-number m-number-big" x="94" y="131" textAnchor="middle">72</text>
      {[[94, "m-ink"], [110, "m-yellow"], [68, "m-orange"]].map(([width, tone], row) => (
        <g key={row}>
          <rect className="m-mid" x="168" y={64 + row * 42} width="46" height="5" rx="2.5" />
          <rect className="m-tint" x="168" y={76 + row * 42} width="112" height="10" rx="5" />
          <rect className={tone + " m-grow m-s" + (row + 2)} x="168" y={76 + row * 42} width={width} height="10" rx="5" />
        </g>
      ))}
      <Spark x={282} y={40} scale={1.2} className="m-orange m-pop m-s6" />
    </>
  );
}

const TICKET =
  "M40 56H210a11 11 0 0 0 22 0h48q12 0 12 12v104q0 12-12 12h-48a11 11 0 0 0-22 0H40q-12 0-12-12V68q0-12 12-12Z";

function Pass({ id }) {
  return (
    <>
      <defs>
        <clipPath id={id}>
          <path d={TICKET} />
        </clipPath>
      </defs>
      <circle className="m-yellow m-float" cx="52" cy="30" r="7" />
      <rect className="m-orange m-float m-late" x="268" y="196" width="13" height="13" rx="2" />
      <path className="m-lime-solid m-float m-later" d="M286 22l10 17h-20Z" />
      <g className="m-sway">
        <path className="m-ticket" d={TICKET} />
        <g clipPath={`url(#${id})`}>
          <rect className="m-sheen" x="-70" y="40" width="46" height="160" />
        </g>
        <line className="m-tear" x1="221" y1="72" x2="221" y2="168" />
        <text className="m-ticket-kicker" x="48" y="88">DMOCKS · ADMIT ONE</text>
        <text className="m-ticket-title" x="48" y="132">Free pass</text>
        <text className="m-ticket-note" x="48" y="158">For design aspirants</text>
        <g transform="translate(257 120)">
          <path className="m-orange m-spin" d={SPARK} transform="scale(1.9)" />
        </g>
      </g>
    </>
  );
}

const kinds = {
  learn: Learn,
  mocks: Mocks,
  allIndia: AllIndia,
  practice: Practice,
  community: Community,
  drawing: Drawing,
  report: Report,
  pass: Pass,
};

export const motifKinds = Object.keys(kinds);

// The shared stage every illustration is drawn on: a 320 x 240 canvas that
// only animates while it is on screen.
export function MotifFrame({ kind, label = "", className = "", children }) {
  const [ref, live] = useLive();
  const naming = label
    ? { role: "img", "aria-label": label }
    : { "aria-hidden": "true" };
  return (
    <svg
      ref={ref}
      viewBox="0 0 320 240"
      className={["motif", "motif-" + kind, live ? "is-live" : "", className].filter(Boolean).join(" ")}
      {...naming}
    >
      {children}
    </svg>
  );
}

export function Motif({ kind = "learn", label = "", className = "" }) {
  const id = React.useId().replace(/:/g, "");
  const Picture = kinds[kind] ?? Learn;
  return (
    <MotifFrame kind={kind} label={label} className={className}>
      <Picture id={"motif-" + id} />
    </MotifFrame>
  );
}

export { Spark as MotifSpark };

// Fades a block up the first time it scrolls into view.
export function Reveal({ as: Tag = "div", className = "", children, ...rest }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return undefined;
    }
    const watcher = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setSeen(true);
        watcher.disconnect();
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={["reveal", seen ? "is-in" : "", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </Tag>
  );
}
