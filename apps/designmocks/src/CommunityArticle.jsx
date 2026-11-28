import React, { useMemo } from "react";
import { parseArticle } from "./community-article.mjs";

// Renders the parsed block list as elements. The source is never treated as
// HTML, so whatever a writer types can only ever appear as text.
function Inline({ parts }) {
  return parts.map((part, index) => {
    let node = part.text;
    if (part.italic) node = <em>{node}</em>;
    if (part.bold) node = <strong>{node}</strong>;
    return <React.Fragment key={index}>{node}</React.Fragment>;
  });
}

// `top` is the HTML level of a "##" section: 3 inside a post under its own h2,
// 2 when the article sits directly under the page's h1 (the guides).
export function CommunityArticle({ source, top = 3 }) {
  const blocks = useMemo(() => parseArticle(source), [source]);
  const Section = `h${top}`, Subsection = `h${top + 1}`;
  return <div className="community-article">
    {blocks.map((block, index) => {
      if (block.type === "heading") return block.level === 2 ? <Section key={index}><Inline parts={block.inline} /></Section> : <Subsection key={index}><Inline parts={block.inline} /></Subsection>;
      if (block.type === "list") {
        const items = block.items.map((item, position) => <li key={position}><Inline parts={item} /></li>);
        return block.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
      }
      if (block.type === "quote") return <blockquote key={index}><Inline parts={block.inline} /></blockquote>;
      if (block.type === "rule") return <hr key={index} />;
      return <p key={index}><Inline parts={block.inline} /></p>;
    })}
  </div>;
}
