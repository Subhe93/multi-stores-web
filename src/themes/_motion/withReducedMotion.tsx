'use client';

// framer-motion's MotionConfig reducedMotion="user" for the few sections that
// still animate with framer. Imported only by those sections (loaded as async
// chunks via sections/lazy.tsx), so framer never enters the shared bundle.
// Context only: server and client markup stay identical.

import { MotionConfig } from 'framer-motion';
import { useEffect, useState, type ComponentType } from 'react';
import { storeMotionOff } from './inView';

export function withReducedMotion<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  function WithReducedMotion(props: P) {
    // A store that switched motion off gets "always". Read after mount, so
    // the server and the first client render both use "user".
    const [mode, setMode] = useState<'user' | 'always'>('user');
    useEffect(() => {
      if (storeMotionOff()) setMode('always');
    }, []);
    return (
      <MotionConfig reducedMotion={mode}>
        <Component {...props} />
      </MotionConfig>
    );
  }
  WithReducedMotion.displayName = `WithReducedMotion(${Component.displayName || Component.name || 'Component'})`;
  return WithReducedMotion;
}
