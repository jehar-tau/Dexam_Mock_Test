import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseArticle, parseInline, articleText, articleExcerpt, articleStats, applyFormat, contactDetails, articleProblems,
  normalizeArticle, CONTACT_PATTERNS, ARTICLE_BODY } from "../src/community-article.mjs";

const filler = "An original fictional paragraph about planning a sketching routine before the studio test. ".repeat(4);

test("blocks: headings, paragraphs, lists, quotes and rules parse in order", () => {
  const blocks = parseArticle("## Plan\n\nFirst line\nsecond line\n\n- one\n- **two**\n\n1. first\n2. second\n\n> keep going\n> every day\n\n---\n### Small\ntail");
  assert.deepEqual(blocks.map(block => block.type), ["heading", "paragraph", "list", "list", "quote", "rule", "heading", "paragraph"]);
  assert.equal(blocks[0].level, 2); assert.equal(blocks[6].level, 3);
  assert.deepEqual(blocks[1].inline, [{ text: "First line second line" }]);
  assert.equal(blocks[2].ordered, false); assert.deepEqual(blocks[2].items[1], [{ text: "two", bold: true }]);
  assert.equal(blocks[3].ordered, true); assert.equal(blocks[3].items.length, 2);
  assert.deepEqual(blocks[4].inline, [{ text: "keep going every day" }]);
});

test("inline: bold, italic and nesting; unclosed markers stay literal", () => {
  assert.deepEqual(parseInline("a **b** *c* d"), [{ text: "a " }, { text: "b", bold: true }, { text: " " }, { text: "c", italic: true }, { text: " d" }]);
  assert.deepEqual(parseInline("**bold *both* end**"), [{ text: "bold ", bold: true }, { text: "both", bold: true, italic: true }, { text: " end", bold: true }]);
  assert.deepEqual(parseInline("2 * 3 = 6 and **open"), [{ text: "2 * 3 = 6 and **open" }]);
  assert.deepEqual(parseInline("****"), [{ text: "****" }]);
});

test("nothing is interpreted as markup: tags, scripts and links remain plain characters", () => {
  const source = "<script>alert(1)</script> [link](javascript:alert(1)) <img src=x onerror=alert(1)> https://example.invalid/page";
  const blocks = parseArticle(source);
  assert.equal(blocks.length, 1); assert.equal(blocks[0].type, "paragraph");
  assert.equal(blocks[0].inline.map(part => part.text).join(""), source);
  for (const part of blocks[0].inline) assert.deepEqual(Object.keys(part).filter(key => !["text", "bold", "italic"].includes(key)), []);
  assert.deepEqual(parseArticle("# Only two and three hashes are headings")[0].type, "paragraph");
});

test("windows line endings, empty input and very long input are handled", () => {
  assert.deepEqual(parseArticle("a\r\n\r\nb").map(block => block.inline[0].text), ["a", "b"]);
  assert.deepEqual(parseArticle(""), []); assert.deepEqual(parseArticle(null), []);
  assert.equal(parseArticle(("word ".repeat(40) + "\n\n").repeat(90)).length, 90);
});

test("text, excerpt and reading time come from the rendered words, not the markers", () => {
  const source = "## Title here\n\n**Bold** start and *more*.\n\n- item one\n- item two\n\n---";
  assert.equal(articleText(source), "Title here Bold start and more. item one item two");
  assert.equal(articleExcerpt(source, 12), "Title here…");
  assert.equal([...articleExcerpt("x".repeat(900))].length, 400);
  assert.deepEqual(articleStats(source), { words: 10, minutes: 1 });
  assert.equal(articleStats("word ".repeat(600)).minutes, 3);
  assert.deepEqual(articleStats(""), { words: 0, minutes: 1 });
});

test("toolbar edits wrap the selection or prefix whole lines and return the new selection", () => {
  assert.deepEqual(applyFormat("make this bold", 5, 9, "bold"), { value: "make **this** bold", selectionStart: 7, selectionEnd: 11 });
  assert.deepEqual(applyFormat("", 0, 0, "italic"), { value: "*italic text*", selectionStart: 1, selectionEnd: 12 });
  assert.equal(applyFormat("one\ntwo\nthree", 1, 6, "bullet").value, "- one\n- two\nthree");
  assert.equal(applyFormat("- one\n- two", 0, 11, "number").value, "1. one\n2. two");
  assert.equal(applyFormat("## was heading", 3, 3, "quote").value, "> was heading");
  assert.equal(applyFormat("title", 2, 2, "heading").value, "## title");
  assert.equal(applyFormat("above", 5, 5, "rule").value, "above\n\n---\n\n");
  assert.deepEqual(applyFormat("same", 1, 2, "unknown"), { value: "same", selectionStart: 1, selectionEnd: 2 });
});

