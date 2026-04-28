import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { AnimatePresence, m } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import {
  AlertTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  FilterIcon,
  XIcon,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MobileBottomNav from "../Components/MobileBottomNav";
import Toolbar from "../Components/Toolbar";
import DashboardShell from "../Components/dashboard/DashboardShell";
import DashboardSidebar, {
  type DashboardView,
  type NotebookMenuActions,
  type SidebarNotebook,
} from "../Components/dashboard/DashboardSidebar";
import DashboardTopbar from "../Components/dashboard/DashboardTopbar";
import TweaksPanel from "../Components/dashboard/TweaksPanel";
import RateLimitedUI from "../Components/RateLimitedUI";
import api from "../lib/axios";
import { extractApiError } from "../lib/extractApiError";
import { toast } from "sonner";
import NoteCard from "../Components/NoteCard";
import NotesNotFound from "../Components/NotesNotFound";
import NoteSkeleton from "../Components/NoteSkeleton";
import { type TagStats } from "../Components/NotesStats";
import type {
  ApiError,
  FilterChip,
  SmartViewParams,
  SelectionMeta,
  NotebookRef,
} from "../types/api";
import type {
  NoteForInsights,
  SavedQuery,
} from "../Components/NotebookInsightsDrawer";
import { countWords, normalizeTag } from "../lib/Utils";
import useSemanticSearch from "../hooks/useSemanticSearch";
import useNotebookDialogs from "../hooks/useNotebookDialogs";
import { useHomeCommandPalette } from "./home/useHomeCommandPalette";
import {
  NOTES_PER_PAGE,
  NOTEBOOK_ANALYTICS_ENABLED,
  mergeOrder,
  getNoteId,
  sortLabelMap,
  sortOrderToSavedSort,
  savedSortToSortOrder,
  BULK_SUCCESS_MESSAGES,
} from "./home/homePageUtils";
import { useHomeDnd } from "./home/useHomeDnd";
import { useHomeFilterSync } from "./home/useHomeFilterSync";
import { useHomeKeyboardShortcuts } from "./home/useHomeKeyboardShortcuts";
import { useNotebookCrud } from "./home/useNotebookCrud";
import {
  SortableNoteCard,
  DraggableBoardNote,
  NotebookDropZone,
} from "./home/HomePageDnD";
// ── Lazy-loaded dialogs (code-split, all behind user actions) ──────────
const ConfirmDialog = lazy(() => import("../Components/ConfirmDialog"));
const TemplateGalleryModal = lazy(
  () => import("../Components/TemplateGalleryModal"),
);
const NotebookFormDialog = lazy(() => import("./home/NotebookFormDialog"));
const NotebookDeleteDialog = lazy(() => import("./home/NotebookDeleteDialog"));
const BulkMoveNotebookDialog = lazy(
  () => import("./home/BulkMoveNotebookDialog"),
);
const BulkTagDialog = lazy(() => import("./home/BulkTagDialog"));
const NotebookTemplateGalleryModal = lazy(
  () => import("../Components/NotebookTemplateGalleryModal"),
);
const SaveNotebookTemplateDialog = lazy(
  () => import("../Components/SaveNotebookTemplateDialog"),
);
const BulkActionsBar = lazy(() => import("../Components/BulkActionsBar"));
const NotebookShareDialog = lazy(
  () => import("../Components/NotebookShareDialog"),
);
const NotebookAnalyticsDialog = lazy(
  () => import("../Components/NotebookAnalyticsDialog"),
);
const SavedNotebookQueryDialog = lazy(
  () => import("../Components/SavedNotebookQueryDialog"),
);
const NotebookPublishDialog = lazy(
  () => import("../Components/NotebookPublishDialog"),
);
const NotebookHistoryDialog = lazy(
  () => import("../Components/NotebookHistoryDialog"),
);
const NotebookInsightsDrawer = lazy(
  () => import("../Components/NotebookInsightsDrawer"),
);

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
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [customOrderOverride, setCustomOrderOverride] = useState<string[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeNotebookId, setActiveNotebookId] = useState("all");
  const [moveNotebookModalOpen, setMoveNotebookModalOpen] = useState(false);
  const [selectedNotebookTargetId, setSelectedNotebookTargetId] =
    useState("uncategorized");
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null,
  );
  const [activeDragNoteIds, setActiveDragNoteIds] = useState<string[]>([]);
  const [a11yMessage, setA11yMessage] = useState("");
  const notebookDialogs = useNotebookDialogs();
  const [notebookTemplateModalOpen, setNotebookTemplateModalOpen] =
    useState(false);
  const [selectedNotebookTemplateId, setSelectedNotebookTemplateId] = useState<
    string | null
  >(null);
  const [saveTemplateState, setSaveTemplateState] = useState<{
    open: boolean;
    notebook: NotebookRef | null;
  }>({
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
  const [appliedSavedQuery, setAppliedSavedQuery] = useState<SavedQuery | null>(
    null,
  );
  const [insightsNote, setInsightsNote] = useState<NoteForInsights | null>(
    null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedFilters = useRef(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const previousSortRef = useRef("newest");
  const liveMessageTimeoutRef = useRef<number | null>(null);
  const layoutMutationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
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
  const openNoteInsights = useCallback((note) => {
    if (note) {
      setInsightsNote(note);
    }
  }, []);
  const closeNoteInsights = useCallback(() => {
    setInsightsNote(null);
  }, []);
  const handlePublishingChange = useCallback(
    async ({ notebookId: updatedNotebookId }: { notebookId?: string | null } = {}) => {
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
    async ({ notebookId: historyNotebookId }: { notebookId?: string | null } = {}) => {
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
    ({ search = "", matchedTag = null, tags = [], noteCount = null }: SmartViewParams) => {
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

  // ── Semantic / keyword server-side search ─────────────────────────────
  const {
    results: semanticResults,
    searchMode,
    isActive: isServerSearchActive,
  } = useSemanticSearch(searchQuery);

  const notesQuery = useQuery({
    queryKey: ["notes", activeNotebookId],
    queryFn: async () => {
      const params: Record<string, string> = { limit: "200" };
      if (activeNotebookId && activeNotebookId !== "all") {
        params.notebookId = activeNotebookId;
      }
      const res = await api.get("/notes", { params });
      // API returns { data: [...], total, page, limit, totalPages }
      const payload = Array.isArray(res.data?.data) ? res.data.data : [];
      return payload;
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: (failureCount, error: Error) => {
      if ((error as ApiError)?.response?.status === 429) {
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
    const error = notesQuery.error as ApiError;
    if (import.meta.env.DEV) console.error("Error fetching notes", error);
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
    staleTime: 120_000,
    refetchOnMount: "always",
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
    mutationFn: async (payload: {
      name: string;
      query: string;
      filters: { tags?: string[]; minWords?: number } | null;
      sort: { updatedAt?: string; title?: string } | null;
      scope: string;
    }) => {
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
    onError: (error: Error) => {
      toast.error(extractApiError(error, "Unable to save this view. Try a different name."));
    },
  });

  const touchSavedNotebookQueryMutation = useMutation({
    mutationFn: async ({ notebookId, queryId }: { notebookId: string; queryId: string }) => {
      if (!notebookId || !queryId) return null;
      await api.post(`/notebooks/${notebookId}/saved-queries/${queryId}/use`);
      return queryId;
    },
    onError: (error: Error) => {
      console.warn("Failed to update saved query usage", error);
    },
  });

  const notebooks = useMemo(
    () => notebooksQuery.data?.notebooks ?? [],
    [notebooksQuery.data],
  );
  const {
    notebookFormState,
    notebookFormLoading,
    notebookDeleteState,
    notebookDeleteLoading,
    setNotebookDeleteState,
    openCreateNotebook,
    openRenameNotebook,
    closeNotebookForm,
    submitNotebookForm,
    openDeleteNotebook,
    closeNotebookDelete,
    confirmNotebookDelete,
  } = useNotebookCrud({
    notebooks,
    activeNotebookId,
    handleSelectNotebook,
    invalidateNotesCaches,
    queryClient,
  });
  const uncategorizedNoteCount = notebooksQuery.data?.uncategorizedCount ?? 0;
  // Persist the "all" count so it stays correct when viewing a specific notebook.
  // The notes query for "all" returns every accessible note; when viewing a
  // specific notebook the query is filtered, so we recall the last "all" total.
  const allNotesTotalRef = useRef(0);
  if (!activeNotebookId || activeNotebookId === "all") {
    allNotesTotalRef.current = notes.length;
  }
  const totalNotebookCount = allNotesTotalRef.current || notes.length;
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
      } catch (error: unknown) {
        const message = extractApiError(error, "Failed to move notes to the selected notebook");
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
    mutationFn: async ({ noteIds, contextId }: { noteIds: string[]; contextId?: string }) => {
      const payload: { noteIds: string[]; notebookId?: string } = { noteIds };
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
    onError: (error: Error) => {
      toast.error(extractApiError(error, "Failed to save note layout"));
      layoutQuery.refetch().catch(() => {});
    },
  });

  const { handleDragStart, handleDragCancel, handleDragEnd } = useHomeDnd({
    selectionMode,
    customizeMode,
    selectedNoteIds,
    activeDragNoteIds,
    allNoteIds,
    layoutOrder,
    activeNotebookId,
    lastLayoutMutationRef,
    layoutMutationTimeoutRef,
    updateLayoutMutation,
    moveNotesToNotebook,
    setActiveDragId,
    setActiveDragNoteIds,
    setCustomOrderOverride,
  });

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
      if (import.meta.env.DEV) console.error("Error fetching tag stats", tagStatsQuery.error);
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

  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const response = await api.get("/workspaces");
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: notebookTemplateModalOpen,
    staleTime: 120_000,
  });

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
  useHomeFilterSync({
    searchParams,
    setSearchParams,
    hasInitializedFiltersRef: hasInitializedFilters,
    applyingSavedQueryRef,
    activeNotebookId,
    setActiveNotebookId,
    searchQuery,
    setSearchQuery,
    minWords,
    setMinWords,
    activeTab,
    setActiveTab,
    sortOrder,
    setSortOrder,
    selectedTags,
    setSelectedTags,
    appliedSavedQuery,
    setAppliedSavedQuery,
  });

  useEffect(() => {
    if (!savedQueriesEnabled && savedQueryDialogOpen) {
      setSavedQueryDialogOpen(false);
    }
  }, [savedQueriesEnabled, savedQueryDialogOpen]);

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

  const tabConfig = useMemo(
    () => [
      { id: "all", label: "All notes", badge: notes.length },
      { id: "recent", label: "Recent", badge: recentNotes.length },
      { id: "long", label: "Long form", badge: longFormNotes.length },
      { id: "short", label: "Short & sweet", badge: shortNotes.length },
    ],
    [notes.length, recentNotes.length, longFormNotes.length, shortNotes.length],
  );

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
    const chips: FilterChip[] = [];
    if (appliedSavedQuery) {
      chips.push({
        key: "saved-query",
        label: `Saved view: ${appliedSavedQuery.name ?? "Untitled"}`,
        onClear: () => setAppliedSavedQuery(null),
      });
    }
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery) {
      const modeLabel =
        isServerSearchActive && searchMode === "semantic"
          ? " (semantic)"
          : isServerSearchActive && searchMode === "keyword"
            ? " (keyword)"
            : "";
      chips.push({
        key: "search",
        label: `Search: "${trimmedQuery}"${modeLabel}`,
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
    isServerSearchActive,
    searchMode,
  ]);

  const filteredNotes = useMemo(() => {
    // ── When server-side search is active, use its ranked results ──────
    if (isServerSearchActive && semanticResults.length > 0) {
      const serverNotes = semanticResults;

      // Still apply non-search filters on top of server results
      const byWords = serverNotes.filter(
        (note) =>
          countWords(note.contentText ?? note.content ?? "") >=
          Number(minWords),
      );

      const byTags = selectedTags.length
        ? byWords.filter((note) => {
            if (!Array.isArray(note.tags) || !note.tags.length) return false;
            const normalized = note.tags.map((t: string) => t.toLowerCase());
            return selectedTags.every((tag) => normalized.includes(tag));
          })
        : byWords;

      // Server results are already ranked by relevance — keep that order
      return byTags;
    }

    // ── Fallback: client-side filtering (no search or short query) ─────
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
    isServerSearchActive,
    semanticResults,
  ]);

  // ── Pagination ───────────────────────────────────────────────────────
  const totalPages = Math.max(
    1,
    Math.ceil(filteredNotes.length / NOTES_PER_PAGE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);

  // Mobile: progressive "load more"; Desktop: traditional pagination
  const [mobileVisibleCount, setMobileVisibleCount] = useState(NOTES_PER_PAGE);
  const mobileNotes = useMemo(
    () => filteredNotes.slice(0, mobileVisibleCount),
    [filteredNotes, mobileVisibleCount],
  );
  const hasMoreMobile = mobileVisibleCount < filteredNotes.length;

  const paginatedNotes = useMemo(() => {
    const start = (safeCurrentPage - 1) * NOTES_PER_PAGE;
    return filteredNotes.slice(start, start + NOTES_PER_PAGE);
  }, [filteredNotes, safeCurrentPage]);

  // Reset to page 1 / mobile count when filters change
  useEffect(() => {
    setCurrentPage(1);
    setMobileVisibleCount(NOTES_PER_PAGE);
  }, [
    activeTab,
    searchQuery,
    minWords,
    sortOrder,
    selectedTags,
    activeNotebookId,
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
    !isRateLimited &&
    !notesQuery.isError &&
    notes.length > 0 &&
    !filteredNotes.length;

  const customizeDisabled =
    !customizeMode &&
    (notes.length <= 1 ||
      loading ||
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
    (noteId: string, checked: boolean, meta: SelectionMeta = {}) => {
      const shiftKey = Boolean((meta?.event as { shiftKey?: boolean } | null)?.shiftKey || meta?.shiftKey);
      const noteIndex = noteIndexLookup.get(noteId);

      setSelectedNoteIds((prev) => {
        const exists = prev.includes(noteId);

        if (shiftKey && lastSelectedIndex !== null && noteIndex !== undefined) {
          const start = Math.min(lastSelectedIndex, noteIndex);
          const end = Math.max(lastSelectedIndex, noteIndex);
          const rangeIds = filteredNotes
            .slice(start, end + 1)
            .map((note) => getNoteId(note))
            .filter((id): id is string => Boolean(id));

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
      } catch (error: unknown) {
        if (import.meta.env.DEV) console.error("Bulk action failed", error);
        toast.error(extractApiError(error, "Failed to update selected notes"));
      } finally {
        setBulkActionLoading(false);
      }
    },
    [invalidateNotesCaches, selectedNoteIds, selectionCount],
  );

  const handleBulkPin = () => performBulkAction("pin");
  const handleBulkUnpin = () => performBulkAction("unpin");
  const handleBulkAddTags = () => setTagModalOpen(true);
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
      } catch (error: unknown) {
        toast.error(extractApiError(error, "Failed to use notebook template"));
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
      } catch (error: unknown) {
        toast.error(extractApiError(error, "Failed to delete template"));
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
    } catch (error: unknown) {
      toast.error(extractApiError(error, "Failed to save notebook template"));
    } finally {
      setSaveTemplateSubmitting(false);
    }
  };

  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const lower = file.name.toLowerCase();
      if (
        !lower.endsWith(".zip") &&
        !lower.endsWith(".md") &&
        !lower.endsWith(".markdown")
      ) {
        toast.error("Upload a .md or .zip file");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error("File is too large (max 20 MB)");
        return;
      }
      const toastId = toast.loading(`Importing ${file.name}…`);
      try {
        const form = new FormData();
        form.append("file", file);
        const response = await api.post("/notebooks/import", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const { notebook, importedCount, skippedCount } = response.data ?? {};
        await invalidateNotesCaches();
        toast.success(
          `Imported ${importedCount} note${importedCount === 1 ? "" : "s"} into ${notebook?.name ?? "notebook"}${
            skippedCount ? ` (${skippedCount} skipped)` : ""
          }`,
          { id: toastId },
        );
        if (notebook?.id) {
          handleSelectNotebook(notebook.id);
        }
      } catch (error) {
        toast.error(extractApiError(error, "Failed to import notebook"), {
          id: toastId,
        });
      }
    },
    [handleSelectNotebook, invalidateNotesCaches],
  );

  const handleExportNotebook = useCallback(
    async (notebook) => {
      if (!notebook?.id) return;
      const toastId = toast.loading(`Preparing ${notebook.name} export…`);
      try {
        const response = await api.get(`/notebooks/${notebook.id}/export`, {
          responseType: "blob",
        });
        const blob = new Blob([response.data], {
          type: response.headers["content-type"] ?? "application/zip",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        const safeName =
          (notebook.name || "notebook").replace(/[^\w\- ]+/g, "").trim() ||
          "notebook";
        anchor.href = url;
        anchor.download = `${safeName}.zip`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast.success(`Exported ${notebook.name}`, { id: toastId });
      } catch (error) {
        toast.error(extractApiError(error, "Failed to export notebook"), {
          id: toastId,
        });
      }
    },
    [],
  );

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

      const filters: { tags?: string[]; minWords?: number } = {};
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

  useHomeKeyboardShortcuts({
    filteredNotes,
    selectionMode,
    selectedNoteIds,
    mobileSidebarOpen,
    navigate,
    searchInputRef,
    setSelectionMode,
    setSelectedNoteIds,
    setLastSelectedIndex,
    setMobileSidebarOpen,
  });

  useEffect(() => {
    if (customizeMode && sortOrder !== "custom") {
      setCustomizeMode(false);
      setCustomOrderOverride([]);
    }
  }, [customizeMode, sortOrder]);

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

  useHomeCommandPalette({
    selectionMode,
    drawerOpen,
    searchInputRef,
    onToggleSelectionMode: useCallback(
      () => setSelectionMode((prev) => !prev),
      [],
    ),
    onOpenTemplates: useCallback(() => setTemplateModalOpen(true), []),
    onOpenNotebookTemplates: openNotebookTemplateGallery,
    onToggleDrawer: useCallback(() => setDrawerOpen((prev) => !prev), []),
  });

  // ── Map activeNotebookId + tab + search flags to DashboardSidebar view ──
  const currentView: DashboardView = useMemo(() => {
    if (activeNotebookId === "uncategorized") return "uncategorized";
    if (
      activeNotebookId &&
      activeNotebookId !== "all" &&
      activeNotebookId !== "uncategorized"
    ) {
      return `notebook:${activeNotebookId}` as DashboardView;
    }
    if (selectedTags.length === 1) {
      return `tag:${selectedTags[0]}` as DashboardView;
    }
    if (activeTab === "pinned") return "pinned";
    return "all";
  }, [activeNotebookId, selectedTags, activeTab]);

  const handleSelectDashboardView = useCallback(
    (view: DashboardView) => {
      if (view === "dashboard") {
        navigate("/home");
        return;
      }
      if (view === "templates") {
        navigate("/create");
        return;
      }
      if (view === "trash") {
        setActiveTab("all");
        return;
      }
      if (view === "all") {
        handleSelectNotebook("all");
        setActiveTab("all");
        setSelectedTags([]);
        return;
      }
      if (view === "pinned") {
        setActiveTab("pinned");
        return;
      }
      if (view === "uncategorized") {
        handleSelectNotebook("uncategorized");
        setActiveTab("all");
        return;
      }
      if (view.startsWith("notebook:")) {
        handleSelectNotebook(view.slice("notebook:".length));
        setActiveTab("all");
        return;
      }
      if (view.startsWith("tag:")) {
        const tag = view.slice("tag:".length);
        setSelectedTags([normalizeTag(tag)]);
      }
    },
    [navigate, handleSelectNotebook, setActiveTab, setSelectedTags],
  );

  const closeMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  const handleSelectMobileDashboardView = useCallback(
    (view: DashboardView) => {
      handleSelectDashboardView(view);
      closeMobileSidebar();
    },
    [closeMobileSidebar, handleSelectDashboardView],
  );

  useEffect(() => {
    if (!mobileSidebarOpen || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileSidebarOpen]);

  const buildNotebookActions = useCallback(
    (afterAction?: () => void): NotebookMenuActions => ({
      onRename: (id) => {
        const nb = notebooks.find((n) => n.id === id);
        if (!nb) return;
        afterAction?.();
        openRenameNotebook(nb);
      },
      onShare: (id) => {
        const nb = notebooks.find((n) => n.id === id);
        if (!nb) return;
        afterAction?.();
        notebookDialogs.share.open(nb);
      },
      onPublish: (id) => {
        const nb = notebooks.find((n) => n.id === id);
        if (!nb) return;
        afterAction?.();
        notebookDialogs.publish.open(nb);
      },
      onHistory: (id) => {
        const nb = notebooks.find((n) => n.id === id);
        if (!nb) return;
        afterAction?.();
        notebookDialogs.history.open(nb);
      },
      onAnalytics: NOTEBOOK_ANALYTICS_ENABLED
        ? (id) => {
            const nb = notebooks.find((n) => n.id === id);
            if (!nb) return;
            afterAction?.();
            notebookDialogs.analytics.open(nb);
          }
        : undefined,
      onSaveAsTemplate: (id) => {
        const nb = notebooks.find((n) => n.id === id);
        if (!nb) return;
        afterAction?.();
        openSaveNotebookTemplate(nb);
      },
      onExport: (id) => {
        const nb = notebooks.find((n) => n.id === id);
        if (!nb) return;
        afterAction?.();
        handleExportNotebook(nb);
      },
      onDelete: (id) => {
        const nb = notebooks.find((n) => n.id === id);
        if (!nb) return;
        afterAction?.();
        openDeleteNotebook(nb);
      },
    }),
    [
      handleExportNotebook,
      notebookDialogs.analytics,
      notebookDialogs.history,
      notebookDialogs.publish,
      notebookDialogs.share,
      notebooks,
      openDeleteNotebook,
      openRenameNotebook,
      openSaveNotebookTemplate,
    ],
  );

  const sidebarNotebookActions = useMemo(
    () => buildNotebookActions(),
    [buildNotebookActions],
  );

  const mobileNotebookActions = useMemo(
    () => buildNotebookActions(closeMobileSidebar),
    [buildNotebookActions, closeMobileSidebar],
  );

  const sidebarNotebooks: SidebarNotebook[] = useMemo(
    () =>
      notebooks.map((nb) => ({
        id: nb.id,
        name: nb.name,
        color: nb.color ?? null,
        noteCount: nb.noteCount ?? 0,
      })),
    [notebooks],
  );

  const sidebarTags = useMemo(
    () =>
      (tagInsights?.tags ?? []).map((t) => ({
        tag: t._id,
        count: t.count,
      })),
    [tagInsights],
  );

  const lastSynced = useMemo(
    () => (notesQuery.dataUpdatedAt ? new Date(notesQuery.dataUpdatedAt) : null),
    [notesQuery.dataUpdatedAt],
  );

  return (
    <DashboardShell>
      {isRateLimited && (
        <RateLimitedUI onDismiss={() => setIsRateLimited(false)} />
      )}

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {a11yMessage}
      </div>

      <DashboardSidebar
        notebooks={sidebarNotebooks}
        tags={sidebarTags}
        allNotesCount={totalNotebookCount}
        pinnedCount={pinnedCount}
        uncategorizedCount={uncategorizedNoteCount}
        activeView={currentView}
        onSelectView={handleSelectDashboardView}
        onCreateNotebook={openCreateNotebook}
        notebookActions={sidebarNotebookActions}
      />

      <div className="ds-main">
        <DashboardTopbar lastSynced={lastSynced} here="notes" />
        <main
          id="main-content"
          tabIndex={-1}
          className="ds-content"
          role="main"
          aria-label="Notes dashboard"
        >
          <div className="ds-content-inner">
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

            <AnimatePresence mode="wait">
              {loading && (
                <m.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <NoteSkeleton />
                </m.div>
              )}
            </AnimatePresence>

            {notesQuery.isError && !isRateLimited && (
              <m.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="ds-alert"
              >
                <AlertTriangleIcon size={14} />
                <div>
                  <h4>We couldn&apos;t load your notes</h4>
                  <p>Please refresh or try again in a moment.</p>
                </div>
              </m.div>
            )}

            {/* ── Notes stats bar ──────────────────────────────────── */}

            {!loading && filteredNotes.length > 0 && (
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
                      .filter((id): id is string => Boolean(id))}
                    strategy={rectSortingStrategy}
                  >
                    <div className="ds-notes-grid">
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
                  <>
                  {/* Mobile: progressive load */}
                  <div className="ds-notes-grid ds-mobile-only">
                    {mobileNotes.map((note) => {
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
                    {hasMoreMobile && (
                      <button
                        type="button"
                        className="ds-chip"
                        style={{ alignSelf: "center", marginTop: 6 }}
                        onClick={() =>
                          setMobileVisibleCount((c) => c + NOTES_PER_PAGE)
                        }
                      >
                        Load more
                      </button>
                    )}
                  </div>

                  {/* Desktop: paginated grid */}
                  <m.div
                    key={`page-${safeCurrentPage}-${activeNotebookId}-${activeTab}`}
                    initial={false}
                    animate="visible"
                    variants={{
                      visible: {
                        transition: { staggerChildren: 0.04 },
                      },
                    }}
                    className="ds-notes-grid ds-desktop-only"
                  >
                    {paginatedNotes.map((note) => {
                      const id = getNoteId(note);
                      if (!id) return null;
                      const isSelected = selectedNoteIdSet.has(id);
                      return (
                        <m.div
                          key={id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            transition: {
                              type: "spring",
                              stiffness: 300,
                              damping: 24,
                            },
                          }}
                          layout
                        >
                          <DraggableBoardNote
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
                        </m.div>
                      );
                    })}
                  </m.div>
                  </>
                )}
                <DragOverlay dropAnimation={dropAnimation}>
                  {activeDragNote ? (
                    <NoteCard
                      note={activeDragNote}
                      customizeMode={customizeMode}
                      selectionMode={selectionMode}
                      selected={
                        selectionMode &&
                        selectedNoteIdSet.has(getNoteId(activeDragNote) ?? "")
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

            {/* ── Pagination controls + compact stats ─────────────── */}
            {!loading && filteredNotes.length > 0 && (
              <div className="ds-pager ds-desktop-only">
                <p className="ds-pstats">
                  {filteredNotes.length}{" "}
                  {filteredNotes.length === 1 ? "note" : "notes"}
                  {" · "}
                  {pinnedCount} pinned
                  {" · "}
                  {avgWords} avg words
                  {totalPages > 1 && (
                    <>
                      {" · "}
                      Page {safeCurrentPage} of {totalPages}
                    </>
                  )}
                </p>

                {totalPages > 1 && !customizeMode && (
                  <div className="ds-pctrls">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(1)}
                      disabled={safeCurrentPage === 1}
                      className="ds-chip"
                      title="First page"
                    >
                      <ChevronsLeftIcon size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPage === 1}
                      className="ds-chip"
                      title="Previous page"
                    >
                      <ChevronLeftIcon size={12} />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`ds-chip${page === safeCurrentPage ? " on" : ""}`}
                        >
                          {page}
                        </button>
                      ),
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={safeCurrentPage === totalPages}
                      className="ds-chip"
                      title="Next page"
                    >
                      <ChevronRightIcon size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={safeCurrentPage === totalPages}
                      className="ds-chip"
                      title="Last page"
                    >
                      <ChevronsRightIcon size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}

            <AnimatePresence>
              {showFilterEmptyState && (
                <m.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="ds-empty"
                >
                  <div className="ds-empty-icon">
                    <FilterIcon size={16} />
                  </div>
                  <h3>No notes match your filters</h3>
                  <p>
                    Try adjusting the search, tab, or word count slider to
                    broaden your results.
                  </p>
                  <div className="ds-empty-actions">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="ds-chip"
                    >
                      Clear all filters
                    </button>
                  </div>
                </m.div>
              )}
            </AnimatePresence>

            {!loading &&
              !isRateLimited &&
              !notesQuery.isError &&
              notes.length === 0 &&
              !notesQuery.isPlaceholderData && (
                <NotesNotFound createLinkState={createPageState} />
              )}

            {selectionMode && selectionCount > 0 && (
              <Suspense fallback={null}>
                <BulkActionsBar
                  selectedCount={selectionCount}
                  onClearSelection={handleClearSelection}
                  onPinSelected={handleBulkPin}
                  onUnpinSelected={handleBulkUnpin}
                  onAddTags={handleBulkAddTags}
                  onMoveNotebook={handleBulkMoveNotebook}
                  onDelete={handleBulkDelete}
                  busy={bulkActionLoading}
                  notebookOptions={notebooks}
                  onQuickMoveNotebook={handleQuickMoveNotebook}
                />
              </Suspense>
            )}
          </div>
        </main>
      </div>

      <TweaksPanel />

      <input
        ref={importFileInputRef}
        type="file"
        accept=".md,.markdown,.zip,text/markdown,application/zip"
        className="hidden"
        onChange={handleImportFileChange}
      />

      {notebookFormState && (
        <Suspense fallback={null}>
          <NotebookFormDialog
            formState={notebookFormState}
            onClose={closeNotebookForm}
            onSubmit={submitNotebookForm}
            loading={notebookFormLoading}
          />
        </Suspense>
      )}

      {notebookDeleteState ? (
        <Suspense fallback={null}>
          <NotebookDeleteDialog
            deleteState={notebookDeleteState}
            notebooks={notebooks}
            loading={notebookDeleteLoading}
            onClose={closeNotebookDelete}
            onConfirm={confirmNotebookDelete}
            onUpdateState={setNotebookDeleteState}
          />
        </Suspense>
      ) : null}

      {notebookDialogs.publish.value ? (
        <Suspense fallback={null}>
          <NotebookPublishDialog
            notebook={notebookDialogs.publish.value}
            open
            onClose={notebookDialogs.publish.close}
            onUpdated={handlePublishingChange}
          />
        </Suspense>
      ) : null}

      {notebookDialogs.history.value ? (
        <Suspense fallback={null}>
          <NotebookHistoryDialog
            notebook={notebookDialogs.history.value}
            notebooks={notebooks}
            open
            onClose={notebookDialogs.history.close}
            onUndoSuccess={handleHistoryUndo}
          />
        </Suspense>
      ) : null}

      <Suspense fallback={null}>
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
      </Suspense>

      {notebookDialogs.share.value ? (
        <Suspense fallback={null}>
          <NotebookShareDialog
            notebook={notebookDialogs.share.value}
            open
            onClose={notebookDialogs.share.close}
          />
        </Suspense>
      ) : null}

      <Suspense fallback={null}>
        <BulkMoveNotebookDialog
          open={moveNotebookModalOpen}
          notebooks={notebooks}
          selectedTargetId={selectedNotebookTargetId}
          onTargetChange={setSelectedNotebookTargetId}
          onClose={() => setMoveNotebookModalOpen(false)}
          onSubmit={submitBulkMoveNotebook}
          loading={bulkActionLoading}
        />
      </Suspense>

      {NOTEBOOK_ANALYTICS_ENABLED && notebookDialogs.analytics.value ? (
        <Suspense fallback={null}>
          <NotebookAnalyticsDialog
            notebook={notebookDialogs.analytics.value}
            open
            onClose={notebookDialogs.analytics.close}
          />
        </Suspense>
      ) : null}

      <Suspense fallback={null}>
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
      </Suspense>

      <Suspense fallback={null}>
        <NotebookTemplateGalleryModal
          open={notebookTemplateModalOpen}
          templates={notebookTemplates}
          isLoading={notebookTemplatesLoading || notebookTemplatesFetching}
          selectedTemplateId={selectedNotebookTemplateId}
          onSelectTemplate={handleNotebookTemplateSelect}
          detail={notebookTemplateDetail}
          detailLoading={notebookTemplateDetailLoading}
          workspaceOptions={templateWorkspaceOptions}
          onDeleteTemplate={handleDeleteNotebookTemplate}
          deletingTemplateId={deletingTemplateId}
          onImport={handleNotebookTemplateImport}
          importing={notebookTemplateImporting}
          onClose={closeNotebookTemplateGallery}
          onRefresh={refetchNotebookTemplates}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SaveNotebookTemplateDialog
          open={saveTemplateState.open}
          notebook={saveTemplateState.notebook}
          submitting={saveTemplateSubmitting}
          onClose={closeSaveNotebookTemplate}
          onSubmit={handleSaveNotebookTemplate}
        />
      </Suspense>

      <Suspense fallback={null}>
        <TemplateGalleryModal
          open={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          onSelect={handleTemplateSelect}
        />
      </Suspense>

      <Suspense fallback={null}>
        <BulkTagDialog
          open={tagModalOpen}
          tags={bulkTags}
          onTagsChange={setBulkTags}
          onClose={() => setTagModalOpen(false)}
          onSubmit={submitBulkTags}
          loading={bulkActionLoading}
        />
      </Suspense>

      <Suspense fallback={null}>
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
      </Suspense>

      <AnimatePresence>
        {mobileSidebarOpen && (
          <m.div
            className="ds-mobile-sidebar-layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              className="ds-mobile-sidebar-backdrop"
              aria-label="Close notebook navigation"
              onClick={closeMobileSidebar}
            />
            <m.aside
              className="ds-mobile-sidebar-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Notebook navigation"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
            >
              <div className="ds-mobile-sidebar-head">
                <span>Navigation</span>
                <button
                  type="button"
                  className="ds-mini-btn"
                  onClick={closeMobileSidebar}
                  aria-label="Close notebook navigation"
                >
                  <XIcon size={12} />
                  Close
                </button>
              </div>
              <DashboardSidebar
                notebooks={sidebarNotebooks}
                tags={sidebarTags}
                allNotesCount={totalNotebookCount}
                pinnedCount={pinnedCount}
                uncategorizedCount={uncategorizedNoteCount}
                activeView={currentView}
                onSelectView={handleSelectMobileDashboardView}
                onCreateNotebook={() => {
                  closeMobileSidebar();
                  openCreateNotebook();
                }}
                notebookActions={mobileNotebookActions}
              />
            </m.aside>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Mobile bottom navigation ─────────────────────────── */}
      <MobileBottomNav
        onNotebooksClick={() => setMobileSidebarOpen(true)}
        defaultNotebookId={
          activeNotebookId &&
          activeNotebookId !== "all" &&
          activeNotebookId !== "uncategorized"
            ? activeNotebookId
            : null
        }
      />
    </DashboardShell>
  );
}

export default HomePage;
