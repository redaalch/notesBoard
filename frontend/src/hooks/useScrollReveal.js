import { useInView } from "react-intersection-observer";

export const useScrollReveal = (options = {}) => {
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
        transition: { duration: 0.6, ease: "easeOut" },
      },
    },
    animate: inView ? "visible" : "hidden",
  };
};

export default useScrollReveal;
