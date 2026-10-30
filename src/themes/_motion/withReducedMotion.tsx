'use client';

// framer-motion's MotionConfig reducedMotion="user" for the few sections that
// still animate with framer. Imported only by those sections (loaded as async
// chunks via sections/lazy.tsx), so framer never enters the shared bundle.
// Context only: server and client markup stay identical.

import { MotionConfig } from 'framer-motion';
import type { ComponentType } from 'react';

export function withReducedMotion<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  function WithReducedMotion(props: P) {
    return (
      <MotionConfig reducedMotion="user">
        <Component {...props} />
      </MotionConfig>
    );
  }
  WithReducedMotion.displayName = `WithReducedMotion(${Component.displayName || Component.name || 'Component'})`;
  return WithReducedMotion;
}
