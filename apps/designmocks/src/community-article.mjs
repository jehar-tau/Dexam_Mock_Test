// Community articles are stored as plain text in a fixed Markdown subset and
// rendered from this block list. Nothing here produces HTML: unknown syntax
// stays as the characters the writer typed.
export const ARTICLE_TITLE = Object.freeze({ min: 8, max: 160 });
export const ARTICLE_BODY = Object.freeze({ min: 200, max: 20000 });
export const ARTICLE_TOPIC_MAX = 100;
export const ARTICLE_EXAMS = Object.freeze(["uceed", "ceed", "nid", "nift"]);
const length = value => [...value].length;

// Inline: **bold** and *italic*. Markers that do not close are literal text.
export function parseInline(text) {
  const parts = [];
  const push = (value, style = {}) => {
    if (!value) return;
    const last = parts.at(-1);
    if (last && Boolean(last.bold) === Boolean(style.bold) && Boolean(last.italic) === Boolean(style.italic)) last.text += value;
    else parts.push({ text: value, ...(style.bold ? { bold: true } : {}), ...(style.italic ? { italic: true } : {}) });
  };
  let index = 0, plain = "";
  while (index < text.length) {
    const marker = text.startsWith("**", index) ? "**" : text[index] === "*" ? "*" : null;
    if (marker) {
      const end = text.indexOf(marker, index + marker.length), inner = end < 0 ? "" : text.slice(index + marker.length, end);
      if (end > index + marker.length && inner.trim() === inner && (marker === "**" || !inner.includes("*"))) {
        push(plain); plain = "";
        if (marker === "**") for (const part of parseInline(inner)) push(part.text, { bold: true, italic: part.italic });
        else push(inner, { italic: true });
        index = end + marker.length; continue;
      }
      plain += marker; index += marker.length; continue;
    }
    plain += text[index++];
  }
  push(plain);
  return parts;
}

