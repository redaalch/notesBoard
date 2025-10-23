import { forwardRef } from "react";
import { XIcon } from "lucide-react";
import { cn } from "../../lib/cn.js";

const CHIP_VARIANTS = {
  neutral: {
    solid: "bg-surface-raised text-text-primary border border-border-subtle",
    subtle: "bg-surface-base text-text-muted border border-border-subtle/60",
    outline: "border border-border-subtle text-text-primary bg-transparent",
  },
  primary: {
    solid: "bg-brand-100 text-brand-700 border border-brand-200",
    subtle: "bg-brand-50 text-brand-700 border border-transparent",
    outline: "border border-brand-200 text-brand-700 bg-transparent",
  },
  accent: {
    solid: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    subtle: "bg-emerald-50 text-emerald-600 border border-transparent",
    outline: "border border-emerald-200 text-emerald-600 bg-transparent",
  },
  success: {
    solid: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    subtle: "bg-emerald-50 text-emerald-600 border border-transparent",
    outline: "border border-emerald-200 text-emerald-600 bg-transparent",
  },
  warning: {
    solid: "bg-amber-100 text-amber-700 border border-amber-200",
    subtle: "bg-amber-50 text-amber-600 border border-transparent",
    outline: "border border-amber-200 text-amber-700 bg-transparent",
  },
  danger: {
    solid: "bg-error/15 text-error border border-error/60",
    subtle: "bg-error/10 text-error border border-transparent",
    outline: "border border-error/60 text-error bg-transparent",
  },
};

const resolveChipClasses = (tone, variant) => {
  const toneEntry = CHIP_VARIANTS[tone] ?? CHIP_VARIANTS.neutral;
  return toneEntry[variant] ?? toneEntry.subtle;
};

const Chip = forwardRef(
  (
    {
      as: asComponent = "span",
      tone = "neutral",
      variant = "subtle",
      icon = null,
      after = null,
      onRemove,
      removeLabel = "Remove",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Component = asComponent;
    const chipClasses = resolveChipClasses(tone, variant);

    return (
      <Component
        ref={ref}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium tracking-tight",
          chipClasses,
          className
        )}
        {...props}
      >
        {icon ? (
          <span className="inline-flex size-4 items-center justify-center">
            {icon}
          </span>
        ) : null}
        <span className="leading-none text-current">{children}</span>
        {after ? (
          <span className="inline-flex items-center text-subtle">{after}</span>
        ) : null}
        {typeof onRemove === "function" ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex size-5 items-center justify-center rounded-full text-current transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand-300"
            aria-label={removeLabel}
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </Component>
    );
  }
);

Chip.displayName = "Chip";

export default Chip;
