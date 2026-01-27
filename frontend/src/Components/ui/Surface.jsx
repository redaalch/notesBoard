import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const VARIANT_CLASSES = {
  base: "surface-base",
  raised: "surface-raised",
  overlay: "surface-overlay",
  inset: "surface-inset",
  glass: "glass-card",
};

const PADDING = {
  none: "p-0",
  xs: "p-3",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
  xl: "p-10",
};

const RADIUS = {
  none: "rounded-none",
  xs: "rounded-md",
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-3xl",
  pill: "rounded-full",
};

const Surface = forwardRef(
  (
    {
      as: Component = "div", // eslint-disable-line no-unused-vars
      variant = "base",
      padding = "md",
      radius = "lg",
      shadow = true,
      border = true,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const variantClass = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.base;
    const paddingClass = PADDING[padding] ?? PADDING.md;
    const radiusClass = RADIUS[radius] ?? RADIUS.lg;

    return (
      <Component
        ref={ref}
        className={cn(
          "relative",
          variantClass,
          paddingClass,
          radiusClass,
          !shadow && "shadow-none",
          !border && "border-none",
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Surface.displayName = "Surface";

export default Surface;
