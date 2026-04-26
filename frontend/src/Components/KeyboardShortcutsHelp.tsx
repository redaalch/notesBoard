import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardIcon, SearchIcon, XIcon } from "lucide-react";
import { useCommandPalette } from "../contexts/CommandPaletteContext";

interface ShortcutItem {
  keys: string[];
  label: string;
  description?: string;
  section: string;
}

const STATIC_SHORTCUTS: ShortcutItem[] = [
  {
    keys: ["?"],
    label: "Show keyboard shortcuts",
    description: "Open this cheatsheet",
    section: "General",
  },
  {
    keys: ["Ctrl", "K"],
    label: "Open command palette",
    description: "Search commands, navigate, switch themes",
    section: "General",
  },
  {
    keys: ["Esc"],
    label: "Close dialogs / clear selection",
    section: "General",
  },

  {
    keys: ["/"],
    label: "Focus search",
    description: "Jump to the search input on the notes board",
    section: "Notes board",
  },
  {
    keys: ["N"],
    label: "New note",
    description: "Create a new note from the notes board",
    section: "Notes board",
  },
  {
    keys: ["Ctrl", "A"],
    label: "Select all notes",
    description: "Enters selection mode with every filtered note selected",
    section: "Notes board",
  },

  {
    keys: ["Ctrl", "S"],
    label: "Save note",
    description: "Save the current note while editing",
    section: "Editor",
  },
  {
    keys: ["Ctrl", "."],
    label: "Toggle focus mode",
    description: "Hide chrome and center the editor; Esc to exit",
    section: "Editor",
  },
  {
    keys: ["Ctrl", "B"],
    label: "Bold",
    section: "Editor",
  },
  {
    keys: ["Ctrl", "I"],
    label: "Italic",
    section: "Editor",
  },
  {
    keys: ["Ctrl", "U"],
    label: "Underline",
    section: "Editor",
  },
  {
    keys: ["Ctrl", "Shift", "X"],
    label: "Strikethrough",
    section: "Editor",
  },
  {
    keys: ["Ctrl", "E"],
    label: "Inline code",
    section: "Editor",
  },
  {
    keys: ["Ctrl", "Z"],
    label: "Undo",
    section: "Editor",
  },
  {
    keys: ["Ctrl", "Shift", "Z"],
    label: "Redo",
    section: "Editor",
  },
  {
    keys: ["/"],
    label: "Slash commands",
    description: "Open the slash command menu inside the editor",
    section: "Editor",
  },
];

const normalize = (value: string | undefined): string =>
  value?.toLowerCase() ?? "";

const isInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
};

const KeyboardShortcutsHelp = () => {
  const { commands } = useCommandPalette();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        setIsOpen(false);
        return;
      }
      if (event.key !== "?") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isInteractiveTarget(event.target)) return;
      event.preventDefault();
      setIsOpen((prev) => !prev);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  const paletteShortcuts = useMemo<ShortcutItem[]>(() => {
    return commands
      .filter((command) => command.shortcut)
      .map((command) => ({
        keys: [command.shortcut as string],
        label: command.label,
        description: command.description,
        section: `Command palette — ${command.section ?? "Commands"}`,
      }));
  }, [commands]);

  const allShortcuts = useMemo<ShortcutItem[]>(
    () => [...STATIC_SHORTCUTS, ...paletteShortcuts],
    [paletteShortcuts],
  );

  const filtered = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return allShortcuts;
    const needle = normalize(trimmed);
    return allShortcuts.filter((item) => {
      const haystack = [
        item.label,
        item.description,
        item.section,
        item.keys.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [allShortcuts, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ShortcutItem[]>();
    for (const item of filtered) {
      const list = map.get(item.section) ?? [];
      list.push(item);
      map.set(item.section, list);
    }
    return map;
  }, [filtered]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center bg-black/40 px-4 py-10 backdrop-blur-sm"
      role="presentation"
      onClick={() => setIsOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-base-content/10 bg-base-100 shadow-2xl shadow-primary/20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-base-content/10 bg-base-200/60 px-4 py-3">
          <KeyboardIcon className="size-5 text-primary" aria-hidden="true" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
            <p className="text-xs text-base-content/60">
              Press <kbd className="kbd kbd-xs">?</kbd> anytime to toggle this
              help.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            onClick={() => setIsOpen(false)}
            aria-label="Close shortcuts help"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-base-content/10 bg-base-100 px-4 py-2">
          <SearchIcon
            className="size-4 text-base-content/40"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search shortcuts..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-base-content/40"
            aria-label="Search shortcuts"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-2 py-3">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-base-content/60">
              No shortcuts match "{query}".
            </div>
          ) : (
            Array.from(grouped.entries()).map(([section, items]) => (
              <Fragment key={section}>
                <div className="px-3 py-2 text-[11px] uppercase tracking-[0.28em] text-base-content/50">
                  {section}
                </div>
                <ul className="mb-3 space-y-1">
                  {items.map((item, index) => (
                    <li
                      key={`${section}-${item.label}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm hover:bg-base-300/25"
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium">{item.label}</span>
                        {item.description && (
                          <span className="text-xs text-base-content/60">
                            {item.description}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {item.keys.map((key, keyIndex) => (
                          <Fragment key={`${key}-${keyIndex}`}>
                            {keyIndex > 0 && (
                              <span className="text-xs text-base-content/40">
                                +
                              </span>
                            )}
                            <kbd className="kbd kbd-sm">{key}</kbd>
                          </Fragment>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </Fragment>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsHelp;
