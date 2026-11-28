import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { CONTACT_PATTERNS } from "../src/community-article.mjs";
import { EDITORIAL_ORDER, editorialProblems, filterEditorial, orderEditorial, parseEditorial, relatedEditorial } from "../src/community-editorial.mjs";

const folder = new URL("../src/community-editorial/", import.meta.url);
const articles = readdirSync(folder).filter(name => name.endsWith(".md"))
  .map(name => parseEditorial(readFileSync(new URL(name, folder), "utf8"), `./community-editorial/${name}`));

test("every editorial article passes the format checks", () => {
  assert.ok(articles.length >= 20, `expected at least 20 articles, found ${articles.length}`);
  assert.deepEqual(articles.flatMap(editorialProblems), []);
  assert.equal(new Set(articles.map(article => article.slug)).size, articles.length);
});

test("the feed order names every article exactly once", () => {
  assert.deepEqual([...EDITORIAL_ORDER].sort(), articles.map(article => article.slug).sort());
  assert.deepEqual(orderEditorial(articles).map(article => article.slug), [...EDITORIAL_ORDER]);
});

test("editorial text carries no contact details", () => {
  for (const article of articles) for (const [kind, source] of CONTACT_PATTERNS)
    assert.doesNotMatch(`${article.title}\n${article.dek}\n${article.body}`, new RegExp(source, "i"), `${article.slug}: ${kind}`);
});

test("filters and related articles", () => {
  const sample = ["a-b", "c-d", "e-f"].map((slug, index) => parseEditorial(`---\nslug: ${slug}\ntitle: Title ${slug} here\ndek: Dek\nexams: ${index === 2 ? "nift" : "all"}\ntheme: ${index ? "skills" : "papers"}\ncover: eye\n---\n## A\n\nBody`));
  assert.equal(sample[0].allExams, true);
  assert.deepEqual(filterEditorial(sample, { exam: "nift" }).map(article => article.slug), ["a-b", "c-d", "e-f"]);
  assert.deepEqual(filterEditorial(sample, { exam: "ceed" }).map(article => article.slug), ["a-b", "c-d"]);
  assert.deepEqual(filterEditorial(sample, { theme: "skills" }).map(article => article.slug), ["c-d", "e-f"]);
  assert.deepEqual(relatedEditorial(sample[1], sample).map(article => article.slug), ["e-f", "a-b"]);
  assert.throws(() => parseEditorial("no frontmatter"), /missing frontmatter/);
});
