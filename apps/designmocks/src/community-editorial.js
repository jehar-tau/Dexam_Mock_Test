import { editorialProblems, orderEditorial, parseEditorial } from "./community-editorial.mjs";

const files = import.meta.glob("./community-editorial/*.md", { query: "?raw", import: "default", eager: true });

// A file with a problem is left out rather than shown half-formed; the unit
// test fails on it first.
export const editorialArticles = Object.freeze(orderEditorial(Object.entries(files)
  .map(([path, raw]) => parseEditorial(raw, path))
  .filter(article => editorialProblems(article).length === 0)));

export const findEditorial = slug => editorialArticles.find(article => article.slug === slug) ?? null;
