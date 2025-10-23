import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const BASE_CLASSES =
  "inline-flex items-center justify-center font-semibold rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base disabled:opacity-60 disabled:cursor-not-allowed gap-2";

const SIZE_VARIANTS = {
  xs: "h-8 px-3 text-xs",
  sm: "h-9 px-3.5 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
  xl: "h-14 px-6 text-base",
};

const ICON_WRAPPER = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-4",
  lg: "size-5",
  xl: "size-5",
};

const VARIANT_MAP = {
  primary: {
    solid:
      "bg-brand-600 text-white hover:bg-brand-500 focus-visible:ring-brand-300",
    subtle:
      "bg-brand-50 text-brand-700 hover:bg-brand-100 focus-visible:ring-brand-200",
    outline:
      "border border-brand-200 text-brand-700 hover:bg-brand-50 focus-visible:ring-brand-200",
    ghost: "text-brand-600 hover:bg-brand-50 focus-visible:ring-brand-200",
  },
  neutral: {
    solid:
      "bg-surface-raised text-text-primary border border-border-subtle hover:bg-surface-base focus-visible:ring-border-strong",
    subtle:
      "bg-surface-base text-text-muted border border-border-subtle hover:bg-surface-raised focus-visible:ring-border-subtle",
    outline:
      "border border-border-subtle text-text-primary hover:bg-surface-base focus-visible:ring-border-strong",
    ghost:
      "text-text-muted hover:bg-surface-base focus-visible:ring-border-subtle",
  },
  accent: {
    solid:
      "bg-emerald-500 text-white hover:bg-emerald-500/90 focus-visible:ring-emerald-400",
    subtle:
      "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-300",
    outline:
      "border border-emerald-200 text-emerald-700 hover:bg-emerald-50 focus-visible:ring-emerald-200",
    ghost:
      "text-emerald-600 hover:bg-emerald-50 focus-visible:ring-emerald-200",
  },
  danger: {
    solid: "bg-error text-white hover:bg-error/90 focus-visible:ring-error",
    subtle:
      "bg-error/10 text-error hover:bg-error/15 focus-visible:ring-error/40",
    outline:
      "border border-error/60 text-error hover:bg-error/10 focus-visible:ring-error/40",
    ghost: "text-error hover:bg-error/10 focus-visible:ring-error/30",
  },
};

const resolveClasses = (tone, variant) => {
  const toneEntry = VARIANT_MAP[tone] ?? VARIANT_MAP.primary;
  return toneEntry[variant] ?? toneEntry.solid;
};

const Spinner = () => (
  <span
    className="inline-flex size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    aria-hidden="true"
  />
);

const Button = forwardRef(
  (
    {
      as: asComponent = "button",
      children,
      className,
      tone = "primary",
      variant = "solid",
      size = "md",
      icon = null,
      iconPosition = "left",
      loading = false,
      fullWidth = false,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const resolvedVariant = resolveClasses(tone, variant);
    const sizeClass = SIZE_VARIANTS[size] ?? SIZE_VARIANTS.md;
    const iconWrapperClass = ICON_WRAPPER[size] ?? ICON_WRAPPER.md;
    const isDisabled = disabled || loading;
    const showIconLeft = icon && iconPosition === "left";
    const showIconRight = icon && iconPosition === "right";
    const Component = asComponent;

    return (
      <Component
        ref={ref}
        className={cn(
          BASE_CLASSES,
          sizeClass,
          resolvedVariant,
          fullWidth && "w-full",
          loading && "pointer-events-none",
          className
        )}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <Spinner />
        ) : (
          <>
            {showIconLeft ? (
              <span
                className={cn(
                  "inline-flex items-center justify-center",
                  iconWrapperClass
                )}
              >
                {icon}
              </span>
            ) : null}
            <span className="whitespace-nowrap">{children}</span>
            {showIconRight ? (
              <span
                className={cn(
                  "inline-flex items-center justify-center",
                  iconWrapperClass
                )}
              >
                {icon}
              </span>
            ) : null}
          </>
        )}
      </Component>
    );
  }
);

Button.displayName = "Button";

export default Button;
