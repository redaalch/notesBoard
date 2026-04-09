import type { AppIcon } from "../types/icon";
import { m } from "framer-motion";
import { FileTextIcon, SparklesIcon } from "lucide-react";

export interface EmptyStateProps {
  icon?: AppIcon;
  title: string;
  description: string;
  action?: () => void;
  actionLabel?: string;
}

export const EmptyState = ({
  icon: IconComponent = FileTextIcon,
  title,
  description,
  action,
  actionLabel,
}: EmptyStateProps) => {
  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      {/* Animated illustration */}
      <m.div
        animate={{
          y: [0, -10, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="mb-8 relative"
      >
        <div className="size-32 rounded-full bg-primary/10 flex items-center justify-center">
          <IconComponent className="size-16 text-primary/60" />
        </div>

        {/* Decorative elements */}
        <m.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
          }}
          className="absolute inset-0 w-full h-full rounded-full bg-primary/5 blur-2xl -z-10"
        />
      </m.div>

      <h3 className="text-2xl font-bold mb-2">{title}</h3>
      <p className="text-base-content/60 mb-6 max-w-md">{description}</p>

      {action && (
        <m.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={action}
          className="btn btn-primary gap-2"
        >
          <SparklesIcon className="size-4" />
          {actionLabel || "Get Started"}
        </m.button>
      )}
    </m.div>
  );
};

export default EmptyState;
