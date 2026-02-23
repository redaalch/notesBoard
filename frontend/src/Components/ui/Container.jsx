import { forwardRef } from "react";
import { cn } from "../../lib/cn";

const SIZE_MAP = {
  sm: "max-w-3xl", // ~768px
  md: "max-w-5xl", // ~1024px
  lg: "max-w-7xl", // ~1280px
  xl: "max-w-8xl", // ~1440px
  full: "max-w-full",
};

/**
 * Container component for consistent page width and padding
 *
 * @param {Object} props
 * @param {('sm'|'md'|'lg'|'xl'|'full')} props.size - Container max width
 * @param {boolean} props.centered - Center the container horizontally
 * @param {boolean} props.gutters - Add horizontal padding
 */
const Container = forwardRef(
  (
    {
      as: Component = "div", // eslint-disable-line no-unused-vars
      size = "lg",
      centered = true,
      gutters = true,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const sizeClass = SIZE_MAP[size] ?? SIZE_MAP.lg;

    return (
      <Component
        ref={ref}
        className={cn(
          "w-full",
          sizeClass,
          centered && "mx-auto",
          gutters && "px-4 sm:px-6 lg:px-8",
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Container.displayName = "Container";

export default Container;
