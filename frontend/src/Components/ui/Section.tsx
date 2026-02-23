import {
  type ElementType,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";

const SPACING_MAP = {
  none: "",
  sm: "py-8 sm:py-12",
  md: "py-12 sm:py-16 lg:py-20",
  lg: "py-16 sm:py-20 lg:py-24",
  xl: "py-20 sm:py-24 lg:py-32",
} as const;

type SectionSpacing = keyof typeof SPACING_MAP;

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  spacing?: SectionSpacing;
  children?: ReactNode;
}

const Section = forwardRef<HTMLElement, SectionProps>(
  (
    {
      as: Component = "section",
      spacing = "md",
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const spacingClass = SPACING_MAP[spacing] ?? SPACING_MAP.md;

    return (
      <Component
        ref={ref}
        className={cn("relative w-full", spacingClass, className)}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Section.displayName = "Section";

export default Section;
