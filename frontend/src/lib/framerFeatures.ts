// Re-exporting `domAnimation` from its own module lets Vite split the
// framer-motion feature pack into a separate chunk that is loaded *after*
// the initial render via `LazyMotion`'s dynamic-features API.
//
// Without this indirection, importing `domAnimation` directly in App.tsx
// pulls the entire DOM animation runtime (~50 kB raw) into the critical
// path, even though `m` components render without it.
export { domAnimation as default } from "framer-motion";
