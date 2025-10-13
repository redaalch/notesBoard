import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";

export const ErrorState = ({
  title = "Something went wrong",
  message,
  onRetry,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="alert alert-error shadow-lg max-w-md mx-auto"
    >
      <AlertTriangle className="w-6 h-6" />
      <div>
        <h3 className="font-bold">{title}</h3>
        {message && <p className="text-sm opacity-80">{message}</p>}
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-sm btn-ghost gap-2">
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      )}
    </motion.div>
  );
};

export default ErrorState;
