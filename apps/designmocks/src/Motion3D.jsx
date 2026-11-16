// Turning 3D models for the topic animations, drawn as SVG with no library
// and no WebGL. Each model is built once from simple solids (boxes and lathed
// shapes), then turned, lit and projected in perspective on every frame.
// Faces are sorted far to near and back faces are dropped, so a few hundred
// paths are enough. The picture only moves while it is on screen; with motion
// reduced it rests at one pose.
import React, { useEffect, useMemo, useRef } from "react";
import { useLive } from "./Motion.jsx";
import { chairScene, craftsScene, monumentScene, perspectiveScene, physicsScene, project } from "./scene3d.js";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function paint(group, items, kind) {
  const nodes = group.children;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i], item = items[i];
    if (!item) { node.setAttribute("d", ""); continue; }
    node.setAttribute("d", item.d);
    node.style.stroke = item.stroke;
    node.style.strokeWidth = item.width;
    node.style.opacity = item.opacity;
    if (kind === "face") node.style.fill = item.fill;
  }
}

function Layer({ items, size, kind, layerRef }) {
  const blank = Array.from({ length: size }, (_, i) => items[i]);
  return (
    <g ref={layerRef} className={"m3-" + kind}>
      {blank.map((item, i) => item ? (
        <path key={i} d={item.d} strokeDasharray={item.dash || undefined} style={{ fill: kind === "face" ? item.fill : "none", stroke: item.stroke, strokeWidth: item.width, opacity: item.opacity }} />
      ) : <path key={i} d="" style={{ fill: kind === "face" ? "none" : "none" }} />)}
    </g>
  );
}

// A scene is { faces, under, over, view(t) -> { yaw, pitch, ... } } where t
// is seconds since the picture came on screen.
export function Scene3D({ build, kind, label = "", className = "", rest = 1.2 }) {
  const scene = useMemo(build, [build]);
  const first = useMemo(() => project(scene, rest), [scene, rest]);
  const [ref, live] = useLive();
  const shadow = useMemo(() => { if (scene.ground === undefined) return null; const v = scene.view(rest); return { cy: v.cy - (v.focal * scene.ground) / v.dist, rx: (v.focal * 2.6) / v.dist }; }, [scene, rest]);
  const faceLayer = useRef(null), underLayer = useRef(null), overLayer = useRef(null), clock = useRef(rest);
  useEffect(() => {
    if (!live || reducedMotion()) return undefined;
    let frame = 0, last = performance.now();
    const tick = now => {
      clock.current += Math.min(0.05, (now - last) / 1000); last = now;
      const view = project(scene, clock.current);
      if (faceLayer.current) paint(faceLayer.current, view.faces, "face");
      if (underLayer.current) paint(underLayer.current, view.under, "line");
      if (overLayer.current) paint(overLayer.current, view.over, "line");
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [live, scene]);
  const naming = label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" };
  return (
    <svg ref={ref} viewBox="0 0 320 240" className={["motif", "motif-3d", "motif-" + kind, live ? "is-live" : "", className].filter(Boolean).join(" ")} {...naming}>
      {shadow && <ellipse className="m3-shadow" cx="160" cy={shadow.cy} rx={shadow.rx} ry={shadow.rx / 9} />}
      <Layer items={first.under} size={first.under.length} kind="line" layerRef={underLayer} />
      <Layer items={first.faces} size={scene.faces.length} kind="face" layerRef={faceLayer} />
      <Layer items={first.over} size={first.over.length} kind="line" layerRef={overLayer} />
    </svg>
  );
}

export function Chair3D(props) { return <Scene3D build={chairScene} kind="topic-product-design" {...props} />; }
export function Monument3D(props) { return <Scene3D build={monumentScene} kind="topic-art-history" {...props} />; }
export function Crafts3D(props) { return <Scene3D build={craftsScene} kind="topic-crafts" {...props} />; }
export function Perspective3D(props) { return <Scene3D build={perspectiveScene} kind="topic-perspective" {...props} />; }
export function Physics3D(props) { return <Scene3D build={physicsScene} kind="topic-everyday-physics" {...props} />; }
