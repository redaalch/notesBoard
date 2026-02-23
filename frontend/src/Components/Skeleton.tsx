import { motion } from "framer-motion";

export interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  animate?: boolean;
}

export const Skeleton = ({
  width = "100%",
  height = "1rem",
  className = "",
  animate = true,
}: SkeletonProps) => {
  const baseClass = "rounded bg-base-200";

  if (!animate) {
    return (
      <div style={{ width, height }} className={`${baseClass} ${className}`} />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      style={{ width, height }}
      className={`${baseClass} ${className}`}
    />
  );
};

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export const SkeletonText = ({ lines = 3, className = "" }: SkeletonTextProps) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        width={i === lines - 1 ? "60%" : "100%"}
        height="0.875rem"
      />
    ))}
  </div>
);

export interface SkeletonCardProps {
  className?: string;
}

export const SkeletonCard = ({ className = "" }: SkeletonCardProps) => (
  <div className={`card bg-base-100 shadow-xl ${className}`}>
    <div className="card-body space-y-4">
      <Skeleton width="80%" height="1.5rem" />
      <SkeletonText lines={3} />
      <div className="flex gap-2">
        <Skeleton width="4rem" height="2rem" />
        <Skeleton width="4rem" height="2rem" />
      </div>
    </div>
  </div>
);

type AvatarSize = "sm" | "md" | "lg" | "xl";

export interface SkeletonAvatarProps {
  size?: AvatarSize;
  className?: string;
}

export const SkeletonAvatar = ({ size = "md", className = "" }: SkeletonAvatarProps) => {
  const sizeMap: Record<AvatarSize, string> = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  };

  return <Skeleton className={`rounded-full ${sizeMap[size]} ${className}`} />;
};

export interface SkeletonButtonProps {
  className?: string;
}

export const SkeletonButton = ({ className = "" }: SkeletonButtonProps) => (
  <Skeleton
    width="6rem"
    height="2.5rem"
    className={`rounded-lg ${className}`}
  />
);

export interface SkeletonInputProps {
  className?: string;
}

export const SkeletonInput = ({ className = "" }: SkeletonInputProps) => (
  <Skeleton
    width="100%"
    height="2.5rem"
    className={`rounded-lg ${className}`}
  />
);

export default Skeleton;
