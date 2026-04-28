export interface RoleOption {
  value: string;
  label: string;
}

export const MEMBER_ROLE_OPTIONS: RoleOption[] = [
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

export const INVITE_EXPIRY_OPTIONS: RoleOption[] = [
  { value: "24", label: "24 hours" },
  { value: "168", label: "7 days" },
  { value: "720", label: "30 days" },
];

export const SHARE_ROLE_OPTIONS: RoleOption[] = [
  { value: "viewer", label: "Viewer" },
  { value: "editor", label: "Editor" },
];

export const SHARE_EXPIRY_OPTIONS: RoleOption[] = [
  { value: "24", label: "24 hours" },
  { value: "168", label: "7 days" },
  { value: "720", label: "30 days" },
  { value: "never", label: "Never expires" },
];

export const formatRoleLabel = (role: string | null | undefined): string => {
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

export const formatStatusBadge = (
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

export interface Member {
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

export interface ShareLink {
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

export type ShareApiError = { response?: { data?: { message?: string } } };
