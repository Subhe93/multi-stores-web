'use client';

// Wraps the storefront so framer-motion honours the visitor's
// prefers-reduced-motion setting consistently. With reducedMotion="user",
// transform/layout animations are dropped for users who ask for reduced motion
// (no sliding/scaling), while gentle opacity fades still play. Crucially, this
// is done via context — it never changes server-vs-client markup, so it can't
// cause a hydration mismatch the way branching on useReducedMotion() does.

import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
