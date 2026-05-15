"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Typography from "@tiptap/extension-typography";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  ImageIcon,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Table2,
  UnderlineIcon,
  Undo2,
} from "lucide-react";

type RichTextStudioEditorProps = {
  value: string;
  onChange: (value: { html: string; plainText: string; json: Record<string, unknown> }) => void;
};

const toolbarGroups = [
  [
    { label: "Undo", icon: Undo2, action: "undo" },
    { label: "Redo", icon: Redo2, action: "redo" },
  ],
  [
    { label: "Bold", icon: Bold, action: "bold" },
    { label: "Italic", icon: Italic, action: "italic" },
    { label: "Underline", icon: UnderlineIcon, action: "underline" },
    { label: "Highlight", icon: Highlighter, action: "highlight" },
  ],
  [
    { label: "Bullet list", icon: List, action: "bulletList" },
    { label: "Numbered list", icon: ListOrdered, action: "orderedList" },
    { label: "Quote", icon: Quote, action: "blockquote" },
    { label: "Divider", icon: Minus, action: "horizontalRule" },
  ],
  [
    { label: "Align left", icon: AlignLeft, action: "left" },
    { label: "Align center", icon: AlignCenter, action: "center" },
    { label: "Align right", icon: AlignRight, action: "right" },
  ],
  [
    { label: "Table", icon: Table2, action: "table" },
    { label: "Image", icon: ImageIcon, action: "image" },
    { label: "Link", icon: LinkIcon, action: "link" },
    { label: "Paragraph", icon: Pilcrow, action: "paragraph" },
  ],
] as const;

export default function RichTextStudioEditor({ value, onChange }: RichTextStudioEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Underline,
      TextStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Write, paste, or ask AI to draft..." }),
      CharacterCount,
      Typography,
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none dark:prose-invert min-h-[360px] px-5 py-4 text-edsync-text",
      },
    },
    onUpdate({ editor: nextEditor }) {
      onChange({
        html: nextEditor.getHTML(),
        plainText: nextEditor.getText(),
        json: nextEditor.getJSON() as Record<string, unknown>,
      });
    },
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  const runAction = (action: string) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (action === "undo") chain.undo().run();
    if (action === "redo") chain.redo().run();
    if (action === "bold") chain.toggleBold().run();
    if (action === "italic") chain.toggleItalic().run();
    if (action === "underline") chain.toggleUnderline().run();
    if (action === "highlight") chain.toggleHighlight({ color: "#fef08a" }).run();
    if (action === "bulletList") chain.toggleBulletList().run();
    if (action === "orderedList") chain.toggleOrderedList().run();
    if (action === "blockquote") chain.toggleBlockquote().run();
    if (action === "horizontalRule") chain.setHorizontalRule().run();
    if (action === "left" || action === "center" || action === "right") chain.setTextAlign(action).run();
    if (action === "paragraph") chain.setParagraph().run();
    if (action === "table") {
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }
    if (action === "image") {
      const url = window.prompt("Paste a secure image URL");
      if (url?.startsWith("https://")) chain.setImage({ src: url }).run();
    }
    if (action === "link") {
      const url = window.prompt("Paste a secure link");
      if (url?.startsWith("https://")) chain.setLink({ href: url }).run();
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-edsync-border bg-edsync-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-edsync-border bg-edsync-surface p-2">
        <select
          className="edsync-input h-9 w-32 px-2 py-1 text-xs"
          onChange={(event) => editor?.chain().focus().setFontFamily(event.target.value).run()}
          defaultValue="Inter"
        >
          <option value="Inter">Inter</option>
          <option value="Arial">Arial</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
        </select>
        <select
          className="edsync-input h-9 w-32 px-2 py-1 text-xs"
          onChange={(event) => {
            const level = Number(event.target.value);
            if (level === 0) editor?.chain().focus().setParagraph().run();
            if (level >= 1 && level <= 4) {
              editor?.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 }).run();
            }
          }}
          defaultValue="0"
        >
          <option value="0">Paragraph</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
          <option value="4">Heading 4</option>
        </select>
        {toolbarGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="flex rounded-md border border-edsync-border bg-edsync-bg p-0.5">
            {group.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.action}
                  type="button"
                  className="rounded p-2 text-edsync-subtle transition hover:bg-edsync-muted hover:text-edsync-text"
                  title={item.label}
                  onClick={() => runAction(item.action)}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <EditorContent editor={editor} />
      <div className="flex items-center justify-between border-t border-edsync-border px-4 py-2 text-xs text-edsync-subtle">
        <span>{editor?.storage.characterCount.words() ?? 0} words</span>
        <span>{Math.max(1, Math.ceil((editor?.storage.characterCount.words() ?? 0) / 180))} min read</span>
      </div>
    </div>
  );
}
