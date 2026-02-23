import { forwardRef, useMemo } from "react";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import Surface from "./Surface.jsx";

const TREND_TONE_CLASSES = {
  positive: "text-emerald-600",
  negative: "text-error",
  neutral: "text-subtle",
};

const MetricTile = forwardRef(
  (
    {
      as: asComponent = "div",
      variant = "raised",
      label,
      value,
      sublabel,
      icon = null,
      trend = null,
      className,
      ...props
    },
    ref,
  ) => {
    const Component = asComponent;
    const surfaceVariant =
      variant === "base"
        ? "base"
        : variant === "overlay"
          ? "overlay"
          : variant === "inset"
            ? "inset"
            : "raised";

    const trendConfig = useMemo(() => {
      if (!trend) return null;
      const direction = trend.direction ?? "neutral";
      const tone =
        trend.tone ??
        (direction === "down"
          ? "negative"
          : direction === "up"
            ? "positive"
            : "neutral");
      const text = trend.label ?? trend.value ?? null;
      const Icon =
        direction === "down"
          ? ArrowDownRightIcon
          : direction === "up"
            ? ArrowUpRightIcon
            : null;

      return {
        toneClass: TREND_TONE_CLASSES[tone] ?? TREND_TONE_CLASSES.neutral,
        text,
        Icon,
      };
    }, [trend]);

    const TrendIcon = trendConfig?.Icon ?? null;

    return (
      <Surface
        ref={ref}
        as={Component}
        variant={surfaceVariant}
        padding="sm"
        className={cn("flex flex-col gap-3 rounded-2xl", className)}
        {...props}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            {label ? (
              <span className="typ-caption text-subtle">{label}</span>
            ) : null}
            <span className="typ-headline text-text-primary">{value}</span>
            {sublabel ? (
              <span className="text-sm text-subtle">{sublabel}</span>
            ) : null}
          </div>
          {icon ? (
            <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              {icon}
            </span>
          ) : null}
        </div>
        {trendConfig?.text ? (
          <div
            className={cn(
              "flex items-center gap-1 text-sm font-medium",
              trendConfig.toneClass,
            )}
          >
            {TrendIcon ? (
              <TrendIcon className="size-4" aria-hidden="true" />
            ) : null}
            <span>{trendConfig.text}</span>
          </div>
        ) : null}
      </Surface>
    );
  },
);

MetricTile.displayName = "MetricTile";

export default MetricTile;