export function parseArticle(source) {
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n"), blocks = [];
  let paragraph = [], list = null, quote = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", inline: parseInline(paragraph.join(" ")) });
    if (list) blocks.push(list);
    if (quote.length) blocks.push({ type: "quote", inline: parseInline(quote.join(" ")) });
    paragraph = []; list = null; quote = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    let match;
    if (!line) flush();
    else if (/^-{3,}$/.test(line)) { flush(); blocks.push({ type: "rule" }); }
    else if ((match = /^(#{2,3})\s+(.+)$/.exec(line))) { flush(); blocks.push({ type: "heading", level: match[1].length, inline: parseInline(match[2]) }); }
    else if ((match = /^(?:-|(\d{1,3})\.)\s+(.+)$/.exec(line))) {
      const ordered = match[1] !== undefined;
      if (!list || list.ordered !== ordered) { flush(); list = { type: "list", ordered, items: [] }; }
      list.items.push(parseInline(match[2]));
    }
    else if ((match = /^>\s?(.*)$/.exec(line))) { if (paragraph.length || list) flush(); quote.push(match[1]); }
    else { if (list || quote.length) flush(); paragraph.push(line); }
  }
  flush();
  return blocks;
}

const inlineText = inline => inline.map(part => part.text).join("");
export function articleText(source) {
  return parseArticle(source).map(block => block.type === "list" ? block.items.map(inlineText).join(" ")
    : block.type === "rule" ? "" : inlineText(block.inline)).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
export function articleExcerpt(source, max = 400) {
  const text = [...articleText(source)];
  return text.length <= max ? text.join("") : text.slice(0, max - 1).join("").trimEnd() + "…";
}
export function articleStats(source) {
  const text = articleText(source), words = text ? text.split(" ").length : 0;
  return { words, minutes: Math.max(1, Math.round(words / 200)) };
}

// Toolbar edits return the new text and selection so the textarea keeps focus.
const linePrefixes = { heading: "## ", subheading: "### ", bullet: "- ", number: "1. ", quote: "> " };
export function applyFormat(value, start, end, kind) {
  if (kind === "bold" || kind === "italic") {
    const marker = kind === "bold" ? "**" : "*", selected = value.slice(start, end) || (kind === "bold" ? "bold text" : "italic text");
    return { value: value.slice(0, start) + marker + selected + marker + value.slice(end), selectionStart: start + marker.length, selectionEnd: start + marker.length + selected.length };
  }
  if (kind === "rule") {
    const insert = (start && value[start - 1] !== "\n" ? "\n" : "") + "\n---\n\n";
    return { value: value.slice(0, start) + insert + value.slice(end), selectionStart: start + insert.length, selectionEnd: start + insert.length };
  }
  const prefix = linePrefixes[kind];
  if (!prefix) return { value, selectionStart: start, selectionEnd: end };
  const from = value.lastIndexOf("\n", start - 1) + 1, to = value.indexOf("\n", end) < 0 ? value.length : value.indexOf("\n", end);
  const lines = value.slice(from, to).split("\n").map((line, index) => {
    const bare = line.replace(/^(#{2,3}\s+|-\s+|\d{1,3}\.\s+|>\s?)/, "");
    return (kind === "number" ? `${index + 1}. ` : prefix) + bare;
  }).join("\n");
  return { value: value.slice(0, from) + lines + value.slice(to), selectionStart: from, selectionEnd: from + lines.length };
}

// Contact-details guard. These sources are the same regular expressions the
// server applies in dm_private.community_contact_check; a unit test compares
// them with the migration so the two cannot drift. Portable syntax only
// (no \b), matched case-insensitively.
export const CONTACT_PATTERNS = Object.freeze([
  ["email", "[a-z0-9._%+-]+(@|\\s*\\(at\\)\\s*|\\s*\\[at\\]\\s*)[a-z0-9-]+(\\.|\\s*\\(dot\\)\\s*|\\s*\\[dot\\]\\s*)[a-z]{2,}"],
  ["phone", "(\\d[\\s().+-]{0,2}){9}\\d"],
  ["handle", "(^|[^a-z0-9_.])@[a-z0-9_.]{3,}"],
  ["handle", "(^|[^a-z])(dm|ping|text|message|msg|add|follow|contact|whatsapp|telegram)\\s+me($|[^a-z])"],
  ["handle", "(^|[^a-z])my\\s+(insta|instagram|whatsapp|telegram|snapchat|discord)($|[^a-z])"],
  ["handle", "(^|[^a-z])(insta|instagram|whatsapp|telegram|snapchat|discord)\\s*(id|handle|number|group|username)($|[^a-z])"],
  ["link", "(^|[^a-z0-9])(wa\\.me|t\\.me|telegram\\.me|chat\\.whatsapp\\.com|discord\\.gg|discord\\.com/invite|instagram\\.com/|facebook\\.com/|fb\\.com/|snapchat\\.com/)"],
]);
const contactTests = CONTACT_PATTERNS.map(([kind, source]) => [kind, new RegExp(source, "i")]);
export const contactMessages = Object.freeze({
  email: "Remove the email address. Community never shows contact details.",
  phone: "Remove the phone number or long digit sequence. Community never shows contact details.",
  handle: "Remove the social handle or the invitation to contact you. Keep the conversation here.",
  link: "Remove the messaging or social profile link.",
});
export function contactDetails(text) {
  const value = String(text ?? "");
  for (const [kind, test] of contactTests) if (test.test(value)) return kind;
  return null;
}

export function normalizeArticle(input = {}) {
  return {
    exam: String(input.exam ?? "").trim().toLowerCase(), topic: String(input.topic ?? "").trim(),
    title: String(input.title ?? "").trim(), body: String(input.body ?? "").replace(/\r\n?/g, "\n").trim(),
  };
}
// Returns { field: message } for everything that stops publishing.
export function articleProblems(input) {
  const value = normalizeArticle(input), problems = {};
  if (!ARTICLE_EXAMS.includes(value.exam)) problems.exam = "Choose an exam.";
  if (!value.topic || length(value.topic) > ARTICLE_TOPIC_MAX) problems.topic = "Add a topic of up to 100 characters.";
  if (length(value.title) < ARTICLE_TITLE.min || length(value.title) > ARTICLE_TITLE.max) problems.title = "Write a title of 8 to 160 characters.";
  if (length(value.body) < ARTICLE_BODY.min) problems.body = `Write at least ${ARTICLE_BODY.min} characters before publishing.`;
  else if (length(value.body) > ARTICLE_BODY.max) problems.body = "Keep the article within 20,000 characters.";
  const contact = contactDetails(`${value.topic}\n${value.title}\n${value.body}`);
  if (contact) problems.contact = contactMessages[contact];
  return problems;
}

// Work for feedback: two prompts that the server turns into headed sections.
export const WORK_PROMPT = Object.freeze({ min: 20, max: 2000 });
export function normalizeWork(input = {}) {
  return { ...normalizeArticle({ exam: input.exam, topic: input.topic, title: input.title, body: "" }),
    intent: String(input.intent ?? "").replace(/\r\n?/g, "\n").trim(), request: String(input.request ?? "").replace(/\r\n?/g, "\n").trim() };
}
export function workProblems(input) {
  const value = normalizeWork(input), problems = {};
  if (!ARTICLE_EXAMS.includes(value.exam)) problems.exam = "Choose an exam.";
  if (!value.topic || length(value.topic) > ARTICLE_TOPIC_MAX) problems.topic = "Add a topic of up to 100 characters.";
  if (length(value.title) < ARTICLE_TITLE.min || length(value.title) > ARTICLE_TITLE.max) problems.title = "Write a title of 8 to 160 characters.";
  for (const [field, label] of [["intent", "what you were trying to do"], ["request", "what you want feedback on"]])
    if (length(value[field]) < WORK_PROMPT.min || length(value[field]) > WORK_PROMPT.max) problems[field] = `Describe ${label} in 20 to 2,000 characters.`;
  const contact = contactDetails(`${value.topic}\n${value.title}\n${value.intent}\n${value.request}`);
  if (contact) problems.contact = contactMessages[contact];
  return problems;
}
export const FEEDBACK_TEMPLATE = "What works:\n\nWhat to improve:\n\nHow to improve it:\n";
