import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  CheckIcon,
  ClipboardIcon,
  GlobeIcon,
  LoaderIcon,
  RefreshCwIcon,
  ShieldOffIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/axios.js";
import { formatDate, formatRelativeTime } from "../lib/Utils.js";

const normalizeSlugInput = (value) => {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
};

const buildSuggestedSlug = (name) => {
  const base = normalizeSlugInput(name);
  if (base && base.length >= 6) {
    return base;
  }
  const fallback = normalizeSlugInput(
    `${base || "notebook"}-${Math.random().toString(36).slice(2, 10)}`
  );
  return fallback && fallback.length >= 6 ? fallback : "notebook";
};

const serializeMetadata = (metadata) => {
  try {
    return JSON.stringify(metadata ?? {}, null, 2);
  } catch {
    return '{\n  "title": "",\n  "description": ""\n}';
  }
};

const computeShareUrl = (slug) => {
  if (!slug) return null;
  const envBase = import.meta.env.VITE_PUBLIC_NOTEBOOK_BASE_URL;
  const normalizedBase =
    typeof envBase === "string" && envBase.trim().length
      ? envBase.trim().replace(/\/$/, "")
      : null;
  if (normalizedBase) {
    return `${normalizedBase}/${slug}`;
  }
  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/$/, "");
    return `${origin}/published/${slug}`;
  }
  return null;
};

