import { useEffect, useCallback } from "react";
import {
  BubbleMenu,
  EditorContent,
  useEditor,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import Blockquote from "@tiptap/extension-blockquote";
import { common, createLowlight } from "lowlight";
import SlashCommands from "./SlashCommands";
import {
  BoldIcon,
  ItalicIcon,
  ListOrderedIcon,
  ListIcon,
  QuoteIcon,
  StrikethroughIcon,
  CodeIcon,
  type LucideIcon,
} from "lucide-react";

const lowlight = createLowlight(common);

/* ── Toolbar Button ── */

interface ToolbarButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  active: boolean;
  disabled: boolean;
  icon: LucideIcon;
  label: string;
}

const ToolbarButton = ({
  onClick,
  active,
  disabled,
  icon,
  label,
}: ToolbarButtonProps) => {
  const Icon = icon;
  return (
    <button
      type="button"
      className={`btn btn-xs gap-2 ${active ? "btn-primary" : "btn-ghost"} ${
        disabled ? "btn-disabled opacity-40" : ""
      }`}
      onClick={onClick}
      disabled={disabled}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Icon className="size-3.5" />
    </button>
  );
};

/* ── Bubble Toolbar ── */

const BubbleToolbar = ({ editor }: { editor: Editor }) => {
  const wrap = (fn: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-base-300/50 bg-base-100 px-1.5 py-1 shadow-lg">
      <ToolbarButton
        icon={BoldIcon}
        label="Bold (Ctrl+B)"
        onClick={wrap(() => editor.chain().focus().toggleBold().run())}
        active={editor.isActive("bold")}
        disabled={!editor.can().chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={ItalicIcon}
        label="Italic (Ctrl+I)"
        onClick={wrap(() => editor.chain().focus().toggleItalic().run())}
        active={editor.isActive("italic")}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={StrikethroughIcon}
        label="Strikethrough"
        onClick={wrap(() => editor.chain().focus().toggleStrike().run())}
        active={editor.isActive("strike")}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
      />
      <span className="mx-0.5 h-4 w-px bg-base-300/60" />
      <ToolbarButton
        icon={ListIcon}
        label="Bullet list"
        onClick={wrap(() => editor.chain().focus().toggleBulletList().run())}
        active={editor.isActive("bulletList")}
        disabled={!editor.can().chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={ListOrderedIcon}
        label="Ordered list"
        onClick={wrap(() => editor.chain().focus().toggleOrderedList().run())}
        active={editor.isActive("orderedList")}
        disabled={!editor.can().chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={QuoteIcon}
        label="Blockquote"
        onClick={wrap(() => editor.chain().focus().toggleBlockquote().run())}
        active={editor.isActive("blockquote")}
        disabled={!editor.can().chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        icon={CodeIcon}
        label="Code block"
        onClick={wrap(() => editor.chain().focus().toggleCodeBlock().run())}
        active={editor.isActive("codeBlock")}
        disabled={!editor.can().chain().focus().toggleCodeBlock().run()}
      />
    </div>
  );
};

/* ── Public API ── */

export interface SimpleEditorProps {
  /** Initial HTML or plain‑text content */
  initialContent?: string;
  placeholder?: string;
  /** Called on every content change with { html, text } */
  onChange?: (payload: { html: string; text: string }) => void;
  /** Called once when the editor is ready */
  onReady?: (editor: Editor) => void;
}

const SimpleEditor = ({
  initialContent = "",
  placeholder = "Start typing, or press '/' for commands…",
  onChange,
  onReady,
}: SimpleEditorProps) => {
  const handleUpdate = useCallback(
    ({ editor: e }: { editor: Editor }) => {
      onChange?.({
        html: e.getHTML(),
        text: e.getText({ blockSeparator: "\n" }),
      });
    },
    [onChange],
  );

  const editor = useEditor({
    content: initialContent,
    extensions: [
      Document,
      Paragraph,
      Text,
      BulletList,
      OrderedList,
      ListItem,
      Blockquote,
      CodeBlockLowlight.configure({ lowlight }),
      StarterKit.configure({
        document: false,
        paragraph: false,
        text: false,
        history: {},
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      SlashCommands,
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-lg prose-ul:list-disc prose-ol:list-decimal prose-li:ml-4 max-w-none min-h-[40vh] leading-relaxed focus:outline-none",
      },
    },
    onUpdate: handleUpdate,
  });

  useEffect(() => {
    if (editor && onReady) onReady(editor);
  }, [editor, onReady]);

  return (
    <div>
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 150, placement: "top" }}
        >
          <BubbleToolbar editor={editor} />
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
};

export default SimpleEditor;
