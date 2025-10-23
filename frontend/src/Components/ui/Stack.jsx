import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const GAP_MAP = {
  none: "gap-0",
  xs: "gap-2",
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
};

const ALIGN_MAP = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

const JUSTIFY_MAP = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
  evenly: "justify-evenly",
};

const Stack = forwardRef(
  (
    {
      as: asComponent = "div",
      direction = "column",
      gap = "md",
      align = "start",
      justify = "start",
      wrap = false,
      inline = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Component = asComponent;
    const flexDirection = direction === "row" ? "flex-row" : "flex-col";
    const rootDisplay = inline ? "inline-flex" : "flex";
    const gapClass = GAP_MAP[gap] ?? GAP_MAP.md;
    const alignClass = ALIGN_MAP[align] ?? ALIGN_MAP.start;
    const justifyClass = JUSTIFY_MAP[justify] ?? JUSTIFY_MAP.start;

    return (
      <Component
        ref={ref}
        className={cn(
          rootDisplay,
          flexDirection,
          gapClass,
          alignClass,
          justifyClass,
          wrap && "flex-wrap",
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Stack.displayName = "Stack";

export default Stack;
