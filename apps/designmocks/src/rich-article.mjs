// Converts between the stored article text (the Markdown subset in
// community-article.mjs) and the rich editor's document (TipTap/ProseMirror
// JSON). Storage stays the same, so old posts and drafts open in the new editor.
import { parseArticle } from "./community-article.mjs";

const textNode = part => ({ type: "text", text: part.text,
  ...(part.bold || part.italic ? { marks: [...(part.bold ? [{ type: "bold" }] : []), ...(part.italic ? [{ type: "italic" }] : [])] } : {}) });
const inline = parts => parts.filter(part => part.text).map(textNode);
const paragraph = parts => ({ type: "paragraph", ...(parts.length ? { content: inline(parts) } : {}) });

export function articleToDoc(source) {
  const content = parseArticle(source).map(block => {
    if (block.type === "heading") return { type: "heading", attrs: { level: block.level }, content: inline(block.inline) };
    if (block.type === "list") return { type: block.ordered ? "orderedList" : "bulletList",
      content: block.items.map(item => ({ type: "listItem", content: [paragraph(item)] })) };
    if (block.type === "quote") return { type: "blockquote", content: [paragraph(block.inline)] };
    if (block.type === "rule") return { type: "horizontalRule" };
    return paragraph(block.inline);
  });
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

// Inline text with **bold** and *italic*. Line breaks inside a block become spaces,
// because the stored format joins a block's lines.
function inlineText(nodes = []) {
  return nodes.map(node => {
    if (node.type === "hardBreak") return " ";
    if (node.type !== "text") return inlineText(node.content);
    const text = node.text.replace(/\s*\n\s*/g, " ");
    const marks = new Set((node.marks ?? []).map(mark => mark.type));
    const core = text.trim(), lead = text.slice(0, text.length - text.trimStart().length), tail = text.slice(text.trimEnd().length);
    if (!core) return text;
    let out = core;
    if (marks.has("italic")) out = `*${out}*`;
    if (marks.has("bold")) out = `**${out}**`;
    return lead + out + tail;
  }).join("").replace(/\*\*\*\*/g, "");
}

// Text of every paragraph inside a block (list items and quotes can hold several).
const blockText = node => (node.content ?? []).map(child => child.type === "paragraph" || child.type === "heading" ? inlineText(child.content)
  : blockText(child)).filter(Boolean).join(" ").trim();

export function docToArticle(doc) {
  const blocks = [];
  for (const node of doc?.content ?? []) {
    if (node.type === "heading") {
      const text = inlineText(node.content).trim();
      if (text) blocks.push(`${node.attrs?.level === 3 ? "###" : "##"} ${text}`);
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      const items = (node.content ?? []).map(blockText).filter(Boolean);
      if (items.length) blocks.push(items.map((item, index) => node.type === "orderedList" ? `${index + 1}. ${item}` : `- ${item}`).join("\n"));
    } else if (node.type === "blockquote") {
      const text = blockText(node);
      if (text) blocks.push(`> ${text}`);
    } else if (node.type === "horizontalRule") blocks.push("---");
    else {
      const text = inlineText(node.content).trim();
      if (text) blocks.push(text);
    }
  }
  return blocks.join("\n\n");
}
