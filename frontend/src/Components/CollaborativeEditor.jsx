import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
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
} from "lucide-react";

const lowlight = createLowlight(common);

const ToolbarButton = ({ onClick, active, disabled, icon, label }) => {
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
      onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
    >
      <Icon className="size-3.5" />
    </button>
  );
};

const EditorToolbar = ({ editor }) => {
  if (!editor) return null;

  const handleButtonClick = (callback) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    callback();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-base-300/60 bg-base-200/70 px-2 py-1">
      <ToolbarButton
        icon={BoldIcon}
        label="Bold (Ctrl+B)"
        onClick={handleButtonClick(() =>
          editor.chain().focus().toggleBold().run()
        )}
        active={editor.isActive("bold")}
        disabled={!editor.can().chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={ItalicIcon}
        label="Italic (Ctrl+I)"
        onClick={handleButtonClick(() =>
          editor.chain().focus().toggleItalic().run()
        )}
        active={editor.isActive("italic")}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={StrikethroughIcon}
        label="Strikethrough (Ctrl+Shift+X)"
        onClick={handleButtonClick(() =>
          editor.chain().focus().toggleStrike().run()
        )}
        active={editor.isActive("strike")}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
      />
      <span className="divider divider-horizontal mx-1" />
      <ToolbarButton
        icon={ListIcon}
        label="Bullet list"
        onClick={handleButtonClick(() =>
          editor.chain().focus().toggleBulletList().run()
        )}
        active={editor.isActive("bulletList")}
        disabled={!editor.can().chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={ListOrderedIcon}
        label="Ordered list"
        onClick={handleButtonClick(() =>
          editor.chain().focus().toggleOrderedList().run()
        )}
        active={editor.isActive("orderedList")}
        disabled={!editor.can().chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={QuoteIcon}
        label="Blockquote"
        onClick={handleButtonClick(() =>
          editor.chain().focus().toggleBlockquote().run()
        )}
        active={editor.isActive("blockquote")}
        disabled={!editor.can().chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        icon={CodeIcon}
        label="Code block"
        onClick={handleButtonClick(() =>
          editor.chain().focus().toggleCodeBlock().run()
        )}
        active={editor.isActive("codeBlock")}
        disabled={!editor.can().chain().focus().toggleCodeBlock().run()}
      />
    </div>
  );
};

const CollaborativeEditor = ({
  provider,
  doc,
  user,
  color,
  placeholder = "Start writing...",
  readOnly = false,
  onReady,
  onTyping,
}) => {
  const onTypingRef = useRef(onTyping);

  // Keep ref updated without causing re-renders
  useEffect(() => {
    onTypingRef.current = onTyping;
  }, [onTyping]);

  const editor = useEditor(
    provider && doc
      ? {
          editable: !readOnly,
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
              history: false,
              codeBlock: false,
              bulletList: false,
              orderedList: false,
              listItem: false,
              blockquote: false,
            }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Placeholder.configure({
              placeholder: placeholder + " (Type '/' for commands)",
            }),
            SlashCommands,
            Collaboration.configure({ document: doc }),
            CollaborationCursor.configure({
              provider,
              user: {
                id: user?.id,
                name: user?.name ?? "Anonymous",
                color,
              },
            }),
          ],
          editorProps: {
            attributes: {
              class:
                "prose prose-sm sm:prose-base prose-ul:list-disc prose-ol:list-decimal prose-li:ml-4 max-w-none h-full min-h-[24rem] rounded-2xl border border-base-300/60 bg-base-100/90 px-4 py-5 focus:outline-none focus:ring-2 focus:ring-primary/20",
            },
            handleKeyDown: () => {
              if (onTypingRef.current && !readOnly) {
                onTypingRef.current();
              }
              return false;
            },
          },
        }
      : null,
    [provider, doc, user?.id, user?.name, color, readOnly, placeholder]
  );

  useEffect(() => {
    if (editor && typeof onReady === "function") {
      onReady(editor);
    }
  }, [editor, onReady]);

  if (!provider || !doc) {
    return (
      <div className="grid min-h-[16rem] place-items-center rounded-2xl border border-base-300/60 bg-base-100/90">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!readOnly && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
};

export default CollaborativeEditor;
