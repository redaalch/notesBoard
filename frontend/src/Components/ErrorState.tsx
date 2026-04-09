import { m } from "framer-motion";
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState = ({
  title = "Something went wrong",
  message,
  onRetry,
}: ErrorStateProps) => {
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="alert alert-error shadow-lg max-w-md mx-auto"
    >
      <AlertTriangleIcon className="size-6" />
      <div>
        <h3 className="font-bold">{title}</h3>
        {message && <p className="text-sm opacity-80">{message}</p>}
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-sm btn-ghost gap-2">
          <RefreshCwIcon className="size-4" />
          Retry
        </button>
      )}
    </m.div>
  );
};

export default ErrorState;
