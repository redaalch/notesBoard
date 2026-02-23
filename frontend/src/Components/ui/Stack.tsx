import {
  type ElementType,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";

const GAP_MAP = {
  none: "gap-0",
  xs: "gap-2",
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
} as const;

const ALIGN_MAP = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
} as const;

const JUSTIFY_MAP = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
  evenly: "justify-evenly",
} as const;

type StackGap = keyof typeof GAP_MAP;
type StackAlign = keyof typeof ALIGN_MAP;
type StackJustify = keyof typeof JUSTIFY_MAP;

export interface StackProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  direction?: "row" | "column";
  gap?: StackGap;
  align?: StackAlign;
  justify?: StackJustify;
  wrap?: boolean;
  inline?: boolean;
  children?: ReactNode;
}

const Stack = forwardRef<HTMLElement, StackProps>(
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
    ref,
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
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Stack.displayName = "Stack";

export default Stack;
