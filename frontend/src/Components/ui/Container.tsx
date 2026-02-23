import {
  type ElementType,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";

const SIZE_MAP = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-7xl",
  xl: "max-w-8xl",
  full: "max-w-full",
} as const;

type ContainerSize = keyof typeof SIZE_MAP;

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  size?: ContainerSize;
  centered?: boolean;
  gutters?: boolean;
  children?: ReactNode;
}

const Container = forwardRef<HTMLElement, ContainerProps>(
  (
    {
      as: Component = "div",
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
