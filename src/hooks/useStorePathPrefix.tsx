'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { linkPrefix } from '@/lib/localePaths';

// M156: the request's URL prefix on a locale-path market ('' = root,
// '/de-at', '/ar', '/de'), computed once by the proxy (`x-store-path-prefix`)
// and handed down by the store layouts through StoreProviders. Undefined for
// every other store, outside a store tree and in the builder preview: the
// hooks below then return today's `/<locale>` formula.

const StorePathPrefixContext = createContext<string | undefined>(undefined);

export function StorePathPrefixProvider({ value, children }: { value?: string; children: ReactNode }) {
  return <StorePathPrefixContext.Provider value={value}>{children}</StorePathPrefixContext.Provider>;
}

/** The raw context value: the proxy's prefix, or undefined (legacy). */
export function useStorePathPrefixValue(): string | undefined {
  return useContext(StorePathPrefixContext);
}

/**
 * Link prefix for client-built store links: the request's path prefix when
 * the store layout provided one, else '' for the primary locale and
 * `/<locale>` for a secondary one (the legacy formula).
 */
export function useStorePathPrefix(locale: string | undefined, primaryLocale: string | undefined): string {
  const pathPrefix = useContext(StorePathPrefixContext);
  return linkPrefix({ locale: locale ?? '', primaryLocale: primaryLocale ?? '', pathPrefix });
}
