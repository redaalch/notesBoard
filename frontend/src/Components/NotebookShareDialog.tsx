import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  ClipboardIcon,
  ClockIcon,
  LinkIcon,
  LoaderIcon,
  RefreshCwIcon,
  ShieldIcon,
  Trash2Icon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/axios";
import { formatDate, formatRelativeTime } from "../lib/Utils";

export interface ShareNotebook {
  id?: string;
  _id?: string;
  name?: string;
}

export interface NotebookShareDialogProps {
  notebook: ShareNotebook | null;
  open: boolean;
  onClose: () => void;
}

interface Member {
  id?: string;
  userId?: string;
  name?: string;
  email?: string;
  role: string;
  status?: string;
  invitedByName?: string;
  invitedAt?: string;
  [key: string]: unknown;
}

interface ShareLink {
  id: string;
  role: string;
  createdAt: string;
  createdByName?: string;
  expiresAt?: string;
  lastAccessedAt?: string;
  revokedAt?: string;
  url?: string;
  [key: string]: unknown;
}

interface RoleOption {
  value: string;
  label: string;
}

const MEMBER_ROLE_OPTIONS: RoleOption[] = [
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

const INVITE_EXPIRY_OPTIONS: RoleOption[] = [
  { value: "24", label: "24 hours" },
  { value: "168", label: "7 days" },
  { value: "720", label: "30 days" },
];

const SHARE_ROLE_OPTIONS: RoleOption[] = [
  { value: "viewer", label: "Viewer" },
  { value: "editor", label: "Editor" },
];

const SHARE_EXPIRY_OPTIONS: RoleOption[] = [
  { value: "24", label: "24 hours" },
  { value: "168", label: "7 days" },
  { value: "720", label: "30 days" },
  { value: "never", label: "Never expires" },
];

const formatRoleLabel = (role: string | null | undefined): string => {
  switch (role) {
    case "owner":
      return "Owner";
    case "editor":
      return "Editor";
    case "viewer":
      return "Viewer";
    default:
      return role ?? "Viewer";
  }
};

const formatStatusBadge = (
  status: string | undefined,
): { label: string; tone: string } => {
  switch (status) {
    case "pending":
      return { label: "Pending", tone: "badge-warning" };
    case "revoked":
      return { label: "Revoked", tone: "badge-error" };
    case "active":
    default:
      return { label: "Active", tone: "badge-success" };
  }
};

function NotebookShareDialog({
  notebook,
  open,
  onClose,
}: NotebookShareDialogProps) {
  const notebookId = notebook?.id ?? null;
  const notebookName = notebook?.name ?? "Notebook";
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteExpiry, setInviteExpiry] = useState("168");
  const [shareRole, setShareRole] = useState("viewer");
  const [shareExpiry, setShareExpiry] = useState("168");
  const [shareLinkUrls, setShareLinkUrls] = useState<Map<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    if (!open) {
      setInviteEmail("");
      setInviteRole("viewer");
      setInviteExpiry("168");
      setShareRole("viewer");
      setShareExpiry("168");
      setShareLinkUrls(new Map());
    }
  }, [open]);

  const membersQuery = useQuery({
    queryKey: ["notebook-members", notebookId],
    enabled: open && Boolean(notebookId),
    queryFn: async () => {
      const response = await api.get(`/notebooks/${notebookId}/members`);
      return response.data;
    },
  });

  const shareLinksQuery = useQuery({
    queryKey: ["notebook-share-links", notebookId],
    enabled: open && Boolean(notebookId),
    queryFn: async () => {
      const response = await api.get(`/notebooks/${notebookId}/share-links`);
      return response.data;
    },
    retry: (failureCount, error) => {
      if ((error as any)?.response?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const members = useMemo((): Member[] => {
    if (!Array.isArray(membersQuery.data?.members)) {
      return [];
    }
    return membersQuery.data.members;
  }, [membersQuery.data?.members]);

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

  const canManageMembers = membersQuery.data?.canManage ?? false;
  const actorRole = membersQuery.data?.role ?? null;
  const canManageShareLinks =
    shareLinksQuery.data?.canManage ?? canManageMembers;

  const inviteMutation = useMutation({
    mutationFn: async ({
      email,
      role,
      expiresInHours,
    }: {
      email: string;
      role: string;
      expiresInHours: string;
    }) => {
      const response = await api.post(`/notebooks/${notebookId}/members`, {
        email,
        role,
        expiresInHours,
      });
      return response.data;
    },
    onSuccess: (data: any) => {
      toast.success("Invitation sent");
      setInviteEmail("");
      if (data?.members) {
        queryClient.setQueryData(["notebook-members", notebookId], data);
      } else {
        queryClient.invalidateQueries({
          queryKey: ["notebook-members", notebookId],
        });
      }
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ?? "Failed to send invitation";
      toast.error(message);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string;
      role: string;
    }) => {
      const response = await api.patch(
        `/notebooks/${notebookId}/members/${memberId}`,
        { role },
      );
      return response.data;
    },
    onSuccess: (data: any) => {
      toast.success("Member role updated");
      queryClient.setQueryData(["notebook-members", notebookId], data);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? "Failed to update role";
      toast.error(message);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ memberId }: { memberId: string }) => {
      const response = await api.delete(
        `/notebooks/${notebookId}/members/${memberId}`,
      );
      return response.data;
    },
    onSuccess: (data: any) => {
      toast.success("Member removed");
      queryClient.setQueryData(["notebook-members", notebookId], data);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ?? "Failed to remove member";
      toast.error(message);
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async ({ memberId }: { memberId: string }) => {
      const response = await api.post(
        `/notebooks/${notebookId}/invitations/${memberId}/resend`,
      );
      return response.data;
    },
    onSuccess: (data: any) => {
      toast.success("Invitation resent");
      queryClient.setQueryData(["notebook-members", notebookId], data);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ?? "Failed to resend invitation";
      toast.error(message);
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async ({ memberId }: { memberId: string }) => {
      const response = await api.post(
        `/notebooks/${notebookId}/invitations/${memberId}/revoke`,
      );
      return response.data;
    },
    onSuccess: (data: any) => {
      toast.success("Invitation revoked");
      queryClient.setQueryData(["notebook-members", notebookId], data);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ?? "Failed to revoke invitation";
      toast.error(message);
    },
  });

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
    onSuccess: (data: any) => {
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
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ?? "Failed to create share link";
      toast.error(message);
    },
  });

  const revokeShareLinkMutation = useMutation({
    mutationFn: async ({ shareLinkId }: { shareLinkId: string }) => {
      const response = await api.delete(
        `/notebooks/${notebookId}/share-links/${shareLinkId}`,
      );
      return response.data;
    },
    onSuccess: (data: any, variables) => {
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
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ?? "Failed to revoke share link";
      toast.error(message);
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

  if (!open || !notebookId) {
    return null;
  }

  const isLoadingMembers = membersQuery.isLoading;
  const membersErrorMessage = (membersQuery.error as any)?.response?.data
    ?.message;

  const isLoadingShareLinks = shareLinksQuery.isLoading;
  const shareLinksErrorMessage = (shareLinksQuery.error as any)?.response?.data
    ?.message;

  return (
    <div
      className="fixed inset-0 z-[96] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10 sm:px-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-[32px] border border-base-300/50 bg-base-100/95 px-5 py-6 shadow-2xl backdrop-blur-sm sm:px-8"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-base-content">
              Share "{notebookName}"
            </h2>
            <p className="text-sm text-base-content/70">
              Invite teammates or generate share links. Your role:
              <span className="ml-1 font-medium text-base-content">
                {formatRoleLabel(actorRole) ?? "Viewer"}
              </span>
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

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-base-300/60 bg-base-100/95 p-6 shadow-md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-base-content">
                  Notebook members
                </h3>
                <p className="text-xs text-base-content/60">
                  Manage people invited directly to this notebook.
                </p>
              </div>
              <span className="badge badge-outline">
                {members.length} member{members.length === 1 ? "" : "s"}
              </span>
            </div>

            {isLoadingMembers ? (
              <div className="mt-5 flex items-center gap-2 text-sm text-base-content/70">
                <LoaderIcon className="size-4 animate-spin" /> Loading members…
              </div>
            ) : membersQuery.isError ? (
              <div className="mt-5 alert alert-error text-sm">
                {membersErrorMessage ?? "Failed to load members"}
              </div>
            ) : members.length ? (
              <ul className="mt-5 space-y-3">
                {members.map((member, index) => {
                  const badge = formatStatusBadge(member.status);
                  const canEditMember =
                    canManageMembers &&
                    member.status === "active" &&
                    member.role !== "owner" &&
                    Boolean(member.id);
                  const canResend =
                    canManageMembers &&
                    member.status === "pending" &&
                    Boolean(member.id);
                  const canRevoke = canResend;
                  const canRemove =
                    canManageMembers &&
                    member.status === "active" &&
                    member.role !== "owner" &&
                    Boolean(member.id);
                  const memberKey =
                    member.id ??
                    member.userId ??
                    member.email ??
                    `member-${index}`;

                  return (
                    <li
                      key={memberKey}
                      className="rounded-2xl border border-base-300/60 bg-base-200/40 px-4 py-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-base-content">
                              {member.name ?? member.email ?? "Unknown"}
                            </span>
                            <span className={`badge badge-xs ${badge.tone}`}>
                              {badge.label}
                            </span>
                          </div>
                          {member.email ? (
                            <p className="text-xs text-base-content/60">
                              {member.email}
                            </p>
                          ) : null}
                          {member.invitedByName ? (
                            <p className="text-[11px] text-base-content/50">
                              Invited by {member.invitedByName}
                            </p>
                          ) : null}
                          {member.invitedAt ? (
                            <p className="text-[11px] text-base-content/50">
                              Invited{" "}
                              {formatRelativeTime(new Date(member.invitedAt))}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-2 lg:w-64">
                          <div className="flex items-center gap-2">
                            <ShieldIcon className="size-4 text-secondary" />
                            {canEditMember ? (
                              <select
                                className="select select-bordered select-sm w-full"
                                value={member.role}
                                onChange={(event) =>
                                  updateRoleMutation.mutate({
                                    memberId: member.id!,
                                    role: event.target.value,
                                  })
                                }
                                disabled={updateRoleMutation.isPending}
                              >
                                {[
                                  ...MEMBER_ROLE_OPTIONS,
                                  { value: "owner", label: "Owner" },
                                ].map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="badge badge-sm badge-outline">
                                {formatRoleLabel(member.role)}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {canResend ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() =>
                                  resendInviteMutation.mutate({
                                    memberId: member.id!,
                                  })
                                }
                                disabled={resendInviteMutation.isPending}
                              >
                                <RefreshCwIcon className="size-3" /> Resend
                                invite
                              </button>
                            ) : null}
                            {canRevoke ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs text-warning"
                                onClick={() =>
                                  revokeInviteMutation.mutate({
                                    memberId: member.id!,
                                  })
                                }
                                disabled={revokeInviteMutation.isPending}
                              >
                                <XIcon className="size-3" /> Revoke
                              </button>
                            ) : null}
                            {canRemove ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs text-error"
                                onClick={() =>
                                  removeMemberMutation.mutate({
                                    memberId: member.id!,
                                  })
                                }
                                disabled={removeMemberMutation.isPending}
                              >
                                <Trash2Icon className="size-3" /> Remove
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-base-content/60">
                No members yet. Invite your team to collaborate.
              </p>
            )}

            {canManageMembers ? (
              <form
                className="mt-6 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!inviteEmail.trim()) {
                    toast.error("Enter an email address");
                    return;
                  }
                  inviteMutation.mutate({
                    email: inviteEmail.trim(),
                    role: inviteRole,
                    expiresInHours: inviteExpiry,
                  });
                }}
              >
                <div>
                  <label className="block text-sm font-medium text-base-content/80 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    className="input input-bordered w-full"
                    placeholder="teammate@example.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-base-content/80 mb-1.5">
                      Role
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={inviteRole}
                      onChange={(event) => setInviteRole(event.target.value)}
                    >
                      {MEMBER_ROLE_OPTIONS.map((option) => (
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
                      value={inviteExpiry}
                      onChange={(event) => setInviteExpiry(event.target.value)}
                    >
                      {INVITE_EXPIRY_OPTIONS.map((option) => (
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
                    className="btn btn-primary min-w-[7rem]"
                    disabled={inviteMutation.isPending}
                  >
                    {inviteMutation.isPending ? (
                      <LoaderIcon className="size-4 animate-spin" />
                    ) : (
                      <UserPlusIcon className="size-4" />
                    )}
                    Invite
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 flex items-center gap-2 text-xs text-base-content/60">
                <AlertTriangleIcon className="size-3" />
                You can view members, but only editors or owners can invite
                others.
              </div>
            )}
          </div>

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
                <LoaderIcon className="size-4 animate-spin" /> Loading share
                links…
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
                                Created{" "}
                                {formatRelativeTime(new Date(link.createdAt))}
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
                                {formatRelativeTime(
                                  new Date(link.lastAccessedAt),
                                )}
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
                    expiresInHours:
                      shareExpiry === "never" ? null : shareExpiry,
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
                You can open existing links, but only editors or owners can
                create new ones.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default NotebookShareDialog;
