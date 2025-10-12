import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDraggable,
  useDroppable,
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
  BookmarkIcon,
  BrainIcon,
  BriefcaseBusinessIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  FilterIcon,
  FolderIcon,
  FolderPlusIcon,
  LightbulbIcon,
  ListChecksIcon,
  ListTodoIcon,
  MoveIcon,
  MoreVerticalIcon,
  NotebookIcon,
  NotebookPenIcon,
  PaletteIcon,
  PencilLineIcon,
  PlusIcon,
  RefreshCwIcon,
  RocketIcon,
  SearchIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
  TargetIcon,
  Trash2Icon,
  WorkflowIcon,
  XIcon,
  BookOpenIcon,
  LayersIcon,
} from "lucide-react";
import { NOTEBOOK_COLORS, NOTEBOOK_ICONS } from "@shared/notebookOptions.js";
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

function SortableNoteCard({ note, selectedTags, onTagClick }) {
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
    transition:
      transition ??
      (transform ? "transform 180ms cubic-bezier(0.2, 0, 0, 1)" : undefined),
    zIndex: isDragging ? 2 : undefined,
    pointerEvents: isDragging ? "none" : undefined,
    touchAction: "none",
    willChange: "transform",
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
  moveNotebook: "Updated notebooks for selected notes",
};

const notebookIconComponents = {
  Notebook: NotebookIcon,
  NotebookPen: NotebookPenIcon,
  Sparkles: SparklesIcon,
  Lightbulb: LightbulbIcon,
  Star: StarIcon,
  Rocket: RocketIcon,
  Target: TargetIcon,
  Palette: PaletteIcon,
  Layers: LayersIcon,
  BookOpen: BookOpenIcon,
  Workflow: WorkflowIcon,
  Calendar: CalendarIcon,
  ListTodo: ListTodoIcon,
  Bookmark: BookmarkIcon,
  BriefcaseBusiness: BriefcaseBusinessIcon,
  Brain: BrainIcon,
};

const getNotebookDroppableId = (notebookId) =>
  `notebook:${notebookId ?? "uncategorized"}`;

function NotebookDropZone({ notebookId, disabled = false, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: getNotebookDroppableId(notebookId),
    disabled,
    data: { notebookId: notebookId ?? "uncategorized" },
  });

  return children({
    setNodeRef: disabled ? undefined : setNodeRef,
    isOver: !disabled && isOver,
  });
}

