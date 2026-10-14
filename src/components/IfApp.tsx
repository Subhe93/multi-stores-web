'use client';

import type { ReactNode } from 'react';
import { useStoreApp } from '@/hooks/useStoreApps';
import type { StoreAppKey } from '@/lib/storeApps';

/**
 * Render `children` only when the store has `app` enabled.
 *
 *   <IfApp app="b2b" fallback={null}>
 *     <RequestQuoteButton />
 *   </IfApp>
 */
export function IfApp({
  app,
  fallback = null,
  children,
}: {
  app: StoreAppKey;
  /** Rendered when the app is not enabled. */
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const entry = useStoreApp(app);
  return <>{entry ? children : fallback}</>;
}
