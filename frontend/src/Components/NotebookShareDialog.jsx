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
import toast from "react-hot-toast";
import api from "../lib/axios.js";
import { formatDate, formatRelativeTime } from "../lib/Utils.js";

const MEMBER_ROLE_OPTIONS = [
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

const INVITE_EXPIRY_OPTIONS = [
  { value: "24", label: "24 hours" },
  { value: "168", label: "7 days" },
  { value: "720", label: "30 days" },
];

const SHARE_ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer" },
  { value: "editor", label: "Editor" },
];

const SHARE_EXPIRY_OPTIONS = [
  { value: "24", label: "24 hours" },
  { value: "168", label: "7 days" },
  { value: "720", label: "30 days" },
  { value: "never", label: "Never expires" },
];

const formatRoleLabel = (role) => {
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

const formatStatusBadge = (status) => {
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

function NotebookShareDialog({ notebook, open, onClose }) {
  const notebookId = notebook?.id ?? null;
  const notebookName = notebook?.name ?? "Notebook";
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteExpiry, setInviteExpiry] = useState("168");
  const [shareRole, setShareRole] = useState("viewer");
  const [shareExpiry, setShareExpiry] = useState("168");
  const [shareLinkUrls, setShareLinkUrls] = useState(() => new Map());

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
      if (error?.response?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const members = useMemo(() => {
    if (!Array.isArray(membersQuery.data?.members)) {
      return [];
    }
    return membersQuery.data.members;
  }, [membersQuery.data?.members]);

  const shareLinks = useMemo(() => {
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
      const next = new Map();
      shareLinks.forEach((link) => {
        if (prev.has(link.id)) {
          next.set(link.id, prev.get(link.id));
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
    mutationFn: async ({ email, role, expiresInHours }) => {
      const response = await api.post(`/notebooks/${notebookId}/members`, {
        email,
        role,
        expiresInHours,
      });
      return response.data;
    },
    onSuccess: (data) => {
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
    onError: (error) => {
      const message =
        error?.response?.data?.message ?? "Failed to send invitation";
      toast.error(message);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }) => {
      const response = await api.patch(
        `/notebooks/${notebookId}/members/${memberId}`,
        { role }
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Member role updated");
      queryClient.setQueryData(["notebook-members", notebookId], data);
    },
    onError: (error) => {
      const message = error?.response?.data?.message ?? "Failed to update role";
      toast.error(message);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ memberId }) => {
      const response = await api.delete(
        `/notebooks/${notebookId}/members/${memberId}`
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Member removed");
      queryClient.setQueryData(["notebook-members", notebookId], data);
    },
    onError: (error) => {
      const message =
        error?.response?.data?.message ?? "Failed to remove member";
      toast.error(message);
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async ({ memberId }) => {
      const response = await api.post(
        `/notebooks/${notebookId}/invitations/${memberId}/resend`
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Invitation resent");
      queryClient.setQueryData(["notebook-members", notebookId], data);
    },
    onError: (error) => {
      const message =
        error?.response?.data?.message ?? "Failed to resend invitation";
      toast.error(message);
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async ({ memberId }) => {
      const response = await api.post(
        `/notebooks/${notebookId}/invitations/${memberId}/revoke`
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Invitation revoked");
      queryClient.setQueryData(["notebook-members", notebookId], data);
    },
    onError: (error) => {
      const message =
        error?.response?.data?.message ?? "Failed to revoke invitation";
      toast.error(message);
    },
  });

  const createShareLinkMutation = useMutation({
    mutationFn: async ({ role, expiresInHours }) => {
      const response = await api.post(`/notebooks/${notebookId}/share-links`, {
        role,
        expiresInHours,
      });
      return response.data;
    },
    onSuccess: (data) => {
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
    onError: (error) => {
      const message =
        error?.response?.data?.message ?? "Failed to create share link";
      toast.error(message);
    },
  });

  const revokeShareLinkMutation = useMutation({
    mutationFn: async ({ shareLinkId }) => {
      const response = await api.delete(
        `/notebooks/${notebookId}/share-links/${shareLinkId}`
      );
      return response.data;
    },
    onSuccess: (data, variables) => {
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
    onError: (error) => {
      const message =
        error?.response?.data?.message ?? "Failed to revoke share link";
      toast.error(message);
    },
  });

  const handleCopyLink = useCallback((url) => {
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
  const membersErrorMessage = membersQuery.error?.response?.data?.message;

  const isLoadingShareLinks = shareLinksQuery.isLoading;
  const shareLinksErrorMessage = shareLinksQuery.error?.response?.data?.message;

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-black/40 px-4 py-10"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-base-300/50 bg-base-100 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-base-content">
              Share “{notebookName}”
            </h2>
            <p className="text-sm text-base-content/70">
              Invite teammates or generate share links. Your role:
              <span className="ml-1 font-medium">
                {formatRoleLabel(actorRole) ?? "Viewer"}
              </span>
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm border border-base-300/70"
            onClick={onClose}
          >
            <XIcon className="size-4" />
            Close
          </button>
        </header>

        <section className="mt-6 space-y-6">
          <div className="rounded-xl border border-base-300/70 bg-base-100/80 p-4 shadow-sm">
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
              <div className="mt-4 flex items-center gap-2 text-sm text-base-content/70">
                <LoaderIcon className="size-4 animate-spin" /> Loading members…
              </div>
            ) : membersQuery.isError ? (
              <div className="mt-4 alert alert-error text-sm">
                {membersErrorMessage ?? "Failed to load members"}
              </div>
            ) : members.length ? (
              <ul className="mt-4 divide-y divide-base-300/60 rounded-xl border border-base-300/60 bg-base-200/40">
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
                      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
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
                      <div className="flex flex-col gap-2 sm:w-80">
                        <div className="flex items-center gap-2">
                          <ShieldIcon className="size-4 text-secondary" />
                          {canEditMember ? (
                            <select
                              className="select select-bordered select-sm flex-1"
                              value={member.role}
                              onChange={(event) =>
                                updateRoleMutation.mutate({
                                  memberId: member.id,
                                  role: event.target.value,
                                })
                              }
                              disabled={updateRoleMutation.isLoading}
                            >
                              {[
                                ...MEMBER_ROLE_OPTIONS,
                                { value: "owner", label: "Owner" },
                              ].map((option) => (
                                <option key={option.value} value={option.value}>
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
                                  memberId: member.id,
                                })
                              }
                              disabled={resendInviteMutation.isLoading}
                            >
                              <RefreshCwIcon className="size-3" /> Resend invite
                            </button>
                          ) : null}
                          {canRevoke ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs text-warning"
                              onClick={() =>
                                revokeInviteMutation.mutate({
                                  memberId: member.id,
                                })
                              }
                              disabled={revokeInviteMutation.isLoading}
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
                                  memberId: member.id,
                                })
                              }
                              disabled={removeMemberMutation.isLoading}
                            >
                              <Trash2Icon className="size-3" /> Remove
                            </button>
                          ) : null}
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
                className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_minmax(0,10rem)]"
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
                <input
                  type="email"
                  className="input input-bordered"
                  placeholder="teammate@example.com"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  required
                />
                <select
                  className="select select-bordered"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value)}
                >
                  {MEMBER_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <select
                    className="select select-bordered flex-1"
                    value={inviteExpiry}
                    onChange={(event) => setInviteExpiry(event.target.value)}
                  >
                    {INVITE_EXPIRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={inviteMutation.isLoading}
                  >
                    {inviteMutation.isLoading ? (
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

          <div className="rounded-xl border border-base-300/70 bg-base-100/80 p-4 shadow-sm">
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
              <div className="mt-4 flex items-center gap-2 text-sm text-base-content/70">
                <LoaderIcon className="size-4 animate-spin" /> Loading share
                links…
              </div>
            ) : shareLinksQuery.isError ? (
              <div className="mt-4 alert alert-error text-sm">
                {shareLinksErrorMessage ?? "Failed to load share links"}
              </div>
            ) : shareLinks.length ? (
              <ul className="mt-4 space-y-3">
                {shareLinks.map((link) => {
                  const isRevoked = Boolean(link.revokedAt);
                  const expiresLabel = link.expiresAt
                    ? formatRelativeTime(new Date(link.expiresAt))
                    : "No expiry";
                  const url = shareLinkUrls.get(link.id) ?? null;
                  return (
                    <li
                      key={link.id}
                      className="flex flex-col gap-3 rounded-lg border border-base-300/60 bg-base-200/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <UsersIcon className="size-4 text-secondary" />
                          <span>{formatRoleLabel(link.role)} access</span>
                          {isRevoked ? (
                            <span className="badge badge-xs badge-error">
                              Revoked
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-base-content/60">
                          Created {formatRelativeTime(new Date(link.createdAt))}
                          {link.createdByName
                            ? ` by ${link.createdByName}`
                            : ""}
                        </p>
                        <p className="text-xs text-base-content/60">
                          Expires: {expiresLabel}
                        </p>
                        {link.lastAccessedAt ? (
                          <p className="text-[11px] text-base-content/50">
                            Last accessed{" "}
                            {formatRelativeTime(new Date(link.lastAccessedAt))}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!isRevoked ? (
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() => handleCopyLink(url)}
                          >
                            <ClipboardIcon className="size-3.5" /> Copy link
                          </button>
                        ) : null}
                        {link.expiresAt ? (
                          <span className="badge badge-outline gap-1">
                            <ClockIcon className="size-3" />
                            {formatDate(new Date(link.expiresAt))}
                          </span>
                        ) : (
                          <span className="badge badge-outline">No expiry</span>
                        )}
                        {canManageShareLinks ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() =>
                              revokeShareLinkMutation.mutate({
                                shareLinkId: link.id,
                              })
                            }
                            disabled={revokeShareLinkMutation.isLoading}
                          >
                            <Trash2Icon className="size-3" /> Revoke
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-base-content/60">
                No share links have been created yet.
              </p>
            )}

            {canManageShareLinks ? (
              <form
                className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  createShareLinkMutation.mutate({
                    role: shareRole,
                    expiresInHours:
                      shareExpiry === "never" ? null : shareExpiry,
                  });
                }}
              >
                <select
                  className="select select-bordered"
                  value={shareRole}
                  onChange={(event) => setShareRole(event.target.value)}
                >
                  {SHARE_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className="select select-bordered"
                  value={shareExpiry}
                  onChange={(event) => setShareExpiry(event.target.value)}
                >
                  {SHARE_EXPIRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={createShareLinkMutation.isLoading}
                >
                  {createShareLinkMutation.isLoading ? (
                    <LoaderIcon className="size-4 animate-spin" />
                  ) : (
                    <LinkIcon className="size-4" />
                  )}
                  Create link
                </button>
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