function DraggableBoardNote({
  note,
  selectionMode,
  customizeMode,
  selected,
  onSelectionChange,
  onTagClick,
  selectedTags,
}) {
  const noteId = getNoteId(note);
  const disabled = customizeMode;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: noteId,
      data: { type: "note", noteId },
      disabled,
    });

  const dragStyleRaw = transform
    ? {
        transform: CSS.Transform.toString(transform),
      }
    : {};

  if (isDragging) {
    dragStyleRaw.opacity = 0;
  }

  const dragStyle = Object.keys(dragStyleRaw).length ? dragStyleRaw : undefined;

  return (
    <NoteCard
      note={note}
      selectionMode={selectionMode}
      selected={selected}
      onSelectionChange={onSelectionChange}
      onTagClick={onTagClick}
      selectedTags={selectedTags}
      customizeMode={customizeMode}
      innerRef={setNodeRef}
      cardDragProps={disabled ? null : { ...attributes, ...listeners }}
      style={dragStyle}
      dragging={isDragging}
    />
  );
}

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
  const [activeDragId, setActiveDragId] = useState(null);
  const [activeNotebookId, setActiveNotebookId] = useState("all");
  const [notebookFormState, setNotebookFormState] = useState(null);
  const [notebookNameInput, setNotebookNameInput] = useState("");
  const [notebookColorInput, setNotebookColorInput] = useState(null);
  const [notebookIconInput, setNotebookIconInput] = useState(null);
  const [notebookDeleteState, setNotebookDeleteState] = useState(null);
  const [moveNotebookModalOpen, setMoveNotebookModalOpen] = useState(false);
  const [selectedNotebookTargetId, setSelectedNotebookTargetId] =
    useState("uncategorized");
  const [notebookFormLoading, setNotebookFormLoading] = useState(false);
  const [notebookDeleteLoading, setNotebookDeleteLoading] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [activeDragNoteIds, setActiveDragNoteIds] = useState([]);
  const [a11yMessage, setA11yMessage] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const filterPanelRef = useRef(null);
  const hasInitializedFilters = useRef(false);
  const searchInputRef = useRef(null);
  const previousSortRef = useRef("newest");
  const liveMessageTimeoutRef = useRef(null);
  const queryClient = useQueryClient();
  const invalidateNotesCaches = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["tag-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["note-layout"] }),
        queryClient.invalidateQueries({ queryKey: ["notebooks"] }),
      ]),
    [queryClient]
  );
  const navigate = useNavigate();
  const { registerCommands } = useCommandPalette();
  const notesQuery = useQuery({
    queryKey: ["notes", activeNotebookId],
    queryFn: async () => {
      const params =
        activeNotebookId && activeNotebookId !== "all"
          ? { notebookId: activeNotebookId }
          : undefined;
      const res = await api.get("/notes", { params });
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
      } else if (
        error?.response?.status === 404 &&
        activeNotebookId !== "all"
      ) {
        toast.error("Notebook not found. Showing all notes.");
        setActiveNotebookId("all");
      } else {
        toast.error("Failed to load Notes");
      }
    },
  });

  const layoutQuery = useQuery({
    queryKey: ["note-layout", activeNotebookId],
    queryFn: async () => {
      const params =
        activeNotebookId && activeNotebookId !== "all"
          ? { notebookId: activeNotebookId }
          : undefined;
      const response = await api.get("/notes/layout", { params });
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

  const dropAnimation = useMemo(
    () => ({
      duration: 220,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
      sideEffects: defaultDropAnimationSideEffects({
        styles: {
          active: {
            opacity: "0.4",
            transform: "scale(1.02)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          },
        },
      }),
    }),
    []
  );

  const notebooksQuery = useQuery({
    queryKey: ["notebooks"],
    queryFn: async () => {
      const response = await api.get("/notebooks");
      const payload = response.data ?? {};
      return {
        notebooks: Array.isArray(payload.notebooks) ? payload.notebooks : [],
        uncategorizedCount: payload.uncategorizedCount ?? 0,
      };
    },
    staleTime: 180_000,
  });

  const notebooks = useMemo(
    () => notebooksQuery.data?.notebooks ?? [],
    [notebooksQuery.data]
  );
  const uncategorizedNoteCount = notebooksQuery.data?.uncategorizedCount ?? 0;
  const totalNotebookCount = useMemo(() => {
    const notebookTotal = notebooks.reduce(
      (sum, notebook) => sum + (Number(notebook.noteCount) || 0),
      0
    );
    return notebookTotal + (Number(uncategorizedNoteCount) || 0);
  }, [notebooks, uncategorizedNoteCount]);
  const activeNotebook = useMemo(() => {
    if (!notebooks.length) return null;
    return notebooks.find((entry) => entry.id === activeNotebookId) ?? null;
  }, [notebooks, activeNotebookId]);
  const createPageState = useMemo(() => {
    if (
      activeNotebookId &&
      activeNotebookId !== "all" &&
      activeNotebookId !== "uncategorized"
    ) {
      return { notebookId: activeNotebookId };
    }
    return undefined;
  }, [activeNotebookId]);
  const notebooksLoading = notebooksQuery.isLoading;
  const notebooksError = notebooksQuery.isError;

  const moveNotesToNotebook = useCallback(
    async ({ noteIds, targetNotebookId, skipLoader = false }) => {
      const ids = Array.isArray(noteIds) ? noteIds.filter(Boolean) : [];
      if (!ids.length) return;

      const normalizedTarget =
        !targetNotebookId ||
        targetNotebookId === "__uncategorized" ||
        targetNotebookId === "uncategorized" ||
        targetNotebookId === "all"
          ? "uncategorized"
          : targetNotebookId;

      if (!skipLoader) {
        setBulkActionLoading(true);
      }

      try {
        await api.post("/notes/bulk", {
          action: "moveNotebook",
          noteIds: ids,
          notebookId: normalizedTarget,
        });

        const notebookLabel =
          normalizedTarget === "uncategorized"
            ? "Uncategorized"
            : notebooks.find((entry) => entry.id === normalizedTarget)?.name ??
              "notebook";

        const message =
          ids.length === 1
            ? `Moved note to ${notebookLabel}`
            : `Moved ${ids.length} notes to ${notebookLabel}`;

        toast.success(message);
        setA11yMessage(message);
        setSelectedNoteIds((previous) =>
          previous.filter((value) => !ids.includes(value))
        );

        await invalidateNotesCaches();
      } catch (error) {
        const message =
          error?.response?.data?.message ??
          "Failed to move notes to the selected notebook";
        toast.error(message);
        setA11yMessage(message);
      } finally {
        if (!skipLoader) {
          setBulkActionLoading(false);
        }
      }
    },
    [invalidateNotesCaches, notebooks]
  );

  const updateLayoutMutation = useMutation({
    mutationFn: async ({ noteIds, contextId }) => {
      const payload = { noteIds };
      if (contextId && contextId !== "all") {
        payload.notebookId = contextId;
      }

      const response = await api.put("/notes/layout", payload);
      const savedIds = Array.isArray(response.data?.noteIds)
        ? response.data.noteIds.map((id) =>
            typeof id === "string" ? id : id?.toString?.()
          )
        : [];
      return {
        noteIds: savedIds.filter(Boolean),
        contextId: contextId ?? "all",
      };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["note-layout", data.contextId ?? "all"],
        data.noteIds
      );
    },
    onError: (error) => {
      const message =
        error?.response?.data?.message ?? "Failed to save note layout";
      toast.error(message);
      layoutQuery.refetch().catch(() => {});
    },
  });

  const handleDragStart = useCallback(
    ({ active }) => {
      const activeId =
        typeof active?.id === "string"
          ? active.id
          : active?.id?.toString?.() ?? null;
      if (!activeId) return;

      setActiveDragId(activeId);

      if (
        selectionMode &&
        selectedNoteIds.includes(activeId) &&
        selectedNoteIds.length > 0
      ) {
        setActiveDragNoteIds(selectedNoteIds);
      } else {
        setActiveDragNoteIds([activeId]);
      }
    },
    [selectionMode, selectedNoteIds]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setActiveDragNoteIds([]);
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }) => {
      const activeId =
        typeof active?.id === "string"
          ? active.id
          : active?.id?.toString?.() ?? null;

      setActiveDragId(null);
      setActiveDragNoteIds([]);

      if (!activeId) {
        return;
      }

      const overId =
        typeof over?.id === "string" ? over.id : over?.id?.toString?.() ?? null;

      if (overId && overId.startsWith("notebook:")) {
        const targetNotebookId =
          over?.data?.current?.notebookId ?? overId.replace("notebook:", "");
        const normalizedTarget =
          targetNotebookId === "uncategorized" || targetNotebookId === "all"
            ? "uncategorized"
            : targetNotebookId;

        const idsToMove =
          selectionMode && selectedNoteIds.includes(activeId)
            ? activeDragNoteIds
            : [activeId];

        moveNotesToNotebook({
          noteIds: Array.from(new Set(idsToMove.filter(Boolean))),
          targetNotebookId: normalizedTarget,
          skipLoader: true,
        });
        return;
      }

      if (!customizeMode || !overId || activeId === overId) {
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
        updateLayoutMutation.mutate({
          noteIds: reordered,
          contextId: activeNotebookId ?? "all",
        });
        return reordered;
      });
    },
    [
      activeDragNoteIds,
      customizeMode,
      allNoteIds,
      layoutOrder,
      updateLayoutMutation,
      activeNotebookId,
      moveNotesToNotebook,
      selectionMode,
      selectedNoteIds,
    ]
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

    const initialNotebookRaw =
      params.notebook ?? storedFilters.activeNotebookId ?? "all";
    const normalizedNotebook =
      typeof initialNotebookRaw === "string" && initialNotebookRaw.trim()
        ? initialNotebookRaw
        : "all";

    setActiveNotebookId(normalizedNotebook);

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
    if (activeNotebookId && activeNotebookId !== "all") {
      params.notebook = activeNotebookId;
    }

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
          activeNotebookId,
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
    activeNotebookId,
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

  const notebookFilterActive = activeNotebookId !== "all";
  const hasGeneralFilters = Boolean(
    selectedTags.length > 0 ||
      searchQuery.trim() ||
      Number(minWords) > 0 ||
      sortOrder !== "newest" ||
      activeTab !== "all"
  );
  const filtersApplied = notebookFilterActive || hasGeneralFilters;

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

    if (notebookFilterActive) {
      const notebookLabel =
        activeNotebookId === "uncategorized"
          ? "Notebook: Uncategorized"
          : activeNotebook?.name
          ? `Notebook: ${activeNotebook.name}`
          : "Notebook filter";

      chips.push({
        key: "notebook",
        label: notebookLabel,
        onClear: () => setActiveNotebookId("all"),
      });
    }

    return chips;
  }, [
    searchQuery,
    minWords,
    sortOrder,
    activeTab,
    activeTabLabel,
    notebookFilterActive,
    activeNotebookId,
    activeNotebook,
  ]);

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

  const noteIndexLookup = useMemo(() => {
    const map = new Map();
    filteredNotes.forEach((note, index) => {
      const id = getNoteId(note);
      if (id) map.set(id, index);
    });
    return map;
  }, [filteredNotes]);

  const selectedNoteIdSet = useMemo(
    () => new Set(selectedNoteIds),
    [selectedNoteIds]
  );

  const activeDragNote = useMemo(() => {
    if (!activeDragId) return null;
    return filteredNotes.find((note) => getNoteId(note) === activeDragId);
  }, [activeDragId, filteredNotes]);

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
      hasGeneralFilters);

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
    setActiveNotebookId("all");
  };

  const selectionCount = selectedNoteIds.length;

  const handleNoteSelectionChange = useCallback(
    (noteId, checked, meta = {}) => {
      const shiftKey = Boolean(meta?.event?.shiftKey || meta?.shiftKey);
      const noteIndex = noteIndexLookup.get(noteId);

      setSelectedNoteIds((prev) => {
        const exists = prev.includes(noteId);

        if (shiftKey && lastSelectedIndex !== null && noteIndex !== undefined) {
          const start = Math.min(lastSelectedIndex, noteIndex);
          const end = Math.max(lastSelectedIndex, noteIndex);
          const rangeIds = filteredNotes
            .slice(start, end + 1)
            .map((note) => getNoteId(note))
            .filter(Boolean);

          if (checked) {
            const union = new Set(prev);
            rangeIds.forEach((id) => union.add(id));
            return Array.from(union);
          }

          return prev.filter((id) => !rangeIds.includes(id));
        }

        if (checked && !exists) {
          return [...prev, noteId];
        }
        if (!checked && exists) {
          return prev.filter((id) => id !== noteId);
        }
        return prev;
      });

      if (noteIndex !== undefined && noteIndex !== null) {
        setLastSelectedIndex(noteIndex);
      }

      if (checked && !selectionMode) {
        setSelectionMode(true);
      }
    },
    [filteredNotes, lastSelectedIndex, noteIndexLookup, selectionMode]
  );

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
  const handleBulkMoveNotebook = () => setMoveNotebookModalOpen(true);
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

  const submitBulkMoveNotebook = async () => {
    if (!selectedNotebookTargetId) {
      toast.error("Choose where the notes should go");
      return;
    }

    setMoveNotebookModalOpen(false);
    await performBulkAction("moveNotebook", {
      notebookId: selectedNotebookTargetId,
    });
  };

  const handleQuickMoveNotebook = useCallback(
    (value) => {
      if (!selectedNoteIds.length) {
        toast.error("Select notes to move first");
        return;
      }

      moveNotesToNotebook({
        noteIds: selectedNoteIds,
        targetNotebookId: value,
      });
    },
    [moveNotesToNotebook, selectedNoteIds]
  );

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
    const notebookState =
      activeNotebookId &&
      activeNotebookId !== "all" &&
      activeNotebookId !== "uncategorized"
        ? { notebookId: activeNotebookId }
        : {};
    navigate("/create", {
      state: notebookState.notebookId
        ? { template, notebookId: notebookState.notebookId }
        : { template },
    });
  };

  const handleSelectNotebook = useCallback(
    (nextId) => {
      const normalized =
        typeof nextId === "string" && nextId.trim().length ? nextId : "all";
      setActiveNotebookId(normalized);
      setSelectionMode(false);
      setSelectedNoteIds([]);
      setCustomOrderOverride([]);
      if (customizeMode) {
        setCustomizeMode(false);
        if (previousSortRef.current && previousSortRef.current !== "custom") {
          setSortOrder(previousSortRef.current);
        } else if (sortOrder === "custom") {
          setSortOrder("newest");
        }
      }
    },
    [customizeMode, sortOrder]
  );

  const openCreateNotebook = () => {
    setNotebookFormState({ mode: "create" });
    setNotebookNameInput("");
    setNotebookColorInput(null);
    setNotebookIconInput(null);
  };

  const openRenameNotebook = (notebook) => {
    if (!notebook) return;
    setNotebookFormState({ mode: "edit", notebook });
    setNotebookNameInput(notebook.name ?? "");
    setNotebookColorInput(notebook.color ?? null);
    setNotebookIconInput(notebook.icon ?? null);
  };

  const closeNotebookForm = () => {
    setNotebookFormState(null);
    setNotebookNameInput("");
    setNotebookColorInput(null);
    setNotebookIconInput(null);
    setNotebookFormLoading(false);
  };

  const handleNotebookFormSubmit = async (event) => {
    event.preventDefault();
    const name = notebookNameInput.trim();
    if (!name) {
      toast.error("Notebook name is required");
      return;
    }

    setNotebookFormLoading(true);
    try {
      let response;
      const payload = {
        name,
        color: notebookColorInput ?? null,
        icon: notebookIconInput ?? null,
      };
      if (notebookFormState?.mode === "edit" && notebookFormState?.notebook) {
        response = await api.patch(
          `/notebooks/${notebookFormState.notebook.id}`,
          payload
        );
        toast.success("Notebook renamed");
      } else {
        response = await api.post("/notebooks", payload);
        toast.success("Notebook created");
      }

      await queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      await queryClient.invalidateQueries({ queryKey: ["notes"] });

      if (notebookFormState?.mode !== "edit") {
        const createdId = response?.data?.id;
        if (createdId) {
          handleSelectNotebook(createdId);
        }
      }

      closeNotebookForm();
    } catch (error) {
      const message =
        error?.response?.data?.message ?? "Unable to save notebook";
      toast.error(message);
    } finally {
      setNotebookFormLoading(false);
    }
  };

  const openDeleteNotebook = (notebook) => {
    if (!notebook) return;
    const fallbackTarget =
      notebooks.find((entry) => entry.id !== notebook.id)?.id ??
      "uncategorized";
    setNotebookDeleteState({
      notebook,
      mode: notebook.noteCount ? "move" : "delete",
      targetNotebookId: fallbackTarget,
      deleteCollaborative: false,
    });
  };

  const closeNotebookDelete = () => {
    setNotebookDeleteState(null);
    setNotebookDeleteLoading(false);
  };

  const confirmNotebookDelete = async () => {
    if (!notebookDeleteState?.notebook) return;
    const { notebook, mode, targetNotebookId, deleteCollaborative } =
      notebookDeleteState;

    const payload = { mode, deleteCollaborative };
    if (mode === "move") {
      if (targetNotebookId && targetNotebookId !== "uncategorized") {
        payload.targetNotebookId = targetNotebookId;
      }
    }

    setNotebookDeleteLoading(true);
    try {
      await api.delete(`/notebooks/${notebook.id}`, { data: payload });
      toast.success(`Deleted ${notebook.name}`);
      if (activeNotebookId === notebook.id) {
        if (mode === "move" && targetNotebookId) {
          handleSelectNotebook(targetNotebookId);
        } else {
          handleSelectNotebook("all");
        }
      }

      await invalidateNotesCaches();

      closeNotebookDelete();
    } catch (error) {
      const message =
        error?.response?.data?.message ?? "Failed to delete notebook";
      toast.error(message);
    } finally {
      setNotebookDeleteLoading(false);
    }
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
      setLastSelectedIndex(null);
    }
  }, [selectionMode]);

  useEffect(() => {
    const isInteractiveElement = (element) => {
      if (!element) return false;
      const tagName = element.tagName;
      if (!tagName) return false;
      const normalized = tagName.toLowerCase();
      if (
        normalized === "input" ||
        normalized === "textarea" ||
        normalized === "select"
      ) {
        return true;
      }
      if (element.isContentEditable) return true;
      return false;
    };

    const handleKeyDown = (event) => {
      if (isInteractiveElement(event.target)) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        if (!filteredNotes.length) return;
        event.preventDefault();
        const allIds = filteredNotes
          .map((note) => getNoteId(note))
          .filter(Boolean);
        setSelectionMode(true);
        setSelectedNoteIds(allIds);
        setLastSelectedIndex(allIds.length ? allIds.length - 1 : null);
        return;
      }

      if (event.key === "Escape") {
        if (selectionMode || selectedNoteIds.length) {
          event.preventDefault();
          setSelectedNoteIds([]);
          setSelectionMode(false);
          setLastSelectedIndex(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredNotes, selectionMode, selectedNoteIds.length]);

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
    if (!moveNotebookModalOpen) return;
    const validTargets = new Set([
      "uncategorized",
      ...notebooks.map((notebook) => notebook.id),
    ]);

    setSelectedNotebookTargetId((previous) => {
      if (previous && validTargets.has(previous)) {
        return previous;
      }
      if (
        activeNotebookId &&
        activeNotebookId !== "all" &&
        validTargets.has(activeNotebookId)
      ) {
        return activeNotebookId;
      }
      return "uncategorized";
    });
  }, [moveNotebookModalOpen, notebooks, activeNotebookId]);

  useEffect(() => {
    if (!a11yMessage) return undefined;
    window.clearTimeout(liveMessageTimeoutRef.current ?? undefined);
    liveMessageTimeoutRef.current = window.setTimeout(() => {
      setA11yMessage("");
    }, 3200);

    return () => {
      window.clearTimeout(liveMessageTimeoutRef.current ?? undefined);
    };
  }, [a11yMessage]);

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
        <Navbar
          onMobileFilterClick={openDrawer}
          defaultNotebookId={
            activeNotebookId &&
            activeNotebookId !== "all" &&
            activeNotebookId !== "uncategorized"
              ? activeNotebookId
              : null
          }
        />

        {isRateLimited && (
          <RateLimitedUI onDismiss={() => setIsRateLimited(false)} />
        )}

        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {a11yMessage}
        </div>

        <main id="main-content" tabIndex={-1} className="flex-1 w-full">
          <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8">
            <NotesStats
              notes={notes}
              loading={loading || isFetchingNotes}
              tagStats={tagInsights}
            />

            <section className="rounded-2xl border border-base-300/60 bg-base-100/80 p-4 shadow-sm backdrop-blur supports-[backdrop-filter:blur(0px)]:bg-base-100/70">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <FolderIcon className="size-5 text-primary" />
                  <div>
                    <h2 className="text-base font-semibold leading-tight">
                      Notebooks
                    </h2>
                    <p className="text-xs text-base-content/60">
                      Organize notes into folders and switch views quickly.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm gap-2"
                  onClick={openCreateNotebook}
                >
                  <FolderPlusIcon className="size-4" />
                  New notebook
                </button>
              </div>

              <div className="mt-4">
                {notebooksLoading ? (
                  <div className="flex gap-3">
                    {[1, 2, 3].map((key) => (
                      <div
                        key={key}
                        className="h-12 w-32 animate-pulse rounded-xl bg-base-200"
                      />
                    ))}
                  </div>
                ) : notebooksError ? (
                  <div className="alert alert-error">
                    <AlertTriangleIcon className="size-5" />
                    <span className="text-sm">
                      Unable to load notebooks. Try refreshing.
                    </span>
                  </div>
                ) : notebooks.length === 0 && !uncategorizedNoteCount ? (
                  <div className="rounded-xl bg-base-200/70 px-4 py-3 text-sm text-base-content/70">
                    You haven&apos;t created any notebooks yet. Create one to
                    start grouping related notes.
                  </div>
                ) : (
                  <div
                    className="flex flex-wrap gap-3 pb-1"
                    role="tablist"
                    aria-label="Notebooks"
                  >
                    <NotebookDropZone notebookId="all" disabled={customizeMode}>
                      {({ setNodeRef, isOver }) => (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeNotebookId === "all"}
                          className={`btn btn-sm h-auto min-h-[2.5rem] flex-shrink-0 rounded-xl px-4 ${
                            activeNotebookId === "all"
                              ? "btn-primary"
                              : "btn-outline"
                          } ${
                            isOver
                              ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-base-100"
                              : ""
                          }`}
                          onClick={() => handleSelectNotebook("all")}
                          ref={setNodeRef}
                        >
                          <span className="flex items-center gap-2">
                            <span>All notes</span>
                            <span className="badge badge-sm">
                              {totalNotebookCount}
                            </span>
                          </span>
                        </button>
                      )}
                    </NotebookDropZone>
                    <NotebookDropZone
                      notebookId="uncategorized"
                      disabled={customizeMode}
                    >
                      {({ setNodeRef, isOver }) => (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeNotebookId === "uncategorized"}
                          className={`btn btn-sm h-auto min-h-[2.5rem] flex-shrink-0 rounded-xl px-4 ${
                            activeNotebookId === "uncategorized"
                              ? "btn-primary"
                              : "btn-outline"
                          } ${
                            isOver
                              ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-base-100"
                              : ""
                          }`}
                          onClick={() => handleSelectNotebook("uncategorized")}
                          ref={setNodeRef}
                        >
                          <span className="flex items-center gap-2">
                            <span>Uncategorized</span>
                            <span className="badge badge-sm">
                              {uncategorizedNoteCount}
                            </span>
                          </span>
                        </button>
                      )}
                    </NotebookDropZone>
                    {notebooks.map((notebook) => {
                      const isActive = activeNotebookId === notebook.id;
                      const hasColor =
                        typeof notebook.color === "string" &&
                        notebook.color.length > 0;
                      const IconComponent =
                        (notebook.icon &&
                          notebookIconComponents[notebook.icon]) ??
                        NotebookIcon;
                      return (
                        <NotebookDropZone
                          key={notebook.id}
                          notebookId={notebook.id}
                          disabled={customizeMode}
                        >
                          {({ setNodeRef, isOver }) => (
                            <div className="relative flex-shrink-0">
                              <button
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                className={`btn btn-sm h-auto min-h-[2.5rem] rounded-xl px-4 pr-10 ${
                                  isActive ? "btn-primary" : "btn-outline"
                                } ${
                                  isOver
                                    ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-base-100"
                                    : ""
                                }`}
                                onClick={() =>
                                  handleSelectNotebook(notebook.id)
                                }
                                ref={setNodeRef}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="flex items-center gap-2">
                                    {hasColor ? (
                                      <span
                                        className="size-2.5 rounded-full border border-base-100/60 shadow-sm"
                                        style={{
                                          backgroundColor: notebook.color,
                                        }}
                                        aria-hidden="true"
                                      />
                                    ) : null}
                                    <IconComponent
                                      className="size-4"
                                      style={
                                        hasColor
                                          ? { color: notebook.color }
                                          : undefined
                                      }
                                      aria-hidden="true"
                                    />
                                    <span className="truncate max-w-[8rem]">
                                      {notebook.name}
                                    </span>
                                  </span>
                                  <span className="badge badge-sm">
                                    {notebook.noteCount ?? 0}
                                  </span>
                                </span>
                              </button>
                              <div className="dropdown dropdown-end absolute right-1 top-1">
                                <button
                                  type="button"
                                  tabIndex={0}
                                  className="btn btn-ghost btn-xs btn-circle"
                                >
                                  <MoreVerticalIcon className="size-3.5" />
                                </button>
                                <ul className="dropdown-content menu menu-xs rounded-box bg-base-100 p-2 shadow-lg">
                                  <li>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openRenameNotebook(notebook)
                                      }
                                    >
                                      <PencilLineIcon className="size-3.5" />
                                      Rename
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openDeleteNotebook(notebook)
                                      }
                                    >
                                      <Trash2Icon className="size-3.5" />
                                      Delete
                                    </button>
                                  </li>
                                </ul>
                              </div>
                            </div>
                          )}
                        </NotebookDropZone>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

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
                  onMoveNotebook={handleBulkMoveNotebook}
                  onDelete={handleBulkDelete}
                  busy={bulkActionLoading}
                  notebookOptions={notebooks}
                  onQuickMoveNotebook={handleQuickMoveNotebook}
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
                      Drag cards to reorder. Changes save automatically when you
                      drop a note.
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
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragCancel={handleDragCancel}
                onDragEnd={handleDragEnd}
              >
                {customizeMode ? (
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
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredNotes.map((note) => {
                      const id = getNoteId(note);
                      if (!id) return null;
                      const isSelected = selectedNoteIdSet.has(id);
                      return (
                        <DraggableBoardNote
                          key={id}
                          note={note}
                          selectionMode={selectionMode}
                          customizeMode={customizeMode}
                          selected={isSelected}
                          onSelectionChange={handleNoteSelectionChange}
                          onTagClick={
                            selectionMode ? undefined : toggleTagSelection
                          }
                          selectedTags={selectedTags}
                        />
                      );
                    })}
                  </div>
                )}
                <DragOverlay dropAnimation={dropAnimation}>
                  {activeDragNote ? (
                    <NoteCard
                      note={activeDragNote}
                      customizeMode={customizeMode}
                      selectionMode={selectionMode}
                      selected={
                        selectionMode &&
                        selectedNoteIdSet.has(getNoteId(activeDragNote))
                      }
                      selectedTags={selectedTags}
                      onTagClick={
                        selectionMode ? undefined : toggleTagSelection
                      }
                      dragging
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
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
              notes.length === 0 && (
                <NotesNotFound createLinkState={createPageState} />
              )}
          </section>
        </main>

        {!drawerOpen && (
          <Link
            to="/create"
            state={createPageState}
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

      {notebookFormState && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4 py-10"
          role="dialog"
          aria-modal="true"
          onClick={closeNotebookForm}
        >
          <form
            className="w-full max-w-lg rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleNotebookFormSubmit}
          >
            <h3 className="text-lg font-semibold">
              {notebookFormState.mode === "edit"
                ? "Rename notebook"
                : "Create a notebook"}
            </h3>
            <p className="mt-1 text-sm text-base-content/60">
              {notebookFormState.mode === "edit"
                ? "Update the name to keep your notebooks organized."
                : "Group related notes together for quick access."}
            </p>
            <label className="form-control mt-4">
              <span className="label">
                <span className="label-text">Notebook name</span>
              </span>
              <input
                type="text"
                value={notebookNameInput}
                onChange={(event) => setNotebookNameInput(event.target.value)}
                className="input input-bordered"
                placeholder="e.g. Product ideas"
                required
                autoFocus
              />
            </label>
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-base-content">
                  Color <span className="text-base-content/60">(optional)</span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => setNotebookColorInput(null)}
                  disabled={!notebookColorInput}
                >
                  Clear color
                </button>
              </div>
              <p className="mt-1 text-xs text-base-content/60">
                Highlight this notebook with a color accent.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {NOTEBOOK_COLORS.map((option) => {
                  const isSelected = notebookColorInput === option.value;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setNotebookColorInput(option.value)}
                      aria-pressed={isSelected}
                      aria-label={`${option.label} color`}
                      className={`relative flex size-9 items-center justify-center rounded-full border border-white/50 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 ${
                        isSelected
                          ? "ring-2 ring-primary/70 ring-offset-2 ring-offset-base-100"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: option.value }}
                    >
                      {isSelected ? (
                        <CheckIcon
                          className="size-4"
                          style={{ color: option.textColor }}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-base-content">
                  Icon <span className="text-base-content/60">(optional)</span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => setNotebookIconInput(null)}
                  disabled={!notebookIconInput}
                >
                  Clear icon
                </button>
              </div>
              <p className="mt-1 text-xs text-base-content/60">
                Icons help notebooks stand out across the workspace.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {NOTEBOOK_ICONS.map((option) => {
                  const isSelected = notebookIconInput === option.name;
                  const IconComponent =
                    notebookIconComponents[option.name] ?? NotebookIcon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      title={option.label}
                      onClick={() => setNotebookIconInput(option.name)}
                      aria-pressed={isSelected}
                      className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 ${
                        isSelected
                          ? "border-primary/80 bg-primary/10 text-primary"
                          : "border-base-300/80 text-base-content/70 hover:border-base-400 hover:text-base-content"
                      }`}
                    >
                      <IconComponent className="size-5" aria-hidden="true" />
                      <span className="truncate text-center">
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closeNotebookForm}
                disabled={notebookFormLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={notebookFormLoading}
              >
                {notebookFormLoading ? "Saving..." : "Save notebook"}
              </button>
            </div>
          </form>
        </div>
      )}

      {notebookDeleteState && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4 py-10"
          role="dialog"
          aria-modal="true"
          onClick={closeNotebookDelete}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-warning/20 p-2 text-warning">
                <AlertTriangleIcon className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Delete notebook?</h3>
                <p className="mt-1 text-sm text-base-content/70">
                  {notebookDeleteState.notebook?.noteCount
                    ? `${notebookDeleteState.notebook.noteCount} notes are inside this notebook.`
                    : "This notebook is empty."}
                </p>
              </div>
            </div>

            {notebookDeleteState.notebook?.noteCount ? (
              <div className="mt-4 space-y-3">
                <label className="flex items-start gap-3 rounded-xl border border-base-300/60 bg-base-200/70 px-4 py-3">
                  <input
                    type="radio"
                    name="notebook-delete-mode"
                    className="radio radio-sm"
                    checked={notebookDeleteState.mode === "move"}
                    onChange={() =>
                      setNotebookDeleteState((prev) =>
                        prev ? { ...prev, mode: "move" } : prev
                      )
                    }
                  />
                  <div>
                    <p className="font-medium">Move notes elsewhere</p>
                    <p className="text-sm text-base-content/70">
                      Keep note content by moving it to another notebook or
                      uncategorized.
                    </p>
                    <select
                      className="select select-bordered select-sm mt-2 w-full max-w-xs"
                      value={
                        notebookDeleteState.targetNotebookId ?? "uncategorized"
                      }
                      onChange={(event) =>
                        setNotebookDeleteState((prev) =>
                          prev
                            ? {
                                ...prev,
                                targetNotebookId: event.target.value,
                              }
                            : prev
                        )
                      }
                      disabled={notebookDeleteState.mode !== "move"}
                    >
                      <option value="uncategorized">Uncategorized</option>
                      {notebooks
                        .filter(
                          (entry) =>
                            entry.id !== notebookDeleteState.notebook?.id
                        )
                        .map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-xl border border-base-300/60 bg-base-200/70 px-4 py-3">
                  <input
                    type="radio"
                    name="notebook-delete-mode"
                    className="radio radio-sm"
                    checked={notebookDeleteState.mode === "delete"}
                    onChange={() =>
                      setNotebookDeleteState((prev) =>
                        prev ? { ...prev, mode: "delete" } : prev
                      )
                    }
                  />
                  <div>
                    <p className="font-medium text-error">Delete notes</p>
                    <p className="text-sm text-base-content/70">
                      Permanently remove the notebook and all notes inside it.
                    </p>
                    <label className="mt-2 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={Boolean(
                          notebookDeleteState.deleteCollaborative
                        )}
                        onChange={(event) =>
                          setNotebookDeleteState((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  deleteCollaborative: event.target.checked,
                                }
                              : prev
                          )
                        }
                        disabled={notebookDeleteState.mode !== "delete"}
                      />
                      <span>
                        Also delete collaborative documents for these notes
                      </span>
                    </label>
                  </div>
                </label>
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closeNotebookDelete}
                disabled={notebookDeleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-error btn-sm"
                onClick={confirmNotebookDelete}
                disabled={notebookDeleteLoading}
              >
                {notebookDeleteLoading ? "Deleting..." : "Delete notebook"}
              </button>
            </div>
          </div>
        </div>
      )}

      {moveNotebookModalOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4 py-10"
          role="dialog"
          aria-modal="true"
          onClick={() => setMoveNotebookModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Move notes to a notebook</h3>
            <p className="mt-1 text-sm text-base-content/60">
              Choose the destination notebook. Notes moved to Uncategorized keep
              their content intact.
            </p>
            <div className="mt-4 space-y-2">
              <select
                className="select select-bordered w-full"
                value={selectedNotebookTargetId}
                onChange={(event) =>
                  setSelectedNotebookTargetId(event.target.value)
                }
              >
                <option value="uncategorized">Uncategorized</option>
                {notebooks.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setMoveNotebookModalOpen(false)}
                disabled={bulkActionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={submitBulkMoveNotebook}
                disabled={bulkActionLoading}
              >
                Move notes
              </button>
            </div>
          </div>
        </div>
      )}

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
