import { forwardRef } from "react";
import { XIcon } from "lucide-react";
import { cn } from "../../lib/cn.js";

const CHIP_VARIANTS = {
  neutral: {
    solid:
      "bg-neutral-100 text-neutral-900 border border-neutral-300 dark:bg-dark-700 dark:text-dark-50 dark:border-dark-600",
    subtle:
      "bg-neutral-50 text-neutral-700 border border-neutral-200 dark:bg-dark-800 dark:text-dark-100 dark:border-dark-700",
    outline:
      "border border-neutral-300 text-neutral-700 bg-transparent dark:border-dark-600 dark:text-dark-100",
  },
  primary: {
    solid: "bg-brand-100 text-brand-700 border border-brand-200",
    subtle: "bg-brand-50 text-brand-700 border border-brand-100",
    outline: "border border-brand-300 text-brand-700 bg-transparent",
  },
  accent: {
    solid: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    subtle: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    outline: "border border-emerald-300 text-emerald-700 bg-transparent",
  },
  success: {
    solid: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    subtle: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    outline: "border border-emerald-300 text-emerald-700 bg-transparent",
  },
  warning: {
    solid: "bg-amber-100 text-amber-800 border border-amber-200",
    subtle: "bg-amber-50 text-amber-700 border border-amber-100",
    outline: "border border-amber-300 text-amber-700 bg-transparent",
  },
  danger: {
    solid: "bg-red-100 text-red-700 border border-red-200",
    subtle: "bg-red-50 text-red-700 border border-red-100",
    outline: "border border-red-300 text-red-700 bg-transparent",
  },
};

const resolveChipClasses = (tone, variant) => {
  const toneEntry = CHIP_VARIANTS[tone] ?? CHIP_VARIANTS.neutral;
  return toneEntry[variant] ?? toneEntry.subtle;
};

const Chip = forwardRef(
  (
    {
      as: Component = "span", // eslint-disable-line no-unused-vars
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
    const chipClasses = resolveChipClasses(tone, variant);

    return (
      <Component
        ref={ref}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium tracking-tight transition-colors",
          chipClasses,
          className
        )}
        {...props}
      >
        {icon && (
          <span className="inline-flex size-4 items-center justify-center shrink-0">
            {icon}
          </span>
        )}
        <span className="leading-none text-current">{children}</span>
        {after && (
          <span className="inline-flex items-center text-tertiary">
            {after}
          </span>
        )}
        {typeof onRemove === "function" && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-lg text-current transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand-300 dark:hover:bg-white/10"
            aria-label={removeLabel}
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </Component>
    );
  }
);

Chip.displayName = "Chip";

export default Chip;
