import { forwardRef } from "react";
import { cn } from "../../lib/cn";

const BASE_CLASSES =
  "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-180 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none gap-2";

const SIZE_VARIANTS = {
  xs: "h-8 px-3 text-xs min-h-[32px]",
  sm: "h-9 px-4 text-sm min-h-[36px]",
  md: "h-10 px-5 text-sm min-h-[40px]",
  lg: "h-12 px-6 text-base min-h-[48px]",
  xl: "h-14 px-8 text-base min-h-[56px]",
};

const ICON_SIZE = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-4.5",
  lg: "size-5",
  xl: "size-5.5",
};

/**
 * Button Variants System
 * - primary: Main CTA actions (blue brand)
 * - secondary: Alternative actions (neutral gray)
 * - subtle: Low-emphasis actions (minimal background)
 * - critical: Warning actions (orange/yellow)
 * - destructive: Dangerous actions (red)
 */
const VARIANT_STYLES = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-500 hover:shadow-md active:bg-brand-700 focus-visible:ring-brand-300",
  secondary:
    "bg-neutral-100 text-neutral-900 border border-neutral-300 shadow-xs hover:bg-neutral-200 hover:border-neutral-400 active:bg-neutral-300 focus-visible:ring-neutral-300 dark:bg-dark-700 dark:text-dark-50 dark:border-dark-600 dark:hover:bg-dark-600",
  subtle:
    "bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 focus-visible:ring-neutral-300 dark:text-dark-100 dark:hover:bg-dark-800",
  critical:
    "bg-warning text-white shadow-sm hover:bg-warning/90 hover:shadow-md active:bg-warning/80 focus-visible:ring-warning/40",
  destructive:
    "bg-error text-white shadow-sm hover:bg-error/90 hover:shadow-md active:bg-error/80 focus-visible:ring-error/40",

  // Additional useful variants
  accent:
    "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 hover:shadow-md active:bg-emerald-700 focus-visible:ring-emerald-300",
  ghost:
    "bg-transparent text-neutral-600 hover:bg-neutral-50 active:bg-neutral-100 focus-visible:ring-neutral-200 dark:text-dark-200 dark:hover:bg-dark-800",
  outline:
    "bg-transparent border-2 border-brand-600 text-brand-600 hover:bg-brand-50 active:bg-brand-100 focus-visible:ring-brand-300 dark:border-brand-400 dark:text-brand-400 dark:hover:bg-dark-800",
};

const Spinner = ({ size = "md" }) => {
  const spinnerSize = ICON_SIZE[size] ?? ICON_SIZE.md;
  return (
    <span
      className={cn(
        "inline-flex animate-spin rounded-full border-2 border-current border-t-transparent",
        spinnerSize,
      )}
      aria-hidden="true"
      role="status"
    />
  );
};

/**
 * Button Component
 *
 * @param {Object} props
 * @param {('primary'|'secondary'|'subtle'|'critical'|'destructive'|'accent'|'ghost'|'outline')} props.variant - Button visual style
 * @param {('xs'|'sm'|'md'|'lg'|'xl')} props.size - Button size
 * @param {ReactNode} props.icon - Optional icon element
 * @param {('left'|'right')} props.iconPosition - Icon placement
 * @param {boolean} props.loading - Show loading spinner
 * @param {boolean} props.fullWidth - Full width button
 * @param {boolean} props.disabled - Disabled state
 * @param {string} props.className - Additional CSS classes
 * @param {('button'|'a'|Component)} props.as - Render as different element
 */
const Button = forwardRef(
  (
    {
      as: Component = "button",
      children,
      className,
      variant = "primary",
      size = "md",
      icon = null,
      iconPosition = "left",
      loading = false,
      fullWidth = false,
      disabled = false,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const variantClass = VARIANT_STYLES[variant] ?? VARIANT_STYLES.primary;
    const sizeClass = SIZE_VARIANTS[size] ?? SIZE_VARIANTS.md;
    const iconClass = ICON_SIZE[size] ?? ICON_SIZE.md;
    const isDisabled = disabled || loading;
    const showIconLeft = icon && iconPosition === "left" && !loading;
    const showIconRight = icon && iconPosition === "right" && !loading;

    return (
      <Component
        ref={ref}
        type={Component === "button" ? type : undefined}
        className={cn(
          BASE_CLASSES,
          sizeClass,
          variantClass,
          fullWidth && "w-full",
          loading && "relative",
          className,
        )}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Spinner size={size} />}
        {showIconLeft && (
          <span
            className={cn("inline-flex items-center justify-center", iconClass)}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        {children && (
          <span className={cn("whitespace-nowrap", loading && "invisible")}>
            {children}
          </span>
        )}
        {showIconRight && (
          <span
            className={cn("inline-flex items-center justify-center", iconClass)}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </Component>
    );
  },
);

Button.displayName = "Button";

export default Button;
