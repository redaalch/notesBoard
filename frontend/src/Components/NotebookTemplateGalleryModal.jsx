import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  Building2Icon,
  FileTextIcon,
  KanbanSquareIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";

const truncate = (value, limit = 160) => {
  if (typeof value !== "string") return "";
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1)}…`;
};

function NotebookTemplateGalleryModal({
  open,
  templates,
  isLoading,
  selectedTemplateId,
  onSelectTemplate,
  detail,
  detailLoading,
  onImport,
  importing,
  onClose,
  onRefresh,
  workspaceOptions = [],
  boardOptions = [],
}) {
  const [query, setQuery] = useState("");
  const [targetWorkspaceId, setTargetWorkspaceId] = useState("");
  const [workspaceMapping, setWorkspaceMapping] = useState({});
  const [boardMapping, setBoardMapping] = useState({});

  useEffect(() => {
    if (!open) {
      setQuery("");
      setTargetWorkspaceId("");
      setWorkspaceMapping({});
      setBoardMapping({});
    }
  }, [open]);

  const filteredTemplates = useMemo(() => {
    if (!Array.isArray(templates)) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return templates;
    return templates.filter((template) => {
      const haystack = [
        template.name,
        template.description,
        Array.isArray(template.tags) ? template.tags.join(" ") : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [templates, query]);

  const normalizedWorkspaceOptions = useMemo(() => {
    const optionMap = new Map();
    if (Array.isArray(workspaceOptions)) {
      workspaceOptions.forEach((option) => {
        if (!option || !option.id) return;
        const label =
          typeof option.name === "string" && option.name.trim().length
            ? option.name.trim()
            : "Workspace";
        optionMap.set(option.id, { id: option.id, label });
      });
    }
    const base = [{ id: "", label: "Personal (no workspace)" }];
    const rest = Array.from(optionMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
    return [...base, ...rest];
  }, [workspaceOptions]);

  const normalizedBoardOptions = useMemo(() => {
    const optionMap = new Map();
    if (Array.isArray(boardOptions)) {
      boardOptions.forEach((option) => {
        if (!option || !option.id) return;
        const boardName =
          typeof option.name === "string" && option.name.trim().length
            ? option.name.trim()
            : "Untitled board";
        const label = option.workspaceName
          ? `${boardName} - ${option.workspaceName}`
          : boardName;
        optionMap.set(option.id, { id: option.id, label });
      });
    }
    return [{ id: "", label: "Create new board" }, ...optionMap.values()];
  }, [boardOptions]);

  const templateWorkspaceRefs = useMemo(() => {
    if (!detail) return [];
    if (Array.isArray(detail.workspaces) && detail.workspaces.length) {
      return detail.workspaces;
    }
    const counts = new Map();
    (detail.notes ?? []).forEach((note) => {
      const workspaceId = note?.workspaceId ? String(note.workspaceId) : null;
      if (!workspaceId) return;
      counts.set(workspaceId, (counts.get(workspaceId) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([workspaceId, noteCount]) => ({
      id: workspaceId,
      name: null,
      noteCount,
    }));
  }, [detail]);

  const handleWorkspaceMappingChange = useCallback((sourceId, value) => {
    setWorkspaceMapping((previous) => ({ ...previous, [sourceId]: value }));
  }, []);

  const handleBoardMappingChange = useCallback((sourceId, value) => {
    setBoardMapping((previous) => ({ ...previous, [sourceId]: value }));
  }, []);

  const handleImportClick = useCallback(() => {
    if (!selectedTemplateId || importing || detailLoading) return;

    const workspaceMappingsPayload = Object.fromEntries(
      Object.entries(workspaceMapping).filter(
        ([, target]) => typeof target === "string" && target.trim().length
      )
    );

    const boardMappingsPayload = Object.fromEntries(
      Object.entries(boardMapping).filter(
        ([, target]) => typeof target === "string" && target.trim().length
      )
    );

    onImport?.(selectedTemplateId, {
      workspaceId: targetWorkspaceId || undefined,
      workspaceMappings: Object.keys(workspaceMappingsPayload).length
        ? workspaceMappingsPayload
        : undefined,
      boardMappings: Object.keys(boardMappingsPayload).length
        ? boardMappingsPayload
        : undefined,
    });
  }, [
    boardMapping,
    detailLoading,
    importing,
    onImport,
    selectedTemplateId,
    targetWorkspaceId,
    workspaceMapping,
  ]);

  const templateBoardRefs = useMemo(() => {
    if (!detail) return [];
    if (Array.isArray(detail.boards) && detail.boards.length) {
      return detail.boards;
    }
    const counts = new Map();
    (detail.notes ?? []).forEach((note) => {
      const boardId = note?.boardId ? String(note.boardId) : null;
      if (!boardId) return;
      counts.set(boardId, (counts.get(boardId) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([boardId, noteCount]) => ({
      id: boardId,
      name: null,
      noteCount,
      workspaceName: null,
    }));
  }, [detail]);

  const showWorkspaceSection =
    normalizedWorkspaceOptions.length > 1 || templateWorkspaceRefs.length > 0;
  const showWorkspaceMappings = templateWorkspaceRefs.length > 0;
  const showBoardSection = templateBoardRefs.length > 0;

  useEffect(() => {
    if (!open) return;
    if (!filteredTemplates.length) {
      onSelectTemplate?.(null);
      return;
    }
    const exists = filteredTemplates.some(
      (template) => template.id === selectedTemplateId
    );
    if (!exists) {
      onSelectTemplate?.(filteredTemplates[0]?.id ?? null);
    }
  }, [open, filteredTemplates, selectedTemplateId, onSelectTemplate]);

  useEffect(() => {
    if (!detail?.id) return;
    setWorkspaceMapping((previous) => {
      const next = {};
      templateWorkspaceRefs.forEach((entry) => {
        next[entry.id] = previous[entry.id] ?? "";
      });
      return next;
    });
    setBoardMapping((previous) => {
      const next = {};
      templateBoardRefs.forEach((entry) => {
        next[entry.id] = previous[entry.id] ?? "";
      });
      return next;
    });
  }, [detail?.id, templateWorkspaceRefs, templateBoardRefs]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-3 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Notebook templates"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-base-content/10 bg-base-200/80 shadow-2xl shadow-primary/30"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-col gap-4 border-b border-base-content/10 bg-base-200/80 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <SparklesIcon className="size-7 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-base-content">
                Notebook templates
              </h2>
              <p className="text-sm text-base-content/60">
                Save time by reusing notebook structures across projects.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="input input-bordered flex items-center gap-2 bg-base-100/80">
              <SearchIcon className="size-4 text-base-content/60" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search templates"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm gap-2"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCwIcon
                className={`size-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 divide-y divide-base-content/10 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:divide-x md:divide-y-0">
          <aside className="max-h-[70vh] overflow-y-auto bg-base-200/60">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((item) => (
                  <div
                    key={`skeleton-${item}`}
                    className="h-16 animate-pulse rounded-2xl bg-base-100/60"
                  />
                ))}
              </div>
            ) : filteredTemplates.length ? (
              <ul className="space-y-2 p-4">
                {filteredTemplates.map((template) => {
                  const active = template.id === selectedTemplateId;
                  return (
                    <li key={template.id}>
                      <button
                        type="button"
                        onClick={() => onSelectTemplate?.(template.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                          active
                            ? "border-primary bg-primary/15 shadow-primary/30"
                            : "border-base-content/10 bg-base-100/70 hover:border-primary/40 hover:bg-base-100"
                        }`}
                      >
                        <h3 className="text-sm font-semibold text-base-content">
                          {template.name}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs text-base-content/60">
                          {template.description || "No description provided."}
                        </p>
                        {Array.isArray(template.tags) &&
                          template.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {template.tags.map((tag) => (
                                <span
                                  key={`${template.id}-tag-${tag}`}
                                  className="badge badge-outline badge-xs"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-3 p-10 text-center text-sm text-base-content/60">
                <FileTextIcon className="size-10 text-base-content/40" />
                <p>No templates match that search yet.</p>
              </div>
            )}
          </aside>

          <div className="flex min-h-[18rem] max-h-[70vh] flex-col justify-between bg-base-100/80 p-6">
            <div className="flex-1 overflow-y-auto pr-1">
              {detailLoading ? (
                <div className="space-y-4">
                  <div className="h-8 w-2/3 animate-pulse rounded bg-base-200" />
                  <div className="space-y-2">
                    {[1, 2, 3].map((item) => (
                      <div
                        key={`preview-${item}`}
                        className="space-y-2 rounded-2xl border border-base-content/10 bg-base-100 p-4 shadow-sm"
                      >
                        <div className="h-4 w-1/2 animate-pulse rounded bg-base-200" />
                        <div className="h-3 w-5/6 animate-pulse rounded bg-base-200" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : detail ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-base-content/50">
                      Preview
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-base-content">
                      {detail.name}
                    </h3>
                    <p className="mt-1 text-sm text-base-content/60">
                      {detail.description || "No description provided."}
                    </p>
                    <p className="mt-2 text-xs text-base-content/50">
                      {detail.noteCount} notes • {detail.tags?.length ?? 0} tags
                    </p>
                  </div>
                  <div className="space-y-3">
                    {(detail.notes ?? []).slice(0, 4).map((note) => (
                      <article
                        key={`${note.title}-${note.position}`}
                        className="rounded-2xl border border-base-content/10 bg-base-100 p-4 shadow-sm"
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold text-base-content">
                          <ArrowRightIcon className="size-4 text-primary" />
                          {note.title}
                        </div>
                        <p className="mt-2 text-sm text-base-content/60">
                          {truncate(note.content || "", 180)}
                        </p>
                        {Array.isArray(note.tags) && note.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {note.tags.map((tag) => (
                              <span
                                key={`${note.title}-tag-${tag}`}
                                className="badge badge-outline badge-xs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                    {(detail.notes ?? []).length === 0 && (
                      <p className="text-sm text-base-content/60">
                        This template does not include notes yet.
                      </p>
                    )}
                  </div>
                  {showWorkspaceSection ? (
                    <section className="space-y-3 rounded-2xl border border-base-content/10 bg-base-100/90 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-semibold text-base-content">
                        <Building2Icon className="size-4 text-primary" />
                        <span>Workspace placement</span>
                      </div>
                      <p className="text-xs text-base-content/60">
                        Choose where the imported notebook should live. Leave
                        personal to keep it private.
                      </p>
                      <select
                        className="select select-bordered select-sm w-full"
                        value={targetWorkspaceId}
                        onChange={(event) =>
                          setTargetWorkspaceId(event.target.value)
                        }
                      >
                        {normalizedWorkspaceOptions.map((option) => (
                          <option
                            key={option.id || "personal"}
                            value={option.id ?? ""}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {showWorkspaceMappings ? (
                        <div className="space-y-3 border-t border-dashed border-base-content/10 pt-3">
                          <p className="text-xs font-semibold text-base-content/70">
                            Map template workspaces
                          </p>
                          {templateWorkspaceRefs.map((workspaceRef, index) => {
                            const label =
                              typeof workspaceRef.name === "string" &&
                              workspaceRef.name.trim().length
                                ? workspaceRef.name.trim()
                                : `Template workspace ${index + 1}`;
                            const noteCount = workspaceRef.noteCount ?? 0;
                            return (
                              <div key={workspaceRef.id} className="space-y-1">
                                <div className="text-sm font-medium text-base-content">
                                  {label}
                                </div>
                                <p className="text-xs text-base-content/60">
                                  {noteCount} note{noteCount === 1 ? "" : "s"}{" "}
                                  in template
                                </p>
                                <select
                                  className="select select-bordered select-xs w-full"
                                  value={
                                    workspaceMapping[workspaceRef.id] ?? ""
                                  }
                                  onChange={(event) =>
                                    handleWorkspaceMappingChange(
                                      workspaceRef.id,
                                      event.target.value
                                    )
                                  }
                                >
                                  {normalizedWorkspaceOptions.map((option) => (
                                    <option
                                      key={`${workspaceRef.id}-${
                                        option.id || "personal"
                                      }`}
                                      value={option.id ?? ""}
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                  {showBoardSection ? (
                    <section className="space-y-3 rounded-2xl border border-base-content/10 bg-base-100/90 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-semibold text-base-content">
                        <KanbanSquareIcon className="size-4 text-primary" />
                        <span>Map template boards</span>
                      </div>
                      <p className="text-xs text-base-content/60">
                        Match template boards with existing boards or create new
                        ones for the imported notebook.
                      </p>
                      <div className="space-y-3">
                        {templateBoardRefs.map((boardRef, index) => {
                          const label =
                            typeof boardRef.name === "string" &&
                            boardRef.name.trim().length
                              ? boardRef.name.trim()
                              : `Template board ${index + 1}`;
                          const noteCount = boardRef.noteCount ?? 0;
                          const workspaceName =
                            typeof boardRef.workspaceName === "string" &&
                            boardRef.workspaceName.trim().length
                              ? boardRef.workspaceName.trim()
                              : null;
                          return (
                            <div key={boardRef.id} className="space-y-1">
                              <div className="text-sm font-medium text-base-content">
                                {label}
                              </div>
                              <p className="text-xs text-base-content/60">
                                {noteCount} note{noteCount === 1 ? "" : "s"}
                                {workspaceName ? ` from ${workspaceName}` : ""}
                              </p>
                              <select
                                className="select select-bordered select-xs w-full"
                                value={boardMapping[boardRef.id] ?? ""}
                                onChange={(event) =>
                                  handleBoardMappingChange(
                                    boardRef.id,
                                    event.target.value
                                  )
                                }
                              >
                                {normalizedBoardOptions.map((option) => (
                                  <option
                                    key={`${boardRef.id}-${option.id || "new"}`}
                                    value={option.id ?? ""}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-base-content/60">
                  <FileTextIcon className="size-10 text-base-content/40" />
                  <p>Select a template to preview its notes.</p>
                </div>
              )}
            </div>

            <footer className="mt-6 flex flex-col gap-2 border-t border-base-content/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Close
              </button>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-xs text-base-content/60">
                  Templates remain private to your account.
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!selectedTemplateId || importing || detailLoading}
                  onClick={handleImportClick}
                >
                  {importing && (
                    <span className="loading loading-spinner loading-xs" />
                  )}
                  Use template
                </button>
              </div>
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}

export default NotebookTemplateGalleryModal;
