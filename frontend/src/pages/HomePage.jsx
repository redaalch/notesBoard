import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  FilterIcon,
  MoveIcon,
  ListChecksIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
  TagIcon,
  XIcon,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../Components/Navbar.jsx";
import RateLimitedUI from "../Components/RateLimitedUI.jsx";
import api from "../lib/axios.js";
import toast from "react-hot-toast";
import NoteCard from "../Components/NoteCard.jsx";
import NotesNotFound from "../Components/NotesNotFound.jsx";
import NoteSkeleton from "../Components/NoteSkeleton.jsx";
import NotesStats from "../Components/NotesStats.jsx";
import { countWords, formatTagLabel, normalizeTag } from "../lib/Utils.js";
import TemplateGalleryModal from "../Components/TemplateGalleryModal.jsx";
import BulkActionsBar from "../Components/BulkActionsBar.jsx";
import TagInput from "../Components/TagInput.jsx";
import ConfirmDialog from "../Components/ConfirmDialog.jsx";
import { useCommandPalette } from "../contexts/CommandPaletteContext.jsx";

const FILTER_STORAGE_KEY = "notesboard-filters-v1";

const mergeOrder = (primary = [], fallback = []) => {
  const fallbackStrings = new Set(
    fallback
      .map((id) => (typeof id === "string" ? id : id?.toString?.() ?? null))
      .filter(Boolean)
  );

  const result = [];
  const seen = new Set();

  primary.forEach((id) => {
    const strId = typeof id === "string" ? id : id?.toString?.();
    if (strId && !seen.has(strId) && fallbackStrings.has(strId)) {
      result.push(strId);
      seen.add(strId);
    }
  });

  fallback.forEach((id) => {
    const strId = typeof id === "string" ? id : id?.toString?.();
    if (strId && !seen.has(strId)) {
      result.push(strId);
      seen.add(strId);
    }
  });

  return result;
};

const noop = () => {};

const getNoteId = (note) => {
  if (!note) return null;
  const rawId = note._id ?? note.id;
  return typeof rawId === "string" ? rawId : rawId?.toString?.() ?? null;
};

function SortableNoteCard({
  note,
  selectedTags,
  onTagClick,
}) {
  const id = getNoteId(note);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <NoteCard
      note={note}
      customizeMode
      selectionMode={false}
      selected={false}
      onSelectionChange={noop}
      selectedTags={selectedTags}
      onTagClick={onTagClick}
      innerRef={setNodeRef}
      dragHandleProps={{ ...attributes, ...listeners }}
      dragHandleRef={setActivatorNodeRef}
      style={style}
      dragging={isDragging}
    />
  );
}

const sortLabelMap = {
  newest: "Newest first",
  oldest: "Oldest first",
  alphabetical: "A → Z",
  updated: "Recently updated",
  custom: "Custom order",
};

const BULK_SUCCESS_MESSAGES = {
  pin: "Pinned selected notes",
  unpin: "Unpinned selected notes",
  delete: "Deleted selected notes",
  addTags: "Tags added to selected notes",
  move: "Moved notes to the chosen board",
};

