import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  ClipboardIcon,
  ClockIcon,
  LinkIcon,
  LoaderIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/axios";
import { extractApiError } from "../../lib/extractApiError";
import { formatDate, formatRelativeTime } from "../../lib/Utils";
import type {
  ShareLinkCreated,
  ShareLinksResponse,
} from "../../types/api";
import {
  SHARE_EXPIRY_OPTIONS,
  SHARE_ROLE_OPTIONS,
  formatRoleLabel,
  type ShareApiError,
  type ShareLink,
} from "./shareHelpers";

interface ShareLinksPanelProps {
  notebookId: string;
  open: boolean;
}

function ShareLinksPanel({ notebookId, open }: ShareLinksPanelProps) {
  const queryClient = useQueryClient();
  const [shareRole, setShareRole] = useState("viewer");
  const [shareExpiry, setShareExpiry] = useState("168");
  const [shareLinkUrls, setShareLinkUrls] = useState<Map<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    if (!open) {
      setShareRole("viewer");
      setShareExpiry("168");
      setShareLinkUrls(new Map());
    }
  }, [open]);

  const shareLinksQuery = useQuery({
    queryKey: ["notebook-share-links", notebookId],
    enabled: open && Boolean(notebookId),
    queryFn: async () => {
      const response = await api.get(`/notebooks/${notebookId}/share-links`);
      return response.data;
    },
    retry: (failureCount, error) => {
      if (
        (error as { response?: { status?: number } })?.response?.status === 403
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const shareLinks = useMemo((): ShareLink[] => {
    if (!Array.isArray(shareLinksQuery.data?.shareLinks)) {
      return [];
    }
    return shareLinksQuery.data.shareLinks;
  }, [shareLinksQuery.data?.shareLinks]);

  useEffect(() => {
    if (!shareLinks.length) {
      setShareLinkUrls((prev) => {
        if (prev.size === 0) return prev;
        return new Map();
      });
      return;
    }
    setShareLinkUrls((prev) => {
      const next = new Map<string, string>();
      shareLinks.forEach((link) => {
        if (prev.has(link.id)) {
          next.set(link.id, prev.get(link.id)!);
        }
      });
      return next;
    });
  }, [shareLinks]);

  const canManageShareLinks: boolean = shareLinksQuery.data?.canManage ?? false;

  const createShareLinkMutation = useMutation({
    mutationFn: async ({
      role,
      expiresInHours,
    }: {
      role: string;
      expiresInHours: string | null;
    }) => {
      const response = await api.post(`/notebooks/${notebookId}/share-links`, {
        role,
        expiresInHours,
      });
      return response.data;
    },
    onSuccess: (data: ShareLinkCreated) => {
      const link = data?.shareLink;
      if (link?.url) {
        setShareLinkUrls((prev) => {
          const next = new Map(prev);
          next.set(link.id, link.url);
          return next;
        });
        const copyResult = navigator.clipboard?.writeText(link.url);
        if (copyResult?.then) {
          copyResult
            .then(() => toast.success("Share link copied to clipboard"))
            .catch(() => toast.success("Share link ready to share"));
        } else {
          toast.success("Share link ready to share");
        }
      } else {
        toast.success("Share link created");
      }
      queryClient.invalidateQueries({
        queryKey: ["notebook-share-links", notebookId],
      });
    },
    onError: (error: Error) => {
      toast.error(extractApiError(error, "Failed to create share link"));
    },
  });

  const revokeShareLinkMutation = useMutation({
    mutationFn: async ({ shareLinkId }: { shareLinkId: string }) => {
      const response = await api.delete(
        `/notebooks/${notebookId}/share-links/${shareLinkId}`,
      );
      return response.data;
    },
    onSuccess: (data: ShareLinksResponse, variables) => {
      toast.success("Share link revoked");
      queryClient.setQueryData(["notebook-share-links", notebookId], data);
      if (variables?.shareLinkId) {
        setShareLinkUrls((prev) => {
          if (!prev.size) return prev;
          const next = new Map(prev);
          next.delete(variables.shareLinkId);
          return next;
        });
      }
    },
    onError: (error: Error) => {
      toast.error(extractApiError(error, "Failed to revoke share link"));
    },
  });

  const handleCopyLink = useCallback((url: string | null | undefined) => {
    if (!url) {
      toast.error("Link is no longer available to copy");
      return;
    }
    navigator.clipboard
      ?.writeText(url)
      .then(() => toast.success("Link copied to clipboard"))
      .catch(() => toast.error("Failed to copy link"));
  }, []);

  const isLoadingShareLinks = shareLinksQuery.isLoading;
  const shareLinksErrorMessage = (
    shareLinksQuery.error as ShareApiError | null
  )?.response?.data?.message;

  return (
    <div className="rounded-2xl border border-base-300/60 bg-base-100/95 p-6 shadow-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-base-content">
            Share links
          </h3>
          <p className="text-xs text-base-content/60">
            Generate a link to grant temporary access.
          </p>
        </div>
        <LinkIcon className="size-5 text-primary" />
      </div>

      {isLoadingShareLinks ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-base-content/70">
          <LoaderIcon className="size-4 animate-spin" /> Loading share links…
        </div>
      ) : shareLinksQuery.isError ? (
        <div className="mt-5 alert alert-error text-sm">
          {shareLinksErrorMessage ?? "Failed to load share links"}
        </div>
      ) : shareLinks.length ? (
        <ul className="mt-5 space-y-3">
          {shareLinks.map((link) => {
            const isRevoked = Boolean(link.revokedAt);
            const expiresLabel = link.expiresAt
              ? formatRelativeTime(new Date(link.expiresAt))
              : "No expiry";
            const url = shareLinkUrls.get(link.id) ?? null;
            return (
              <li
                key={link.id}
                className="rounded-xl border border-base-300/70 bg-gradient-to-br from-base-200/50 to-base-200/30 p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                        <UsersIcon className="size-4 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-base-content">
                            {formatRoleLabel(link.role)} access
                          </span>
                          {isRevoked ? (
                            <span className="badge badge-xs badge-error">
                              Revoked
                            </span>
                          ) : (
                            <span className="badge badge-xs badge-success">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-base-content/60">
                          Created {formatRelativeTime(new Date(link.createdAt))}
                          {link.createdByName
                            ? ` by ${link.createdByName}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/70">
                    <div className="flex items-center gap-1.5">
                      <ClockIcon className="size-3.5" />
                      <span>Expires: {expiresLabel}</span>
                    </div>
                    {link.lastAccessedAt ? (
                      <>
                        <span className="text-base-content/30">•</span>
                        <span>
                          Last used{" "}
                          {formatRelativeTime(new Date(link.lastAccessedAt))}
                        </span>
                      </>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-base-300/50">
                    {!isRevoked ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary gap-1.5"
                        onClick={() => handleCopyLink(url)}
                      >
                        <ClipboardIcon className="size-3.5" />
                        Copy link
                      </button>
                    ) : null}
                    {link.expiresAt && !isRevoked ? (
                      <div className="badge badge-outline gap-1.5">
                        <ClockIcon className="size-3" />
                        {formatDate(new Date(link.expiresAt))}
                      </div>
                    ) : null}
                    <div className="flex-1"></div>
                    {canManageShareLinks ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-error hover:bg-error/10 gap-1.5"
                        onClick={() =>
                          revokeShareLinkMutation.mutate({
                            shareLinkId: link.id,
                          })
                        }
                        disabled={revokeShareLinkMutation.isPending}
                      >
                        <Trash2Icon className="size-3.5" />
                        Revoke
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-base-content/60">
          No share links have been created yet.
        </p>
      )}

      {canManageShareLinks ? (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createShareLinkMutation.mutate({
              role: shareRole,
              expiresInHours: shareExpiry === "never" ? null : shareExpiry,
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-base-content/80 mb-1.5">
                Role
              </label>
              <select
                className="select select-bordered w-full"
                value={shareRole}
                onChange={(event) => setShareRole(event.target.value)}
              >
                {SHARE_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-base-content/80 mb-1.5">
                Expires in
              </label>
              <select
                className="select select-bordered w-full"
                value={shareExpiry}
                onChange={(event) => setShareExpiry(event.target.value)}
              >
                {SHARE_EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="btn btn-secondary min-w-[8rem]"
              disabled={createShareLinkMutation.isPending}
            >
              {createShareLinkMutation.isPending ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <LinkIcon className="size-4" />
              )}
              Create link
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex items-center gap-2 text-xs text-base-content/60">
          <AlertTriangleIcon className="size-3" />
          You can open existing links, but only editors or owners can create new
          ones.
        </div>
      )}
    </div>
  );
}

export default ShareLinksPanel;
