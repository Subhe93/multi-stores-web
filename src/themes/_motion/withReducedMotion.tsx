'use client';

// framer-motion's MotionConfig reducedMotion="user" for the few sections that
// still animate with framer. Imported only by those sections (loaded as async
// chunks via sections/lazy.tsx), so framer never enters the shared bundle.
// Context only: server and client markup stay identical.

import { MotionConfig } from 'framer-motion';
import type { ComponentType } from 'react';
import { storeMotionOff } from './inView';

export function withReducedMotion<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  function WithReducedMotion(props: P) {
    // A store that switched motion off gets "always". The flag is read from
    // the store root during render, the hydration render included: framer
    // copies this setting into each element once, when the element is
    // created, so a value that arrives one render later is never applied.
    // The store root is server HTML and an ancestor of every section, so it
    // is in the document before any section hydrates. MotionConfig is a
    // context provider with no markup of its own, so reading "always" on the
    // client where the server read "user" cannot cause a hydration mismatch.
    const motionOff = storeMotionOff();
    return (
      <MotionConfig reducedMotion={motionOff ? 'always' : 'user'}>
        <Component {...props} />
      </MotionConfig>
    );
  }
  WithReducedMotion.displayName = `WithReducedMotion(${Component.displayName || Component.name || 'Component'})`;
  return WithReducedMotion;
}
