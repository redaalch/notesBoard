import { type ReactNode } from "react";
import { AnimatePresence, m } from "framer-motion";
import { ListChecksIcon, MoveIcon, XIcon } from "lucide-react";
import FilterPopover, { type FilterPopoverProps } from "./FilterPopover";

export interface Tab {
  id: string;
  label: string;
  badge: number;
}

export interface ToolbarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  filterProps: FilterPopoverProps;
  selectionMode: boolean;
  onToggleSelection: () => void;
  customizeMode: boolean;
  onToggleCustomize: () => void;
  customizeDisabled: boolean;
  filterChips?: { key: string; label: string; onClear: () => void }[];
  selectedTags?: string[];
  onRemoveTag?: (tag: string) => void;
  onResetFilters?: () => void;
  filtersApplied?: boolean;
  savingOrder?: boolean;
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
    <div className="ds-subtb-wrap">
      <div className="ds-subtb">
        <div className="ds-tabs" role="tablist" aria-label="Note filters">
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
                className={`ds-tab${isActive ? " on" : ""}`}
              >
                <span>{tab.label}</span>
                <span className="ds-badge">{tab.badge}</span>
              </button>
            );
          })}
        </div>

        <div className="ds-tb-spacer" />

        <FilterPopover {...filterProps} />

        <button
          type="button"
          onClick={onToggleSelection}
          className={`ds-chip${selectionMode ? " on" : ""}`}
          title={selectionMode ? "Exit selection" : "Select notes"}
        >
          <ListChecksIcon size={12} />
          <span>{selectionMode ? "Done" : "Select"}</span>
        </button>

        {!selectionMode && (
          <button
            type="button"
            onClick={onToggleCustomize}
            disabled={customizeDisabled}
            className={`ds-chip${customizeMode ? " on" : ""}`}
            title={customizeMode ? "Finish reordering" : "Reorder notes"}
          >
            <MoveIcon size={12} />
            <span>{customizeMode ? "Done" : "Reorder"}</span>
          </button>
        )}
      </div>

      <AnimatePresence>
        {customizeMode && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className="ds-alert">
              <MoveIcon size={12} />
              <span>Drag cards to reorder. Changes save automatically.</span>
              {savingOrder && (
                <span style={{ marginLeft: "auto", color: "var(--ds-accent)" }}>
                  Saving…
                </span>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {filtersApplied &&
          (filterChips.length > 0 || selectedTags.length > 0) && (
            <m.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="ds-chips-row"
            >
              {filterChips.map(({ key, label, onClear }) => (
                <button
                  key={key}
                  type="button"
                  onClick={onClear}
                  className="ds-chip"
                >
                  <span>{label}</span>
                  <XIcon size={10} />
                </button>
              ))}
              {selectedTags.map((tag) => (
                <button
                  key={`tag-${tag}`}
                  type="button"
                  onClick={() => onRemoveTag?.(tag)}
                  className="ds-chip on"
                >
                  <span>{tag}</span>
                  <XIcon size={10} />
                </button>
              ))}
              {onResetFilters && (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="ds-chip"
                  style={{ marginLeft: 4 }}
                >
                  Clear all
                </button>
              )}
            </m.div>
          )}
      </AnimatePresence>
    </div>
  );
}

export default Toolbar;
