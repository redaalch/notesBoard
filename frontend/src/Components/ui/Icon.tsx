import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

const SIZE_MAP = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
  xl: "size-8",
} as const;

export type IconSize = keyof typeof SIZE_MAP;

export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  size?: IconSize;
}

const Icon = forwardRef<HTMLSpanElement, IconProps>(
  ({ children, size = "md", className, ...props }, ref) => {
    const sizeClass = SIZE_MAP[size] ?? SIZE_MAP.md;

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center shrink-0",
          sizeClass,
          className,
        )}
        aria-hidden="true"
        {...props}
      >
        {children}
      </span>
    );
  },
);

Icon.displayName = "Icon";

export default Icon;