test("contact guard refuses phone numbers, emails, handles and messaging links", () => {
  const refused = {
    phone: ["Call 98765 43210 after six", "my no is +91-98765-43210", "9 8 7 6 5 4 3 2 1 0", "(987) 654.3210"],
    email: ["write to asha@example.invalid", "asha (at) example (dot) invalid", "ASHA@EXAMPLE.INVALID"],
    handle: ["follow @asha.draws", "DM me for the notes", "ping me if you want the file", "my insta is ashadraws", "Instagram id ashadraws",
      "join our WhatsApp group", "message me later", "My Telegram has the PDF"],
    link: ["https://wa.me/123", "t.me/designprep", "instagram.com/ashadraws", "discord.gg/abc", "chat.whatsapp.com/xyz"],
  };
  for (const [kind, samples] of Object.entries(refused)) for (const sample of samples) assert.equal(contactDetails(sample), kind, sample);
});

test("contact guard allows years, marks, ranks, fees, ratios and ordinary sentences", () => {
  for (const sample of ["I scored 142.5 in UCEED 2026 and rank 1,204", "Fees are about ₹2,50,000 a year for 4 years", "From 2019 to 2026 the cutoff moved",
    "Use a 3:4 ratio @ 300 dpi", "I found the idea on Instagram and adapted it", "Look at the internet.media examples", "The format.me idea is odd",
    "Add measurements: 120 mm x 80 mm x 45 mm", "Time split: 20 + 25 + 15 minutes", "Question 12 took 4 minutes; question 13 took 9",
    "Email the exam office through the official site if the admit card is wrong", "They call me in for the studio test at 9", ""])
    assert.equal(contactDetails(sample), null, sample);
});

test("the server applies exactly the same patterns as the browser", () => {
  const sql = readFileSync(new URL("../supabase/migrations/202611160170_community_articles.sql", import.meta.url), "utf8");
  const body = sql.slice(sql.indexOf("create function dm_private.community_contact_check"), sql.indexOf("] loop"));
  const server = [...body.matchAll(/\$p\$(.*?)\$p\$/g)].map(match => match[1]);
  assert.deepEqual(server, CONTACT_PATTERNS.map(([, source]) => source));
  assert.equal(server.some(source => /\\b|\(\?/.test(source)), false, "patterns must stay portable between JavaScript and PostgreSQL");
});

test("publishing problems name each field and the contact reason", () => {
  const valid = { exam: " NID ", topic: " Studio test ", title: "How I planned my studio test week", body: `## Plan\n\n${filler}` };
  assert.deepEqual(articleProblems(valid), {});
  assert.deepEqual(normalizeArticle(valid).exam, "nid");
  assert.deepEqual(Object.keys(articleProblems({})).sort(), ["body", "exam", "title", "topic"]);
  assert.match(articleProblems({ ...valid, body: "short" }).body, /at least 200/);
  assert.match(articleProblems({ ...valid, body: "x".repeat(ARTICLE_BODY.max + 1) }).body, /20,000/);
  assert.match(articleProblems({ ...valid, body: valid.body + " Call 9876543210." }).contact, /phone number/);
  assert.match(articleProblems({ ...valid, title: "Follow @asha.draws for more" }).contact, /handle/);
});

import { workProblems, normalizeWork, FEEDBACK_TEMPLATE } from "../src/community-article.mjs";

test("work posts need both prompts, a title and no contact details", () => {
  const valid = { exam: "NID", topic: " Studio test ", title: "My first fictional poster for review",
    intent: "I wanted a calm poster that reads well from far away.", request: "Is the hierarchy clear, and does the type fit?" };
  assert.deepEqual(workProblems(valid), {});
  assert.equal(normalizeWork(valid).topic, "Studio test");
  assert.deepEqual(Object.keys(workProblems({})).sort(), ["exam", "intent", "request", "title", "topic"]);
  assert.match(workProblems({ ...valid, request: "too short" }).request, /what you want feedback on/);
  assert.match(workProblems({ ...valid, intent: "x".repeat(2001) }).intent, /2,000/);
  assert.match(workProblems({ ...valid, request: valid.request + " Message me on Instagram id ashadraws." }).contact, /handle/);
  assert.match(FEEDBACK_TEMPLATE, /^What works:\n\nWhat to improve:\n\nHow to improve it:\n$/);
});
