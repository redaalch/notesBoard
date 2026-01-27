import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const SPACING_MAP = {
  none: "",
  sm: "py-8 sm:py-12",
  md: "py-12 sm:py-16 lg:py-20",
  lg: "py-16 sm:py-20 lg:py-24",
  xl: "py-20 sm:py-24 lg:py-32",
};

/**
 * Section component for consistent vertical spacing between page sections
 *
 * @param {Object} props
 * @param {('none'|'sm'|'md'|'lg'|'xl')} props.spacing - Vertical spacing
 * @param {string} props.className - Additional CSS classes
 */
const Section = forwardRef(
  (
    {
      as: Component = "section", // eslint-disable-line no-unused-vars
      spacing = "md",
      className,
      children,
      ...props
    },
    ref
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
  }
);

Section.displayName = "Section";

export default Section;
