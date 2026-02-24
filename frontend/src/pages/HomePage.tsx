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
  FilterIcon,
  LightbulbIcon,
  ListTodoIcon,
  NotebookIcon,
  NotebookPenIcon,
  PaletteIcon,
  PlusIcon,
  RocketIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
  TargetIcon,
  WorkflowIcon,
  BookOpenIcon,
  LayersIcon,
} from "lucide-react";
import { NOTEBOOK_COLORS, NOTEBOOK_ICONS } from "@shared/notebookOptions";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import Toolbar from "../Components/Toolbar";
import RateLimitedUI from "../Components/RateLimitedUI";
import api from "../lib/axios";
import { toast } from "sonner";
import NoteCard from "../Components/NoteCard";
import NotesNotFound from "../Components/NotesNotFound";
import NoteSkeleton from "../Components/NoteSkeleton";
import { type TagStats } from "../Components/NotesStats";
import { countWords, formatTagLabel, normalizeTag } from "../lib/Utils";
import TemplateGalleryModal from "../Components/TemplateGalleryModal";
import NotebookTemplateGalleryModal from "../Components/NotebookTemplateGalleryModal";
import SaveNotebookTemplateDialog from "../Components/SaveNotebookTemplateDialog";
import BulkActionsBar from "../Components/BulkActionsBar";
import TagInput from "../Components/TagInput";
import ConfirmDialog from "../Components/ConfirmDialog";
import { useCommandPalette } from "../contexts/CommandPaletteContext";
import NotebookShareDialog from "../Components/NotebookShareDialog";
import NotebookAnalyticsDialog from "../Components/NotebookAnalyticsDialog";
import SavedNotebookQueryDialog from "../Components/SavedNotebookQueryDialog";
import NotebookPublishDialog from "../Components/NotebookPublishDialog";
import NotebookHistoryDialog from "../Components/NotebookHistoryDialog";
import NotebookInsightsDrawer from "../Components/NotebookInsightsDrawer";

const FILTER_STORAGE_KEY = "notesboard-filters-v1";
const NOTEBOOK_ANALYTICS_ENABLED =
  (import.meta.env.VITE_ENABLE_NOTEBOOK_ANALYTICS ?? "false") === "true";

const mergeOrder = (primary: any[] = [], fallback: any[] = []) => {
  const fallbackStrings = new Set(
    fallback
      .map((id: any) =>
        typeof id === "string" ? id : (id?.toString?.() ?? null),
      )
      .filter(Boolean),
  );

  const result: string[] = [];
  const seen = new Set<string>();

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
  return typeof rawId === "string" ? rawId : (rawId?.toString?.() ?? null);
};

function SortableNoteCard({
  note,
  selectedTags,
  onTagClick,
  onOpenNoteInsights,
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

  const style: any = {
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
      onOpenInsights={onOpenNoteInsights}
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

const normalizeSortDirection = (value) => {
  if (typeof value === "number") {
    return value >= 0 ? "asc" : "desc";
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["asc", "ascending", "1", "true"].includes(normalized)) {
      return "asc";
    }
    if (["desc", "descending", "-1", "false"].includes(normalized)) {
      return "desc";
    }
  }
  return null;
};

const sortOrderToSavedSort = (order) => {
  switch (order) {
    case "oldest":
      return { updatedAt: "asc" };
    case "alphabetical":
      return { title: "asc" };
    case "newest":
    case "updated":
      return { updatedAt: "desc" };
    default:
      return null;
  }
};

const savedSortToSortOrder = (sortSpec) => {
  if (!sortSpec || typeof sortSpec !== "object") {
    return "newest";
  }

  if (Object.prototype.hasOwnProperty.call(sortSpec, "title")) {
    return "alphabetical";
  }

  if (Object.prototype.hasOwnProperty.call(sortSpec, "updatedAt")) {
    const direction = normalizeSortDirection(sortSpec.updatedAt);
    if (direction === "asc") {
      return "oldest";
    }
    return "newest";
  }

  return "newest";
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
  onOpenNoteInsights,
}) {
  const noteId = getNoteId(note);
  const disabled = customizeMode;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: noteId,
      data: { type: "note", noteId },
      disabled,
    });

  const dragStyleRaw: any = transform
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
      onOpenInsights={onOpenNoteInsights}
    />
  );
}

