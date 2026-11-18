'use client';

// framer-motion's MotionConfig reducedMotion="user" for the few sections that
// still animate with framer. Imported only by those sections (loaded as async
// chunks via sections/lazy.tsx), so framer never enters the shared bundle.
// Context only: server and client markup stay identical.

import { MotionConfig } from 'framer-motion';
import { useSyncExternalStore, type ComponentType } from 'react';
import { storeMotionOff } from './inView';

// The attribute sits on the server-rendered store root and stays as it is
// while a storefront page lives, so there is nothing to subscribe to (the
// builder preview re-reads it on its next render).
const noSubscription = () => () => {};
const serverMotionOff = () => false;

export function withReducedMotion<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  function WithReducedMotion(props: P) {
    // A store that switched motion off gets "always". The server and the
    // hydration render read false ("user"), so the markup stays identical;
    // the real value applies right after.
    const motionOff = useSyncExternalStore(noSubscription, storeMotionOff, serverMotionOff);
    return (
      <MotionConfig reducedMotion={motionOff ? 'always' : 'user'}>
        <Component {...props} />
      </MotionConfig>
    );
  }
  WithReducedMotion.displayName = `WithReducedMotion(${Component.displayName || Component.name || 'Component'})`;
  return WithReducedMotion;
}
