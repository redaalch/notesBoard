import { useState } from "react";
import { motion } from "framer-motion";
import { ImageIcon } from "lucide-react";

export const LazyImage = ({
  src,
  alt,
  className = "",
  fallback,
  containerClassName = "",
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {/* Loading placeholder */}
      {!loaded && !error && (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className={`${className} bg-base-200 flex items-center justify-center`}
        >
          <ImageIcon className="w-8 h-8 text-base-content/20" />
        </motion.div>
      )}

      {/* Error fallback */}
      {error && (
        <div
          className={`${className} bg-base-200 flex items-center justify-center`}
        >
          {fallback || (
            <div className="text-center text-base-content/40">
              <ImageIcon className="w-8 h-8 mx-auto mb-2" />
              <span className="text-xs">Failed to load</span>
            </div>
          )}
        </div>
      )}

      {/* Actual image */}
      {!error && (
        <motion.img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className={className}
          style={{ display: loaded ? "block" : "none" }}
        />
      )}
    </div>
  );
};

export default LazyImage;
