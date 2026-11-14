'use client';

import { useSyncExternalStore } from 'react';

const subscribeNoop = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/**
 * False on the server and during hydration, true right after the calling
 * boundary has hydrated (React re-renders with the client snapshot), with no
 * hydration mismatch. A component rendered fresh on the client (not
 * hydrated) gets true immediately.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNoop, clientSnapshot, serverSnapshot);
}
