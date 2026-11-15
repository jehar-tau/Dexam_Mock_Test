// The DMocks mark as a living logo: four flat petals tilt into an isometric
// view, rise into solid blocks, turn once and settle back to the flat mark.
//
//   <LogoMotion />                 flat; plays while its parent link is hovered or focused
//   <LogoMotion play="once" />     plays one cycle when it appears
//   <LogoMotion play="loop" size={160} />
//
// Decorative: the surrounding link or heading carries the name.
import React from "react";
import "./motion.css";

const LAYERS = 18;

export function LogoMotion({ size = 28, play = "hover", className = "" }) {
  const mode = play === "loop" ? "is-looping" : play === "once" ? "is-once" : "";
  return (
    <span
      className={["logo-motion", mode, className].filter(Boolean).join(" ")}
      style={{ "--size": size + "px" }}
      aria-hidden="true"
    >
      <span className="logo-motion-scene">
        {[0, 1, 2, 3].map((tile) => (
          <span className="logo-motion-tile" key={tile}>
            {Array.from({ length: LAYERS }, (_, layer) => (
              <span className="logo-motion-layer" key={layer} style={{ "--k": layer / (LAYERS - 1) }} />
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}
