import { motion } from "framer-motion";

interface NoteSkeletonProps {
  count?: number;
}

function NoteSkeleton({ count = 6 }: NoteSkeletonProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="card bg-base-100/50 backdrop-blur border border-base-200/60 shadow-sm"
        >
          <div className="card-body space-y-4">
            {/* Title skeleton with shimmer */}
            <motion.div
              animate={{
                backgroundPosition: ["200% 0", "-200% 0"],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
              }}
              className="h-6 w-2/3 bg-gradient-to-r from-base-200 via-base-300 to-base-200 rounded"
              style={{ backgroundSize: "200% 100%" }}
            />

            {/* Content skeleton lines with staggered fade */}
            <div className="space-y-2">
              <motion.div
                className="h-4 bg-base-200 rounded w-full"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.div
                className="h-4 bg-base-200 rounded w-5/6"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="h-4 bg-base-200 rounded w-2/3"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
              />
            </div>

            {/* Action button skeleton */}
            <motion.div
              className="h-10 bg-base-200 rounded w-full"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default NoteSkeleton;