function NotebookPublishDialog({ notebook, open, onClose, onUpdated }) {
  const notebookId = notebook?.id ?? null;
  const notebookName = notebook?.name ?? "Notebook";
  const [slug, setSlug] = useState("");
  const [metadataText, setMetadataText] = useState("{}");
  const [slugError, setSlugError] = useState("");
  const [metadataError, setMetadataError] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [metadataDirty, setMetadataDirty] = useState(false);
  const [copied, setCopied] = useState(false);

  const publishingStateQuery = useQuery({
    queryKey: ["notebook-publish", notebookId],
    enabled: open && Boolean(notebookId),
    queryFn: async () => {
      const response = await api.get(`/notebooks/${notebookId}/publish`);
      return response.data;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) return;
    setSlugError("");
    setMetadataError("");
    setSlugDirty(false);
    setMetadataDirty(false);
    setCopied(false);
  }, [open, notebookId]);

  useEffect(() => {
    if (!open) return;
    const state = publishingStateQuery.data;
    if (state) {
      if (!slugDirty) {
        const nextSlug = state.slug ?? buildSuggestedSlug(notebookName);
        setSlug(nextSlug);
      }
      if (!metadataDirty) {
        setMetadataText(serializeMetadata(state.metadata ?? {}));
      }
    } else if (!publishingStateQuery.isLoading && !slugDirty) {
      setSlug(buildSuggestedSlug(notebookName));
      if (!metadataDirty) {
        setMetadataText(serializeMetadata({}));
      }
    }
  }, [
    open,
    publishingStateQuery.data,
    publishingStateQuery.isLoading,
    slugDirty,
    metadataDirty,
    notebookName,
  ]);

  const shareUrl = useMemo(() => computeShareUrl(slug), [slug]);

  const parseMetadata = () => {
    const trimmed = metadataText.trim();
    if (!trimmed || trimmed === "{}") {
      setMetadataError("");
      return { value: null, ok: true };
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setMetadataError("");
        return { value: parsed, ok: true };
      }
      setMetadataError("Metadata must be a JSON object");
      return { value: null, ok: false };
    } catch {
      setMetadataError("Metadata must be valid JSON");
      return { value: null, ok: false };
    }
  };

  const validateSlug = (value) => {
    const normalized = normalizeSlugInput(value);
    if (!normalized || normalized.length < 6) {
      setSlugError("Slug must be at least 6 characters");
      return null;
    }
    setSlugError("");
    return normalized;
  };

  const publishMutation = useMutation({
    mutationFn: async ({ nextSlug, metadata }) => {
      const response = await api.post(`/notebooks/${notebookId}/publish`, {
        slug: nextSlug,
        metadata,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Notebook published");
      publishingStateQuery.refetch().catch(() => {});
      onUpdated?.({
        notebookId,
        action: "publish",
        state: data ?? null,
      });
    },
    onError: (error) => {
      const message =
        error?.response?.data?.message ?? "Failed to publish notebook";
      if (message.toLowerCase().includes("slug")) {
        setSlugError(message);
      }
      toast.error(message);
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/notebooks/${notebookId}/publish`);
    },
    onSuccess: () => {
      toast.success("Notebook is now private");
      publishingStateQuery.refetch().catch(() => {});
      onUpdated?.({
        notebookId,
        action: "unpublish",
        state: null,
      });
    },
    onError: (error) => {
      const message =
        error?.response?.data?.message ?? "Failed to unpublish notebook";
      toast.error(message);
    },
  });

  if (!open || !notebookId) {
    return null;
  }

  const state = publishingStateQuery.data ?? null;
  const isPublic = Boolean(state?.isPublic);
  const publishedAt = state?.publishedAt ? new Date(state.publishedAt) : null;
  const lastPublishedAt = state?.lastPublishedAt
    ? new Date(state.lastPublishedAt)
    : null;

  const handleRegenerateSlug = () => {
    setSlug(buildSuggestedSlug(notebookName));
    setSlugDirty(true);
  };

  const handleCopyShareUrl = () => {
    if (!shareUrl) return;
    navigator.clipboard
      ?.writeText(shareUrl)
      .then(() => {
        setCopied(true);
        toast.success("Share URL copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        toast.error("Unable to copy link");
      });
  };

  const handlePublish = (event) => {
    event.preventDefault();
    const normalizedSlug = validateSlug(slug);
    if (!normalizedSlug) {
      return;
    }
    const metadataResult = parseMetadata();
    if (!metadataResult.ok) {
      return;
    }
    publishMutation.mutate({
      nextSlug: normalizedSlug,
      metadata: metadataResult.value,
    });
  };

  const handleUnpublish = () => {
    unpublishMutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-[97] flex items-center justify-center bg-black/40 px-4 py-10 sm:px-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-[28px] border border-base-300/50 bg-base-100/95 px-6 py-6 shadow-2xl backdrop-blur-sm sm:px-8"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-base-content">
              Publish “{notebookName}”
            </h2>
            <p className="text-sm text-base-content/70">
              Create a public snapshot you can share. You can update or
              unpublish anytime.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
          >
            <XIcon className="size-4" />
            Close
          </button>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <form className="space-y-5" onSubmit={handlePublish}>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-base-content">
                <GlobeIcon className="size-4" />
                Public slug
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  className={`input input-bordered flex-1 ${
                    slugError ? "input-error" : ""
                  }`}
                  value={slug}
                  onChange={(event) => {
                    setSlug(event.target.value);
                    setSlugDirty(true);
                    setSlugError("");
                  }}
                  placeholder="e.g. notebook-launch-plan"
                  autoFocus={!isPublic}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleRegenerateSlug}
                >
                  <RefreshCwIcon className="size-4" />
                  Regenerate
                </button>
              </div>
              {slugError ? (
                <p className="mt-1 text-xs text-error">{slugError}</p>
              ) : (
                <p className="mt-1 text-xs text-base-content/60">
                  Lowercase letters, numbers, and dashes only. Minimum 6
                  characters.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-base-content">
                Metadata (optional)
              </label>
              <textarea
                className={`textarea textarea-bordered mt-2 h-40 font-mono text-xs ${
                  metadataError ? "textarea-error" : ""
                }`}
                value={metadataText}
                onChange={(event) => {
                  setMetadataText(event.target.value);
                  setMetadataDirty(true);
                  setMetadataError("");
                }}
                placeholder={`{\n  "title": "Public page title"\n}`}
              />
              {metadataError ? (
                <p className="mt-1 text-xs text-error">{metadataError}</p>
              ) : (
                <p className="mt-1 text-xs text-base-content/60">
                  Provide structured JSON used for SEO or embeds.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={publishMutation.isLoading}
              >
                {publishMutation.isLoading ? (
                  <LoaderIcon className="size-4 animate-spin" />
                ) : (
                  <CheckIcon className="size-4" />
                )}
                {isPublic ? "Update publish settings" : "Publish notebook"}
              </button>
              {isPublic ? (
                <button
                  type="button"
                  className="btn btn-outline btn-error"
                  onClick={handleUnpublish}
                  disabled={unpublishMutation.isLoading}
                >
                  {unpublishMutation.isLoading ? (
                    <LoaderIcon className="size-4 animate-spin" />
                  ) : (
                    <ShieldOffIcon className="size-4" />
                  )}
                  Unpublish
                </button>
              ) : null}
            </div>

            {publishMutation.isError ? (
              <div className="alert alert-error text-sm">
                <AlertTriangleIcon className="size-4" />
                <span>
                  {publishMutation.error?.response?.data?.message ??
                    "Could not publish notebook"}
                </span>
              </div>
            ) : null}
          </form>

          <aside className="space-y-4 rounded-2xl border border-base-300/60 bg-base-200/60 p-5">
            <h3 className="text-sm font-semibold text-base-content">
              Share details
            </h3>
            <div className="space-y-2 text-sm text-base-content/70">
              <p>
                {isPublic
                  ? "This notebook is currently live."
                  : "The notebook is private. Publish to generate a shareable link."}
              </p>
              {publishedAt ? (
                <p>
                  First published {formatRelativeTime(publishedAt)} on{" "}
                  {formatDate(publishedAt)}.
                </p>
              ) : null}
              {lastPublishedAt &&
              (!publishedAt || lastPublishedAt > publishedAt) ? (
                <p>
                  Last updated {formatRelativeTime(lastPublishedAt)} on{" "}
                  {formatDate(lastPublishedAt)}.
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-base-300/70 bg-base-100/80 p-4">
              <span className="text-xs font-semibold uppercase text-base-content/60">
                Share link
              </span>
              <div className="mt-2 flex flex-col gap-2">
                <code className="truncate rounded-lg bg-base-200 px-3 py-2 text-xs text-base-content/80">
                  {shareUrl ?? "Publish to generate a public URL"}
                </code>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyShareUrl}
                  disabled={!shareUrl}
                >
                  <ClipboardIcon className="size-4" />
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>
            {state?.snapshotHash ? (
              <div className="rounded-xl border border-base-300/70 bg-base-100/80 p-4 text-xs">
                <p className="font-semibold text-base-content">Snapshot hash</p>
                <p className="mt-1 break-all text-base-content/60">
                  {state.snapshotHash}
                </p>
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </div>
  );
}

export default NotebookPublishDialog;
