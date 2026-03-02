import { useMemo, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LinkIcon,
  LoaderIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/axios";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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
  /** Current user info so we can always show "Owner (You)" */
  owner?: { name?: string; email?: string };
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

/** Two-letter avatar from a name string */
const initials = (name?: string): string => {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? "").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase()
  );
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function NoteCollaboratorsCard({
  noteId,
  canManage,
  owner,
}: NoteCollaboratorsCardProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const queryClient = useQueryClient();

  // ── Queries / mutations ──────────────────────────────────────────

  const collaboratorsQuery = useQuery<CollaboratorsResponse>({
    queryKey: ["note-collaborators", noteId],
    queryFn: async () => {
      const response = await api.get(`/notes/${noteId}/collaborators`);
      return response.data;
    },
    enabled: Boolean(noteId),
    staleTime: 15_000,
  });

  const inviteMutation = useMutation<CollaboratorsResponse, any, InvitePayload>(
    {
      mutationFn: async (payload) => {
        const response = await api.post(
          `/notes/${noteId}/collaborators`,
          payload,
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
    },
  );

  const removeMutation = useMutation<CollaboratorsResponse, any, string>({
    mutationFn: async (targetUserId) => {
      const response = await api.delete(
        `/notes/${noteId}/collaborators/${targetUserId}`,
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

  // ── Publishing queries / mutations ───────────────────────────────

  const publishQuery = useQuery<{
    isPublic: boolean;
    slug: string | null;
    publishedAt: string | null;
  }>({
    queryKey: ["note-publish", noteId],
    queryFn: async () => {
      const response = await api.get(`/notes/${noteId}/publish`);
      return response.data;
    },
    enabled: Boolean(noteId),
    staleTime: 30_000,
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/notes/${noteId}/publish`);
      return response.data;
    },
    onSuccess: (data: any) => {
      toast.success("Note published!");
      queryClient.setQueryData(["note-publish", noteId], {
        isPublic: true,
        slug: data.slug,
        publishedAt: data.publishedAt,
      });
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/notes/${noteId}/publish`);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Note unpublished");
      queryClient.setQueryData(["note-publish", noteId], {
        isPublic: false,
        slug: null,
        publishedAt: null,
      });
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  const isPublished = Boolean(publishQuery.data?.isPublic);
  const publicSlug = publishQuery.data?.slug ?? null;
  const publicUrl = publicSlug
    ? `${window.location.origin}/published/note/${publicSlug}`
    : null;
  const publishBusy = publishMutation.isPending || unpublishMutation.isPending;

  const handleTogglePublish = useCallback(() => {
    if (publishBusy) return;
    if (isPublished) {
      unpublishMutation.mutate();
    } else {
      publishMutation.mutate();
    }
  }, [publishBusy, isPublished, publishMutation, unpublishMutation]);

  const handleCopyPublicLink = useCallback(() => {
    if (!publicUrl) return;
    void navigator.clipboard.writeText(publicUrl);
    toast.success("Public link copied!");
  }, [publicUrl]);

  // ── Derived data ─────────────────────────────────────────────────

  const collaborators = useMemo(() => {
    const list = collaboratorsQuery.data?.collaborators;
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => {
      if (a.role === b.role) return (a.name ?? "").localeCompare(b.name ?? "");
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

  // ── Handlers ─────────────────────────────────────────────────────

  const handleInvite = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inviteDisabled || !canManage) return;
    inviteMutation.mutate({ email: email.trim(), role });
  };

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-0">
      {/* ── Invite row (shown only if user can manage) ── */}
      {canManage ? (
        <form onSubmit={handleInvite} className="flex items-center gap-2">
          <input
            type="email"
            placeholder="Add email or name…"
            className="input input-bordered input-sm min-w-0 flex-[2] rounded-lg bg-base-300/15 text-sm placeholder:text-base-content/40"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {/* Role picker – DaisyUI dropdown */}
          <div className="dropdown dropdown-end flex-shrink-0">
            <label
              tabIndex={0}
              className="btn btn-sm btn-ghost gap-1 rounded-lg border border-base-300/60 bg-base-300/15 px-3 text-sm font-normal text-base-content hover:bg-base-300/30"
            >
              {formatRole(role)}
              <ChevronDownIcon className="size-3.5 text-base-content/50" />
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content z-30 mt-1 w-36 rounded-xl border border-base-300/40 bg-base-100 p-1 shadow-lg"
            >
              {ROLE_OPTIONS.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    className={`flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                      role === opt.value
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-base-content hover:bg-base-300/20"
                    }`}
                    onClick={() => {
                      setRole(opt.value);
                      // Close dropdown by blurring
                      (document.activeElement as HTMLElement)?.blur();
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="submit"
            className={`btn btn-sm flex-shrink-0 rounded-lg px-5 text-sm font-semibold shadow-sm transition-all ${
              inviteDisabled
                ? "btn-disabled border-base-300/60 bg-base-300/20 text-base-content/30"
                : "btn-primary hover:shadow-md"
            }`}
            disabled={inviteDisabled}
          >
            {inviteMutation.isPending ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "Invite"
            )}
          </button>
        </form>
      ) : (
        <p className="text-xs text-base-content/50">
          Only note owners or workspace admins can invite collaborators.
        </p>
      )}

      {/* ── Error banner ── */}
      {collaboratorsQuery.isError && (
        <div className="alert alert-error text-xs mt-4">
          {getErrorMessage(collaboratorsQuery.error)}
        </div>
      )}

      {/* ── People with access ── */}
      <div className="mt-6">
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-base-content/40">
          People with access
        </h4>

        <div className="space-y-1">
          {/* Owner row — always visible */}
          {owner && (
            <div className="flex items-center justify-between rounded-lg px-1 py-2">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-content text-xs font-bold shadow-sm">
                  {initials(owner.name)}
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-medium text-base-content">
                    {owner.name ?? "You"}{" "}
                    <span className="font-normal text-base-content/40">
                      (You)
                    </span>
                  </p>
                  {owner.email && (
                    <p className="text-xs text-base-content/50">
                      {owner.email}
                    </p>
                  )}
                </div>
              </div>
              <span className="text-sm font-medium text-base-content/50">
                Owner
              </span>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center gap-2 px-1 py-2 text-sm text-base-content/60">
              <LoaderIcon className="size-4 animate-spin" />
              Loading…
            </div>
          )}

          {/* Collaborator rows */}
          {!isLoading &&
            collaborators.map((collab) => (
              <div
                key={collab.id}
                className="group flex items-center justify-between rounded-lg px-1 py-2 transition-colors hover:bg-base-300/15"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-base-300 text-base-content/70 text-xs font-bold">
                    {initials(collab.name ?? collab.email)}
                  </div>
                  <div className="leading-tight">
                    <p className="text-sm font-medium text-base-content">
                      {collab.name ?? collab.email ?? "Unknown"}
                    </p>
                    {collab.email && collab.name && (
                      <p className="text-xs text-base-content/50">
                        {collab.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {collab.role === "editor" ? (
                    <span className="badge badge-sm badge-primary gap-1">
                      <ShieldCheckIcon className="size-3" />
                      {formatRole(collab.role)}
                    </span>
                  ) : (
                    <span className="badge badge-sm badge-ghost">
                      {formatRole(collab.role)}
                    </span>
                  )}

                  {canManage && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 text-error transition-opacity"
                      onClick={() => removeMutation.mutate(collab.id)}
                      disabled={removeMutation.isPending}
                      aria-label={`Remove ${collab.email ?? collab.name ?? "collaborator"}`}
                    >
                      {removeMutation.isPending ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Trash2Icon className="size-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

          {/* Empty state (only when not loading and no collaborators) */}
          {!isLoading && collaborators.length === 0 && (
            <p className="px-1 py-2 text-xs text-base-content/40">
              No collaborators yet — invite someone above.
            </p>
          )}
        </div>
      </div>

      {/* ── Publish to web ── */}
      {canManage && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-base-content/[0.04] px-4 py-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex size-8 items-center justify-center rounded-full ${
                  isPublished
                    ? "bg-success/15 text-success"
                    : "bg-base-300 text-base-content/60"
                }`}
              >
                <GlobeIcon className="size-4" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-medium text-base-content">
                  Publish to web
                </p>
                <p className="text-[11px] text-base-content/50">
                  {isPublished
                    ? "Anyone with the link can view"
                    : "Create a public read-only link"}
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              className={`toggle toggle-sm ${isPublished ? "toggle-success" : ""}`}
              checked={isPublished}
              onChange={handleTogglePublish}
              disabled={publishBusy || publishQuery.isLoading}
            />
          </div>

          {/* Public URL row (shown when published) */}
          {isPublished && publicUrl && (
            <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="input input-ghost input-sm min-w-0 flex-1 truncate bg-transparent text-xs text-base-content/70"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                className="btn btn-ghost btn-xs text-success"
                onClick={handleCopyPublicLink}
                title="Copy public link"
              >
                <LinkIcon className="size-3.5" />
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-xs text-success"
                title="Open in new tab"
              >
                <ExternalLinkIcon className="size-3.5" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── Copy link footer ── */}
      <div className="mt-6 flex items-center justify-between rounded-xl bg-base-content/[0.04] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-base-300 text-base-content/60">
            <LinkIcon className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium text-base-content">Restricted</p>
            <p className="text-[11px] text-base-content/50">
              Only invited people can access
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm text-primary font-medium text-sm"
          onClick={handleCopyLink}
        >
          Copy link
        </button>
      </div>
    </div>
  );
}

export default NoteCollaboratorsCard;
