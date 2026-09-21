'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { StoreTaxConfig } from '@/lib/tax';

// ── Store tax settings context ────────────────────────────────────────────────
// `storefront.getStore(...).tax` made available to every client component of
// the storefront (price suffixes, guest-cart hints). Provided by StoreProviders.

const StoreTaxContext = createContext<StoreTaxConfig | null>(null);

export function StoreTaxProvider({ value, children }: { value: StoreTaxConfig | null; children: ReactNode }) {
  return <StoreTaxContext.Provider value={value}>{children}</StoreTaxContext.Provider>;
}

/** The store's tax settings, or null outside a StoreProviders tree / when the API sent none. */
export function useStoreTax(): StoreTaxConfig | null {
  return useContext(StoreTaxContext);
}
