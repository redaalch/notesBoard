import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const TAG_VARIANTS = {
  neutral: {
    subtle: "bg-surface-base text-text-muted border border-border-subtle/40",
    outline: "border border-border-subtle text-text-muted bg-transparent",
  },
  primary: {
    subtle: "bg-brand-50 text-brand-700 border border-brand-200/60",
    outline: "border border-brand-300 text-brand-700 bg-transparent",
  },
  accent: {
    subtle: "bg-emerald-50 text-emerald-600 border border-emerald-200/60",
    outline: "border border-emerald-300 text-emerald-600 bg-transparent",
  },
  info: {
    subtle: "bg-blue-50 text-blue-600 border border-blue-200/60",
    outline: "border border-blue-300 text-blue-600 bg-transparent",
  },
  warning: {
    subtle: "bg-amber-50 text-amber-600 border border-amber-200/60",
    outline: "border border-amber-300 text-amber-600 bg-transparent",
  },
  danger: {
    subtle: "bg-error/10 text-error border border-error/40",
    outline: "border border-error/60 text-error bg-transparent",
  },
};

const resolveTagClasses = (tone, variant) => {
  const toneEntry = TAG_VARIANTS[tone] ?? TAG_VARIANTS.neutral;
  return toneEntry[variant] ?? toneEntry.subtle;
};

const Tag = forwardRef(
  (
    {
      as: asComponent = "span",
      tone = "neutral",
      variant = "subtle",
      icon = null,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const Component = asComponent;
    const tagClasses = resolveTagClasses(tone, variant);

    return (
      <Component
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
          tagClasses,
          className
        )}
        {...props}
      >
        {icon ? (
          <span className="inline-flex size-3.5 items-center justify-center">
            {icon}
          </span>
        ) : null}
        <span className="uppercase tracking-[0.18em] text-current">
          {children}
        </span>
      </Component>
    );
  }
);

Tag.displayName = "Tag";

export default Tag;
