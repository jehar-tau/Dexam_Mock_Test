import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Arrow } from "./Art.jsx";
import { cataloguePlatform } from "./platform.js";
import { loadReleasedYearPapers, releasedYearPaperGroups } from "./free-year-papers.mjs";

const exams = [["uceed", "UCEED", "B.Des."], ["ceed", "CEED", "M.Des."], ["nid", "NID", "B.Des. and M.Des."], ["nift", "NIFT", "B.Des. and M.Des."]];

// Live counts come from the public released-paper catalogue; without it the
// section still shows the four exams, without numbers.
export function HomeFreePapers() {
  const [groups, setGroups] = useState(null), [seen, setSeen] = useState(false), section = useRef(null);
  // Ask for the catalogue only once the section is on screen.
  useEffect(() => {
    if (!cataloguePlatform || seen || !section.current) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setSeen(true); });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [seen]);
  useEffect(() => {
    if (!cataloguePlatform || !seen) return;
    const controller = new AbortController();
    loadReleasedYearPapers(cataloguePlatform, controller.signal)
      .then(rows => { if (!controller.signal.aborted) setGroups(releasedYearPaperGroups(rows)); })
      .catch(() => {});
    return () => controller.abort();
  }, [seen]);
  const total = groups?.length ?? 0;
  return <section ref={section} className="home-papers" aria-labelledby="home-papers-title">
    <div className="wrap home-papers-inner">
      <div className="home-papers-copy">
        <span className="eyebrow">FREE PAST-YEAR PAPERS</span>
        <h2 id="home-papers-title">Every past paper. <em>Free.</em> Every answer explained.</h2>
        <p>Sit complete UCEED, CEED, NID and NIFT papers against their original clock and marking. After you submit, open a worked solution for every question, with the key idea, each step, the common trap and a faster method.</p>
        <ul>
          <li>The original timer and that year’s marking scheme</li>
          <li>Answer-by-answer solutions, some animated on the diagram</li>
          <li>Your marks by section and your progress across papers</li>
        </ul>
        <Link className="button home-papers-cta" to="/papers">{total ? `Browse ${total} free papers` : "Browse free papers"} <Arrow size={17} /></Link>
      </div>
      <ul className="home-papers-exams" aria-label="Free papers by exam">
        {exams.map(([id, name, level]) => {
          const mine = groups?.filter(group => group.exam === id) ?? [];
          const years = mine.map(group => group.year);
          return <li key={id}>
            <Link to={`/papers/${id}`}>
              <span className="home-papers-exam">{name}</span>
              <span className="home-papers-level">{level}</span>
              <strong>{groups ? (mine.length ? `${mine.length} paper${mine.length === 1 ? "" : "s"}` : "Coming soon") : "Past papers"}</strong>
              {years.length > 0 && <small>{Math.min(...years) === Math.max(...years) ? years[0] : `${Math.min(...years)}–${Math.max(...years)}`}</small>}
              <Arrow size={16} />
            </Link>
          </li>;
        })}
      </ul>
    </div>
  </section>;
}
