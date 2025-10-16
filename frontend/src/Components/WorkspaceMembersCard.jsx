import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderIcon, ShieldCheckIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/axios";

const ROLE_LABELS = {
  viewer: "Viewer",
  commenter: "Commenter",
  editor: "Editor",
  admin: "Admin",
};

const ROLE_OPTIONS = Object.entries(ROLE_LABELS)
  .filter(([value]) => value !== "owner")
  .map(([value, label]) => ({ value, label }));

const getErrorMessage = (error) =>
  error?.response?.data?.message ?? "Something went wrong";

const WorkspaceMembersCard = ({ workspaceId, canManage }) => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");

  const membersQuery = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: async () => {
      const response = await api.get(`/workspaces/${workspaceId}/members`);
      return response.data;
    },
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post(
        `/workspaces/${workspaceId}/members`,
        payload
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Collaborator added");
      setEmail("");
      if (data?.members) {
        queryClient.setQueryData(["workspace-members", workspaceId], data);
      } else {
        queryClient.invalidateQueries({
          queryKey: ["workspace-members", workspaceId],
        });
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const rawMembers = membersQuery.data?.members;
  const members = useMemo(
    () => (Array.isArray(rawMembers) ? rawMembers : []),
    [rawMembers]
  );
  const workspaceName = membersQuery.data?.workspaceName ?? "Workspace";
  const isLoading = membersQuery.isLoading || membersQuery.isFetching;
  const canManageMembers =
    typeof canManage === "boolean"
      ? canManage
      : Boolean(membersQuery.data?.canManage);

  const inviteDisabled =
    !email.trim() || inviteMutation.isLoading || !canManageMembers;

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.isOwner && !b.isOwner) return -1;
      if (!a.isOwner && b.isOwner) return 1;
      if (a.role === b.role) return (a.name ?? "").localeCompare(b.name ?? "");
      if (a.role === "admin") return -1;
      if (b.role === "admin") return 1;
      if (a.role === "editor") return -1;
      if (b.role === "editor") return 1;
      return 0;
    });
  }, [members]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canManageMembers || inviteDisabled) return;
    inviteMutation.mutate({ email: email.trim(), role });
  };

  return (
    <div className="card border border-base-300/60 bg-base-100/90 shadow-lg rounded-2xl">
      <div className="card-body space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-secondary">
              Collaborators
            </h3>
            <p className="text-xs text-base-content/60">
              {`Workspace: ${workspaceName}`}
            </p>
          </div>
          <span className="badge badge-outline text-xs px-3 py-1 self-start sm:self-auto">
            {members.length} member{members.length === 1 ? "" : "s"}
          </span>
        </div>

        {membersQuery.isError ? (
          <div className="alert alert-error text-xs">
            {getErrorMessage(membersQuery.error)}
          </div>
        ) : null}

        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-base-content/70">
              <LoaderIcon className="size-4 animate-spin" />
              Loading collaborators…
            </div>
          ) : sortedMembers.length ? (
            <ul className="divide-y divide-base-300/60 rounded-xl border border-base-300/60 bg-base-200/60">
              {sortedMembers.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-base-content">
                      {member.name ?? "Unknown"}
                    </p>
                    {member.email ? (
                      <p className="text-xs text-base-content/60">
                        {member.email}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {member.isOwner ? (
                      <span className="badge badge-sm badge-primary gap-1">
                        <ShieldCheckIcon className="size-3" /> Owner
                      </span>
                    ) : (
                      <span className="badge badge-sm badge-outline">
                        {ROLE_LABELS[member.role] ?? member.role}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-base-content/60">
              No collaborators yet. Invite someone to get started.
            </p>
          )}
        </div>

        {canManageMembers ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                placeholder="guest@example.com"
                className="input input-bordered flex-1 rounded-xl bg-base-200/70"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={!canManageMembers}
                required
              />
              <select
                className="select select-bordered rounded-xl bg-base-200/70 sm:max-w-[12rem]"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                disabled={!canManageMembers}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-sm sm:btn-md gap-2"
              disabled={inviteDisabled}
            >
              {inviteMutation.isLoading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <UserPlusIcon className="size-4" />
              )}
              Invite collaborator
            </button>
          </form>
        ) : (
          <p className="text-xs text-base-content/60">
            Only workspace owners or admins can invite new collaborators.
          </p>
        )}
      </div>
    </div>
  );
};

export default WorkspaceMembersCard;
