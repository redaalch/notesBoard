import { forwardRef, useMemo } from "react";
import { cn } from "../../lib/cn.js";
import Surface from "./Surface.jsx";

const GAP_MAP = {
  none: "gap-0",
  xs: "gap-2",
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-6",
};

const Card = forwardRef(
  (
    {
      as: asComponent = "section",
      variant = "raised",
      padding = "md",
      spacing = "md",
      eyebrow = null,
      title = null,
      subtitle = null,
      actions = null,
      footer = null,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const Component = asComponent;
    const gapClass = GAP_MAP[spacing] ?? GAP_MAP.md;
    const useOutline = variant === "outline";

    const surfaceVariant = useMemo(() => {
      if (variant === "base" || variant === "outline") return "base";
      if (variant === "overlay") return "overlay";
      if (variant === "inset") return "inset";
      return "raised";
    }, [variant]);

    const hasHeader = eyebrow || title || actions;

    return (
      <Surface
        ref={ref}
        as={Component}
        variant={surfaceVariant}
        padding={padding}
        shadow={!useOutline}
        className={cn(
          "flex flex-col",
          gapClass,
          useOutline &&
            "surface-base border border-dashed border-border-subtle shadow-none",
          className
        )}
        {...props}
      >
        {hasHeader ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-2">
              {eyebrow ? (
                <span className="typ-caption text-brand-600">{eyebrow}</span>
              ) : null}
              {title ? (
                typeof title === "string" ? (
                  <h3 className="typ-title text-text-primary">{title}</h3>
                ) : (
                  title
                )
              ) : null}
              {subtitle ? (
                typeof subtitle === "string" ? (
                  <p className="typ-body-sm text-subtle">{subtitle}</p>
                ) : (
                  subtitle
                )
              ) : null}
            </div>
            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {actions}
              </div>
            ) : null}
          </div>
        ) : null}

        {children}

        {footer ? (
          <div className="border-t border-border-subtle/60 pt-4 text-sm text-subtle">
            {footer}
          </div>
        ) : null}
      </Surface>
    );
  }
);

Card.displayName = "Card";

export default Card;
