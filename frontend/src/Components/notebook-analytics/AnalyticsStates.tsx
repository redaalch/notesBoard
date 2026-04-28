import { AlertTriangleIcon, LoaderIcon } from "lucide-react";

interface LoadingStateProps {
  label?: string;
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

interface EmptyStateProps {
  message: string;
}

export function LoadingState({ label = "Loading analytics…" }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-base-300/60 bg-base-200/60 py-12 text-sm text-base-content/70">
      <LoaderIcon className="mr-2 size-5 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="alert alert-error">
      <AlertTriangleIcon className="size-5" />
      <div>
        <h3 className="font-semibold">Unable to load analytics</h3>
        <p className="text-sm">{message ?? "Please try again."}</p>
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-base-300/60 bg-base-200/50 px-6 py-12 text-center text-sm text-base-content/60">
      {message}
    </div>
  );
}
