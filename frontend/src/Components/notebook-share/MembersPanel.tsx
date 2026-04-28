import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  LoaderIcon,
  RefreshCwIcon,
  ShieldIcon,
  Trash2Icon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/axios";
import { extractApiError } from "../../lib/extractApiError";
import { formatRelativeTime } from "../../lib/Utils";
import type { MembersResponse } from "../../types/api";
import {
  INVITE_EXPIRY_OPTIONS,
  MEMBER_ROLE_OPTIONS,
  formatRoleLabel,
  formatStatusBadge,
  type Member,
  type ShareApiError,
} from "./shareHelpers";

interface MembersPanelProps {
  notebookId: string;
  open: boolean;
  onActorRoleChange?: (role: string | null) => void;
}

function MembersPanel({
  notebookId,
  open,
  onActorRoleChange,
}: MembersPanelProps) {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteExpiry, setInviteExpiry] = useState("168");

  useEffect(() => {
    if (!open) {
      setInviteEmail("");
      setInviteRole("viewer");
      setInviteExpiry("168");
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

  const actorRole: string | null = membersQuery.data?.role ?? null;
  const canManageMembers: boolean = membersQuery.data?.canManage ?? false;

  useEffect(() => {
    onActorRoleChange?.(actorRole);
  }, [actorRole, onActorRoleChange]);

  const members = useMemo((): Member[] => {
    if (!Array.isArray(membersQuery.data?.members)) {
      return [];
    }
    return membersQuery.data.members;
  }, [membersQuery.data?.members]);

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
    onSuccess: (data: MembersResponse) => {
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
    onError: (error: Error) => {
      toast.error(extractApiError(error, "Failed to send invitation"));
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
    onSuccess: (data: MembersResponse) => {
      toast.success("Member role updated");
      queryClient.setQueryData(["notebook-members", notebookId], data);
    },
    onError: (error: Error) => {
      toast.error(extractApiError(error, "Failed to update role"));
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ memberId }: { memberId: string }) => {
      const response = await api.delete(
        `/notebooks/${notebookId}/members/${memberId}`,
      );
      return response.data;
    },
    onSuccess: (data: MembersResponse) => {
      toast.success("Member removed");
      queryClient.setQueryData(["notebook-members", notebookId], data);
    },
    onError: (error: Error) => {
      toast.error(extractApiError(error, "Failed to remove member"));
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async ({ memberId }: { memberId: string }) => {
      const response = await api.post(
        `/notebooks/${notebookId}/invitations/${memberId}/resend`,
      );
      return response.data;
    },
    onSuccess: (data: MembersResponse) => {
      toast.success("Invitation resent");
      queryClient.setQueryData(["notebook-members", notebookId], data);
    },
    onError: (error: Error) => {
      toast.error(extractApiError(error, "Failed to resend invitation"));
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async ({ memberId }: { memberId: string }) => {
      const response = await api.post(
        `/notebooks/${notebookId}/invitations/${memberId}/revoke`,
      );
      return response.data;
    },
    onSuccess: (data: MembersResponse) => {
      toast.success("Invitation revoked");
      queryClient.setQueryData(["notebook-members", notebookId], data);
    },
    onError: (error: Error) => {
      toast.error(extractApiError(error, "Failed to revoke invitation"));
    },
  });

  const isLoadingMembers = membersQuery.isLoading;
  const membersErrorMessage = (membersQuery.error as ShareApiError | null)
    ?.response?.data?.message;

  return (
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
              member.id ?? member.userId ?? member.email ?? `member-${index}`;

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
                        Invited {formatRelativeTime(new Date(member.invitedAt))}
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
                              memberId: member.id!,
                            })
                          }
                          disabled={resendInviteMutation.isPending}
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
          You can view members, but only editors or owners can invite others.
        </div>
      )}
    </div>
  );
}

export default MembersPanel;
