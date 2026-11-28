// A Medium-style writing surface (owner's feedback, 28 Nov 2026): write straight
// into the page, select text for a small formatting bar, or use shortcuts
// ("## " heading, "### " subheading, "- " list, "1. " numbered list, "> " quote,
// "---" divider, Ctrl/Cmd+B and +I). The text is stored in the same Markdown
// subset as before (rich-article.mjs), so drafts and published posts still work.
import React, { useEffect, useRef } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { articleToDoc, docToArticle } from "./rich-article.mjs";
import "./article-editor.css";

const kit = StarterKit.configure({ heading: { levels: [2, 3] }, code: false, codeBlock: false, strike: false, underline: false, link: false });

function Mark({ editor, label, active, run, children }) {
  return <button type="button" aria-label={label} aria-pressed={active} className={active ? "is-active" : undefined}
    onMouseDown={event => event.preventDefault()} onClick={() => run(editor.chain().focus()).run()}>{children}</button>;
}

function SelectionBar({ editor }) {
  const state = useEditorState({ editor, selector: ({ editor: current }) => ({
    bold: current.isActive("bold"), italic: current.isActive("italic"), h2: current.isActive("heading", { level: 2 }),
    h3: current.isActive("heading", { level: 3 }), quote: current.isActive("blockquote"),
  }) });
  return <BubbleMenu editor={editor} className="article-bubble" role="toolbar" aria-label="Format selected text">
    <Mark editor={editor} label="Bold" active={state.bold} run={chain => chain.toggleBold()}><b>B</b></Mark>
    <Mark editor={editor} label="Italic" active={state.italic} run={chain => chain.toggleItalic()}><i>i</i></Mark>
    <span aria-hidden="true" className="article-bubble-rule" />
    <Mark editor={editor} label="Heading" active={state.h2} run={chain => chain.toggleHeading({ level: 2 })}><span className="article-bubble-h2">T</span></Mark>
    <Mark editor={editor} label="Subheading" active={state.h3} run={chain => chain.toggleHeading({ level: 3 })}><span className="article-bubble-h3">T</span></Mark>
    <Mark editor={editor} label="Quote" active={state.quote} run={chain => chain.toggleBlockquote()}><span aria-hidden="true">“</span></Mark>
  </BubbleMenu>;
}

// Block buttons for touch screens, where selecting text to format is fiddly.
function BlockBar({ editor }) {
  const state = useEditorState({ editor, selector: ({ editor: current }) => ({
    h2: current.isActive("heading", { level: 2 }), h3: current.isActive("heading", { level: 3 }),
    bullet: current.isActive("bulletList"), ordered: current.isActive("orderedList"), quote: current.isActive("blockquote"),
  }) });
  return <div className="article-blockbar" role="toolbar" aria-label="Paragraph style">
    <Mark editor={editor} label="Heading" active={state.h2} run={chain => chain.toggleHeading({ level: 2 })}>Heading</Mark>
    <Mark editor={editor} label="Subheading" active={state.h3} run={chain => chain.toggleHeading({ level: 3 })}>Subheading</Mark>
    <Mark editor={editor} label="Bulleted list" active={state.bullet} run={chain => chain.toggleBulletList()}>Bulleted list</Mark>
    <Mark editor={editor} label="Numbered list" active={state.ordered} run={chain => chain.toggleOrderedList()}>Numbered list</Mark>
    <Mark editor={editor} label="Quote" active={state.quote} run={chain => chain.toggleBlockquote()}>Quote</Mark>
    <Mark editor={editor} label="Divider" active={false} run={chain => chain.setHorizontalRule()}>Divider</Mark>
  </div>;
}

export function ArticleEditor({ id, value, onChange, disabled = false, placeholder = "Tell your story…", labelledBy }) {
  const latest = useRef(value);
  const editor = useEditor({
    extensions: [kit, Placeholder.configure({ placeholder })],
    content: articleToDoc(value),
    editable: !disabled,
    immediatelyRender: true,
    editorProps: { attributes: { id, class: "article-editor-surface", role: "textbox", "aria-multiline": "true",
      ...(labelledBy ? { "aria-labelledby": labelledBy } : { "aria-label": "Article" }) } },
    onUpdate: ({ editor: current }) => { const text = docToArticle(current.getJSON()); if (text === latest.current) return; latest.current = text; onChange(text); },
  });
  // A draft opened from the list replaces the document; typing does not.
  useEffect(() => {
    if (!editor || value === latest.current) return;
    latest.current = value;
    editor.commands.setContent(articleToDoc(value), { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  if (!editor) return null;
  return <div className="article-editor">
    <BlockBar editor={editor} />
    <SelectionBar editor={editor} />
    <EditorContent editor={editor} />
  </div>;
}
