import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import catalogue from './paper-years.generated.json';
import { paperLabel } from './paper-years.mjs';
import './papers.css';

const examNames = { uceed: 'UCEED', ceed: 'CEED', nift: 'NIFT', nid: 'NID' };
const exams = Object.keys(examNames);

export function PapersView({ papers = catalogue }) {
  const [selected, setSelected] = useState('uceed');
  const visible = papers.filter(paper => paper.exam === selected);
  const questionCount = visible.reduce((total, paper) => total + paper.questionCount, 0);
  return <section className="wrap section year-papers">
    <span className="eyebrow">PAPERS / YEAR BY YEAR</span>
    <h1>Explore the <em>papers.</em></h1>
    <p className="year-papers-intro">Browse our year-wise question sets. A timed paper will open here after its questions, figures and answers have been reviewed.</p>
    <div className="year-papers-tabs" role="group" aria-label="Choose an exam">
      {exams.map(exam => <button type="button" key={exam} aria-pressed={selected === exam} onClick={() => setSelected(exam)}>{examNames[exam]}<span>{papers.filter(paper => paper.exam === exam).length}</span></button>)}
    </div>
    <div className="year-papers-summary"><div><span>SELECTED EXAM</span><h2>{examNames[selected]}</h2></div><p>{visible.length} sets · {questionCount} questions in our collection</p></div>
    <div className="year-papers-grid">
      {visible.map(paper => <article className="year-paper-card" key={paper.id}>
        <div className="year-paper-card-top"><span>{paper.year}</span><span className="year-paper-state">In preparation</span></div>
        <h3>{paperLabel(paper)}</h3>
        <p>{paper.questionCount} questions in this set</p>
        <div className="year-paper-types">{paper.objectiveCount > 0 && <span>{paper.objectiveCount} objective</span>}{paper.drawingCount > 0 && <span>{paper.drawingCount} drawing or descriptive</span>}</div>
        <p className="year-paper-note">The timed paper is being prepared.</p>
      </article>)}
    </div>
    {visible.length === 0 && <p>No year-wise source sets are available for this exam yet.</p>}
    <p className="year-papers-footer">Want to try the exam room now? <Link to="/sample">Take the free sample</Link>.</p>
  </section>;
}

export default function Papers() { return <PapersView />; }
