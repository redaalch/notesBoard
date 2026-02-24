import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FilterIcon, XIcon, TagIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { formatTagLabel } from "../lib/Utils";

export interface FilterPopoverProps {
  /** Min-words filter */
  minWords: number;
  onMinWordsChange: (value: number) => void;
  /** Sort */
  sortOrder: string;
  onSortOrderChange: (value: string) => void;
  /** Tag filter */
  tagOptions: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  /** Whether any filters are active */
  filtersActive?: boolean;
  /** Clear all filters */
  onClearAll?: () => void;
}

function FilterPopover({
  minWords,
  onMinWordsChange,
  sortOrder,
  onSortOrderChange,
  tagOptions,
  selectedTags,
  onToggleTag,
  filtersActive,
  onClearAll,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const activeFilterCount = [
    minWords > 0,
    selectedTags.length > 0,
    sortOrder !== "newest",
  ].filter(Boolean).length;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "btn btn-sm btn-outline gap-2 rounded-lg",
          open && "btn-active",
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <FilterIcon className="size-4" />
        <span className="hidden sm:inline">Filters</span>
        {activeFilterCount > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
            {activeFilterCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-base-300/60 bg-base-100 p-4 shadow-xl"
            role="dialog"
            aria-label="Filter options"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-base-content">
                Filters
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-ghost btn-xs btn-circle"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>

            {/* Min words */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-base-content/70">
                  Minimum words
                </label>
                <span className="text-xs tabular-nums text-base-content/50">
                  {minWords > 0 ? `${minWords}+` : "All"}
                </span>
              </div>
              <input
                type="range"
                className="range range-primary range-xs w-full"
                min="0"
                max="400"
                step="20"
                value={minWords}
                onChange={(e) => onMinWordsChange(Number(e.target.value))}
              />
            </div>

            {/* Sort */}
            <div className="mb-4">
              <label className="text-xs font-medium text-base-content/70 mb-2 block">
                Sort
              </label>
              <select
                className="select select-bordered select-sm w-full"
                value={sortOrder}
                onChange={(e) => onSortOrderChange(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="alphabetical">A → Z</option>
                <option value="updated">Recently updated</option>
                <option value="custom">Custom order</option>
              </select>
            </div>

            {/* Tags */}
            {tagOptions.length > 0 && (
              <div className="mb-4">
                <label className="text-xs font-medium text-base-content/70 mb-2 block">
                  Tags
                </label>
                <div className="max-h-36 space-y-1 overflow-y-auto">
                  {tagOptions.map((tag) => (
                    <label
                      key={tag}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-base-200/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs checkbox-primary"
                        checked={selectedTags.includes(tag)}
                        onChange={() => onToggleTag(tag)}
                      />
                      <TagIcon className="size-3 text-base-content/40" />
                      <span className="text-base-content/80">
                        {formatTagLabel(tag)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Clear all */}
            {filtersActive && onClearAll && (
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setOpen(false);
                }}
                className="btn btn-ghost btn-xs w-full"
              >
                Clear all filters
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FilterPopover;
