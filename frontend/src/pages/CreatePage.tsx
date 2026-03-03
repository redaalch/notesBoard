import { type FormEvent } from "react";
import {
  CloudIcon,
  EllipsisVerticalIcon,
  PinIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../lib/axios";
import TagInput from "../Components/TagInput";
import SimpleEditor from "../Components/SimpleEditor";
import TemplateGalleryModal from "../Components/TemplateGalleryModal";
import { useCommandPalette } from "../contexts/CommandPaletteContext";
import { normalizeTag } from "../lib/Utils";

const CreatePage = () => {
  const location = useLocation();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [richContent, setRichContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const [selectedNotebookId, setSelectedNotebookId] = useState(() => {
    const candidate = location.state?.notebookId;
    if (
      typeof candidate === "string" &&
      candidate !== "all" &&
      candidate !== "uncategorized"
    ) {
      return candidate;
    }
    return "";
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { registerCommands } = useCommandPalette();
  const editorRef = useRef<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const applyTemplate = useCallback((template: any) => {
    if (!template) return;

    setTitle(template.title ?? "");
    const templateContent = template.content ?? "";
    setContent(templateContent);
    setRichContent(templateContent);
    // If the editor is already mounted, set its content directly
    if (editorRef.current) {
      editorRef.current.commands.setContent(templateContent);
    }
    setTags(
      Array.isArray(template.tags)
        ? template.tags.map((tag: string) => normalizeTag(tag)).filter(Boolean)
        : [],
    );
    setPinned(Boolean(template.pinned));
    setActiveTemplate(template);
    toast.success(`Loaded the ${template.name} template`);
  }, []);

  useEffect(() => {
    const incomingTemplate = location.state?.template;
    if (incomingTemplate) {
      applyTemplate(incomingTemplate);
      navigate(location.pathname, {
        replace: true,
        state: selectedNotebookId ? { notebookId: selectedNotebookId } : {},
      });
    }
  }, [
    applyTemplate,
    location.pathname,
    location.state,
    navigate,
    selectedNotebookId,
  ]);
  const notebooksQuery = useQuery({
    queryKey: ["notebooks"],
    queryFn: async () => {
      const response = await api.get("/notebooks");
      const payload = response.data ?? {};
      return {
        notebooks: Array.isArray(payload.notebooks) ? payload.notebooks : [],
      };
    },
    staleTime: 180_000,
  });

  const notebooks = useMemo(() => {
    return Array.isArray(notebooksQuery.data?.notebooks)
      ? notebooksQuery.data.notebooks
      : [];
  }, [notebooksQuery.data]);

  useEffect(() => {
    const cleanup = registerCommands([
      {
        id: "create:open-templates",
        label: "Browse note templates",
        section: "Compose",
        action: () => setTemplateModalOpen(true),
      },
    ]);
    return cleanup;
  }, [registerCommands]);

  const handleTemplateSelect = (template: any) => {
    if (!template) return;
    setTemplateModalOpen(false);
    applyTemplate(template);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast.error("All fields are required");
      return;
    }

    setLoading(true);

    // Use requestAnimationFrame to prevent blocking UI
    requestAnimationFrame(async () => {
      try {
        await api.post("/notes", {
          title,
          content,
          tags,
          pinned,
          notebookId: selectedNotebookId || null,
        });

        toast.success("Note created successfully!");

        // Navigate first for perceived performance
        const destination = selectedNotebookId
          ? `/app?notebook=${encodeURIComponent(selectedNotebookId)}`
          : "/app";
        navigate(destination);

        // Invalidate queries in background (non-blocking)
        const invalidateTasks = [
          queryClient.invalidateQueries({ queryKey: ["notes"] }),
          queryClient.invalidateQueries({ queryKey: ["tag-stats"] }),
          queryClient.invalidateQueries({ queryKey: ["notebooks"] }),
        ];
        if (selectedNotebookId) {
          invalidateTasks.push(
            queryClient.invalidateQueries({
              queryKey: ["note-layout", selectedNotebookId],
            }),
          );
          invalidateTasks.push(
            queryClient.invalidateQueries({
              queryKey: ["notes", selectedNotebookId],
            }),
          );
        }
        // Don't await - let it happen in background
        Promise.all(invalidateTasks).catch(console.error);
      } catch (error: any) {
        console.error("Error creating note", error);
        if (error.response?.status === 429) {
          toast.error("Slow down! You're creating notes too fast", {
            duration: 4000,
            icon: "💀",
          });
        } else if (error.response?.data?.message) {
          toast.error(error.response.data.message);
        } else {
          toast.error("Failed to create note");
        }
      } finally {
        setLoading(false);
      }
    });
  };

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Editor content change handler
  const handleEditorChange = useCallback(
    ({ html, text }: { html: string; text: string }) => {
      setContent(text);
      setRichContent(html);
    },
    [],
  );

  const notebookLabel = useMemo(() => {
    if (!selectedNotebookId) return "Uncategorized";
    const nb = notebooks.find((n: any) => n.id === selectedNotebookId);
    return nb?.name ?? "Uncategorized";
  }, [selectedNotebookId, notebooks]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base-100">
      {/* ── Top Bar ── */}
      <header className="flex items-center justify-between border-b border-base-200/60 px-4 py-2.5 sm:px-6">
        {/* Left: Close */}
        <Link
          to="/app"
          className="btn btn-ghost btn-sm btn-circle"
          aria-label="Back to notes"
        >
          <XIcon className="size-4" />
        </Link>

        {/* Center: Auto-save indicator */}
        <div className="flex items-center gap-1.5 text-xs text-base-content/50">
          <CloudIcon className="size-3.5" />
          <span>Draft · {notebookLabel}</span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-primary btn-sm gap-1.5 font-semibold"
            onClick={() =>
              handleSubmit({
                preventDefault: () => {},
              } as FormEvent<HTMLFormElement>)
            }
            disabled={loading}
          >
            {loading ? "Creating…" : "Create"}
          </button>

          {/* Three-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Note options"
            >
              <EllipsisVerticalIcon className="size-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-base-300/40 bg-base-100 p-1.5 shadow-lg">
                {/* Pin toggle */}
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-base-300/25"
                  onClick={() => {
                    setPinned((v) => !v);
                    setMenuOpen(false);
                  }}
                >
                  <PinIcon
                    className={`size-4 ${pinned ? "text-warning" : "text-base-content/50"}`}
                  />
                  {pinned ? "Unpin note" : "Pin this note"}
                </button>

                {/* Templates */}
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-base-300/25"
                  onClick={() => {
                    setTemplateModalOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <SparklesIcon className="size-4 text-base-content/50" />
                  Browse templates
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Editor Body ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-6 py-10 sm:px-8 lg:py-16">
          {/* Template banner (only if active) */}
          {activeTemplate && (
            <div className="mb-6 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary">
              <SparklesIcon className="size-3.5" />
              Template: {activeTemplate.name}
            </div>
          )}

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note Title"
            className="w-full border-0 bg-transparent text-4xl font-extrabold leading-tight text-base-content placeholder:text-base-content/20 focus:outline-none focus:ring-0"
            autoFocus
          />

          {/* Body — TipTap editor with slash commands */}
          <div className="mt-4">
            <SimpleEditor
              initialContent={richContent || content}
              onChange={handleEditorChange}
              onReady={(editor) => {
                editorRef.current = editor;
              }}
            />
          </div>
        </div>
      </main>

      {/* ── Bottom Metadata Bar ── */}
      <footer className="border-t border-base-200/60 bg-base-100">
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-3 px-6 py-3 sm:px-8">
          {/* Notebook selector */}
          <div className="relative">
            <select
              className="select select-bordered select-sm h-8 min-h-0 rounded-lg pr-8 text-xs font-medium"
              value={selectedNotebookId}
              onChange={(event) => setSelectedNotebookId(event.target.value)}
              disabled={notebooksQuery.isLoading}
            >
              <option value="">
                {notebooksQuery.isLoading ? "Loading…" : "Uncategorized"}
              </option>
              {notebooks.map((notebook: any) => (
                <option key={notebook.id} value={notebook.id}>
                  {notebook.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="flex-1 min-w-[180px]">
            <TagInput value={tags} onChange={setTags} placeholder="Add tags…" />
          </div>

          {/* Pinned indicator */}
          {pinned && (
            <div className="flex items-center gap-1 text-xs text-warning">
              <PinIcon className="size-3" />
              Pinned
            </div>
          )}
        </div>
      </footer>

      <TemplateGalleryModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
};
export default CreatePage;