function HomePage() {
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [minWords, setMinWords] = useState(0);
  const [sortOrder, setSortOrder] = useState("newest");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [customOrderOverride, setCustomOrderOverride] = useState<string[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeNotebookId, setActiveNotebookId] = useState("all");
  const [notebookFormState, setNotebookFormState] = useState<any>(null);
  const [notebookNameInput, setNotebookNameInput] = useState("");
  const [notebookColorInput, setNotebookColorInput] = useState<string | null>(
    null,
  );
  const [notebookIconInput, setNotebookIconInput] = useState<string | null>(
    null,
  );
  const [notebookDeleteState, setNotebookDeleteState] = useState<any>(null);
  const [moveNotebookModalOpen, setMoveNotebookModalOpen] = useState(false);
  const [selectedNotebookTargetId, setSelectedNotebookTargetId] =
    useState("uncategorized");
  const [notebookFormLoading, setNotebookFormLoading] = useState(false);
  const [notebookDeleteLoading, setNotebookDeleteLoading] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null,
  );
  const [activeDragNoteIds, setActiveDragNoteIds] = useState<string[]>([]);
  const [a11yMessage, setA11yMessage] = useState("");
  const [shareNotebookState, setShareNotebookState] = useState<any>(null);
  const [analyticsNotebook, setAnalyticsNotebook] = useState<any>(null);
  const [notebookTemplateModalOpen, setNotebookTemplateModalOpen] =
    useState(false);
  const [selectedNotebookTemplateId, setSelectedNotebookTemplateId] = useState<
    string | null
  >(null);
  const [saveTemplateState, setSaveTemplateState] = useState<any>({
    open: false,
    notebook: null,
  });
  const [notebookTemplateImporting, setNotebookTemplateImporting] =
    useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(
    null,
  );
  const [saveTemplateSubmitting, setSaveTemplateSubmitting] = useState(false);
  const [savedQueryDialogOpen, setSavedQueryDialogOpen] = useState(false);
  const [appliedSavedQuery, setAppliedSavedQuery] = useState<any>(null);
  const [publishNotebook, setPublishNotebook] = useState<any>(null);
  const [historyNotebook, setHistoryNotebook] = useState<any>(null);
  const [insightsNote, setInsightsNote] = useState<any>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedFilters = useRef(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const previousSortRef = useRef("newest");
  const liveMessageTimeoutRef = useRef<any>(null);
  const layoutMutationTimeoutRef = useRef<any>(null);
  const lastLayoutMutationRef = useRef(0);
  const applyingSavedQueryRef = useRef(false);
  const queryClient = useQueryClient();
  const invalidateNotesCaches = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["tag-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["note-layout"] }),
        queryClient.invalidateQueries({ queryKey: ["notebooks"] }),
      ]),
    [queryClient],
  );
  const openPublishNotebook = useCallback((notebook) => {
    if (notebook) {
      setPublishNotebook(notebook);
    }
  }, []);
  const closePublishNotebook = useCallback(() => {
    setPublishNotebook(null);
  }, []);
  const openHistoryNotebook = useCallback((notebook) => {
    if (notebook) {
      setHistoryNotebook(notebook);
    }
  }, []);
  const closeHistoryNotebook = useCallback(() => {
    setHistoryNotebook(null);
  }, []);
  const openNoteInsights = useCallback((note) => {
    if (note) {
      setInsightsNote(note);
    }
  }, []);
  const closeNoteInsights = useCallback(() => {
    setInsightsNote(null);
  }, []);
  const handlePublishingChange = useCallback(
    async ({ notebookId: updatedNotebookId }: any = {}) => {
      await invalidateNotesCaches();
      if (updatedNotebookId) {
        await queryClient.invalidateQueries({
          queryKey: ["notebook-publish", updatedNotebookId],
        });
      }
    },
    [invalidateNotesCaches, queryClient],
  );
  const handleHistoryUndo = useCallback(
    async ({ notebookId: historyNotebookId }: any = {}) => {
      await invalidateNotesCaches();
      await queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          Array.isArray(queryKey) &&
          queryKey[0] === "notebook-history" &&
          (!historyNotebookId || queryKey.includes(historyNotebookId)),
      });
    },
    [invalidateNotesCaches, queryClient],
  );
  const handleSelectNotebook = useCallback(
    (nextId) => {
      const normalized =
        typeof nextId === "string" && nextId.trim().length ? nextId : "all";
      setActiveNotebookId(normalized);
      setSelectionMode(false);
      setSelectedNoteIds([]);
      setCustomOrderOverride([]);
      setAppliedSavedQuery(null);
      if (customizeMode) {
        setCustomizeMode(false);
        if (previousSortRef.current && previousSortRef.current !== "custom") {
          setSortOrder(previousSortRef.current);
        } else if (sortOrder === "custom") {
          setSortOrder("newest");
        }
      }
    },
    [customizeMode, sortOrder],
  );
  const handleViewNotebookFromInsights = useCallback(
    (notebookId) => {
      if (!notebookId) return;
      handleSelectNotebook(notebookId);
      closeNoteInsights();
    },
    [closeNoteInsights, handleSelectNotebook],
  );
  const handleApplySmartView = useCallback(
    ({ search = "", matchedTag = null, tags = [], noteCount = null }: any) => {
      const normalizedTags = Array.isArray(tags)
        ? tags
        : matchedTag
          ? [matchedTag]
          : [];
      setSearchQuery(search);
      setSelectedTags(
        normalizedTags.map((tag) => normalizeTag(tag)).filter(Boolean),
      );
      setMinWords(0);
      setSortOrder("newest");
      setActiveTab("all");
      setAppliedSavedQuery(null);
      setSelectionMode(false);
      setSelectedNoteIds([]);
      toast.success(
        noteCount
          ? `Smart view applied to ${noteCount} notes`
          : "Smart view applied",
      );
      closeNoteInsights();
    },
    [
      closeNoteInsights,
      setActiveTab,
      setSelectionMode,
      setSelectedNoteIds,
      setSortOrder,
      setSearchQuery,
      setSelectedTags,
      setMinWords,
      setAppliedSavedQuery,
    ],
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
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 429) {
        return false;
      }
      return failureCount < 1;
    },
  });

  useEffect(() => {
    if (notesQuery.isSuccess) {
      setIsRateLimited(false);
    }
  }, [notesQuery.isSuccess]);

  useEffect(() => {
    if (!notesQuery.isError) return;
    const error = notesQuery.error as any;
    console.error("Error fetching notes", error);
    if (error?.response?.status === 429) {
      setIsRateLimited(true);
    } else if (error?.response?.status === 404 && activeNotebookId !== "all") {
      toast.error("Notebook not found. Showing all notes.");
      setActiveNotebookId("all");
    } else {
      toast.error("Failed to load Notes");
    }
  }, [notesQuery.isError, notesQuery.error, activeNotebookId]);

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
            typeof id === "string" ? id : id?.toString?.(),
          )
        : [];
      return noteIds.filter(Boolean);
    },
    staleTime: 300_000,
  });

  const notes = useMemo(
    () => (Array.isArray(notesQuery.data) ? notesQuery.data : []),
    [notesQuery.data],
  );
  useEffect(() => {
    if (!insightsNote) return;
    const noteId = getNoteId(insightsNote);
    if (!noteId) return;
    const exists = notes.some((note) => getNoteId(note) === noteId);
    if (!exists) {
      setInsightsNote(null);
    }
  }, [insightsNote, notes]);
  const loading = notesQuery.isLoading;
  const layoutOrder = useMemo(() => {
    return Array.isArray(layoutQuery.data) ? layoutQuery.data : [];
  }, [layoutQuery.data]);
  const allNoteIds = useMemo(
    () =>
      notes.map((note) =>
        typeof note._id === "string" ? note._id : note._id?.toString?.(),
      ),
    [notes],
  );
  const baseCustomOrder =
    customOrderOverride.length > 0 ? customOrderOverride : layoutOrder;
  const effectiveCustomOrder = useMemo(
    () => mergeOrder(baseCustomOrder, allNoteIds),
    [baseCustomOrder, allNoteIds],
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

  const {
    data: notebookTemplates = [],
    isLoading: notebookTemplatesLoading,
    isFetching: notebookTemplatesFetching,
    refetch: refetchNotebookTemplates,
  } = useQuery({
    queryKey: ["notebook-templates"],
    queryFn: async () => {
      const response = await api.get("/templates");
      return Array.isArray(response.data) ? response.data : [];
    },
    staleTime: 60_000,
  });

  const {
    data: notebookTemplateDetail,
    isFetching: notebookTemplateDetailLoading,
  } = useQuery({
    queryKey: ["notebook-template-detail", selectedNotebookTemplateId],
    queryFn: async () => {
      const response = await api.get(
        `/templates/${selectedNotebookTemplateId}`,
      );
      return response.data;
    },
    enabled: notebookTemplateModalOpen && Boolean(selectedNotebookTemplateId),
  });

  useEffect(() => {
    if (!notebookTemplateModalOpen) {
      setSelectedNotebookTemplateId(null);
      return;
    }

    if (!Array.isArray(notebookTemplates) || notebookTemplates.length === 0) {
      setSelectedNotebookTemplateId(null);
      return;
    }

    const exists = notebookTemplates.some(
      (template) => template.id === selectedNotebookTemplateId,
    );

    if (!exists) {
      setSelectedNotebookTemplateId(notebookTemplates[0]?.id ?? null);
    }
  }, [
    notebookTemplateModalOpen,
    notebookTemplates,
    selectedNotebookTemplateId,
  ]);

  useEffect(() => {
    if (!notebookTemplateModalOpen) return;
    refetchNotebookTemplates();
  }, [notebookTemplateModalOpen, refetchNotebookTemplates]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
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
    [],
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

  const savedQueriesEnabled =
    Boolean(activeNotebookId) &&
    activeNotebookId !== "all" &&
    activeNotebookId !== "uncategorized";

  const savedNotebookQueriesQuery = useQuery({
    queryKey: ["notebook-saved-queries", activeNotebookId],
    queryFn: async () => {
      const response = await api.get(
        `/notebooks/${activeNotebookId}/saved-queries`,
      );
      const list = Array.isArray(response.data?.queries)
        ? response.data.queries
        : [];
      return list;
    },
    enabled: savedQueriesEnabled,
    staleTime: 60_000,
  });

  const savedNotebookQueries = useMemo(() => {
    if (!savedQueriesEnabled) return [];
    if (Array.isArray(savedNotebookQueriesQuery.data)) {
      return savedNotebookQueriesQuery.data;
    }
    return [];
  }, [savedNotebookQueriesQuery.data, savedQueriesEnabled]);

  const createSavedNotebookQueryMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!savedQueriesEnabled) return null;
      const response = await api.post(
        `/notebooks/${activeNotebookId}/saved-queries`,
        payload,
      );
      return response.data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ["notebook-saved-queries", activeNotebookId],
      });
      if (data?.name) {
        toast.success(`Saved view "${data.name}" ready to use`);
      } else {
        toast.success("Saved view created");
      }
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ??
        "Unable to save this view. Try a different name.";
      toast.error(message);
    },
  });

  const deleteSavedNotebookQueryMutation = useMutation({
    mutationFn: async (queryId: any) => {
      if (!savedQueriesEnabled || !queryId) return null;
      await api.delete(
        `/notebooks/${activeNotebookId}/saved-queries/${queryId}`,
      );
      return queryId;
    },
    onSuccess: async (queryId) => {
      await queryClient.invalidateQueries({
        queryKey: ["notebook-saved-queries", activeNotebookId],
      });
      if (appliedSavedQuery?.id === queryId) {
        setAppliedSavedQuery(null);
      }
      toast.success("Saved view deleted");
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ?? "Unable to delete this saved view";
      toast.error(message);
    },
  });

  const touchSavedNotebookQueryMutation = useMutation({
    mutationFn: async ({ notebookId, queryId }: any) => {
      if (!notebookId || !queryId) return null;
      await api.post(`/notebooks/${notebookId}/saved-queries/${queryId}/use`);
      return queryId;
    },
    onError: (error: any) => {
      console.warn("Failed to update saved query usage", error);
    },
  });

  const notebooks = useMemo(
    () => notebooksQuery.data?.notebooks ?? [],
    [notebooksQuery.data],
  );
  const uncategorizedNoteCount = notebooksQuery.data?.uncategorizedCount ?? 0;
  const totalNotebookCount = useMemo(() => {
    const notebookTotal = notebooks.reduce(
      (sum, notebook) => sum + (Number(notebook.noteCount) || 0),
      0,
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
        if (normalizedTarget === "uncategorized") {
          await api.post("/notes/bulk", {
            action: "moveNotebook",
            noteIds: ids,
            notebookId: normalizedTarget,
          });
        } else {
          await api.post(`/notebooks/${normalizedTarget}/move`, {
            noteIds: ids,
          });
        }

        const notebookLabel =
          normalizedTarget === "uncategorized"
            ? "Uncategorized"
            : (notebooks.find((entry) => entry.id === normalizedTarget)?.name ??
              "notebook");

        const message =
          ids.length === 1
            ? `Moved note to ${notebookLabel}`
            : `Moved ${ids.length} notes to ${notebookLabel}`;

        toast.success(message);
        setA11yMessage(message);
        setSelectedNoteIds((previous) =>
          previous.filter((value) => !ids.includes(value)),
        );

        await invalidateNotesCaches();
      } catch (error: any) {
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
    [invalidateNotesCaches, notebooks],
  );

  const handleMoveNoteToNotebook = useCallback(
    async (noteId, targetNotebookId) => {
      if (!noteId || !targetNotebookId) {
        return;
      }
      await moveNotesToNotebook({
        noteIds: [noteId],
        targetNotebookId,
        skipLoader: true,
      });
      closeNoteInsights();
    },
    [closeNoteInsights, moveNotesToNotebook],
  );

  const updateLayoutMutation = useMutation({
    mutationFn: async ({ noteIds, contextId }: any) => {
      const payload: any = { noteIds };
      if (contextId && contextId !== "all") {
        payload.notebookId = contextId;
      }

      const response = await api.put("/notes/layout", payload);
      const savedIds = Array.isArray(response.data?.noteIds)
        ? response.data.noteIds.map((id) =>
            typeof id === "string" ? id : id?.toString?.(),
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
        data.noteIds,
      );
    },
    onError: (error: any) => {
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
          : (active?.id?.toString?.() ?? null);
      if (!activeId) return;

      // Batch state updates in a single frame
      requestAnimationFrame(() => {
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
      });
    },
    [selectionMode, selectedNoteIds],
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
          : (active?.id?.toString?.() ?? null);

      setActiveDragId(null);
      setActiveDragNoteIds([]);

      if (!activeId) {
        return;
      }

      const overId =
        typeof over?.id === "string"
          ? over.id
          : (over?.id?.toString?.() ?? null);

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

      // Use requestAnimationFrame to batch DOM updates
      requestAnimationFrame(() => {
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

          // Debounce mutations: Only allow one mutation every 500ms
          const now = Date.now();
          if (now - lastLayoutMutationRef.current < 500) {
            // Clear existing timeout
            if (layoutMutationTimeoutRef.current) {
              clearTimeout(layoutMutationTimeoutRef.current);
            }
            // Schedule mutation for later
            layoutMutationTimeoutRef.current = setTimeout(() => {
              lastLayoutMutationRef.current = Date.now();
              updateLayoutMutation.mutate({
                noteIds: reordered,
                contextId: activeNotebookId ?? "all",
              });
            }, 500);
          } else {
            // Execute immediately if enough time has passed
            lastLayoutMutationRef.current = now;
            updateLayoutMutation.mutate({
              noteIds: reordered,
              contextId: activeNotebookId ?? "all",
            });
          }

          return reordered;
        });
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
    ],
  );

  const tagStatsQuery = useQuery<TagStats>({
    queryKey: ["tag-stats"],
    queryFn: async (): Promise<TagStats> => {
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
  });

  useEffect(() => {
    if (tagStatsQuery.isError) {
      console.error("Error fetching tag stats", tagStatsQuery.error);
    }
  }, [tagStatsQuery.isError, tagStatsQuery.error]);

  const tagInsights = tagStatsQuery.data ?? undefined;
  const availableTags = useMemo(() => {
    if (tagInsights?.tags?.length) {
      return Array.from(
        new Set(
          tagInsights.tags
            .map((entry) => normalizeTag(entry?._id))
            .filter(Boolean),
        ),
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
    enabled:
      selectionMode ||
      moveModalOpen ||
      templateModalOpen ||
      notebookTemplateModalOpen,
  });

  const boardOptions = useMemo(() => {
    return boardsQuery.data?.boards ?? [];
  }, [boardsQuery.data]);
  const defaultBoardId = boardsQuery.data?.defaultBoardId ?? null;

  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const response = await api.get("/workspaces");
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: notebookTemplateModalOpen,
    staleTime: 120_000,
  });

  const templateBoardOptions = useMemo(
    () =>
      boardOptions.map((board) => ({
        id: board.id,
        name: board.name,
        workspaceName: board.workspaceName ?? "",
      })),
    [boardOptions],
  );

  const templateWorkspaceOptions = useMemo(
    () =>
      Array.isArray(workspacesQuery.data)
        ? workspacesQuery.data.map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
          }))
        : [],
    [workspacesQuery.data],
  );
  useEffect(() => {
    if (hasInitializedFilters.current) return;
    if (typeof window === "undefined") return;

    const params = Object.fromEntries(searchParams.entries());
    let storedFilters: any = {};
    try {
      const raw = localStorage.getItem(FILTER_STORAGE_KEY);
      if (raw) {
        storedFilters = JSON.parse(raw);
      }
    } catch (error: any) {
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
      new Set(tagList.map((tag) => normalizeTag(tag)).filter(Boolean)),
    );
    setSelectedTags(normalizedTags);

    hasInitializedFilters.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!hasInitializedFilters.current) return;
    if (typeof window === "undefined") return;

    const params: Record<string, string> = {};
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
        }),
      );
    } catch (error: any) {
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

  useEffect(() => {
    if (!appliedSavedQuery) return;
    if (applyingSavedQueryRef.current) return;

    const savedSearch = (appliedSavedQuery?.query ?? "").trim();
    if (savedSearch !== searchQuery.trim()) {
      setAppliedSavedQuery(null);
      return;
    }

    const savedTags = Array.isArray(appliedSavedQuery?.filters?.tags)
      ? (Array.from(
          new Set(
            appliedSavedQuery.filters.tags
              .map((tag) => normalizeTag(tag))
              .filter(Boolean),
          ),
        ) as string[])
      : [];
    const currentTags = Array.from(
      new Set(selectedTags.map((tag) => normalizeTag(tag)).filter(Boolean)),
    ) as string[];
    const tagsMatch =
      savedTags.length === currentTags.length &&
      savedTags.every((tag) => currentTags.includes(tag));
    if (!tagsMatch) {
      setAppliedSavedQuery(null);
      return;
    }

    const normalizedSortOrder = sortOrder === "updated" ? "newest" : sortOrder;
    const savedOrder = savedSortToSortOrder(appliedSavedQuery?.sort);
    if (normalizedSortOrder !== savedOrder) {
      setAppliedSavedQuery(null);
      return;
    }

    const savedMinWords = Number(appliedSavedQuery?.filters?.minWords) || 0;
    if (savedMinWords !== (Number(minWords) || 0)) {
      setAppliedSavedQuery(null);
    }
  }, [
    appliedSavedQuery,
    applyingSavedQueryRef,
    minWords,
    searchQuery,
    selectedTags,
    sortOrder,
  ]);

  useEffect(() => {
    if (!savedQueriesEnabled && savedQueryDialogOpen) {
      setSavedQueryDialogOpen(false);
    }
  }, [savedQueriesEnabled, savedQueryDialogOpen]);

  const isFetchingNotes = notesQuery.isFetching;

  const closeDrawer = () => setDrawerOpen(false);
  const openDrawer = () => setDrawerOpen(true);

  const recentNotes = useMemo(
    () =>
      notes.filter((note) => {
        const createdAt = new Date(note.createdAt);
        return Date.now() - createdAt.getTime() <= 604_800_000; // 7 days
      }),
    [notes],
  );

  const longFormNotes = useMemo(
    () => notes.filter((note) => countWords(note.content) >= 150),
    [notes],
  );

  const shortNotes = useMemo(
    () => notes.filter((note) => countWords(note.content) <= 60),
    [notes],
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
    activeTab !== "all",
  );
  const filtersApplied = notebookFilterActive || hasGeneralFilters;

  const activeFilterChips = useMemo(() => {
    const chips: any[] = [];
    if (appliedSavedQuery) {
      chips.push({
        key: "saved-query",
        label: `Saved view: ${appliedSavedQuery.name ?? "Untitled"}`,
        onClear: () => setAppliedSavedQuery(null),
      });
    }
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
    appliedSavedQuery,
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
      (note) => countWords(note.content) >= Number(minWords),
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
              new Date(b.updatedAt ?? b.createdAt).getTime() -
              new Date(a.updatedAt ?? a.createdAt).getTime();
            if (fallback !== 0) {
              return fallback;
            }
            return (
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          })
        : [...byTags].sort((a, b) => {
            const pinPriority = Number(!!b.pinned) - Number(!!a.pinned);
            if (pinPriority !== 0) return pinPriority;
            if (sortOrder === "newest") {
              return (
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
              );
            }
            if (sortOrder === "oldest") {
              return (
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
              );
            }
            if (sortOrder === "alphabetical") {
              return a.title.localeCompare(b.title);
            }
            if (sortOrder === "updated") {
              return (
                new Date(b.updatedAt ?? b.createdAt).getTime() -
                new Date(a.updatedAt ?? a.createdAt).getTime()
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
    [selectedNoteIds],
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

  const pinnedCount = useMemo(
    () => notes.filter((n) => n.pinned).length,
    [notes],
  );
  const avgWords = useMemo(() => {
    if (!notes.length) return 0;
    const total = notes.reduce((sum, n) => sum + countWords(n.content), 0);
    return Math.round(total / notes.length);
  }, [notes]);

  const tagOptions = useMemo(() => {
    if (availableTags.length) {
      return Array.from(new Set(availableTags)).sort();
    }
    const tagSet = new Set<string>();
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
        : [...prev, normalized],
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
    setAppliedSavedQuery(null);
  };

  const selectionCount = selectedNoteIds.length;

  const handleNoteSelectionChange = useCallback(
    (noteId, checked, meta: any = {}) => {
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
    [filteredNotes, lastSelectedIndex, noteIndexLookup, selectionMode],
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
      } catch (error: any) {
        console.error("Bulk action failed", error);
        const message =
          error.response?.data?.message ?? "Failed to update selected notes";
        toast.error(message);
      } finally {
        setBulkActionLoading(false);
      }
    },
    [invalidateNotesCaches, selectedNoteIds, selectionCount],
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
    [moveNotesToNotebook, selectedNoteIds],
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

  const openNotebookTemplateGallery = useCallback(() => {
    setNotebookTemplateModalOpen(true);
  }, []);

  const closeNotebookTemplateGallery = useCallback(() => {
    setNotebookTemplateModalOpen(false);
  }, []);

  const handleNotebookTemplateSelect = useCallback((templateId) => {
    setSelectedNotebookTemplateId(templateId);
  }, []);

  const handleNotebookTemplateImport = useCallback(
    async (templateId, options = {}) => {
      if (!templateId) return;
      setNotebookTemplateImporting(true);
      try {
        const payload = options && typeof options === "object" ? options : {};
        const response = await api.post(
          `/templates/${templateId}/instantiate`,
          payload,
        );
        const createdNotebookId = response.data?.notebookId;
        const createdNotebookName = response.data?.name;
        toast.success(
          createdNotebookName
            ? `Created "${createdNotebookName}" from template`
            : "Notebook created from template",
        );
        closeNotebookTemplateGallery();
        if (createdNotebookId) {
          setActiveNotebookId(createdNotebookId);
        }
        await queryClient.invalidateQueries({ queryKey: ["notebooks"] });
        await queryClient.invalidateQueries({ queryKey: ["notes"] });
      } catch (error: any) {
        const message =
          error.response?.data?.message ?? "Failed to use notebook template";
        toast.error(message);
      } finally {
        setNotebookTemplateImporting(false);
      }
    },
    [closeNotebookTemplateGallery, queryClient],
  );

  const handleDeleteNotebookTemplate = useCallback(
    async (templateId) => {
      if (!templateId) return;
      setDeletingTemplateId(templateId);
      try {
        await api.delete(`/templates/${templateId}`);
        toast.success("Template deleted");
        setSelectedNotebookTemplateId((previous) =>
          previous === templateId ? null : previous,
        );
        queryClient.removeQueries({
          queryKey: ["notebook-template-detail", templateId],
        });
        await queryClient.invalidateQueries({
          queryKey: ["notebook-templates"],
        });
        await refetchNotebookTemplates();
      } catch (error: any) {
        const message =
          error.response?.data?.message ?? "Failed to delete template";
        toast.error(message);
      } finally {
        setDeletingTemplateId(null);
      }
    },
    [queryClient, refetchNotebookTemplates],
  );

  const openSaveNotebookTemplate = useCallback((notebook) => {
    if (!notebook) return;
    setSaveTemplateState({ open: true, notebook });
  }, []);

  const closeSaveNotebookTemplate = useCallback(() => {
    setSaveTemplateState({ open: false, notebook: null });
  }, []);

  const handleSaveNotebookTemplate = async ({ name, description, tags }) => {
    const notebook = saveTemplateState.notebook;
    if (!notebook) return;

    setSaveTemplateSubmitting(true);
    try {
      const response = await api.post(`/notebooks/${notebook.id}/templates`, {
        name,
        description,
        tags,
      });

      toast.success("Notebook saved as template");
      setSaveTemplateState({ open: false, notebook: null });
      await queryClient.invalidateQueries({
        queryKey: ["notebook-templates"],
      });

      if (notebookTemplateModalOpen) {
        await refetchNotebookTemplates();
      }

      if (response.data?.id) {
        setSelectedNotebookTemplateId(response.data.id);
      }
    } catch (error: any) {
      const message =
        error.response?.data?.message ?? "Failed to save notebook template";
      toast.error(message);
    } finally {
      setSaveTemplateSubmitting(false);
    }
  };

  const openSavedQueryDialog = useCallback(() => {
    if (!savedQueriesEnabled) return;
    setSavedQueryDialogOpen(true);
  }, [savedQueriesEnabled]);

  const closeSavedQueryDialog = useCallback(() => {
    setSavedQueryDialogOpen(false);
  }, []);

  const handleApplySavedQuery = useCallback(
    (savedQuery) => {
      if (!savedQuery) return;
      const normalizedTags = Array.isArray(savedQuery?.filters?.tags)
        ? (Array.from(
            new Set(
              savedQuery.filters.tags
                .map((tag) => normalizeTag(tag))
                .filter(Boolean),
            ),
          ) as string[])
        : [];

      const savedMinWords = Number(savedQuery?.filters?.minWords) || 0;
      const derivedSortOrder = savedSortToSortOrder(savedQuery?.sort);

      applyingSavedQueryRef.current = true;
      setSearchQuery(savedQuery?.query ?? "");
      setSelectedTags(normalizedTags);
      setMinWords(savedMinWords);
      setSortOrder(derivedSortOrder);
      setActiveTab("all");
      setSelectionMode(false);
      setSelectedNoteIds([]);
      setCustomOrderOverride([]);
      setAppliedSavedQuery(savedQuery);

      setTimeout(() => {
        applyingSavedQueryRef.current = false;
      }, 0);

      if (savedQueriesEnabled && savedQuery?.id) {
        touchSavedNotebookQueryMutation.mutate({
          notebookId: activeNotebookId,
          queryId: savedQuery.id,
        });
      }

      if (savedQuery?.name) {
        toast.success(`Applied saved view "${savedQuery.name}"`);
      }
    },
    [
      activeNotebookId,
      savedQueriesEnabled,
      setActiveTab,
      setMinWords,
      setSearchQuery,
      setSelectedNoteIds,
      setSelectedTags,
      setSortOrder,
      setCustomOrderOverride,
      touchSavedNotebookQueryMutation,
    ],
  );

  const handleSavedQuerySubmit = useCallback(
    async (name) => {
      if (!savedQueriesEnabled) return;

      const trimmedName = name.trim();
      if (!trimmedName) return;

      const filters: any = {};
      const normalizedSelectedTags = selectedTags
        .map((tag) => normalizeTag(tag))
        .filter(Boolean);
      if (normalizedSelectedTags.length) {
        filters.tags = Array.from(new Set(normalizedSelectedTags));
      }
      const minWordCount = Number(minWords) || 0;
      if (minWordCount > 0) {
        filters.minWords = minWordCount;
      }

      const payload = {
        name: trimmedName,
        query: searchQuery.trim(),
        filters: Object.keys(filters).length ? filters : null,
        sort: sortOrderToSavedSort(sortOrder),
        scope: "notebook",
      };

      try {
        const created =
          await createSavedNotebookQueryMutation.mutateAsync(payload);
        setSavedQueryDialogOpen(false);
        if (created) {
          handleApplySavedQuery(created);
        }
      } catch {
        // errors handled in mutation callbacks
      }
    },
    [
      savedQueriesEnabled,
      selectedTags,
      minWords,
      searchQuery,
      sortOrder,
      createSavedNotebookQueryMutation,
      handleApplySavedQuery,
    ],
  );

  const handleDeleteSavedQuery = useCallback(
    (queryId) => {
      if (!queryId) return;
      deleteSavedNotebookQueryMutation.mutate(queryId);
    },
    [deleteSavedNotebookQueryMutation],
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

  const openShareNotebook = (notebook) => {
    if (!notebook) return;
    setShareNotebookState(notebook);
  };

  const closeShareNotebook = () => {
    setShareNotebookState(null);
  };

  const closeNotebookAnalytics = useCallback(() => {
    setAnalyticsNotebook(null);
  }, []);

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
          payload,
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
    } catch (error: any) {
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

    const payload: any = { mode, deleteCollaborative };
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
    } catch (error: any) {
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
        id: "home:open-notebook-templates",
        label: "Browse notebook templates",
        section: "Notebooks",
        action: openNotebookTemplateGallery,
      },
      {
        id: "home:toggle-filters",
        label: drawerOpen ? "Close filters drawer" : "Open filters drawer",
        section: "Notes",
        action: () => setDrawerOpen((prev) => !prev),
      },
    ]);
    return cleanup;
  }, [
    drawerOpen,
    openNotebookTemplateGallery,
    registerCommands,
    selectionMode,
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar
        onMobileSidebarClick={() => setMobileSidebarOpen(true)}
        defaultNotebookId={
          activeNotebookId &&
          activeNotebookId !== "all" &&
          activeNotebookId !== "uncategorized"
            ? activeNotebookId
            : null
        }
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
        onOpenTemplates={openTemplateGallery}
      />

      {isRateLimited && (
        <RateLimitedUI onDismiss={() => setIsRateLimited(false)} />
      )}

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {a11yMessage}
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar
          activeNotebookId={activeNotebookId}
          onSelectNotebook={handleSelectNotebook}
          notebooks={notebooks}
          uncategorizedCount={uncategorizedNoteCount}
          totalCount={totalNotebookCount}
          loading={notebooksLoading}
          error={notebooksError}
          onCreateNotebook={openCreateNotebook}
          onBrowseTemplates={openNotebookTemplateGallery}
          onShareNotebook={openShareNotebook}
          onPublishNotebook={openPublishNotebook}
          onHistoryNotebook={openHistoryNotebook}
          onAnalyticsNotebook={
            NOTEBOOK_ANALYTICS_ENABLED ? setAnalyticsNotebook : undefined
          }
          onRenameNotebook={openRenameNotebook}
          onSaveAsTemplate={openSaveNotebookTemplate}
          onDeleteNotebook={openDeleteNotebook}
          analyticsEnabled={NOTEBOOK_ANALYTICS_ENABLED}
          savedQueriesEnabled={savedQueriesEnabled}
          savedQueries={savedNotebookQueries}
          savedQueriesLoading={savedNotebookQueriesQuery.isLoading}
          appliedSavedQuery={appliedSavedQuery}
          onApplySavedQuery={handleApplySavedQuery}
          onDeleteSavedQuery={handleDeleteSavedQuery}
          onSaveCurrentView={openSavedQueryDialog}
          savingView={createSavedNotebookQueryMutation.isPending}
          noteCount={notes.length}
          pinnedCount={pinnedCount}
          avgWords={avgWords}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          renderNotebookDropZone={(notebookId, children) => (
            <NotebookDropZone notebookId={notebookId} disabled={customizeMode}>
              {children}
            </NotebookDropZone>
          )}
          dragDisabled={customizeMode}
        />

        {/* Main content */}
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 w-full">
          <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 lg:px-8">
            {/* Toolbar */}
            <Toolbar
              tabs={tabConfig}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              filterProps={{
                minWords,
                onMinWordsChange: setMinWords,
                sortOrder,
                onSortOrderChange: setSortOrder,
                tagOptions,
                selectedTags,
                onToggleTag: toggleTagSelection,
                filtersActive: filtersApplied,
                onClearAll: resetFilters,
              }}
              selectionMode={selectionMode}
              onToggleSelection={toggleSelectionMode}
              customizeMode={customizeMode}
              onToggleCustomize={handleToggleCustomize}
              customizeDisabled={customizeDisabled}
              filterChips={activeFilterChips}
              selectedTags={selectedTags}
              onRemoveTag={removeSelectedTag}
              onResetFilters={resetFilters}
              filtersApplied={filtersApplied}
              savingOrder={updateLayoutMutation.isPending}
            />

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
                            onOpenNoteInsights={openNoteInsights}
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
                          onOpenNoteInsights={openNoteInsights}
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
          </div>
        </main>
      </div>

      {/* Mobile FAB */}
      <Link
        to="/create"
        state={createPageState}
        className="btn btn-primary btn-circle fixed bottom-6 right-4 z-40 shadow-lg shadow-primary/30 lg:hidden"
        aria-label="Create a new note"
      >
        <PlusIcon className="size-6" />
      </Link>

      {/* Bulk actions bar */}
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
                        prev ? { ...prev, mode: "move" } : prev,
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
                            : prev,
                        )
                      }
                      disabled={notebookDeleteState.mode !== "move"}
                    >
                      <option value="uncategorized">Uncategorized</option>
                      {notebooks
                        .filter(
                          (entry) =>
                            entry.id !== notebookDeleteState.notebook?.id,
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
                        prev ? { ...prev, mode: "delete" } : prev,
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
                          notebookDeleteState.deleteCollaborative,
                        )}
                        onChange={(event) =>
                          setNotebookDeleteState((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  deleteCollaborative: event.target.checked,
                                }
                              : prev,
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

      {publishNotebook ? (
        <NotebookPublishDialog
          notebook={publishNotebook}
          open
          onClose={closePublishNotebook}
          onUpdated={handlePublishingChange}
        />
      ) : null}

      {historyNotebook ? (
        <NotebookHistoryDialog
          notebook={historyNotebook}
          notebooks={notebooks}
          open
          onClose={closeHistoryNotebook}
          onUndoSuccess={handleHistoryUndo}
        />
      ) : null}

      <NotebookInsightsDrawer
        open={Boolean(insightsNote)}
        note={insightsNote}
        onClose={closeNoteInsights}
        onMoveNote={handleMoveNoteToNotebook}
        onViewNotebook={handleViewNotebookFromInsights}
        onApplySmartView={handleApplySmartView}
        notebooks={notebooks}
        savedQueries={savedNotebookQueries}
        activeNotebookId={activeNotebookId}
      />

      {shareNotebookState ? (
        <NotebookShareDialog
          notebook={shareNotebookState}
          open
          onClose={closeShareNotebook}
        />
      ) : null}

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

      {NOTEBOOK_ANALYTICS_ENABLED && analyticsNotebook ? (
        <NotebookAnalyticsDialog
          notebook={analyticsNotebook}
          open
          onClose={closeNotebookAnalytics}
        />
      ) : null}

      <SavedNotebookQueryDialog
        open={savedQueryDialogOpen}
        onClose={closeSavedQueryDialog}
        onSubmit={handleSavedQuerySubmit}
        submitting={createSavedNotebookQueryMutation.isPending}
        defaultName={
          appliedSavedQuery?.name ??
          (searchQuery.trim() ||
            (activeNotebook?.name ? `${activeNotebook.name} view` : ""))
        }
      />

      <NotebookTemplateGalleryModal
        open={notebookTemplateModalOpen}
        templates={notebookTemplates}
        isLoading={notebookTemplatesLoading || notebookTemplatesFetching}
        selectedTemplateId={selectedNotebookTemplateId}
        onSelectTemplate={handleNotebookTemplateSelect}
        detail={notebookTemplateDetail}
        detailLoading={notebookTemplateDetailLoading}
        workspaceOptions={templateWorkspaceOptions}
        boardOptions={templateBoardOptions}
        onDeleteTemplate={handleDeleteNotebookTemplate}
        deletingTemplateId={deletingTemplateId}
        onImport={handleNotebookTemplateImport}
        importing={notebookTemplateImporting}
        onClose={closeNotebookTemplateGallery}
        onRefresh={refetchNotebookTemplates}
      />

      <SaveNotebookTemplateDialog
        open={saveTemplateState.open}
        notebook={saveTemplateState.notebook}
        submitting={saveTemplateSubmitting}
        onClose={closeSaveNotebookTemplate}
        onSubmit={handleSaveNotebookTemplate}
      />

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
