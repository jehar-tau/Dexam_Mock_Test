// Development-only gallery of every animated illustration, so parked artwork
// can be reviewed before it is placed in the student portal. Route: /motion-preview
import React from "react";
import { Motif, motifKinds } from "./Motion.jsx";
import { TopicMotif, topicMotifs, StageMotif, stageMotifs } from "./TopicMotion.jsx";
import { LogoMotion } from "./LogoMotion.jsx";

function Tile({ name, note, children }) {
  return (
    <figure className="gallery-tile">
      <div className="gallery-art">{children}</div>
      <figcaption>
        <b>{name}</b>
        {note && <span>{note}</span>}
      </figcaption>
    </figure>
  );
}

export function MotionGallery() {
  return (
    <section className="wrap section motion-gallery">
      <span className="eyebrow">PARKED ARTWORK · DEVELOPMENT PREVIEW</span>
      <h1>
        Animated <em>illustrations.</em>
      </h1>
      <p>
        Everything here is original geometric SVG with CSS motion. It rests in
        its finished state when the visitor asks for reduced motion.
      </p>

      <h2>The logo</h2>
      <div className="gallery-logo">
        <LogoMotion size={180} play="loop" />
        <p>
          Flat mark, tilts to an isometric view, rises into solid blocks, turns
          once and settles back to flat. In the site header it plays on hover
          or keyboard focus.
        </p>
      </div>

      <h2>Learn topics</h2>
      <div className="gallery-grid">
        {topicMotifs.map(({ key, name }) => (
          <Tile key={key} name={name} note={key}>
            <TopicMotif topic={key} />
          </Tile>
        ))}
      </div>

      <h2>Topic stages</h2>
      <div className="gallery-grid">
        {stageMotifs.map(({ key, name }) => (
          <Tile key={key} name={name} note={key}>
            <StageMotif stage={key} />
          </Tile>
        ))}
      </div>

      <h2>Portal features</h2>
      <div className="gallery-grid">
        {motifKinds.map((kind) => (
          <Tile key={kind} name={kind}>
            <Motif kind={kind} />
          </Tile>
        ))}
      </div>
    </section>
  );
}

export default MotionGallery;
