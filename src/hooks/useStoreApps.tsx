'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { StoreAppKey, StorefrontAppEntry, StorefrontApps } from '@/lib/storeApps';

// ── Store apps context ────────────────────────────────────────────────────────
// `storefront.getStore(...).apps` made available to every client component of
// the storefront so UI can be gated on an enabled app (see <IfApp>). Provided
// by StoreProviders; `{}` outside a provider tree or when nothing is enabled.

const EMPTY_APPS: StorefrontApps = {};

const StoreAppsContext = createContext<StorefrontApps>(EMPTY_APPS);

export function StoreAppsProvider({ value, children }: { value?: StorefrontApps | null; children: ReactNode }) {
  return <StoreAppsContext.Provider value={value ?? EMPTY_APPS}>{children}</StoreAppsContext.Provider>;
}

/** The store's enabled apps map; `{}` when none / outside a StoreProviders tree. */
export function useStoreApps(): StorefrontApps {
  return useContext(StoreAppsContext);
}

/** The enabled entry for one app, or null when it is off. */
export function useStoreApp(key: StoreAppKey): StorefrontAppEntry | null {
  const entry = useStoreApps()[key];
  return entry && entry.enabled === true ? entry : null;
}
