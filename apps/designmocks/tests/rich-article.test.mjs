import assert from "node:assert/strict";
import test from "node:test";
import { articleToDoc, docToArticle } from "../src/rich-article.mjs";
import { parseArticle } from "../src/community-article.mjs";

const sample = `## What worked

I timed **every** section and wrote *one* note after each paper.

### The routine

- Warm up with ten gesture sketches
- Time one full composition

1. Read the question
2. Sketch thumbnails

> Finish early, review slowly.

---

Last paragraph.`;

test("stored articles survive a round trip through the editor document", () => {
  const doc = articleToDoc(sample);
  assert.deepEqual(doc.content.map(node => node.type), ["heading", "paragraph", "heading", "bulletList", "orderedList", "blockquote", "horizontalRule", "paragraph"]);
  assert.deepEqual(doc.content[0].attrs, { level: 2 });
  assert.deepEqual(doc.content[2].attrs, { level: 3 });
  assert.equal(docToArticle(doc), sample);
  assert.deepEqual(parseArticle(docToArticle(doc)), parseArticle(sample));
});

test("editor-only structure folds into the stored format", () => {
  const doc = { type: "doc", content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title " }, { type: "text", text: "bold", marks: [{ type: "bold" }] }] },
    { type: "paragraph", content: [{ type: "text", text: "one" }, { type: "hardBreak" }, { type: "text", text: "two " }, { type: "text", text: "both ", marks: [{ type: "bold" }, { type: "italic" }] }, { type: "text", text: "end" }] },
    { type: "paragraph" },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "first" }] }, { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "nested" }] }] }] }] }] },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }, { type: "paragraph", content: [{ type: "text", text: "b" }] }] },
  ] };
  assert.equal(docToArticle(doc), "## Title **bold**\n\none two ***both*** end\n\n- first nested\n\n> a b");
  assert.equal(docToArticle({ type: "doc", content: [{ type: "paragraph" }] }), "");
  assert.deepEqual(articleToDoc("").content, [{ type: "paragraph" }]);
});
