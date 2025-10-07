import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDownIcon,
  FilterIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
  TagIcon,
  XIcon,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../Components/Navbar.jsx";
import RateLimitedUI from "../Components/RateLimitedUI.jsx";
import api from "../lib/axios.js";
import toast from "react-hot-toast";
import NoteCard from "../Components/NoteCard.jsx";
import NotesNotFound from "../Components/NotesNotFound.jsx";
import NoteSkeleton from "../Components/NoteSkeleton.jsx";
import NotesStats from "../Components/NotesStats.jsx";
import { countWords, formatTagLabel, normalizeTag } from "../lib/Utils.js";

const FILTER_STORAGE_KEY = "notesboard-filters-v1";

const sortLabelMap = {
  newest: "Newest first",
  oldest: "Oldest first",
  alphabetical: "A → Z",
  updated: "Recently updated",
};

function HomePage() {
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [minWords, setMinWords] = useState(0);
  const [sortOrder, setSortOrder] = useState("newest");
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [tagInsights, setTagInsights] = useState(null);
  const [openTips, setOpenTips] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const filterPanelRef = useRef(null);
  const hasInitializedFilters = useRef(false);

  const loadTagStats = useCallback(async () => {
    try {
      const response = await api.get("/notes/tags/stats");
      const tags = response.data?.tags ?? [];
      setAvailableTags(
        tags
          .map((entry) => entry?._id)
          .filter(Boolean)
          .map((tag) => normalizeTag(tag))
      );
      setTagInsights({
        tags,
        uniqueTags: response.data?.uniqueTags ?? tags.length,
        topTag: response.data?.topTag ?? null,
      });
    } catch (error) {
      console.log("error fetching tag stats", error);
    }
  }, []);

  useEffect(() => {
    if (hasInitializedFilters.current) return;
    if (typeof window === "undefined") return;

    const params = Object.fromEntries(searchParams.entries());
    let storedFilters = {};
    try {
      const raw = localStorage.getItem(FILTER_STORAGE_KEY);
      if (raw) {
        storedFilters = JSON.parse(raw);
      }
    } catch (error) {
      console.log("error reading stored filters", error);
    }

    const initialSearch = params.q ?? storedFilters.searchQuery ?? "";
    setSearchQuery(initialSearch);

    const initialMin = Number(params.minWords ?? storedFilters.minWords ?? 0);
    setMinWords(Number.isFinite(initialMin) ? initialMin : 0);

    const allowedTabs = new Set(["all", "recent", "long", "short"]);
    const initialTab = params.tab ?? storedFilters.activeTab ?? "all";
    setActiveTab(allowedTabs.has(initialTab) ? initialTab : "all");

    const allowedSorts = new Set([
      "newest",
      "oldest",
      "alphabetical",
      "updated",
    ]);
    const initialSort = params.sort ?? storedFilters.sortOrder ?? "newest";
    setSortOrder(allowedSorts.has(initialSort) ? initialSort : "newest");

    const tagsSource = params.tags ?? storedFilters.selectedTags ?? [];
    const tagList = Array.isArray(tagsSource)
      ? tagsSource
      : typeof tagsSource === "string"
      ? tagsSource.split(",")
      : [];

    const normalizedTags = Array.from(
      new Set(tagList.map((tag) => normalizeTag(tag)).filter(Boolean))
    );
    setSelectedTags(normalizedTags);

    hasInitializedFilters.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!hasInitializedFilters.current) return;
    if (typeof window === "undefined") return;

    const params = {};
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) params.q = trimmedQuery;
    if (Number(minWords) > 0) params.minWords = String(minWords);
    if (activeTab !== "all") params.tab = activeTab;
    if (sortOrder !== "newest") params.sort = sortOrder;
    if (selectedTags.length) params.tags = selectedTags.join(",");

    setSearchParams(params, { replace: true });

    try {
      localStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({
          searchQuery,
          minWords: Number(minWords) || 0,
          activeTab,
          sortOrder,
          selectedTags,
        })
      );
    } catch (error) {
      console.log("error saving filters", error);
    }
  }, [
    searchQuery,
    minWords,
    activeTab,
    sortOrder,
    selectedTags,
    setSearchParams,
  ]);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await api.get("/notes");
        setNotes(res.data);
        setIsRateLimited(false);
        loadTagStats();
      } catch (error) {
        console.log("error fetching" + error);
        if (error.response?.status === 429) {
          setIsRateLimited(true);
        } else {
          toast.error("Failed to load Notes");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, [loadTagStats]);

  const closeDrawer = () => setDrawerOpen(false);
  const openDrawer = () => setDrawerOpen(true);

  const recentNotes = useMemo(
    () =>
      notes.filter((note) => {
        const createdAt = new Date(note.createdAt);
        return Date.now() - createdAt.getTime() <= 604_800_000; // 7 days
      }),
    [notes]
  );

  const longFormNotes = useMemo(
    () => notes.filter((note) => countWords(note.content) >= 150),
    [notes]
  );

  const shortNotes = useMemo(
    () => notes.filter((note) => countWords(note.content) <= 60),
    [notes]
  );

  const tabConfig = [
    { id: "all", label: "All notes", badge: notes.length },
    { id: "recent", label: "Recent", badge: recentNotes.length },
    { id: "long", label: "Long form", badge: longFormNotes.length },
    { id: "short", label: "Short & sweet", badge: shortNotes.length },
  ];

  const activeTabLabel =
    tabConfig.find((tab) => tab.id === activeTab)?.label ?? "All notes";

  const filtersApplied = Boolean(
    selectedTags.length > 0 ||
      searchQuery.trim() ||
      Number(minWords) > 0 ||
      sortOrder !== "newest" ||
      activeTab !== "all"
  );

  const activeFilterChips = useMemo(() => {
    const chips = [];
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery) {
      chips.push({
        key: "search",
        label: `Search: "${trimmedQuery}"`,
        onClear: () => setSearchQuery(""),
      });
    }

    if (Number(minWords) > 0) {
      chips.push({
        key: "min",
        label: `Minimum ${minWords} words`,
        onClear: () => setMinWords(0),
      });
    }

    if (sortOrder !== "newest") {
      chips.push({
        key: "sort",
        label: `Sort: ${sortLabelMap[sortOrder] ?? sortOrder}`,
        onClear: () => setSortOrder("newest"),
      });
    }

    if (activeTab !== "all") {
      chips.push({
        key: "tab",
        label: `View: ${activeTabLabel}`,
        onClear: () => setActiveTab("all"),
      });
    }

    return chips;
  }, [searchQuery, minWords, sortOrder, activeTab, activeTabLabel]);

  const filteredNotes = useMemo(() => {
    let base = notes;
    if (activeTab === "recent") base = recentNotes;
    if (activeTab === "long") base = longFormNotes;
    if (activeTab === "short") base = shortNotes;

    const bySearch = base.filter((note) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
      );
    });

    const byWords = bySearch.filter(
      (note) => countWords(note.content) >= Number(minWords)
    );

    const byTags = selectedTags.length
      ? byWords.filter((note) => {
          if (!Array.isArray(note.tags) || !note.tags.length) return false;
          const normalized = note.tags.map((tag) => tag.toLowerCase());
          return selectedTags.every((tag) => normalized.includes(tag));
        })
      : byWords;

    const sorted = [...byTags].sort((a, b) => {
      const pinPriority = Number(!!b.pinned) - Number(!!a.pinned);
      if (pinPriority !== 0) return pinPriority;
      if (sortOrder === "newest") {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      if (sortOrder === "oldest") {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      if (sortOrder === "alphabetical") {
        return a.title.localeCompare(b.title);
      }
      if (sortOrder === "updated") {
        return (
          new Date(b.updatedAt ?? b.createdAt) -
          new Date(a.updatedAt ?? a.createdAt)
        );
      }
      return 0;
    });

    return sorted;
  }, [
    notes,
    activeTab,
    searchQuery,
    minWords,
    sortOrder,
    recentNotes,
    longFormNotes,
    shortNotes,
    selectedTags,
  ]);

  const showFilterEmptyState =
    !loading && !isRateLimited && notes.length > 0 && !filteredNotes.length;

  const tagOptions = useMemo(() => {
    if (availableTags.length) {
      return Array.from(new Set(availableTags)).sort();
    }
    const tagSet = new Set();
    notes.forEach((note) => {
      if (Array.isArray(note.tags)) {
        note.tags.forEach((tag) => tagSet.add(normalizeTag(tag)));
      }
    });
    return Array.from(tagSet).sort();
  }, [availableTags, notes]);

  const toggleTagSelection = (tag) => {
    const normalized = normalizeTag(tag);
    setSelectedTags((prev) =>
      prev.includes(normalized)
        ? prev.filter((item) => item !== normalized)
        : [...prev, normalized]
    );
  };

  const removeSelectedTag = (tag) => {
    const normalized = normalizeTag(tag);
    setSelectedTags((prev) => prev.filter((item) => item !== normalized));
  };

  const resetFilters = () => {
    setSearchQuery("");
    setMinWords(0);
    setSortOrder("newest");
    setActiveTab("all");
    setSelectedTags([]);
  };

  const toggleTip = (title) => {
    setOpenTips((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const filterTips = [
    {
      title: "Use search shortcuts",
      description:
        "Filter by keywords, then adjust the word slider to focus on short summaries or long-form notes.",
      icon: FilterIcon,
      tone: "primary",
    },
    {
      title: "Switch tabs quickly",
      description:
        "Tabs let you jump between recent captures, long reads, or quick thoughts without losing your place.",
      icon: SparklesIcon,
      tone: "secondary",
    },
    {
      title: "Tag your topics",
      description:
        "Add tags like project names or priorities, then use the tag filters to surface notes instantly.",
      icon: TagIcon,
      tone: "primary",
    },
  ];

  const tipToneClasses = {
    primary: "text-primary",
    secondary: "text-secondary",
  };

  useEffect(() => {
    if (!drawerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (event.target.closest("[data-drawer-toggle='filters']")) return;
      if (filterPanelRef.current?.contains(event.target)) return;
      setDrawerOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [drawerOpen]);

  return (
    <div className="drawer">
      <input
        id="notes-filters"
        type="checkbox"
        className="drawer-toggle"
        checked={drawerOpen}
        onChange={(event) => setDrawerOpen(event.target.checked)}
      />
      <div className="drawer-content flex min-h-screen flex-col">
        <Navbar onMobileFilterClick={openDrawer} />

        {isRateLimited && (
          <RateLimitedUI onDismiss={() => setIsRateLimited(false)} />
        )}

        <main className="flex-1 w-full">
          <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8">
            <NotesStats
              notes={notes}
              loading={loading}
              tagStats={tagInsights}
            />

            <div className="sticky top-4 z-10 space-y-3">
              <div className="rounded-2xl border border-base-300/60 bg-base-100/80 p-4 shadow-sm backdrop-blur supports-[backdrop-filter:blur(0px)]:bg-base-100/70">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div
                    className="flex flex-wrap items-center gap-2"
                    role="tablist"
                  >
                    {tabConfig.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        className={`tab tab-lifted ${
                          activeTab === tab.id ? "tab-active" : ""
                        }`}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        <span className="flex items-center gap-2">
                          {tab.label}
                          <span className="badge badge-sm badge-outline">
                            {tab.badge}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="button"
                      className="btn btn-outline gap-2 sm:w-auto lg:hidden"
                      onClick={openDrawer}
                      data-drawer-toggle="filters"
                    >
                      <FilterIcon className="size-4" />
                      Filters
                    </button>
                    <div className="join w-full sm:w-auto">
                      <label className="join-item input input-bordered flex items-center gap-3 flex-1 min-w-0 rounded-full bg-base-200/70 shadow-sm transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40">
                        <SearchIcon className="size-4 text-base-content/60" />
                        <input
                          type="search"
                          value={searchQuery}
                          onChange={(event) =>
                            setSearchQuery(event.target.value)
                          }
                          placeholder="Search notes..."
                          className="w-full bg-transparent text-sm sm:text-base outline-none"
                          aria-label="Search notes"
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-outline join-item shrink-0 rounded-full sm:rounded-l-none"
                        onClick={resetFilters}
                        disabled={!filtersApplied}
                        aria-disabled={!filtersApplied}
                        title={
                          filtersApplied
                            ? "Reset filters"
                            : "No filters applied"
                        }
                      >
                        <RefreshCwIcon className="size-4" />
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                <div className="hidden lg:grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <div className="form-control">
                    <span className="label">
                      <span className="label-text text-sm font-medium">
                        Minimum words
                      </span>
                      <span className="label-text-alt text-xs text-base-content/60">
                        {minWords > 0 ? `${minWords}+` : "All"}
                      </span>
                    </span>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        className="range range-primary range-sm flex-1"
                        min="0"
                        max="400"
                        step="20"
                        value={minWords}
                        onChange={(event) =>
                          setMinWords(Number(event.target.value))
                        }
                        aria-label="Minimum words filter"
                      />
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={minWords}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (Number.isFinite(value) && value >= 0) {
                            const normalized = Math.min(
                              400,
                              Math.round(value / 10) * 10
                            );
                            setMinWords(normalized);
                          } else {
                            setMinWords(0);
                          }
                        }}
                        className="input input-bordered input-sm w-20"
                        aria-label="Minimum words value"
                      />
                    </div>
                  </div>
                  <label className="form-control max-w-xs">
                    <span className="label">
                      <span className="label-text text-sm font-medium">
                        Sort notes
                      </span>
                    </span>
                    <select
                      className="select select-bordered select-sm"
                      value={sortOrder}
                      onChange={(event) => setSortOrder(event.target.value)}
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="alphabetical">Alphabetical</option>
                      <option value="updated">Recently updated</option>
                    </select>
                  </label>
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      className="btn btn-outline gap-2"
                      onClick={openDrawer}
                      data-drawer-toggle="filters"
                    >
                      <FilterIcon className="size-4" />
                      Advanced filters
                    </button>
                  </div>
                </div>
              </div>

              {filtersApplied && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-base-300/60 bg-base-200/70 px-4 py-3">
                  {activeFilterChips.map(({ key, label, onClear }) => (
                    <button
                      key={key}
                      type="button"
                      className="badge badge-outline gap-1 px-3 py-2 text-xs font-medium"
                      onClick={onClear}
                      aria-label={`Clear ${label}`}
                    >
                      <span>{label}</span>
                      <XIcon className="size-3" />
                    </button>
                  ))}
                  {selectedTags.map((tag) => (
                    <button
                      key={`tag-${tag}`}
                      type="button"
                      className="badge badge-primary badge-outline gap-1 px-3 py-2 text-xs font-medium"
                      onClick={() => removeSelectedTag(tag)}
                      aria-label={`Remove tag ${tag}`}
                    >
                      <span>{formatTagLabel(tag)}</span>
                      <XIcon className="size-3" />
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={resetFilters}
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {loading && <NoteSkeleton />}

            {!loading && filteredNotes.length > 0 && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredNotes.map((note) => (
                  <NoteCard
                    key={note._id}
                    note={note}
                    setNotes={setNotes}
                    onTagClick={toggleTagSelection}
                    selectedTags={selectedTags}
                    onNoteChange={loadTagStats}
                  />
                ))}
              </div>
            )}

            {showFilterEmptyState && (
              <div className="alert alert-info shadow-lg">
                <FilterIcon className="size-5" />
                <div>
                  <h3 className="font-bold">No notes match your filters</h3>
                  <div className="text-sm">
                    Try adjusting the search, tab, or word count slider to see
                    more notes.
                  </div>
                </div>
              </div>
            )}

            {!loading && !isRateLimited && notes.length === 0 && (
              <NotesNotFound />
            )}
          </section>
        </main>

        {!drawerOpen && (
          <Link
            to="/create"
            className="btn btn-primary btn-circle fixed bottom-6 right-4 z-40 shadow-lg shadow-primary/30 lg:hidden"
            aria-label="Create a new note"
          >
            <PlusIcon className="size-6" />
          </Link>
        )}
      </div>

      <div className="drawer-side z-30">
        <label
          htmlFor="notes-filters"
          className="drawer-overlay"
          onClick={closeDrawer}
        />
        <div
          ref={filterPanelRef}
          className="menu h-full w-80 max-w-full gap-6 overflow-y-auto bg-base-200 p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <SparklesIcon className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">Filter details</h2>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={closeDrawer}
              data-drawer-toggle="filters"
              aria-label="Close filters"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          <label className="form-control w-full">
            <span className="label">
              <span className="label-text">Search</span>
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title or content"
              className="input input-bordered w-full"
            />
          </label>

          <label className="form-control w-full">
            <span className="label">
              <span className="label-text">Minimum words ({minWords})</span>
            </span>
            <input
              type="range"
              className="range range-primary"
              min="0"
              max="400"
              step="20"
              value={minWords}
              onChange={(event) => setMinWords(Number(event.target.value))}
            />
            <div className="flex w-full justify-between text-xs px-1">
              {[0, 100, 200, 300, 400].map((marker) => (
                <span key={marker}>{marker}</span>
              ))}
            </div>
          </label>

          <label className="form-control w-full">
            <span className="label">
              <span className="label-text">Sort notes</span>
            </span>
            <select
              className="select select-bordered"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="updated">Recently updated</option>
            </select>
          </label>

          <div className="form-control w-full">
            <span className="label">
              <span className="label-text">Filter by tags</span>
              <span className="label-text-alt text-base-content/60">
                Select multiple
              </span>
            </span>
            {tagOptions.length ? (
              <div className="space-y-2">
                {tagOptions.map((tag) => (
                  <label
                    key={tag}
                    className="label cursor-pointer justify-start gap-2 px-0"
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={selectedTags.includes(tag)}
                      onChange={() => toggleTagSelection(tag)}
                    />
                    <span className="label-text">{formatTagLabel(tag)}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-base-100 px-3 py-2 text-sm text-base-content/60">
                Tags you add to notes will appear here for quick filtering.
              </p>
            )}
          </div>

          <div className="divider" data-content="Helpful tips" />
          <div className="space-y-2">
            {filterTips.map(({ title, description, icon, tone }, index) => {
              const IconComponent = icon;
              const isOpen = openTips.includes(title);
              const contentId = `filter-tip-${index}`;

              return (
                <div
                  key={title}
                  className="rounded-xl border border-base-300 bg-base-100/90 shadow-sm"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-base font-semibold"
                    onClick={() => toggleTip(title)}
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                  >
                    <span className="flex items-center gap-3">
                      <IconComponent
                        className={`size-5 ${
                          tipToneClasses[tone] ?? "text-primary"
                        }`}
                      />
                      <span>{title}</span>
                    </span>
                    <ChevronDownIcon
                      className={`size-5 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </button>
                  <div
                    id={contentId}
                    className={`px-4 pb-4 text-sm text-base-content/70 transition-[max-height,opacity] duration-300 ease-in-out ${
                      isOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                    }`}
                    aria-hidden={!isOpen}
                    style={{ overflow: "hidden" }}
                  >
                    <p className="leading-relaxed">{description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={closeDrawer}
          >
            Close filters
          </button>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
