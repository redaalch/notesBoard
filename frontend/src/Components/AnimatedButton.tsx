import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { motion } from "framer-motion";

interface AnimatedButtonProps
  extends Omit<ComponentPropsWithoutRef<typeof motion.button>, "children"> {
  children: ReactNode;
  variant?: string;
  size?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const AnimatedButton = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  ...props
}: AnimatedButtonProps) => {
  return (
    <motion.button
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={`btn btn-${variant} btn-${size} relative overflow-hidden ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="loading loading-spinner"
        />
      ) : (
        <motion.span
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {children}
        </motion.span>
      )}

      {/* Ripple effect on click */}
      {!disabled && !loading && (
        <motion.span
          className="absolute inset-0 bg-white/20 rounded-full"
          initial={{ scale: 0, opacity: 0 }}
          whileTap={{ scale: 2, opacity: [0.5, 0] }}
          transition={{ duration: 0.4 }}
        />
      )}
    </motion.button>
  );
};

export default AnimatedButton;
