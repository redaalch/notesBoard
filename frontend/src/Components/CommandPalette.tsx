import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { CommandIcon, CornerDownLeftIcon, LoaderIcon } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useCommandPalette } from "../contexts/CommandPaletteContext";
import type { PaletteCommand } from "../contexts/CommandPaletteContext";

const normalize = (value: string | undefined | null): string =>
  value?.toLowerCase?.() ?? "";

const filterCommands = (
  commands: PaletteCommand[],
  query: string,
): PaletteCommand[] => {
  const trimmed = query.trim();
  if (!trimmed) return commands;

  const normalizedQuery = normalize(trimmed);
  return commands.filter((command) => {
    const haystack = [
      command.label,
      command.description,
      command.section,
      command.keywords?.join(" ") ?? "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
};

const groupCommands = (
  commands: PaletteCommand[],
): Map<string, PaletteCommand[]> => {
  return commands.reduce((acc, command) => {
    const section = command.section ?? "Commands";
    if (!acc.has(section)) {
      acc.set(section, []);
    }
    acc.get(section)!.push(command);
    return acc;
  }, new Map<string, PaletteCommand[]>());
};

function CommandPalette() {
  const { isOpen, setIsOpen, closePalette, commands } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const isMetaK =
        event.key?.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      if (isMetaK) {
        event.preventDefault();
        setIsOpen(true);
      }
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        closePalette();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closePalette, isOpen, setIsOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const id = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [isOpen, location.pathname]);

  const filteredCommands = useMemo(
    () =>
      filterCommands(commands, query).sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
    [commands, query],
  );

  const groupedCommands = useMemo(
    () => groupCommands(filteredCommands),
    [filteredCommands],
  );

  const flatCommands = filteredCommands;

  const handleSelect = (command: PaletteCommand | undefined) => {
    if (!command || typeof command.action !== "function") return;
    const maybePromise = command.action();
    if (maybePromise instanceof Promise) {
      maybePromise.finally(() => closePalette());
    } else {
      closePalette();
    }
  };

  const handleKeyNavigation = (event: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
      event.preventDefault();
      setHighlightedIndex((index) =>
        index + 1 >= flatCommands.length ? 0 : index + 1,
      );
    } else if (
      event.key === "ArrowUp" ||
      (event.key === "Tab" && event.shiftKey)
    ) {
      event.preventDefault();
      setHighlightedIndex((index) =>
        index - 1 < 0 ? Math.max(flatCommands.length - 1, 0) : index - 1,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      handleSelect(flatCommands[highlightedIndex]);
    }
  };

  useEffect(() => {
    const element = listRef.current;
    if (!element || !flatCommands.length) return;

    const activeId = flatCommands[highlightedIndex]?.id;
    if (!activeId) return;

    const activeElement = element.querySelector(
      `[data-command-id="${activeId}"]`,
    );
    if (activeElement) {
      activeElement.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, flatCommands]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center bg-black/40 px-4 py-10 backdrop-blur-sm"
      role="presentation"
      onClick={closePalette}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-base-content/10 bg-base-100 shadow-2xl shadow-primary/20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-base-content/10 bg-base-200/60 px-4 py-3">
          <CommandIcon className="size-5 text-primary" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyNavigation}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-base-content/50"
            aria-label="Search for a command"
          />
          <span className="hidden items-center gap-1 rounded-md border border-base-content/20 px-2 py-1 text-[11px] font-medium text-base-content/60 sm:flex">
            <span>⌘</span>
            <span>K</span>
          </span>
        </div>
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto px-2 py-3">
          {flatCommands.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-base-content/70">
              <LoaderIcon className="size-6 animate-spin text-primary" />
              <p>No commands found. Try another keyword.</p>
            </div>
          ) : (
            Array.from(groupedCommands.entries()).map(
              ([section, sectionCommands]) => (
                <Fragment key={section}>
                  <div className="px-3 py-2 text-[11px] uppercase tracking-[0.28em] text-base-content/50">
                    {section}
                  </div>
                  <ul className="mb-2 space-y-1">
                    {sectionCommands.map((command) => {
                      const index = flatCommands.findIndex(
                        (item) => item.id === command.id,
                      );
                      const highlighted = index === highlightedIndex;
                      return (
                        <li key={command.id}>
                          <button
                            type="button"
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                              highlighted
                                ? "bg-primary/10 text-primary-content"
                                : "bg-transparent hover:bg-base-200/70"
                            }`}
                            onClick={() => handleSelect(command)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            data-command-id={command.id}
                          >
                            <span className="flex flex-col gap-1">
                              <span className="font-medium">
                                {command.label}
                              </span>
                              {command.description && (
                                <span className="text-xs text-base-content/60">
                                  {command.description}
                                </span>
                              )}
                            </span>
                            <span className="flex items-center gap-2 text-[11px] text-base-content/60">
                              {command.shortcut && (
                                <span className="rounded-md border border-base-content/20 px-2 py-1">
                                  {command.shortcut}
                                </span>
                              )}
                              <CornerDownLeftIcon className="size-3.5" />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Fragment>
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
