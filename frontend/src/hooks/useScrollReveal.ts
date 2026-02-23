import {
  useInView,
  type IntersectionOptions,
} from "react-intersection-observer";

export const useScrollReveal = (options: IntersectionOptions = {}) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
    ...options,
  });

  return {
    ref,
    variants: {
      hidden: { opacity: 0, y: 50 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: "easeOut" as const },
      },
    },
    animate: inView ? ("visible" as const) : ("hidden" as const),
  };
};

export default useScrollReveal;
