import React from "react";
import { Link } from "react-router-dom";
import { Arrow } from "./Art.jsx";
import "./discovery.css";

function MuseumSign({ variant }) {
  return (
    <figure>
      <figcaption>Sign {variant}</figcaption>
      <div className="museum-sign" role="img" aria-label={
        variant === "A"
          ? "East wing in large bold letters, Ceramics workshop below, then Studio 2 and a right arrow in small type."
          : "Ceramics workshop above Studio 2 and a right arrow in large bold letters. East wing appears below in small type."
      }>
        {variant === "A" && <strong>East wing</strong>}
        <span>Ceramics workshop</span>
        {variant === "A" ? <small>Studio 2 →</small> : <strong>Studio 2 →</strong>}
        {variant === "B" && <small>East wing</small>}
      </div>
    </figure>
  );
}

export function SignReadingExercise() {
  return (
    <article className="wrap section sign-exercise">
      <Link className="back-link" to="/tests">← Mock tests and practice</Link>
      <h1>Visual hierarchy in <em>wayfinding signs.</em></h1>
      <p>You’re in the east wing of a museum looking for a ceramics workshop. At a fork in the corridor, you have one glance to decide which way to walk. Which sign helps you decide?</p>
      <div className="museum-signs">
        <MuseumSign variant="A" />
        <MuseumSign variant="B" />
      </div>
      <p>Read each sign once. Which words caught your eye first? Which words told you where to go?</p>
      <details>
        <summary>Compare your reasoning with the worked example</summary>
        <p>Both signs point right to Studio 2. On Sign A, “East wing” gets the largest type. It confirms where you are, but you still have to find the smaller arrow to choose a corridor.</p>
        <p>Sign B groups “Studio 2” with the arrow and gives them the largest type. The workshop name sits just above, so you can connect the destination with the turn. That makes B the better fit at this fork.</p>
        <p>At the entrance to the wing, the task changes. A large “East wing” could be useful there. Choose the most prominent information after deciding what the reader needs to do.</p>
      </details>
      <h2>Try a different brief</h2>
      <p>Sketch a sign for someone who has already reached Studio 2 and needs to check whether the ceramics workshop is inside. Keep the same three pieces of information. Decide which to enlarge and whether an arrow still helps.</p>
      <Link className="button" to="/sample">Try five timed visual questions <Arrow size={18} /></Link>
    </article>
  );
}
