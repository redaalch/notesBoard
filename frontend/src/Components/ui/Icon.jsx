import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const SIZE_MAP = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
  xl: "size-8",
};

/**
 * Icon wrapper component for consistent sizing and stroke weight
 * Wraps lucide-react icons with standardized dimensions
 *
 * @param {Object} props
 * @param {ReactElement} props.children - Icon component from lucide-react
 * @param {('xs'|'sm'|'md'|'lg'|'xl')} props.size - Icon size
 * @param {string} props.className - Additional CSS classes
 */
const Icon = forwardRef(
  ({ children, size = "md", className, ...props }, ref) => {
    const sizeClass = SIZE_MAP[size] ?? SIZE_MAP.md;

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center shrink-0",
          sizeClass,
          className
        )}
        aria-hidden="true"
        {...props}
      >
        {children}
      </span>
    );
  }
);

Icon.displayName = "Icon";

export default Icon;
