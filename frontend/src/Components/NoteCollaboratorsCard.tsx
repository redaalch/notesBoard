import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LoaderIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/axios";

export interface Collaborator {
  id: string;
  userId?: string;
  name?: string;
  email?: string;
  role: string;
  addedAt?: string;
  invitedByName?: string;
}

interface CollaboratorsResponse {
  collaborators: Collaborator[];
}

interface InvitePayload {
  email: string;
  role: string;
}

export interface NoteCollaboratorsCardProps {
  noteId: string;
  canManage: boolean;
}

interface RoleOption {
  value: string;
  label: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  { value: "editor", label: "Editor" },
  { value: "commenter", label: "Commenter" },
  { value: "viewer", label: "Viewer" },
];

const getErrorMessage = (error: any): string =>
  error?.response?.data?.message ?? "Something went wrong";

const formatRole = (role: string): string => {
  const option = ROLE_OPTIONS.find((candidate) => candidate.value === role);
  return option?.label ?? role;
};

function NoteCollaboratorsCard({ noteId, canManage }: NoteCollaboratorsCardProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const queryClient = useQueryClient();

  const collaboratorsQuery = useQuery<CollaboratorsResponse>({
    queryKey: ["note-collaborators", noteId],
    queryFn: async () => {
      const response = await api.get(`/notes/${noteId}/collaborators`);
      return response.data;
    },
    enabled: Boolean(noteId),
    staleTime: 15_000,
  });

  const inviteMutation = useMutation<CollaboratorsResponse, any, InvitePayload>({
    mutationFn: async (payload) => {
      const response = await api.post(
        `/notes/${noteId}/collaborators`,
        payload
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Collaborator invited");
      setEmail("");
      if (data?.collaborators) {
        queryClient.setQueryData(["note-collaborators", noteId], data);
      } else {
        queryClient.invalidateQueries({
          queryKey: ["note-collaborators", noteId],
        });
      }
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  const removeMutation = useMutation<CollaboratorsResponse, any, string>({
    mutationFn: async (targetUserId) => {
      const response = await api.delete(
        `/notes/${noteId}/collaborators/${targetUserId}`
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Collaborator removed");
      if (data?.collaborators) {
        queryClient.setQueryData(["note-collaborators", noteId], data);
      } else {
        queryClient.invalidateQueries({
          queryKey: ["note-collaborators", noteId],
        });
      }
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  const collaborators = useMemo(() => {
    const list = collaboratorsQuery.data?.collaborators;
    if (!Array.isArray(list)) {
      return [];
    }
    return [...list].sort((a, b) => {
      if (a.role === b.role) {
        return (a.name ?? "").localeCompare(b.name ?? "");
      }
      if (a.role === "editor") return -1;
      if (b.role === "editor") return 1;
      if (a.role === "commenter") return -1;
      if (b.role === "commenter") return 1;
      return 0;
    });
  }, [collaboratorsQuery.data?.collaborators]);

  const isLoading =
    collaboratorsQuery.isLoading || collaboratorsQuery.isFetching;
  const inviteDisabled = !email.trim() || inviteMutation.isPending;

  const handleInvite = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inviteDisabled || !canManage) {
      return;
    }
    inviteMutation.mutate({ email: email.trim(), role });
  };

  return (
    <div className="card border border-base-300/60 bg-base-100/90 shadow-lg rounded-2xl">
      <div className="card-body space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-secondary">
              Note collaborators
            </h3>
            <p className="text-xs text-base-content/60">
              People added here can access this note even if they are not in the
              workspace
            </p>
          </div>
          <span className="badge badge-outline text-xs px-3 py-1 self-start sm:self-auto">
            {collaborators.length} member{collaborators.length === 1 ? "" : "s"}
          </span>
        </div>

        {collaboratorsQuery.isError ? (
          <div className="alert alert-error text-xs">
            {getErrorMessage(collaboratorsQuery.error)}
          </div>
        ) : null}

        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-base-content/70">
              <LoaderIcon className="size-4 animate-spin" />
              Loading collaborators…
            </div>
          ) : collaborators.length ? (
            <ul className="divide-y divide-base-300/60 rounded-xl border border-base-300/60 bg-base-200/60">
              {collaborators.map((collaborator) => (
                <li
                  key={collaborator.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 text-sm w-full sm:flex-1">
                    <p className="text-sm font-semibold text-base-content">
                      {collaborator.name ?? collaborator.email ?? "Unknown"}
                    </p>
                    {collaborator.email ? (
                      <p className="text-xs text-base-content/60">
                        {collaborator.email}
                      </p>
                    ) : null}
                    {collaborator.invitedByName ? (
                      <p className="text-[11px] text-base-content/50">
                        Invited by {collaborator.invitedByName}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-2 w-full sm:w-auto">
                    {collaborator.role === "editor" ? (
                      <span className="badge badge-sm badge-primary gap-1">
                        <ShieldCheckIcon className="size-3" />
                        {formatRole(collaborator.role)}
                      </span>
                    ) : (
                      <span className="badge badge-sm badge-outline">
                        {formatRole(collaborator.role)}
                      </span>
                    )}
                    {canManage ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => removeMutation.mutate(collaborator.id)}
                        disabled={removeMutation.isPending}
                        aria-label={`Remove ${
                          collaborator.email ??
                          collaborator.name ??
                          "collaborator"
                        }`}
                      >
                        {removeMutation.isPending ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Trash2Icon className="size-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-base-content/60">
              No one has been invited to this note yet.
            </p>
          )}
        </div>

        {canManage ? (
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                placeholder="guest@example.com"
                className="input input-bordered flex-1 rounded-xl bg-base-200/70"
                value={email}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                required
              />
              <select
                className="select select-bordered rounded-xl bg-base-200/70 sm:max-w-[12rem]"
                value={role}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setRole(event.target.value)}
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
              {inviteMutation.isPending ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <UserPlusIcon className="size-4" />
              )}
              Invite collaborator
            </button>
          </form>
        ) : (
          <p className="text-xs text-base-content/60">
            Only note owners or workspace admins can invite new collaborators.
          </p>
        )}
      </div>
    </div>
  );
}

export default NoteCollaboratorsCard;