function HomePage() {
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [minWords, setMinWords] = useState(0);
  const [sortOrder, setSortOrder] = useState("newest");
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [bulkTags, setBulkTags] = useState([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [customOrderOverride, setCustomOrderOverride] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const filterPanelRef = useRef(null);
  const hasInitializedFilters = useRef(false);
  const searchInputRef = useRef(null);
  const previousSortRef = useRef("newest");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { registerCommands } = useCommandPalette();
  const notesQuery = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const res = await api.get("/notes");
      const payload = Array.isArray(res.data) ? res.data : [];
      return payload;
    },
    retry: (failureCount, error) => {
      if (error?.response?.status === 429) {
        return false;
      }
      return failureCount < 1;
    },
    onSuccess: () => {
      setIsRateLimited(false);
    },
    onError: (error) => {
      console.error("Error fetching notes", error);
      if (error?.response?.status === 429) {
        setIsRateLimited(true);
      } else {
        toast.error("Failed to load Notes");
      }
    },
  });

  const layoutQuery = useQuery({
    queryKey: ["note-layout"],
    queryFn: async () => {
      const response = await api.get("/notes/layout");
      const noteIds = Array.isArray(response.data?.noteIds)
        ? response.data.noteIds.map((id) =>
            typeof id === "string" ? id : id?.toString?.()
          )
        : [];
      return noteIds.filter(Boolean);
    },
    staleTime: 300_000,
  });

  const notes = useMemo(
    () => (Array.isArray(notesQuery.data) ? notesQuery.data : []),
    [notesQuery.data]
  );
  const loading = notesQuery.isLoading;
  const layoutOrder = useMemo(() => {
    return Array.isArray(layoutQuery.data) ? layoutQuery.data : [];
  }, [layoutQuery.data]);
  const allNoteIds = useMemo(
    () =>
      notes.map((note) =>
        typeof note._id === "string" ? note._id : note._id?.toString?.()
      ),
    [notes]
  );
  const baseCustomOrder =
    customOrderOverride.length > 0 ? customOrderOverride : layoutOrder;
  const effectiveCustomOrder = useMemo(
    () => mergeOrder(baseCustomOrder, allNoteIds),
    [baseCustomOrder, allNoteIds]
  );
  const customOrderIndex = useMemo(() => {
    const map = new Map();
    effectiveCustomOrder.forEach((id, index) => {
      if (id) {
        map.set(id, index);
      }
    });
    return map;
  }, [effectiveCustomOrder]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const updateLayoutMutation = useMutation({
    mutationFn: async (noteIds) => {
      const response = await api.put("/notes/layout", { noteIds });
      const savedIds = Array.isArray(response.data?.noteIds)
        ? response.data.noteIds.map((id) =>
            typeof id === "string" ? id : id?.toString?.()
          )
        : [];
      return savedIds.filter(Boolean);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["note-layout"], data);
    },
    onError: (error) => {
      const message =
        error?.response?.data?.message ?? "Failed to save note layout";
      toast.error(message);
      layoutQuery.refetch().catch(() => {});
    },
  });

  const handleDragEnd = useCallback(
    ({ active, over }) => {
      if (!customizeMode || !over) return;

      const activeId =
        typeof active?.id === "string"
          ? active.id
          : active?.id?.toString?.() ?? null;
      const overId =
        typeof over?.id === "string"
          ? over.id
          : over?.id?.toString?.() ?? null;

      if (!activeId || !overId || activeId === overId) {
        return;
      }

      setCustomOrderOverride((prev) => {
        const baseline = prev.length
          ? mergeOrder(prev, allNoteIds)
          : mergeOrder(layoutOrder, allNoteIds);
        const oldIndex = baseline.indexOf(activeId);
        const newIndex = baseline.indexOf(overId);

        if (oldIndex === -1 || newIndex === -1) {
          return baseline;
        }

        const reordered = arrayMove(baseline, oldIndex, newIndex);
        updateLayoutMutation.mutate(reordered);
        return reordered;
      });
    },
    [allNoteIds, customizeMode, layoutOrder, updateLayoutMutation]
  );

  const tagStatsQuery = useQuery({
    queryKey: ["tag-stats"],
    queryFn: async () => {
      const response = await api.get("/notes/tags/stats");
      const tags = response.data?.tags ?? [];
      return {
        tags,
        uniqueTags: response.data?.uniqueTags ?? tags.length,
        topTag: response.data?.topTag ?? null,
      };
    },
    enabled: notes.length > 0 && !isRateLimited && !notesQuery.isError,
    staleTime: 300_000,
    retry: 1,
    onError: (error) => {
      console.error("Error fetching tag stats", error);
    },
  });

  const tagInsights = tagStatsQuery.data ?? null;
  const availableTags = useMemo(() => {
    if (tagInsights?.tags?.length) {
      return Array.from(
        new Set(
          tagInsights.tags
            .map((entry) => normalizeTag(entry?._id))
            .filter(Boolean)
        )
      );
    }
    return [];
  }, [tagInsights]);

  const boardsQuery = useQuery({
    queryKey: ["boards"],
    queryFn: async () => {
      const response = await api.get("/boards");
      const payload = response.data ?? {};
      return {
        boards: Array.isArray(payload.boards) ? payload.boards : [],
        defaultBoardId: payload.defaultBoardId ?? null,
      };
    },
    staleTime: 300_000,
    enabled: selectionMode || moveModalOpen || templateModalOpen,
  });

  const boardOptions = useMemo(() => {
    return boardsQuery.data?.boards ?? [];
  }, [boardsQuery.data]);
  const defaultBoardId = boardsQuery.data?.defaultBoardId ?? null;

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
      console.warn("Unable to read stored filters", error);
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
      "custom",
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
      console.warn("Unable to persist filters", error);
    }
  }, [
    searchQuery,
    minWords,
    activeTab,
    sortOrder,
    selectedTags,
    setSearchParams,
  ]);

  const isFetchingNotes = notesQuery.isFetching;

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

    const sorted =
      sortOrder === "custom"
        ? [...byTags].sort((a, b) => {
            const aId = typeof a._id === "string" ? a._id : a._id?.toString?.();
            const bId = typeof b._id === "string" ? b._id : b._id?.toString?.();
            const indexA = aId !== undefined ? customOrderIndex.get(aId) : null;
            const indexB = bId !== undefined ? customOrderIndex.get(bId) : null;

            if (indexA !== undefined && indexA !== null) {
              if (indexB !== undefined && indexB !== null) {
                return indexA - indexB;
              }
              return -1;
            }

            if (indexB !== undefined && indexB !== null) {
              return 1;
            }

            const fallback =
              new Date(b.updatedAt ?? b.createdAt) -
              new Date(a.updatedAt ?? a.createdAt);
            if (fallback !== 0) {
              return fallback;
            }
            return new Date(b.createdAt) - new Date(a.createdAt);
          })
        : [...byTags].sort((a, b) => {
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
    customOrderIndex,
  ]);

  const selectedNoteIdSet = useMemo(
    () => new Set(selectedNoteIds),
    [selectedNoteIds]
  );

  useEffect(() => {
    if (!selectedNoteIds.length) return;
    const noteIdSet = new Set(notes.map((note) => note._id));
    setSelectedNoteIds((prev) => {
      const filtered = prev.filter((id) => noteIdSet.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [notes, selectedNoteIds.length]);

  const showFilterEmptyState =
    !loading &&
    !isFetchingNotes &&
    !isRateLimited &&
    !notesQuery.isError &&
    notes.length > 0 &&
    !filteredNotes.length;

  const customizeDisabled =
    !customizeMode &&
    (notes.length <= 1 ||
      loading ||
      isFetchingNotes ||
      isRateLimited ||
      notesQuery.isError ||
      filtersApplied);

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

  const invalidateNotesCaches = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["tag-stats"] }),
      ]),
    [queryClient]
  );

  const selectionCount = selectedNoteIds.length;

  const handleNoteSelectionChange = useCallback((noteId, checked) => {
    setSelectedNoteIds((prev) => {
      const exists = prev.includes(noteId);
      if (checked && !exists) {
        return [...prev, noteId];
      }
      if (!checked && exists) {
        return prev.filter((id) => id !== noteId);
      }
      return prev;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedNoteIds([]);
    setSelectionMode(false);
  }, []);

  const handleToggleCustomize = useCallback(() => {
    setCustomizeMode((prev) => {
      const next = !prev;
      if (next) {
        previousSortRef.current = sortOrder;
        setCustomOrderOverride(effectiveCustomOrder);
        setSortOrder("custom");
        setSelectionMode(false);
        setSelectedNoteIds([]);
      } else {
        setCustomOrderOverride([]);
        if (previousSortRef.current && previousSortRef.current !== "custom") {
          setSortOrder(previousSortRef.current);
        }
      }
      return next;
    });
  }, [effectiveCustomOrder, sortOrder]);

  const performBulkAction = useCallback(
    async (action, extraPayload = {}) => {
      if (!selectionCount) {
        toast.error("Select at least one note first");
        return;
      }

      setBulkActionLoading(true);
      try {
        await api.post("/notes/bulk", {
          action,
          noteIds: selectedNoteIds,
          ...extraPayload,
        });

        const message = BULK_SUCCESS_MESSAGES[action] ?? "Notes updated";
        toast.success(message);

        setSelectedNoteIds([]);
        setSelectionMode(false);
        await invalidateNotesCaches();
      } catch (error) {
        console.error("Bulk action failed", error);
        const message =
          error.response?.data?.message ?? "Failed to update selected notes";
        toast.error(message);
      } finally {
        setBulkActionLoading(false);
      }
    },
    [invalidateNotesCaches, selectedNoteIds, selectionCount]
  );

  const handleBulkPin = () => performBulkAction("pin");
  const handleBulkUnpin = () => performBulkAction("unpin");
  const handleBulkAddTags = () => setTagModalOpen(true);
  const handleBulkMove = () => setMoveModalOpen(true);
  const handleBulkDelete = () => setDeleteDialogOpen(true);

  const submitBulkTags = async () => {
    const normalized = bulkTags.map((tag) => normalizeTag(tag)).filter(Boolean);
    if (!normalized.length) {
      toast.error("Add at least one tag to continue");
      return;
    }

    setTagModalOpen(false);
    setBulkTags([]);
    await performBulkAction("addTags", { tags: normalized });
  };

  const submitBulkMove = async () => {
    if (!selectedBoardId) {
      toast.error("Choose a board to move notes into");
      return;
    }

    setMoveModalOpen(false);
    await performBulkAction("move", { boardId: selectedBoardId });
  };

  const confirmBulkDelete = async () => {
    setDeleteDialogOpen(false);
    await performBulkAction("delete");
  };

  const cancelBulkDelete = () => setDeleteDialogOpen(false);

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
  };

  const openTemplateGallery = () => setTemplateModalOpen(true);

  const handleTemplateSelect = (template) => {
    if (!template) return;
    setTemplateModalOpen(false);
    navigate("/create", { state: { template } });
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

  useEffect(() => {
    if (!selectionMode) {
      setSelectedNoteIds([]);
    }
  }, [selectionMode]);

  useEffect(() => {
    if (customizeMode && sortOrder !== "custom") {
      setCustomizeMode(false);
      setCustomOrderOverride([]);
    }
  }, [customizeMode, sortOrder]);

  useEffect(() => {
    if (!moveModalOpen || !boardOptions.length) return;
    setSelectedBoardId((previous) => {
      if (previous && boardOptions.some((board) => board.id === previous)) {
        return previous;
      }
      if (
        defaultBoardId &&
        boardOptions.some((board) => board.id === defaultBoardId)
      ) {
        return defaultBoardId;
      }
      return boardOptions[0]?.id ?? "";
    });
  }, [moveModalOpen, boardOptions, defaultBoardId]);

  useEffect(() => {
    const cleanup = registerCommands([
      {
        id: "home:toggle-selection",
        label: selectionMode
          ? "Exit multi-select mode"
          : "Enter multi-select mode",
        section: "Notes",
        keywords: ["bulk", "multi-select", "select"],
        action: () => setSelectionMode((prev) => !prev),
      },
      {
        id: "home:focus-search",
        label: "Focus notes search",
        section: "Notes",
        shortcut: "/",
        action: () => searchInputRef.current?.focus(),
      },
      {
        id: "home:open-templates",
        label: "Browse note templates",
        section: "Notes",
        action: () => setTemplateModalOpen(true),
      },
      {
        id: "home:toggle-filters",
        label: drawerOpen ? "Close filters drawer" : "Open filters drawer",
        section: "Notes",
        action: () => setDrawerOpen((prev) => !prev),
      },
    ]);
    return cleanup;
  }, [drawerOpen, registerCommands, selectionMode]);

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

        <main id="main-content" tabIndex={-1} className="flex-1 w-full">
          <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8">
            <NotesStats
              notes={notes}
              loading={loading || isFetchingNotes}
              tagStats={tagInsights}
            />

            <div className="sticky top-4 z-10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-base-300/60 bg-base-200/70 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm gap-2"
                    onClick={openTemplateGallery}
                  >
                    <SparklesIcon className="size-4" />
                    New note from...
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm gap-2 ${
                      selectionMode ? "btn-primary" : "btn-outline"
                    }`}
                    onClick={toggleSelectionMode}
                  >
                    <ListChecksIcon className="size-4" />
                    {selectionMode ? "Exit multi-select" : "Multi-select"}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm gap-2 ${
                      customizeMode ? "btn-primary" : "btn-outline"
                    }`}
                    onClick={handleToggleCustomize}
                    disabled={customizeDisabled}
                    aria-pressed={customizeMode}
                  >
                    <MoveIcon className="size-4" />
                    {customizeMode ? "Finish arranging" : "Customize order"}
                  </button>
                </div>
                <div className="text-xs text-base-content/60">
                  {selectionMode
                    ? "Tap notes to select them for bulk actions."
                    : "Filter, search, or group your notes quickly."}
                </div>
              </div>

              <div className="rounded-2xl border border-base-300/60 bg-base-100/80 p-4 shadow-sm backdrop-blur supports-[backdrop-filter:blur(0px)]:bg-base-100/70">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div
                    className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2"
                    role="tablist"
                  >
                    {tabConfig.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        className={`btn btn-sm h-auto min-h-[2.5rem] flex-1 sm:flex-initial ${
                          activeTab === tab.id ? "btn-primary" : "btn-outline"
                        }`}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span className="whitespace-nowrap">{tab.label}</span>
                          <span className="badge badge-sm flex-shrink-0">
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
                          ref={searchInputRef}
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
                      <option value="custom">Custom order</option>
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

              {selectionMode && selectionCount > 0 && (
                <BulkActionsBar
                  selectedCount={selectionCount}
                  onClearSelection={handleClearSelection}
                  onPinSelected={handleBulkPin}
                  onUnpinSelected={handleBulkUnpin}
                  onAddTags={handleBulkAddTags}
                  onMove={handleBulkMove}
                  onDelete={handleBulkDelete}
                  busy={bulkActionLoading}
                />
              )}

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

              {customizeMode && (
                <div className="alert alert-info border border-primary/30 bg-primary/5 shadow-sm">
                  <MoveIcon className="size-5" />
                  <div>
                    <h3 className="font-semibold">Arrange your notes</h3>
                    <p className="text-sm text-base-content/70">
                      Drag cards to reorder. Changes save automatically when you drop a note.
                    </p>
                  </div>
                  {updateLayoutMutation.isPending && (
                    <span className="text-xs font-medium text-primary">
                      Saving order...
                    </span>
                  )}
                </div>
              )}
            </div>

            {loading && <NoteSkeleton />}

            {notesQuery.isError && !isRateLimited && (
              <div className="alert alert-error">
                <AlertTriangleIcon className="size-5" />
                <div>
                  <h3 className="font-bold">
                    We couldn&apos;t load your notes
                  </h3>
                  <p className="text-sm">
                    Please refresh or try again in a moment.
                  </p>
                </div>
              </div>
            )}

            {!loading && !isFetchingNotes && filteredNotes.length > 0 && (
              customizeMode ? (
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={filteredNotes
                      .map((note) => getNoteId(note))
                      .filter(Boolean)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {filteredNotes.map((note) => {
                        const id = getNoteId(note);
                        if (!id) return null;
                        return (
                          <SortableNoteCard
                            key={id}
                            note={note}
                            onTagClick={toggleTagSelection}
                            selectedTags={selectedTags}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredNotes.map((note) => {
                    const isSelected = selectedNoteIdSet.has(note._id);
                    return (
                      <NoteCard
                        key={note._id}
                        note={note}
                        onTagClick={
                          selectionMode ? undefined : toggleTagSelection
                        }
                        selectedTags={selectedTags}
                        selectionMode={selectionMode}
                        selected={isSelected}
                        onSelectionChange={handleNoteSelectionChange}
                      />
                    );
                  })}
                </div>
              )
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

            {!loading &&
              !isFetchingNotes &&
              !isRateLimited &&
              !notesQuery.isError &&
              notes.length === 0 && <NotesNotFound />}
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

      <div className="drawer-side z-50">
        <label
          htmlFor="notes-filters"
          className="drawer-overlay"
          onClick={closeDrawer}
        />
        <div
          ref={filterPanelRef}
          className="menu h-full w-80 gap-6 overflow-y-auto bg-base-200 p-6"
        >
          <div className="flex items-center justify-between gap-2 flex-nowrap">
            <div className="flex items-center gap-2 min-w-0 flex-shrink">
              <SparklesIcon className="size-5 text-primary flex-shrink-0" />
              <h2 className="text-lg font-semibold truncate">Filters</h2>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle flex-shrink-0"
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
              <option value="custom">Custom order</option>
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
            {filterTips.map(({ title, description, icon, tone }) => {
              const IconComponent = icon;

              return (
                <details
                  key={title}
                  className="rounded-xl border border-base-300 bg-base-100/90 shadow-sm group"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left text-base font-semibold list-none">
                    <span className="flex items-center gap-3">
                      <IconComponent
                        className={`size-5 ${
                          tipToneClasses[tone] ?? "text-primary"
                        }`}
                      />
                      <span>{title}</span>
                    </span>
                    <ChevronDownIcon className="size-5 transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <div className="px-4 pb-4 text-sm text-base-content/70">
                    <p className="leading-relaxed">{description}</p>
                  </div>
                </details>
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

      <TemplateGalleryModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSelect={handleTemplateSelect}
      />

      {tagModalOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4 py-10"
          role="dialog"
          aria-modal="true"
          onClick={() => setTagModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">
              Add tags to selected notes
            </h3>
            <p className="mt-1 text-sm text-base-content/60">
              Tags are lowercased automatically. You can add up to eight tags
              per note.
            </p>
            <div className="mt-4">
              <TagInput value={bulkTags} onChange={setBulkTags} />
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setTagModalOpen(false)}
                disabled={bulkActionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={submitBulkTags}
                disabled={bulkActionLoading}
              >
                Apply tags
              </button>
            </div>
          </div>
        </div>
      )}

      {moveModalOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4 py-10"
          role="dialog"
          aria-modal="true"
          onClick={() => setMoveModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">
              Move notes to another board
            </h3>
            <p className="mt-1 text-sm text-base-content/60">
              Choose where the selected notes should live. Pinned status and
              tags stay intact.
            </p>
            <div className="mt-4 space-y-2">
              {boardsQuery.isLoading ? (
                <p className="text-sm text-base-content/60">
                  Loading boards...
                </p>
              ) : boardOptions.length ? (
                <select
                  className="select select-bordered w-full"
                  value={selectedBoardId}
                  onChange={(event) => setSelectedBoardId(event.target.value)}
                >
                  {boardOptions.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.workspaceName
                        ? `${board.workspaceName} · ${board.name}`
                        : board.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="rounded-lg bg-base-200/70 px-4 py-3 text-sm text-base-content/60">
                  No boards available yet. Create another board to move notes
                  into.
                </p>
              )}
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setMoveModalOpen(false)}
                disabled={bulkActionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={submitBulkMove}
                disabled={
                  bulkActionLoading || !boardOptions.length || !selectedBoardId
                }
              >
                Move notes
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete selected notes?"
        description="This permanently removes the selected notes and their collaborative history."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="error"
        confirmLoading={bulkActionLoading}
        onCancel={cancelBulkDelete}
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}

export default HomePage;
