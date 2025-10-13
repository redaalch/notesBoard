import { motion } from "framer-motion";
import { FileText, Sparkles } from "lucide-react";

export const EmptyState = ({
  icon: IconComponent = FileText,
  title,
  description,
  action,
  actionLabel,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      {/* Animated illustration */}
      <motion.div
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
        <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
          <IconComponent className="w-16 h-16 text-primary/60" />
        </div>

        {/* Decorative elements */}
        <motion.div
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
      </motion.div>

      <h3 className="text-2xl font-bold mb-2">{title}</h3>
      <p className="text-base-content/60 mb-6 max-w-md">{description}</p>

      {action && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={action}
          className="btn btn-primary gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {actionLabel || "Get Started"}
        </motion.button>
      )}
    </motion.div>
  );
};

export default EmptyState;
