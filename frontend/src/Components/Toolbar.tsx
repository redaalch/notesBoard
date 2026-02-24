import { type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ListChecksIcon, MoveIcon, XIcon } from "lucide-react";
import { cn } from "../lib/cn";
import FilterPopover, { type FilterPopoverProps } from "./FilterPopover";

export interface Tab {
  id: string;
  label: string;
  badge: number;
}

export interface ToolbarProps {
  /** Content tabs (All / Recent / Long / Short) */
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** Filter popover props */
  filterProps: FilterPopoverProps;
  /** Selection mode */
  selectionMode: boolean;
  onToggleSelection: () => void;
  /** Customize/reorder mode */
  customizeMode: boolean;
  onToggleCustomize: () => void;
  customizeDisabled: boolean;
  /** Active filter chips */
  filterChips?: { key: string; label: string; onClear: () => void }[];
  /** Tag chips */
  selectedTags?: string[];
  onRemoveTag?: (tag: string) => void;
  /** Reset all filters */
  onResetFilters?: () => void;
  filtersApplied?: boolean;
  /** Customize mode info bar */
  savingOrder?: boolean;
  /** Extra content (for mobile filter button, etc.) */
  children?: ReactNode;
}

function Toolbar({
  tabs,
  activeTab,
  onTabChange,
  filterProps,
  selectionMode,
  onToggleSelection,
  customizeMode,
  onToggleCustomize,
  customizeDisabled,
  filterChips = [],
  selectedTags = [],
  onRemoveTag,
  onResetFilters,
  filtersApplied,
  savingOrder,
}: ToolbarProps) {
  return (
    <div className="relative z-20 space-y-2">
      {/* Main toolbar row */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-base-300/40 bg-base-100/80 px-3 py-2 shadow-sm backdrop-blur">
        {/* Tabs */}
        <div
          className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0"
          role="tablist"
          aria-label="Note filters"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "text-primary"
                    : "text-base-content/60 hover:text-base-content hover:bg-base-200/50",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="toolbar-tab-indicator"
                    className="absolute inset-0 rounded-lg bg-primary/10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-[1]">{tab.label}</span>
                <span
                  className={cn(
                    "relative z-[1] text-xs tabular-nums",
                    isActive ? "text-primary/70" : "text-base-content/40",
                  )}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right-side controls */}
        <div className="flex items-center gap-1.5">
          {/* Filter popover */}
          <FilterPopover {...filterProps} />

          {/* Select toggle */}
          <button
            type="button"
            onClick={onToggleSelection}
            className={cn(
              "btn btn-sm gap-1.5 rounded-lg",
              selectionMode ? "btn-primary" : "btn-outline",
            )}
            title={selectionMode ? "Exit selection" : "Select notes"}
          >
            <ListChecksIcon className="size-4" />
            <span className="hidden sm:inline">
              {selectionMode ? "Done" : "Select"}
            </span>
          </button>

          {/* Customize order (hidden in select mode, shown as dropdown option later) */}
          {!selectionMode && (
            <button
              type="button"
              onClick={onToggleCustomize}
              disabled={customizeDisabled}
              className={cn(
                "btn btn-sm gap-1.5 rounded-lg",
                customizeMode ? "btn-primary" : "btn-outline",
              )}
              title={customizeMode ? "Finish reordering" : "Reorder notes"}
            >
              <MoveIcon className="size-4" />
              <span className="hidden md:inline">
                {customizeMode ? "Done" : "Reorder"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Customize mode info */}
      <AnimatePresence>
        {customizeMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              <MoveIcon className="size-4 text-primary" />
              <span className="text-base-content/80">
                Drag cards to reorder. Changes save automatically.
              </span>
              {savingOrder && (
                <span className="ml-auto text-xs font-medium text-primary">
                  Saving...
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active filter chips */}
      <AnimatePresence>
        {filtersApplied &&
          (filterChips.length > 0 || selectedTags.length > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-wrap items-center gap-1.5 overflow-hidden"
            >
              {filterChips.map(({ key, label, onClear }) => (
                <motion.button
                  key={key}
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  onClick={onClear}
                  className="inline-flex items-center gap-1 rounded-lg border border-base-300/50 bg-base-200/50 px-2.5 py-1 text-xs font-medium text-base-content/70 transition hover:bg-base-200 hover:text-base-content"
                >
                  <span>{label}</span>
                  <XIcon className="size-3" />
                </motion.button>
              ))}
              {selectedTags.map((tag) => (
                <motion.button
                  key={`tag-${tag}`}
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => onRemoveTag?.(tag)}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/10"
                >
                  <span>{tag}</span>
                  <XIcon className="size-3" />
                </motion.button>
              ))}
              {onResetFilters && (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="text-xs font-medium text-base-content/50 hover:text-base-content transition-colors ml-1"
                >
                  Clear all
                </button>
              )}
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}

export default Toolbar;
