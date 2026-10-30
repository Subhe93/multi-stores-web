// Shared motion primitives used across theme sections: CSS + one shared
// IntersectionObserver, no framer-motion (keeps it out of the shared bundle).
// All are client components and respect prefers-reduced-motion.
export { Reveal, type RevealDirection } from './Reveal';
export { StaggerGroup, StaggerItem } from './Stagger';
export { Counter } from './Counter';
