import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const VARIANT_CLASSES = {
  base: "surface-base",
  raised: "surface-raised",
  overlay: "surface-overlay",
  inset: "surface-inset",
};

const PADDING = {
  none: "p-0",
  xs: "p-3",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const RADIUS = {
  none: "rounded-none",
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  pill: "rounded-full",
};

const Surface = forwardRef(
  (
    {
      as: asComponent = "div",
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
    const Component = asComponent;
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
